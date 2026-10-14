function trigrams(s: string): Set<string> {
  const norm = s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const out = new Set<string>();
  if (!norm) return out;
  const padded = `  ${norm} `;
  for (let i = 0; i + 3 <= padded.length; i++) out.add(padded.slice(i, i + 3));
  return out;
}

/** Jaccard similarity over padded character trigrams (pg_trgm style), 0..1. */
export function trigramSimilarity(a: string, b: string): number {
  const A = trigrams(a);
  const B = trigrams(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  A.forEach((g) => B.has(g) && inter++);
  return inter / (A.size + B.size - inter);
}

export interface CompositeInput {
  sVisual: number;
  sOcr: number | null;
  ocrOk: boolean;
  collectorMatch: boolean;
}

export interface CompositeResult {
  confidence: number;
  ocrFallback: boolean;
}

const VISUAL_ONLY_CAP = 92;
const BOOSTED_CAP = 99;

/** Composite certainty in percent: 0.6*visual + 0.4*ocr, +10 on collector match; visual-only capped at 92. */
export function compositeConfidence(i: CompositeInput): CompositeResult {
  if (!i.ocrOk || i.sOcr === null) {
    return { confidence: Math.min(VISUAL_ONLY_CAP, i.sVisual * 100), ocrFallback: true };
  }
  const base = 100 * (0.6 * i.sVisual + 0.4 * i.sOcr);
  const confidence = i.collectorMatch ? Math.min(BOOSTED_CAP, base + 10) : Math.min(100, base);
  return { confidence, ocrFallback: false };
}
