import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "../../db/test-utils";
import {
  users,
  cards,
  cardEditions,
  cardCirculations,
  collectionItems,
  decks,
  deckCards,
  mypMarketCards,
  mypWatchlist,
} from "../../db/schema";
import {
  isStandardPlayablePrinting,
  isCollectorPrinting,
  computeQuotaForCard,
  reconcileUserWatchlist,
  reEnableWatchlistEntry,
} from "../watchlist";

describe("Watchlist Ledger & Quota Reconciliation (src/services/watchlist.ts)", () => {
  let testDb: any;

  beforeEach(async () => {
    const { db } = await createTestDb();
    testDb = db;

    // Seed test user
    await testDb.insert(users).values({
      id: "user-1",
      name: "Collector Fabrino",
      email: "fabrino@example.com",
      friendCode: "GA-FAB1",
      mypUsername: "Fabrino",
      watchlistPolicyHard: true,
      watchlistPolicyShared: false,
      watchlistPolicyStaples: false,
    });

    // Seed test card: Fracturize
    await testDb.insert(cards).values({
      slug: "fracturize",
      name: "Fracturize",
      element: "NORM",
      class: "WARRIOR",
      type: "ACTION",
      subtypes: "[]",
    });

    // Editions for Fracturize:
    // 1. DOA Standard Non-Foil (Playable)
    await testDb.insert(cardEditions).values({
      id: "ed-doa-norm",
      cardSlug: "fracturize",
      setPrefix: "DOA",
      setName: "Dawn of Ashes",
      collectorNumber: "001",
      rarity: 3,
      imageUrl: "https://api.gatcg.com/images/doa-001.jpg",
    });
    await testDb.insert(cardCirculations).values({
      id: "circ-doa-norm",
      editionId: "ed-doa-norm",
      kind: "NONFOIL",
      population: 500,
      foil: false,
    });

    // 2. ALC Standard Non-Foil (Playable)
    await testDb.insert(cardEditions).values({
      id: "ed-alc-norm",
      cardSlug: "fracturize",
      setPrefix: "ALC",
      setName: "Alchemical Revolution",
      collectorNumber: "042",
      rarity: 3,
      imageUrl: "https://api.gatcg.com/images/alc-042.jpg",
    });
    await testDb.insert(cardCirculations).values({
      id: "circ-alc-norm",
      editionId: "ed-alc-norm",
      kind: "NONFOIL",
      population: 500,
      foil: false,
    });

    // 3. DOA Foil (Collector Printing)
    await testDb.insert(cardEditions).values({
      id: "ed-doa-foil",
      cardSlug: "fracturize",
      setPrefix: "DOA",
      setName: "Dawn of Ashes",
      collectorNumber: "001",
      rarity: 3,
      imageUrl: "https://api.gatcg.com/images/doa-001-foil.jpg",
    });
    await testDb.insert(cardCirculations).values({
      id: "circ-doa-foil",
      editionId: "ed-doa-foil",
      kind: "FOIL",
      population: 100,
      foil: true,
    });

    // 4. DOA Collector Super Rare / CSR (Collector Printing)
    await testDb.insert(cardEditions).values({
      id: "ed-doa-csr",
      cardSlug: "fracturize",
      setPrefix: "DOA",
      setName: "Dawn of Ashes",
      collectorNumber: "001-CSR",
      rarity: 7, // Collector rarity
      imageUrl: "https://api.gatcg.com/images/doa-001-csr.jpg",
    });
    await testDb.insert(cardCirculations).values({
      id: "circ-doa-csr",
      editionId: "ed-doa-csr",
      kind: "FOIL",
      population: 20,
      foil: true,
    });

    // Seed Market Card price data for DOA standard
    await testDb.insert(mypMarketCards).values({
      id: "mkt-doa-001",
      cardSlug: "fracturize",
      editionId: "ed-doa-norm",
      rawName: "Fracturize",
      cardName: "Fracturize",
      setPrefix: "DOA",
      quantity: 5,
      price: "R$ 5,00",
      priceNumeric: 5.0,
      tcgPrice: "R$ 4,50",
      tcgPriceNumeric: 4.5,
      isFoil: false,
      mypItemId: "ga_doa_001",
      mypProductUrl: "https://mypcards.com/produto/fracturize-doa",
    });
  });

  describe("Standard Playable vs. Collector Printing Predicate", () => {
    it("classifies standard non-foil editions with rarity <= 5 as playable", () => {
      expect(
        isStandardPlayablePrinting({
          setPrefix: "DOA",
          collectorNumber: "001",
          rarity: 3,
          isFoil: false,
        })
      ).toBe(true);
    });

    it("rejects foil editions as collector printings", () => {
      expect(
        isStandardPlayablePrinting({
          setPrefix: "DOA",
          collectorNumber: "001",
          rarity: 3,
          isFoil: true,
        })
      ).toBe(false);
      expect(
        isCollectorPrinting({
          isFoil: true,
          rarity: 3,
        })
      ).toBe(true);
    });

    it("rejects rarity > 5 (CSR/Curio/Collector Rarity) as collector printings", () => {
      expect(
        isStandardPlayablePrinting({
          setPrefix: "DOA",
          collectorNumber: "001",
          rarity: 7,
          isFoil: false,
        })
      ).toBe(false);
    });

    it("rejects special collector tags in rawName or collectorNumber", () => {
      expect(
        isStandardPlayablePrinting({
          setPrefix: "DOA",
          collectorNumber: "001 (CSR)",
          rarity: 3,
          isFoil: false,
        })
      ).toBe(false);

      expect(
        isStandardPlayablePrinting({
          setPrefix: "DOA",
          collectorNumber: "001",
          rarity: 3,
          isFoil: false,
          rawName: "Fracturize (Full Art)",
        })
      ).toBe(false);
    });
  });

  describe("Quota Policy Evaluation", () => {
    it("calculates Hard, Shared, and Staples quotas correctly", () => {
      // 2 decks: Deck A needs 3 copies, Deck B needs 2 copies. Total = 5, Peak = 3.
      const totalDemand = 5;
      const peakDemand = 3;

      expect(computeQuotaForCard(totalDemand, peakDemand, "hard")).toBe(3);
      expect(computeQuotaForCard(totalDemand, peakDemand, "shared")).toBe(5);
      expect(computeQuotaForCard(totalDemand, peakDemand, "staples")).toBe(5);
      expect(computeQuotaForCard(2, 2, "staples")).toBe(4);
    });
  });

  describe("Two-Way Reconciliation & State Machine", () => {
    it("expands a shortage card into all standard playable printings and queues pending_add", async () => {
      // Setup deck requiring 3 copies of Fracturize
      await testDb.insert(decks).values({
        id: "deck-1",
        userId: "user-1",
        name: "Rai Warrior",
      });
      await testDb.insert(deckCards).values({
        id: "dc-1",
        deckId: "deck-1",
        cardSlug: "fracturize",
        zone: "main",
        quantity: 3,
      });

      // User owns 1 copy in Binder (ed-doa-norm)
      await testDb.insert(collectionItems).values({
        id: "col-1",
        userId: "user-1",
        editionId: "ed-doa-norm",
        quantity: 1,
        foil: false,
      });

      // Deficit is 3 - 1 = 2 copies.
      // Mock public Quero returning empty (user has not watched anything yet)
      const mockFetchQuero = async () => [];

      // Mock catalog discovery for ALC (since it's not in mypMarketCards)
      const mockDiscover = async () => [
        {
          rawName: "Fracturize",
          cleanName: "Fracturize",
          setPrefix: "ALC",
          collectorNumber: "042",
          quantity: 1,
          price: "R$ 6,00",
          quality: "NM",
          isFoil: false,
          mypItemId: "ga_alc_042",
          mypProductUrl: "https://mypcards.com/produto/fracturize-alc",
        },
      ];

      const report = await reconcileUserWatchlist("user-1", {
        database: testDb,
        fetchQuero: mockFetchQuero,
        discoverPrintings: mockDiscover,
      });

      expect(report.activeShortageCards).toHaveLength(1);
      expect(report.activeShortageCards[0].cardSlug).toBe("fracturize");
      expect(report.activeShortageCards[0].missing).toBe(2);

      // Verify myp_watchlist rows created:
      const watchlistRows = await testDb.select().from(mypWatchlist);
      expect(watchlistRows).toHaveLength(2); // DOA and ALC non-foil only!

      const doaRow = watchlistRows.find((r: any) => r.editionSlug === "DOA");
      expect(doaRow).toBeDefined();
      expect(doaRow.status).toBe("pending_add");
      expect(doaRow.targetQuantity).toBe(2);
      expect(doaRow.targetPriceBrl).toBe(4.5); // From TCG benchmark
      expect(doaRow.mypProductUrl).toBe("https://mypcards.com/produto/fracturize-doa");

      const alcRow = watchlistRows.find((r: any) => r.editionSlug === "ALC");
      expect(alcRow).toBeDefined();
      expect(alcRow.status).toBe("pending_add");
      expect(alcRow.targetQuantity).toBe(2);
    });

    it("adopts existing standard playable printings as watching, ignoring collector printings", async () => {
      // Setup deck with shortage
      await testDb.insert(decks).values({
        id: "deck-1",
        userId: "user-1",
        name: "Rai Warrior",
      });
      await testDb.insert(deckCards).values({
        id: "dc-1",
        deckId: "deck-1",
        cardSlug: "fracturize",
        zone: "main",
        quantity: 2,
      });

      // User has DOA standard on MyP Quero with quantity 2, AND has a Full Art / Foil Zhang Jiao
      const mockFetchQuero = async () => [
        {
          rawName: "Fracturize",
          cleanName: "Fracturize",
          setPrefix: "DOA",
          collectorNumber: "001",
          quantity: 2,
          price: "R$ 4,50",
          quality: "NM",
          isFoil: false,
          mypItemId: "ga_doa_001",
          mypProductUrl: "https://mypcards.com/produto/fracturize-doa",
        },
        {
          rawName: "Zhang Jiao (Full Art Foil)",
          cleanName: "Zhang Jiao",
          setPrefix: "DOA",
          collectorNumber: "999",
          quantity: 1,
          price: "R$ 200,00",
          quality: "NM",
          isFoil: true, // Collector printing
          mypItemId: "ga_doa_csr_999",
          mypProductUrl: "https://mypcards.com/produto/zhang-jiao-csr",
        },
      ];

      await reconcileUserWatchlist("user-1", {
        database: testDb,
        fetchQuero: mockFetchQuero,
      });

      const watchlistRows = await testDb.select().from(mypWatchlist);
      // DOA standard should be adopted as 'watching'
      const doaRow = watchlistRows.find((r: any) => r.editionSlug === "DOA");
      expect(doaRow.status).toBe("watching");
      expect(doaRow.targetQuantity).toBe(2);

      // Zhang Jiao (Full Art Foil) must NEVER be added to myp_watchlist!
      const zhangRow = watchlistRows.find((r: any) => r.cardName.includes("Zhang"));
      expect(zhangRow).toBeUndefined();
    });

    it("detects manual deletion on MyP and transitions watching to ignored", async () => {
      // Existing watching row
      await testDb.insert(mypWatchlist).values({
        id: "wl-doa",
        userId: "user-1",
        cardSlug: "fracturize",
        cardName: "Fracturize",
        editionSlug: "DOA",
        collectorNumber: "001",
        mypItemId: "ga_doa_001",
        mypProductUrl: "https://mypcards.com/produto/fracturize-doa",
        targetQuantity: 2,
        targetPriceBrl: 4.5,
        status: "watching",
      });

      // Still in shortage
      await testDb.insert(decks).values({
        id: "deck-1",
        userId: "user-1",
        name: "Deck",
      });
      await testDb.insert(deckCards).values({
        id: "dc-1",
        deckId: "deck-1",
        cardSlug: "fracturize",
        zone: "main",
        quantity: 2,
      });

      // User deleted DOA on MyP Cards directly (not present in live Quero)
      const mockFetchQuero = async () => [];

      await reconcileUserWatchlist("user-1", {
        database: testDb,
        fetchQuero: mockFetchQuero,
      });

      const row = (await testDb.select().from(mypWatchlist).where(eq(mypWatchlist.id, "wl-doa")))[0];
      expect(row.status).toBe("ignored");

      // Re-enable watch
      await reEnableWatchlistEntry(row.id, testDb);
      const reEnabled = (await testDb.select().from(mypWatchlist).where(eq(mypWatchlist.id, "wl-doa")))[0];
      expect(reEnabled.status).toBe("pending_add");
    });

    it("transitions watching to pending_update when shortage quantity decreases", async () => {
      // Existing watching row with targetQuantity = 3
      await testDb.insert(mypWatchlist).values({
        id: "wl-doa",
        userId: "user-1",
        cardSlug: "fracturize",
        cardName: "Fracturize",
        editionSlug: "DOA",
        collectorNumber: "001",
        mypItemId: "ga_doa_001",
        targetQuantity: 3,
        targetPriceBrl: 4.5,
        status: "watching",
      });

      // Deck needs 3
      await testDb.insert(decks).values({
        id: "deck-1",
        userId: "user-1",
        name: "Deck",
      });
      await testDb.insert(deckCards).values({
        id: "dc-1",
        deckId: "deck-1",
        cardSlug: "fracturize",
        zone: "main",
        quantity: 3,
      });

      // User acquires 2 copies in Binder -> missing drops to 3 - 2 = 1 copy
      await testDb.insert(collectionItems).values({
        id: "col-1",
        userId: "user-1",
        editionId: "ed-doa-norm",
        quantity: 2,
        foil: false,
      });

      // Still listed on MyP with old quantity 3
      const mockFetchQuero = async () => [
        {
          rawName: "Fracturize",
          cleanName: "Fracturize",
          setPrefix: "DOA",
          collectorNumber: "001",
          quantity: 3,
          price: "R$ 4,50",
          quality: "NM",
          isFoil: false,
          mypItemId: "ga_doa_001",
          mypProductUrl: null,
        },
      ];

      await reconcileUserWatchlist("user-1", {
        database: testDb,
        fetchQuero: mockFetchQuero,
      });

      const row = (await testDb.select().from(mypWatchlist).where(eq(mypWatchlist.id, "wl-doa")))[0];
      expect(row.status).toBe("pending_update");
      expect(row.targetQuantity).toBe(1);
    });

    it("transitions watching to pending_remove when shortage is completely filled", async () => {
      await testDb.insert(mypWatchlist).values({
        id: "wl-doa",
        userId: "user-1",
        cardSlug: "fracturize",
        cardName: "Fracturize",
        editionSlug: "DOA",
        collectorNumber: "001",
        mypItemId: "ga_doa_001",
        targetQuantity: 2,
        targetPriceBrl: 4.5,
        status: "watching",
      });

      // Deck needs 2
      await testDb.insert(decks).values({
        id: "deck-1",
        userId: "user-1",
        name: "Deck",
      });
      await testDb.insert(deckCards).values({
        id: "dc-1",
        deckId: "deck-1",
        cardSlug: "fracturize",
        zone: "main",
        quantity: 2,
      });

      // User adds 2 to binder -> missing is 0!
      await testDb.insert(collectionItems).values({
        id: "col-1",
        userId: "user-1",
        editionId: "ed-doa-norm",
        quantity: 2,
        foil: false,
      });

      const mockFetchQuero = async () => [
        {
          rawName: "Fracturize",
          cleanName: "Fracturize",
          setPrefix: "DOA",
          collectorNumber: "001",
          quantity: 2,
          price: "R$ 4,50",
          quality: "NM",
          isFoil: false,
          mypItemId: "ga_doa_001",
          mypProductUrl: null,
        },
      ];

      await reconcileUserWatchlist("user-1", {
        database: testDb,
        fetchQuero: mockFetchQuero,
      });

      const row = (await testDb.select().from(mypWatchlist).where(eq(mypWatchlist.id, "wl-doa")))[0];
      expect(row.status).toBe("pending_remove");
    });
  });
});
