/**
 * Per-store configuration and search URL builder for LigaStore storefronts.
 */

export interface LigaStoreConfig {
  ecomId: string;
  hasWorkingStockFilter: boolean;
  limit: number;
  order: number;
  ultimas: string;
}

export const LIGA_STORE_CONFIGS: Record<string, LigaStoreConfig> = {
  brandao: {
    ecomId: "207836",
    hasWorkingStockFilter: true,
    limit: 30,
    order: 6,
    ultimas: "1",
  },
  tabletopsorocaba: {
    ecomId: "546923",
    hasWorkingStockFilter: false,
    limit: 120,
    order: 1,
    ultimas: "",
  },
  tabletop_sorocaba: {
    ecomId: "546923",
    hasWorkingStockFilter: false,
    limit: 120,
    order: 1,
    ultimas: "",
  },
  lastplace: {
    ecomId: "26240",
    hasWorkingStockFilter: true,
    limit: 120,
    order: 6,
    ultimas: "",
  },
};

/**
 * Returns the LigaStore query configuration for a store ID, falling back to
 * safe defaults for unrecognized stores.
 */
export function getLigaStoreConfig(storeId: string): LigaStoreConfig {
  return (
    LIGA_STORE_CONFIGS[storeId.toLowerCase()] || {
      ecomId: storeId,
      hasWorkingStockFilter: true,
      limit: 30,
      order: 6,
      ultimas: "1",
    }
  );
}

/**
 * Builds a LigaStore catalog search URL for either full/count scans or
 * latest-additions change detection.
 */
export function buildLigaStoreSearchUrl(
  store: { baseUrl: string | null; tcgId?: string | null; id: string },
  sort: "count" | "latest" = "count",
  page = 1
): string | null {
  if (!store.baseUrl) {
    return null;
  }

  const baseUrl = store.baseUrl.replace(/\/+$/, "");
  const tcgId = store.tcgId ?? "21";
  const config = getLigaStoreConfig(store.id);

  const orderParam = sort === "latest" ? "txt_order=12" : `txt_order=${config.order}`;
  const ultimasParam =
    sort === "latest"
      ? "ultimas=1"
      : config.ultimas
        ? `ultimas=${encodeURIComponent(config.ultimas)}`
        : "ultimas=";
  const stockParam = config.hasWorkingStockFilter ? "&txt_estoque=1" : "";

  return `${baseUrl}/?view=ecom/itens&page=${page}&id=${encodeURIComponent(config.ecomId)}&comdesconto=&tcg=${encodeURIComponent(tcgId)}&txt_idioma=&txt_qualid=&${ultimasParam}&txt_filtro_multiestoque=&txt_extras%5B%5D=&${orderParam}&txt_raridade=&txt_cor=&txt_limit=${config.limit}${stockParam}&btFiltrar=Filtrar`;
}
