/**
 * Scanner contracts re-exported from canonical @ga/contracts workspace package,
 * plus web-specific Blob payload definitions.
 */

export * from "@ga/contracts";
import type { CaptureSource } from "@ga/contracts";

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
