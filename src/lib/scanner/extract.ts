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

/**
 * Stage 4: from the flattened 630x880 card, run Branch A (dHash) and Branch B (header/footer OCR)
 * in parallel and assemble the payload sent to the identify endpoint.
 */
export async function extractFeatures(
  canvas: HTMLCanvasElement,
  blob: Blob,
  source: CaptureSource
): Promise<NormalizedCardPayload> {
  const hashPromise = Promise.resolve().then(() => {
    const { gray, width, height } = canvasToGray(canvas);
    return dHash(gray, width, height);
  });

  const ocrPromise = (async () => {
    const [cv, worker] = await Promise.all([loadOpenCv(), getOcrWorker()]);
    const header = preprocessForOcr(cv, cropCanvas(canvas, cropRects.header));
    const footer = preprocessForOcr(cv, cropCanvas(canvas, cropRects.footer));
    const headerText = await ocr(worker, header);
    const footerText = await ocr(worker, footer);
    return { headerText, footerText };
  })().catch(() => ({ headerText: "", footerText: "" }));

  const [phash, { headerText, footerText }] = await Promise.all([hashPromise, ocrPromise]);
  const parsed = parseFooter(footerText);
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
