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
  const orientedBuffer = await sharp(imageBuffer).rotate().toBuffer();
  const meta = await sharp(orientedBuffer).metadata();
  const imgW = meta.width || 1080;
  const imgH = meta.height || 1920;

  // Extract centered 2.5 : 3.5 target guide area
  // GA TCG card aspect ratio: 2.5 / 3.5 (~0.714)
  const cardRatio = 2.5 / 3.5;

  let guideW = Math.round(imgW * 0.72);
  let guideH = Math.round(guideW / cardRatio);

  if (guideH > Math.round(imgH * 0.85)) {
    guideH = Math.round(imgH * 0.85);
    guideW = Math.round(guideH * cardRatio);
  }

  guideW = Math.min(guideW, imgW);
  guideH = Math.min(guideH, imgH);

  const left = Math.max(0, Math.min(Math.floor((imgW - guideW) / 2), imgW - guideW));
  const top = Math.max(0, Math.min(Math.floor((imgH - guideH) / 2), imgH - guideH));

  // Normalize cropped card to canonical 630x880
  const cardPipeline = sharp(orientedBuffer)
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

  // Reject completely dark frames (phone face down / blocked camera)
  if (meanBrightness < 12) {
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
