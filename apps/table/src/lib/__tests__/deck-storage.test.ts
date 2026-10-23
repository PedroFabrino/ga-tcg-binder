import { describe, expect, it } from "vitest";
import type { CardDetailCache, CardName } from "../card-catalog";
import {
  clearDeck,
  importDeck,
  readDeck,
  saveDeck,
  searchDeck,
  type DeckStorage,
  type StoredDeck,
} from "../deck-storage";

class FakeStorage implements DeckStorage {
  readonly values = new Map<string, string>();
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
}

function memoryCache(): CardDetailCache {
  const values = new Map<string, Awaited<ReturnType<CardDetailCache["get"]>>>();
  return {
    get: async (slug) => values.get(slug) ?? null,
    set: async (slug, value) => {
      values.set(slug, value);
    },
  };
}

const catalog: CardName[] = [
  { name: "Assassin's Mantle", slug: "assassins-mantle" },
  { name: "Spirit of Slime", slug: "spirit-of-slime" },
  { name: "Silvie, Slime Sovereign", slug: "silvie-slime-sovereign" },
  { name: "Fracturize", slug: "fracturize" },
];

function detailFetcher() {
  return async (input: string) => {
    const slug = new URL(input).searchParams.get("slug");
    const levels: Record<string, number | null> = {
      "assassins-mantle": null,
      "spirit-of-slime": 0,
      "silvie-slime-sovereign": 3,
      "fracturize": null,
    };
    return new Response(
      JSON.stringify({
        data: [
          {
            name: catalog.find((card) => card.slug === slug)?.name ?? slug,
            slug,
            level: levels[slug ?? ""] ?? null,
            editions:
              slug === "spirit-of-slime"
                ? [{ slug: "spirit-of-slime-doa", image: "/cards/images/slime.jpg" }]
                : [],
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  };
}

describe("deck storage", () => {
  it("round-trips a stored deck and clears it", () => {
    const storage = new FakeStorage();
    const deck = {
      version: 1 as const,
      rawText: "# Main Deck\n4 Fracturize",
      importedAt: 1,
      main: [{ name: "Fracturize", quantity: 4, card: { name: "Fracturize", slug: "fracturize" } }],
      material: [],
      side: [],
      champion: null,
      warnings: [],
    } satisfies StoredDeck;

    saveDeck("abc123", "p1", deck, storage);
    expect(readDeck("abc123", "p1", storage)).toEqual(deck);
    expect(readDeck("ABC123", "p2", storage)).toBeNull();

    clearDeck("abc123", "p1", storage);
    expect(readDeck("abc123", "p1", storage)).toBeNull();
  });

  it("ignores corrupt storage", () => {
    const storage = new FakeStorage();
    storage.setItem("gt.deck.ABC123.p1", "not json");
    expect(readDeck("ABC123", "p1", storage)).toBeNull();
  });

  it("imports through the catalog, fetches Material details and picks level 0", async () => {
    const deck = await importDeck(
      `# Material Deck
2 Assassin's Mantle
1 Spirit of Slime
1 Silvie, Slime Sovereign

# Main Deck
4 Fracturize
1 Unknown Card`,
      {
        cards: catalog,
        fetcher: detailFetcher(),
        detailCache: memoryCache(),
        now: 123,
      }
    );

    expect(deck.importedAt).toBe(123);
    expect(deck.champion?.name).toBe("Spirit of Slime");
    expect(deck.champion?.card?.level).toBe(0);
    expect(deck.champion?.card?.editions?.[0].slug).toBe("spirit-of-slime-doa");
    expect(deck.main[0]).toMatchObject({
      name: "Fracturize",
      quantity: 4,
      card: { slug: "fracturize" },
    });
    expect(deck.warnings).toContainEqual({
      code: "unresolvedCard",
      name: "Unknown Card",
      zones: ["main"],
      quantity: 1,
    });
  });

  it("searches the imported deck before the global catalog", async () => {
    const deck = await importDeck(
      `# Material Deck
1 Spirit of Slime

# Main Deck
4 Fracturize
2 Fracturize`,
      {
        cards: catalog,
        fetcher: detailFetcher(),
        detailCache: memoryCache(),
        now: 1,
      }
    );

    expect(searchDeck(deck, "fract").map((entry) => entry.name)).toEqual(["Fracturize"]);
    expect(searchDeck(deck, "zzz")).toEqual([]);
    expect(searchDeck(null, "fract")).toEqual([]);
  });
});
