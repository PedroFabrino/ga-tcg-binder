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
  mypMarketCards,
} from "../db/schema";
import { calculateDeckShortage, calculateAggregatedShortages } from "./shortage";

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
    expect(fracItem?.imageUrl).toBe("https://example.com/frac.jpg");

    // Dispel: required 2, available 1, missing 1
    const dispItem = report1.items.find((i) => i.cardSlug === "dispel");
    expect(dispItem).toBeDefined();
    expect(dispItem?.requiredQuantity).toBe(2);
    expect(dispItem?.availableQuantity).toBe(1);
    expect(dispItem?.missingQuantity).toBe(1);
    expect(dispItem?.imageUrl).toBe("https://example.com/disp.jpg");
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
    expect(gcItem?.imageUrl).toBe("https://example.com/gc.jpg");
    expect(gcItem?.friendsWithIdle).toHaveLength(1);
    expect(gcItem?.friendsWithIdle[0]).toEqual({
      friendId: "bob",
      friendName: "Bob",
      friendCode: "GA-BOB99",
      idleQuantity: 2,
    });
  });

  it("calculates aggregated shortages across all user decks with peak and concurrent shortages", async () => {
    const { db } = await createTestDb();

    await db.insert(users).values({
      id: "u-agg",
      name: "Agg User",
      friendCode: "GA-AGG",
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
        slug: "fireball",
        name: "Fireball",
        element: "FIRE",
        class: "MAGE",
        type: "SPELL",
        subtypes: "[]",
      },
      {
        slug: "covered-card",
        name: "Covered Card",
        element: "WATER",
        class: "MAGE",
        type: "SPELL",
        subtypes: "[]",
      },
    ]);

    await db.insert(cardEditions).values([
      {
        id: "ed-f1",
        cardSlug: "fracturize",
        setPrefix: "DOA",
        setName: "Dawn of Ashes",
        collectorNumber: "001",
        rarity: 1,
        imageUrl: "https://example.com/f1.jpg",
      },
      {
        id: "ed-f2",
        cardSlug: "fracturize",
        setPrefix: "FTC",
        setName: "Fractured Crown",
        collectorNumber: "050",
        rarity: 1,
        imageUrl: "https://example.com/f2.jpg",
      },
      {
        id: "ed-fb",
        cardSlug: "fireball",
        setPrefix: "DOA",
        setName: "Dawn of Ashes",
        collectorNumber: "020",
        rarity: 2,
        imageUrl: "https://example.com/fb.jpg",
      },
      {
        id: "ed-cov",
        cardSlug: "covered-card",
        setPrefix: "DOA",
        setName: "Dawn of Ashes",
        collectorNumber: "030",
        rarity: 1,
        imageUrl: "https://example.com/cov.jpg",
      },
    ]);

    // Inventory:
    // User owns 2 Fracturize (shared)
    // User owns 0 Fireball
    // User owns 4 Covered Card
    await db.insert(collectionItems).values([
      {
        id: "ci-1",
        userId: "u-agg",
        editionId: "ed-f1",
        quantity: 2,
        isDedicated: false,
      },
      {
        id: "ci-2",
        userId: "u-agg",
        editionId: "ed-cov",
        quantity: 4,
        isDedicated: false,
      },
    ]);

    // Decks:
    // Deck A needs: 3 Fracturize, 2 Fireball, 2 Covered Card
    // Deck B needs: 2 Fracturize, 2 Fireball
    await db.insert(decks).values([
      { id: "d-a", userId: "u-agg", name: "Deck A", champion: "Lorraine" },
      { id: "d-b", userId: "u-agg", name: "Deck B", champion: "Rai" },
    ]);

    await db.insert(deckCards).values([
      { id: "dc-a1", deckId: "d-a", cardSlug: "fracturize", zone: "main", quantity: 3 },
      { id: "dc-a2", deckId: "d-a", cardSlug: "fireball", zone: "main", quantity: 2 },
      { id: "dc-a3", deckId: "d-a", cardSlug: "covered-card", zone: "main", quantity: 2 },
      { id: "dc-b1", deckId: "d-b", cardSlug: "fracturize", zone: "main", quantity: 2 },
      { id: "dc-b2", deckId: "d-b", cardSlug: "fireball", zone: "main", quantity: 2 },
    ]);

    const report = await calculateAggregatedShortages("u-agg", db);

    // Summary checks
    expect(report.summary.deckCount).toBe(2);
    // Covered card is completely covered (needed 2 in Deck A, user owns 4), so it should NOT be in shortage!
    expect(report.cards.find((c) => c.cardSlug === "covered-card")).toBeUndefined();

    // Fracturize:
    // Demand: Deck A (3), Deck B (2) -> total demand = 5, peak demand = 3
    // Owned = 2
    // Concurrent missing: 5 - 2 = 3
    // Peak missing: 3 - 2 = 1
    const frac = report.cards.find((c) => c.cardSlug === "fracturize");
    expect(frac).toBeDefined();
    expect(frac?.rarity).toBe(1);
    expect(frac?.totalDemand).toBe(5);
    expect(frac?.peakDemand).toBe(3);
    expect(frac?.totalOwned).toBe(2);
    expect(frac?.concurrentMissing).toBe(3);
    expect(frac?.peakMissing).toBe(1);
    expect(frac?.deckRequirements).toHaveLength(2);
    expect(frac?.editions).toHaveLength(2);
    expect(frac?.editions[0].rarity).toBe(1);

    // Fireball:
    // Demand: Deck A (2), Deck B (2) -> total demand = 4, peak demand = 2
    // Owned = 0
    // Concurrent missing = 4, Peak missing = 2
    const fire = report.cards.find((c) => c.cardSlug === "fireball");
    expect(fire).toBeDefined();
    expect(fire?.rarity).toBe(2);
    expect(fire?.concurrentMissing).toBe(4);
    expect(fire?.peakMissing).toBe(2);

    expect(report.summary.totalShortageCopies).toBe(7); // 3 (frac) + 4 (fireball)
    expect(report.summary.totalPeakShortageCopies).toBe(3); // 1 (frac) + 2 (fireball)
    expect(report.summary.uniqueShortageCards).toBe(2);
  });

  it("attaches marketPriceFairness and marketTcgPrice to deck shortage items", async () => {
    const { db } = await createTestDb();

    await db.insert(users).values({
      id: "u-shortage-fairness",
      name: "Shortage Fairness User",
      friendCode: "GA-SHORT1",
    });

    await db.insert(cards).values({
      slug: "liminal-guide",
      name: "Liminal Guide",
      element: "WIND",
      class: "MAGE",
      type: "ACTION",
      subtypes: "[]",
    });

    await db.insert(decks).values({
      id: "d-fairness",
      userId: "u-shortage-fairness",
      name: "Wind Deck",
      champion: "Arthur",
    });

    await db.insert(deckCards).values({
      id: "dc-lg",
      deckId: "d-fairness",
      cardSlug: "liminal-guide",
      zone: "main",
      quantity: 2,
    });

    // Insert heavily overpriced market row (R$ 400 vs TCG R$ 150 -> 2.67x)
    await db.insert(mypMarketCards).values({
      id: "mkt-lg",
      cardSlug: "liminal-guide",
      rawName: "Liminal Guide",
      cardName: "Liminal Guide",
      setPrefix: "ALC",
      quantity: 1,
      price: "R$ 400,00",
      priceNumeric: 400.0,
      tcgPrice: "R$ 150,00",
      tcgPriceNumeric: 150.0,
      mypProductUrl: "https://mypcards.com/produto/123",
    });

    const report = await calculateDeckShortage("d-fairness", "u-shortage-fairness", db);
    const item = report.items.find((i) => i.cardSlug === "liminal-guide");

    expect(item).toBeDefined();
    expect(item?.marketAvailableCopies).toBe(1);
    expect(item?.marketLowestPriceBrl).toBe(400.0);
    expect(item?.marketTcgPrice).toBe("R$ 150,00");
    expect(item?.marketPriceFairness?.tier).toBe("HEAVILY_OVERPRICED");
    expect(item?.marketPriceFairness?.ratio).toBeCloseTo(2.67, 1);
  });
});

