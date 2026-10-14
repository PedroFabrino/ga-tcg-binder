export interface Point {
  x: number;
  y: number;
}

/** Ordered corners: [topLeft, topRight, bottomRight, bottomLeft]. */
export type Quad = [Point, Point, Point, Point];

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const CARD_W = 630;
export const CARD_H = 880;
export const CARD_ASPECT = 2.5 / 3.5;

export type FrameVerdict = "ready" | "hold" | "glare" | "blurry" | "unstable" | "no_card";

export interface QualityGateConfig {
  minCoverage: number;
  maxCornerDeltaPx: number;
  minSharpness: number;
  maxGlareRatio: number;
  glareLuminance: number;
  requiredFrames: number;
}

export const DEFAULT_QUALITY_GATE: QualityGateConfig = {
  minCoverage: 0.6,
  maxCornerDeltaPx: 8,
  minSharpness: 70,
  maxGlareRatio: 0.12,
  glareLuminance: 250,
  requiredFrames: 3,
};

export interface ScanFrameMetrics {
  timestamp: number;
  quad: Quad | null;
  /** Quad area / guide area, 0..1+. */
  coverage: number;
  /** Largest corner movement vs previous frame (Infinity when no previous quad). */
  maxCornerDeltaPx: number;
  laplacianVariance: number;
  /** Fraction of card pixels with luminance above the glare threshold. */
  glareRatio: number;
  /** Consecutive frames that passed coverage, stability and sharpness. */
  stableFrames: number;
  verdict: FrameVerdict;
  hint?: string;
}

export type CaptureSource = "auto" | "manual_quad" | "manual_guide_crop";

export type CardVariant = "normal" | "foil";

export interface NormalizedCardPayload {
  /** 630x880 WebP, quality 0.85. */
  image: Blob;
  source: CaptureSource;
  /** 64-bit perceptual hash as 16 hex chars. */
  phash: string;
  ocr: {
    headerText: string;
    footerText: string;
    collectorNumber?: string;
    setCode?: string;
    ocrOk: boolean;
  };
  capturedAt: number;
}

export interface CardMatchResult {
  editionId: string;
  cardSlug: string;
  cardName: string;
  setPrefix: string;
  collectorNumber: string;
  imageUrl: string;
  /** Composite certainty 0..100. */
  confidence: number;
  sVisual: number;
  sOcr: number | null;
  signals: { collectorMatch: boolean; ocrFallback: boolean };
}
