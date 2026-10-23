import { describe, expect, it, vi } from "vitest";
import {
  CARD_API_BASE,
  CARD_CATALOG_TTL_MS,
  CARD_DETAIL_TTL_MS,
  getCardDetail,
  loadCardCatalog,
  mapCardDetail,
  searchCardNames,
  type CardDetailCache,
} from "../card-catalog";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

class FakeStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

function memoryCache(
  initial: Map<string, { detail: ReturnType<typeof mapCardDetail> & object; fetchedAt: number }> = new Map()
): CardDetailCache {
  return {
    get: async (slug) => initial.get(slug) ?? null,
    set: async (slug, value) => {
      initial.set(slug, value);
    },
  };
}

describe("card catalog client", () => {
  it("fetches and caches /cards/all, then reuses the fresh cache", async () => {
    const storage = new FakeStorage();
    const fetcher = vi.fn(async () =>
      jsonResponse([{ name: "Fracturize", slug: "fracturize", uuid: "abc" }])
    );

    const first = await loadCardCatalog(fetcher, storage, 1_000);
    expect(first).toEqual({
      cards: [{ name: "Fracturize", slug: "fracturize", uuid: "abc" }],
      stale: false,
    });
    expect(fetcher).toHaveBeenCalledWith(
      `${CARD_API_BASE}/cards/all`,
      expect.objectContaining({ headers: { Accept: "application/json" } })
    );

    const second = await loadCardCatalog(fetcher, storage, 2_000);
    expect(second.cards).toHaveLength(1);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("falls back to a stale cache when the catalog endpoint fails", async () => {
    const storage = new FakeStorage();
    storage.setItem(
      "gt.card-catalog.v1",
      JSON.stringify({
        fetchedAt: 1,
        cards: [{ name: "Old Card", slug: "old-card" }],
      })
    );
    const fetcher = vi.fn(async () => jsonResponse({ error: "down" }, 503));

    const result = await loadCardCatalog(fetcher, storage, CARD_CATALOG_TTL_MS + 2);
    expect(result).toEqual({ cards: [{ name: "Old Card", slug: "old-card" }], stale: true });
  });

  it("throws when there is no cache and the catalog is unreachable", async () => {
    await expect(
      loadCardCatalog(async () => jsonResponse({ error: "down" }, 503), null, 1)
    ).rejects.toThrow();
  });

  it("ranks prefix and accent-insensitive name matches", () => {
    const cards = [
      { name: "Fracturize", slug: "fracturize" },
      { name: "Bloom: Summer's Glow", slug: "bloom-summers-glow" },
      { name: "Summer's Glow", slug: "summers-glow" },
      { name: "Sílvia, Wilds Whisperer", slug: "silvia-wilds-whisperer" },
    ];

    expect(searchCardNames(cards, "summer").map((card) => card.name)).toEqual([
      "Summer's Glow",
      "Bloom: Summer's Glow",
    ]);
    expect(searchCardNames(cards, "silvia").map((card) => card.name)).toEqual([
      "Sílvia, Wilds Whisperer",
    ]);
    expect(searchCardNames(cards, "  ")).toEqual([]);
  });

  it("fetches card detail by slug and maps the printing shape", async () => {
    const cache = memoryCache();
    const fetcher = vi.fn(async () =>
      jsonResponse({
        data: [
          {
            name: "Spirit of Slime",
            slug: "spirit-of-slime",
            level: 0,
            life: 15,
            types: ["CHAMPION"],
            editions: [
              {
                slug: "spirit-of-slime-doa",
                image: "/cards/images/slime.jpg",
                collector_number: "001",
                rarity: 3,
                set: { prefix: "DOA", name: "Dawn of Ashes" },
              },
            ],
          },
        ],
      })
    );

    const detail = await getCardDetail("spirit-of-slime", fetcher, cache, 100);
    expect(detail).toMatchObject({
      name: "Spirit of Slime",
      slug: "spirit-of-slime",
      level: 0,
      life: 15,
      types: ["CHAMPION"],
    });
    expect(detail?.editions[0]).toMatchObject({
      slug: "spirit-of-slime-doa",
      imageUrl: `${CARD_API_BASE}/cards/images/slime.jpg`,
      setPrefix: "DOA",
      collectorNumber: "001",
    });

    await getCardDetail("spirit-of-slime", fetcher, cache, 200);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("returns stale detail when the detail endpoint fails", async () => {
    const cached = {
      detail: {
        name: "Spirit of Slime",
        slug: "spirit-of-slime",
        level: 0,
        editions: [],
      },
      fetchedAt: 1,
    };
    const cache = memoryCache(new Map([["spirit-of-slime", cached]]));

    const detail = await getCardDetail(
      "spirit-of-slime",
      async () => jsonResponse({ error: "down" }, 503),
      cache,
      CARD_DETAIL_TTL_MS + 2
    );
    expect(detail?.name).toBe("Spirit of Slime");
  });

  it("returns null instead of a different card when the slug does not match", async () => {
    const detail = await getCardDetail(
      "wanted-card",
      async () => jsonResponse({ data: [{ name: "Other Card", slug: "other-card" }] }),
      memoryCache(),
      1
    );
    expect(detail).toBeNull();
  });

  it("rejects a malformed card detail", () => {
    expect(mapCardDetail({ name: "No slug" })).toBeNull();
    expect(mapCardDetail(null)).toBeNull();
  });
});
