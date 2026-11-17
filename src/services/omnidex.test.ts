import { describe, it, expect, vi, afterEach } from "vitest";
import {
  parseOmnidexText,
  serializeOmnidexText,
  serializeShortagesOmnidexText,
  decodeHtmlEntities,
  fetchDeckFromUrl,
} from "./omnidex";

describe("Omnidex Decklist Parser & Serializer", () => {
  it("decodes HTML entities properly in deck names", () => {
    const raw = "2 Jianyu, Fate&#39;s Premonition &amp; &quot;Echoes&quot;";
    expect(decodeHtmlEntities(raw)).toBe('2 Jianyu, Fate\'s Premonition & "Echoes"');
  });

  it("parses standard Omnidex format with material, main, and sideboard sections", () => {
    const rawDeck = `
# Material Deck
1 Starter Water
1 Rayne, Sword of Light (DOA 1st 001)

# Main Deck
4x Fracturize
3 Arcane Disposition [ALC 042]
1 Resplendent Bolt

# Sideboard
2 Dispel
`;

    const parsed = parseOmnidexText(rawDeck);

    expect(parsed.material).toHaveLength(2);
    expect(parsed.material[0]).toEqual({ name: "Starter Water", quantity: 1, collectorCode: undefined });
    expect(parsed.material[1]).toEqual({ name: "Rayne, Sword of Light", quantity: 1, collectorCode: "DOA 1st 001" });

    expect(parsed.main).toHaveLength(3);
    expect(parsed.main[0]).toEqual({ name: "Fracturize", quantity: 4, collectorCode: undefined });
    expect(parsed.main[1]).toEqual({ name: "Arcane Disposition", quantity: 3, collectorCode: "ALC 042" });
    expect(parsed.main[2]).toEqual({ name: "Resplendent Bolt", quantity: 1, collectorCode: undefined });

    expect(parsed.side).toHaveLength(1);
    expect(parsed.side[0]).toEqual({ name: "Dispel", quantity: 2, collectorCode: undefined });
  });

  it("serializes deck structures cleanly into Omnidex format", () => {
    const deck = {
      material: [{ name: "Starter Water", quantity: 1 }],
      main: [
        { name: "Fracturize", quantity: 4 },
        { name: "Dispel", quantity: 2 },
      ],
      side: [{ name: "Prismatic Barrier", quantity: 2 }],
    };

    const text = serializeOmnidexText(deck);
    expect(text).toContain("# Material Deck\n1 Starter Water");
    expect(text).toContain("# Main Deck\n4 Fracturize\n2 Dispel");
    expect(text).toContain("# Sideboard\n2 Prismatic Barrier");

    // Round-trip parse
    const reparsed = parseOmnidexText(text);
    expect(reparsed.material).toEqual(deck.material);
    expect(reparsed.main).toEqual(deck.main);
    expect(reparsed.side).toEqual(deck.side);
  });

  it("decodes HTML entities in card names and champions during parseOmnidexText", () => {
    const rawDeck = `
# Material Deck
1 Tristan, Shadow&#39;s Stalker

# Main Deck
3 Bloom: Summer&#39;s Glow
3 Season&#39;s End
2 Bloom: Winter&#39;s Chill
1 Assassin&#x27;s Ripper
`;

    const parsed = parseOmnidexText(rawDeck);
    expect(parsed.champion).toBe("Tristan, Shadow's Stalker");
    expect(parsed.material[0].name).toBe("Tristan, Shadow's Stalker");
    expect(parsed.main[0].name).toBe("Bloom: Summer's Glow");
    expect(parsed.main[1].name).toBe("Season's End");
    expect(parsed.main[2].name).toBe("Bloom: Winter's Chill");
    expect(parsed.main[3].name).toBe("Assassin's Ripper");
  });

  describe("fetchDeckFromUrl", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("extracts deck structure from Silvie.org / Next.js __NEXT_DATA__ format", async () => {
      const mockNextDataHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>Want V2 by BelielD | Silvie.org</title>
</head>
<body>
  <div id="__next"></div>
  <script id="__NEXT_DATA__" type="application/json">
  {
    "props": {
      "pageProps": {
        "serverSideDeckData": {
          "name": "Want V2",
          "description": "Wantlist",
          "cards": {
            "material": [
              { "name": "Backup Charger", "quantity": 1 },
              { "name": "Quickstep Treads", "quantity": 1 }
            ],
            "main": [
              { "name": "Focusing Round", "quantity": 4 },
              { "name": "Liminal Guide", "quantity": 3 }
            ],
            "sideboard": []
          }
        }
      }
    }
  }
  </script>
</body>
</html>`;

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(mockNextDataHtml, { status: 200, statusText: "OK" })
      );

      const result = await fetchDeckFromUrl("https://build-v2.silvie.org/@BelielD/r2N3u5iSugptasGr0cjh");

      expect(result.name).toBe("Want V2");
      expect(result.champion).toBe("Backup Charger");
      expect(result.decklist).toContain("# Material Deck\n1 Backup Charger\n1 Quickstep Treads");
      expect(result.decklist).toContain("# Main Deck\n4 Focusing Round\n3 Liminal Guide");

      const reparsed = parseOmnidexText(result.decklist);
      expect(reparsed.material).toHaveLength(2);
      expect(reparsed.main).toHaveLength(2);
      expect(reparsed.side).toHaveLength(0);
    });

    it("extracts deck from grandarchivestats textarea format", async () => {
      const mockGasHtml = `
<html>
<head><title>Arthur Water Aggro - Grand Archive</title></head>
<body>
  <textarea id="omnidex-src">
# Material Deck
1 Starter Water

# Main Deck
4 Fracturize
  </textarea>
</body>
</html>`;

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(mockGasHtml, { status: 200, statusText: "OK" })
      );

      const result = await fetchDeckFromUrl("https://grandarchivestats.com/decks/123");
      expect(result.name).toBe("Arthur Water Aggro");
      expect(result.decklist).toContain("1 Starter Water");
      expect(result.decklist).toContain("4 Fracturize");
    });

    it("extracts deck from pre block format", async () => {
      const mockPreHtml = `
<html>
<head><meta property="og:title" content="Rai Lightning Control" /></head>
<body>
  <pre>
# Material Deck
1 Rai, Mana Weaver

# Main Deck
4 Spark
  </pre>
</body>
</html>`;

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(mockPreHtml, { status: 200, statusText: "OK" })
      );

      const result = await fetchDeckFromUrl("https://example.com/deck/rai");
      expect(result.name).toBe("Rai Lightning Control");
      expect(result.champion).toBe("Rai, Mana Weaver");
      expect(result.decklist).toContain("1 Rai, Mana Weaver");
    });

    it("throws an error when HTTP response fails", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response("Not Found", { status: 404, statusText: "Not Found" })
      );

      await expect(
        fetchDeckFromUrl("https://silvie.org/@user/unknown")
      ).rejects.toThrow("Failed to fetch deck from URL (404 Not Found)");
    });

    it("throws an error when no valid deck structure is found", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response("<html><body>No deck here</body></html>", { status: 200, statusText: "OK" })
      );

      await expect(
        fetchDeckFromUrl("https://example.com/not-a-deck")
      ).rejects.toThrow("Could not extract a valid decklist from this URL");
    });
  });

  describe("serializeShortagesOmnidexText", () => {
    it("serializes only items with missingQuantity > 0 across zones and round-trips with parseOmnidexText", () => {
      const text = serializeShortagesOmnidexText([
        { cardName: "Spirit of Fire", cardSlug: "spirit-of-fire", zone: "material", missingQuantity: 1 },
        { cardName: "Backup Charger", cardSlug: "backup-charger", zone: "material", missingQuantity: 0 },
        { cardName: "Fracturize", cardSlug: "fracturize", zone: "main", missingQuantity: 3 },
        { cardName: "Creative Shock", cardSlug: "creative-shock", zone: "main", missingQuantity: 0 },
        { cardName: "Dispel", cardSlug: "dispel", zone: "side", missingQuantity: 2 },
      ]);

      expect(text).toBe(
        [
          "# Material Deck",
          "1 Spirit of Fire",
          "",
          "# Main Deck",
          "3 Fracturize",
          "",
          "# Sideboard",
          "2 Dispel",
        ].join("\n")
      );

      const reparsed = parseOmnidexText(text);
      expect(reparsed.material).toEqual([{ name: "Spirit of Fire", quantity: 1, collectorCode: undefined }]);
      expect(reparsed.main).toEqual([{ name: "Fracturize", quantity: 3, collectorCode: undefined }]);
      expect(reparsed.side).toEqual([{ name: "Dispel", quantity: 2, collectorCode: undefined }]);
    });

    it("omits zone headers for zones that have no shortages", () => {
      const text = serializeShortagesOmnidexText([
        { cardName: "Spirit of Fire", zone: "material", missingQuantity: 0 },
        { cardName: "Fracturize", zone: "main", missingQuantity: 2 },
        { cardName: "Dispel", zone: "sideboard", missingQuantity: 0 },
      ]);

      expect(text).toBe("# Main Deck\n2 Fracturize");
      expect(text).not.toContain("# Material Deck");
      expect(text).not.toContain("# Sideboard");
    });

    it("returns an empty string when all items have zero missingQuantity or the list is empty", () => {
      expect(serializeShortagesOmnidexText([])).toBe("");
      expect(
        serializeShortagesOmnidexText([
          { cardName: "Spirit of Fire", zone: "material", missingQuantity: 0 },
          { cardName: "Fracturize", zone: "main", missingQuantity: 0 },
        ])
      ).toBe("");
    });

    it("falls back to cardSlug when cardName is null or empty", () => {
      const text = serializeShortagesOmnidexText([
        { cardName: null, cardSlug: "arcane-disposition", zone: "main", missingQuantity: 2 },
        { cardName: "   ", cardSlug: "prismatic-barrier", zone: "side", missingQuantity: 1 },
      ]);

      expect(text).toBe("# Main Deck\n2 arcane-disposition\n\n# Sideboard\n1 prismatic-barrier");
    });
  });
});
