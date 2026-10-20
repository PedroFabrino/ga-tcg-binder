import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";

let testDb: any;

vi.mock("@/auth", () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: "u-fulfillment" } }),
}));

vi.mock("@/db", () => ({
  db: new Proxy({}, {
    get: (_, prop) => {
      return testDb?.[prop];
    },
  }),
}));

import { createTestDb } from "@/db/test-utils";
import { cards, cardEditions } from "@/db/schema";
import { OPTIONS, POST, GET } from "../route";

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

    const { users } = await import("@/db/schema");
    await testDb.insert(users).values({
      id: "u-fulfillment",
      name: "Fulfillment User",
      email: "fulfill@test.com",
      friendCode: "GA-FULF",
      mypUsername: "fulfillment-seller",
      mypPasswordEncrypted: "configured-password",
      sellerModeEnabled: true,
      watchlistSyncToken: "valid-sync-token-123",
    });
  });

  it("handles OPTIONS request with correct CORS headers", async () => {
    const res = await OPTIONS();
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(res.headers.get("access-control-allow-methods")).toContain("POST");
    expect(res.headers.get("access-control-allow-headers")).toContain("Content-Type");
    expect(res.headers.get("access-control-allow-headers")).toContain("X-GA-User-Id");
    expect(res.headers.get("access-control-allow-headers")).toContain("X-GA-Sync-Token");
  });


  it("returns 404 when the authenticated user does not have vendor capability", async () => {
    const { users } = await import("@/db/schema");
    await testDb
      .update(users)
      .set({ sellerModeEnabled: false })
      .where(eq(users.id, "u-fulfillment"));

    const res = await GET(new NextRequest("http://localhost:3000/api/marketplace/fulfillment"));

    expect(res.status).toBe(404);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
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

    // Verify GET retrieves persisted orders
    const getReq = new NextRequest("http://localhost:3000/api/marketplace/fulfillment");
    const { GET, PATCH } = await import("../route");
    const getRes = await GET(getReq);
    expect(getRes.status).toBe(200);
    const persisted = await getRes.json();
    expect(persisted).toHaveLength(1);
    expect(persisted[0].mypOrderId).toBe("654326");
    expect(persisted[0].status).toBe("open");
    expect(persisted[0].isPhotographed).toBe(false);

    // Verify PATCH toggles isPhotographed
    const patchReq = new NextRequest("http://localhost:3000/api/marketplace/fulfillment", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: persisted[0].id, isPhotographed: true }),
    });
    const patchRes = await PATCH(patchReq);
    expect(patchRes.status).toBe(200);

    const afterPatchRes = await GET(getReq);
    const afterPatch = await afterPatchRes.json();
    expect(afterPatch[0].isPhotographed).toBe(true);
  });

  it("authenticates via cross-origin bridge headers X-GA-User-Id and X-GA-Sync-Token when session is null", async () => {
    const { auth } = await import("@/auth");
    (auth as any).mockResolvedValueOnce(null);

    const payload = [
      {
        orderId: "777888",
        orderDate: "18/10/2026",
        buyerNick: "BridgeBuyer",
        shippingMethod: "PAC",
        status: "Aguard. envio",
        orderUrl: "https://mypcards.com/pedido/777888",
        items: [
          {
            rawTitle: "Void's Cloak",
            mypCode: "grandarchive_rdo_029",
            condition: "NM",
            language: "EN",
            isFoil: false,
            quantity: 1,
            unitPriceBrl: "R$ 10,00",
          },
        ],
      },
    ];

    const req = new NextRequest("http://localhost:3000/api/marketplace/fulfillment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-GA-User-Id": "u-fulfillment",
        "X-GA-Sync-Token": "valid-sync-token-123",
      },
      body: JSON.stringify(payload),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const report = await res.json();
    expect(report.totalGrandArchiveOrders).toBe(1);

    // Verify it was persisted under u-fulfillment
    const getReq = new NextRequest("http://localhost:3000/api/marketplace/fulfillment");
    const { GET } = await import("../route");
    const getRes = await GET(getReq);
    const persisted = await getRes.json();
    expect(persisted.some((o: any) => o.mypOrderId === "777888")).toBe(true);
  });

  it("allows stateless enrichment without auth when mode=enrich", async () => {
    const { auth } = await import("@/auth");
    (auth as any).mockResolvedValueOnce(null);

    const payload = [
      {
        orderId: "999000",
        orderDate: "18/10/2026",
        buyerNick: "StatelessBuyer",
        shippingMethod: "Sedex",
        status: "Aguard. envio",
        orderUrl: "https://mypcards.com/pedido/999000",
        items: [
          {
            rawTitle: "Void's Cloak",
            mypCode: "grandarchive_rdo_029",
            condition: "NM",
            language: "EN",
            isFoil: false,
            quantity: 2,
            unitPriceBrl: "R$ 12,00",
          },
        ],
      },
    ];

    const req = new NextRequest("http://localhost:3000/api/marketplace/fulfillment?mode=enrich", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const report = await res.json();
    expect(report.totalGrandArchiveCopies).toBe(2);
  });

  it("returns 401 when session is null, bridge token is invalid, and mode!=enrich", async () => {
    const { auth } = await import("@/auth");
    (auth as any).mockResolvedValueOnce(null);

    const req = new NextRequest("http://localhost:3000/api/marketplace/fulfillment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-GA-User-Id": "u-fulfillment",
        "X-GA-Sync-Token": "invalid-token",
      },
      body: JSON.stringify([]),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain("Unauthorized");
  });

  it("reconstructs fulfillment report from open DB orders with format=report", async () => {
    // 1. Post orders so they are persisted to DB
    const payload = [
      {
        orderId: "888111",
        orderDate: "18/10/2026",
        buyerNick: "PersistedBuyer",
        shippingMethod: "PAC",
        status: "Aguard. envio",
        orderUrl: "https://mypcards.com/pedido/888111",
        items: [
          {
            rawTitle: "Void's Cloak",
            mypCode: "grandarchive_rdo_029",
            condition: "NM",
            language: "EN",
            isFoil: false,
            quantity: 3,
            unitPriceBrl: "R$ 15,00",
          },
        ],
      },
    ];

    const postReq = new NextRequest("http://localhost:3000/api/marketplace/fulfillment", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    await POST(postReq);

    // 2. Call GET with format=report
    const getReq = new NextRequest("http://localhost:3000/api/marketplace/fulfillment?format=report");
    const getRes = await GET(getReq);
    expect(getRes.status).toBe(200);

    const report = await getRes.json();
    expect(report.totalGrandArchiveOrders).toBe(1);
    expect(report.totalGrandArchiveCopies).toBe(3);
    expect(report.buyerPacks).toHaveLength(1);
    expect(report.buyerPacks[0].buyerNick).toBe("PersistedBuyer");
    expect(report.pickListByElement.Norm).toBeDefined();
    expect(report.pickListByElement.Norm[0].totalQuantity).toBe(3);
  });
});


