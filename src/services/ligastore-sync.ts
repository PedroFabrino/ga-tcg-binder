import {
getMarketStoreById,
reconcileStoreListings,
updateStoreCount,
updateStoreFullScanAt,
upsertMarketCards,
} from "../db/repositories/marketplace-repository";
import {
  LIGA_STORE_CONFIGS,
  parseLigaStoreSearchPage,
  type ParsedLigaStoreItem,
} from "./ligastore-parser";
import { resolveListing } from "./listing-resolver";
import { fetchWithRetry } from "./market-request-helper";
import { isSessionExpiredError } from "./store-session";
import {
  loadCatalogResolutionData,
  type CatalogResolutionData,
} from "./marketplace";
import { db } from "../db";
import type { InsertMarketCard } from "../db/schema";
import type { StoreProgressCallback } from "./market-sync-progress";

export function resolveLigaStoreItem(
  item: ParsedLigaStoreItem,
  catalog: CatalogResolutionData
): { cardSlug: string | null; editionId: string | null; setPrefix: string } {
  return resolveListing(
    {
      name: item.cardName,
      collectorNumber: item.collectorNumber,
      setPrefix: item.setPrefix,
    },
    catalog,
    { keepCardWhenEditionMissing: true }
  );
}

export interface LigaStoreSyncResult {
  totalSynced: number;
  matchedCount: number;
  unmatchedCount: number;
  enrichedCount: number;
  storeName: string;
}

export async function syncLigaStore(options?: {
  storeId?: string;
  customFetch?: typeof fetch;
  database?: any;
  enrichShortages?: boolean;
  neededSlugs?: Set<string>;
  onProgress?: StoreProgressCallback;
}): Promise<LigaStoreSyncResult> {
  const storeId = options?.storeId ?? "brandao";
  const database = options?.database || db;
  const fetchFn = options?.customFetch || fetch;
  const store = await getMarketStoreById(storeId, database);

  if (!store) {
    throw new Error(`Marketplace store "${storeId}" was not found`);
  }

  const storeData = store as any;
  const config = LIGA_STORE_CONFIGS[storeData.id.toLowerCase()] || {
    ecomId: storeData.id,
    hasWorkingStockFilter: true,
    limit: 30,
    order: 6,
    ultimas: "1",
  };

  const buildPageUrl = (page: number) => {
    const stockParam = config.hasWorkingStockFilter ? "&txt_estoque=1" : "";
    const ultimasParam = config.ultimas ? `&ultimas=${encodeURIComponent(config.ultimas)}` : "&ultimas=";
    return `${storeData.baseUrl}/?view=ecom/itens&page=${page}&id=${
      config.ecomId
    }&comdesconto=&tcg=${encodeURIComponent(storeData.tcgId || "21")}&txt_idioma=&txt_qualid=&${ultimasParam}&txt_filtro_multiestoque=&txt_extras%5B%5D=&txt_order=${config.order}&txt_raridade=&txt_cor=&txt_limit=${config.limit}${stockParam}&btFiltrar=Filtrar`;
  };

  async function fetchText(url: string, retries = 3): Promise<string> {
    const fullUrl = url.startsWith("http")
      ? url
      : new URL(url, storeData.baseUrl).toString();

    return fetchWithRetry(fullUrl, {
      storeId,
      customFetch: options?.customFetch,
      maxRetries: retries,
    });
  }

  const firstPageHtml = await fetchText(buildPageUrl(1));
  const firstPage = parseLigaStoreSearchPage(firstPageHtml);
  const totalCount = Number(firstPage.totalCount) || firstPage.items.length;
  const parsedItems: ParsedLigaStoreItem[] = [...firstPage.items];

  const pageSize = config.limit || 30;
  const maxPages = totalCount > pageSize ? Math.min(25, Math.ceil(totalCount / pageSize)) : 1;

  options?.onProgress?.({
    page: 1,
    totalPages: maxPages,
    itemsCount: parsedItems.length,
    status: "running",
  });

  if (totalCount > pageSize) {
    for (let page = 2; page <= maxPages; page += 1) {
      if (!options?.customFetch) {
        const delay = 2800 + Math.floor(Math.random() * 700);
        await new Promise<void>((resolve) => setTimeout(resolve, delay));
      }
      try {
        const pageHtml = await fetchText(buildPageUrl(page));
        const parsedPage = parseLigaStoreSearchPage(pageHtml);
        parsedItems.push(...parsedPage.items);
        options?.onProgress?.({
          page,
          totalPages: maxPages,
          itemsCount: parsedItems.length,
          status: "running",
        });
      } catch (err: unknown) {
        if (isSessionExpiredError(err)) {
          throw err;
        }
        options?.onProgress?.({
          page,
          totalPages: maxPages,
          itemsCount: parsedItems.length,
          status: "retrying",
          message: `Page ${page} failed`,
        });
        console.warn(
          `[LigaStore: ${storeId}] Failed to fetch page ${page}/${maxPages} after retries; continuing with remaining pages:`,
          err instanceof Error ? err.message : err
        );
      }
    }
  }

  const totalParsed = parsedItems.length;
  if (totalCount > pageSize && totalParsed < totalCount) {
    throw new Error(
      `[LigaStore: ${storeId}] Parity check failed: store reports ${totalCount} items but only parsed ${totalParsed} items across pages; aborting without updating store listings.`
    );
  }

  const catalog = await loadCatalogResolutionData(database);
  const inStockItems = parsedItems.filter(
    (item) => item.hasPrice === true || (typeof item.quantity === "number" && item.quantity > 0)
  );
  const rowsToInsert: InsertMarketCard[] = [];
  let matchedCount = 0;
  let unmatchedCount = 0;
  let enrichedCount = 0;

  for (const item of inStockItems) {
    const workingItem: any = { ...(item as any) };
    const resolved = resolveLigaStoreItem(workingItem, catalog);

    if (resolved.cardSlug) {
      matchedCount += 1;
    } else {
      unmatchedCount += 1;
    }

    rowsToInsert.push({
      id: `mkt-${storeData.id}-${
        workingItem.refId || Math.random().toString(36).slice(2)
      }`,
      storeId: storeData.id,
      cardSlug: resolved.cardSlug,
      editionId: resolved.editionId,
      rawName: workingItem.rawTitle,
      cardName: workingItem.cardName,
      setPrefix: resolved.setPrefix,
      quantity: typeof workingItem.quantity === "number" ? Math.max(1, workingItem.quantity) : 1,
      price: workingItem.price,
      priceNumeric: workingItem.priceNumeric,
      quality: workingItem.condition || "NM",
      isFoil: workingItem.isFoil,
      itemId: workingItem.refId || null,
      productUrl: workingItem.productUrl
        ? (workingItem.productUrl.startsWith("http")
            ? workingItem.productUrl
            : new URL(workingItem.productUrl, storeData.baseUrl).toString())
        : null,
      vendorName: storeData.name,
      vendorUrl: storeData.baseUrl,
    } as InsertMarketCard);
  }

  await upsertMarketCards(rowsToInsert, database);

  const observedItemIds = inStockItems
    .map((item) => (item as any).refId)
    .filter(Boolean);

  await reconcileStoreListings(storeData.id, observedItemIds, database);
  
  const scanTime = new Date();
  await updateStoreCount(storeData.id, totalCount, scanTime, database);
  await updateStoreFullScanAt(storeData.id, scanTime, database);

  return {
  totalSynced: rowsToInsert.length,
  matchedCount,
  unmatchedCount,
  enrichedCount,
  storeName: storeData.name,
  };
}
