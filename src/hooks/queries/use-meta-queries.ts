"use client";

import { useQuery } from "@tanstack/react-query";
import { metaKeys } from "@/lib/query-keys";

export interface MetaExplorerData {
  archetypes: any[];
  recommendedArchetypes: any[];
}

export function useMetaExplorerQuery(userId?: string | null) {
  return useQuery<MetaExplorerData>({
    queryKey: metaKeys.list(userId),
    queryFn: async () => {
      const userParam = userId ? `?userId=${encodeURIComponent(userId)}` : "";
      const res = await fetch(`/api/meta${userParam}`);
      if (!res.ok) throw new Error("Failed to fetch meta archetypes");
      const data = await res.json();
      return {
        archetypes: Array.isArray(data.archetypes) ? data.archetypes : [],
        recommendedArchetypes: Array.isArray(data.recommendedArchetypes) ? data.recommendedArchetypes : [],
      };
    },
  });
}
