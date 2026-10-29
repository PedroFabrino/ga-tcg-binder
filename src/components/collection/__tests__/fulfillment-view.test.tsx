import React from "react";
import { describe, it, expect, vi } from "vitest";

// Ensure React is present on globalThis in Node test environment for JSX static markup
vi.stubGlobal("React", React);
import { renderToStaticMarkup } from "react-dom/server";
import { FulfillmentReport } from "@ga/contracts";
import FulfillmentPickList from "../FulfillmentPickList";
import FulfillmentBuyerPacks from "../FulfillmentBuyerPacks";
import FulfillmentView from "../FulfillmentView";
import FulfillmentHeader from "../FulfillmentHeader";
import { I18nProvider } from "@/lib/i18n";
import { ToastProvider } from "@/components/ToastProvider";

const mockReport: FulfillmentReport = {
  generatedAt: 1234567890,
  totalGrandArchiveOrders: 2,
  totalGrandArchiveCopies: 3,
  pickListByElement: {
    Norm: [
      {
        itemKey: "norm_item",
        cardSlug: "voids-cloak",
        cardName: "Void's Cloak",
        element: "Norm",
        setPrefix: "RDO",
        collectorNumber: "029",
        rarity: 1,
        imageUrl: "https://api.gatcg.com/cards/images/rdo_029.jpg",
        condition: "NM",
        isFoil: false,
        totalQuantity: 1,
        orderReferences: [{ orderId: "654326", buyerNick: "Betinho3", quantity: 1 }],
      },
    ],
    Water: [
      {
        itemKey: "water_item",
        cardSlug: "creative-shock",
        cardName: "Creative Shock",
        element: "Water",
        setPrefix: "DOA",
        collectorNumber: "001",
        rarity: 2,
        imageUrl: "https://api.gatcg.com/cards/images/doa_001.jpg",
        condition: "NM",
        isFoil: true,
        totalQuantity: 2,
        orderReferences: [{ orderId: "654317", buyerNick: "Betinho3", quantity: 2 }],
      },
    ],
  },
  buyerPacks: [
    {
      buyerNick: "Betinho3",
      totalOrders: 2,
      totalItems: 3,
      shippingMethods: ["Frete combinado com o vendedor", "PAC"],
      primaryShippingMethod: "PAC",
      orders: [
        {
          orderId: "654317",
          orderDate: "16/10/2026",
          shippingMethod: "PAC",
          status: "Aguard. envio",
          orderUrl: "https://mypcards.com/pedido/654317",
          items: [
            {
              itemKey: "water_item",
              isGrandArchive: true,
              cardSlug: "creative-shock",
              cardName: "Creative Shock",
              element: "Water",
              setPrefix: "DOA",
              collectorNumber: "001",
              rarity: 2,
              imageUrl: null,
              condition: "NM",
              isFoil: true,
              quantity: 2,
              unitPriceBrl: "R$ 40,00",
              mypCode: "grandarchive_doa_001",
            },
          ],
        },
        {
          orderId: "654326",
          orderDate: "17/10/2026",
          shippingMethod: "Frete combinado com o vendedor",
          status: "Aguard. envio",
          orderUrl: "https://mypcards.com/pedido/654326",
          items: [
            {
              itemKey: "norm_item",
              isGrandArchive: true,
              cardSlug: "voids-cloak",
              cardName: "Void's Cloak",
              element: "Norm",
              setPrefix: "RDO",
              collectorNumber: "029",
              rarity: 1,
              imageUrl: null,
              condition: "NM",
              isFoil: false,
              quantity: 1,
              unitPriceBrl: "R$ 7,00",
              mypCode: "grandarchive_rdo_029",
            },
          ],
        },
      ],
    },
  ],
  nonGrandArchiveOrders: [
    {
      orderId: "654999",
      orderDate: "14/10/2026",
      buyerNick: "PokeCollector",
      orderUrl: "https://mypcards.com/pedido/654999",
      detectedTcg: "pokemon",
      itemCount: 1,
    },
  ],
};

function renderWithProviders(ui: React.ReactElement) {
  return renderToStaticMarkup(
    <I18nProvider>
      <ToastProvider>{ui}</ToastProvider>
    </I18nProvider>
  );
}

describe("Fulfillment UI Components", () => {
  it("renders FulfillmentPickList with Element groups, card names, badges and order references", () => {
    const html = renderWithProviders(<FulfillmentPickList report={mockReport} />);

    // Check Element groups
    expect(html).toContain("Norm");
    expect(html).toContain("Water");

    // Check card details
    expect(html).toContain("Void&#x27;s Cloak");
    expect(html).toContain("Creative Shock");
    expect(html).toContain("RDO #029");
    expect(html).toContain("DOA #001");
    expect(html).toContain("x1");
    expect(html).toContain("x2");

    // Check Foil badge (canonical English Game Nomenclature)
    expect(html).toContain("Foil");

    // Check order references
    expect(html).toContain("#654326");
    expect(html).toContain("#654317");
  });

  it("renders FulfillmentBuyerPacks with buyer consolidation, shipping badges and sub-orders", () => {
    const html = renderWithProviders(<FulfillmentBuyerPacks report={mockReport} />);

    // Check buyer details
    expect(html).toContain("Betinho3");
    expect(html).toContain("PAC");

    // Check sub-orders
    expect(html).toContain("#654317");
    expect(html).toContain("#654326");
    expect(html).toContain("https://mypcards.com/pedido/654317");
    expect(html).toContain("https://mypcards.com/pedido/654326");
  });

  it("hides the shipping action when shipping capability is unavailable", () => {
    const html = renderWithProviders(
      <FulfillmentHeader
        report={mockReport}
        lifecycleTab="open"
        hasShippingCapability={false}
        isQuotingShipping={false}
        onSelectTab={() => {}}
        onOpenShippingModal={() => {}}
        onCopyText={() => {}}
        onClearBatch={() => {}}
      />
    );

    expect(html).not.toContain("Generate Shipping");
  });

  it("renders the shipping action when shipping capability is available", () => {
    const html = renderWithProviders(
      <FulfillmentHeader
        report={mockReport}
        lifecycleTab="open"
        hasShippingCapability
        isQuotingShipping={false}
        onSelectTab={() => {}}
        onOpenShippingModal={() => {}}
        onCopyText={() => {}}
        onClearBatch={() => {}}
      />
    );

    expect(html).toContain("Generate Shipping");
  });

  it("renders FulfillmentView empty state when no batch is loaded", () => {
    // Empty state (no localStorage)
    const html = renderWithProviders(<FulfillmentView />);
    expect(html).toContain("No active fulfillment batch");
    expect(html).toContain("Open MyP Vendas");
  });

  it("renders persistent commentary field below each card in Pick List and Buyer Packs", () => {
    const notes = { water_item: "didnt find 4, only 3, is it ok?" };
    const pickHtml = renderWithProviders(
      <FulfillmentPickList report={mockReport} cardNotes={notes} />
    );
    const buyerHtml = renderWithProviders(
      <FulfillmentBuyerPacks report={mockReport} cardNotes={notes} />
    );

    expect(pickHtml).toContain("didnt find 4, only 3, is it ok?");
    expect(buyerHtml).toContain("didnt find 4, only 3, is it ok?");
  });

  it("renders full screen with empty Open state and tabs when DB has entries but no open orders", () => {
    const html = renderWithProviders(<FulfillmentView initialHasDbEntries={true} />);
    // Should NOT show the batch-empty state
    expect(html).not.toContain("No active fulfillment batch");
    // Should show the full screen header and tabs
    expect(html).toContain("Order Fulfillment");
    expect(html).toContain("Open Orders");
    expect(html).toContain("Processed");
    expect(html).toContain("Sent");
    // Open tab should show no open orders waiting message
    expect(html).toContain("No open orders waiting to be fulfilled or shipped.");
    // Open tab should offer the Open MyP Vendas button
    expect(html).toContain("Open MyP Vendas");
  });

  it("renders full screen with loaded orders when initialReport is provided", () => {
    const html = renderWithProviders(<FulfillmentView initialReport={mockReport} initialHasDbEntries={true} />);
    expect(html).not.toContain("No active fulfillment batch");
    expect(html).toContain("Order Fulfillment");
    expect(html).toContain("Void&#x27;s Cloak");
    expect(html).toContain("Creative Shock");
  });
});
