import { describe, it, expect } from "vitest";
import {
  parseLootcardsCatalogResponse,
  parseLootcardsDetailHtml,
  parseLootcardsTotalCount,
  parseLootcardsLatestCardRefId,
} from "../lootcards-parser";

describe("lootcards-parser", () => {
  describe("parseLootcardsCatalogResponse", () => {
    it("parses valid catalog JSON payload into typed cards and pagination info", () => {
      const mockPayload = {
        cards: [
          {
            uuid: "ff8jchay4s",
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
            uuid: "c8wwslgbvr",
            slug: "flamewreath-call",
            name: "Flamewreath Call",
            edition_uuid: "4aj7co2hgc",
            set_prefix: "ReC-HVF",
            collector_number: "024",
            rarity: 3,
            rarity_code: "R",
            image_url: "https://api.gatcg.com/cards/images/4aj7co2hgc.jpg",
            min_price_cents: 200,
            total_stock: 1,
            has_stock: true,
            has_curio_foil: false,
            has_foil: true,
          },
        ],
        totalCards: 453,
        totalPages: 19,
        currentPage: 1,
        pageSize: 24,
      };

      const result = parseLootcardsCatalogResponse(mockPayload);
      expect(result.totalCards).toBe(453);
      expect(result.totalPages).toBe(19);
      expect(result.currentPage).toBe(1);
      expect(result.pageSize).toBe(24);
      expect(result.cards).toHaveLength(2);

      const first = result.cards[0];
      expect(first.slug).toBe("obscuring-threads");
      expect(first.name).toBe("Obscuring Threads");
      expect(first.editionUuid).toBe("afgr8ou03k");
      expect(first.setPrefix).toBe("ReC-HVF");
      expect(first.collectorNumber).toBe("020");
      expect(first.minPriceCents).toBe(90);
      expect(first.priceNumeric).toBe(0.9);
      expect(first.price).toBe("R$ 0,90");
      expect(first.totalStock).toBe(2);
      expect(first.hasFoil).toBe(false);

      const second = result.cards[1];
      expect(second.minPriceCents).toBe(200);
      expect(second.priceNumeric).toBe(2.0);
      expect(second.price).toBe("R$ 2,00");
      expect(second.hasFoil).toBe(true);
    });

    it("handles string input and empty/malformed responses safely", () => {
      expect(parseLootcardsCatalogResponse("invalid-json")).toEqual({
        cards: [],
        totalCards: 0,
        totalPages: 0,
        currentPage: 1,
        pageSize: 24,
      });

      expect(parseLootcardsCatalogResponse(null)).toEqual({
        cards: [],
        totalCards: 0,
        totalPages: 0,
        currentPage: 1,
        pageSize: 24,
      });
    });
  });

  describe("parseLootcardsTotalCount", () => {
    it("extracts totalCards from object or JSON string", () => {
      expect(parseLootcardsTotalCount({ totalCards: 451 })).toBe(451);
      expect(parseLootcardsTotalCount(JSON.stringify({ totalCards: 452 }))).toBe(452);
      expect(parseLootcardsTotalCount({})).toBe(null);
      expect(parseLootcardsTotalCount("not a json")).toBe(null);
    });
  });

  describe("parseLootcardsLatestCardRefId", () => {
    it("extracts latest card edition_uuid:min_price_cents from response", () => {
      const payload = {
        cards: [
          {
            edition_uuid: "Hb1fH5IpOS",
            min_price_cents: 60,
          },
        ],
      };
      expect(parseLootcardsLatestCardRefId(payload)).toBe("Hb1fH5IpOS:60");
      expect(parseLootcardsLatestCardRefId(JSON.stringify(payload))).toBe("Hb1fH5IpOS:60");
    });

    it("returns null when no cards exist", () => {
      expect(parseLootcardsLatestCardRefId({ cards: [] })).toBe(null);
      expect(parseLootcardsLatestCardRefId(null)).toBe(null);
    });
  });

  describe("parseLootcardsDetailHtml", () => {
    it("extracts variants from CardPurchasePanel island props", () => {
      const sampleHtml = `
        <main>
          <h1>Twinstar Tonic</h1>
          <astro-island uid="test-island" component-url="/_astro/CardPurchasePanel.C3SklN11.js" props="{&quot;cardName&quot;:[0,&quot;Twinstar Tonic&quot;],&quot;cardSlug&quot;:[0,&quot;twinstar-tonic&quot;],&quot;editions&quot;:[1,[[0,{&quot;uuid&quot;:[0,&quot;7Dm07FVd4b&quot;],&quot;variants&quot;:[1,[[0,{&quot;id&quot;:[0,&quot;7Dm07FVd4b-NONFOIL-NM-EN&quot;],&quot;edition_uuid&quot;:[0,&quot;7Dm07FVd4b&quot;],&quot;finish&quot;:[0,&quot;NONFOIL&quot;],&quot;condition&quot;:[0,&quot;NM&quot;],&quot;language&quot;:[0,&quot;EN&quot;],&quot;price_cents&quot;:[0,800],&quot;quantity&quot;:[0,2],&quot;is_active&quot;:[0,1]}],[0,{&quot;id&quot;:[0,&quot;7Dm07FVd4b-FOIL-NM-EN&quot;],&quot;edition_uuid&quot;:[0,&quot;7Dm07FVd4b&quot;],&quot;finish&quot;:[0,&quot;FOIL&quot;],&quot;condition&quot;:[0,&quot;NM&quot;],&quot;language&quot;:[0,&quot;EN&quot;],&quot;price_cents&quot;:[0,2500],&quot;quantity&quot;:[0,1],&quot;is_active&quot;:[0,1]}]]]}]]]}">
          </astro-island>
        </main>
      `;

      const result = parseLootcardsDetailHtml(sampleHtml);
      expect(result.cardName).toBe("Twinstar Tonic");
      expect(result.cardSlug).toBe("twinstar-tonic");
      expect(result.variants).toHaveLength(2);

      const [v1, v2] = result.variants;
      expect(v1.id).toBe("7Dm07FVd4b-NONFOIL-NM-EN");
      expect(v1.editionUuid).toBe("7Dm07FVd4b");
      expect(v1.finish).toBe("NONFOIL");
      expect(v1.condition).toBe("NM");
      expect(v1.priceCents).toBe(800);
      expect(v1.priceNumeric).toBe(8.0);
      expect(v1.price).toBe("R$ 8,00");
      expect(v1.quantity).toBe(2);

      expect(v2.id).toBe("7Dm07FVd4b-FOIL-NM-EN");
      expect(v2.finish).toBe("FOIL");
      expect(v2.priceCents).toBe(2500);
      expect(v2.priceNumeric).toBe(25.0);
      expect(v2.price).toBe("R$ 25,00");
      expect(v2.quantity).toBe(1);
    });

    it("filters out inactive or zero-quantity variants", () => {
      const htmlWithOutOfStock = `
        <astro-island uid="test-island" component-url="/_astro/CardPurchasePanel.js" props="{&quot;cardName&quot;:[0,&quot;Alpha&quot;],&quot;cardSlug&quot;:[0,&quot;alpha&quot;],&quot;editions&quot;:[1,[[0,{&quot;uuid&quot;:[0,&quot;ed1&quot;],&quot;variants&quot;:[1,[[0,{&quot;id&quot;:[0,&quot;v1&quot;],&quot;edition_uuid&quot;:[0,&quot;ed1&quot;],&quot;finish&quot;:[0,&quot;NONFOIL&quot;],&quot;condition&quot;:[0,&quot;NM&quot;],&quot;language&quot;:[0,&quot;EN&quot;],&quot;price_cents&quot;:[0,100],&quot;quantity&quot;:[0,0],&quot;is_active&quot;:[0,1]}],[0,{&quot;id&quot;:[0,&quot;v2&quot;],&quot;edition_uuid&quot;:[0,&quot;ed1&quot;],&quot;finish&quot;:[0,&quot;NONFOIL&quot;],&quot;condition&quot;:[0,&quot;SP&quot;],&quot;language&quot;:[0,&quot;EN&quot;],&quot;price_cents&quot;:[0,80],&quot;quantity&quot;:[0,1],&quot;is_active&quot;:[0,0]}],[0,{&quot;id&quot;:[0,&quot;v3&quot;],&quot;edition_uuid&quot;:[0,&quot;ed1&quot;],&quot;finish&quot;:[0,&quot;FOIL&quot;],&quot;condition&quot;:[0,&quot;NM&quot;],&quot;language&quot;:[0,&quot;EN&quot;],&quot;price_cents&quot;:[0,500],&quot;quantity&quot;:[0,3],&quot;is_active&quot;:[0,1]}]]]}]]]}">
        </astro-island>
      `;

      const result = parseLootcardsDetailHtml(htmlWithOutOfStock);
      expect(result.variants).toHaveLength(1);
      expect(result.variants[0].id).toBe("v3");
      expect(result.variants[0].quantity).toBe(3);
    });
  });
});
