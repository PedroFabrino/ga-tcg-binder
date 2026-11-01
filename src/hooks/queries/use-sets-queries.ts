"use client";

import { useQuery } from "@tanstack/react-query";
import { setsKeys } from "@/lib/query-keys";
import type { FeaturedSetSummary, SetTargetDeck, SetGroupChecklistReport } from "@ga/contracts";

export interface SetsDashboardData {
  groups: FeaturedSetSummary[];
  availableDecks: SetTargetDeck[];
  hasPersonalWants: boolean;
}

export function useSetsDashboardQuery(target?: string | null) {
  return useQuery<SetsDashboardData>({
    queryKey: [...setsKeys.all, "dashboard", target ?? "all"],
    queryFn: async () => {
      const url =
        target && target !== "all"
          ? `/api/sets?target=${encodeURIComponent(target)}`
          : "/api/sets";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to load sets");
      const data = await res.json();
      return {
        groups: Array.isArray(data.groups) ? data.groups : [],
        availableDecks: Array.isArray(data.availableDecks) ? data.availableDecks : [],
        hasPersonalWants: Boolean(data.hasPersonalWants),
      };
    },
  });
}

export function useSetChecklistQuery(groupSlug: string, target?: string | null) {
  return useQuery<SetGroupChecklistReport>({
    queryKey: [...setsKeys.detail(groupSlug), { target: target ?? "all" }],
    queryFn: async () => {
      const url = new URL(
        `/api/sets/${encodeURIComponent(groupSlug)}`,
        typeof window !== "undefined" ? window.location.origin : "http://localhost:3002"
      );
      if (target && target !== "all") {
        url.searchParams.set("target", target);
      }
      const res = await fetch(url.toString());
      if (res.status === 404) {
        throw new Error("NOT_FOUND");
      }
      if (!res.ok) throw new Error("Failed to load set checklist");
      return res.json();
    },
    enabled: Boolean(groupSlug),
  });
}
