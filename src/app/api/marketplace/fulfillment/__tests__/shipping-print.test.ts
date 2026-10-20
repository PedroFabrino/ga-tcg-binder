import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

let testDb: any;

vi.mock("@/auth", () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: "u-print-tester" } }),
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
import { GET as printGet, POST as printPost } from "../shipping/print/route";

describe("Shipping Tag Print API Route (/api/marketplace/fulfillment/shipping/print)", () => {
  beforeEach(async () => {
    const { db } = await createTestDb();
    testDb = db;

    // Seed user with encrypted key
    const encryptedKey = encryptSecret("superfrete-test-token-print");
    await testDb.insert(users).values({
      id: "u-print-tester",
      name: "Print Tester",
      email: "print@test.com",
      friendCode: "GA-PRINT",
      mypUsername: "print-seller",
      mypPasswordEncrypted: "configured-password",
      sellerModeEnabled: true,
      superfreteApiKeyEncrypted: encryptedKey,
    });

    // Seed a released shipping ticket
    await testDb.insert(shippingTickets).values({
      id: "ticket-rel-1",
      userId: "u-print-tester",
      superfreteOrderId: "sf-order-101",
      buyerNick: "BuyerOne",
      status: "released",
      carrier: "correios",
      serviceCode: "1",
      serviceName: "PAC",
      quotedPriceCents: 2250,
      insuranceValueCents: 5000,
      trackingCode: "BR123456789BR",
      printUrl: null,
    });

    await testDb.insert(shippingTickets).values({
      id: "ticket-rel-2",
      userId: "u-print-tester",
      superfreteOrderId: "sf-order-102",
      buyerNick: "BuyerTwo",
      status: "released",
      carrier: "correios",
      serviceCode: "2",
      serviceName: "SEDEX",
      quotedPriceCents: 3500,
      insuranceValueCents: 8000,
      trackingCode: "BR987654321BR",
      printUrl: null,
    });
  });

  it("successfully generates consolidated A5 print URL for released tickets and updates DB", async () => {
    const mockPdfUrl = "https://superfrete.com/_etiqueta/pdf/consolidated-a5-labels.pdf";

    vi.spyOn(global, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes("/api/v0/tag/print")) {
        const body = JSON.parse(String(init?.body));
        expect(body.orders).toEqual(expect.arrayContaining(["sf-order-101", "sf-order-102"]));
        expect(body.mode).toBe("PDF");
        expect(body.layout).toBe("A5");
        return new Response(JSON.stringify({ url: mockPdfUrl }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("Not found", { status: 404 });
    });

    const req = new NextRequest("http://localhost:3000/api/marketplace/fulfillment/shipping/print");
    const res = await printGet(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.url).toBe(mockPdfUrl);
    expect(json.ticketCount).toBe(2);

    // Verify tickets in database have updated printUrl
    const updatedTickets = await testDb
      .select()
      .from(shippingTickets)
      .where(eq(shippingTickets.userId, "u-print-tester"));

    expect(updatedTickets.every((t: any) => t.printUrl === mockPdfUrl)).toBe(true);
  });

  it("handles download=true by proxying PDF binary stream with attachment header", async () => {
    const mockPdfUrl = "https://superfrete.com/_etiqueta/pdf/test-labels.pdf";
    const dummyPdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e]); // "%PDF-1."

    vi.spyOn(global, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/api/v0/tag/print")) {
        return new Response(JSON.stringify({ url: mockPdfUrl }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url === mockPdfUrl) {
        return new Response(dummyPdfBytes, {
          status: 200,
          headers: { "Content-Type": "application/pdf" },
        });
      }
      return new Response("Not found", { status: 404 });
    });

    const req = new NextRequest(
      "http://localhost:3000/api/marketplace/fulfillment/shipping/print?download=true"
    );
    const res = await printGet(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toContain('attachment; filename="etiquetas-superfrete-a5.pdf"');

    const bodyBuffer = await res.arrayBuffer();
    expect(new Uint8Array(bodyBuffer)).toEqual(dummyPdfBytes);
  });

  it("supports POST with specific ticketId to print an individual ticket", async () => {
    const mockPdfUrl = "https://superfrete.com/_etiqueta/pdf/single-ticket.pdf";

    vi.spyOn(global, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes("/api/v0/tag/print")) {
        const body = JSON.parse(String(init?.body));
        expect(body.orders).toEqual(["sf-order-101"]);
        return new Response(JSON.stringify({ url: mockPdfUrl }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("Not found", { status: 404 });
    });

    const req = new NextRequest("http://localhost:3000/api/marketplace/fulfillment/shipping/print", {
      method: "POST",
      body: JSON.stringify({ ticketId: "ticket-rel-1" }),
    });
    const res = await printPost(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.url).toBe(mockPdfUrl);
    expect(json.ticketCount).toBe(1);
  });

  it("handles Superfrete print error gracefully", async () => {
    vi.spyOn(global, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/api/v0/tag/print")) {
        return new Response(
          JSON.stringify({ message: "Os pedidos precisam ser pagos antes da liberação da etiqueta." }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response("Not found", { status: 404 });
    });

    const req = new NextRequest("http://localhost:3000/api/marketplace/fulfillment/shipping/print");
    const res = await printGet(req);
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toContain("Superfrete Tag Print error (400)");
  });
});
