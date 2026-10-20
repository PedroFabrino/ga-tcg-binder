import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

let testDb: any;

vi.mock("@/auth", () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: "u-sync-tester" } }),
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
import { users, fulfillmentOrders, shippingTickets } from "@/db/schema";
import { eq } from "drizzle-orm";
import { encryptSecret } from "@/lib/crypto";
import { POST as syncPost } from "../shipping/sync/route";
import { GET as getShippingTicketsRoute } from "../shipping/route";

describe("Shipping Tracking Sync API Route (/api/marketplace/fulfillment/shipping/sync)", () => {
  beforeEach(async () => {
    const { db } = await createTestDb();
    testDb = db;

    // Seed user with encrypted key
    const encryptedKey = encryptSecret("superfrete-test-token-sync");
    await testDb.insert(users).values({
      id: "u-sync-tester",
      name: "Sync Tester",
      email: "sync@test.com",
      friendCode: "GA-SYNC",
      mypUsername: "sync-seller",
      mypPasswordEncrypted: "configured-password",
      sellerModeEnabled: true,
      superfreteApiKeyEncrypted: encryptedKey,
    });

    // Seed a pending shipping ticket
    await testDb.insert(shippingTickets).values({
      id: "ticket-pending-1",
      userId: "u-sync-tester",
      superfreteOrderId: "991122",
      buyerNick: "BuyerAlpha",
      status: "pending",
      carrier: "loggi",
      serviceCode: "31",
      serviceName: "Loggi Express",
      quotedPriceCents: 1650,
      insuranceValueCents: 3500,
      trackingCode: null,
      printUrl: null,
    });

    // Seed linked fulfillment order
    await testDb.insert(fulfillmentOrders).values({
      id: "ord-sync-1",
      userId: "u-sync-tester",
      mypOrderId: "888111",
      orderDate: "18/10/2026",
      buyerNick: "BuyerAlpha",
      buyerFullName: "Alpha Comprador",
      buyerStreet: "Rua Alpha",
      buyerNumber: "1",
      buyerDistrict: "Bairro",
      buyerCity: "Curitiba",
      buyerStateAbbr: "PR",
      buyerPostalCode: "80000000",
      senderFullName: "Vendedor",
      senderStreet: "Rua Vendedor",
      senderNumber: "2",
      senderDistrict: "Bairro",
      senderCity: "São Paulo",
      senderStateAbbr: "SP",
      senderPostalCode: "01000000",
      subtotalCents: 3000,
      shippingCents: 500,
      totalCents: 3500,
      status: "processed",
      shippingTicketId: "ticket-pending-1",
      importedAt: new Date().toISOString(),
    });
  });

  it("syncs tracking and label print URL, transitioning status to released", async () => {
    const mockOrderInfo = {
      id: 991122,
      status: "released",
      tracking: "BR991122LOGGI",
      print: {
        url: "https://web.superfrete.com/print/991122.pdf",
      },
    };

    const fetchSpy = vi.spyOn(global, "fetch").mockImplementation(async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes("/api/v0/order/info/991122")) {
        return new Response(JSON.stringify(mockOrderInfo), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
    });

    const res = await syncPost();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.tickets).toHaveLength(1);
    expect(body.tickets[0].status).toBe("released");
    expect(body.tickets[0].trackingCode).toBe("BR991122LOGGI");
    expect(body.tickets[0].printUrl).toBe("https://web.superfrete.com/print/991122.pdf");

    // Verify GET /api/marketplace/fulfillment/shipping?withOrders=true returns synced ticket with orders
    const getReq = new NextRequest(
      "http://localhost:3000/api/marketplace/fulfillment/shipping?withOrders=true"
    );
    const getRes = await getShippingTicketsRoute(getReq);
    expect(getRes.status).toBe(200);
    const tickets = await getRes.json();
    expect(tickets).toHaveLength(1);
    expect(tickets[0].status).toBe("released");
    expect(tickets[0].trackingCode).toBe("BR991122LOGGI");
    expect(tickets[0].orders).toHaveLength(1);
    expect(tickets[0].orders[0].mypOrderId).toBe("888111");

    fetchSpy.mockRestore();
  });

  it("preserves existing tracking info idempotently when provider response omits it", async () => {
    // Set existing tracking
    await testDb
      .update(shippingTickets)
      .set({
        trackingCode: "ALREADY_SAVED_CODE",
        printUrl: "https://existing.pdf",
        status: "released",
      })
      .where(eq(shippingTickets.id, "ticket-pending-1"));

    // Provider response omits tracking
    const mockIncompleteInfo = {
      id: 991122,
      status: "released",
    };

    const fetchSpy = vi.spyOn(global, "fetch").mockImplementation(async (url: any) => {
      return new Response(JSON.stringify(mockIncompleteInfo), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const res = await syncPost();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tickets[0].trackingCode).toBe("ALREADY_SAVED_CODE");
    expect(body.tickets[0].printUrl).toBe("https://existing.pdf");

    fetchSpy.mockRestore();
  });

  it("handles provider error gracefully without failing the entire sync batch", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockImplementation(async () => {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429 });
    });

    const res = await syncPost();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.tickets).toHaveLength(0); // Failed ticket was skipped safely

    fetchSpy.mockRestore();
  });

  it("automatically reverts linked orders to open when ticket is cancelled on Superfrete", async () => {
    const mockCancelledInfo = {
      id: 991122,
      status: "cancelled",
    };

    const fetchSpy = vi.spyOn(global, "fetch").mockImplementation(async () => {
      return new Response(JSON.stringify(mockCancelledInfo), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const res = await syncPost();
    expect(res.status).toBe(200);

    // Verify ticket was removed
    const tickets = await testDb.select().from(shippingTickets);
    expect(tickets).toHaveLength(0);

    // Verify order was reverted to open
    const orders = await testDb.select().from(fulfillmentOrders);
    expect(orders).toHaveLength(1);
    expect(orders[0].status).toBe("open");
    expect(orders[0].shippingTicketId).toBeNull();

    fetchSpy.mockRestore();
  });
});

