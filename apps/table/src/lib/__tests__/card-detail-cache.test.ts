import { afterEach, describe, expect, it, vi } from "vitest";
import { createIndexedDbDetailCache } from "../card-detail-cache";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("card detail cache", () => {
  it("degrades observably to a no-op cache when IndexedDB is unavailable", async () => {
    // Vitest runs in Node, where `indexedDB` is not defined.
    expect(typeof indexedDB).toBe("undefined");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const cache = createIndexedDbDetailCache();
    await cache.set("spirit-of-slime", {
      detail: { name: "Spirit of Slime", slug: "spirit-of-slime", level: 0, editions: [] },
      fetchedAt: 1,
    });
    await expect(cache.get("spirit-of-slime")).resolves.toBeNull();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("IndexedDB unavailable")
    );
  });
});
