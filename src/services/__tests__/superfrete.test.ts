import { describe, it, expect } from "vitest";
import {
  calculateInsuranceValue,
  selectBestCarrierQuote,
  buildSuperfreteProducts,
  toCarrierCode,
  calculatePackageWeightKg,
  buildPackageVolume,
  type SuperfreteCalculatorQuote,
} from "../superfrete";

describe("Superfrete Domain Logic (src/services/superfrete.ts)", () => {
  describe("calculateInsuranceValue", () => {
    it("sums subtotal and buyer shipping in cents to BRL", () => {
      // 10000 cents (R$ 100) + 1500 cents (R$ 15) = R$ 115.00
      const value = calculateInsuranceValue(10000, 1500);
      expect(value).toBe(115.0);
    });

    it("clamps to R$ 24.50 floor for PAC (1) and SEDEX (2)", () => {
      expect(calculateInsuranceValue(1000, 500, "1")).toBe(24.5);
      expect(calculateInsuranceValue(1000, 500, "2")).toBe(24.5);
      expect(calculateInsuranceValue(5000, 1000, "1")).toBe(60.0);
    });

    it("clamps to R$ 12.25 floor for Mini Envios (17)", () => {
      expect(calculateInsuranceValue(500, 200, "17")).toBe(12.25);
      expect(calculateInsuranceValue(2000, 500, "17")).toBe(25.0);
    });

    it("uses calculated value for Loggi (31) and Jadlog (3)", () => {
      expect(calculateInsuranceValue(1500, 500, "31")).toBe(20.0);
      expect(calculateInsuranceValue(1500, 500, "3")).toBe(20.0);
    });

    it("defaults to minimum R$ 24.50 when no specific service code is provided", () => {
      expect(calculateInsuranceValue(1000, 500)).toBe(24.5);
      expect(calculateInsuranceValue(3000, 500)).toBe(35.0);
    });
  });

  describe("toCarrierCode", () => {
    it("maps service IDs and company names correctly", () => {
      expect(toCarrierCode("31", "Loggi")).toBe("loggi");
      expect(toCarrierCode("3", "Jadlog")).toBe("jadlog");
      expect(toCarrierCode("1", "Correios")).toBe("correios");
      expect(toCarrierCode("2", "Correios")).toBe("correios");
      expect(toCarrierCode("17", "Correios")).toBe("correios");
      expect(toCarrierCode("99", "Outro")).toBe("outro");
    });
  });

  describe("selectBestCarrierQuote", () => {
    const loggiQuote: SuperfreteCalculatorQuote = {
      id: 31,
      name: "Loggi Express",
      price: "16.50",
      company: { name: "Loggi" },
      has_error: false,
    };

    const jadlogQuote: SuperfreteCalculatorQuote = {
      id: 3,
      name: "Jadlog .Package",
      price: "18.20",
      company: { name: "Jadlog" },
      has_error: false,
    };

    const correiosPacQuote: SuperfreteCalculatorQuote = {
      id: 1,
      name: "PAC",
      price: "12.00",
      company: { name: "Correios" },
      has_error: false,
    };

    const correiosSedexQuote: SuperfreteCalculatorQuote = {
      id: 2,
      name: "SEDEX",
      price: "22.00",
      company: { name: "Correios" },
      has_error: false,
    };

    it("prefers cheapest between Loggi and Jadlog even if Correios is cheaper", () => {
      const selected = selectBestCarrierQuote([
        correiosPacQuote, // R$ 12.00
        jadlogQuote,      // R$ 18.20
        loggiQuote,       // R$ 16.50
      ]);
      expect(selected?.id).toBe(31);
      expect(selected?.name).toBe("Loggi Express");
    });

    it("selects Jadlog if Jadlog is cheaper than Loggi", () => {
      const cheapJadlog = { ...jadlogQuote, price: "14.00" };
      const selected = selectBestCarrierQuote([loggiQuote, cheapJadlog, correiosPacQuote]);
      expect(selected?.id).toBe(3);
    });

    it("falls back to cheapest Correios when neither Loggi nor Jadlog are valid", () => {
      const errorLoggi = { ...loggiQuote, has_error: true, error: "Unavailable" };
      const errorJadlog = { ...jadlogQuote, has_error: true, error: "CEP not covered" };

      const selected = selectBestCarrierQuote([
        errorLoggi,
        errorJadlog,
        correiosSedexQuote, // 22.00
        correiosPacQuote,   // 12.00
      ]);

      expect(selected?.id).toBe(1);
      expect(selected?.name).toBe("PAC");
    });

    it("returns null when all quotes have errors or no valid price", () => {
      const errorQuote = { ...loggiQuote, has_error: true };
      expect(selectBestCarrierQuote([errorQuote])).toBeNull();
      expect(selectBestCarrierQuote([])).toBeNull();
    });
  });

  describe("buildSuperfreteProducts", () => {
    it("creates a single fallback product when items array is empty", () => {
      const products = buildSuperfreteProducts([], 24.5);
      expect(products).toHaveLength(1);
      expect(products[0].name).toContain("Grand Archive");
      expect(products[0].quantity).toBe(1);
      expect(products[0].unitary_value).toBe(24.5);
    });

    it("distributes declared value exactly matching insuranceBrl with multiple cards", () => {
      const items = [
        { cardName: "Tristan, Shadow Dancer", quantity: 2 },
        { cardName: "Merlin, Kingsmaker", quantity: 1 },
      ];
      const insuranceBrl = 24.5;
      const products = buildSuperfreteProducts(items, insuranceBrl);

      const totalCalculated = products.reduce(
        (sum, p) => sum + Number((p.quantity * p.unitary_value).toFixed(2)),
        0
      );

      expect(Number(totalCalculated.toFixed(2))).toBe(insuranceBrl);
    });

    it("handles uneven cents distribution without losing or gaining money", () => {
      const items = [
        { cardName: "Card A", quantity: 1 },
        { cardName: "Card B", quantity: 1 },
        { cardName: "Card C", quantity: 1 },
      ];
      const insuranceBrl = 10.0; // 10.00 / 3 = 3.33 + 3.33 + 3.34
      const products = buildSuperfreteProducts(items, insuranceBrl);

      const total = products.reduce(
        (sum, p) => sum + Number((p.quantity * p.unitary_value).toFixed(2)),
        0
      );
      expect(Number(total.toFixed(2))).toBe(10.0);
    });
  });

  describe("calculatePackageWeightKg and buildPackageVolume", () => {
    it("computes 200g base + 5g tape + (2g card + 1g protector) per card in kg", () => {
      // 1 card: 200 + 5 + 3 = 208g = 0.208 kg
      expect(calculatePackageWeightKg(1)).toBe(0.208);

      // 10 cards: 200 + 5 + 30 = 235g = 0.235 kg
      expect(calculatePackageWeightKg(10)).toBe(0.235);

      // 30 cards: 200 + 5 + 90 = 295g = 0.295 kg (eligible for Correios Mini Envios < 0.3kg)
      expect(calculatePackageWeightKg(30)).toBe(0.295);

      // 35 cards: 200 + 5 + 105 = 310g = 0.310 kg
      expect(calculatePackageWeightKg(35)).toBe(0.31);
    });

    it("builds Superfrete package volume object with dynamic weight", () => {
      const volume = buildPackageVolume(10);
      expect(volume).toEqual({
        height: 2,
        width: 21,
        length: 30,
        weight: 0.235,
      });
    });
  });

  describe("fetchSuperfretePrintUrl", () => {
    it("posts orders array and returns consolidated PDF print url", async () => {
      const { fetchSuperfretePrintUrl } = await import("../superfrete-client");
      const mockFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(String(input)).toContain("/api/v0/tag/print");
        expect(init?.headers).toEqual(
          expect.objectContaining({
            Authorization: "Bearer token-123",
            "Content-Type": "application/json",
          })
        );
        const body = JSON.parse(String(init?.body));
        expect(body.orders).toEqual(["ord-1", "ord-2"]);
        return new Response(JSON.stringify({ url: "https://superfrete.com/_etiqueta/pdf/a4.pdf" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      };

      const url = await fetchSuperfretePrintUrl("token-123", ["ord-1", "ord-2"], mockFetch as any);
      expect(url).toBe("https://superfrete.com/_etiqueta/pdf/a4.pdf");
    });

    it("throws descriptive error when Superfrete tag print endpoint fails", async () => {
      const { fetchSuperfretePrintUrl } = await import("../superfrete-client");
      const mockFetch = async () => {
        return new Response(JSON.stringify({ message: "Pedidos não liberados para impressão" }), {
          status: 400,
        });
      };

      await expect(
        fetchSuperfretePrintUrl("token-123", ["ord-1"], mockFetch as any)
      ).rejects.toThrow("Superfrete Tag Print error (400)");
    });
  });
});


