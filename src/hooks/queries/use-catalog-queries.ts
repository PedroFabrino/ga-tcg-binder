"use client";

import { useQuery } from "@tanstack/react-query";
import { catalogKeys } from "@/lib/query-keys";
import type { CatalogCardData } from "@/components/catalog/CatalogCard";

export interface CatalogQueryParams {
  userId?: string | null;
  query?: string;
  element?: string | null;
  class?: string | null;
  setPrefix?: string | null;
  lowPopOnly?: boolean;
  staplesOnly?: boolean;
  keywords?: string[];
  keywordsMatchMode?: "all" | "any";
  limit?: number;
}

export interface CatalogQueryResult {
  cards: CatalogCardData[];
  total: number;
}

export function useCatalogQuery(params: CatalogQueryParams) {
  const normalizedParams: Record<string, string | number | boolean | null | undefined> = {
    userId: params.userId ?? null,
    query: params.query?.trim() || null,
    element: params.element || null,
    class: params.class || null,
    setPrefix: params.setPrefix || null,
    lowPopOnly: params.lowPopOnly || false,
    staplesOnly: params.staplesOnly || false,
    keywords: params.keywords?.join(",") || null,
    keywordsMatchMode: params.keywordsMatchMode || "all",
    limit: params.limit || 48,
  };

  return useQuery<CatalogQueryResult>({
    queryKey: catalogKeys.list(normalizedParams),
    queryFn: async () => {
      const searchParams = new URLSearchParams({ limit: String(params.limit || 48) });
      if (params.userId) searchParams.set("userId", params.userId);
      if (params.query?.trim()) searchParams.set("query", params.query.trim());
      if (params.element) searchParams.set("element", params.element);
      if (params.class) searchParams.set("class", params.class);
      if (params.setPrefix) searchParams.set("setPrefix", params.setPrefix);
      if (params.lowPopOnly) searchParams.set("lowPopOnly", "true");
      if (params.staplesOnly) searchParams.set("staplesOnly", "true");
      if (params.keywords && params.keywords.length > 0) {
        searchParams.set("keywords", params.keywords.join(","));
        searchParams.set("keywordsMatchMode", params.keywordsMatchMode || "all");
      }

      const res = await fetch(`/api/catalog?${searchParams}`);
      if (!res.ok) throw new Error("Failed to fetch catalog");
      const data = await res.json();
      return {
        cards: Array.isArray(data.cards) ? data.cards : [],
        total: data.total || 0,
      };
    },
  });
}
