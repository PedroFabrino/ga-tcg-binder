import type { Point, Quad, Rect } from "./contracts";
import { orderCorners, quadArea } from "./geometry";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    cv?: any;
  }
}

let cachedCv: any = null;
let loading: Promise<any> | null = null;

/** Lazily load the self-hosted OpenCV.js build (only when the scanner opens). */
export function loadOpenCv(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("OpenCV requires a browser"));
  if (cachedCv) return Promise.resolve(cachedCv);
  if (loading) return loading;

  loading = new Promise((resolve, reject) => {
    let resolved = false;
    const finish = (realCv: any) => {
      if (resolved) return;
      resolved = true;
      cachedCv = realCv;
      window.cv = realCv;
      resolve(realCv);
    };

    const inspectCv = (cvVal: any) => {
      if (!cvVal) return false;
      if (typeof cvVal.then === "function") {
        cvVal.then(finish).catch((err: any) => {
          loading = null;
          reject(err);
        });
        return true;
      }
      if (cvVal.Mat) {
        finish(cvVal);
        return true;
      }
      if (typeof cvVal.onRuntimeInitialized !== "undefined" || typeof cvVal === "object") {
        cvVal.onRuntimeInitialized = () => finish(cvVal);
        return true;
      }
      return false;
    };

    if (inspectCv(window.cv)) return;

    const existingScript = document.querySelector('script[src*="opencv.js"]');
    if (existingScript) {
      let elapsed = 0;
      const interval = setInterval(() => {
        elapsed += 50;
        if (inspectCv(window.cv)) {
          clearInterval(interval);
        } else if (elapsed > 15000) {
          clearInterval(interval);
          loading = null;
          reject(new Error("Timeout initializing OpenCV"));
        }
      }, 50);
      return;
    }

    const s = document.createElement("script");
    s.src = "/vendor/opencv.js";
    s.async = true;
    s.onload = () => {
      let elapsed = 0;
      const interval = setInterval(() => {
        elapsed += 50;
        if (inspectCv(window.cv)) {
          clearInterval(interval);
        } else if (elapsed > 15000) {
          clearInterval(interval);
          loading = null;
          reject(new Error("Timeout waiting for OpenCV runtime"));
        }
      }, 50);
    };
    s.onerror = () => {
      loading = null;
      reject(new Error("Failed to load /vendor/opencv.js"));
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
 * Returned coordinates are scaled back to the full frame's pixel space.
 */
export function detectCardQuad(cv: any, frame: ImageData, guide: Rect, scale = 1): DetectResult {
  const src = cv.matFromImageData(frame);
  const gray = new cv.Mat();
  const blur = new cv.Mat();
  const edges = new cv.Mat();
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  const kernel = cv.Mat.ones(3, 3, cv.CV_8U);
  let best: Point[] | null = null;
  try {
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
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
    return { quad, gray: new Uint8ClampedArray(gray.data), width: src.cols, height: src.rows, scale };
  } finally {
    [src, gray, blur, edges, contours, hierarchy, kernel].forEach((m) => m.delete());
  }
}
