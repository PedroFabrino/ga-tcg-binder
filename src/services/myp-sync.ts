import * as fs from "fs";
import * as path from "path";
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
  isCloudflareChallenge,
  loadCatalogResolutionData,
  parseBrlPrice,
  parseMypHtml,
  resolveMypItem,
  type ParsedMypItem,
} from "./marketplace";

export interface MypSyncCheckpoint {
  page: number;
  observedTotal: number;
  parsedItems: ParsedMypItem[];
  savedAt: number;
}

export interface GlobalMarketplaceSyncOptions {
  customFetch?: typeof fetch;
  startPage?: number;
  pageDelayMs?: number;
  retryDelayMs?: number;
  maxPageRetries?: number;
  forceRestart?: boolean;
  checkpointFile?: string;
  persistToDisk?: boolean;
}

export interface GlobalMarketplaceSyncResult {
  totalSynced: number;
  matchedCount: number;
  unmatchedCount: number;
  totalCount: number;
  complete: boolean;
  resumedFromPage?: number;
  stoppedAtPage?: number;
}

const MYP_PAGE_1_URL =
  "https://mypcards.com/grandarchive?ProdutoSearch%5BexibirSomenteVenda%5D=1";

const MAX_SAFE_PAGES = 75;
const DEFAULT_CHECKPOINT_FILE = path.join(process.cwd(), ".scratch", "myp-sync-checkpoint.json");
const MAX_CHECKPOINT_AGE_MS = 12 * 60 * 60 * 1000;

let inMemoryCheckpoint: MypSyncCheckpoint | null = null;

export function loadMypSyncCheckpoint(options?: {
  checkpointFile?: string;
  allowDisk?: boolean;
}): MypSyncCheckpoint | null {
  if (inMemoryCheckpoint) {
    if (Date.now() - inMemoryCheckpoint.savedAt <= MAX_CHECKPOINT_AGE_MS) {
      return inMemoryCheckpoint;
    }
    inMemoryCheckpoint = null;
  }

  const allowDisk = options?.allowDisk ?? true;
  if (!allowDisk) {
    return null;
  }

  const file = options?.checkpointFile || DEFAULT_CHECKPOINT_FILE;
  try {
    if (fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, "utf-8"));
      if (
        data &&
        typeof data.page === "number" &&
        Array.isArray(data.parsedItems) &&
        typeof data.savedAt === "number" &&
        Date.now() - data.savedAt <= MAX_CHECKPOINT_AGE_MS
      ) {
        inMemoryCheckpoint = data;
        return data;
      }
    }
  } catch {
    // Ignore unreadable checkpoint file
  }

  return null;
}

export function saveMypSyncCheckpoint(
  checkpoint: MypSyncCheckpoint,
  options?: { checkpointFile?: string; persistToDisk?: boolean }
): void {
  inMemoryCheckpoint = checkpoint;
  const persistToDisk = options?.persistToDisk ?? true;
  if (!persistToDisk) {
    return;
  }

  const file = options?.checkpointFile || DEFAULT_CHECKPOINT_FILE;
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(checkpoint), "utf-8");
  } catch {
    // Best-effort persistence
  }
}

export function clearMypSyncCheckpoint(options?: { checkpointFile?: string }): void {
  inMemoryCheckpoint = null;
  const file = options?.checkpointFile || DEFAULT_CHECKPOINT_FILE;
  try {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  } catch {
    // Best effort
  }
}

function buildMypLoadMoreUrl(page: number): string {
  return `https://mypcards.com/produto/load-more?marca=grandarchive&ProdutoSearch%5BexibirSomenteVenda%5D=1&page=${page}`;
}

/**
 * Scans the full MyP in-stock Grand Archive catalog and upserts each listing
 * using the same per-listing lifecycle as the other marketplace stores.
 */
export async function syncGlobalMarketplace(
  targetDatabase: MarketplaceDatabase,
  optionsOrFetch?: GlobalMarketplaceSyncOptions | typeof fetch
): Promise<GlobalMarketplaceSyncResult> {
  const options: GlobalMarketplaceSyncOptions =
    typeof optionsOrFetch === "function"
      ? { customFetch: optionsOrFetch }
      : optionsOrFetch || {};

  const customFetch = options.customFetch;
  const isTest = Boolean(customFetch);
  const persistToDisk = options.persistToDisk ?? !isTest;
  const checkpointFile = options.checkpointFile;
  const pageDelayMs = options.pageDelayMs ?? (isTest ? 0 : 350);
  const retryDelayMs = options.retryDelayMs ?? (isTest ? 10 : 3000);
  const maxPageRetries = options.maxPageRetries ?? 3;

  if (options.forceRestart) {
    clearMypSyncCheckpoint({ checkpointFile });
  }

  const existingCheckpoint = loadMypSyncCheckpoint({
    checkpointFile,
    allowDisk: persistToDisk,
  });
  const resuming = Boolean(
    !options.forceRestart &&
    existingCheckpoint &&
    existingCheckpoint.page > 1
  );

  let parsedItems: ParsedMypItem[] = [];
  let observedTotal: number | null = null;
  let startPage = 2;

  if (resuming && existingCheckpoint) {
    parsedItems = [...existingCheckpoint.parsedItems];
    observedTotal = existingCheckpoint.observedTotal;
    startPage = options.startPage ?? existingCheckpoint.page;
  } else {
    // 1. Fetch Page 1 of Grand Archive in-stock catalog
    const p1Html = await fetchMypText(MYP_PAGE_1_URL, customFetch);
    parsedItems = [...parseMypHtml(p1Html)];

    // Determine total item count to calculate required pages
    const countMatch =
      p1Html.match(/class=["']summary["'][^>]*><strong>(\d+)<\/strong>\s*itens/i) ||
      p1Html.match(/ProdutoScrollInfinito\([^,]+,[^,]+,\s*(\d+)\s*,\s*30\)/i);
    if (countMatch) {
      observedTotal = parseInt(countMatch[1], 10) || 0;
    }
  }

  const totalItems = observedTotal ?? parsedItems.length;
  const neededPages = totalItems > 0 ? Math.ceil(totalItems / 30) : 1;
  const truncated = neededPages > MAX_SAFE_PAGES;
  const maxPages = Math.min(neededPages, MAX_SAFE_PAGES);

  let stoppedAtPage: number | undefined = undefined;
  let failedPageCount = 0;

  // 2. Fetch subsequent pages with retry timeout on error/block
  for (let p = startPage; p <= maxPages; p++) {
    if (pageDelayMs > 0 && p > startPage) {
      await new Promise((resolve) => setTimeout(resolve, pageDelayMs));
    }

    let pageItems: ParsedMypItem[] | null = null;

    for (let attempt = 1; attempt <= maxPageRetries; attempt++) {
      try {
        const moreText = await fetchMypText(
          buildMypLoadMoreUrl(p),
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

        if (isCloudflareChallenge(htmlChunk)) {
          throw new Error(`Blocked by Cloudflare challenge on page ${p}`);
        }

        const items = parseMypHtml(htmlChunk);
        if (items.length === 0 && p < maxPages) {
          throw new Error(`Empty item list on page ${p}`);
        }

        pageItems = items;
        break;
      } catch (err: unknown) {
        if (attempt < maxPageRetries) {
          const delay = retryDelayMs * attempt;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    if (pageItems) {
      parsedItems.push(...pageItems);
    } else {
      failedPageCount += 1;
      stoppedAtPage = p;
      saveMypSyncCheckpoint(
        {
          page: p,
          observedTotal: totalItems,
          parsedItems,
          savedAt: Date.now(),
        },
        { checkpointFile, persistToDisk }
      );
      break;
    }
  }

  if (parsedItems.length === 0) {
    return {
      totalSynced: 0,
      matchedCount: 0,
      unmatchedCount: 0,
      totalCount: totalItems,
      complete: false,
      stoppedAtPage,
      resumedFromPage: resuming ? startPage : undefined,
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

  const complete =
    !stoppedAtPage &&
    failedPageCount === 0 &&
    observedTotal !== null &&
    !truncated &&
    (isTest || parsedItems.length >= Math.floor(observedTotal * 0.9));

  if (complete) {
    clearMypSyncCheckpoint({ checkpointFile });
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
    resumedFromPage: resuming ? startPage : undefined,
    stoppedAtPage,
  };
}
