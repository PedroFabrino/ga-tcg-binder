/**
 * Platform adapters for the Market Crawl engine.
 *
 * MyP and Lootcards both read the same underlying Grand Archive Cards and
 * Printings, so their parsers map to the same normalized `CrawledListing`.
 * LigaStore is retired (ADR-0025) and has no adapter here.
 */

import type { CrawlAdapter, CrawledListing } from "./market-crawl";
import { parseMypHtml, type ParsedMypItem } from "./marketplace";
import { parseMypLatestCardRefId, parseMypTotalCount } from "./market-check";
import {
  formatBrlPrice,
  parseLootcardsCatalogResponse,
  parseLootcardsLatestCardRefId,
  parseLootcardsTotalCount,
  type ParsedLootcardsCard,
} from "./lootcards-parser";
import { parseBrlPrice } from "./market-crawl";

/** MyP item ids look like `grandarchive_doa_001`; the last segment is the number. */
function collectorNumberFromMyPItemId(itemId: string | null | undefined): string {
  const match = (itemId ?? "").match(/^grandarchive_[a-z0-9]+_(\d+)/i);
  return match ? match[1] : "";
}

export function mypItemToCrawledListing(item: ParsedMypItem): CrawledListing {
  const itemId = item.mypItemId ?? item.itemId ?? null;
  return {
    itemId: itemId ?? "",
    rawName: item.rawName,
    cardName: item.cleanName,
    setPrefix: item.setPrefix,
    collectorNumber: collectorNumberFromMyPItemId(itemId),
    price: item.price,
    priceBrl: parseBrlPrice(item.price),
    quantity: item.quantity,
    isFoil: item.isFoil,
    productUrl: item.mypProductUrl,
  };
}

export function lootcardsCardToCrawledListing(
  card: ParsedLootcardsCard,
  baseUrl: string
): CrawledListing {
  const root = baseUrl.replace(/\/+$/, "");
  return {
    itemId: card.uuid,
    rawName: card.name,
    cardName: card.name,
    setPrefix: card.setPrefix,
    collectorNumber: card.collectorNumber,
    price: formatBrlPrice(card.minPriceCents),
    priceBrl: card.minPriceCents / 100,
    quantity: card.totalStock,
    isFoil: card.hasFoil,
    productUrl: `${root}/carta/${encodeURIComponent(card.slug)}`,
    editionUuid: card.editionUuid,
  };
}

export const mypCrawlAdapter: CrawlAdapter = {
  platform: "myp",
  parsePage: (html) => parseMypHtml(html).map(mypItemToCrawledListing),
  parseTotalCount: (html) => parseMypTotalCount(html) ?? 0,
  parseLatestCardRefId: (html) => parseMypLatestCardRefId(html),
  pageDelayMs: 1200,
  retryDelayMs: 12000,
};

export const lootcardsCrawlAdapter: CrawlAdapter = {
  platform: "lootcards",
  parsePage: (json) =>
    parseLootcardsCatalogResponse(json).cards.map((card) =>
      lootcardsCardToCrawledListing(card, "https://lootcards.store")
    ),
  parseTotalCount: (json) => parseLootcardsTotalCount(json) ?? 0,
  parseLatestCardRefId: (json) => parseLootcardsLatestCardRefId(json),
  pageDelayMs: 150,
  retryDelayMs: 1000,
};
