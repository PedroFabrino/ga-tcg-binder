import { describe, expect, it } from "vitest";
import { matchesSetChecklistFilters, type SetChecklistCard, type SetChecklistFilters } from "@ga/contracts";

function makeCard(overrides: Partial<SetChecklistCard> = {}): SetChecklistCard {
  return {
    cardSlug: "fireball",
    cardName: "Fireball",
    element: "FIRE",
    class: "Mage",
    type: "action",
    rarity: 3,
    rarities: [3],
    imageUrl: null,
    prefixes: ["DOA 1st", "DOA Alter"],
    ownedQuantity: 2,
    requiredQuantity: 3,
    missingQuantity: 1,
    isShortage: true,
    requiringDeckIds: ["deck-1"],
    ...overrides,
  };
}

function filters(overrides: Partial<SetChecklistFilters> = {}): SetChecklistFilters {
  return {
    prefix: null,
    status: "all",
    element: null,
    rarity: null,
    search: null,
    ...overrides,
  };
}

describe("Set Checklist filter combinations", () => {
  it("matches prefix + shortage status together", () => {
    const card = makeCard({ prefixes: ["DOA 1st"], isShortage: true });
    expect(matchesSetChecklistFilters(card, filters({ prefix: "DOA 1st", status: "shortages" }))).toBe(true);
    expect(matchesSetChecklistFilters(card, filters({ prefix: "DOA Alter", status: "shortages" }))).toBe(false);
    // status "owned" requires ownedQuantity > 0, which the default card has (2)
    expect(matchesSetChecklistFilters(card, filters({ prefix: "DOA 1st", status: "owned" }))).toBe(true);
    // but with the wrong prefix, it fails
    expect(matchesSetChecklistFilters(card, filters({ prefix: "DOA Alter", status: "owned" }))).toBe(false);
  });

  it("matches prefix + unowned status together", () => {
    const card = makeCard({ prefixes: ["DOA 1st"], ownedQuantity: 0 });
    expect(matchesSetChecklistFilters(card, filters({ prefix: "DOA 1st", status: "unowned" }))).toBe(true);
    expect(matchesSetChecklistFilters(card, filters({ prefix: "DOA 1st", status: "owned" }))).toBe(false);
  });

  it("matches prefix + element + rarity combined", () => {
    const card = makeCard({ prefixes: ["DOA 1st"], element: "FIRE", rarity: 3 });
    const f = filters({ prefix: "DOA 1st", element: "FIRE", rarity: 3 });
    expect(matchesSetChecklistFilters(card, f)).toBe(true);

    expect(matchesSetChecklistFilters(card, filters({ prefix: "DOA 1st", element: "WATER", rarity: 3 }))).toBe(false);
    expect(matchesSetChecklistFilters(card, filters({ prefix: "DOA 1st", element: "FIRE", rarity: 2 }))).toBe(false);
    expect(matchesSetChecklistFilters(card, filters({ prefix: "DOA Alter", element: "FIRE", rarity: 3 }))).toBe(false);
  });

  it("matches search + status together", () => {
    const card = makeCard({ cardName: "Fireball", isShortage: true, ownedQuantity: 2 });
    expect(matchesSetChecklistFilters(card, filters({ search: "fire", status: "shortages" }))).toBe(true);
    expect(matchesSetChecklistFilters(card, filters({ search: "ice", status: "shortages" }))).toBe(false);
    // search + owned: card has ownedQuantity: 2, and "fire" matches "Fireball"
    expect(matchesSetChecklistFilters(card, filters({ search: "fire", status: "owned" }))).toBe(true);
    // wrong search → false
    expect(matchesSetChecklistFilters(card, filters({ search: "blizzard", status: "owned" }))).toBe(false);
    // wrong status → false (card has shortage, status is unowned)
    expect(matchesSetChecklistFilters(makeCard({ cardName: "Iceberg", ownedQuantity: 5, isShortage: false }), filters({ search: "ice", status: "unowned" }))).toBe(false);
  });

  it("matches all filters combined", () => {
    const card = makeCard({
      prefixes: ["DOA 1st"],
      element: "WIND",
      rarity: 2,
      rarities: [2],
      cardName: "Gust",
      ownedQuantity: 0,
    });
    const f = filters({
      prefix: "DOA 1st",
      status: "unowned",
      element: "WIND",
      rarity: 2,
      search: "gust",
    });
    expect(matchesSetChecklistFilters(card, f)).toBe(true);
  });

  it("search is case-insensitive", () => {
    const card = makeCard({ cardName: "FIREBALL" });
    expect(matchesSetChecklistFilters(card, filters({ search: "fire" }))).toBe(true);
    expect(matchesSetChecklistFilters(card, filters({ search: "FIRE" }))).toBe(true);
    expect(matchesSetChecklistFilters(card, filters({ search: "Ball" }))).toBe(true);
  });

  it("element comparison is case-insensitive", () => {
    const card = makeCard({ element: "Fire" });
    expect(matchesSetChecklistFilters(card, filters({ element: "FIRE" }))).toBe(true);
    expect(matchesSetChecklistFilters(card, filters({ element: "fire" }))).toBe(true);
  });

  it("null prefix matches all prefixes", () => {
    const card = makeCard({ prefixes: ["DOA 1st", "DOA Alter"] });
    expect(matchesSetChecklistFilters(card, filters({ prefix: null }))).toBe(true);
    expect(matchesSetChecklistFilters(card, filters({ prefix: "DOA 1st" }))).toBe(true);
    expect(matchesSetChecklistFilters(card, filters({ prefix: "DOASD" }))).toBe(false);
  });

  it("owned status requires quantity > 0", () => {
    expect(matchesSetChecklistFilters(makeCard({ ownedQuantity: 5 }), filters({ status: "owned" }))).toBe(true);
    expect(matchesSetChecklistFilters(makeCard({ ownedQuantity: 1 }), filters({ status: "owned" }))).toBe(true);
    expect(matchesSetChecklistFilters(makeCard({ ownedQuantity: 0 }), filters({ status: "owned" }))).toBe(false);
  });
});