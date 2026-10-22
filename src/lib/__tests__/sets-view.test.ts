import { describe, expect, it } from "vitest";
import {
  searchSets,
  filterSetsByCategory,
  sortSets,
  splitActiveHidden,
  applyHiddenFlag,
  type SetSortMode,
  type SetCategoryFilter,
} from "../sets-view";
import type { FeaturedSetSummary, SetCategory } from "@ga/contracts";

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

const groups: FeaturedSetSummary[] = [
  makeGroup({ groupUuid: "uuid-1", groupName: "Dawn of Ashes", completionPercent: 40, totalShortageCopies: 15, releaseDate: "2023-05-01", category: "booster" }),
  makeGroup({ groupUuid: "uuid-2", groupName: "Alchemical Revolution", completionPercent: 80, totalShortageCopies: 5, releaseDate: "2024-01-15", category: "booster" }),
  makeGroup({ groupUuid: "uuid-3", groupName: "Starter Deck: Lorraine", completionPercent: 60, totalShortageCopies: 20, releaseDate: null, category: "decks" }),
  makeGroup({ groupUuid: "uuid-4", groupName: "Distorted Reflections", completionPercent: 20, totalShortageCopies: 30, releaseDate: "2025-03-10", category: "booster", isHidden: true }),
  makeGroup({ groupUuid: "uuid-5", groupName: "Cárátères Spéciâls", completionPercent: 50, totalShortageCopies: 0, releaseDate: "2024-06-01", category: "booster" }),
  makeGroup({ groupUuid: "uuid-6", groupName: "Re:Collection - Arisanna", completionPercent: 90, totalShortageCopies: 3, releaseDate: "2023-11-20", category: "decks", isHidden: true }),
];

describe("searchSets", () => {
  it("returns all groups when query is empty", () => {
    expect(searchSets(groups, "")).toHaveLength(6);
  });

  it("is case-insensitive", () => {
    const result = searchSets(groups, "dawn");
    expect(result).toHaveLength(1);
    expect(result[0].groupName).toBe("Dawn of Ashes");
  });

  it("is diacritic-insensitive", () => {
    const result = searchSets(groups, "carateres");
    expect(result).toHaveLength(1);
    expect(result[0].groupName).toBe("Cárátères Spéciâls");
  });

  it("matches partial group names", () => {
    const result = searchSets(groups, "alchemical");
    expect(result).toHaveLength(1);
    expect(result[0].groupUuid).toBe("uuid-2");
  });

  it("returns empty array for no matches", () => {
    expect(searchSets(groups, "zzz")).toHaveLength(0);
  });

  it("matches colon-separated names", () => {
    const result = searchSets(groups, "lorraine");
    expect(result).toHaveLength(1);
    expect(result[0].groupUuid).toBe("uuid-3");
  });
});

describe("filterSetsByCategory", () => {
  it("returns all groups for 'all' filter", () => {
    expect(filterSetsByCategory(groups, "all")).toHaveLength(6);
  });

  it("returns only booster groups for 'booster' filter", () => {
    const result = filterSetsByCategory(groups, "booster");
    expect(result).toHaveLength(4);
    expect(result.every((g) => g.category === "booster")).toBe(true);
  });

  it("returns only decks groups for 'decks' filter", () => {
    const result = filterSetsByCategory(groups, "decks");
    expect(result).toHaveLength(2);
    expect(result.every((g) => g.category === "decks")).toBe(true);
  });
});

describe("sortSets", () => {
  it("sorts by shortages descending by default", () => {
    const result = sortSets(groups, "shortages");
    expect(result[0].totalShortageCopies).toBe(30);
    expect(result[1].totalShortageCopies).toBe(20);
    expect(result[2].totalShortageCopies).toBe(15);
    expect(result[3].totalShortageCopies).toBe(5);
    expect(result[4].totalShortageCopies).toBe(3);
    expect(result[5].totalShortageCopies).toBe(0);
  });

  it("sorts by completion ascending", () => {
    const result = sortSets(groups, "completionAsc");
    expect(result[0].completionPercent).toBe(20);
    expect(result[1].completionPercent).toBe(40);
    expect(result[2].completionPercent).toBe(50);
    expect(result[3].completionPercent).toBe(60);
    expect(result[4].completionPercent).toBe(80);
    expect(result[5].completionPercent).toBe(90);
  });

  it("sorts by completion descending", () => {
    const result = sortSets(groups, "completionDesc");
    expect(result[0].completionPercent).toBe(90);
    expect(result[1].completionPercent).toBe(80);
    expect(result[2].completionPercent).toBe(60);
    expect(result[3].completionPercent).toBe(50);
    expect(result[4].completionPercent).toBe(40);
    expect(result[5].completionPercent).toBe(20);
  });

  it("sorts by release date newest first with null/empty last", () => {
    const result = sortSets(groups, "date");

    // Newest first
    expect(result[0].groupUuid).toBe("uuid-4"); // 2025-03-10
    expect(result[1].groupUuid).toBe("uuid-5"); // 2024-06-01
    expect(result[2].groupUuid).toBe("uuid-2"); // 2024-01-15
    expect(result[3].groupUuid).toBe("uuid-6"); // 2023-11-20
    expect(result[4].groupUuid).toBe("uuid-1"); // 2023-05-01
    // null release date last
    expect(result[5].groupUuid).toBe("uuid-3");
  });

  it("sorts by name ascending", () => {
    const result = sortSets(groups, "name");
    const names = result.map((g) => g.groupName);
    expect(names).toEqual([
      "Alchemical Revolution",
      "Cárátères Spéciâls",
      "Dawn of Ashes",
      "Distorted Reflections",
      "Re:Collection - Arisanna",
      "Starter Deck: Lorraine",
    ]);
  });
});

describe("splitActiveHidden", () => {
  it("splits active and hidden groups correctly", () => {
    const { active, hidden } = splitActiveHidden(groups);
    expect(active).toHaveLength(4);
    expect(hidden).toHaveLength(2);
    expect(hidden[0].groupUuid).toBe("uuid-4");
    expect(hidden[1].groupUuid).toBe("uuid-6");
    expect(active.every((g) => !g.isHidden)).toBe(true);
    expect(hidden.every((g) => g.isHidden)).toBe(true);
  });

  it("returns empty hidden array when nothing is hidden", () => {
    const allActive = groups.filter((g) => !g.isHidden);
    const { active, hidden } = splitActiveHidden(allActive);
    expect(active).toHaveLength(4);
    expect(hidden).toHaveLength(0);
  });
});

describe("applyHiddenFlag", () => {
  it("sets isHidden to true for the matching group", () => {
    const result = applyHiddenFlag(groups, "uuid-1", true);
    expect(result.find((g) => g.groupUuid === "uuid-1")?.isHidden).toBe(true);
    // Non-matching groups unchanged
    expect(result.find((g) => g.groupUuid === "uuid-2")?.isHidden).toBe(false);
  });

  it("sets isHidden to false for the matching group", () => {
    const result = applyHiddenFlag(groups, "uuid-4", false);
    expect(result.find((g) => g.groupUuid === "uuid-4")?.isHidden).toBe(false);
  });

  it("does not mutate the original array", () => {
    const original = [...groups];
    applyHiddenFlag(groups, "uuid-1", true);
    expect(groups).toEqual(original);
  });

  it("returns unchanged array when uuid not found", () => {
    const result = applyHiddenFlag(groups, "nonexistent", true);
    expect(result).toEqual(groups);
  });
});