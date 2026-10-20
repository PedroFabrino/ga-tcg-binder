import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

let testDb: any;

vi.mock("@/auth", () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: "u-confirm-sent-tester" } }),
}));

vi.mock("@/db", () => ({
  db: new Proxy(
    {},
    {
      get: (_, prop) => {
        return testDb?.[prop];
      },
    }
  ),
}));

import { createTestDb } from "@/db/test-utils";
import { users, fulfillmentOrders } from "@/db/schema";
import { POST as confirmSentPost } from "../confirm-sent/route";
import { GET as getFulfillmentOrders } from "../route";

describe("Confirm Sent API Route (/api/marketplace/fulfillment/confirm-sent)", () => {
  beforeEach(async () => {
    const { db } = await createTestDb();
    testDb = db;

    await testDb.insert(users).values({
      id: "u-confirm-sent-tester",
      name: "Confirm Tester",
      email: "confirm@test.com",
      friendCode: "GA-CONF",
      mypUsername: "confirm-seller",
      mypPasswordEncrypted: "configured-password",
      sellerModeEnabled: true,
    });

    await testDb.insert(fulfillmentOrders).values({
      id: "ord-sent-1",
      userId: "u-confirm-sent-tester",
      mypOrderId: "998877",
      orderDate: "18/10/2026",
      buyerNick: "BuyerSent",
      buyerFullName: "Sent Comprador",
      buyerStreet: "Rua das Palmeiras",
      buyerNumber: "50",
      buyerDistrict: "Jardins",
      buyerCity: "São Paulo",
      buyerStateAbbr: "SP",
      buyerPostalCode: "01400000",
      senderFullName: "Vendedor",
      senderStreet: "Rua Central",
      senderNumber: "1",
      senderDistrict: "Centro",
      senderCity: "São Paulo",
      senderStateAbbr: "SP",
      senderPostalCode: "01000000",
      subtotalCents: 5000,
      shippingCents: 1000,
      totalCents: 6000,
      status: "processed",
      shippingTicketId: "st-test-1",
      importedAt: new Date().toISOString(),
    });
  });

  it("returns 400 when orderIds are missing", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/marketplace/fulfillment/confirm-sent",
      {
        method: "POST",
        body: JSON.stringify({}),
      }
    );
    const res = await confirmSentPost(req);
    expect(res.status).toBe(400);
  });

  it("transitions processed order to sent with confirmed timestamp", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/marketplace/fulfillment/confirm-sent",
      {
        method: "POST",
        body: JSON.stringify({ orderIds: ["ord-sent-1"] }),
      }
    );
    const res = await confirmSentPost(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.count).toBe(1);

    // Verify GET /api/marketplace/fulfillment?status=processed returns 0
    const processedReq = new NextRequest(
      "http://localhost:3000/api/marketplace/fulfillment?status=processed"
    );
    const processedRes = await getFulfillmentOrders(processedReq);
    const processedOrders = await processedRes.json();
    expect(processedOrders).toHaveLength(0);

    // Verify GET /api/marketplace/fulfillment?status=sent returns the order
    const sentReq = new NextRequest(
      "http://localhost:3000/api/marketplace/fulfillment?status=sent"
    );
    const sentRes = await getFulfillmentOrders(sentReq);
    const sentOrders = await sentRes.json();
    expect(sentOrders).toHaveLength(1);
    expect(sentOrders[0].id).toBe("ord-sent-1");
    expect(sentOrders[0].status).toBe("sent");
    expect(sentOrders[0].mypConfirmedAt).not.toBeNull();
  });
});
