import React from "react";
import { describe, it, expect, vi } from "vitest";

// Ensure React is present on globalThis in Node test environment for JSX static markup
vi.stubGlobal("React", React);
import { renderToStaticMarkup } from "react-dom/server";
import { FulfillmentTicketCard } from "../FulfillmentTicketCard";
import type { ShippingTicketDTO } from "@ga/contracts";
import { enCatalog } from "@ga/contracts";

function mockT(key: string, vars?: Record<string, string | number>): string {
  const parts = key.split(".");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let val: any = enCatalog;
  for (const p of parts) {
    val = val?.[p];
  }
  let str = typeof val === "string" ? val : key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
  }
  return str;
}

const mockTicketWithTracking: ShippingTicketDTO = {
  id: "ticket-123",
  userId: "user-1",
  superfreteOrderId: "sf-999",
  buyerNick: "Betinho3",
  status: "released",
  carrier: "correios",
  serviceCode: "1",
  serviceName: "PAC",
  quotedPriceCents: 2450,
  insuranceValueCents: 15000,
  trackingCode: "BR123456789",
  printUrl: "https://superfrete.com/print/123",
  providerPayloadJson: null,
  synchronizedAt: "2026-10-19T10:00:00Z",
  createdAt: "2026-10-19T10:00:00Z",
  updatedAt: "2026-10-19T10:00:00Z",
  orders: [
    {
      id: "ord-1",
      userId: "user-1",
      mypOrderId: "654317",
      status: "processed",
      shippingTicketId: "ticket-123",
      buyerNick: "Betinho3",
      buyerFullName: "Roberto Silva",
      orderDate: "16/10/2026",
      totalCents: 8000,
      printings: [],
    } as unknown as NonNullable<ShippingTicketDTO["orders"]>[number],
    {
      id: "ord-2",
      userId: "user-1",
      mypOrderId: "654326",
      status: "processed",
      shippingTicketId: "ticket-123",
      buyerNick: "Betinho3",
      buyerFullName: "Roberto Silva",
      orderDate: "17/10/2026",
      totalCents: 5000,
      printings: [],
    } as unknown as NonNullable<ShippingTicketDTO["orders"]>[number],
  ],
};

const mockTicketWithoutTracking: ShippingTicketDTO = {
  ...mockTicketWithTracking,
  id: "ticket-456",
  status: "pending",
  trackingCode: null,
};

describe("FulfillmentTicketCard", () => {
  it("renders a prominent Confirm Shipping button by the side of each order when tracking exists", () => {
    const html = renderToStaticMarkup(
      <FulfillmentTicketCard
        ticket={mockTicketWithTracking}
        t={mockT}
        onCopyTracking={vi.fn()}
        onOpenMyPConfirm={vi.fn()}
        onMarkAsSent={vi.fn()}
        onCancelTicket={vi.fn()}
        renderStatusBadge={(status) => <span>{status}</span>}
      />
    );

    // Each order is displayed
    expect(html).toContain("#654317");
    expect(html).toContain("#654326");

    // Each order has a prominent "Confirm Shipping" button
    expect(html).toContain("Confirm Shipping");
    expect(html).toContain('aria-label="Confirm Shipping - #654317"');
    expect(html).toContain('aria-label="Confirm Shipping - #654326"');

    // The buttons are not disabled when trackingCode is present
    expect(html).toContain("bg-emerald-600");
  });

  it("renders the Confirm Shipping button disabled with trackingRequired tooltip when tracking is missing", () => {
    const html = renderToStaticMarkup(
      <FulfillmentTicketCard
        ticket={mockTicketWithoutTracking}
        t={mockT}
        onCopyTracking={vi.fn()}
        onOpenMyPConfirm={vi.fn()}
        onMarkAsSent={vi.fn()}
        onCancelTicket={vi.fn()}
        renderStatusBadge={(status) => <span>{status}</span>}
      />
    );

    // Each order is displayed
    expect(html).toContain("#654317");
    expect(html).toContain("#654326");

    // Buttons are disabled and show required tracking tooltip
    expect(html).toContain("disabled");
    expect(html).toContain('title="Tracking code required to confirm shipping"');
  });
});
