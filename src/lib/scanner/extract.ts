import type { CaptureSource, NormalizedCardPayload } from "./contracts";
import { loadOpenCv } from "./detector";
import { parseFooter, isOcrNoise } from "./ocr-parse";
import { dHash } from "./phash";
import { canvasToGray, cropCanvas, cropRects, preprocessForOcr } from "./roi";

/* eslint-disable @typescript-eslint/no-explicit-any */
let workerPromise: Promise<any> | null = null;

function getOcrWorker() {
  workerPromise ??= import("tesseract.js").then(({ createWorker }) => createWorker("eng"));
  return workerPromise;
}

async function ocr(worker: any, strip: HTMLCanvasElement): Promise<string> {
  const { data } = await worker.recognize(strip);
  return (data.text as string).trim();
}

import { logScanner } from "./debug-client";

/**
 * Stage 4: from the flattened 630x880 card, compute Branch A (dHash) instantly
 * and attempt Branch B (OCR) with a strict 2-second timeout to avoid mobile freeze.
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

  // OCR is optional enhancement: cap at 2.0s so mobile devices never hang on Tesseract/OpenCV download
  const ocrPromise = (async () => {
    try {
      const [cv, worker] = await Promise.all([loadOpenCv(), getOcrWorker()]);
      const header = preprocessForOcr(cv, cropCanvas(canvas, cropRects.header));
      const footer = preprocessForOcr(cv, cropCanvas(canvas, cropRects.footer));
      const [headerText, footerText] = await Promise.all([ocr(worker, header), ocr(worker, footer)]);
      return { headerText, footerText };
    } catch (err: any) {
      logScanner("extract_ocr_warn", `OCR attempt failed or skipped: ${err.message}`, {}, "warn");
      return { headerText: "", footerText: "" };
    }
  })();

  const timeoutPromise = new Promise<{ headerText: string; footerText: string }>((resolve) =>
    setTimeout(() => {
      logScanner("extract_ocr_timeout", "OCR timed out after 2s; proceeding with visual dHash");
      resolve({ headerText: "", footerText: "" });
    }, 2000)
  );

  const { headerText, footerText } = await Promise.race([ocrPromise, timeoutPromise]);
  const parsed = parseFooter(footerText);

  logScanner("extract_done", `Features extracted in ${Date.now() - start}ms`, {
    phash,
    hasOcr: Boolean(headerText || footerText),
    headerText,
    footerText,
  });

  return {
    image: blob,
    source,
    phash,
    ocr: {
      headerText,
      footerText,
      collectorNumber: parsed.fraction ?? parsed.collectorNumber,
      setCode: parsed.setCode,
      ocrOk: !isOcrNoise(headerText),
    },
    capturedAt: Date.now(),
  };
}
