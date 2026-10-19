import { describe, it, expect } from "vitest";
import { parseOmnidexText, serializeOmnidexText, decodeHtmlEntities } from "./omnidex";

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
});
