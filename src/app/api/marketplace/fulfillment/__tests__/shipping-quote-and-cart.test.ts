import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

let testDb: any;

vi.mock("@/auth", () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: "u-fulfillment-shipping" } }),
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
import { users, fulfillmentOrders, fulfillmentOrderPrintings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { encryptSecret } from "@/lib/crypto";
import { POST as quotePost } from "../shipping/quote/route";
import { POST as createTicketsPost } from "../shipping/create-tickets/route";
import { GET as getTickets, DELETE as deleteTicket } from "../shipping/route";
import { GET as getFulfillmentOrders } from "../route";

describe("Shipping Quote and Cart API Routes", () => {
  beforeEach(async () => {
    const { db } = await createTestDb();
    testDb = db;

    // Seed user without superfrete key initially
    await testDb.insert(users).values({
      id: "u-fulfillment-shipping",
      name: "Shipping Tester",
      email: "shipping@test.com",
      friendCode: "GA-SHIP",
    });

    // Seed open fulfillment order
    await testDb.insert(fulfillmentOrders).values({
      id: "ord-1",
      userId: "u-fulfillment-shipping",
      mypOrderId: "777001",
      orderDate: "18/10/2026",
      buyerNick: "GrandBuyer",
      buyerFullName: "Carlos Comprador",
      buyerStreet: "Rua das Flores",
      buyerNumber: "123",
      buyerDistrict: "Centro",
      buyerCity: "Rio de Janeiro",
      buyerStateAbbr: "RJ",
      buyerPostalCode: "20040002",
      senderFullName: "Vendedor TCG",
      senderStreet: "Av Paulista",
      senderNumber: "1000",
      senderDistrict: "Bela Vista",
      senderCity: "São Paulo",
      senderStateAbbr: "SP",
      senderPostalCode: "01310100",
      subtotalCents: 1500, // R$ 15,00
      shippingCents: 500,  // R$ 5,00
      totalCents: 2000,     // R$ 20,00 (insurance floor will clamp to 24.50 for PAC/SEDEX)
      shippingMethod: "Frete combinado com o vendedor",
      status: "open",
      isPhotographed: true,
      importedAt: new Date().toISOString(),
    });

    await testDb.insert(fulfillmentOrderPrintings).values({
      id: "prt-1",
      fulfillmentOrderId: "ord-1",
      cardName: "Tristan, Shadow Dancer",
      quantity: 1,
      mypCode: "grandarchive_doa_001",
    });
  });

  it("returns 400 when user has not configured Superfrete API key", async () => {
    const res = await quotePost();
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("SUPERFRETE_API_KEY_NOT_CONFIGURED");
  });

  it("quotes open Buyer Packs and selects preferred Loggi quote", async () => {
    // Configure user's encrypted Superfrete API key
    const encryptedKey = encryptSecret("superfrete-test-token-xyz");
    await testDb
      .update(users)
      .set({ superfreteApiKeyEncrypted: encryptedKey })
      .where(eq(users.id, "u-fulfillment-shipping"));

    // Mock global fetch for Superfrete Calculator
    const mockQuotes = [
      {
        id: 1,
        name: "PAC",
        price: "12.00",
        company: { name: "Correios" },
        has_error: false,
      },
      {
        id: 31,
        name: "Loggi Express",
        price: "15.00",
        company: { name: "Loggi" },
        has_error: false,
      },
    ];

    const fetchSpy = vi.spyOn(global, "fetch").mockImplementation(async (url: any, init: any) => {
      const urlStr = String(url);
      if (urlStr.includes("/api/v0/calculator")) {
        const payload = JSON.parse(init.body);
        expect(payload.from.postal_code).toBe("01310100");
        expect(payload.to.postal_code).toBe("20040002");
        expect(payload.package.height).toBe(2);
        expect(payload.package.width).toBe(21);
        expect(payload.package.length).toBe(30);
        expect(payload.package.weight).toBe(0.208);
        expect(payload.options.insurance_value).toBe(24.5); // Clamped from 20.00 to 24.50 floor

        return new Response(JSON.stringify(mockQuotes), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
    });

    const res = await quotePost();
    expect(res.status).toBe(200);
    const packs = await res.json();

    expect(packs).toHaveLength(1);
    expect(packs[0].buyerNick).toBe("GrandBuyer");
    expect(packs[0].isReadyForShipping).toBe(true);
    expect(packs[0].insuranceValueBrl).toBe(24.5);
    expect(packs[0].recommendedQuote?.id).toBe(31); // Loggi preferred over cheaper Correios
    expect(packs[0].recommendedQuote?.name).toBe("Loggi Express");

    fetchSpy.mockRestore();
  });

  it("creates cart tickets in Superfrete and transitions orders to processed atomically", async () => {
    // Configure user's encrypted Superfrete API key
    const encryptedKey = encryptSecret("superfrete-test-token-xyz");
    await testDb
      .update(users)
      .set({ superfreteApiKeyEncrypted: encryptedKey })
      .where(eq(users.id, "u-fulfillment-shipping"));

    // Mock Superfrete Cart
    const mockCartResponse = {
      id: 987654,
      status: "pending",
      price: 15.0,
      protocol: "SF-PROTO-987",
    };

    const fetchSpy = vi.spyOn(global, "fetch").mockImplementation(async (url: any, init: any) => {
      const urlStr = String(url);
      if (urlStr.includes("/api/v0/cart")) {
        const payload = JSON.parse(init.body);
        expect(payload.service).toBe(31);
        expect(payload.volumes.weight).toBe(0.208);
        expect(payload.to.state_abbr).toBe("RJ");
        expect(payload.from.state_abbr).toBe("SP");
        expect(payload.options.insurance_value).toBe(20.0); // For Loggi (service 31), exact value is 20.00
        expect(payload.products).toHaveLength(1);
        expect(payload.products[0].unitary_value).toBe(20.0);

        return new Response(JSON.stringify(mockCartResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (urlStr.includes("/api/v0/order/cancel")) {
        return new Response(JSON.stringify({ "987654": { canceled: true } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
    });

    const createReq = new NextRequest(
      "http://localhost:3000/api/marketplace/fulfillment/shipping/create-tickets",
      {
        method: "POST",
        body: JSON.stringify({
          packs: [
            {
              buyerNick: "GrandBuyer",
              selectedServiceCode: "31",
              selectedServiceName: "Loggi Express",
              quotedPriceBrl: 15.0,
            },
          ],
        }),
      }
    );

    const createRes = await createTicketsPost(createReq);
    expect(createRes.status).toBe(200);
    const createData = await createRes.json();
    expect(createData.success).toBe(true);
    expect(createData.tickets).toHaveLength(1);
    expect(createData.tickets[0].superfreteOrderId).toBe("987654");
    expect(createData.tickets[0].status).toBe("pending");

    // Verify order ord-1 is now processed
    const getOpenReq = new NextRequest(
      "http://localhost:3000/api/marketplace/fulfillment?status=open"
    );
    const openRes = await getFulfillmentOrders(getOpenReq);
    const openOrders = await openRes.json();
    expect(openOrders).toHaveLength(0); // ord-1 is no longer open

    const getProcessedReq = new NextRequest(
      "http://localhost:3000/api/marketplace/fulfillment?status=processed"
    );
    const processedRes = await getFulfillmentOrders(getProcessedReq);
    const processedOrders = await processedRes.json();
    expect(processedOrders).toHaveLength(1);
    expect(processedOrders[0].id).toBe("ord-1");
    expect(processedOrders[0].status).toBe("processed");
    expect(processedOrders[0].shippingTicketId).toBe(createData.tickets[0].id);

    // Verify GET /api/marketplace/fulfillment/shipping lists the ticket
    const listReq = new NextRequest("http://localhost:3000/api/marketplace/fulfillment/shipping");
    const listRes = await getTickets(listReq);
    expect(listRes.status).toBe(200);
    const tickets = await listRes.json();
    expect(tickets).toHaveLength(1);
    expect(tickets[0].buyerNick).toBe("GrandBuyer");
    expect(tickets[0].superfreteOrderId).toBe("987654");

    // Verify DELETE /api/marketplace/fulfillment/shipping cancels ticket and reverts ord-1 to open
    const deleteReq = new NextRequest(
      `http://localhost:3000/api/marketplace/fulfillment/shipping?ticketId=${createData.tickets[0].id}`,
      { method: "DELETE" }
    );
    const deleteRes = await deleteTicket(deleteReq);
    expect(deleteRes.status).toBe(200);
    const deleteData = await deleteRes.json();
    expect(deleteData.success).toBe(true);
    expect(deleteData.canceledSuperfrete).toBe(true);

    // Verify order is now open again with no shippingTicketId
    const reopenedRes = await getFulfillmentOrders(getOpenReq);
    const reopenedOrders = await reopenedRes.json();
    expect(reopenedOrders).toHaveLength(1);
    expect(reopenedOrders[0].id).toBe("ord-1");
    expect(reopenedOrders[0].status).toBe("open");
    expect(reopenedOrders[0].shippingTicketId).toBeNull();

    fetchSpy.mockRestore();
  });
});
