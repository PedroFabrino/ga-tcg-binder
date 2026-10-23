import {
getEnabledMarketStores,
updateStoreCount,
updateStoreLatestCardRefId,
type MarketplaceDatabase,
} from "../db/repositories/marketplace-repository";
import { parseLigaStoreTotalCount, parseLigaStoreLatestCardRefId } from "./ligastore-parser";
import { parseLootcardsTotalCount, parseLootcardsLatestCardRefId } from "./lootcards-parser";
import { fetchMarketHtml } from "./market-fetch";
import {
  getActiveBackoff,
  recordStoreFailure,
  recordStoreSuccess,
} from "./market-store-backoff";

export { resetMarketCheckBackoff } from "./market-store-backoff";

export type MarketStorePlatform = "liga_store" | "myp" | "lootcards";

export interface EnabledMarketStore {
id: string;
platform: MarketStorePlatform | string;
baseUrl: string | null;
tcgId: string | null;
lastCount: number | null;
lastLatestCardRefId: string | null;
}

export interface MarketStoreCheckResult {
storeId: string;
platform: string;
previousCount: number | null;
observedCount: number | null;
changed: boolean;
dispatched: boolean;
latestCardRefId: string | null;
previousLatestCardRefId: string | null;
latestCardChanged: boolean;
skipped?: boolean;
error?: string;
}

export interface MarketStoreCheckReport {
  checkedAt: string;
  stores: MarketStoreCheckResult[];
  changes: MarketStoreCheckResult[];
}

const MYP_COUNT_URL =
  "https://mypcards.com/grandarchive?ProdutoSearch%5BexibirSomenteVenda%5D=1";

export function buildLigaStoreSearchUrl(
  store: EnabledMarketStore,
  sort: "count" | "latest" = "count"
): string | null {
  if (!store.baseUrl) {
    return null;
  }

  const baseUrl = store.baseUrl.replace(/\/+$/, "");
  const tcgId = store.tcgId ?? "21";
  const storeIdParam = store.id === "brandao" ? "&id=207836" : `&id=${encodeURIComponent(store.id)}`;
  const orderParam = sort === "latest" ? "txt_order=12" : "txt_order=6";

  return (
    `${baseUrl}/?view=ecom/itens&page=1&tcg=${encodeURIComponent(tcgId)}${storeIdParam}` +
    `&ultimas=1&${orderParam}&txt_limit=30&txt_estoque=1&btFiltrar=Filtrar`
  );
}

export function parseMypTotalCount(html: string): number | null {
  const summaryMatch = html.match(
    /class=["']summary["'][^>]*><strong>(\d+)<\/strong>\s*itens/i
  );

  if (summaryMatch?.[1]) {
    return Number.parseInt(summaryMatch[1], 10);
  }

  const infiniteScrollMatch = html.match(
    /ProdutoScrollInfinito\([^,]+,[^,]+,\s*(\d+)\s*,\s*30\)/i
  );

  if (infiniteScrollMatch?.[1]) {
    return Number.parseInt(infiniteScrollMatch[1], 10);
  }

  return null;
}

/**
 * Parses the newest MyP marketplace listing identifier from the first catalog
 * page. MyP returns the in-stock catalog in insertion order, so the first card
 * block is the most recently listed item. The attribute only appears on card
 * blocks, so the first occurrence in the document is the newest listing.
 */
export function parseMypLatestCardRefId(html: string): string | null {
  const match = html.match(/\bdata-ga-item-id="([^"]+)"/i);
  return match?.[1]?.trim() || null;
}

interface StoreObservation {
  count: number | null;
  latestCardRefId: string | null;
}

/**
 * Fetches the lightweight change-detection data for a store. MyP returns its
 * total count and newest listing in the same catalog page because that page is
 * already ordered by insertion (newest first).
 */
async function fetchStoreObservation(
  store: EnabledMarketStore,
  customFetch = fetch
): Promise<StoreObservation> {
  if (store.platform === "myp") {
    const html = await fetchMarketHtml(MYP_COUNT_URL, customFetch);
    return {
      count: parseMypTotalCount(html),
      latestCardRefId: parseMypLatestCardRefId(html),
    };
  }

  if (store.platform === "lootcards") {
    const baseUrl = (store.baseUrl ?? "https://lootcards.store").replace(/\/+$/, "");
    const url = `${baseUrl}/api/cards?ordem=chegaram_agora&so_estoque=1`;
    const jsonText = await fetchMarketHtml(url, customFetch);
    return {
      count: parseLootcardsTotalCount(jsonText),
      latestCardRefId: parseLootcardsLatestCardRefId(jsonText),
    };
  }

  const url = buildLigaStoreSearchUrl(store);

  if (!url) {
    throw new Error("Liga Store has no baseUrl configured");
  }

  const html = await fetchMarketHtml(url, customFetch);
  return {
    count: parseLigaStoreTotalCount(html),
    latestCardRefId: null,
  };
}

async function dispatchMarketSync(
  storeId: string,
  customFetch = fetch
): Promise<boolean> {
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_PAT;
  const repository = process.env.GITHUB_REPOSITORY;

  /*
   * Local development, preview environments, and unit tests should still
   * return the change report even when GitHub credentials are unavailable.
   */
  if (!token || !repository) {
    return false;
  }

  const response = await customFetch(
    `https://api.github.com/repos/${repository}/actions/workflows/market-sync.yml/dispatches`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "ga-tcg-binder-market-check",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        ref: "main",
        inputs: {
          store_id: storeId,
        },
      }),
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `GitHub workflow dispatch failed with HTTP ${response.status}: ${body}`
    );
  }

  return true;
}

function warnLatestCardCheckFailure(
  store: EnabledMarketStore,
  err: unknown
): void {
  console.warn(
    `[market-check] Failed latest card check for ${store.id}:`,
    err instanceof Error ? err.message : err
  );
}

/**
 * Compares an observed latest-listing identifier against the store's recorded
 * one, persists the new value, and reports whether it changed. Returns false
 * when the identifier could not be parsed.
 */
async function applyLatestCardChange(
  store: EnabledMarketStore,
  latestCardRefId: string | null,
  database?: MarketplaceDatabase
): Promise<boolean> {
  if (latestCardRefId === null) {
    return false;
  }

  const changed =
    store.lastLatestCardRefId === null ||
    latestCardRefId !== store.lastLatestCardRefId;

  try {
    await updateStoreLatestCardRefId(store.id, latestCardRefId, database);
  } catch (err) {
    warnLatestCardCheckFailure(store, err);
  }

  return changed;
}

/**
 * Retrieves the lightweight listing count for each enabled marketplace store.
 *
 * A GitHub workflow dispatch is attempted only when a count changed. Missing
 * GitHub credentials are intentionally non-fatal so this function remains safe
 * to run locally and in test environments.
 */
export async function checkMarketStores(
  database?: MarketplaceDatabase,
  customFetch = fetch
): Promise<MarketStoreCheckReport> {
  const stores = (await getEnabledMarketStores(database)) as EnabledMarketStore[];
  const checkedAt = new Date();
  const results: MarketStoreCheckResult[] = [];

  for (const store of stores) {
    const baseResult: MarketStoreCheckResult = {
    storeId: store.id,
    platform: store.platform,
    previousCount: store.lastCount,
    observedCount: null,
    changed: false,
    dispatched: false,
    latestCardRefId: null,
    previousLatestCardRefId: store.lastLatestCardRefId ?? null,
    latestCardChanged: false,
    };

    const now = Date.now();
    const backoff = getActiveBackoff(store.id, now);
    if (backoff) {
    const minutesLeft = Math.max(1, Math.ceil((backoff.nextPollAt - now) / 60_000));
    results.push({
    ...baseResult,
    skipped: true,
    error: `Backing off after ${backoff.failures} consecutive failure(s); next attempt in ${minutesLeft}m`,
    });
    continue;
    }

    try {
    const observation = await fetchStoreObservation(store, customFetch);
    const observedCount = observation.count;
    
    if (observedCount === null) {
    recordStoreFailure(store.id, now);
    results.push({
    ...baseResult,
    error: "Could not parse total listed card count",
    });
    continue;
    }
    
    recordStoreSuccess(store.id);
    
    const countChanged = observedCount !== store.lastCount;
    
    let latestCardRefId: string | null = observation.latestCardRefId;
    let latestCardChanged = false;
    
    if (store.platform === "myp") {
      latestCardChanged = await applyLatestCardChange(
        store,
        latestCardRefId,
        database
      );
    } else if (store.platform === "lootcards") {
      try {
        latestCardChanged = await applyLatestCardChange(
          store,
          latestCardRefId,
          database
        );
      } catch (err) {
        warnLatestCardCheckFailure(store, err);
      }
    } else if (store.platform === "liga_store") {
      try {
        const latestUrl = buildLigaStoreSearchUrl(store, "latest");
        if (latestUrl) {
          const latestHtml = await fetchMarketHtml(latestUrl, customFetch);
          latestCardRefId = parseLigaStoreLatestCardRefId(latestHtml);
          latestCardChanged = await applyLatestCardChange(
            store,
            latestCardRefId,
            database
          );
        }
      } catch (err) {
        warnLatestCardCheckFailure(store, err);
      }
    }
    
    const changed = countChanged || latestCardChanged;
    
    if (!changed) {
    results.push({
    ...baseResult,
    observedCount,
    latestCardRefId,
    latestCardChanged,
    });
    continue;
    }
    
    if (countChanged) {
    await updateStoreCount(store.id, observedCount, checkedAt, database);
    }
    
    let dispatched = false;
    let dispatchError: string | undefined;
    
    try {
    dispatched = await dispatchMarketSync(store.id, customFetch);
    } catch (error) {
    dispatchError =
    error instanceof Error ? error.message : "Unknown dispatch error";
    }
    
    results.push({
    ...baseResult,
    observedCount,
    changed: true,
    dispatched,
    latestCardRefId,
    latestCardChanged,
    ...(dispatchError ? { error: dispatchError } : {}),
    });
    } catch (error) {
    recordStoreFailure(store.id, now);
    results.push({
    ...baseResult,
    error: error instanceof Error ? error.message : "Unknown check error",
    });
    }
    }

  return {
    checkedAt: checkedAt.toISOString(),
    stores: results,
    changes: results.filter((result) => result.changed),
  };
}
