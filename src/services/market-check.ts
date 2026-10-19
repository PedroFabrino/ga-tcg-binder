import {
  getEnabledMarketStores,
  updateStoreCount,
  type MarketplaceDatabase,
} from "../db/repositories/marketplace-repository";
import { parseLigaStoreTotalCount } from "./ligastore-parser";

export type MarketStorePlatform = "liga_store" | "myp";

export interface EnabledMarketStore {
  id: string;
  platform: MarketStorePlatform | string;
  baseUrl: string | null;
  tcgId: string | null;
  lastCount: number | null;
}

export interface MarketStoreCheckResult {
  storeId: string;
  platform: string;
  previousCount: number | null;
  observedCount: number | null;
  changed: boolean;
  dispatched: boolean;
  error?: string;
}

export interface MarketStoreCheckReport {
  checkedAt: string;
  stores: MarketStoreCheckResult[];
  changes: MarketStoreCheckResult[];
}

const MYP_COUNT_URL =
  "https://mypcards.com/grandarchive?ProdutoSearch%5BexibirSomenteVenda%5D=1";

function buildLigaStoreSearchUrl(store: EnabledMarketStore): string | null {
  if (!store.baseUrl) {
    return null;
  }

  const baseUrl = store.baseUrl.replace(/\/+$/, "");
  const tcgId = store.tcgId ?? "21";
  const storeIdParam = store.id === "brandao" ? "&id=207836" : `&id=${encodeURIComponent(store.id)}`;

  return (
    `${baseUrl}/?view=ecom/itens&page=1&tcg=${encodeURIComponent(tcgId)}${storeIdParam}` +
    "&ultimas=1&txt_order=6&txt_limit=30&txt_estoque=1&btFiltrar=Filtrar"
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

async function fetchHtml(url: string, customFetch = fetch): Promise<string> {
  const response = await customFetch(url, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`Marketplace returned HTTP ${response.status}`);
  }

  return response.text();
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

      const changed = observedCount !== store.lastCount;

      if (!changed) {
        results.push({
          ...baseResult,
          observedCount,
        });
        continue;
      }

      await updateStoreCount(store.id, observedCount, checkedAt, database);

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
