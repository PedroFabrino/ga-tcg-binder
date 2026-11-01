"use client";

import { useQuery } from "@tanstack/react-query";
import { marketplaceKeys } from "@/lib/query-keys";
import type { GlobalMarketReport } from "@/services/marketplace";

export function useMarketplaceReportQuery(userId?: string | null) {
  return useQuery<GlobalMarketReport>({
    queryKey: [...marketplaceKeys.all, "market", { userId: userId ?? null }],
    queryFn: async () => {
      const userIdQuery = userId ? `?userId=${encodeURIComponent(userId)}` : "";
      const res = await fetch(`/api/marketplace/market${userIdQuery}`);
      if (!res.ok) throw new Error("Failed to load global marketplace");
      return res.json();
    },
  });
}
