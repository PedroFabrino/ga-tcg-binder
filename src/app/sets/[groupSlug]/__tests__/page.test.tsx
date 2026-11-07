import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nProvider } from "@/lib/i18n";
import type { SetGroupChecklistReport } from "@ga/contracts";
import SetChecklistPage from "../page";

vi.stubGlobal("React", React);

let mockQueryData: SetGroupChecklistReport | null = null;
let mockIsLoading = false;
let mockIsError = false;
let mockQueryError: unknown = null;

vi.mock("next/navigation", () => ({
  useParams: () => ({ groupSlug: "dawn-of-ashes" }),
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

vi.mock("@/hooks/queries/use-sets-queries", () => ({
  useSetChecklistQuery: () => ({
    data: mockQueryData,
    isLoading: mockIsLoading,
    isError: mockIsError,
    error: mockQueryError,
    refetch: vi.fn(),
    isFetching: false,
  }),
}));

function renderPage() {
  return renderToStaticMarkup(
    <I18nProvider>
      <SetChecklistPage />
    </I18nProvider>,
  );
}

describe("SetChecklistPage (/sets/[groupSlug])", () => {
  beforeEach(() => {
    mockQueryData = null;
    mockIsLoading = false;
    mockIsError = false;
    mockQueryError = null;
  });

  it("renders loading skeleton state when loading", () => {
    mockIsLoading = true;
    const html = renderPage();
    expect(html).toContain("Loading cards...");
  });

  it("renders not-found empty state when error is NOT_FOUND", () => {
    mockIsError = true;
    mockQueryError = new Error("NOT_FOUND");
    const html = renderPage();
    expect(html).toContain("Set group not found");
  });

  it("renders checklist header and cards successfully without crashing", () => {
    mockQueryData = {
      group: {
        uuid: "grp-doa",
        name: "Dawn of Ashes",
        slug: "dawn-of-ashes",
        imageUrl: "/doa.png",
        releaseDate: "2023-05-15",
        childPrefixes: ["DOA 1st"],
        category: "booster",
      },
      stats: {
        totalGroups: 1,
        totalHardShortageCopies: 2,
        totalSharedShortageCopies: 1,
        totalShortageCopies: 3,
        totalCardsAcrossGroups: 10,
        totalOwnedCardsAcrossGroups: 8,
        overallCompletionPercent: 80,
      },
      cards: [
        {
          cardSlug: "fire-slash",
          cardName: "Fire Slash",
          element: "FIRE",
          class: "MAGE",
          type: "ACTION",
          rarity: 3,
          rarities: [3],
          imageUrl: "/fs.jpg",
          prefixes: ["DOA 1st"],
          ownedQuantity: 2,
          requiredQuantity: 4,
          missingQuantity: 2,
          isShortage: true,
          requiringDeckIds: ["deck-comp"],
          printings: [
            {
              editionId: "ed-1",
              setPrefix: "DOA 1st",
              setName: "Dawn of Ashes 1st",
              collectorNumber: "001",
              rarity: 3,
              imageUrl: "/fs.jpg",
            },
          ],
          preferredEditionId: "ed-1",
          ownedNormal: 2,
          ownedFoil: 0,
          peakMissing: 2,
          concurrentMissing: 2,
          shortage: "hard",
          deckRequirements: [
            {
              deckId: "deck-comp",
              deckName: "Tournament Rai",
              quantity: 2,
              section: "competitive",
              priority: 0,
              hardMissing: 2,
              sharedMissing: 0,
            },
          ],
        },
      ],
      availableDecks: [
        { id: "deck-comp", name: "Tournament Rai", section: "competitive", priority: 0 },
      ],
      hasPersonalWants: false,
      currentTarget: "all",
    };

    const html = renderPage();
    expect(html).toContain("Dawn of Ashes");
    expect(html).toContain("Fire Slash");
    expect(html).toContain("Tournament Rai");
    expect(html).toContain("Competitive");
  });

  it("handles legacy payload with checklist and summary without crashing", () => {
    // Simulates legacy API response that supplied checklist and summary
    mockQueryData = {
      group: {
        uuid: "grp-doa",
        name: "Dawn of Ashes",
        slug: "dawn-of-ashes",
        imageUrl: null,
        releaseDate: "2023-05-15",
        childPrefixes: ["DOA 1st"],
        category: "booster",
      },
      summary: {
        totalGroups: 1,
        totalHardShortageCopies: 1,
        totalSharedShortageCopies: 0,
        totalShortageCopies: 1,
        totalCardsAcrossGroups: 5,
        totalOwnedCardsAcrossGroups: 4,
        overallCompletionPercent: 80,
      },
      checklist: [
        {
          cardSlug: "water-bolt",
          cardName: "Water Bolt",
          element: "WATER",
          class: "TAMER",
          type: "ACTION",
          rarity: 2,
          rarities: [2],
          imageUrl: null,
          prefixes: ["DOA 1st"],
          ownedQuantity: 1,
          requiredQuantity: 2,
          missingQuantity: 1,
          isShortage: true,
          requiringDeckIds: ["deck-fun"],
          printings: [],
          preferredEditionId: "ed-wb",
          ownedNormal: 1,
          ownedFoil: 0,
          peakMissing: 1,
          concurrentMissing: 1,
          shortage: "hard",
          deckRequirements: [],
        },
      ],
      availableDecks: [],
      hasPersonalWants: false,
      currentTarget: "all",
    } as unknown as SetGroupChecklistReport;

    const html = renderPage();
    expect(html).toContain("Dawn of Ashes");
    expect(html).toContain("Water Bolt");
  });
});
