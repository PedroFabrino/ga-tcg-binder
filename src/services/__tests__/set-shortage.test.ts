import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "../../db/test-utils";
import { cards, cardEditions, users, decks, deckCards, collectionItems } from "../../db/schema";
import { featuredSetGroups, setDefinitions } from "../../db/featured-set-schema";
import {
  calculateFeaturedSetSummaries,
  getSetGroupChecklistReport,
  toggleUserSetHidden,
  SetGroupNotFoundError,
} from "../set-shortage";
import type { SetChecklistCard } from "@ga/contracts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- test db convenience
let db: any;

describe("set-shortage", () => {
  beforeEach(async () => {
    const testDb = await createTestDb();
    db = testDb.db;
  });

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------
  async function seedUser() {
    await db.insert(users).values({
      id: "user-1", name: "Alex", friendCode: "GA-ALEX01",
    });
  }

  async function seedCards() {
    await db.insert(cards).values([
      { slug: "fire-slash", name: "Fire Slash", element: "FIRE", class: "MAGE", type: "ACTION" },
      { slug: "water-bolt", name: "Water Bolt", element: "WATER", class: "TAMER", type: "ACTION" },
      { slug: "earth-shield", name: "Earth Shield", element: "EARTH", class: "WARRIOR", type: "REACTION" },
      { slug: "wind-blade", name: "Wind Blade", element: "WIND", class: "ASSASSIN", type: "ACTION" },
    ]);
  }

  async function seedEditions() {
    await db.insert(cardEditions).values([
      { id: "ed-fs-doa", cardSlug: "fire-slash", setPrefix: "DOA 1st", setName: "Dawn of Ashes 1st", collectorNumber: "001", rarity: 3, imageUrl: "fs.jpg" },
      { id: "ed-fs-acr", cardSlug: "fire-slash", setPrefix: "ACR", setName: "Alchemical Revolution", collectorNumber: "050", rarity: 3, imageUrl: "fs-acr.jpg" },
      { id: "ed-wb-doa", cardSlug: "water-bolt", setPrefix: "DOA 1st", setName: "Dawn of Ashes 1st", collectorNumber: "002", rarity: 2, imageUrl: "wb.jpg" },
      { id: "ed-es-doa", cardSlug: "earth-shield", setPrefix: "DOA 1st", setName: "Dawn of Ashes 1st", collectorNumber: "003", rarity: 4, imageUrl: "es.jpg" },
      { id: "ed-wb-acr", cardSlug: "water-bolt", setPrefix: "ACR", setName: "Alchemical Revolution", collectorNumber: "051", rarity: 2, imageUrl: "wb-acr.jpg" },
      { id: "ed-wb-rc", cardSlug: "water-bolt", setPrefix: "RDO", setName: "Re:Collection", collectorNumber: "122", rarity: 2, imageUrl: "wb-rc.jpg" },
    ]);
  }

  async function seedGroupsAndDefs() {
    await db.insert(featuredSetGroups).values([
      { uuid: "grp-doa", name: "Dawn of Ashes", slug: "dawn-of-ashes", imageUrl: "doa.png", sortOrder: 1 },
      { uuid: "grp-acr", name: "Alchemical Revolution", slug: "alchemical-revolution", imageUrl: "acr.png", sortOrder: 2 },
      { uuid: "grp-starter", name: "Starter Decks", slug: "starter-decks", imageUrl: "sd.png", sortOrder: 3 },
    ]);

    await db.insert(setDefinitions).values([
      { id: "def-doa-1st", groupUuid: "grp-doa", prefix: "DOA 1st", name: "Dawn of Ashes First Edition", language: "EN", releaseDate: "2023-05-15" },
      { id: "def-doa-alt", groupUuid: "grp-doa", prefix: "DOA Alter", name: "Dawn of Ashes Alter Edition", language: "EN", releaseDate: "2023-08-20" },
      { id: "def-acr", groupUuid: "grp-acr", prefix: "ACR", name: "Alchemical Revolution", language: "EN", releaseDate: "2024-01-10" },
      { id: "def-rdo", groupUuid: "grp-starter", prefix: "RDO", name: "Re:Collection Shadowdancer", language: "EN", releaseDate: "2024-03-01" },
    ]);
  }

  async function seedAll() {
    await seedUser();
    await seedCards();
    await seedEditions();
    await seedGroupsAndDefs();
  }

  // -----------------------------------------------------------------------
  // calculateFeaturedSetSummaries
  // -----------------------------------------------------------------------
  describe("calculateFeaturedSetSummaries", () => {
    it("returns empty array when no featured groups exist", async () => {
      await seedUser();
      const summaries = await calculateFeaturedSetSummaries("user-1", db);
      expect(summaries).toEqual([]);
    });

    it("returns groups with zero shortages when user has no decks", async () => {
      await seedAll();
      const summaries = await calculateFeaturedSetSummaries("user-1", db);
      expect(summaries).toHaveLength(3);
      for (const s of summaries) {
        expect(s.totalShortageCopies).toBe(0);
        expect(s.hardShortageCopies).toBe(0);
        expect(s.sharedShortageCopies).toBe(0);
        expect(s.uniqueShortageCards).toBe(0);
        expect(s.impactedDecks).toBe(0);
      }
    });

    it("ranks groups by total shortage descending, then completion % asc, then name asc", async () => {
      await seedAll();
      // 1 deck: 3x Fire Slash, 2x Water Bolt
      await db.insert(decks).values({ id: "deck-1", userId: "user-1", name: "Deck 1", champion: "Silvie" });
      await db.insert(deckCards).values([
        { id: "dc-1", deckId: "deck-1", cardSlug: "fire-slash", zone: "main", quantity: 3 },
        { id: "dc-2", deckId: "deck-1", cardSlug: "water-bolt", zone: "main", quantity: 2 },
      ]);

      const summaries = await calculateFeaturedSetSummaries("user-1", db);
      // DOA: 3+2=5, ACR: 3+2=5, Starter: 2
      // Tie at 5: alphabetically "Alchemical" < "Dawn"
      expect(summaries.map((s) => s.slug)).toEqual([
        "alchemical-revolution", "dawn-of-ashes", "starter-decks",
      ]);
      expect(summaries[0].totalShortageCopies).toBe(5);
      expect(summaries[1].totalShortageCopies).toBe(5);
      expect(summaries[2].totalShortageCopies).toBe(2);
    });

    it("attributes shortage to every group containing an edition of that card (multiset)", async () => {
      await seedAll();
      await db.insert(decks).values({ id: "deck-1", userId: "user-1", name: "Deck 1", champion: "Silvie" });
      await db.insert(deckCards).values([
        { id: "dc-1", deckId: "deck-1", cardSlug: "water-bolt", zone: "main", quantity: 1 },
      ]);

      const summaries = await calculateFeaturedSetSummaries("user-1", db);
      const doa = summaries.find((s: any) => s.groupUuid === "grp-doa")!;
      const acr = summaries.find((s: any) => s.groupUuid === "grp-acr")!;
      const starter = summaries.find((s: any) => s.groupUuid === "grp-starter")!;

      expect(doa.totalShortageCopies).toBe(1);
      expect(acr.totalShortageCopies).toBe(1);
      expect(starter.totalShortageCopies).toBe(1);
      expect(doa.uniqueShortageCards).toBe(1);
    });

    it("computes hard vs shared shortage split (peak demand < total demand)", async () => {
      await seedAll();
      // Two decks: deck-1 needs 3x, deck-2 needs 2x = peak 3, total 5
      await db.insert(decks).values([
        { id: "deck-1", userId: "user-1", name: "Deck 1", champion: "Silvie" },
        { id: "deck-2", userId: "user-1", name: "Deck 2", champion: "Lorraine" },
      ]);
      await db.insert(deckCards).values([
        { id: "dc-1", deckId: "deck-1", cardSlug: "fire-slash", zone: "main", quantity: 3 },
        { id: "dc-2", deckId: "deck-2", cardSlug: "fire-slash", zone: "main", quantity: 2 },
      ]);

      const summaries = await calculateFeaturedSetSummaries("user-1", db);
      const doa = summaries.find((s: any) => s.groupUuid === "grp-doa")!;
      // hard=3, shared=2, total=5
      expect(doa.hardShortageCopies).toBe(3);
      expect(doa.sharedShortageCopies).toBe(2);
      expect(doa.totalShortageCopies).toBe(5);
    });

    it("deducts owned copies from shortage", async () => {
      await seedAll();
      await db.insert(decks).values([
        { id: "deck-1", userId: "user-1", name: "Deck 1", champion: "Silvie" },
        { id: "deck-2", userId: "user-1", name: "Deck 2", champion: "Lorraine" },
      ]);
      await db.insert(deckCards).values([
        { id: "dc-1", deckId: "deck-1", cardSlug: "fire-slash", zone: "main", quantity: 3 },
        { id: "dc-2", deckId: "deck-2", cardSlug: "fire-slash", zone: "main", quantity: 2 },
      ]);
      await db.insert(collectionItems).values({
        id: "ci-1", userId: "user-1", editionId: "ed-fs-doa", foil: false, quantity: 1, isDedicated: false,
      });

      const summaries = await calculateFeaturedSetSummaries("user-1", db);
      const doa = summaries.find((s: any) => s.groupUuid === "grp-doa")!;
      // peakMissing = max(0, 3-1)=2, concurrentMissing = max(0, 5-1)=4
      expect(doa.hardShortageCopies).toBe(2);
      expect(doa.sharedShortageCopies).toBe(2);
      expect(doa.totalShortageCopies).toBe(4);
    });

    it("counts distinct-card completion (ownedCards / totalCards)", async () => {
      await seedAll();
      await db.insert(collectionItems).values({
        id: "ci-1", userId: "user-1", editionId: "ed-fs-doa", foil: false, quantity: 1, isDedicated: false,
      });
      const summaries = await calculateFeaturedSetSummaries("user-1", db);
      const doa = summaries.find((s: any) => s.groupUuid === "grp-doa")!;
      // DOA group cards: fire-slash, water-bolt, earth-shield = 3
      expect(doa.totalCards).toBe(3);
      expect(doa.ownedCards).toBe(1);
      expect(doa.completionPercent).toBeCloseTo(33, 0);
    });

    it("reports impactedDecks as distinct decks with shortages", async () => {
      await seedAll();
      await db.insert(decks).values([
        { id: "deck-1", userId: "user-1", name: "Deck 1", champion: "Silvie" },
        { id: "deck-2", userId: "user-1", name: "Deck 2", champion: "Lorraine" },
      ]);
      await db.insert(deckCards).values([
        { id: "dc-1", deckId: "deck-1", cardSlug: "fire-slash", zone: "main", quantity: 1 },
        { id: "dc-2", deckId: "deck-2", cardSlug: "water-bolt", zone: "main", quantity: 1 },
      ]);
      const summaries = await calculateFeaturedSetSummaries("user-1", db);
      const doa = summaries.find((s: any) => s.groupUuid === "grp-doa")!;
      expect(doa.impactedDecks).toBe(2);
    });

    it("sets category to decks when all child names are Starter Decks or Re:Collection", async () => {
      await seedAll();
      const summaries = await calculateFeaturedSetSummaries("user-1", db);
      const starter = summaries.find((s: any) => s.groupUuid === "grp-starter")!;
      expect(starter.category).toBe("decks");
      const doa = summaries.find((s: any) => s.groupUuid === "grp-doa")!;
      expect(doa.category).toBe("booster");
    });

    it("orders hidden groups last", async () => {
      await seedAll();
      await db.update(users).set({ hiddenSetUuids: JSON.stringify(["grp-doa"]) }).where(eq(users.id, "user-1"));
      const summaries = await calculateFeaturedSetSummaries("user-1", db);
      const last = summaries[summaries.length - 1];
      expect(last.groupUuid).toBe("grp-doa");
      expect(last.isHidden).toBe(true);
    });

    it("tie-breaks alphabetically when shortage and completion equal", async () => {
      await seedAll();
      const summaries = await calculateFeaturedSetSummaries("user-1", db);
      const slugs = summaries.map((s) => s.slug);
      expect(slugs[0]).toBe("alchemical-revolution");
      expect(slugs[1]).toBe("dawn-of-ashes");
    });

    it("returns releaseDate as earliest child", async () => {
      await seedAll();
      const summaries = await calculateFeaturedSetSummaries("user-1", db);
      const doa = summaries.find((s: any) => s.groupUuid === "grp-doa")!;
      expect(doa.releaseDate).toBe("2023-05-15");
    });

    it("ignores empty child release dates when picking the earliest", async () => {
      await seedAll();
      await db.insert(setDefinitions).values({
        id: "def-doa-unknown", groupUuid: "grp-doa", prefix: "DOA Unknown",
        name: "Dawn of Ashes Unknown", language: "EN", releaseDate: "",
      });
      const summaries = await calculateFeaturedSetSummaries("user-1", db);
      const doa = summaries.find((s: any) => s.groupUuid === "grp-doa")!;
      expect(doa.releaseDate).toBe("2023-05-15");
    });

    it("returns childPrefixes sorted", async () => {
      await seedAll();
      const summaries = await calculateFeaturedSetSummaries("user-1", db);
      const doa = summaries.find((s: any) => s.groupUuid === "grp-doa")!;
      expect(doa.childPrefixes).toEqual(["DOA 1st", "DOA Alter"]);
    });

    it("completionPercent is 0 when group has no cards", async () => {
      await seedUser();
      await seedCards();
      await db.insert(featuredSetGroups).values({
        uuid: "grp-empty", name: "Empty Group", slug: "empty-group", sortOrder: 0,
      });
      const summaries = await calculateFeaturedSetSummaries("user-1", db);
      const empty = summaries.find((s: any) => s.groupUuid === "grp-empty")!;
      expect(empty.totalCards).toBe(0);
      expect(empty.ownedCards).toBe(0);
      expect(empty.completionPercent).toBe(0);
    });

    it("handles multiple decks needing same card with different quantities", async () => {
      await seedAll();
      await db.insert(decks).values([
        { id: "deck-1", userId: "user-1", name: "Deck A", champion: "Silvie" },
        { id: "deck-2", userId: "user-1", name: "Deck B", champion: "Lorraine" },
        { id: "deck-3", userId: "user-1", name: "Deck C", champion: "Tristan" },
      ]);
      await db.insert(deckCards).values([
        { id: "dc-1", deckId: "deck-1", cardSlug: "fire-slash", zone: "main", quantity: 4 },
        { id: "dc-2", deckId: "deck-2", cardSlug: "fire-slash", zone: "main", quantity: 1 },
        { id: "dc-3", deckId: "deck-3", cardSlug: "fire-slash", zone: "main", quantity: 2 },
      ]);
      const summaries = await calculateFeaturedSetSummaries("user-1", db);
      const doa = summaries.find((s: any) => s.groupUuid === "grp-doa")!;
      expect(doa.hardShortageCopies).toBe(4);
      expect(doa.sharedShortageCopies).toBe(3);
      expect(doa.uniqueShortageCards).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // getSetGroupChecklistReport
  // -----------------------------------------------------------------------
  describe("getSetGroupChecklistReport", () => {
    it("returns null for unknown slug", async () => {
      await seedUser();
      await seedGroupsAndDefs();
      expect(await getSetGroupChecklistReport("nonexistent", "user-1", undefined, db)).toBeNull();
    });

    it("returns null for unknown UUID", async () => {
      await seedUser();
      await seedGroupsAndDefs();
      expect(await getSetGroupChecklistReport("grp-unknown", "user-1", undefined, db)).toBeNull();
    });

    it("returns group stats and checklist cards", async () => {
      await seedAll();
      await db.insert(collectionItems).values({
        id: "ci-1", userId: "user-1", editionId: "ed-fs-doa", foil: false, quantity: 2, isDedicated: false,
      });
      await db.insert(decks).values({ id: "deck-1", userId: "user-1", name: "Deck 1", champion: "Silvie" });
      await db.insert(deckCards).values([
        { id: "dc-1", deckId: "deck-1", cardSlug: "fire-slash", zone: "main", quantity: 3 },
      ]);

      const report = await getSetGroupChecklistReport("grp-doa", "user-1", undefined, db);
      expect(report).not.toBeNull();
      expect(report!.group.uuid).toBe("grp-doa");
      expect(report!.group.name).toBe("Dawn of Ashes");
      expect(report!.stats.totalCardsAcrossGroups).toBe(3);
      expect(report!.stats.totalOwnedCardsAcrossGroups).toBe(1);

      const fsCard = report!.cards.find((c: SetChecklistCard) => c.cardSlug === "fire-slash")!;
      expect(fsCard.ownedQuantity).toBe(2);
      expect(fsCard.requiredQuantity).toBe(3);
      expect(fsCard.missingQuantity).toBe(1);
      expect(fsCard.isShortage).toBe(true);
      expect(fsCard.requiringDeckIds).toContain("deck-1");

      const wbCard = report!.cards.find((c: SetChecklistCard) => c.cardSlug === "water-bolt")!;
      expect(wbCard.requiredQuantity).toBe(0);
      expect(wbCard.missingQuantity).toBe(0);
      expect(wbCard.isShortage).toBe(false);
    });

    it("looks up group by slug", async () => {
      await seedAll();
      const report = await getSetGroupChecklistReport("dawn-of-ashes", "user-1", undefined, db);
      expect(report).not.toBeNull();
      expect(report!.group.uuid).toBe("grp-doa");
    });

    it("applies filters when options are supplied", async () => {
      await seedAll();
      await db.insert(collectionItems).values({
        id: "ci-1", userId: "user-1", editionId: "ed-fs-doa", foil: false, quantity: 1, isDedicated: false,
      });
      await db.insert(decks).values({ id: "deck-1", userId: "user-1", name: "Deck 1", champion: "Silvie" });
      await db.insert(deckCards).values([
        { id: "dc-1", deckId: "deck-1", cardSlug: "fire-slash", zone: "main", quantity: 3 },
      ]);

      const report = await getSetGroupChecklistReport("grp-doa", "user-1", {
        filters: { prefix: null, status: "shortages" },
      }, db);
      expect(report).not.toBeNull();
      for (const c of report!.cards) {
        expect(c.isShortage).toBe(true);
      }
      expect(report!.cards.length).toBe(1); // only fire-slash has shortage
      // Group stats stay derived from the full checklist, not the filtered rows.
      expect(report!.stats.totalCardsAcrossGroups).toBe(3);
      expect(report!.stats.totalShortageCopies).toBe(2);
    });

    it("reconciles hard/shared/total when a hard card is also contended", async () => {
      await seedAll();
      await db.insert(decks).values([
        { id: "deck-1", userId: "user-1", name: "Deck 1", champion: "Silvie" },
        { id: "deck-2", userId: "user-1", name: "Deck 2", champion: "Lorraine" },
      ]);
      await db.insert(deckCards).values([
        { id: "dc-1", deckId: "deck-1", cardSlug: "fire-slash", zone: "main", quantity: 3 },
        { id: "dc-2", deckId: "deck-2", cardSlug: "fire-slash", zone: "main", quantity: 2 },
      ]);

      const report = await getSetGroupChecklistReport("grp-doa", "user-1", undefined, db);
      expect(report).not.toBeNull();
      // peak = 3, concurrent = 5, owned = 0 → hard 3, shared 2, total 5.
      expect(report!.stats.totalHardShortageCopies).toBe(3);
      expect(report!.stats.totalSharedShortageCopies).toBe(2);
      expect(report!.stats.totalShortageCopies).toBe(5);
      expect(report!.stats.totalShortageCopies).toBe(
        report!.stats.totalHardShortageCopies + report!.stats.totalSharedShortageCopies,
      );
    });

    it("filters by element, rarity, and name search", async () => {
      await seedAll();
      const report = await getSetGroupChecklistReport("grp-doa", "user-1", {
        filters: { prefix: null, status: "all", element: "WATER", rarity: 2, search: "water" },
      }, db);
      expect(report).not.toBeNull();
      expect(report!.cards.map((c) => c.cardSlug)).toEqual(["water-bolt"]);
      expect(report!.stats.totalCardsAcrossGroups).toBe(3);
    });

    it("filters by prefix", async () => {
      await seedAll();
      await db.insert(decks).values({ id: "deck-1", userId: "user-1", name: "Deck 1", champion: "Silvie" });
      await db.insert(deckCards).values([
        { id: "dc-1", deckId: "deck-1", cardSlug: "fire-slash", zone: "main", quantity: 1 },
        { id: "dc-2", deckId: "deck-1", cardSlug: "water-bolt", zone: "main", quantity: 1 },
      ]);

      const report = await getSetGroupChecklistReport("grp-doa", "user-1", {
        filters: { prefix: "DOA 1st", status: "all" },
      }, db);
      expect(report).not.toBeNull();
      for (const c of report!.cards) {
        expect(c.prefixes).toContain("DOA 1st");
      }
    });
  });

  // -----------------------------------------------------------------------
  // toggleUserSetHidden
  // -----------------------------------------------------------------------
  describe("toggleUserSetHidden", () => {
    it("throws SetGroupNotFoundError for unknown group", async () => {
      await seedUser();
      await expect(toggleUserSetHidden("user-1", "grp-unknown", true, db))
        .rejects.toThrow(SetGroupNotFoundError);
    });

    it("adds UUID to hidden list", async () => {
      await seedUser();
      await seedGroupsAndDefs();
      const list = await toggleUserSetHidden("user-1", "grp-doa", true, db);
      expect(list).toContain("grp-doa");
      expect(list).toHaveLength(1);
    });

    it("removes UUID from hidden list", async () => {
      await seedUser();
      await seedGroupsAndDefs();
      await toggleUserSetHidden("user-1", "grp-doa", true, db);
      const list = await toggleUserSetHidden("user-1", "grp-doa", false, db);
      expect(list).not.toContain("grp-doa");
      expect(list).toHaveLength(0);
    });

    it("dedupes existing hidden UUIDs", async () => {
      await seedUser();
      await seedGroupsAndDefs();
      await db.update(users).set({ hiddenSetUuids: JSON.stringify(["grp-doa", "grp-doa", "grp-acr"]) }).where(eq(users.id, "user-1"));
      const list = await toggleUserSetHidden("user-1", "grp-doa", false, db);
      expect(list).toEqual(["grp-acr"]);
    });
  });
});