"use client";

import { useSyncExternalStore, useCallback } from "react";

export interface CatalogFilterState {
  query: string;
  element: string | null;
  cardClass: string | null;
  setPrefix: string | null;
  lowPopOnly: boolean;
  staplesOnly: boolean;
  selectedKeywords: string[];
  keywordsMatchMode: "all" | "any";
}

export const DEFAULT_CATALOG_FILTERS: CatalogFilterState = {
  query: "",
  element: null,
  cardClass: null,
  setPrefix: null,
  lowPopOnly: false,
  staplesOnly: false,
  selectedKeywords: [],
  keywordsMatchMode: "all",
};

let inMemoryFilterState: CatalogFilterState = { ...DEFAULT_CATALOG_FILTERS };
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

export function getCatalogFiltersSnapshot(): CatalogFilterState {
  return inMemoryFilterState;
}

export function subscribeCatalogFilters(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setCatalogFilters(
  updater:
    | Partial<CatalogFilterState>
    | ((prev: CatalogFilterState) => Partial<CatalogFilterState>)
) {
  const nextUpdates =
    typeof updater === "function" ? updater(inMemoryFilterState) : updater;
  inMemoryFilterState = { ...inMemoryFilterState, ...nextUpdates };
  notify();
}

/**
 * Exposed for testing per AGENTS.md client hook reset seam directive.
 */
export function resetCatalogFiltersForTesting() {
  inMemoryFilterState = { ...DEFAULT_CATALOG_FILTERS };
  notify();
}

export function useCatalogFilters() {
  const filters = useSyncExternalStore(
    subscribeCatalogFilters,
    getCatalogFiltersSnapshot,
    getCatalogFiltersSnapshot
  );

  const updateFilters = useCallback(
    (
      updater:
        | Partial<CatalogFilterState>
        | ((prev: CatalogFilterState) => Partial<CatalogFilterState>)
    ) => {
      setCatalogFilters(updater);
    },
    []
  );

  const resetAllFilters = useCallback(() => {
    resetCatalogFiltersForTesting();
  }, []);

  return {
    filters,
    updateFilters,
    resetAllFilters,
  };
}
