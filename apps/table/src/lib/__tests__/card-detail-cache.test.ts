import { describe, expect, it } from "vitest";
import { createIndexedDbDetailCache, createNoopDetailCache } from "../card-detail-cache";

describe("card detail cache", () => {
  it("degrades to a no-op cache when IndexedDB is unavailable", async () => {
    // Vitest runs in Node, where `indexedDB` is not defined.
    expect(typeof indexedDB).toBe("undefined");

    const cache = createIndexedDbDetailCache();
    await cache.set("spirit-of-slime", {
      detail: { name: "Spirit of Slime", slug: "spirit-of-slime", level: 0, editions: [] },
      fetchedAt: 1,
    });
    await expect(cache.get("spirit-of-slime")).resolves.toBeNull();
  });

  it("exposes an explicit no-op cache", async () => {
    const cache = createNoopDetailCache();
    await cache.set("x", {
      detail: { name: "X", slug: "x", level: null, editions: [] },
      fetchedAt: 1,
    });
    await expect(cache.get("x")).resolves.toBeNull();
  });
});