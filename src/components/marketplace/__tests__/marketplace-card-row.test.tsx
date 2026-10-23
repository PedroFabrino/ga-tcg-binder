import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nProvider } from "@/lib/i18n";
import type { GlobalMarketplaceCardItem } from "@/services/marketplace";
import MarketplaceCardRow from "../MarketplaceCardRow";
import MarketplaceAddToBinder from "../MarketplaceAddToBinder";

vi.stubGlobal("React", React);

function makeCard(overrides: Partial<GlobalMarketplaceCardItem> = {}): GlobalMarketplaceCardItem {
  return {
    id: "mc_1",
    storeId: "myp",
    storeName: "MyP Cards",
    storePlatform: "myp",
    cardSlug: "creative-shock",
    editionId: "ed_shock_1",
    rawName: "Creative Shock",
    cardName: "Creative Shock",
    setPrefix: "DOA",
    element: "water",
    class: "mage",
    type: "action",
    rarity: 3,
    imageUrl: "/cards/shock.jpg",
    quantity: 2,
    personalStoreQuantity: 0,
    netExternalStock: 2,
    price: "R$ 55,00",
    priceNumeric: 55.0,
    tcgPrice: "R$ 50,00",
    tcgPriceNumeric: 50.0,
    priceFairness: {
      tier: "NORMAL",
      ratio: 1.1,
      markupPercent: 10,
      tcgPrice: "R$ 50,00",
      tcgPriceNumeric: 50.0,
    },
    isFoil: false,
    mypItemId: "item_1",
    mypProductUrl: "https://mypcards.com/item_1",
    productUrl: "https://mypcards.com/item_1",
    deckNeeds: [],
    peakMissing: 0,
    concurrentMissing: 0,
    totalBinderOwned: 3,
    shortageTier: "NONE",
    isBuyableShortage: false,
    ...overrides,
  };
}

describe("MarketplaceAddToBinder", () => {
  it("renders the stepper controls and Add to Binder button", () => {
    const card = makeCard();
    const html = renderToStaticMarkup(
      <I18nProvider>
        <MarketplaceAddToBinder card={card} />
      </I18nProvider>
    );

    expect(html).toContain("Add to Binder");
    expect(html).toContain('aria-label="Quantity for Creative Shock"');
    expect(html).toContain('aria-label="Remove one Creative Shock"');
    expect(html).toContain('aria-label="Add one Creative Shock"');
    // Initial quantity is 1
    expect(html).toContain(">1<");
  });

  it("disables the decrement button when quantity is 1", () => {
    const card = makeCard();
    const html = renderToStaticMarkup(
      <I18nProvider>
        <MarketplaceAddToBinder card={card} />
      </I18nProvider>
    );

    // The minus button should have disabled attribute
    expect(html).toMatch(/<button[^>]*disabled[^>]*aria-label="Remove one Creative Shock"/);
  });
});

describe("MarketplaceCardRow", () => {
  it("renders card details, price, In-Binder count, and action controls", () => {
    const card = makeCard({ totalBinderOwned: 4 });
    const html = renderToStaticMarkup(
      <I18nProvider>
        <MarketplaceCardRow card={card} />
      </I18nProvider>
    );

    expect(html).toContain("Creative Shock");
    expect(html).toContain("R$ 55,00");
    // Displays In Binder count
    expect(html).toContain("In Binder");
    expect(html).toContain("4");
    // Displays Add to Binder button with stepper
    expect(html).toContain("Add to Binder");
    // Displays Buy on Store button
    expect(html).toContain("Buy on MyP Cards");
  });

  it("renders shortage badge when the card is a Hard Shortage", () => {
    const card = makeCard({
      shortageTier: "HARD",
      isBuyableShortage: true,
      netExternalStock: 2,
      peakMissing: 2,
      peakDeckName: "Water Mage",
      deckNeeds: [{ deckId: "d1", deckName: "Water Mage", zone: "main", quantity: 2 }],
    });
    const html = renderToStaticMarkup(
      <I18nProvider>
        <MarketplaceCardRow card={card} />
      </I18nProvider>
    );

    expect(html).toContain("Hard Shortage: Need 2 for Water Mage");
  });
});
