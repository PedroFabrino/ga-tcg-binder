import sharp from "sharp";
import { createWorker } from "tesseract.js";
import { dHash } from "../lib/scanner/phash";
import { parseFooter } from "../lib/scanner/ocr-parse";
import { identifyCard } from "./scanner-match";
import type { CardMatchResult, ScanFrameMetrics } from "@ga/contracts";

let ocrWorker: any = null;

async function getWorker() {
  if (!ocrWorker) {
    ocrWorker = await createWorker("eng");
  }
  return ocrWorker;
}

export interface FrameProcessingResult {
  candidates: CardMatchResult[];
  phash: string;
  headerText: string;
  footerText: string;
  glareRatio: number;
}

/**
 * Stage 4-5 High-Performance Frame Processor (ADR 0006).
 * Crops to 2.5:3.5 target guide, normalizes to 630x880, extracts 64-bit dHash,
 * performs strip OCR on header and footer, and runs Turso composite matching.
 */
export async function processCardFrame(
  imageBuffer: Buffer,
  database: any
): Promise<FrameProcessingResult> {
  const oriented = sharp(imageBuffer).rotate();
  const meta = await oriented.metadata();
  const imgW = meta.width || 1080;
  const imgH = meta.height || 1920;

  // Extract centered 2.5 : 3.5 target guide area
  const guideW = Math.min(imgW, Math.round(imgW * 0.75));
  const guideH = Math.min(imgH, Math.round(guideW / (2.5 / 3.5)));
  const left = Math.max(0, Math.round((imgW - guideW) / 2));
  const top = Math.max(0, Math.round((imgH - guideH) / 2));

  // Normalize cropped card to canonical 630x880
  const cardPipeline = oriented
    .clone()
    .extract({ left, top, width: guideW, height: guideH })
    .resize(630, 880, { fit: "fill" });

  // 1. Grayscale buffer for dHash and glare analysis
  const { data: grayData, info: grayInfo } = await cardPipeline
    .clone()
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let sum = 0;
  let glareCount = 0;
  for (let i = 0; i < grayData.length; i++) {
    const val = grayData[i];
    sum += val;
    if (val > 250) glareCount++;
  }
  const meanBrightness = sum / grayData.length;
  const glareRatio = glareCount / grayData.length;

  let sumSq = 0;
  for (let i = 0; i < grayData.length; i++) {
    const diff = grayData[i] - meanBrightness;
    sumSq += diff * diff;
  }
  const variance = sumSq / grayData.length;

  // Reject completely dark frames (phone face down) or flat uniform surfaces (no contrast/card)
  if (meanBrightness < 25 || variance < 80) {
    return {
      candidates: [],
      phash: "",
      headerText: "",
      footerText: "",
      glareRatio,
    };
  }

  const phash = dHash(grayData, grayInfo.width, grayInfo.height);

  // 2. Crop header strip (top 15% title area) and footer strip (bottom 15% collector info)
  let headerText = "";
  let footerText = "";

  try {
    const worker = await getWorker();

    const [headerBuf, footerBuf] = await Promise.all([
      cardPipeline
        .clone()
        .extract({ left: 30, top: 20, width: 570, height: 100 })
        .grayscale()
        .normalize()
        .png()
        .toBuffer(),
      cardPipeline
        .clone()
        .extract({ left: 20, top: 770, width: 590, height: 95 })
        .grayscale()
        .normalize()
        .png()
        .toBuffer(),
    ]);

    const [hRes, fRes] = await Promise.all([
      worker.recognize(headerBuf),
      worker.recognize(footerBuf),
    ]);

    headerText = hRes.data.text.trim();
    footerText = fRes.data.text.trim();
  } catch (err) {
    console.warn("[frame-processor] OCR error fallback:", err);
  }

  // 3. Match against Turso database catalog
  const candidates = await identifyCard(
    {
      phash,
      headerText,
      footerText,
    },
    database
  );

  return {
    candidates,
    phash,
    headerText,
    footerText,
    glareRatio,
  };
}
