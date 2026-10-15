import sharp from "sharp";
import { createWorker } from "tesseract.js";
import { dHash } from "../lib/scanner/phash";
import { parseFooter } from "../lib/scanner/ocr-parse";
import { identifyCard, identifyCardWithDebug } from "./scanner-match";
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
  topCandidates: CardMatchResult[];
  phash: string;
  headerText: string;
  footerText: string;
  glareRatio: number;
  cardImageBase64?: string;
  headerImageBase64?: string;
  footerImageBase64?: string;
}

/**
 * Stage 4-5 High-Performance Frame Processor (ADR 0006).
 * Crops to 2.5:3.5 target guide, normalizes to 630x880, extracts 64-bit dHash,
 * performs strip OCR on header and footer, and runs Turso composite matching.
 */
export async function processCardFrame(
  imageBuffer: Buffer,
  database: any,
  cropRect?: { x: number; y: number; width: number; height: number }
): Promise<FrameProcessingResult> {
  let orientedBuffer = await sharp(imageBuffer).rotate().toBuffer();
  let meta = await sharp(orientedBuffer).metadata();

  // If phone back sensor delivered unrotated landscape JPEG, rotate 90 deg to portrait
  if (meta.width && meta.height && meta.width > meta.height) {
    orientedBuffer = await sharp(orientedBuffer).rotate(90).toBuffer();
    meta = await sharp(orientedBuffer).metadata();
  }

  const imgW = meta.width || 1080;
  const imgH = meta.height || 1920;

  // Extract centered 2.5 : 3.5 target guide area
  // GA TCG card aspect ratio: 2.5 / 3.5 (~0.714)
  const cardRatio = 2.5 / 3.5;

  let left: number;
  let top: number;
  let guideW: number;
  let guideH: number;

  if (cropRect && cropRect.width > 0 && cropRect.height > 0) {
    left = Math.max(0, Math.floor(cropRect.x * imgW));
    top = Math.max(0, Math.floor(cropRect.y * imgH));
    guideW = Math.min(imgW - left, Math.round(cropRect.width * imgW));
    guideH = Math.min(imgH - top, Math.round(cropRect.height * imgH));
  } else {
    // Default fallback: centered 2.5 : 3.5 target guide (scaled to 50% of screen height)
    guideH = Math.round(imgH * 0.50);
    guideW = Math.round(guideH * cardRatio);
    if (guideW > Math.round(imgW * 0.75)) {
      guideW = Math.round(imgW * 0.75);
      guideH = Math.round(guideW / cardRatio);
    }
    guideW = Math.min(guideW, imgW);
    guideH = Math.min(guideH, imgH);
    left = Math.max(0, Math.floor((imgW - guideW) / 2));
    top = Math.max(0, Math.floor((imgH - guideH) / 2));
  }

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
      topCandidates: [],
      phash: "",
      headerText: "",
      footerText: "",
      glareRatio,
    };
  }

  const phash = dHash(grayData, grayInfo.width, grayInfo.height);

  // 2. Crop header strip (title area) and footer strip (collector info) with 2x resolution and contrast enhancement
  let headerText = "";
  let footerText = "";
  let cardImageBase64: string | undefined;
  let headerImageBase64: string | undefined;
  let footerImageBase64: string | undefined;

  try {
    const worker = await getWorker();

    const [cardJpegBuf, headerBuf, footerBuf] = await Promise.all([
      cardPipeline.clone().jpeg({ quality: 75 }).toBuffer(),
      cardPipeline
        .clone()
        .extract({ left: 50, top: 12, width: 520, height: 75 })
        .resize(1040, 150)
        .grayscale()
        .normalize()
        .sharpen()
        .png()
        .toBuffer(),
      cardPipeline
        .clone()
        .extract({ left: 10, top: 815, width: 600, height: 55 })
        .resize(1200, 110)
        .grayscale()
        .normalize()
        .sharpen()
        .png()
        .toBuffer(),
    ]);

    cardImageBase64 = `data:image/jpeg;base64,${cardJpegBuf.toString("base64")}`;
    headerImageBase64 = `data:image/png;base64,${headerBuf.toString("base64")}`;
    footerImageBase64 = `data:image/png;base64,${footerBuf.toString("base64")}`;

    // Save debug crops for live static inspection at /debug/last-card.jpg, etc.
    const fs = await import("fs");
    const path = await import("path");
    const publicDebugDir = path.resolve(process.cwd(), "public/debug");
    const scratchDir = path.resolve(process.cwd(), "scratch");

    if (!fs.existsSync(publicDebugDir)) fs.mkdirSync(publicDebugDir, { recursive: true });
    if (!fs.existsSync(scratchDir)) fs.mkdirSync(scratchDir, { recursive: true });

    await Promise.all([
      fs.promises.writeFile(path.join(publicDebugDir, "last-card.jpg"), cardJpegBuf).catch(() => {}),
      fs.promises.writeFile(path.join(publicDebugDir, "last-header.png"), headerBuf).catch(() => {}),
      fs.promises.writeFile(path.join(publicDebugDir, "last-footer.png"), footerBuf).catch(() => {}),
      fs.promises.writeFile(path.join(scratchDir, "debug-card.jpg"), cardJpegBuf).catch(() => {}),
      fs.promises.writeFile(path.join(scratchDir, "debug-header.png"), headerBuf).catch(() => {}),
      fs.promises.writeFile(path.join(scratchDir, "debug-footer.png"), footerBuf).catch(() => {}),
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
  const { candidates, topCandidates } = await identifyCardWithDebug(
    {
      phash,
      headerText,
      footerText,
    },
    database
  );

  return {
    candidates,
    topCandidates,
    phash,
    headerText,
    footerText,
    glareRatio,
    cardImageBase64,
    headerImageBase64,
    footerImageBase64,
  };
}
