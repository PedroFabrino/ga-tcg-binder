import { describe, it, expect } from "vitest";
import { createTestDb } from "../db/test-utils";
import { users, cards, cardEditions, collectionItems } from "../db/schema";
import {
  seedMetaArchetypes,
  getMetaArchetypes,
  compareMetaDeckAgainstCollection,
} from "./meta";

describe("Tournament Meta Explorer Seam", () => {
  it("seeds meta archetypes and runs shortage comparison against personal collection", async () => {
    const { db } = await createTestDb();

    // 1. Seed user
    await db.insert(users).values({
      id: "u-meta",
      name: "Meta Competitor",
      friendCode: "GA-META1",
      lowPopThreshold: 1000,
    });

    // 2. Insert card in catalog
    await db.insert(cards).values({
      slug: "fracturize",
      name: "Fracturize",
      element: "NORM",
      class: "WARRIOR",
      type: "ACTION",
      subtypes: "[]",
    });

    await db.insert(cardEditions).values({
      id: "ed-frac",
      cardSlug: "fracturize",
      setPrefix: "DOA",
      setName: "Dawn of Ashes",
      collectorNumber: "001",
      rarity: 3,
      imageUrl: "https://example.com/frac.jpg",
    });

    // User owns 2 copies of Fracturize
    await db.insert(collectionItems).values({
      id: "coll-1",
      userId: "u-meta",
      editionId: "ed-frac",
      quantity: 2,
      isDedicated: false,
    });

    // 3. Seed meta archetypes
    await seedMetaArchetypes(db);
    const archetypes = await getMetaArchetypes(db);
    expect(archetypes.length).toBeGreaterThanOrEqual(3);

    const lorraine = archetypes.find((a) => a.id === "meta-lorraine-wind");
    expect(lorraine).toBeDefined();
    expect(lorraine?.tier).toBe("S");

    // 4. Compare Lorraine Wind Warrior against user collection
    // Lorraine uses 4 Fracturize. User owns 2. Shortage should report missing: 2!
    const report = await compareMetaDeckAgainstCollection("meta-lorraine-wind", "u-meta", db);
    expect(report.deckName).toBe("Meta: Lorraine Wind Warrior");

    const fracItem = report.items.find((i) => i.cardSlug === "fracturize");
    expect(fracItem).toBeDefined();
    expect(fracItem?.requiredQuantity).toBe(4);
    expect(fracItem?.availableQuantity).toBe(2);
    expect(fracItem?.missingQuantity).toBe(2);
  });
});
