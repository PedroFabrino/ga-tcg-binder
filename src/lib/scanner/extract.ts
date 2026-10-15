import type { CaptureSource, NormalizedCardPayload } from "./contracts";
import { dHash } from "./phash";
import { canvasToGray } from "./roi";
import { logScanner } from "./debug-client";

/**
 * Stage 4: from the flattened 630x880 card, compute Branch A (dHash) instantly.
 * Visual perceptual hashing completes in ~2ms on any mobile device without blocking
 * the main thread or downloading heavy external binaries.
 */
export async function extractFeatures(
  canvas: HTMLCanvasElement,
  blob: Blob,
  source: CaptureSource
): Promise<NormalizedCardPayload> {
  const start = Date.now();
  logScanner("extract_start", "Starting card feature extraction", { source });

  const { gray, width, height } = canvasToGray(canvas);
  const phash = dHash(gray, width, height);
  logScanner("extract_phash", `Computed visual dHash: ${phash}`, { phash });

  logScanner("extract_done", `Features extracted in ${Date.now() - start}ms`, { phash });

  return {
    image: blob,
    source,
    phash,
    ocr: {
      headerText: "",
      footerText: "",
      collectorNumber: undefined,
      setCode: undefined,
      ocrOk: false,
    },
    capturedAt: Date.now(),
  };
}
