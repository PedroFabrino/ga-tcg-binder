import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb } from "../../db/test-utils";
import {
  users,
  cards,
  cardEditions,
  collectionItems,
  decks,
  deckCards,
  collectorIdentities,
} from "../../db/schema";
import {
  getCollectorDecks,
  getDeckShortages,
  searchCollectorCollection,
  getDeckPartitionedWantlist,
} from "../collector-assistant";

describe("collector-assistant (Tickets 2 & 3: Decks, Shortages, Collection, Wantlist)", () => {
  let db: any;
  const testCollectorId = "user_merlin_789";

  beforeEach(async () => {
    const testDb = await createTestDb();
    db = testDb.db;

    // 1. Seed user
    await db.insert(users).values({
      id: testCollectorId,
      name: "Merlin Ambrosius",
      email: "merlin@camelot.local",
      friendCode: "GA-MERLIN",
      locale: "en",
    });

    // 2. Seed platform identity (Discord)
    await db.insert(collectorIdentities).values({
      id: "ident-discord-merlin",
      collectorId: testCollectorId,
      provider: "discord",
      providerUserId: "112233445566",
      providerUsername: "Merlin#1234",
      linkedAt: new Date(),
    });

    // 3. Seed cards
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
      {
        slug: "flame-blast",
        name: "Flame Blast",
        element: "FIRE",
        class: "MAGE",
        type: "ATTACK",
        subtypes: "[]",
      },
    ]);

    // 4. Seed editions
    await db.insert(cardEditions).values([
      {
        id: "ed-frac-1",
        cardSlug: "fracturize",
        setPrefix: "DOA",
        setName: "Dawn of Ashes",
        collectorNumber: "001",
        rarity: 3,
        imageUrl: "https://example.com/frac.jpg",
      },
      {
        id: "ed-disp-1",
        cardSlug: "dispel",
        setPrefix: "DOA",
        setName: "Dawn of Ashes",
        collectorNumber: "002",
        rarity: 1,
        imageUrl: "https://example.com/disp.jpg",
      },
      {
        id: "ed-flame-1",
        cardSlug: "flame-blast",
        setPrefix: "FTC",
        setName: "Fractured Crown",
        collectorNumber: "010",
        rarity: 2,
        imageUrl: "https://example.com/flame.jpg",
      },
    ]);

    // 5. Seed Decks
    // Deck A: Fire Mage (requires 3 Dispel, 2 Flame Blast) -> total 5 cards
    await db.insert(decks).values({
      id: "deck-fire",
      userId: testCollectorId,
      name: "Arthur Fire Aggro",
      champion: "Rai",
      format: "standard",
    });
    await db.insert(deckCards).values([
      {
        id: "dc-1",
        deckId: "deck-fire",
        cardSlug: "dispel",
        zone: "main",
        quantity: 3,
      },
      {
        id: "dc-2",
        deckId: "deck-fire",
        cardSlug: "flame-blast",
        zone: "main",
        quantity: 2,
      },
    ]);

    // Deck B: Control Deck (requires 2 Dispel, 4 Fracturize) -> total 6 cards
    await db.insert(decks).values({
      id: "deck-control",
      userId: testCollectorId,
      name: "Merlin Control",
      champion: "Merlin",
      format: "standard",
    });
    await db.insert(deckCards).values([
      {
        id: "dc-3",
        deckId: "deck-control",
        cardSlug: "dispel",
        zone: "main",
        quantity: 2,
      },
      {
        id: "dc-4",
        deckId: "deck-control",
        cardSlug: "fracturize",
        zone: "main",
        quantity: 4,
      },
    ]);

    // 6. Seed collection
    // Merlin owns:
    // - 3 Dispel (shared, non-dedicated) -> enough for Deck A (needs 3) AND Deck B (needs 2) individually, but contended (needs 5 total)
    // - 2 Flame Blast (non-dedicated) -> 100% covers Deck A Flame Blast
    // - 1 Fracturize (non-dedicated) -> Deck B needs 4, so Hard Shortage of 3
    await db.insert(collectionItems).values([
      {
        id: "inv-disp",
        userId: testCollectorId,
        editionId: "ed-disp-1",
        foil: false,
        quantity: 3,
        isDedicated: false,
      },
      {
        id: "inv-flame",
        userId: testCollectorId,
        editionId: "ed-flame-1",
        foil: true,
        quantity: 2,
        isDedicated: false,
      },
      {
        id: "inv-frac",
        userId: testCollectorId,
        editionId: "ed-frac-1",
        foil: false,
        quantity: 1,
        isDedicated: false,
      },
    ]);
  });

  describe("getCollectorDecks", () => {
    it("returns summary list with accurate completion percentages and shortage counts", async () => {
      const summaries = await getCollectorDecks(testCollectorId, db);

      expect(summaries).toHaveLength(2);

      const fireDeck = summaries.find((d) => d.id === "deck-fire");
      expect(fireDeck).toBeDefined();
      expect(fireDeck!.name).toBe("Arthur Fire Aggro");
      expect(fireDeck!.champion).toBe("Rai");
      expect(fireDeck!.totalCards).toBe(5);
      expect(fireDeck!.uniqueCards).toBe(2);
      // Fire deck has 0 hard shortages (owns 3 dispel and 2 flame blast), but Dispel is contended with Control Deck
      expect(fireDeck!.hardShortageCount).toBe(0);
      expect(fireDeck!.completionPercentage).toBe(100);
      expect(fireDeck!.sharedShortageCount).toBe(1); // Dispel is contended

      const controlDeck = summaries.find((d) => d.id === "deck-control");
      expect(controlDeck).toBeDefined();
      expect(controlDeck!.totalCards).toBe(6);
      expect(controlDeck!.uniqueCards).toBe(2);
      // Fracturize needs 4, owns 1 -> 3 missing physically -> Hard Shortage!
      expect(controlDeck!.hardShortageCount).toBe(1);
      // Playable: 6 total - 3 hard missing = 3 playable -> 3/6 = 50%
      expect(controlDeck!.completionPercentage).toBe(50);
      expect(controlDeck!.sharedShortageCount).toBe(1); // Dispel is contended
    });
  });

  describe("getDeckShortages", () => {
    it("itemizes Hard Shortages vs Shared Shortages by deck id", async () => {
      const result = await getDeckShortages(testCollectorId, "deck-control", db);

      expect(result.deckName).toBe("Merlin Control");
      expect(result.completionPercentage).toBe(50);
      expect(result.totalHardShortages).toBe(1);
      expect(result.totalSharedShortages).toBe(1);

      // Hard shortage: Fracturize (needs 4, owns 1 -> missing 3)
      const hard = result.hardShortages[0];
      expect(hard.cardSlug).toBe("fracturize");
      expect(hard.requiredQuantity).toBe(4);
      expect(hard.missingQuantity).toBe(3);
      expect(hard.type).toBe("hard");

      // Shared shortage: Dispel (needs 2, owns 3, but Arthur Fire Aggro also needs 3 -> total 5 > 3)
      const shared = result.sharedShortages[0];
      expect(shared.cardSlug).toBe("dispel");
      expect(shared.requiredQuantity).toBe(2);
      expect(shared.competingDecks).toContain("Arthur Fire Aggro");
      expect(shared.type).toBe("shared");
    });

    it("resolves deck by case-insensitive name or partial name", async () => {
      const resultByName = await getDeckShortages(testCollectorId, "arthur fire aggro", db);
      expect(resultByName.deckId).toBe("deck-fire");

      const resultByPartial = await getDeckShortages(testCollectorId, "control", db);
      expect(resultByPartial.deckId).toBe("deck-control");
    });

    it("throws error when deck name does not exist", async () => {
      await expect(getDeckShortages(testCollectorId, "nonexistent deck", db)).rejects.toThrow(
        "Deck not found"
      );
    });
  });

  describe("searchCollectorCollection", () => {
    it("searches binder by card name case-insensitively and returns printings with dedication", async () => {
      const res = await searchCollectorCollection(testCollectorId, "FLAME", db);

      expect(res.cards).toHaveLength(1);
      const card = res.cards[0];
      expect(card.cardSlug).toBe("flame-blast");
      expect(card.cardName).toBe("Flame Blast");
      expect(card.element).toBe("FIRE");
      expect(card.totalOwned).toBe(2);
      expect(card.idleTotal).toBe(2);
      expect(card.dedicatedTotal).toBe(0);

      expect(card.printings).toHaveLength(1);
      const p = card.printings[0];
      expect(p.setPrefix).toBe("FTC");
      expect(p.collectorNumber).toBe("010");
      expect(p.foil).toBe(true);
      expect(p.quantity).toBe(2);
    });
  });

  describe("getDeckPartitionedWantlist", () => {
    it("partitions shortages by active decks", async () => {
      const wantlist = await getDeckPartitionedWantlist(testCollectorId, undefined, db);

      expect(wantlist.decks.length).toBeGreaterThanOrEqual(1);

      const controlGroup = wantlist.decks.find((d) => d.deckId === "deck-control");
      expect(controlGroup).toBeDefined();
      expect(controlGroup!.hardShortages.some((s) => s.cardSlug === "fracturize")).toBe(true);
      expect(controlGroup!.sharedShortages.some((s) => s.cardSlug === "dispel")).toBe(true);

      expect(wantlist.grandTotalHard).toBeGreaterThanOrEqual(1);
    });

    it("filters wantlist by single deck if specified", async () => {
      const wantlist = await getDeckPartitionedWantlist(testCollectorId, "Arthur Fire Aggro", db);

      expect(wantlist.decks).toHaveLength(1);
      expect(wantlist.decks[0].deckId).toBe("deck-fire");
      expect(wantlist.decks[0].hardShortages).toHaveLength(0);
      expect(wantlist.decks[0].sharedShortages).toHaveLength(1);
    });
  });
});
