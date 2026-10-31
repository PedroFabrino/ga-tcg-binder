import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nProvider } from "@/lib/i18n";
import { DeckSummaryCard } from "../DeckSummaryCard";
import { DeckSummaryRow } from "../DeckSummaryRow";

vi.stubGlobal("React", React);

describe("DeckSummaryCard and DeckSummaryRow", () => {
  const sampleDeck = {
    id: "deck-sample",
    name: "Wind Rai",
    champion: "Rai, Mana Weaver",
    format: "standard",
    section: "4fun" as const,
    priority: 0,
    mainCount: 60,
    materialCount: 12,
    sideCount: 8,
    totalCards: 80,
  };

  const competitiveDeck = {
    ...sampleDeck,
    id: "deck-comp",
    name: "Tournament Lorraine",
    section: "competitive" as const,
  };

  it("renders deck name, format, section badge and actions menu", () => {
    const html = renderToStaticMarkup(
      <I18nProvider>
        <DeckSummaryCard
          deck={sampleDeck}
          missing={0}
          index={0}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
        />
      </I18nProvider>,
    );

    expect(html).toContain("Wind Rai");
    expect(html).toContain("Rai, Mana Weaver");
    expect(html).toContain("standard");
    expect(html).toContain("Ready");
    expect(html).toContain("4Fun");
    expect(html).toContain('aria-label="Deck actions - Wind Rai"');
  });

  it("renders competitive badge on competitive decks", () => {
    const html = renderToStaticMarkup(
      <I18nProvider>
        <DeckSummaryCard
          deck={competitiveDeck}
          missing={2}
          index={0}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
        />
      </I18nProvider>,
    );

    expect(html).toContain("Tournament Lorraine");
    expect(html).toContain("Competitive");
    expect(html).toContain("2 Missing");
  });

  it("renders DeckSummaryRow with compact list row layout", () => {
    const html = renderToStaticMarkup(
      <I18nProvider>
        <DeckSummaryRow
          deck={competitiveDeck}
          missing={0}
          index={0}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
        />
      </I18nProvider>,
    );

    expect(html).toContain("#1");
    expect(html).toContain("Tournament Lorraine");
    expect(html).toContain("Competitive");
    expect(html).toContain("Ready");
    expect(html).toContain('aria-label="Deck actions - Tournament Lorraine"');
  });
});
