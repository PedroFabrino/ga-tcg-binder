import { describe, expect, it } from "vitest";
import {
  exportCollectionToOmnidex,
  exportCollectionToCsv,
} from "../collection-export";
import type { CollectionItem } from "@/components/collection/types";

function makeItem(overrides: Partial<CollectionItem> = {}): CollectionItem {
  return {
    id: "item-1",
    editionId: "ed-1",
    cardSlug: "fracturize",
    cardName: "Fracturize",
    element: "NORM",
    class: "WARRIOR",
    type: "ACTION",
    setPrefix: "DOA",
    setName: "Dawn of Ashes",
    collectorNumber: "001",
    rarity: 1,
    imageUrl: "https://example.com/fracturize.jpg",
    foil: false,
    quantity: 4,
    isDedicated: false,
    population: 1000,
    isLowPop: false,
    activeDeckUsages: 1,
    idleQuantity: 3,
    ...overrides,
  };
}

describe("collection-export helpers", () => {
  describe("exportCollectionToOmnidex", () => {
    it("serializes items with printing details by default", () => {
      const items: CollectionItem[] = [
        makeItem({ cardName: "Fracturize", quantity: 4, setPrefix: "DOA", collectorNumber: "001", foil: false }),
        makeItem({ id: "item-2", cardName: "Creative Shock", quantity: 2, setPrefix: "FTC", collectorNumber: "042", foil: true }),
      ];

      const text = exportCollectionToOmnidex(items);
      expect(text).toBe("4x Fracturize [DOA 001]\n2x Creative Shock [FTC 042 Foil]");
    });

    it("serializes items in standard format without printings when option is disabled", () => {
      const items: CollectionItem[] = [
        makeItem({ cardName: "Fracturize", quantity: 4, foil: false }),
        makeItem({ id: "item-2", cardName: "Creative Shock", quantity: 2, foil: true }),
      ];

      const text = exportCollectionToOmnidex(items, { includePrintings: false });
      expect(text).toBe("4x Fracturize\n2x Creative Shock (Foil)");
    });

    it("skips items with 0 quantity", () => {
      const items: CollectionItem[] = [
        makeItem({ cardName: "Fracturize", quantity: 0 }),
        makeItem({ id: "item-2", cardName: "Creative Shock", quantity: 3 }),
      ];

      const text = exportCollectionToOmnidex(items);
      expect(text).toBe("3x Creative Shock [DOA 001]");
    });
  });

  describe("exportCollectionToCsv", () => {
    it("produces RFC-4180 CSV with correct headers and escaping", () => {
      const items: CollectionItem[] = [
        makeItem({
          cardName: 'Galahad, "Pure Heart"',
          quantity: 3,
          foil: true,
          setPrefix: "DOA",
          setName: "Dawn of Ashes",
          collectorNumber: "015",
          rarity: 3,
          element: "LUXEM",
          class: "GUARDIAN",
          type: "RESERVE",
          isDedicated: true,
          editionId: "ed-100",
        }),
      ];

      const csv = exportCollectionToCsv(items);
      const lines = csv.split("\r\n");

      expect(lines[0]).toBe("Card Name,Quantity,Finish,Set Code,Set Name,Collector Number,Rarity,Element,Class,Type,Dedicated,Edition ID");
      expect(lines[1]).toBe('"Galahad, ""Pure Heart""",3,Foil,DOA,Dawn of Ashes,015,3,LUXEM,GUARDIAN,RESERVE,Yes,ed-100');
    });

    it("skips items with zero quantity in CSV output", () => {
      const items: CollectionItem[] = [
        makeItem({ cardName: "Zero Card", quantity: 0 }),
        makeItem({ cardName: "Valid Card", quantity: 1 }),
      ];

      const csv = exportCollectionToCsv(items);
      const lines = csv.split("\r\n");

      expect(lines.length).toBe(2);
      expect(lines[1]).toContain("Valid Card");
    });
  });
});
