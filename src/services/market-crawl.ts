/**
 * Market Crawl: shared low-level primitives used by every marketplace platform
 * (MyP, LigaStore, Lootcards) during Full Rescan and Count Poll.
 *
 * Per-platform pagination and page-shape parsing stay in each platform parser;
 * these primitives — fetch, BRL price parsing, HTML entity decoding — live once
 * here so a bug is fixed for every store simultaneously.
 */

export { fetchMarketHtml as fetchHtml } from "./market-fetch";

/** Parses a Brazilian "R$ 12,50" / "12.50" / "12,50" price into a number. */
export function parseBrlPrice(priceStr: string): number {
  if (!priceStr) return 0;
  const cleaned = priceStr
    .replace(/[^0-9,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const value = parseFloat(cleaned);
  return Number.isFinite(value) ? value : 0;
}

/** Decodes common HTML entities (named and numeric) found in scraped markup. */
export function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/\u00a0/g, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#x([a-f\d]+);/gi, (_, code) =>
      String.fromCharCode(Number.parseInt(code, 16))
    )
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}
