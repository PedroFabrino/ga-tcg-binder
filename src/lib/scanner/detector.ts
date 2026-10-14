import type { Point, Quad, Rect } from "./contracts";
import { orderCorners, quadArea } from "./geometry";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    cv?: any;
  }
}

let loading: Promise<any> | null = null;

/** Lazily load the self-hosted OpenCV.js build (only when the scanner opens). */
export function loadOpenCv(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("OpenCV requires a browser"));
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const ready = (cv: any) => (cv.Mat ? resolve(cv) : (cv.onRuntimeInitialized = () => resolve(cv)));
    if (window.cv) return ready(window.cv);
    const s = document.createElement("script");
    s.src = "/vendor/opencv.js";
    s.async = true;
    s.onload = () => {
      const cv = window.cv;
      if (cv && typeof cv.then === "function") cv.then(resolve, reject); // newer builds expose a promise
      else ready(cv);
    };
    s.onerror = () => {
      loading = null;
      reject(new Error("Failed to load OpenCV.js"));
    };
    document.head.appendChild(s);
  });
  return loading;
}

export interface DetectResult {
  quad: Quad | null;
  /** Downscaled grayscale (for sharpness/glare) in analysis space. */
  gray: Uint8ClampedArray;
  width: number;
  height: number;
  /** Analysis-space px per frame px; multiply frame coords by this to index `gray`. */
  scale: number;
}

/**
 * Find the largest convex 4-point contour inside `guide` (expanded slightly) on a downscaled frame.
 * Returned coordinates are in the frame's own pixel space.
 */
export function detectCardQuad(cv: any, frame: ImageData, guide: Rect, analysisWidth = 480): DetectResult {
  const scale = Math.min(1, analysisWidth / frame.width);
  const src = cv.matFromImageData(frame);
  const small = new cv.Mat();
  const gray = new cv.Mat();
  const blur = new cv.Mat();
  const edges = new cv.Mat();
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  const kernel = cv.Mat.ones(3, 3, cv.CV_8U);
  let best: Point[] | null = null;
  try {
    cv.resize(src, small, new cv.Size(0, 0), scale, scale, cv.INTER_AREA);
    cv.cvtColor(small, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, blur, new cv.Size(5, 5), 0);
    cv.Canny(blur, edges, 50, 150);
    cv.dilate(edges, edges, kernel);
    cv.findContours(edges, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

    const g = { x: guide.x * scale, y: guide.y * scale, w: guide.width * scale, h: guide.height * scale };
    const pad = 0.15;
    const inGuide = (p: Point) =>
      p.x >= g.x - g.w * pad && p.x <= g.x + g.w * (1 + pad) && p.y >= g.y - g.h * pad && p.y <= g.y + g.h * (1 + pad);

    let bestArea = 0;
    for (let i = 0; i < contours.size(); i++) {
      const c = contours.get(i);
      const approx = new cv.Mat();
      try {
        const peri = cv.arcLength(c, true);
        cv.approxPolyDP(c, approx, 0.02 * peri, true);
        if (approx.rows !== 4 || !cv.isContourConvex(approx)) continue;
        const pts: Point[] = [];
        for (let k = 0; k < 4; k++) pts.push({ x: approx.intPtr(k, 0)[0], y: approx.intPtr(k, 0)[1] });
        if (!pts.every(inGuide)) continue;
        const area = quadArea(orderCorners(pts));
        if (area > bestArea) {
          bestArea = area;
          best = pts;
        }
      } finally {
        approx.delete();
        c.delete();
      }
    }
    const quad = best ? (orderCorners(best).map((p) => ({ x: p.x / scale, y: p.y / scale })) as Quad) : null;
    return { quad, gray: new Uint8ClampedArray(gray.data), width: small.cols, height: small.rows, scale };
  } finally {
    [src, small, gray, blur, edges, contours, hierarchy, kernel].forEach((m) => m.delete());
  }
}
