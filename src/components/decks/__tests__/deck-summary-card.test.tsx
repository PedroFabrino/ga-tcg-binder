import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nProvider } from "@/lib/i18n";
import { DeckSummaryCard } from "../DeckSummaryCard";

vi.stubGlobal("React", React);

describe("DeckSummaryCard", () => {
  const sampleDeck = {
    id: "deck-sample",
    name: "Wind Rai",
    champion: "Rai, Mana Weaver",
    format: "standard",
    mainCount: 60,
    materialCount: 12,
    sideCount: 8,
    totalCards: 80,
  };

  it("renders deck name, format, and counts", () => {
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
    expect(html).toContain('aria-label="Edit Deck Wind Rai"');
    expect(html).toContain('aria-label="Delete Deck Wind Rai"');
  });

  it("displays shortage count when missing cards exist", () => {
    const html = renderToStaticMarkup(
      <I18nProvider>
        <DeckSummaryCard
          deck={sampleDeck}
          missing={4}
          index={0}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
        />
      </I18nProvider>,
    );

    expect(html).toContain("4 Missing");
  });
});
