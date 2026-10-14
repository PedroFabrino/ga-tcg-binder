import { describe, it, expect } from "vitest";
import { dHash, hamming, visualSimilarity } from "./phash";
import { parseFooter, isOcrNoise } from "./ocr-parse";
import { trigramSimilarity, compositeConfidence } from "./scoring";
import { cropRects } from "./roi";

describe("phash", () => {
  const gradient = (w: number, h: number, flip = false) =>
    new Uint8Array(w * h).map((_, i) => {
      const x = i % w;
      return flip ? 255 - (x * 255) / (w - 1) : (x * 255) / (w - 1);
    });

  it("is a 16-char hex string and stable under resize", () => {
    const a = dHash(gradient(90, 80), 90, 80);
    const b = dHash(gradient(630, 880), 630, 880);
    expect(a).toMatch(/^[0-9a-f]{16}$/);
    expect(hamming(a, b)).toBeLessThanOrEqual(2);
  });

  it("differs for opposite gradients", () => {
    const a = dHash(gradient(90, 80), 90, 80);
    const b = dHash(gradient(90, 80, true), 90, 80);
    expect(hamming(a, b)).toBeGreaterThan(40);
  });

  it("computes similarity as 1 - hamming/64", () => {
    expect(visualSimilarity("0000000000000000", "0000000000000000")).toBe(1);
    expect(visualSimilarity("0000000000000000", "ffffffffffffffff")).toBe(0);
    expect(visualSimilarity("0000000000000000", "000000000000000f")).toBeCloseTo(1 - 4 / 64);
  });
});

describe("parseFooter", () => {
  it("parses set code and collector number with language marker", () => {
    expect(parseFooter("RDO » EN-250 C")).toMatchObject({ setCode: "RDO", collectorNumber: "250" });
  });
  it("parses plain prefix + number", () => {
    expect(parseFooter("DOA 001")).toMatchObject({ setCode: "DOA", collectorNumber: "001" });
  });
  it("parses XXX/YYY fractions", () => {
    expect(parseFooter("042/180")).toMatchObject({ collectorNumber: "042", fraction: "042/180" });
  });
  it("returns empty for noise", () => {
    expect(parseFooter("~~ ..")).toEqual({});
  });
  it("detects noisy headers", () => {
    expect(isOcrNoise("")).toBe(true);
    expect(isOcrNoise("#$ 1 |")).toBe(true);
    expect(isOcrNoise("Lorraine, Blademaster")).toBe(false);
  });
});

describe("scoring", () => {
  it("trigram similarity: identical 1, unrelated low, close high", () => {
    expect(trigramSimilarity("Lorraine", "lorraine")).toBe(1);
    expect(trigramSimilarity("Lorraine", "Zzzzzzzz")).toBeLessThan(0.1);
    expect(trigramSimilarity("Lorraine Blademaster", "Lorrane Blademaster")).toBeGreaterThan(0.7);
  });

  it("weights visual 60 / ocr 40", () => {
    const r = compositeConfidence({ sVisual: 0.9, sOcr: 0.5, ocrOk: true, collectorMatch: false });
    expect(r.confidence).toBeCloseTo(74);
    expect(r.ocrFallback).toBe(false);
  });

  it("boosts +10 on collector match, capped at 99", () => {
    expect(compositeConfidence({ sVisual: 0.9, sOcr: 0.5, ocrOk: true, collectorMatch: true }).confidence).toBeCloseTo(84);
    expect(compositeConfidence({ sVisual: 1, sOcr: 1, ocrOk: true, collectorMatch: true }).confidence).toBe(99);
  });

  it("falls back to visual capped at 92 when OCR failed", () => {
    const r = compositeConfidence({ sVisual: 0.99, sOcr: null, ocrOk: false, collectorMatch: false });
    expect(r.confidence).toBe(92);
    expect(r.ocrFallback).toBe(true);
  });
});

describe("roi", () => {
  it("defines header/footer rects on the 630x880 card", () => {
    expect(cropRects.header).toEqual({ x: 30, y: 0, width: 570, height: 132 });
    expect(cropRects.footer).toEqual({ x: 0, y: 748, width: 630, height: 132 });
  });
});
