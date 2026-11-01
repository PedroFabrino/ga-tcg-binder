"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { setsKeys } from "@/lib/query-keys";
import { applyHiddenFlag } from "@/lib/sets-view";
import type { FeaturedSetSummary, SetTargetDeck, SetGroupChecklistReport } from "@ga/contracts";

export interface SetsDashboardData {
  groups: FeaturedSetSummary[];
  availableDecks: SetTargetDeck[];
  hasPersonalWants: boolean;
}

export function useSetsDashboardQuery(target?: string | null, userId?: string | null) {
  return useQuery<SetsDashboardData>({
    queryKey: setsKeys.dashboard(target, userId),
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

export function useToggleSetHiddenMutation(target?: string | null, userId?: string | null) {
  const queryClient = useQueryClient();
  const queryKey = setsKeys.dashboard(target, userId);

  return useMutation({
    mutationFn: async ({ groupUuid, isHidden }: { groupUuid: string; isHidden: boolean }) => {
      const res = await fetch("/api/sets/hide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupUuid, isHidden }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json().catch(() => ({}));
    },
    onMutate: async ({ groupUuid, isHidden }) => {
      await queryClient.cancelQueries({ queryKey });
      const previousData = queryClient.getQueryData<SetsDashboardData>(queryKey);

      if (previousData) {
        queryClient.setQueryData<SetsDashboardData>(queryKey, {
          ...previousData,
          groups: applyHiddenFlag(previousData.groups, groupUuid, isHidden),
        });
      }

      return { previousData };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: setsKeys.dashboardPrefix() });
    },
  });
}

export function useSetChecklistQuery(groupSlug: string, target?: string | null, userId?: string | null) {
  return useQuery<SetGroupChecklistReport>({
    queryKey: setsKeys.detail(groupSlug, target, userId),
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
