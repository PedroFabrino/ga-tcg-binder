import { CARD_H, CARD_W, CARD_ASPECT, type Quad, type Rect, type CaptureSource } from "./contracts";
import { applyHomography, solveHomography } from "./geometry";

const OUT_QUAD: Quad = [
  { x: 0, y: 0 },
  { x: CARD_W, y: 0 },
  { x: CARD_W, y: CARD_H },
  { x: 0, y: CARD_H },
];

/** Largest 2.5:3.5 rect centered in a w x h frame, shrunk by `margin` (0..1). Mirrors the UI guide. */
export function guideRect(w: number, h: number, margin = 0.08): Rect {
  const maxH = h * (1 - margin * 2);
  const maxW = w * (1 - margin * 2);
  const height = Math.min(maxH, maxW / CARD_ASPECT);
  const width = height * CARD_ASPECT;
  return { x: (w - width) / 2, y: (h - height) / 2, width, height };
}

export function rectToQuad(r: Rect): Quad {
  return [
    { x: r.x, y: r.y },
    { x: r.x + r.width, y: r.y },
    { x: r.x + r.width, y: r.y + r.height },
    { x: r.x, y: r.y + r.height },
  ];
}

/**
 * Perspective-warp `quad` of `source` into a canonical 630x880 canvas (bilinear sampling,
 * inverse mapping). Done off-screen; nothing is rendered to the user.
 */
export function warpToCard(source: CanvasImageSource & { width: number; height: number }, quad: Quad): HTMLCanvasElement {
  const sw = source.width;
  const sh = source.height;
  const src = document.createElement("canvas");
  src.width = sw;
  src.height = sh;
  const sctx = src.getContext("2d", { willReadFrequently: true })!;
  sctx.drawImage(source, 0, 0);
  const sdata = sctx.getImageData(0, 0, sw, sh).data;

  const inv = solveHomography(OUT_QUAD, quad); // output pixel -> source pixel
  const out = document.createElement("canvas");
  out.width = CARD_W;
  out.height = CARD_H;
  const octx = out.getContext("2d")!;
  const img = octx.createImageData(CARD_W, CARD_H);

  for (let y = 0; y < CARD_H; y++) {
    for (let x = 0; x < CARD_W; x++) {
      const p = applyHomography(inv, { x: x + 0.5, y: y + 0.5 });
      const fx = Math.min(sw - 1, Math.max(0, p.x - 0.5));
      const fy = Math.min(sh - 1, Math.max(0, p.y - 0.5));
      const x0 = Math.floor(fx), y0 = Math.floor(fy);
      const x1 = Math.min(sw - 1, x0 + 1), y1 = Math.min(sh - 1, y0 + 1);
      const tx = fx - x0, ty = fy - y0;
      const o = (y * CARD_W + x) * 4;
      for (let c = 0; c < 4; c++) {
        const top = sdata[(y0 * sw + x0) * 4 + c] * (1 - tx) + sdata[(y0 * sw + x1) * 4 + c] * tx;
        const bot = sdata[(y1 * sw + x0) * 4 + c] * (1 - tx) + sdata[(y1 * sw + x1) * 4 + c] * tx;
        img.data[o + c] = top * (1 - ty) + bot * ty;
      }
    }
  }
  octx.putImageData(img, 0, 0);
  return out;
}

export interface NormalizedCapture {
  canvas: HTMLCanvasElement;
  blob: Blob;
  source: CaptureSource;
}

/**
 * Stage 3: warp the locked quad (or fall back to the guide rect crop), then export WebP q=0.85.
 * `auto` and `manual_quad` require a quad; without one a manual snap crops the guide bounds.
 */
export async function normalizeCapture(
  frame: CanvasImageSource & { width: number; height: number },
  quad: Quad | null,
  guide: Rect,
  trigger: "auto" | "manual"
): Promise<NormalizedCapture> {
  const source: CaptureSource = quad ? (trigger === "auto" ? "auto" : "manual_quad") : "manual_guide_crop";
  const canvas = warpToCard(frame, quad ?? rectToQuad(guide));
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("WebP export failed"))), "image/webp", 0.85)
  );
  return { canvas, blob, source };
}
