import {
  getMarketStoreById,
  reconcileStoreListings,
  updateStoreCount,
  updateStoreFullScanAt,
  upsertMarketCards,
  type MarketplaceDatabase,
  type InsertMarketCard,
} from "../db/repositories/marketplace-repository";
import {
  loadCatalogResolutionData,
  type CatalogResolutionData,
} from "./marketplace";
import {
  parseLootcardsCatalogResponse,
  parseLootcardsDetailHtml,
  type ParsedLootcardsCard,
} from "./lootcards-parser";
import { resolveListing } from "./listing-resolver";
import { fetchHtml } from "./market-crawl";

export interface LootcardsSyncOptions {
  storeId?: string;
  database?: MarketplaceDatabase;
  enrichShortages?: boolean;
  neededSlugs?: Set<string>;
  customFetch?: typeof fetch;
}

export interface LootcardsSyncStats {
  totalSynced: number;
  matchedCount: number;
  unmatchedCount: number;
  enrichedCount: number;
}

export function resolveLootcardsCard(
  card: ParsedLootcardsCard,
  catalog: CatalogResolutionData
): { cardSlug: string | null; editionId: string | null; setPrefix: string } {
  return resolveListing(
    {
      name: card.name,
      collectorNumber: card.collectorNumber,
      editionUuid: card.editionUuid,
      setPrefix: card.setPrefix,
    },
    catalog
  );
}

export async function syncLootcards(
  options?: LootcardsSyncOptions
): Promise<LootcardsSyncStats> {
  const storeId = options?.storeId ?? "lootcards";
  const database = options?.database;
  const store = await getMarketStoreById(storeId, database);

  if (!store) {
    throw new Error(`Store "${storeId}" not found in market_stores.`);
  }

  const fetchFn = options?.customFetch ?? fetch;
  const baseUrl = (store.baseUrl ?? "https://lootcards.store").replace(/\/+$/, "");

  async function fetchText(url: string): Promise<string> {
    return fetchHtml(url, { customFetch: fetchFn });
  }

  // 1. Broad in-stock catalog scan
  const firstPageUrl = `${baseUrl}/api/cards?so_estoque=1&pagina=1`;
  const firstPageText = await fetchText(firstPageUrl);
  const firstPage = parseLootcardsCatalogResponse(firstPageText);

  const totalPages = firstPage.totalPages || 1;
  const totalCount = firstPage.totalCards || firstPage.cards.length;
  const allCards: ParsedLootcardsCard[] = [...firstPage.cards];

  if (totalPages > 1) {
    for (let page = 2; page <= totalPages; page += 1) {
      if (!options?.customFetch) {
        await new Promise<void>((resolve) => setTimeout(resolve, 150));
      }
      const pageUrl = `${baseUrl}/api/cards?so_estoque=1&pagina=${page}`;
      try {
        const pageText = await fetchText(pageUrl);
        const parsedPage = parseLootcardsCatalogResponse(pageText);
        allCards.push(...parsedPage.cards);
      } catch (err) {
        console.warn(`[Lootcards Sync] Failed to fetch page ${page}:`, err);
      }
    }
  }

  const catalog = await loadCatalogResolutionData(database);
  const rowsToInsert: InsertMarketCard[] = [];
  const observedItemIds: string[] = [];

  let matchedCount = 0;
  let unmatchedCount = 0;
  let enrichedCount = 0;

  // 2. Process and enrich cards
  for (const card of allCards) {
    const resolved = resolveLootcardsCard(card, catalog);
    if (resolved.cardSlug) {
      matchedCount += 1;
    } else {
      unmatchedCount += 1;
    }

    const shouldEnrich =
      card.hasFoil ||
      (options?.enrichShortages &&
        resolved.cardSlug &&
        options.neededSlugs?.has(resolved.cardSlug));

    let enriched = false;

    if (shouldEnrich && card.slug) {
      try {
        if (!options?.customFetch) {
          await new Promise<void>((resolve) => setTimeout(resolve, 200));
        }
        const detailUrl = `${baseUrl}/carta/${encodeURIComponent(card.slug)}`;
        const detailHtml = await fetchText(detailUrl);
        const detailData = parseLootcardsDetailHtml(detailHtml);

        if (detailData.variants.length > 0) {
          for (const variant of detailData.variants) {
            const finishSuffix = variant.finish.toLowerCase();
            const itemId = `${variant.editionUuid || card.editionUuid}-${finishSuffix}`;
            const rowId = `mkt-${store.id}-${itemId}`;

            rowsToInsert.push({
              id: rowId,
              storeId: store.id,
              cardSlug: resolved.cardSlug,
              editionId: resolved.editionId ?? variant.editionUuid,
              rawName: card.name,
              cardName: card.name,
              setPrefix: resolved.setPrefix || card.setPrefix,
              quantity: variant.quantity,
              price: variant.price,
              priceNumeric: variant.priceNumeric,
              quality: variant.condition || "NM",
              isFoil: variant.finish === "FOIL",
              itemId,
              productUrl: `${baseUrl}/carta/${encodeURIComponent(card.slug)}`,
              vendorName: store.name,
              vendorUrl: store.baseUrl,
            } as InsertMarketCard);

            observedItemIds.push(itemId);
          }
          enriched = true;
          enrichedCount += 1;
        }
      } catch (err) {
        console.warn(`[Lootcards Sync] Detail enrichment failed for ${card.slug}:`, err);
      }
    }

    // Default base row if not enriched
    if (!enriched) {
      const isFoil = card.hasFoil && !card.hasStock;
      const finishSuffix = isFoil ? "foil" : "nonfoil";
      const itemId = `${card.editionUuid}-${finishSuffix}`;
      const rowId = `mkt-${store.id}-${itemId}`;

      rowsToInsert.push({
        id: rowId,
        storeId: store.id,
        cardSlug: resolved.cardSlug,
        editionId: resolved.editionId ?? card.editionUuid,
        rawName: card.name,
        cardName: card.name,
        setPrefix: resolved.setPrefix || card.setPrefix,
        quantity: card.totalStock > 0 ? card.totalStock : 1,
        price: card.price,
        priceNumeric: card.priceNumeric,
        quality: "NM",
        isFoil,
        itemId,
        productUrl: `${baseUrl}/carta/${encodeURIComponent(card.slug)}`,
        vendorName: store.name,
        vendorUrl: store.baseUrl,
      } as InsertMarketCard);

      observedItemIds.push(itemId);
    }
  }

  // 3. Upsert records & reconcile vanished listings
  await upsertMarketCards(rowsToInsert, database);
  await reconcileStoreListings(store.id, observedItemIds, database);

  const scanTime = new Date();
  await updateStoreCount(store.id, totalCount, scanTime, database);
  await updateStoreFullScanAt(store.id, scanTime, database);

  return {
    totalSynced: rowsToInsert.length,
    matchedCount,
    unmatchedCount,
    enrichedCount,
  };
}
