import { describe, it, expect } from "vitest";
import { filterCollectionItems } from "./filter";
import type { CollectionItem } from "./types";

const mockItems: CollectionItem[] = [
  {
    id: "1",
    editionId: "ed-1",
    cardSlug: "fracturize",
    cardName: "Fracturize",
    element: "NORM",
    class: "WARRIOR",
    type: "ACTION",
    setPrefix: "DOA",
    setName: "Dawn of Asteria",
    collectorNumber: "001",
    rarity: 1,
    imageUrl: "/cards/fracturize.png",
    foil: false,
    quantity: 4,
    isDedicated: false,
    population: 5000,
    isLowPop: false,
    activeDeckUsages: 1,
    idleQuantity: 3,
  },
  {
    id: "2",
    editionId: "ed-2",
    cardSlug: "rayne-sword-of-light",
    cardName: "Rayne, Sword of Light",
    element: "WIND",
    class: "WARRIOR",
    type: "CHAMPION",
    setPrefix: "DOA",
    setName: "Dawn of Asteria",
    collectorNumber: "042",
    rarity: 3,
    imageUrl: "/cards/rayne.png",
    foil: true,
    quantity: 1,
    isDedicated: true,
    population: 150,
    isLowPop: true,
    activeDeckUsages: 1,
    idleQuantity: 0,
  },
  {
    id: "3",
    editionId: "ed-3",
    cardSlug: "beseech-the-winds",
    cardName: "Beseech the Winds",
    element: "WIND",
    class: "MAGE",
    type: "SPELL",
    setPrefix: "FTC",
    setName: "Fractured Crown",
    collectorNumber: "105",
    rarity: 2,
    imageUrl: "/cards/beseech.png",
    foil: false,
    quantity: 2,
    isDedicated: false,
    population: 1200,
    isLowPop: false,
    activeDeckUsages: 0,
    idleQuantity: 2,
  },
];

describe("filterCollectionItems", () => {
  it("returns all items when query is empty or whitespace", () => {
    expect(filterCollectionItems(mockItems, "")).toHaveLength(3);
    expect(filterCollectionItems(mockItems, "   ")).toHaveLength(3);
  });

  it("filters by partial card name (case-insensitive)", () => {
    const res = filterCollectionItems(mockItems, "fract");
    expect(res).toHaveLength(1);
    expect(res[0].cardName).toBe("Fracturize");

    const rayneRes = filterCollectionItems(mockItems, "RAYNE");
    expect(rayneRes).toHaveLength(1);
    expect(rayneRes[0].cardName).toBe("Rayne, Sword of Light");
  });

  it("filters by set prefix", () => {
    const res = filterCollectionItems(mockItems, "ftc");
    expect(res).toHaveLength(1);
    expect(res[0].cardName).toBe("Beseech the Winds");

    const doaRes = filterCollectionItems(mockItems, "DOA");
    expect(doaRes).toHaveLength(2);
  });

  it("filters by collector number", () => {
    const res = filterCollectionItems(mockItems, "042");
    expect(res).toHaveLength(1);
    expect(res[0].cardName).toBe("Rayne, Sword of Light");
  });

  it("filters by combined set and collector number", () => {
    const res1 = filterCollectionItems(mockItems, "DOA #001");
    expect(res1).toHaveLength(1);
    expect(res1[0].cardName).toBe("Fracturize");

    const res2 = filterCollectionItems(mockItems, "DOA 042");
    expect(res2).toHaveLength(1);
    expect(res2[0].cardName).toBe("Rayne, Sword of Light");
  });

  it("returns empty array when no cards match", () => {
    const res = filterCollectionItems(mockItems, "NonexistentCard123");
    expect(res).toHaveLength(0);
  });
});
