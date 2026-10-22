import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nProvider } from "@/lib/i18n";
import type { SetChecklistReportCard, DeckRequirement } from "@/services/set-shortage";

// Import SUT – will be created in implementation phase
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import SetChecklistCard from "../SetChecklistCard";

vi.stubGlobal("React", React);

function makeCard(overrides: Partial<SetChecklistReportCard> = {}): SetChecklistReportCard {
  return {
    cardSlug: "fireball",
    cardName: "Fireball",
    element: "FIRE",
    class: "Mage",
    type: "action",
    rarity: 3,
    imageUrl: "/cards/fireball.jpg",
    prefixes: ["DOA 1st", "DOA Alter"],
    ownedQuantity: 2,
    requiredQuantity: 5,
    missingQuantity: 3,
    isShortage: true,
    requiringDeckIds: ["deck-1", "deck-2"],
    printings: [
      { editionId: "ed-001", setPrefix: "DOA 1st", setName: "Dawn of Ashes", collectorNumber: "DOA-001", rarity: 3, imageUrl: "/cards/fireball.jpg" },
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
    ] as DeckRequirement[],
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
  it("renders card name", () => {
    const html = render(makeCard({ cardName: "Fireball" }));
    expect(html).toContain("Fireball");
  });

  it("renders collector number and prefix from first printing", () => {
    const html = render(makeCard({
      printings: [{ editionId: "ed-001", setPrefix: "DOA 1st", setName: "Dawn of Ashes", collectorNumber: "DOA-042", rarity: 3, imageUrl: null }],
    }));
    expect(html).toContain("DOA-042");
    expect(html).toContain("DOA 1st");
  });

  it("renders element and rarity", () => {
    const html = render(makeCard({ element: "FIRE", rarity: 3 }));
    expect(html).toContain("FIRE");
    expect(html).toContain("Rare");
  });

  it("renders owned normal/foil counts", () => {
    const html = render(makeCard({ ownedNormal: 1, ownedFoil: 1 }));
    expect(html).toContain("1");
    // Both normal and foil counts should be shown
    expect(html).toContain("You own");
  });

  it("renders shortage badge for hard shortage", () => {
    const html = render(makeCard({ shortage: "hard", concurrentMissing: 3 }));
    expect(html).toContain("Hard Shortage");
    expect(html).toContain("3");
  });

  it("renders shortage badge for shared shortage", () => {
    const html = render(makeCard({ shortage: "shared", concurrentMissing: 2 }));
    expect(html).toContain("Shared Shortage");
  });

  it("does not render shortage badge when shortage is none", () => {
    const html = render(makeCard({ shortage: "none", isShortage: false, missingQuantity: 0 }));
    expect(html).not.toContain("Hard Shortage");
    expect(html).not.toContain("Shared Shortage");
  });

  it("renders deck names requiring the card", () => {
    const html = render(makeCard({
      shortage: "hard",
      deckRequirements: [
        { deckId: "d1", deckName: "Aggro Fire", quantity: 2 },
        { deckId: "d2", deckName: "Burn Control", quantity: 1 },
      ],
    }));
    expect(html).toContain("Aggro Fire");
    expect(html).toContain("Burn Control");
    expect(html).toContain("Required by 2 deck(s)");
  });

  it("renders plus and minus buttons with accessible labels", () => {
    const html = render(makeCard());
    expect(html).toContain("Add 1 copy");
    expect(html).toContain("Remove 1 copy");
  });

  it("renders card image when available", () => {
    const html = render(makeCard({ imageUrl: "/cards/fireball.jpg" }));
    expect(html).toContain('src="/cards/fireball.jpg"');
  });

  it("renders missing quantity when positive", () => {
    const html = render(makeCard({ missingQuantity: 3, isShortage: true, shortage: "hard" }));
    // missingQuantity should be reflected in the shortage badge
    expect(html).toContain("3");
  });
});