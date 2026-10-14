import { describe, it, expect } from "vitest";
import { createTestDb } from "./test-utils";
import { users, cards, cardEditions, cardCirculations, collectionItems } from "./schema";

describe("Database Schema & Test Environment", () => {
  it("initializes in-memory database and creates all tables", async () => {
    const { db } = await createTestDb();

    // Insert user
    await db.insert(users).values({
      id: "user-1",
      name: "Collector Alice",
      email: "alice@example.com",
      friendCode: "GA-ALICE1",
      lowPopThreshold: 1000,
    });

    // Insert card
    await db.insert(cards).values({
      slug: "fracturize",
      name: "Fracturize",
      element: "NORM",
      class: "WARRIOR",
      type: "ACTION",
      subtypes: JSON.stringify(["SKILL"]),
    });

    // Insert edition
    await db.insert(cardEditions).values({
      id: "ed-1",
      cardSlug: "fracturize",
      setPrefix: "DOA",
      setName: "Dawn of Ashes",
      collectorNumber: "001",
      rarity: 3,
      imageUrl: "https://api.gatcg.com/cards/images/test.jpg",
    });

    // Insert circulation
    await db.insert(cardCirculations).values({
      id: "circ-1",
      editionId: "ed-1",
      kind: "NONFOIL",
      population: 450,
      foil: false,
    });

    // Insert collection item
    await db.insert(collectionItems).values({
      id: "item-1",
      userId: "user-1",
      editionId: "ed-1",
      foil: false,
      quantity: 4,
      isDedicated: false,
    });

    const userRows = await db.select().from(users);
    expect(userRows).toHaveLength(1);
    expect(userRows[0].name).toBe("Collector Alice");

    const collRows = await db.select().from(collectionItems);
    expect(collRows).toHaveLength(1);
    expect(collRows[0].quantity).toBe(4);
  });
});
