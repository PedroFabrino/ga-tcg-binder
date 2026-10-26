import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DeckEditForm } from "../components/DeckEditForm";
import { DeckImportForm } from "../components/DeckImportForm";

describe("DeckEditForm", () => {
  const sampleDeck = {
    id: "deck-123",
    name: "Fire Rai Fast",
    champion: "Rai",
    format: "Standard",
    totalCards: 60,
    hardShortagesCount: 0,
    sharedShortagesCount: 0,
    hardShortages: [],
    sharedShortages: [],
    omnidexText: "# Material Deck\n1 Spirit of Fire\n\n# Main Deck\n4 Fireball",
  };

  it("renders with deck name and prefilled decklist text", () => {
    const html = renderToStaticMarkup(
      <DeckEditForm
        deck={sampleDeck}
        onSave={async () => ({ success: true })}
        onCancel={() => {}}
      />
    );

    expect(html).toContain("Edit Deck: Fire Rai Fast");
    expect(html).toContain('value="Fire Rai Fast"');
    expect(html).toContain("Decklist Text");
    expect(html).toContain("Omnidex / Silvie URL");
    expect(html).toContain("# Material Deck\n1 Spirit of Fire\n\n# Main Deck\n4 Fireball");
    expect(html).toContain("Save Changes");
  });
});

describe("DeckImportForm", () => {
  it("renders with URL and Paste Decklist Text options", () => {
    const html = renderToStaticMarkup(
      <DeckImportForm
        onImport={async () => ({ success: true })}
        onClose={() => {}}
      />
    );

    expect(html).toContain("Deck URL");
    expect(html).toContain("Paste Decklist Text");
    expect(html).toContain("Omnidex.gg or Silvie.gg Deck URL");
    expect(html).toContain("Import");
  });
});
