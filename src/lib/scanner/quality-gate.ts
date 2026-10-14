import type { Quad, Rect, QualityGateConfig, ScanFrameMetrics } from "./contracts";
import { maxCornerDelta, quadArea, rectArea } from "./geometry";

type Gray = Uint8Array | Uint8ClampedArray;

/** Variance of the 4-neighbour Laplacian over interior pixels (higher = sharper). */
export function laplacianVariance(gray: Gray, w: number, h: number): number {
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const lap = gray[i - 1] + gray[i + 1] + gray[i - w] + gray[i + w] - 4 * gray[i];
      sum += lap;
      sumSq += lap * lap;
      n++;
    }
  }
  if (n === 0) return 0;
  const mean = sum / n;
  return Math.max(0, sumSq / n - mean * mean);
}

function insideConvexQuad(q: Quad, px: number, py: number): boolean {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i];
    const b = q[(i + 1) % 4];
    const cross = (b.x - a.x) * (py - a.y) - (b.y - a.y) * (px - a.x);
    if (cross === 0) continue;
    const s = cross > 0 ? 1 : -1;
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

/** Fraction of pixels inside the quad whose luminance exceeds `threshold`. */
export function glareRatio(gray: Gray, w: number, h: number, quad: Quad, threshold: number): number {
  const xs = quad.map((p) => p.x);
  const ys = quad.map((p) => p.y);
  const x0 = Math.max(0, Math.floor(Math.min(...xs)));
  const x1 = Math.min(w - 1, Math.ceil(Math.max(...xs)));
  const y0 = Math.max(0, Math.floor(Math.min(...ys)));
  const y1 = Math.min(h - 1, Math.ceil(Math.max(...ys)));
  let inside = 0;
  let bright = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (!insideConvexQuad(quad, x + 0.5, y + 0.5)) continue;
      inside++;
      if (gray[y * w + x] > threshold) bright++;
    }
  }
  return inside === 0 ? 0 : bright / inside;
}

export interface FrameEvaluationInput {
  guide: Rect;
  quad: Quad | null;
  sharpness: number;
  glare: number;
  timestamp: number;
}

/** Pure per-frame quality gate. Pass the previous result to accumulate the stable-frame count. */
export function evaluateFrame(
  input: FrameEvaluationInput,
  prev: ScanFrameMetrics | null,
  cfg: QualityGateConfig
): ScanFrameMetrics {
  const { quad, sharpness, glare, timestamp, guide } = input;
  const base = { timestamp, quad, laplacianVariance: sharpness, glareRatio: glare };

  if (!quad) {
    return { ...base, coverage: 0, maxCornerDeltaPx: Infinity, stableFrames: 0, verdict: "no_card", hint: "Align the card inside the guide" };
  }

  const coverage = quadArea(quad) / rectArea(guide);
  const hasPrev = !!prev?.quad;
  const delta = hasPrev ? maxCornerDelta(prev!.quad!, quad) : Infinity;
  const steady = !hasPrev || delta < cfg.maxCornerDeltaPx;
  const passes = coverage >= cfg.minCoverage && sharpness >= cfg.minSharpness && steady;
  const stableFrames = passes ? (prev?.stableFrames ?? 0) + 1 : 0;
  const metrics = { ...base, coverage, maxCornerDeltaPx: delta, stableFrames };

  if (coverage < cfg.minCoverage) return { ...metrics, verdict: "hold", hint: "Move closer so the card fills the guide" };
  if (sharpness < cfg.minSharpness) return { ...metrics, verdict: "blurry", hint: "Hold steady to focus" };
  if (!steady) return { ...metrics, verdict: "unstable", hint: "Hold steady" };
  if (stableFrames < cfg.requiredFrames) return { ...metrics, verdict: "hold" };
  if (glare > cfg.maxGlareRatio) return { ...metrics, verdict: "glare", hint: "Tilt card slightly to reduce glare" };
  return { ...metrics, verdict: "ready" };
}
