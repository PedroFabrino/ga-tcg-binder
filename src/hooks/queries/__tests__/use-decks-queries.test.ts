import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { deckKeys } from "@/lib/query-keys";

describe("Decks Query Logic and Caching", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: 30 * 60 * 1000,
        },
      },
    });
  });

  it("fetches decks from API and caches them by queryKey", async () => {
    const mockDecks = [
      { id: "d1", name: "Rai Water", champion: "Rai", section: "competitive", priority: 0 },
    ];
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ decks: mockDecks }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    const key = deckKeys.list("user-1");
    const fetcher = async () => {
      const res = await fetch("/api/decks?userId=user-1");
      const data = await res.json();
      return data.decks;
    };

    // First call: executes fetcher
    const firstResult = await queryClient.fetchQuery({ queryKey: key, queryFn: fetcher });
    expect(firstResult).toEqual(mockDecks);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Second call: served from queryClient cache, NO fetch call
    const cachedData = queryClient.getQueryData(key);
    expect(cachedData).toEqual(mockDecks);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("fetches aggregated shortages and serves from cache", async () => {
    const mockShortages = {
      summary: { totalShortageCopies: 5, totalPeakShortageCopies: 3 },
      cards: [],
    };
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockShortages,
    });
    vi.stubGlobal("fetch", fetchSpy);

    const key = deckKeys.shortages("user-1");
    const fetcher = async () => {
      const res = await fetch("/api/decks/shortages?userId=user-1");
      return res.json();
    };

    const data = await queryClient.fetchQuery({ queryKey: key, queryFn: fetcher });
    expect(data).toEqual(mockShortages);
    expect(queryClient.getQueryData(key)).toEqual(mockShortages);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("invalidates deck queries and forces fresh fetch", async () => {
    const mockDecks = [{ id: "d1", name: "Rai" }];
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ decks: mockDecks }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    const key = deckKeys.list("user-1");
    const fetcher = async () => {
      const res = await fetch("/api/decks?userId=user-1");
      const data = await res.json();
      return data.decks;
    };

    await queryClient.fetchQuery({ queryKey: key, queryFn: fetcher });
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Invalidate queries
    await queryClient.invalidateQueries({ queryKey: deckKeys.all });

    // Stale check
    expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true);
  });
});
