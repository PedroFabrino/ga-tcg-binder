import type { FrameVerdict, QualityGateConfig } from "../types/session";

export interface RawFrame {
  coverage: number;
  maxCornerDeltaPx: number;
  laplacianVariance: number;
  glareRatio: number;
}

/** Same ordering as the desktop gate: presence, stability, sharpness, glare, then frame streak. */
export function evaluateFrame(frame: RawFrame, previousStableFrames: number, config: QualityGateConfig): { verdict: FrameVerdict; stableFrames: number } {
  if (frame.coverage < config.minCoverage) return { verdict: "no_card", stableFrames: 0 };
  if (frame.maxCornerDeltaPx > config.maxCornerDeltaPx) return { verdict: "unstable", stableFrames: 0 };
  if (frame.laplacianVariance < config.minSharpness) return { verdict: "blurry", stableFrames: 0 };
  if (frame.glareRatio > config.maxGlareRatio) return { verdict: "glare", stableFrames: 0 };
  const stableFrames = Math.min(previousStableFrames + 1, config.requiredFrames);
  return { verdict: stableFrames >= config.requiredFrames ? "ready" : "hold", stableFrames };
}

export type HudVerdict = "READY" | "HOLD" | "GLARE" | "BLURRY";

export function toHudVerdict(verdict: FrameVerdict): HudVerdict {
  switch (verdict) {
    case "ready":
      return "READY";
    case "glare":
      return "GLARE";
    case "blurry":
      return "BLURRY";
    default:
      return "HOLD";
  }
}

export function verdictHint(verdict: FrameVerdict): string {
  switch (verdict) {
    case "no_card":
      return "Align a card inside the frame";
    case "unstable":
      return "Hold steady";
    case "blurry":
      return "Move closer or let it focus";
    case "glare":
      return "Tilt slightly to cut the glare";
    case "hold":
      return "Locking on...";
    case "ready":
      return "Locked";
  }
}
