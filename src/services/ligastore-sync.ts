import {
  getMarketStoreById,
  reconcileStoreListings,
  updateStoreCount,
  updateStoreFullScanAt,
  upsertMarketCards,
} from "../db/repositories/marketplace-repository";
import {
  parseLigaStoreItemDetails,
  parseLigaStoreSearchPage,
  type ParsedLigaStoreItem,
} from "./ligastore-parser";
import {
  loadCatalogResolutionData,
  type CatalogResolutionData,
} from "./marketplace";
import { db } from "../db";
import type { InsertMarketCard } from "../db/schema";

function normalizeAlphaNumeric(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeCollectorNumber(value: unknown): string {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");

  const match = normalized.match(/^(\d+)([a-z]*)$/);
  if (!match) {
    return normalized;
  }

  return `${String(Number(match[1]))}${match[2]}`;
}

function lookupCatalogCard(
  source: unknown,
  key: string
): { slug: string; id?: string } | undefined {
  if (source instanceof Map) {
    return source.get(key);
  }

  if (source && typeof source === "object") {
    return (source as Record<string, { slug: string; id?: string }>)[key];
  }

  return undefined;
}

export function resolveLigaStoreItem(
  item: ParsedLigaStoreItem,
  catalog: CatalogResolutionData
): { cardSlug: string | null; editionId: string | null; setPrefix: string } {
  const source = item as any;
  const lowerName = String(source.cardName ?? "").trim().toLowerCase();

  const matchedCard =
    lookupCatalogCard(catalog.cardByLowerName, lowerName) ??
    lookupCatalogCard(
      catalog.cardByAlphaNum,
      normalizeAlphaNumeric(String(source.cardName ?? ""))
    );

  if (!matchedCard) {
    return {
      cardSlug: null,
      editionId: null,
      setPrefix: "UNKNOWN",
    };
  }

  const collectorNumber = normalizeCollectorNumber(
    source.collectorNumber ?? source.collector ?? source.number
  );

  const matchedEdition = (catalog.allCatalogEditions as any[]).find(
    (edition) => {
      const editionCardMatches =
        edition.cardSlug === matchedCard.slug ||
        (matchedCard.id != null && edition.cardId === matchedCard.id);

      const editionCollectorNumber = normalizeCollectorNumber(
        edition.collectorNumber ?? edition.collector ?? edition.number
      );

      return editionCardMatches && (editionCollectorNumber === collectorNumber || !collectorNumber);
    }
  );

  if (!matchedEdition) {
    return {
      cardSlug: null,
      editionId: null,
      setPrefix: "UNKNOWN",
    };
  }

  return {
    cardSlug: matchedCard.slug,
    editionId: matchedEdition.id,
    setPrefix: matchedEdition.setPrefix,
  };
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
}): Promise<LigaStoreSyncResult> {
  const storeId = options?.storeId ?? "brandao";
  const database = options?.database || db;
  const fetchFn = options?.customFetch || fetch;
  const store = await getMarketStoreById(storeId, database);

  if (!store) {
    throw new Error(`Marketplace store "${storeId}" was not found`);
  }

  const storeData = store as any;
  const buildPageUrl = (page: number) =>
    `${storeData.baseUrl}/?view=ecom/itens&page=${page}&id=${
      storeData.id === "brandao" ? "207836" : storeData.id
    }&tcg=${encodeURIComponent(storeData.tcgId || "21")}&ultimas=1&txt_order=6&txt_limit=30&txt_estoque=1&btFiltrar=Filtrar`;

  async function fetchText(url: string): Promise<string> {
    const fullUrl = url.startsWith("http")
      ? url
      : new URL(url, storeData.baseUrl).toString();

    const flareUrl = process.env.FLARESOLVERR_URL;
    if (flareUrl && !options?.customFetch) {
      try {
        const solverRes = await fetch(`${flareUrl.replace(/\/$/, "")}/v1`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cmd: "request.get",
            url: fullUrl,
            maxTimeout: 60000,
          }),
        });
        if (solverRes.ok) {
          const solverJson = await solverRes.json();
          if (solverJson?.solution?.response) {
            return solverJson.solution.response;
          }
        }
      } catch {
        // Fallback to direct fetch
      }
    }

    const browserHeaders = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept":
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
      "Cache-Control": "no-cache",
      "Pragma": "no-cache",
      "Sec-Ch-Ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
      "Sec-Ch-Ua-Mobile": "?0",
      "Sec-Ch-Ua-Platform": '"Windows"',
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-User": "?1",
      "Upgrade-Insecure-Requests": "1",
    };

    const response = await fetchFn(fullUrl, {
      headers: browserHeaders,
    });

    if (response.ok === false) {
      throw new Error(`LigaStore request failed (${response.status}) for ${fullUrl}`);
    }

    return response.text();
  }

  const firstPageHtml = await fetchText(buildPageUrl(1));
  const firstPage = parseLigaStoreSearchPage(firstPageHtml);
  const totalCount = Number(firstPage.totalCount) || firstPage.items.length;
  const parsedItems: ParsedLigaStoreItem[] = [...firstPage.items];

  if (totalCount > 30) {
    const maxPages = Math.min(15, Math.ceil(totalCount / 30));

    for (let page = 2; page <= maxPages; page += 1) {
      if (!options?.customFetch) {
        await new Promise<void>((resolve) => setTimeout(resolve, 250));
      }
      const pageHtml = await fetchText(buildPageUrl(page));
      const parsedPage = parseLigaStoreSearchPage(pageHtml);
      parsedItems.push(...parsedPage.items);
    }
  }

  const catalog = await loadCatalogResolutionData(database);
  const rowsToInsert: InsertMarketCard[] = [];
  let matchedCount = 0;
  let unmatchedCount = 0;
  let enrichedCount = 0;

  for (const item of parsedItems) {
    const workingItem: any = { ...(item as any) };
    const resolved = resolveLigaStoreItem(workingItem, catalog);

    if (resolved.cardSlug) {
      matchedCount += 1;
    } else {
      unmatchedCount += 1;
    }

    if (
      options?.enrichShortages &&
      workingItem.productUrl &&
      resolved.cardSlug &&
      options.neededSlugs?.has(resolved.cardSlug)
    ) {
      try {
        const detailHtml = await fetchText(workingItem.productUrl);
        const details = parseLigaStoreItemDetails(detailHtml);

        if (details.price) workingItem.price = details.price;
        if (details.priceNumeric > 0) workingItem.priceNumeric = details.priceNumeric;
        if (details.stockQuantity > 0) workingItem.quantity = details.stockQuantity;
        if (details.condition) workingItem.condition = details.condition;

        enrichedCount += 1;
      } catch {
        // Fall back to surface search page data on detail fetch failure
      }
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
      quantity: workingItem.quantity,
      price: workingItem.price,
      priceNumeric: workingItem.priceNumeric,
      quality: workingItem.condition || "NM",
      isFoil: workingItem.isFoil,
      itemId: workingItem.refId || null,
      productUrl: workingItem.productUrl,
      vendorName: storeData.name,
      vendorUrl: storeData.baseUrl,
    } as InsertMarketCard);
  }

  await upsertMarketCards(rowsToInsert, database);

  const observedItemIds = parsedItems
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
