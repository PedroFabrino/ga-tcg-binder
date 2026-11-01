"use client";

import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { deckKeys } from "@/lib/query-keys";
import { invalidateDeckQueries } from "@/lib/query-invalidation";
import type { AggregatedShortageReport } from "@/services/shortage";
import type { ShortageReport } from "@/components/decks/ShortageTable";
import type { DeckCard } from "@/components/decks/DeckList";
import type { DeckSection } from "@ga/contracts";

export interface DeckSummary {
  id: string;
  name: string;
  champion: string;
  format: string;
  section: DeckSection;
  priority: number;
  mainCount: number;
  materialCount: number;
  sideCount: number;
  totalCards: number;
}

export function useDecksSummaryQuery(userId?: string | null) {
  return useQuery<DeckSummary[]>({
    queryKey: deckKeys.list(userId),
    queryFn: async () => {
      const userQuery = userId ? `?userId=${encodeURIComponent(userId)}` : "";
      const res = await fetch(`/api/decks${userQuery}`);
      if (!res.ok) throw new Error("Failed to fetch decks");
      const data = await res.json();
      return Array.isArray(data.decks) ? data.decks : [];
    },
  });
}

export function useAggregatedShortagesQuery(userId?: string | null) {
  return useQuery<AggregatedShortageReport>({
    queryKey: deckKeys.shortages(userId),
    queryFn: async () => {
      const userQuery = userId ? `?userId=${encodeURIComponent(userId)}` : "";
      const res = await fetch(`/api/decks/shortages${userQuery}`);
      if (!res.ok) throw new Error("Failed to fetch shortages");
      return res.json();
    },
  });
}

export interface DeckDetailData {
  deck: {
    id: string;
    name: string;
    champion?: string | null;
    format?: string | null;
    priority?: number | null;
    section?: DeckSection | null;
    userId?: string | null;
    notes?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
  };
  cards: {
    material: DeckCard[];
    main: DeckCard[];
    side: DeckCard[];
  };
  omnidexText: string;
}

export interface DeckDetailPayload {
  notFound: boolean;
  deck: DeckDetailData | null;
  shortage: ShortageReport | null;
  advisorAllowed: boolean;
}

export function useDeckWithShortageQuery(deckId: string, userId?: string | null) {
  return useQuery<DeckDetailPayload>({
    queryKey: [...deckKeys.detail(deckId), { userId: userId ?? null }],
    queryFn: async () => {
      if (!deckId) return { notFound: true, deck: null, shortage: null, advisorAllowed: false };
      const userIdQuery = userId ? `?userId=${encodeURIComponent(userId)}` : "";
      const [deckRes, shortageRes, advisorRes] = await Promise.all([
        fetch(`/api/decks/${deckId}`),
        fetch(`/api/decks/${deckId}/shortage${userIdQuery}`),
        fetch(`/api/decks/${deckId}/advisor`),
      ]);
      if (deckRes.status === 404) {
        return { notFound: true, deck: null, shortage: null, advisorAllowed: false };
      }
      if (!deckRes.ok) throw new Error("Failed to load deck");
      const deckData = await deckRes.json();
      const shortageData = shortageRes.ok ? await shortageRes.json() : null;
      let advisorAllowed = false;
      if (advisorRes.ok) {
        const advData = await advisorRes.json();
        advisorAllowed = Boolean(advData?.allowed);
      }
      return {
        notFound: false,
        deck: deckData,
        shortage: shortageData,
        advisorAllowed,
      };
    },
    enabled: Boolean(deckId),
  });
}

export function useDeckMutations() {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (payload: {
      name: string;
      champion?: string;
      format?: string;
      omnidexText: string;
      userId?: string;
    }) => {
      const res = await fetch("/api/decks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to create deck");
      return data;
    },
    onSuccess: () => invalidateDeckQueries(queryClient),
  });

  const deleteMutation = useMutation({
    mutationFn: async (deckId: string) => {
      const res = await fetch(`/api/decks/${deckId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete deck");
      return res.json();
    },
    onSuccess: () => invalidateDeckQueries(queryClient),
  });

  return {
    createDeck: createMutation.mutateAsync,
    deleteDeck: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
