import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveLootcardsCard, syncLootcards } from "../lootcards-sync";
import type { ParsedLootcardsCard } from "../lootcards-parser";
import type { CatalogResolutionData } from "../marketplace";

describe("lootcards-sync", () => {
  const mockCatalog: CatalogResolutionData = {
    allCatalogCards: [
      { slug: "obscuring-threads", name: "Obscuring Threads" },
      { slug: "twinstar-tonic", name: "Twinstar Tonic" },
    ],
    allCatalogEditions: [
      {
        id: "afgr8ou03k",
        cardSlug: "obscuring-threads",
        setPrefix: "ReC-HVF",
        collectorNumber: "020",
      },
      {
        id: "7Dm07FVd4b",
        cardSlug: "twinstar-tonic",
        setPrefix: "RDOPD",
        collectorNumber: "198",
      },
    ],
    cardByLowerName: new Map([
      ["obscuring threads", { slug: "obscuring-threads", name: "Obscuring Threads" }],
      ["twinstar tonic", { slug: "twinstar-tonic", name: "Twinstar Tonic" }],
    ]),
    cardByAlphaNum: new Map([
      ["obscuringthreads", { slug: "obscuring-threads", name: "Obscuring Threads" }],
      ["twstartonic", { slug: "twinstar-tonic", name: "Twinstar Tonic" }],
    ]),
  };

  describe("resolveLootcardsCard", () => {
    it("resolves directly by exact edition_uuid match", () => {
      const card: ParsedLootcardsCard = {
        uuid: "ff8jchay4s",
        slug: "obscuring-threads",
        name: "Obscuring Threads",
        editionUuid: "afgr8ou03k",
        setPrefix: "ReC-HVF",
        collectorNumber: "020",
        rarity: 2,
        rarityCode: "U",
        imageUrl: "https://api.gatcg.com/cards/images/afgr8ou03k.jpg",
        minPriceCents: 90,
        priceNumeric: 0.9,
        price: "R$ 0,90",
        totalStock: 2,
        hasStock: true,
        hasFoil: false,
        hasCurioFoil: false,
      };

      const resolved = resolveLootcardsCard(card, mockCatalog);
      expect(resolved.cardSlug).toBe("obscuring-threads");
      expect(resolved.editionId).toBe("afgr8ou03k");
      expect(resolved.setPrefix).toBe("ReC-HVF");
    });

    it("falls back to card name and collector number if editionUuid is unknown", () => {
      const card: ParsedLootcardsCard = {
        uuid: "unknown-uuid",
        slug: "twinstar-tonic",
        name: "Twinstar Tonic",
        editionUuid: "unknown-edition",
        setPrefix: "RDOPD",
        collectorNumber: "198",
        rarity: 4,
        rarityCode: "SR",
        imageUrl: "",
        minPriceCents: 800,
        priceNumeric: 8.0,
        price: "R$ 8,00",
        totalStock: 1,
        hasStock: true,
        hasFoil: false,
        hasCurioFoil: false,
      };

      const resolved = resolveLootcardsCard(card, mockCatalog);
      expect(resolved.cardSlug).toBe("twinstar-tonic");
      expect(resolved.editionId).toBe("7Dm07FVd4b");
    });

    it("returns null identifiers when card is not found in catalog", () => {
      const card: ParsedLootcardsCard = {
        uuid: "unknown",
        slug: "totally-fake-card",
        name: "Totally Fake Card",
        editionUuid: "fake-edition",
        setPrefix: "FAKE",
        collectorNumber: "999",
        rarity: 1,
        rarityCode: "C",
        imageUrl: "",
        minPriceCents: 100,
        priceNumeric: 1.0,
        price: "R$ 1,00",
        totalStock: 1,
        hasStock: true,
        hasFoil: false,
        hasCurioFoil: false,
      };

      const resolved = resolveLootcardsCard(card, mockCatalog);
      expect(resolved.cardSlug).toBe(null);
      expect(resolved.editionId).toBe(null);
      expect(resolved.setPrefix).toBe("UNKNOWN");
    });
  });

  describe("syncLootcards", () => {
    it("fetches in-stock pages and inserts market cards", async () => {
      const mockDatabase: any = {};

      const mockStore = {
        id: "lootcards",
        platform: "lootcards",
        name: "Lootcards",
        baseUrl: "https://lootcards.store",
        tcgId: "grandarchive",
        enabled: true,
      };

      const mockPage1 = {
        cards: [
          {
            uuid: "c1",
            slug: "obscuring-threads",
            name: "Obscuring Threads",
            edition_uuid: "afgr8ou03k",
            set_prefix: "ReC-HVF",
            collector_number: "020",
            rarity: 2,
            rarity_code: "U",
            image_url: "https://api.gatcg.com/cards/images/afgr8ou03k.jpg",
            min_price_cents: 90,
            total_stock: 2,
            has_stock: true,
            has_curio_foil: false,
            has_foil: false,
          },
          {
            uuid: "c2",
            slug: "twinstar-tonic",
            name: "Twinstar Tonic",
            edition_uuid: "7Dm07FVd4b",
            set_prefix: "RDOPD",
            collector_number: "198",
            rarity: 4,
            rarity_code: "SR",
            image_url: "https://api.gatcg.com/cards/images/7Dm07FVd4b.jpg",
            min_price_cents: 800,
            total_stock: 3,
            has_stock: true,
            has_curio_foil: false,
            has_foil: true, // triggers detail enrichment
          },
        ],
        totalCards: 2,
        totalPages: 1,
        currentPage: 1,
        pageSize: 24,
      };

      const mockDetailHtml = `
        <astro-island uid="test-island" component-url="/_astro/CardPurchasePanel.js" props="{&quot;cardName&quot;:[0,&quot;Twinstar Tonic&quot;],&quot;cardSlug&quot;:[0,&quot;twinstar-tonic&quot;],&quot;editions&quot;:[1,[[0,{&quot;uuid&quot;:[0,&quot;7Dm07FVd4b&quot;],&quot;variants&quot;:[1,[[0,{&quot;id&quot;:[0,&quot;7Dm07FVd4b-NONFOIL-NM-EN&quot;],&quot;edition_uuid&quot;:[0,&quot;7Dm07FVd4b&quot;],&quot;finish&quot;:[0,&quot;NONFOIL&quot;],&quot;condition&quot;:[0,&quot;NM&quot;],&quot;language&quot;:[0,&quot;EN&quot;],&quot;price_cents&quot;:[0,800],&quot;quantity&quot;:[0,2],&quot;is_active&quot;:[0,1]}],[0,{&quot;id&quot;:[0,&quot;7Dm07FVd4b-FOIL-NM-EN&quot;],&quot;edition_uuid&quot;:[0,&quot;7Dm07FVd4b&quot;],&quot;finish&quot;:[0,&quot;FOIL&quot;],&quot;condition&quot;:[0,&quot;NM&quot;],&quot;language&quot;:[0,&quot;EN&quot;],&quot;price_cents&quot;:[0,2500],&quot;quantity&quot;:[0,1],&quot;is_active&quot;:[0,1]}]]]}]]]}">
        </astro-island>
      `;

      const customFetch = vi.fn(async (url: any) => {
        const urlStr = String(url);
        if (urlStr.includes("/api/cards")) {
          return {
            ok: true,
            json: async () => mockPage1,
            text: async () => JSON.stringify(mockPage1),
          } as any;
        }
        if (urlStr.includes("/carta/twinstar-tonic")) {
          return {
            ok: true,
            text: async () => mockDetailHtml,
          } as any;
        }
        return {
          ok: false,
          status: 404,
          text: async () => "Not Found",
        } as any;
      });

      // Mock repository calls
      const repo = await import("../../db/repositories/marketplace-repository");
      vi.spyOn(repo, "getMarketStoreById").mockResolvedValue(mockStore as any);
      const upsertSpy = vi.spyOn(repo, "upsertMarketCards").mockResolvedValue();
      const reconcileSpy = vi.spyOn(repo, "reconcileStoreListings").mockResolvedValue();
      const countSpy = vi.spyOn(repo, "updateStoreCount").mockResolvedValue();
      const scanSpy = vi.spyOn(repo, "updateStoreFullScanAt").mockResolvedValue();

      const mkt = await import("../marketplace");
      vi.spyOn(mkt, "loadCatalogResolutionData").mockResolvedValue(mockCatalog);

      const stats = await syncLootcards({
        storeId: "lootcards",
        database: mockDatabase,
        customFetch: customFetch as any,
      });

      expect(stats.totalSynced).toBe(3); // 1 nonfoil obscuring threads + 2 twinstar tonic variants (nonfoil and foil)
      expect(stats.matchedCount).toBe(2);
      expect(stats.enrichedCount).toBe(1);

      expect(upsertSpy).toHaveBeenCalledTimes(1);
      const insertedRows = upsertSpy.mock.calls[0][0];
      expect(insertedRows).toHaveLength(3);

      // Check non-enriched row
      const obscuringRow = insertedRows.find((r) => r.cardName === "Obscuring Threads");
      expect(obscuringRow).toBeDefined();
      expect(obscuringRow?.storeId).toBe("lootcards");
      expect(obscuringRow?.price).toBe("R$ 0,90");
      expect(obscuringRow?.isFoil).toBe(false);

      // Check enriched foil variant
      const tonicFoilRow = insertedRows.find(
        (r) => r.cardName === "Twinstar Tonic" && r.isFoil === true
      );
      expect(tonicFoilRow).toBeDefined();
      expect(tonicFoilRow?.price).toBe("R$ 25,00");
      expect(tonicFoilRow?.quantity).toBe(1);

      // Check reconciliation called with observed itemIds
      expect(reconcileSpy).toHaveBeenCalledWith(
        "lootcards",
        expect.arrayContaining(["afgr8ou03k-nonfoil", "7Dm07FVd4b-nonfoil", "7Dm07FVd4b-foil"]),
        mockDatabase
      );
      expect(countSpy).toHaveBeenCalled();
      expect(scanSpy).toHaveBeenCalled();
    });
  });
});
