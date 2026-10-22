import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nProvider } from "@/lib/i18n";
import SetsDashboardView from "@/components/sets/SetsDashboardView";
import type { FeaturedSetSummary } from "@ga/contracts";

vi.stubGlobal("React", React);

function makeGroup(overrides: Partial<FeaturedSetSummary> = {}): FeaturedSetSummary {
  return {
    groupUuid: "uuid-doa",
    groupName: "Dawn of Ashes",
    slug: "dawn-of-ashes",
    imageUrl: null,
    sortOrder: 1,
    hardShortageCopies: 6,
    sharedShortageCopies: 4,
    totalShortageCopies: 10,
    uniqueShortageCards: 2,
    impactedDecks: 2,
    ownedCards: 40,
    totalCards: 100,
    completionPercent: 40,
    releaseDate: "2023-05-01",
    childPrefixes: ["DOA 1st"],
    category: "booster",
    isHidden: false,
    ...overrides,
  };
}

function renderView(props: Partial<React.ComponentProps<typeof SetsDashboardView>> = {}) {
  const defaultGroups: FeaturedSetSummary[] = [
    makeGroup({
      groupUuid: "uuid-doa",
      groupName: "Dawn of Ashes",
      slug: "dawn-of-ashes",
      totalShortageCopies: 10,
    }),
    makeGroup({
      groupUuid: "uuid-alc",
      groupName: "Alchemical Revolution",
      slug: "alchemical-revolution",
      totalShortageCopies: 25,
      hardShortageCopies: 15,
      sharedShortageCopies: 10,
    }),
    makeGroup({
      groupUuid: "uuid-hidden",
      groupName: "Mercurial Heart",
      slug: "mercurial-heart",
      totalShortageCopies: 8,
      isHidden: true,
    }),
  ];

  return renderToStaticMarkup(
    <I18nProvider>
      <SetsDashboardView
        groups={props.groups ?? defaultGroups}
        loading={props.loading ?? false}
        error={props.error ?? false}
        onToggleHide={props.onToggleHide ?? vi.fn()}
        {...props}
      />
    </I18nProvider>,
  );
}

describe("/sets Page Component (SetsDashboardView)", () => {
  it("renders total active shortages indicator in the page header eyebrow", () => {
    const html = renderView();
    // Dawn of Ashes (10) + Alchemical Revolution (25) = 35 active shortages
    expect(html).toContain("35 shortages across decks");
  });

  it("renders active set cards in shortage-ranked order (most shortages first by default)", () => {
    const html = renderView();
    const alcIdx = html.indexOf("Alchemical Revolution");
    const doaIdx = html.indexOf("Dawn of Ashes");

    expect(alcIdx).not.toBe(-1);
    expect(doaIdx).not.toBe(-1);
    // Alchemical Revolution (25 shortages) appears before Dawn of Ashes (10 shortages)
    expect(alcIdx).toBeLessThan(doaIdx);
  });

  it("renders hidden sets in the hidden accordion section with unhide action", () => {
    const html = renderView();
    expect(html).toContain("Hidden Sets");
    expect(html).toContain("1 hidden");
    expect(html).toContain("Mercurial Heart");
    expect(html).toContain("Unhide Set");
  });

  it("renders empty state when no active sets match", () => {
    const html = renderView({ groups: [] });
    expect(html).toContain("No sets available");
  });

  it("filters sets by query", () => {
    const html = renderView({ initialQuery: "Alchemical" });
    expect(html).toContain("Alchemical Revolution");
    expect(html).not.toContain("Dawn of Ashes");
  });

  it("filters sets by category", () => {
    const deckGroup = makeGroup({
      groupUuid: "uuid-starter",
      groupName: "Starter Decks",
      slug: "starter-decks",
      category: "decks",
    });
    const html = renderView({
      groups: [makeGroup({ groupUuid: "uuid-1", category: "booster" }), deckGroup],
      initialCategory: "decks",
    });
    expect(html).toContain("Starter Decks");
    expect(html).not.toContain("Dawn of Ashes");
  });

  it("renders list view mode when initialViewMode is list", () => {
    const html = renderView({ initialViewMode: "list" });
    // In list view, elements include browse link and compact row container
    expect(html).toContain("Browse Set");
    expect(html).toContain("Dawn of Ashes");
    expect(html).toContain("Alchemical Revolution");
  });

  it("sorts by hard shortages when initialSortMode is hardShortages", () => {
    // Dawn of Ashes has hard: 6, total: 10
    // Alchemical Revolution has hard: 15, total: 25
    // Set 3: hard: 20, total: 20
    const hardDominant = makeGroup({
      groupUuid: "uuid-third",
      groupName: "Third Set",
      slug: "third-set",
      hardShortageCopies: 20,
      totalShortageCopies: 20,
    });
    const html = renderView({
      groups: [
        makeGroup({ groupUuid: "g1", groupName: "Small Hard Big Total", slug: "s1", hardShortageCopies: 1, totalShortageCopies: 50 }),
        hardDominant,
      ],
      initialSortMode: "hardShortages",
    });

    const thirdIdx = html.indexOf("Third Set");
    const smallIdx = html.indexOf("Small Hard Big Total");
    expect(thirdIdx).toBeLessThan(smallIdx);
  });
});
