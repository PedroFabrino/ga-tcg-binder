export interface FooterParse {
  setCode?: string;
  collectorNumber?: string;
  fraction?: string;
}

const LANGUAGES = new Set(["EN", "FR", "DE", "JP", "KR", "CN", "TC"]);
const SEP = "[\\s\\-»\\.:·|~]*";

/** Extract set code and collector number from footer OCR text, e.g. "RDO » EN-250 C", "042/180". */
export function parseFooter(text: string): FooterParse {
  const t = text.toUpperCase();
  const out: FooterParse = {};

  const frac = t.match(/\b(\d{1,4})\s*\/\s*(\d{1,4})\b/);
  let numIndex = -1;
  if (frac) {
    out.collectorNumber = frac[1];
    out.fraction = `${frac[1]}/${frac[2]}`;
    numIndex = frac.index!;
  } else {
    const num = t.match(new RegExp(`(?:\\b(?:${Array.from(LANGUAGES).join("|")})${SEP})?\\b(\\d{3,4})\\b`));
    if (num) {
      out.collectorNumber = num[1];
      numIndex = num.index!;
    }
  }

  if (numIndex >= 0) {
    const before = t.slice(0, numIndex);
    const tokens = before.match(/[A-Z][A-Z0-9]{1,4}/g) ?? [];
    const setCode = [...tokens].reverse().find((tok) => !LANGUAGES.has(tok));
    if (setCode) out.setCode = setCode;
  }
  return out;
}

/** True when the header OCR produced too few Latin letters to be trusted as a card name. */
export function isOcrNoise(header: string): boolean {
  return (header.match(/[a-z]/gi) ?? []).length < 3;
}
