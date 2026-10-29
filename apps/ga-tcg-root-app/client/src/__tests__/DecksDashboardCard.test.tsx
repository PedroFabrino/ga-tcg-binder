import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DecksDashboardCard } from "../components/DecksDashboardCard";

describe("DecksDashboardCard", () => {
  it("renders unlinked hint when not linked", () => {
    const html = renderToStaticMarkup(
      <DecksDashboardCard isLinked={false} decks={[]} />
    );

    expect(html).toContain("Constructed Decks &amp; Shortages");
    expect(html).toContain("Link your GA Binder account above");
  });

  it("renders deck cards with Hard and Shared shortages", () => {
    const sampleDecks = [
      {
        id: "deck-1",
        name: "Fire Rai Turbo",
        champion: "Rai",
        format: "Standard",
        totalCards: 60,
        hardShortagesCount: 4,
        sharedShortagesCount: 2,
        hardShortages: [
          { cardSlug: "fire-ball", cardName: "Fire Ball", quantity: 4 },
        ],
        sharedShortages: [
          { cardSlug: "grand-crush", cardName: "Grand Crush", quantity: 2 },
        ],
      },
    ];

    const html = renderToStaticMarkup(
      <DecksDashboardCard isLinked={true} decks={sampleDecks} />
    );

    expect(html).toContain("Fire Rai Turbo");
    expect(html).toContain("Rai");
    expect(html).toContain("Standard");
    expect(html).toContain("4 Hard");
    expect(html).toContain("2 Shared");
  });

  it("renders 100% complete badge when 0 shortages", () => {
    const completeDeck = [
      {
        id: "deck-2",
        name: "Silvie Control",
        champion: "Silvie",
        format: "Standard",
        totalCards: 60,
        hardShortagesCount: 0,
        sharedShortagesCount: 0,
        hardShortages: [],
        sharedShortages: [],
      },
    ];

    const html = renderToStaticMarkup(
      <DecksDashboardCard isLinked={true} decks={completeDeck} />
    );

    expect(html).toContain("Silvie Control");
    expect(html).toContain("100% Complete");
  });

  it("renders edit deck action when onUpdateDeck is provided", () => {
    const completeDeck = [
      {
        id: "deck-2",
        name: "Silvie Control",
        champion: "Silvie",
        format: "Standard",
        totalCards: 60,
        hardShortagesCount: 0,
        sharedShortagesCount: 0,
        hardShortages: [],
        sharedShortages: [],
      },
    ];

    const html = renderToStaticMarkup(
      <DecksDashboardCard
        isLinked={true}
        decks={completeDeck}
        onUpdateDeck={async () => ({ success: true })}
      />
    );

    expect(html).toContain('aria-label="Edit Silvie Control"');
  });

  it("renders Portuguese translations when locale is pt-BR", () => {
    const sampleDecks = [
      {
        id: "deck-1",
        name: "Fire Rai Turbo",
        champion: "Rai",
        format: "Standard",
        totalCards: 60,
        hardShortagesCount: 4,
        sharedShortagesCount: 2,
        hardShortages: [
          { cardSlug: "fire-ball", cardName: "Fire Ball", quantity: 4 },
        ],
        sharedShortages: [
          { cardSlug: "grand-crush", cardName: "Grand Crush", quantity: 2 },
        ],
      },
    ];

    const html = renderToStaticMarkup(
      <DecksDashboardCard isLinked={true} decks={sampleDecks} locale="pt-BR" />
    );

    expect(html).toContain("Decks Construídos &amp; Cartas Faltantes");
    expect(html).toContain("4 Compra");
    expect(html).toContain("2 Revezamento");
  });
});
