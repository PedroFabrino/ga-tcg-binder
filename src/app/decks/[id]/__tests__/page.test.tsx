import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nProvider } from "@/lib/i18n";
import type { DeckDetailPayload } from "@/hooks/queries/use-decks-queries";
import DeckDetailPage from "../page";

vi.stubGlobal("React", React);

let mockPayload: DeckDetailPayload | undefined;

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "deck-1" }),
}));

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: { user: { id: "user-1" } } }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
}));

vi.mock("@/components/ToastProvider", () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}));

vi.mock("@/hooks/queries/use-decks-queries", () => ({
  useDeckWithShortageQuery: () => ({
    data: mockPayload,
    isLoading: false,
    isFetching: false,
    refetch: vi.fn(),
  }),
}));

function buildPayload(missingQuantity: number): DeckDetailPayload {
  return {
    notFound: false,
    advisorAllowed: false,
    deck: {
      deck: {
        id: "deck-1",
        name: "Rai Aggro",
        champion: "Rai, Storm Seer",
        format: "standard",
      },
      cards: {
        material: [
          {
            id: "dc-mat-1",
            cardSlug: "rai-storm-seer",
            zone: "material",
            quantity: 1,
            cardName: "Rai, Storm Seer",
            element: "ARCANE",
            class: "MAGE",
            type: "CHAMPION",
            imageUrl: null,
          },
        ],
        main: [
          {
            id: "dc-main-1",
            cardSlug: "fireball",
            zone: "main",
            quantity: 4,
            cardName: "Fireball",
            element: "FIRE",
            class: "MAGE",
            type: "ACTION",
            imageUrl: null,
          },
        ],
        side: [],
      },
      omnidexText: "# Material Deck\n1 Rai, Storm Seer\n\n# Main Deck\n4 Fireball",
    },
    shortage: {
      deckId: "deck-1",
      deckName: "Rai Aggro",
      totalCardsRequired: 5,
      totalCardsMissing: missingQuantity,
      items: [
        {
          cardSlug: "rai-storm-seer",
          cardName: "Rai, Storm Seer",
          zone: "material",
          imageUrl: null,
          requiredQuantity: 1,
          availableQuantity: 1,
          missingQuantity: 0,
          isContended: false,
          contendingDeckNames: [],
          dedicatedCopiesOwned: 0,
          sharedCopiesOwned: 1,
          friendsWithIdle: [],
        },
        {
          cardSlug: "fireball",
          cardName: "Fireball",
          zone: "main",
          imageUrl: null,
          requiredQuantity: 4,
          availableQuantity: 4 - missingQuantity,
          missingQuantity,
          isContended: false,
          contendingDeckNames: [],
          dedicatedCopiesOwned: 0,
          sharedCopiesOwned: 4 - missingQuantity,
          friendsWithIdle: [],
        },
      ],
    },
  };
}

function renderPage() {
  return renderToStaticMarkup(
    <I18nProvider>
      <DeckDetailPage />
    </I18nProvider>,
  );
}

function extractCopyShortagesButtonTag(html: string): string {
  const match = html.match(/<button[^>]*>[^<]*(?:<[^>]+>)*[^<]*Copy Shortages<\/button>/);
  return match?.[0] ?? "";
}

describe("DeckDetailPage (/decks/[id])", () => {
  beforeEach(() => {
    mockPayload = undefined;
  });

  it("renders an enabled Copy Shortages button when shortage items have missingQuantity > 0", () => {
    mockPayload = buildPayload(3);
    const html = renderPage();

    expect(html).toContain("Copy Shortages");
    const buttonHtml = extractCopyShortagesButtonTag(html);
    expect(buttonHtml).not.toBe("");
    expect(buttonHtml).toContain('title="Copy Shortages"');
    expect(buttonHtml).not.toMatch(/\sdisabled(?:=""|(?=\s|>))/);
  });

  it("renders a disabled Copy Shortages button with explanatory title when there are no shortages", () => {
    mockPayload = buildPayload(0);
    const html = renderPage();

    expect(html).toContain("Copy Shortages");
    const buttonHtml = extractCopyShortagesButtonTag(html);
    expect(buttonHtml).not.toBe("");
    expect(buttonHtml).toContain('title="No shortages to export"');
    expect(buttonHtml).toMatch(/\sdisabled(?:=""|(?=\s|>))/);
  });
});
