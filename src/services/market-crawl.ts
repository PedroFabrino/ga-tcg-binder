/**
 * Market Crawl engine.
 *
 * One fetch + rescan + fail-detection seam for every Marketplace Platform. Two
 * platform adapters (MyP, Lootcards) parse their pages into the same normalized
 * `CrawledListing` object, because both ultimately read Grand Archive Cards and
 * Printings. LigaStore is retired (ADR-0025) and no longer crawled.
 */

import { fetchMarketHtml } from "./market-fetch";
import type { MarketplacePlatform } from "../lib/market-vocabulary";

export const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/** Detects a Cloudflare interstitial rather than real listing HTML. */
export function isCloudflareChallenge(text: string): boolean {
  if (!text) return false;
  return (
    text.includes("<title>Just a moment...</title>") ||
    text.includes("challenges.cloudflare.com") ||
    text.includes('id="challenge-running"') ||
    text.includes("cf-mitigated") ||
    text.includes("Enable JavaScript and cookies to continue")
  );
}

/** Parses a Brazilian "R$ 12,50" / "12,50" price (comma decimal) into a number. */
export function parseBrlPrice(priceStr: string): number {
  if (!priceStr) return 0;
  const cleaned = priceStr
    .replace(/[^0-9,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const value = parseFloat(cleaned);
  return Number.isFinite(value) ? value : 0;
}

/**
 * Decodes common HTML entities found in scraped markup. `&amp;` is decoded last
 * so a doubly-encoded sequence like `&amp;apos;` yields `&apos;` rather than a
 * surprise apostrophe.
 */
export function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/\u00a0/g, " ")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#x([a-f\d]+);/gi, (_, code) =>
      String.fromCharCode(Number.parseInt(code, 16))
    )
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/gi, "&");
}

export interface FetchHtmlOptions {
  customFetch?: typeof fetch;
  /** Treat a Cloudflare challenge page as a hard failure. */
  cloudflareGuard?: boolean;
}

/** Fetches one marketplace page through the shared transport + optional guard. */
export async function fetchHtml(
  url: string,
  options: FetchHtmlOptions = {}
): Promise<string> {
  const text = await fetchMarketHtml(url, options.customFetch);
  if (options.cloudflareGuard && isCloudflareChallenge(text)) {
    throw new Error(`Blocked by Cloudflare challenge for ${url}`);
  }
  return text;
}

/**
 * The normalized Listing object every adapter produces. MyP additionally
 * carries the TCG Player benchmark in `tcgPriceUsd`; the Listing's own price is
 * always BRL in `priceBrl`.
 */
export interface CrawledListing {
  itemId: string;
  rawName: string;
  cardName: string;
  setPrefix: string;
  collectorNumber: string;
  price: string;
  priceBrl: number;
  quantity: number;
  isFoil: boolean;
  productUrl: string | null;
  editionUuid?: string | null;
  /** MyP-only: TCG Player USD reference price. */
  tcgPriceUsd?: number | null;
}

export interface CrawlAdapter {
  platform: MarketplacePlatform;
  /** Parse one results/document page into normalized listings. */
  parsePage(html: string): CrawledListing[];
  parseTotalCount(html: string): number;
  parseLatestCardRefId?(html: string): string | null;
  pageDelayMs: number;
  retryDelayMs: number;
}

export interface CrawlEngineOptions {
  cloudflareGuard?: boolean;
  failDetection?: boolean;
  rescanOnError?: boolean;
  maxPages?: number;
  maxPageRetries?: number;
}

/**
 * Rescans a single page with optional retry/backoff (rescan-on-error) and
 * fail-detection logging. Returns the parsed listings, or throws when a page
 * repeatedly fails and failDetection is on.
 */
export async function rescanPage(
  adapter: CrawlAdapter,
  url: string,
  fetchImpl: (url: string, opts: FetchHtmlOptions) => Promise<string>,
  attempt: number,
  options: CrawlEngineOptions = {}
): Promise<CrawledListing[]> {
  try {
    const html = await fetchImpl(url, { cloudflareGuard: options.cloudflareGuard });
    return adapter.parsePage(html);
  } catch (error) {
    if (options.rescanOnError && attempt > 1) {
      const delay = adapter.retryDelayMs * attempt;
      await new Promise((resolve) => setTimeout(resolve, delay));
      return rescanPage(adapter, url, fetchImpl, attempt - 1, options);
    }
    if (options.failDetection) {
      console.warn(
        `[market-crawl] ${adapter.platform} page failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
    throw error;
  }
}

/** Paces between pages according to the adapter, unless a custom fetch is used. */
export function pageDelay(adapter: CrawlAdapter, customFetch?: typeof fetch): number {
  return customFetch ? 0 : adapter.pageDelayMs;
}
