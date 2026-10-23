import { describe, expect, it } from "vitest";
import { createIndexedDbDetailCache } from "../card-detail-cache";

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

});