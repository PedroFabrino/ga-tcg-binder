export type SessionState = "DISCONNECTED" | "CONNECTING" | "ACTIVE_SCANNING" | "RECONNECTING";

/** QR payload rendered by the desktop when a scanner session opens. */
export interface PairingPayload {
  action: "pair_scanner";
  sessionId: string;
  wsEndpoint: string;
  token: string;
}

export interface ScanSession {
  sessionId: string;
  desktopName: string;
  pairedAt: number;
}

/** Mirrors the quality gate in @ga/contracts. */
export type FrameVerdict = "ready" | "hold" | "glare" | "blurry" | "unstable" | "no_card";

export interface QualityGateConfig {
  minCoverage: number;
  maxCornerDeltaPx: number;
  minSharpness: number;
  maxGlareRatio: number;
  requiredFrames: number;
}

export const DEFAULT_QUALITY_GATE: QualityGateConfig = {
  minCoverage: 0.6,
  maxCornerDeltaPx: 8,
  minSharpness: 70,
  maxGlareRatio: 0.12,
  requiredFrames: 3,
};

export interface ScanFrameMetrics {
  timestamp: number;
  coverage: number;
  maxCornerDeltaPx: number;
  laplacianVariance: number;
  glareRatio: number;
  stableFrames: number;
  verdict: FrameVerdict;
}
