import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

let testDb: any;

vi.mock("@/db", () => ({
  db: new Proxy({}, {
    get: (_, prop) => {
      return testDb?.[prop];
    },
  }),
}));

import { createTestDb } from "@/db/test-utils";
import { cards, cardEditions } from "@/db/schema";
import { OPTIONS, POST } from "../route";

describe("Fulfillment API Route (/api/marketplace/fulfillment)", () => {
  beforeEach(async () => {
    const { db } = await createTestDb();
    testDb = db;

    await testDb.insert(cards).values({
      slug: "voids-cloak",
      name: "Void's Cloak",
      element: "NORM",
      class: "ASSASSIN",
      type: "ITEM",
      subtypes: "[]",
      effect: null,
    });

    await testDb.insert(cardEditions).values({
      id: "ed-void-1",
      cardSlug: "voids-cloak",
      setPrefix: "RDO",
      setName: "Radiant Origins",
      collectorNumber: "029",
      rarity: 1,
      imageUrl: "https://api.gatcg.com/cards/images/rdo_029.jpg",
    });
  });

  it("handles OPTIONS request with correct CORS headers", async () => {
    const res = await OPTIONS();
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(res.headers.get("access-control-allow-methods")).toContain("POST");
    expect(res.headers.get("access-control-allow-headers")).toContain("Content-Type");
  });

  it("returns 400 when body does not match validation schema", async () => {
    const req = new NextRequest("http://localhost:3000/api/marketplace/fulfillment", {
      method: "POST",
      body: JSON.stringify({ invalidField: 123 }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("enriches valid fulfillment orders statelessly and returns structured report with CORS", async () => {
    const payload = [
      {
        orderId: "654326",
        orderDate: "17/10/2026",
        buyerNick: "Betinho3",
        shippingMethod: "Frete combinado com o vendedor",
        status: "Aguard. envio",
        orderUrl: "https://mypcards.com/pedido/654326",
        items: [
          {
            rawTitle: "Void's Cloak",
            mypCode: "grandarchive_rdo_029",
            condition: "NM",
            language: "EN",
            isFoil: false,
            quantity: 1,
            unitPriceBrl: "R$ 7,00",
          },
        ],
      },
    ];

    const req = new NextRequest("http://localhost:3000/api/marketplace/fulfillment", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");

    const report = await res.json();
    expect(report.totalGrandArchiveOrders).toBe(1);
    expect(report.totalGrandArchiveCopies).toBe(1);
    expect(report.pickListByElement.Norm).toHaveLength(1);
    expect(report.pickListByElement.Norm[0].cardName).toBe("Void's Cloak");
    expect(report.buyerPacks).toHaveLength(1);
    expect(report.buyerPacks[0].buyerNick).toBe("Betinho3");
  });
});
