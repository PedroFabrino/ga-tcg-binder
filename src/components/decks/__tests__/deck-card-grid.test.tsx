import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nProvider } from "@/lib/i18n";
import DeckCardGrid from "../DeckCardGrid";
import type { DeckCard } from "../DeckList";
import type { ShortageItem } from "../ShortageTable";

vi.stubGlobal("React", React);

function makeCard(overrides: Partial<DeckCard> = {}): DeckCard {
  return {
    id: "dc-1",
    cardSlug: "fireball",
    zone: "main",
    quantity: 4,
    cardName: "Fireball",
    element: "FIRE",
    class: "MAGE",
    type: "ACTION",
    imageUrl: "https://example.com/fireball.jpg",
    ...overrides,
  };
}

function makeShortageItem(overrides: Partial<ShortageItem> = {}): ShortageItem {
  return {
    cardSlug: "fireball",
    cardName: "Fireball",
    zone: "main",
    imageUrl: "https://example.com/fireball.jpg",
    requiredQuantity: 4,
    availableQuantity: 1,
    missingQuantity: 3,
    isContended: false,
    contendingDeckNames: [],
    dedicatedCopiesOwned: 0,
    sharedCopiesOwned: 1,
    friendsWithIdle: [],
    ...overrides,
  };
}

function renderGrid(props: React.ComponentProps<typeof DeckCardGrid>) {
  return renderToStaticMarkup(
    <I18nProvider>
      <DeckCardGrid {...props} />
    </I18nProvider>,
  );
}

describe("DeckCardGrid", () => {
  it("always formats with three sections: Material, Main, Side in exact order", () => {
    const html = renderGrid({
      cards: {
        material: [makeCard({ id: "mat-1", cardSlug: "merlin", zone: "material", quantity: 1, cardName: "Merlin" })],
        main: [makeCard({ id: "main-1", cardSlug: "fireball", zone: "main", quantity: 4, cardName: "Fireball" })],
        side: [makeCard({ id: "side-1", cardSlug: "dispel", zone: "side", quantity: 2, cardName: "Dispel" })],
      },
    });

    const matIndex = html.indexOf("Material");
    const mainIndex = html.indexOf("Main");
    const sideIndex = html.indexOf("Side");

    expect(matIndex).toBeGreaterThan(-1);
    expect(mainIndex).toBeGreaterThan(matIndex);
    expect(sideIndex).toBeGreaterThan(mainIndex);
  });

  it("always renders all three sections even when lists are empty", () => {
    const html = renderGrid({
      cards: {
        material: [],
        main: [],
        side: [],
      },
      onlyMissing: false,
    });

    expect(html).toContain("Material");
    expect(html).toContain("Main");
    expect(html).toContain("Side");
    expect(html).toContain("No cards in Material");
    expect(html).toContain("No cards in Main");
    expect(html).toContain("No cards in Side");
  });

  it("displays card images and clear Have and Need metrics", () => {
    const html = renderGrid({
      cards: {
        material: [],
        main: [
          makeCard({
            cardSlug: "fireball",
            cardName: "Fireball",
            quantity: 4,
            imageUrl: "https://example.com/fireball.jpg",
          }),
        ],
        side: [],
      },
      shortageItems: [
        makeShortageItem({
          cardSlug: "fireball",
          requiredQuantity: 4,
          availableQuantity: 1,
          missingQuantity: 3,
        }),
      ],
    });

    expect(html).toContain('src="https://example.com/fireball.jpg"');
    expect(html).toContain("Fireball");
    expect(html).toContain("Have");
    expect(html).toContain("Need");
    expect(html).toContain("1");
    expect(html).toContain("4");
    expect(html).toContain("3 Missing");
  });

  it("when Only Show Shortages is toggled, filters out fulfilled cards and keeps shortage cards", () => {
    const html = renderGrid({
      cards: {
        material: [],
        main: [
          makeCard({
            id: "card-shortage",
            cardSlug: "fireball",
            cardName: "Fireball",
            quantity: 4,
          }),
          makeCard({
            id: "card-fulfilled",
            cardSlug: "arcane-missiles",
            cardName: "Arcane Missiles",
            quantity: 2,
          }),
        ],
        side: [],
      },
      shortageItems: [
        makeShortageItem({
          cardSlug: "fireball",
          requiredQuantity: 4,
          availableQuantity: 1,
          missingQuantity: 3,
        }),
        makeShortageItem({
          cardSlug: "arcane-missiles",
          requiredQuantity: 2,
          availableQuantity: 2,
          missingQuantity: 0,
        }),
      ],
      onlyMissing: true,
    });

    expect(html).toContain("Fireball");
    expect(html).not.toContain("Arcane Missiles");
    expect(html).toContain("3 Missing");
    expect(html).toContain("Have");
    expect(html).toContain("Need");
  });

  it("when Only Show Shortages is toggled and a zone has no shortages, retains the section and shows ready message", () => {
    const html = renderGrid({
      cards: {
        material: [
          makeCard({
            id: "mat-1",
            cardSlug: "merlin",
            zone: "material",
            quantity: 1,
            cardName: "Merlin",
          }),
        ],
        main: [
          makeCard({
            id: "main-1",
            cardSlug: "fireball",
            zone: "main",
            quantity: 4,
            cardName: "Fireball",
          }),
        ],
        side: [],
      },
      shortageItems: [
        makeShortageItem({
          cardSlug: "merlin",
          zone: "material",
          requiredQuantity: 1,
          availableQuantity: 1,
          missingQuantity: 0,
        }),
        makeShortageItem({
          cardSlug: "fireball",
          zone: "main",
          requiredQuantity: 4,
          availableQuantity: 1,
          missingQuantity: 3,
        }),
      ],
      onlyMissing: true,
    });

    // Material section is still present with ready confirmation
    expect(html).toContain("Material");
    expect(html).toContain("All Material cards ready · No shortages");

    // Main section displays the shortage card
    expect(html).toContain("Main");
    expect(html).toContain("Fireball");

    // Side section is still present
    expect(html).toContain("Side");
    expect(html).toContain("No cards in Side");
  });

  it("renders +1 and +all missing action buttons for shortage cards", () => {
    const onAddOne = vi.fn();
    const onAddMissing = vi.fn();

    const html = renderGrid({
      cards: {
        material: [],
        main: [
          makeCard({
            cardSlug: "fireball",
            cardName: "Fireball",
            quantity: 4,
          }),
        ],
        side: [],
      },
      shortageItems: [
        makeShortageItem({
          cardSlug: "fireball",
          requiredQuantity: 4,
          availableQuantity: 1,
          missingQuantity: 3,
        }),
      ],
      onAddOne,
      onAddMissing,
    });

    expect(html).toContain("+1");
    expect(html).toContain("+3");
  });
});
