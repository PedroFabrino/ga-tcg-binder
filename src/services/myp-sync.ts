import {
  getMarketCards,
  reconcileStoreListings,
  updateStoreCount,
  updateStoreFullScanAt,
  upsertMarketCards,
  type InsertMarketCard,
  type MarketplaceDatabase,
} from "../db/repositories/marketplace-repository";
import {
  fetchMypText,
  loadCatalogResolutionData,
  parseBrlPrice,
  parseMypHtml,
  resolveMypItem,
  type ParsedMypItem,
} from "./marketplace";

export interface GlobalMarketplaceSyncResult {
  totalSynced: number;
  matchedCount: number;
  unmatchedCount: number;
  totalCount: number;
  complete: boolean;
}

const MYP_PAGE_1_URL =
  "https://mypcards.com/grandarchive?ProdutoSearch%5BexibirSomenteVenda%5D=1";

// Safety ceiling on the number of pages fetched per scan. A catalog larger than
// this is treated as an incomplete scan so reconciliation never zeroes listings
// on pages we did not fetch.
const MAX_SAFE_PAGES = 75;

function buildMypLoadMoreUrl(page: number): string {
  return `https://mypcards.com/produto/load-more?marca=grandarchive&ProdutoSearch%5BexibirSomenteVenda%5D=1&page=${page}`;
}

/**
 * Scans the full MyP in-stock Grand Archive catalog and upserts each listing
 * using the same per-listing lifecycle as the other marketplace stores.
 */
export async function syncGlobalMarketplace(
  targetDatabase: MarketplaceDatabase,
  customFetch?: typeof fetch
): Promise<GlobalMarketplaceSyncResult> {
  // 1. Fetch Page 1 of Grand Archive in-stock catalog
  const p1Html = await fetchMypText(MYP_PAGE_1_URL, customFetch);
  const parsedItems: ParsedMypItem[] = [...parseMypHtml(p1Html)];

  // Determine total item count to calculate required pages
  let observedTotal: number | null = null;
  const countMatch =
    p1Html.match(/class=["']summary["'][^>]*><strong>(\d+)<\/strong>\s*itens/i) ||
    p1Html.match(/ProdutoScrollInfinito\([^,]+,[^,]+,\s*(\d+)\s*,\s*30\)/i);
  if (countMatch) {
    observedTotal = parseInt(countMatch[1], 10) || 0;
  }
  const totalItems = observedTotal ?? parsedItems.length;
  const neededPages = totalItems > 0 ? Math.ceil(totalItems / 30) : 1;
  const truncated = neededPages > MAX_SAFE_PAGES;
  const maxPages = Math.min(neededPages, MAX_SAFE_PAGES);

  // 2. Fetch subsequent pages in concurrent batches of 4
  const batchSize = 4;
  let failedPageCount = 0;
  for (let p = 2; p <= maxPages; p += batchSize) {
    const pageNumbers: number[] = [];
    for (let i = 0; i < batchSize && p + i <= maxPages; i++) {
      pageNumbers.push(p + i);
    }

    const batchResults = await Promise.all(
      pageNumbers.map(async (page) => {
        try {
          const moreText = await fetchMypText(
            buildMypLoadMoreUrl(page),
            customFetch
          );
          let htmlChunk = moreText;
          try {
            const json = JSON.parse(moreText);
            if (json && json.success && json.html) {
              htmlChunk = json.html;
            }
          } catch {
            // Not JSON; parse raw text
          }
          return { items: parseMypHtml(htmlChunk), failed: false };
        } catch {
          return { items: [] as ParsedMypItem[], failed: true };
        }
      })
    );

    for (const result of batchResults) {
      parsedItems.push(...result.items);
      if (result.failed) {
        failedPageCount += 1;
      }
    }

    // Polite delay between batches when fetching live network
    if (!customFetch && p + batchSize <= maxPages) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  if (parsedItems.length === 0) {
    return {
      totalSynced: 0,
      matchedCount: 0,
      unmatchedCount: 0,
      totalCount: totalItems,
      complete: false,
    };
  }

  // 3. Resolve parsed items against local Catalog
  const catalog = await loadCatalogResolutionData(targetDatabase);

  let matchedCount = 0;
  let unmatchedCount = 0;

  // Preserve previously cached TCGPlayer prices and vendor details across upserts.
  const existingTcgMap = new Map<string, { tcgPrice: string; tcgPriceNumeric: number }>();
  const existingVendorMap = new Map<string, { vendorName: string; vendorUrl: string | null }>();
  try {
    const existingRows = await getMarketCards({ storeId: "myp" }, targetDatabase);

    for (const r of existingRows) {
      if (r.tcgPriceNumeric !== null && r.tcgPriceNumeric !== undefined && r.tcgPrice) {
        if (r.productUrl) {
          existingTcgMap.set(r.productUrl, {
            tcgPrice: r.tcgPrice,
            tcgPriceNumeric: Number(r.tcgPriceNumeric),
          });
        }
        if (r.itemId) {
          existingTcgMap.set(r.itemId, {
            tcgPrice: r.tcgPrice,
            tcgPriceNumeric: Number(r.tcgPriceNumeric),
          });
        }
      }
      if (r.vendorName) {
        if (r.productUrl) {
          existingVendorMap.set(r.productUrl, {
            vendorName: r.vendorName,
            vendorUrl: r.vendorUrl || null,
          });
        }
        if (r.itemId) {
          existingVendorMap.set(r.itemId, {
            vendorName: r.vendorName,
            vendorUrl: r.vendorUrl || null,
          });
        }
      }
    }
  } catch {
    // If table didn't have tcg/vendor columns yet, safe ignore
  }

  const rowsToInsert: InsertMarketCard[] = [];
  const observedItemIds: string[] = [];

  for (const item of parsedItems) {
    const { matchedCard, editionId } = resolveMypItem(item, catalog);
    if (matchedCard) {
      matchedCount++;
    } else {
      unmatchedCount++;
    }

    const cachedTcg =
      (item.mypProductUrl && existingTcgMap.get(item.mypProductUrl)) ||
      (item.mypItemId && existingTcgMap.get(item.mypItemId)) ||
      null;

    const cachedVendor =
      (item.mypProductUrl && existingVendorMap.get(item.mypProductUrl)) ||
      (item.mypItemId && existingVendorMap.get(item.mypItemId)) ||
      null;

    // Every listing needs a stable key so upserts and reconciliation can track
    // it across scans even when MyP omits the item identifier.
    const stableItemId =
      item.mypItemId ||
      item.mypProductUrl ||
      `${item.rawName}|${item.setPrefix}|${item.quality}|${item.isFoil}`;

    observedItemIds.push(stableItemId);

    rowsToInsert.push({
      id: item.mypItemId ? `mkt-${item.mypItemId}` : `mkt-myp-${stableItemId}`,
      storeId: "myp",
      cardSlug: matchedCard?.slug || null,
      editionId,
      rawName: item.rawName,
      cardName: matchedCard?.name || item.cleanName,
      setPrefix: item.setPrefix,
      quantity: item.quantity,
      price: item.price,
      priceNumeric: parseBrlPrice(item.price),
      tcgPrice: cachedTcg?.tcgPrice || null,
      tcgPriceNumeric: cachedTcg?.tcgPriceNumeric || null,
      vendorName: item.vendorName || cachedVendor?.vendorName || null,
      vendorUrl: item.vendorUrl || cachedVendor?.vendorUrl || null,
      quality: item.quality || "NM",
      isFoil: item.isFoil,
      itemId: stableItemId,
      productUrl: item.mypProductUrl,
    });
  }

  await upsertMarketCards(rowsToInsert, targetDatabase);

  const complete = failedPageCount === 0 && observedTotal !== null && !truncated;

  if (complete) {
    await reconcileStoreListings("myp", observedItemIds, targetDatabase);

    const scanTime = new Date();
    if (observedTotal !== null) {
      await updateStoreCount("myp", observedTotal, scanTime, targetDatabase);
    }
    await updateStoreFullScanAt("myp", scanTime, targetDatabase);
  }

  return {
    totalSynced: rowsToInsert.length,
    matchedCount,
    unmatchedCount,
    totalCount: totalItems,
    complete,
  };
}
