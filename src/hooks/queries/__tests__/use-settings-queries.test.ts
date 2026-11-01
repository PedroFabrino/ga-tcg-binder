import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { settingsKeys } from "@/lib/query-keys";
import { readVendorCapability } from "@/lib/settings-capabilities";
import type { SettingsResponse } from "../use-settings-queries";

describe("Settings and Vendor Capability Caching", () => {
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

  it("stores full SettingsResponse in cache and derives vendor capability via select without corrupting cache", async () => {
    const mockPayload: SettingsResponse = {
      user: {
        id: "usr-1",
        mypUsername: "testvendor",
        hasVendorCapability: true,
        sellerModeEnabled: true,
        lowPopThreshold: 500,
      },
    };

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockPayload,
    });
    vi.stubGlobal("fetch", fetchSpy);

    const key = settingsKeys.current("usr-1");

    // 1. Fetch via base queryFn (same fetcher used by useSettingsQuery)
    const baseFetcher = async (): Promise<SettingsResponse> => {
      const res = await fetch("/api/settings");
      return res.json();
    };

    const initialResult = await queryClient.fetchQuery({
      queryKey: key,
      queryFn: baseFetcher,
    });
    expect(initialResult).toEqual(mockPayload);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // 2. Derive vendor capability using selector
    const cachedData = queryClient.getQueryData<SettingsResponse>(key);
    expect(cachedData).toBeDefined();
    const vendorCapability = readVendorCapability(cachedData);
    expect(vendorCapability).toBe(true);

    // 3. Ensure cache entry is still the full object, NOT a boolean
    const cacheAfter = queryClient.getQueryData<SettingsResponse>(key);
    expect(cacheAfter).toEqual(mockPayload);
    expect(cacheAfter?.user?.mypUsername).toBe("testvendor");
  });
});
