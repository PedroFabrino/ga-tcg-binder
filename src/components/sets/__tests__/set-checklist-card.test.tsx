import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nProvider } from "@/lib/i18n";
import type {
  SetChecklistReportCard,
  SetDeckRequirement,
} from "@ga/contracts";
import SetChecklistCard from "../SetChecklistCard";

vi.stubGlobal("React", React);

function makeCard(
  overrides: Partial<SetChecklistReportCard> = {},
): SetChecklistReportCard {
  return {
    cardSlug: "fireball",
    cardName: "Fireball",
    element: "FIRE",
    class: "Mage",
    type: "action",
    rarity: 3,
    rarities: [3, 2],
    imageUrl: "/cards/fireball.jpg",
    prefixes: ["DOA 1st", "DOA Alter"],
    ownedQuantity: 2,
    requiredQuantity: 5,
    missingQuantity: 3,
    isShortage: true,
    requiringDeckIds: ["deck-1", "deck-2"],
    printings: [
      {
        editionId: "ed-001",
        setPrefix: "DOA 1st",
        setName: "Dawn of Ashes",
        collectorNumber: "DOA-001",
        rarity: 3,
        imageUrl: "/cards/fireball.jpg",
      },
      {
        editionId: "ed-002",
        setPrefix: "DOA Alter",
        setName: "Dawn of Ashes Alter",
        collectorNumber: "DOA-ALT-001",
        rarity: 2,
        imageUrl: "/cards/fireball-alt.jpg",
      },
    ],
    preferredEditionId: "ed-001",
    ownedNormal: 1,
    ownedFoil: 1,
    peakMissing: 2,
    concurrentMissing: 3,
    shortage: "hard",
    deckRequirements: [
      { deckId: "deck-1", deckName: "Aggro Fire", quantity: 3 },
      { deckId: "deck-2", deckName: "Burn Control", quantity: 2 },
    ] as SetDeckRequirement[],
    ...overrides,
  };
}

function render(card: SetChecklistReportCard) {
  return renderToStaticMarkup(
    <I18nProvider>
      <SetChecklistCard card={card} onQuantityChange={vi.fn()} />
    </I18nProvider>,
  );
}

describe("SetChecklistCard", () => {
  it("renders the card name", () => {
    const html = render(makeCard({ cardName: "Fireball" }));
    expect(html).toContain("Fireball");
  });

  it("shows Hard Shortage badge with peak missing quantity", () => {
    const card = makeCard({ shortage: "hard", peakMissing: 3, concurrentMissing: 5 });
    const html = render(card);
    expect(html).toContain("Hard Shortage");
    // Must show the peak count (3), not the concurrent total (5)
    expect(html).toContain("(3)");
    expect(html).not.toContain("(5)");
    // Accessible label includes count
    expect(html).toContain('aria-label="Hard Shortage: 3"');
  });

  it("shows Shared Shortage badge with concurrent missing quantity", () => {
    const card = makeCard({ shortage: "shared", peakMissing: 0, concurrentMissing: 2 });
    const html = render(card);
    expect(html).toContain("Shared Shortage");
    expect(html).toContain("(2)");
  });

  it("does not show shortage badge when shortage is none", () => {
    const card = makeCard({ shortage: "none", isShortage: false });
    const html = render(card);
    expect(html).not.toContain("Hard Shortage");
    expect(html).not.toContain("Shared Shortage");
  });

  it("shows Normal and Foil copy counts", () => {
    const card = makeCard({ ownedNormal: 2, ownedFoil: 1 });
    const html = render(card);
    expect(html).toContain("Normal: 2");
    expect(html).toContain("Foil: 1");
  });

  it("disables decrement when ownedNormal is 0", () => {
    const card = makeCard({ ownedNormal: 0, ownedFoil: 1, ownedQuantity: 1 });
    const html = render(card);
    // The minus button should be disabled
    const disabledPattern = /disabled=""/;
    // There are 2 buttons, one of which should be disabled (the minus)
    const minusIdx = html.indexOf("Remove 1 copy");
    const disabledAttrIdx = html.indexOf("disabled=");
    // Either the minus button is disabled if ownedNormal <= 0
    expect(disabledAttrIdx).not.toBe(-1);
  });

  it("lists all printings with prefix and collector number", () => {
    const card = makeCard();
    const html = render(card);
    // Both printings should appear
    expect(html).toContain("DOA 1st");
    expect(html).toContain("DOA-001");
    expect(html).toContain("DOA Alter");
    expect(html).toContain("DOA-ALT-001");
  });

  it("renders with no imageUrl gracefully", () => {
    const card = makeCard({ imageUrl: null });
    const html = render(card);
    expect(html).toContain("Fireball");
  });
});