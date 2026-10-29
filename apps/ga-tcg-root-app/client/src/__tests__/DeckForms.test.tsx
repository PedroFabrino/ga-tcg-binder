import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DeckEditForm } from "../components/DeckEditForm";
import { DeckImportForm } from "../components/DeckImportForm";
import { WantlistOmnidexGapForm } from "../components/WantlistOmnidexGapForm";

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

  it("renders Portuguese translations in DeckEditForm when locale is pt-BR", () => {
    const html = renderToStaticMarkup(
      <DeckEditForm
        deck={sampleDeck}
        onSave={async () => ({ success: true })}
        onCancel={() => {}}
        locale="pt-BR"
      />
    );

    expect(html).toContain("Editar Deck: Fire Rai Fast");
    expect(html).toContain("Texto da Lista");
    expect(html).toContain("URL Omnidex / Silvie");
    expect(html).toContain("Salvar Alterações");
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

  it("renders Portuguese translations in DeckImportForm when locale is pt-BR", () => {
    const html = renderToStaticMarkup(
      <DeckImportForm
        onImport={async () => ({ success: true })}
        onClose={() => {}}
        locale="pt-BR"
      />
    );

    expect(html).toContain("URL do Deck");
    expect(html).toContain("Colar Lista de Deck");
    expect(html).toContain("Importar");
  });
});

describe("WantlistOmnidexGapForm", () => {
  it("renders with Deck URL and Paste Decklist Text options", () => {
    const html = renderToStaticMarkup(
      <WantlistOmnidexGapForm
        loading={false}
        onImportGap={async () => {}}
      />
    );

    expect(html).toContain("Import Omnidex Shortage Gap");
    expect(html).toContain("Deck URL");
    expect(html).toContain("Paste Decklist Text");
    expect(html).toContain("Import Gap");
  });

  it("renders Portuguese translations in WantlistOmnidexGapForm when locale is pt-BR", () => {
    const html = renderToStaticMarkup(
      <WantlistOmnidexGapForm
        loading={false}
        onImportGap={async () => {}}
        locale="pt-BR"
      />
    );

    expect(html).toContain("Importar Faltantes do Omnidex");
    expect(html).toContain("URL do Deck");
    expect(html).toContain("Colar Lista de Deck");
    expect(html).toContain("Importar Faltantes");
  });
});
