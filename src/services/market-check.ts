import {
getEnabledMarketStores,
updateStoreCount,
updateStoreLatestCardRefId,
type MarketplaceDatabase,
} from "../db/repositories/marketplace-repository";
import { parseLigaStoreTotalCount, parseLigaStoreLatestCardRefId } from "./ligastore-parser";

export type MarketStorePlatform = "liga_store" | "myp";

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

const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function fetchHtml(url: string, customFetch = fetch): Promise<string> {
  try {
    const response = await customFetch(url, {
      headers: {
        "User-Agent": BROWSER_USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (response.ok) {
      return await response.text();
    }
  } catch {
    // Fallback to curl below
  }

  if (customFetch !== fetch) {
    throw new Error(`Marketplace request failed for ${url}`);
  }

  const { execFileSync } = await import("node:child_process");
  const curlBin = process.platform === "win32" ? "curl.exe" : "curl";
  const stdout = execFileSync(
    curlBin,
    ["-s", "-L", "--max-time", "15", "-A", BROWSER_USER_AGENT, url],
    { encoding: "utf-8", maxBuffer: 5 * 1024 * 1024 }
  );

  if (!stdout || stdout.trim().length === 0) {
    throw new Error(`Empty response from ${url}`);
  }

  return stdout;
}

async function fetchStoreCount(
  store: EnabledMarketStore,
  customFetch = fetch
): Promise<number | null> {
  if (store.platform === "myp") {
    const html = await fetchHtml(MYP_COUNT_URL, customFetch);
    return parseMypTotalCount(html);
  }

  const url = buildLigaStoreSearchUrl(store);

  if (!url) {
    throw new Error("Liga Store has no baseUrl configured");
  }

  const html = await fetchHtml(url, customFetch);
  return parseLigaStoreTotalCount(html);
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

    try {
    const observedCount = await fetchStoreCount(store, customFetch);
    
    if (observedCount === null) {
    results.push({
    ...baseResult,
    error: "Could not parse total listed card count",
    });
    continue;
    }
    
    const countChanged = observedCount !== store.lastCount;
    
    let latestCardRefId: string | null = null;
    let latestCardChanged = false;
    
    if (store.platform === "liga_store") {
      try {
        const latestUrl = buildLigaStoreSearchUrl(store, "latest");
        if (latestUrl) {
          const latestHtml = await fetchHtml(latestUrl, customFetch);
          latestCardRefId = parseLigaStoreLatestCardRefId(latestHtml);
          if (latestCardRefId !== null) {
            latestCardChanged =
              store.lastLatestCardRefId === null ||
              latestCardRefId !== store.lastLatestCardRefId;
            await updateStoreLatestCardRefId(store.id, latestCardRefId, database);
          }
        }
      } catch (err) {
        console.warn(
          `[market-check] Failed latest card check for ${store.id}:`,
          err instanceof Error ? err.message : err
        );
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
