import type { Rect } from "./contracts";
import { CARD_H, CARD_W } from "./contracts";

/** Stage 4 ROIs on the canonical 630x880 card. */
export const cropRects = {
  header: { x: 30, y: 0, width: 570, height: 132 },
  footer: { x: 0, y: 748, width: 630, height: 132 },
  /** Full-card region used for the visual fingerprint. */
  card: { x: 0, y: 0, width: CARD_W, height: CARD_H },
} as const satisfies Record<string, Rect>;

export function cropCanvas(src: HTMLCanvasElement, r: Rect): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = r.width;
  out.height = r.height;
  out.getContext("2d")!.drawImage(src, r.x, r.y, r.width, r.height, 0, 0, r.width, r.height);
  return out;
}

export function canvasToGray(canvas: HTMLCanvasElement): { gray: Uint8ClampedArray; width: number; height: number } {
  const { width, height } = canvas;
  const data = canvas.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, width, height).data;
  const gray = new Uint8ClampedArray(width * height);
  for (let i = 0; i < gray.length; i++) {
    gray[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
  }
  return { gray, width, height };
}

/**
 * Prepare an ROI strip for OCR: grayscale -> CLAHE -> bilateral denoise -> adaptive threshold.
 * Requires a loaded OpenCV.js (`cv`). Returns a new canvas.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function preprocessForOcr(cv: any, roi: HTMLCanvasElement): HTMLCanvasElement {
  const src = cv.imread(roi);
  const gray = new cv.Mat();
  const clahe = new cv.Mat();
  const rgb = new cv.Mat();
  const denoised = new cv.Mat();
  const bin = new cv.Mat();
  const tile = new cv.Size(8, 8);
  const eq = new cv.CLAHE(2.0, tile);
  try {
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    eq.apply(gray, clahe);
    cv.cvtColor(clahe, rgb, cv.COLOR_GRAY2RGB); // bilateralFilter needs 8UC1/8UC3
    cv.bilateralFilter(rgb, denoised, 7, 50, 50);
    cv.cvtColor(denoised, denoised, cv.COLOR_RGB2GRAY);
    cv.adaptiveThreshold(denoised, bin, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 31, 10);
    const out = document.createElement("canvas");
    cv.imshow(out, bin);
    return out;
  } finally {
    [src, gray, clahe, rgb, denoised, bin].forEach((m) => m.delete());
    eq.delete();
  }
}
