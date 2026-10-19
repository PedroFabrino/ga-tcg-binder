import React from "react";
import { describe, it, expect, vi } from "vitest";

vi.stubGlobal("React", React);
import { renderToStaticMarkup } from "react-dom/server";
import FulfillmentShippingModal from "../FulfillmentShippingModal";
import type { QuotedBuyerPack } from "@/services/superfrete";
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

const mockPackWithoutDocument: QuotedBuyerPack = {
  buyerNick: "LOOTCARDS",
  orderIds: ["ord-loot-1", "ord-loot-2"],
  ordersCount: 2,
  isReadyForShipping: true,
  containsUnphotographedOrders: true,
  recipient: {
    fullName: "65.033.705 MARIA APARECIDA SOLDERA BIANCALANA",
    document: null,
    street: "Rua das Acácias",
    number: "100",
    complement: null,
    district: "Barão Geraldo",
    city: "Campinas",
    stateAbbr: "SP",
    postalCode: "13084776",
  },
  insuranceValueBrl: 79.2,
  totalCards: 16,
  packageWeightKg: 0.253,
  quotes: [
    {
      id: 31,
      name: "LOGGI",
      price: "15.50",
      delivery_time: 2,
      has_error: false,
    },
  ],
  recommendedQuote: {
    id: 31,
    name: "LOGGI",
    price: "15.50",
    delivery_time: 2,
    has_error: false,
  },
  selectedServiceCode: "31",
};

describe("FulfillmentShippingModal", () => {
  it("renders editable CPF/CNPJ input and warning when recipient document is missing", () => {
    const html = renderToStaticMarkup(
      <FulfillmentShippingModal
        isOpen={true}
        onClose={vi.fn()}
        quotedPacks={[mockPackWithoutDocument]}
        onConfirm={vi.fn()}
      />
    );

    expect(html).toContain("65.033.705 MARIA APARECIDA SOLDERA BIANCALANA (LOOTCARDS)");
    expect(html).toContain("Recipient CPF/CNPJ");
    expect(html).toContain("11 digits (CPF) or 14 digits (CNPJ) required");
  });

  it("does not render when isOpen is false", () => {
    const html = renderToStaticMarkup(
      <FulfillmentShippingModal
        isOpen={false}
        onClose={vi.fn()}
        quotedPacks={[mockPackWithoutDocument]}
        onConfirm={vi.fn()}
      />
    );

    expect(html).toBe("");
  });
});
