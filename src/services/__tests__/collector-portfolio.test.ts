import { describe, expect, it, beforeEach } from "vitest";
import { createTestDb } from "../../db/test-utils";
import { users, cards, cardEditions, collectionItems } from "../../db/schema";
import { getCollectorPortfolioSummary } from "../collector-portfolio";

describe("collector-portfolio", () => {
  let db: any;
  const testCollectorId = "user_portfolio_tester";

  beforeEach(async () => {
    const testDb = await createTestDb();
    db = testDb.db;

    await db.insert(users).values({
      id: testCollectorId,
      name: "Galahad",
      email: "galahad@camelot.local",
      friendCode: "GA-GALA01",
      locale: "en",
    });

    await db.insert(cards).values([
      {
        slug: "fire-blast",
        name: "Fire Blast",
        element: "fire",
        class: "mage",
        type: "action",
      },
      {
        slug: "water-barrier",
        name: "Water Barrier",
        element: "water",
        class: "warrior",
        type: "attack",
      },
    ]);

    await db.insert(cardEditions).values([
      {
        id: "ed_fire_1",
        cardSlug: "fire-blast",
        setPrefix: "DOA",
        setName: "Dawn of Ashes",
        collectorNumber: "001",
        rarity: 1,
        imageUrl: "https://images.ga.local/doa-001.png",
      },
      {
        id: "ed_water_1",
        cardSlug: "water-barrier",
        setPrefix: "DOA",
        setName: "Dawn of Ashes",
        collectorNumber: "002",
        rarity: 2,
        imageUrl: "https://images.ga.local/doa-002.png",
      },
    ]);
  });

  it("calculates accurate summary for empty binder", async () => {
    const summary = await getCollectorPortfolioSummary(testCollectorId, db);

    expect(summary.collectorId).toBe(testCollectorId);
    expect(summary.collectorName).toBe("Galahad");
    expect(summary.friendCode).toBe("GA-GALA01");
    expect(summary.totalCards).toBe(0);
    expect(summary.uniqueCards).toBe(0);
    expect(summary.foilCards).toBe(0);
    expect(summary.normalCards).toBe(0);
    expect(summary.dedicatedCards).toBe(0);
    expect(summary.idleCards).toBe(0);
    expect(summary.elements).toEqual([]);
    expect(summary.profileUrl).toContain("/u/GA-GALA01");
  });

  it("calculates accurate totals, foils, dedication and elements for populated binder", async () => {
    await db.insert(collectionItems).values([
      // 3 normal Fire Blast (dedicated)
      {
        id: "item_1",
        userId: testCollectorId,
        editionId: "ed_fire_1",
        foil: false,
        quantity: 3,
        isDedicated: true,
      },
      // 1 foil Fire Blast (idle)
      {
        id: "item_2",
        userId: testCollectorId,
        editionId: "ed_fire_1",
        foil: true,
        quantity: 1,
        isDedicated: false,
      },
      // 2 foil Water Barrier (idle)
      {
        id: "item_3",
        userId: testCollectorId,
        editionId: "ed_water_1",
        foil: true,
        quantity: 2,
        isDedicated: false,
      },
    ]);

    const summary = await getCollectorPortfolioSummary(testCollectorId, db);

    expect(summary.totalCards).toBe(6);
    expect(summary.uniqueCards).toBe(2);
    expect(summary.foilCards).toBe(3); // 1 + 2
    expect(summary.normalCards).toBe(3);
    expect(summary.dedicatedCards).toBe(3);
    expect(summary.idleCards).toBe(3); // 1 + 2

    expect(summary.elements).toEqual([
      { element: "fire", count: 4 },
      { element: "water", count: 2 },
    ]);
  });
});
