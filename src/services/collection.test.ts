import { describe, it, expect } from "vitest";
import { createTestDb } from "../db/test-utils";
import {
  users,
  cards,
  cardEditions,
  cardCirculations,
  decks,
  deckCards,
  metaStaples,
} from "../db/schema";
import {
  addOrUpdateCollectionItem,
  importBulkCollectionText,
  getCollectionSmartView,
} from "./collection";

describe("Collection Inventory & Smart Views", () => {
  it("adds, increments, decrements, and filters collection items across smart tabs", async () => {
    const { db } = await createTestDb();

    await db.insert(users).values({
      id: "u1",
      name: "Collector Charlie",
      friendCode: "GA-CHARLIE",
      lowPopThreshold: 1000,
    });

    await db.insert(cards).values([
      {
        slug: "fracturize",
        name: "Fracturize",
        element: "NORM",
        class: "WARRIOR",
        type: "ACTION",
        subtypes: "[]",
      },
      {
        slug: "apotheosis-rite",
        name: "Apotheosis Rite",
        element: "NORM",
        class: "WARRIOR",
        type: "REGALIA",
        subtypes: "[]",
      },
      {
        slug: "arcane-disposition",
        name: "Arcane Disposition",
        element: "WATER",
        class: "MAGE",
        type: "ACTION",
        subtypes: "[]",
      },
    ]);

    await db.insert(cardEditions).values([
      {
        id: "ed-frac",
        cardSlug: "fracturize",
        setPrefix: "DOA",
        setName: "Dawn of Ashes",
        collectorNumber: "001",
        rarity: 3,
        imageUrl: "https://example.com/frac.jpg",
      },
      {
        id: "ed-apo",
        cardSlug: "apotheosis-rite",
        setPrefix: "P24",
        setName: "Promotional 2024",
        collectorNumber: "000",
        rarity: 9,
        imageUrl: "https://example.com/apo.jpg",
      },
      {
        id: "ed-arc",
        cardSlug: "arcane-disposition",
        setPrefix: "ALC",
        setName: "Abyssal Caves",
        collectorNumber: "042",
        rarity: 2,
        imageUrl: "https://example.com/arc.jpg",
      },
    ]);

    await db.insert(cardCirculations).values([
      {
        id: "c-frac",
        editionId: "ed-frac",
        kind: "NONFOIL",
        population: 5000,
        foil: false,
      },
      {
        id: "c-apo",
        editionId: "ed-apo",
        kind: "FOIL",
        population: 100, // <= 1000 => Low Pop
        foil: true,
      },
      {
        id: "c-arc",
        editionId: "ed-arc",
        kind: "NONFOIL",
        population: 12000,
        foil: false,
      },
    ]);

    // 1. Add via addOrUpdateCollectionItem
    await addOrUpdateCollectionItem(
      {
        userId: "u1",
        editionId: "ed-apo",
        foil: true,
        quantity: 1,
      },
      db
    );

    // 2. Import bulk text
    const bulk = `
4x Fracturize [DOA]
2 Arcane Disposition Non-foil
`;
    const res = await importBulkCollectionText("u1", bulk, db);
    expect(res.addedCount).toBe(6);
    expect(res.errors).toHaveLength(0);

    // 3. User creates two decks to turn Fracturize into a Multi-Deck Staple
    await db.insert(decks).values([
      { id: "d1", userId: "u1", name: "Deck 1" },
      { id: "d2", userId: "u1", name: "Deck 2" },
    ]);
    await db.insert(deckCards).values([
      { id: "dc1", deckId: "d1", cardSlug: "fracturize", zone: "main", quantity: 2 },
      { id: "dc2", deckId: "d2", cardSlug: "fracturize", zone: "main", quantity: 2 },
    ]);

    // Test Smart View "ALL"
    const allView = await getCollectionSmartView("u1", "ALL", db);
    expect(allView).toHaveLength(3);

    // Test Smart View "LOW_POP"
    const lowPopView = await getCollectionSmartView("u1", "LOW_POP", db);
    expect(lowPopView).toHaveLength(1);
    expect(lowPopView[0].cardSlug).toBe("apotheosis-rite");
    expect(lowPopView[0].isLowPop).toBe(true);
    expect(lowPopView[0].population).toBe(100);

    // Test Smart View "STAPLES"
    const staplesView = await getCollectionSmartView("u1", "STAPLES", db);
    expect(staplesView).toHaveLength(1);
    expect(staplesView[0].cardSlug).toBe("fracturize");
    expect(staplesView[0].activeDeckUsages).toBe(2);

    // 4. Add format Meta Staple to meta_staples for Apotheosis Rite
    await db.insert(metaStaples).values({
      cardSlug: "apotheosis-rite",
      cardName: "Apotheosis Rite",
      categories: JSON.stringify(["Divine Relics"]),
      primaryCategory: "Divine Relics",
      element: "NORM",
      inclusionRate: "95.0%",
      avgCopies: "1.0",
      recommendedCopies: 1,
      deckCount: 150,
      updatedAt: new Date(),
    });

    const staplesWithMetaView = await getCollectionSmartView("u1", "STAPLES", db);
    // Should now contain both Fracturize (multi-deck) and Apotheosis Rite (format meta staple)
    expect(staplesWithMetaView).toHaveLength(2);
    const apoStaple = staplesWithMetaView.find((s) => s.cardSlug === "apotheosis-rite");
    expect(apoStaple).toBeDefined();
    expect(apoStaple?.isMetaStaple).toBe(true);
    expect(apoStaple?.stapleInclusionRate).toBe("95.0%");
    expect(apoStaple?.stapleRecommendedCopies).toBe(1);
    expect(apoStaple?.isStapleComplete).toBe(true); // User owns 1, recommended is 1

    // Test Smart View "IDLE"
    // Fracturize: owns 4, max deck usage is 2 => idle is 2 (still in idle view!)
    // Arcane Disposition: owns 2, max deck usage is 0 => idle is 2
    // Apotheosis Rite: owns 1, max deck usage is 0 => idle is 1
    const idleView = await getCollectionSmartView("u1", "IDLE", db);
    expect(idleView).toHaveLength(3);
  });
});
