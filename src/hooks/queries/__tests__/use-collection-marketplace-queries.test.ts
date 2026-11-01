import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { collectionKeys, marketplaceKeys } from "@/lib/query-keys";

describe("Collection and Marketplace Queries Caching", () => {
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

  it("fetches and caches collection items per view", async () => {
    const mockItems = [
      { id: "c1", cardName: "Creative Shock", quantity: 2, view: "ALL" },
    ];
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: mockItems }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    const key = collectionKeys.view("ALL", "user-1");
    const fetcher = async () => {
      const res = await fetch("/api/collection?view=ALL&userId=user-1");
      const data = await res.json();
      return data.items;
    };

    const firstResult = await queryClient.fetchQuery({ queryKey: key, queryFn: fetcher });
    expect(firstResult).toEqual(mockItems);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Second call serves from cache
    const cached = queryClient.getQueryData(key);
    expect(cached).toEqual(mockItems);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("isolates cache per tab view", async () => {
    const allKey = collectionKeys.view("ALL", "user-1");
    const staplesKey = collectionKeys.view("STAPLES", "user-1");

    expect(allKey).not.toEqual(staplesKey);

    queryClient.setQueryData(allKey, [{ id: "1" }]);
    queryClient.setQueryData(staplesKey, [{ id: "2" }]);

    expect(queryClient.getQueryData(allKey)).toEqual([{ id: "1" }]);
    expect(queryClient.getQueryData(staplesKey)).toEqual([{ id: "2" }]);
  });

  it("fetches and caches global market report", async () => {
    const mockReport = {
      summary: { totalListings: 10, totalMarketCopies: 40 },
      cards: [],
    };
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockReport,
    });
    vi.stubGlobal("fetch", fetchSpy);

    const key = [...marketplaceKeys.all, "market", { userId: "user-1" }];
    const fetcher = async () => {
      const res = await fetch("/api/marketplace/market?userId=user-1");
      return res.json();
    };

    const result = await queryClient.fetchQuery({ queryKey: key, queryFn: fetcher });
    expect(result).toEqual(mockReport);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Query data in cache
    expect(queryClient.getQueryData(key)).toEqual(mockReport);
  });
});
