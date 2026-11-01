import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { catalogKeys, metaKeys, setsKeys, settingsKeys } from "@/lib/query-keys";
import { applyHiddenFlag } from "@/lib/sets-view";
import type { SetsDashboardData } from "../use-sets-queries";

describe("Catalog, Meta, Sets, and Settings Queries Caching", () => {
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

  it("caches catalog search queries based on query parameters", async () => {
    const mockCatalog = {
      cards: [{ slug: "fire-ball", name: "Fire Ball" }],
      total: 1,
    };
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockCatalog,
    });
    vi.stubGlobal("fetch", fetchSpy);

    const params = { query: "fire", element: "FIRE", limit: 48 };
    const key = catalogKeys.list(params);

    const result = await queryClient.fetchQuery({
      queryKey: key,
      queryFn: async () => {
        const res = await fetch("/api/catalog?query=fire&element=FIRE&limit=48");
        return res.json();
      },
    });

    expect(result).toEqual(mockCatalog);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // From cache
    const cached = queryClient.getQueryData(key);
    expect(cached).toEqual(mockCatalog);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("caches meta archetypes per user", async () => {
    const mockMeta = {
      archetypes: [{ id: "arch-1", name: "Rai Fire", tier: "Tier 1" }],
      recommendedArchetypes: [],
    };
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockMeta,
    });
    vi.stubGlobal("fetch", fetchSpy);

    const key = metaKeys.list("user-42");
    const result = await queryClient.fetchQuery({
      queryKey: key,
      queryFn: async () => {
        const res = await fetch("/api/meta?userId=user-42");
        return res.json();
      },
    });

    expect(result).toEqual(mockMeta);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Cache verification
    expect(queryClient.getQueryData(key)).toEqual(mockMeta);
  });

  it("caches sets dashboard and checklist queries with target keys", async () => {
    const mockDashboard = {
      groups: [{ groupUuid: "g1", name: "Dawn of Ashes" }],
      availableDecks: [],
      hasPersonalWants: false,
    };
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockDashboard,
    });
    vi.stubGlobal("fetch", fetchSpy);

    const dashboardKey = setsKeys.dashboard("all", "user-42");
    const result = await queryClient.fetchQuery({
      queryKey: dashboardKey,
      queryFn: async () => {
        const res = await fetch("/api/sets");
        return res.json();
      },
    });

    expect(result).toEqual(mockDashboard);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Checklist query key distinct
    const checklistKey = setsKeys.detail("doa", "all", "user-42");
    expect(dashboardKey).not.toEqual(checklistKey);
  });

  it("updates sets dashboard cache directly on toggle hide mutation", async () => {
    const initialDashboard: SetsDashboardData = {
      groups: [
        {
          groupUuid: "g1",
          groupName: "Dawn of Ashes",
          slug: "doa",
          imageUrl: null,
          sortOrder: 1,
          hardShortageCopies: 0,
          sharedShortageCopies: 0,
          totalShortageCopies: 0,
          uniqueShortageCards: 0,
          impactedDecks: 0,
          ownedCards: 50,
          totalCards: 100,
          completionPercent: 50,
          releaseDate: "2023-04-28",
          childPrefixes: ["DOA"],
          category: "booster",
          isHidden: false,
        },
      ],
      availableDecks: [],
      hasPersonalWants: false,
    };

    const key = setsKeys.dashboard("all", "user-42");
    queryClient.setQueryData(key, initialDashboard);

    // Perform optimistic cache update
    const previous = queryClient.getQueryData<SetsDashboardData>(key);
    expect(previous?.groups[0].isHidden).toBe(false);

    queryClient.setQueryData<SetsDashboardData>(key, {
      ...previous!,
      groups: applyHiddenFlag(previous!.groups, "g1", true),
    });

    // Check that cache now retains isHidden: true
    const updated = queryClient.getQueryData<SetsDashboardData>(key);
    expect(updated?.groups[0].isHidden).toBe(true);

    // Rollback check
    queryClient.setQueryData(key, previous);
    expect(queryClient.getQueryData<SetsDashboardData>(key)?.groups[0].isHidden).toBe(false);
  });

  it("caches settings query and allows immediate retrieval", async () => {
    const mockSettings = {
      user: {
        lowPopThreshold: 500,
        friendCode: "FC-1234",
        sellerModeEnabled: true,
      },
    };
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockSettings,
    });
    vi.stubGlobal("fetch", fetchSpy);

    const key = settingsKeys.current("user-42");
    const result = await queryClient.fetchQuery({
      queryKey: key,
      queryFn: async () => {
        const res = await fetch("/api/settings");
        return res.json();
      },
    });

    expect(result).toEqual(mockSettings);
    expect(queryClient.getQueryData(key)).toEqual(mockSettings);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
