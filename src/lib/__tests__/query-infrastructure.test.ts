import { describe, it, expect, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import {
  createQueryClient,
  DEFAULT_STALE_TIME_MS,
  DEFAULT_GC_TIME_MS,
} from "../query-client";
import {
  deckKeys,
  collectionKeys,
  catalogKeys,
  metaKeys,
  setsKeys,
  settingsKeys,
  marketplaceKeys,
  friendsKeys,
} from "../query-keys";
import {
  invalidateDeckQueries,
  invalidateCollectionQueries,
} from "../query-invalidation";

describe("TanStack Query Infrastructure", () => {
  it("configures query client with 30-minute staleTime and 60-minute gcTime", () => {
    const client = createQueryClient();
    const defaultOptions = client.getDefaultOptions();

    expect(defaultOptions.queries?.staleTime).toBe(30 * 60 * 1000);
    expect(defaultOptions.queries?.staleTime).toBe(DEFAULT_STALE_TIME_MS);
    expect(defaultOptions.queries?.gcTime).toBe(60 * 60 * 1000);
    expect(defaultOptions.queries?.gcTime).toBe(DEFAULT_GC_TIME_MS);
    expect(defaultOptions.queries?.refetchOnWindowFocus).toBe(false);
  });

  it("produces deterministic and scoped query keys for all domain models", () => {
    expect(deckKeys.all).toEqual(["decks"]);
    expect(deckKeys.list("user-123")).toEqual(["decks", "list", { userId: "user-123" }]);
    expect(deckKeys.shortagesPrefix()).toEqual(["decks", "shortages"]);
    expect(deckKeys.shortages("user-123")).toEqual(["decks", "shortages", { userId: "user-123" }]);
    expect(deckKeys.detail("deck-abc")).toEqual(["decks", "detail", "deck-abc"]);

    expect(collectionKeys.all).toEqual(["collection"]);
    expect(collectionKeys.view("ALL", "user-123")).toEqual([
      "collection",
      "view",
      { view: "ALL", userId: "user-123" },
    ]);

    expect(catalogKeys.list({ query: "Fire", limit: 48 })).toEqual([
      "catalog",
      "list",
      { query: "Fire", limit: 48 },
    ]);

    expect(metaKeys.list("user-123")).toEqual(["meta", "list", { userId: "user-123" }]);
    expect(setsKeys.list("user-123")).toEqual(["sets", "list", { userId: "user-123" }]);
    expect(setsKeys.dashboard("all", "user-123")).toEqual([
      "sets",
      "dashboard",
      { target: "all", userId: "user-123" },
    ]);
    expect(setsKeys.detail("doa", "all", "user-123")).toEqual([
      "sets",
      "detail",
      "doa",
      { target: "all", userId: "user-123" },
    ]);
    expect(settingsKeys.current()).toEqual(["settings", "current", { userId: null }]);
    expect(settingsKeys.current("user-123")).toEqual([
      "settings",
      "current",
      { userId: "user-123" },
    ]);
    expect(marketplaceKeys.fulfillment("open")).toEqual(["marketplace", "fulfillment", "open"]);
    expect(marketplaceKeys.shipping(true)).toEqual([
      "marketplace",
      "shipping",
      { withOrders: true },
    ]);
    expect(friendsKeys.list("user-123")).toEqual(["friends", "list", { userId: "user-123" }]);
  });

  it("invalidates affected query keys on deck mutations", async () => {
    const client = new QueryClient();
    const spy = vi.spyOn(client, "invalidateQueries");

    await invalidateDeckQueries(client);

    expect(spy).toHaveBeenCalledWith({ queryKey: deckKeys.all });
    expect(spy).toHaveBeenCalledWith({ queryKey: metaKeys.all });
    expect(spy).toHaveBeenCalledWith({ queryKey: setsKeys.all });
  });

  it("invalidates affected query keys on collection mutations including user-scoped shortages prefix", async () => {
    const client = new QueryClient();
    const spy = vi.spyOn(client, "invalidateQueries");

    // Seed active query for a specific user
    client.setQueryData(deckKeys.shortages("user-123"), { totalMissing: 5 });
    expect(client.getQueryState(deckKeys.shortages("user-123"))?.isInvalidated).toBeFalsy();

    await invalidateCollectionQueries(client);

    expect(spy).toHaveBeenCalledWith({ queryKey: collectionKeys.all });
    expect(spy).toHaveBeenCalledWith({ queryKey: deckKeys.shortagesPrefix() });
    expect(spy).toHaveBeenCalledWith({ queryKey: metaKeys.all });
    expect(spy).toHaveBeenCalledWith({ queryKey: setsKeys.all });
    expect(spy).toHaveBeenCalledWith({ queryKey: catalogKeys.all });

    // The user-scoped shortages query is matched by prefix and marked invalidated
    expect(client.getQueryState(deckKeys.shortages("user-123"))?.isInvalidated).toBe(true);
  });
});
