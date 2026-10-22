import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nProvider } from "@/lib/i18n";
import SetGroupCard from "../SetGroupCard";
import SetGroupRow from "../SetGroupRow";
import HiddenSetsAccordion from "../HiddenSetsAccordion";
import type { FeaturedSetSummary } from "@ga/contracts";

vi.stubGlobal("React", React);

function makeGroup(overrides: Partial<FeaturedSetSummary> = {}): FeaturedSetSummary {
  return {
    groupUuid: "uuid-1",
    groupName: "Dawn of Ashes",
    slug: "dawn-of-ashes",
    imageUrl: null,
    sortOrder: 1,
    hardShortageCopies: 10,
    sharedShortageCopies: 5,
    totalShortageCopies: 15,
    uniqueShortageCards: 3,
    impactedDecks: 2,
    ownedCards: 40,
    totalCards: 100,
    completionPercent: 40,
    releaseDate: "2023-05-01",
    childPrefixes: ["DOA 1st", "DOA Alter"],
    category: "booster",
    isHidden: false,
    ...overrides,
  };
}

function renderSetGroupCard(overrides: Partial<FeaturedSetSummary> = {}) {
  const group = makeGroup(overrides);
  return renderToStaticMarkup(
    <I18nProvider>
      <SetGroupCard group={group} onToggleHide={() => {}} />
    </I18nProvider>,
  );
}

function renderHiddenAccordion(groups: FeaturedSetSummary[]) {
  return renderToStaticMarkup(
    <I18nProvider>
      <HiddenSetsAccordion groups={groups} onToggleHide={() => {}} />
    </I18nProvider>,
  );
}

describe("SetGroupCard", () => {
  it("renders the group name", () => {
    const html = renderSetGroupCard({ groupName: "Dawn of Ashes" });
    expect(html).toContain("Dawn of Ashes");
  });

  it("renders the release date", () => {
    const html = renderSetGroupCard({ releaseDate: "2023-05-01" });
    expect(html).toContain("Released");
    expect(html).toContain("2023"); // just verify the year is present
  });

  it("renders the shortage pill with total count", () => {
    const html = renderSetGroupCard({ totalShortageCopies: 15 });
    expect(html).toContain("Shortages");
    expect(html).toContain("15");
  });

  it("renders hard and shared shortage breakdown in pill", () => {
    const html = renderSetGroupCard({
      hardShortageCopies: 10,
      sharedShortageCopies: 5,
      totalShortageCopies: 15,
    });
    expect(html).toContain("Hard Shortage");
    expect(html).toContain("10");
    expect(html).toContain("Shared Shortage");
    expect(html).toContain("5");
  });

  it("renders no shortage pill when count is zero", () => {
    const html = renderSetGroupCard({ totalShortageCopies: 0, hardShortageCopies: 0, sharedShortageCopies: 0 });
    expect(html).toContain("No shortages");
  });

  it("renders impacted decks count", () => {
    const html = renderSetGroupCard({ impactedDecks: 2 });
    expect(html).toContain("Decks");
    expect(html).toContain("2");
  });

  it("renders completion bar with owned / total (percent%)", () => {
    const html = renderSetGroupCard({ ownedCards: 40, totalCards: 100, completionPercent: 40 });
    expect(html).toContain("40 / 100 Cards (40%)");
  });

  it("renders Browse Set link with correct href", () => {
    const html = renderSetGroupCard({ slug: "dawn-of-ashes" });
    expect(html).toContain('/sets/dawn-of-ashes');
    expect(html).toContain("Browse Set");
  });

  it("renders Hide Set button with aria-label", () => {
    const html = renderSetGroupCard();
    expect(html).toContain("Hide Set");
    expect(html).toContain('aria-label="Hide Set"');
  });

  it("renders banner fallback when imageUrl is null", () => {
    const html = renderSetGroupCard({ imageUrl: null });
    expect(html).toContain("lucide-image-off");
    expect(html).not.toContain('src="https://');
  });

  it("renders banner image when imageUrl is present", () => {
    const html = renderSetGroupCard({ imageUrl: "https://example.com/banner.jpg" });
    expect(html).toContain('src="https://example.com/banner.jpg"');
  });
});

describe("HiddenSetsAccordion", () => {
  it("renders hidden sets title with count", () => {
    const hidden = [
      makeGroup({ groupUuid: "h1", groupName: "Hidden Set A", isHidden: true }),
      makeGroup({ groupUuid: "h2", groupName: "Hidden Set B", isHidden: true }),
    ];
    const html = renderHiddenAccordion(hidden);
    expect(html).toContain("Hidden Sets");
    expect(html).toContain("2 hidden");
  });

  it("renders each hidden set name", () => {
    const hidden = [
      makeGroup({ groupUuid: "h1", groupName: "Hidden Set A", isHidden: true }),
      makeGroup({ groupUuid: "h2", groupName: "Hidden Set B", isHidden: true }),
    ];
    const html = renderHiddenAccordion(hidden);
    expect(html).toContain("Hidden Set A");
    expect(html).toContain("Hidden Set B");
  });

  it("renders Unhide button per row", () => {
    const hidden = [
      makeGroup({ groupUuid: "h1", groupName: "Hidden Set A", isHidden: true }),
    ];
    const html = renderHiddenAccordion(hidden);
    expect(html).toContain("Unhide Set");
  });

  it("renders empty when no hidden sets", () => {
    const html = renderHiddenAccordion([]);
    expect(html).toContain("Hidden Sets");
    expect(html).toContain("0 hidden");
  });
});

describe("SetGroupRow", () => {
  function renderRow(overrides: Partial<FeaturedSetSummary> = {}) {
    const group = makeGroup(overrides);
    return renderToStaticMarkup(
      <I18nProvider>
        <SetGroupRow group={group} onToggleHide={() => {}} />
      </I18nProvider>,
    );
  }

  it("renders group name and browse link", () => {
    const html = renderRow({ groupName: "Dawn of Ashes", slug: "dawn-of-ashes" });
    expect(html).toContain("Dawn of Ashes");
    expect(html).toContain('/sets/dawn-of-ashes');
  });

  it("renders shortage badges breakdown", () => {
    const html = renderRow({
      totalShortageCopies: 15,
      hardShortageCopies: 10,
      sharedShortageCopies: 5,
    });
    expect(html).toContain("Shortages");
    expect(html).toContain("Hard Shortage");
    expect(html).toContain("Shared Shortage");
  });

  it("renders completion details", () => {
    const html = renderRow({ ownedCards: 40, totalCards: 100, completionPercent: 40 });
    expect(html).toContain("40/100");
    expect(html).toContain("40%");
  });
});