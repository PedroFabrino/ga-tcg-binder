/**
 * Pure view helpers for the /sets dashboard: search, filter, sort, and
 * active / hidden split. No server imports; usable on client or server.
 */

import type { FeaturedSetSummary } from "@ga/contracts";

export type SetCategoryFilter = "all" | "booster" | "decks";

export type SetSortMode = "shortages" | "completionAsc" | "completionDesc" | "date" | "name";

/**
 * Normalise a string by removing combining diacritical marks and lowercasing.
 * This gives diacritic-insensitive comparison (e.g. "cárátères" → "carateres").
 */
function normalise(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Diacritic-insensitive, case-insensitive substring search on groupName. */
export function searchSets(
  groups: FeaturedSetSummary[],
  query: string,
): FeaturedSetSummary[] {
  if (!query.trim()) return groups;
  const q = normalise(query.trim());
  return groups.filter((g) => normalise(g.groupName).includes(q));
}

/** Filter groups by category. */
export function filterSetsByCategory(
  groups: FeaturedSetSummary[],
  category: SetCategoryFilter,
): FeaturedSetSummary[] {
  if (category === "all") return groups;
  return groups.filter((g) => g.category === category);
}

const SORTERS: Record<
  SetSortMode,
  (a: FeaturedSetSummary, b: FeaturedSetSummary) => number
> = {
  shortages: (a, b) => b.totalShortageCopies - a.totalShortageCopies,
  completionAsc: (a, b) => a.completionPercent - b.completionPercent,
  completionDesc: (a, b) => b.completionPercent - a.completionPercent,
  date: (a, b) => {
    // Null / empty release dates go last.
    const aDate = a.releaseDate?.trim() || null;
    const bDate = b.releaseDate?.trim() || null;
    if (aDate && bDate) return bDate.localeCompare(aDate); // newest first
    if (aDate) return -1;
    if (bDate) return 1;
    return 0;
  },
  name: (a, b) => a.groupName.localeCompare(b.groupName),
};

/**
 * Sort groups with the chosen mode. The original array is not mutated.
 */
export function sortSets(
  groups: FeaturedSetSummary[],
  mode: SetSortMode,
): FeaturedSetSummary[] {
  return [...groups].sort(SORTERS[mode]);
}

/** Split groups into active (isHidden === false) and hidden. */
export function splitActiveHidden(
  groups: FeaturedSetSummary[],
): { active: FeaturedSetSummary[]; hidden: FeaturedSetSummary[] } {
  const active: FeaturedSetSummary[] = [];
  const hidden: FeaturedSetSummary[] = [];
  for (const g of groups) {
    (g.isHidden ? hidden : active).push(g);
  }
  return { active, hidden };
}

/**
 * Pure helper: returns a new array with the group identified by `uuid`
 * having its `isHidden` flag set to the given value. Other groups are
 * unchanged. Used for optimistic hide/unhide updates.
 */
export function applyHiddenFlag(
  groups: FeaturedSetSummary[],
  uuid: string,
  isHidden: boolean,
): FeaturedSetSummary[] {
  return groups.map((g) =>
    g.groupUuid === uuid ? { ...g, isHidden } : g,
  );
}