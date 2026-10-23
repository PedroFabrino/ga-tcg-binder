import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildDeckLookup,
  normalizeCardName,
  parseOmnidexText,
  resolveDecklist,
  type DeckCatalogCard,
} from "./index";

const fixturePath = fileURLToPath(
  new URL("../../../omnidex_export.txt", import.meta.url)
);

function card(
  name: string,
  level: number | null,
  slug = normalizeCardName(name).replace(/[^a-z0-9]+/g, "-")
): DeckCatalogCard {
  return { name, slug, level };
}

describe("Omnidex deck import", () => {
  it("parses omnidex_export.txt into zones with quantities", () => {
    const parsed = parseOmnidexText(readFileSync(fixturePath, "utf8"));

    expect(parsed.material).toHaveLength(50);
    expect(parsed.main).toHaveLength(162);
    expect(parsed.side).toHaveLength(0);
    expect(parsed.material[0]).toEqual({
      name: "Assassin's Mantle",
      quantity: 2,
      collectorCode: undefined,
    });
    expect(parsed.main).toContainEqual({
      name: "Idle Thoughts",
      quantity: 12,
      collectorCode: undefined,
    });
  });

  it("resolves the first level-0 Material card instead of the first line", () => {
    const parsed = parseOmnidexText(`
# Material Deck
2 Assassin's Mantle
1 Spirit of Slime
1 Silvie, Slime Sovereign

# Main Deck
4 Fracturize
`);
    const lookup = buildDeckLookup([
      card("Assassin's Mantle", null, "assassins-mantle"),
      card("Spirit of Slime", 0),
      card("Silvie, Slime Sovereign", 3),
      card("Fracturize", null),
    ]);

    const resolved = resolveDecklist(parsed, lookup);

    expect(resolved.material[0].card?.slug).toBe("assassins-mantle");
    expect(resolved.champion?.name).toBe("Spirit of Slime");
    expect(resolved.champion?.card?.slug).toBe("spirit-of-slime");
    expect(resolved.warnings).toEqual([]);
  });

  it("resolves the fixture Champion from the level-0 Material card", () => {
    const parsed = parseOmnidexText(readFileSync(fixturePath, "utf8"));
    const levels: Record<string, number | null> = {
      "Assassin's Mantle": null,
      "Spirit of Slime": 0,
      "Spirit of Water": 0,
      "Spirit of Wind": 0,
      "Silvie, Slime Sovereign": 3,
    };
    const lookup = (name: string) => card(name, levels[name] ?? null);
    const resolved = resolveDecklist(parsed, lookup);

    expect(resolved.champion?.name).toBe("Spirit of Slime");
    expect(resolved.warnings).toContainEqual({
      code: "championAmbiguous",
      names: ["Spirit of Slime", "Spirit of Water", "Spirit of Wind"],
    });
  });

  it("returns a champion-less list without inventing a Champion", () => {
    const parsed = parseOmnidexText(`
# Material Deck
2 Assassin's Mantle
1 Bauble of Mending

# Main Deck
4 Fracturize
`);
    const lookup = buildDeckLookup([
      card("Assassin's Mantle", null),
      card("Bauble of Mending", null),
      card("Fracturize", null),
    ]);

    const resolved = resolveDecklist(parsed, lookup);

    expect(resolved.champion).toBeNull();
    expect(resolved.warnings).toContainEqual({ code: "championMissing" });
    expect(resolved.warnings.filter((warning) => warning.code === "unresolvedCard")).toEqual(
      []
    );
  });

  it("returns unresolved names as warnings and keeps their lines", () => {
    const parsed = parseOmnidexText(`
# Material Deck
1 Unknown Champion
1 Spirit of Slime

# Main Deck
4 Unknown Spell
1 Fracturize

# Sideboard
2 Unknown Spell
1 Another Mystery
`);
    const lookup = buildDeckLookup([
      card("Spirit of Slime", 0),
      card("Fracturize", null),
    ]);

    const resolved = resolveDecklist(parsed, lookup);

    expect(resolved.champion?.name).toBe("Spirit of Slime");
    expect(resolved.main.map((entry) => entry.name)).toContain("Unknown Spell");
    expect(resolved.main.find((entry) => entry.name === "Unknown Spell")?.card).toBeNull();
    expect(resolved.material[0].card).toBeNull();
    expect(resolved.warnings).toContainEqual({
      code: "unresolvedCard",
      name: "Unknown Spell",
      zones: ["main", "side"],
      quantity: 6,
    });
    expect(resolved.warnings).toContainEqual({
      code: "unresolvedCard",
      name: "Unknown Champion",
      zones: ["material"],
      quantity: 1,
    });
    expect(resolved.warnings).toContainEqual({
      code: "unresolvedCard",
      name: "Another Mystery",
      zones: ["side"],
      quantity: 1,
    });
  });

  it("decodes entities, strips printing hints and matches accents", () => {
    const parsed = parseOmnidexText(`
# Material Deck
1 Tristan, Shadow&#39;s Stalker (DOA 1st 001)
1 Spirit of Slime

# Main Deck
2x Bloom: Summer’s Glow
`);
    const lookup = buildDeckLookup([
      card("Tristan, Shadow's Stalker", 1),
      card("Spirit of Slime", 0),
      card("Bloom: Summer's Glow", null),
    ]);

    expect(parsed.material[0]).toEqual({
      name: "Tristan, Shadow's Stalker",
      quantity: 1,
      collectorCode: "DOA 1st 001",
    });
    const resolved = resolveDecklist(parsed, lookup);
    expect(resolved.main[0].card?.name).toBe("Bloom: Summer's Glow");
    expect(resolved.warnings).toEqual([]);
  });
});
