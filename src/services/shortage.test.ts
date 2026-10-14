import { describe, it, expect } from "vitest";
import { createTestDb } from "../db/test-utils";
import {
  users,
  cards,
  cardEditions,
  collectionItems,
  decks,
  deckCards,
  friendLinks,
} from "../db/schema";
import { calculateDeckShortage } from "./shortage";

describe("Shortage Calculation & Friend Idle Discovery Seams", () => {
  it("evaluates deck demand under Shared rules and detects cross-deck contention", async () => {
    const { db } = await createTestDb();

    // Setup User Alice
    await db.insert(users).values({
      id: "alice",
      name: "Alice",
      friendCode: "GA-ALICE",
      lowPopThreshold: 1000,
    });

    // Setup Cards
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
        slug: "dispel",
        name: "Dispel",
        element: "NORM",
        class: "ALL",
        type: "ACTION",
        subtypes: "[]",
      },
    ]);

    // Setup Editions
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
        id: "ed-disp",
        cardSlug: "dispel",
        setPrefix: "DOA",
        setName: "Dawn of Ashes",
        collectorNumber: "002",
        rarity: 2,
        imageUrl: "https://example.com/disp.jpg",
      },
    ]);

    // Alice owns 4 shared copies of Fracturize and 1 copy of Dispel
    await db.insert(collectionItems).values([
      {
        id: "inv-1",
        userId: "alice",
        editionId: "ed-frac",
        quantity: 4,
        isDedicated: false,
      },
      {
        id: "inv-2",
        userId: "alice",
        editionId: "ed-disp",
        quantity: 1,
        isDedicated: false,
      },
    ]);

    // Alice has Deck 1: needs 4 Fracturize, 2 Dispel
    await db.insert(decks).values({
      id: "deck-1",
      userId: "alice",
      name: "Alice Warrior Main",
      champion: "Arthur",
    });

    await db.insert(deckCards).values([
      {
        id: "dc-1",
        deckId: "deck-1",
        cardSlug: "fracturize",
        zone: "main",
        quantity: 4,
      },
      {
        id: "dc-2",
        deckId: "deck-1",
        cardSlug: "dispel",
        zone: "main",
        quantity: 2,
      },
    ]);

    // Alice has Deck 2: also needs 4 Fracturize
    await db.insert(decks).values({
      id: "deck-2",
      userId: "alice",
      name: "Alice Tournament Backup",
      champion: "Arthur",
    });

    await db.insert(deckCards).values({
      id: "dc-3",
      deckId: "deck-2",
      cardSlug: "fracturize",
      zone: "main",
      quantity: 4,
    });

    // Calculate shortage for Deck 1
    const report1 = await calculateDeckShortage("deck-1", "alice", db);

    expect(report1.deckName).toBe("Alice Warrior Main");
    // Fracturize: required 4, available 4, missing 0, isContended true (because Deck 2 also wants 4)
    const fracItem = report1.items.find((i) => i.cardSlug === "fracturize");
    expect(fracItem).toBeDefined();
    expect(fracItem?.requiredQuantity).toBe(4);
    expect(fracItem?.availableQuantity).toBe(4);
    expect(fracItem?.missingQuantity).toBe(0);
    expect(fracItem?.isContended).toBe(true);
    expect(fracItem?.contendingDeckNames).toContain("Alice Tournament Backup");

    // Dispel: required 2, available 1, missing 1
    const dispItem = report1.items.find((i) => i.cardSlug === "dispel");
    expect(dispItem).toBeDefined();
    expect(dispItem?.requiredQuantity).toBe(2);
    expect(dispItem?.availableQuantity).toBe(1);
    expect(dispItem?.missingQuantity).toBe(1);
  });

  it("calculates Friend Idle inventory correctly when cards are missing", async () => {
    const { db } = await createTestDb();

    // Alice and Bob
    await db.insert(users).values([
      {
        id: "alice",
        name: "Alice",
        friendCode: "GA-ALICE",
        lowPopThreshold: 1000,
      },
      {
        id: "bob",
        name: "Bob",
        friendCode: "GA-BOB99",
        lowPopThreshold: 1000,
      },
    ]);

    // Connect Alice & Bob as friends
    await db.insert(friendLinks).values({
      id: "fl-1",
      userId1: "alice",
      userId2: "bob",
      status: "accepted",
    });

    // Card: Grand Crusader
    await db.insert(cards).values({
      slug: "grand-crusader",
      name: "Grand Crusader",
      element: "NORM",
      class: "WARRIOR",
      type: "ALLY",
      subtypes: "[]",
    });

    await db.insert(cardEditions).values({
      id: "ed-gc",
      cardSlug: "grand-crusader",
      setPrefix: "DOA",
      setName: "Dawn of Ashes",
      collectorNumber: "010",
      rarity: 4,
      imageUrl: "https://example.com/gc.jpg",
    });

    // Bob owns 3 copies of Grand Crusader
    await db.insert(collectionItems).values({
      id: "bob-inv-1",
      userId: "bob",
      editionId: "ed-gc",
      quantity: 3,
      isDedicated: false,
    });

    // Bob has an active deck using 1 copy of Grand Crusader (so 3 - 1 = 2 copies are idle!)
    await db.insert(decks).values({
      id: "bob-deck-1",
      userId: "bob",
      name: "Bob's Deck",
      champion: "Lorraine",
    });
    await db.insert(deckCards).values({
      id: "bob-dc-1",
      deckId: "bob-deck-1",
      cardSlug: "grand-crusader",
      zone: "main",
      quantity: 1,
    });

    // Alice builds a deck needing 2 copies of Grand Crusader (Alice owns 0)
    await db.insert(decks).values({
      id: "alice-deck",
      userId: "alice",
      name: "Alice Quest",
    });
    await db.insert(deckCards).values({
      id: "alice-dc-1",
      deckId: "alice-deck",
      cardSlug: "grand-crusader",
      zone: "main",
      quantity: 2,
    });

    const report = await calculateDeckShortage("alice-deck", "alice", db);
    const gcItem = report.items.find((i) => i.cardSlug === "grand-crusader");

    expect(gcItem).toBeDefined();
    expect(gcItem?.missingQuantity).toBe(2);
    expect(gcItem?.friendsWithIdle).toHaveLength(1);
    expect(gcItem?.friendsWithIdle[0]).toEqual({
      friendId: "bob",
      friendName: "Bob",
      friendCode: "GA-BOB99",
      idleQuantity: 2,
    });
  });
});
