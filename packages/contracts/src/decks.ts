/**
 * Deck Sections and Priority Ordering Contracts
 * Per ADR 0030 and ADR 0031
 */

export const DECK_SECTIONS = ["competitive", "4fun"] as const;
export type DeckSection = (typeof DECK_SECTIONS)[number];

export const DEFAULT_DECK_SECTION: DeckSection = "4fun";

export function isDeckSection(val: unknown): val is DeckSection {
  return typeof val === "string" && (DECK_SECTIONS as readonly string[]).includes(val);
}

export function isCompetitive(section: unknown): boolean {
  return section === "competitive";
}

/**
 * Shared deterministic deck ordering comparator.
 * Sorts decks:
 * 1. Section: 'competitive' comes before '4fun'
 * 2. Priority: ascending (0, 1, 2...)
 * 3. Fallback: createdAt ascending
 */
export function compareDecksBySectionAndPriority<
  T extends {
    section?: string | null;
    priority?: number | null;
    createdAt?: Date | string | null;
  }
>(a: T, b: T): number {
  const aSec = a.section === "competitive" ? 0 : 1;
  const bSec = b.section === "competitive" ? 0 : 1;
  if (aSec !== bSec) return aSec - bSec;

  const aPrio = a.priority ?? 0;
  const bPrio = b.priority ?? 0;
  if (aPrio !== bPrio) return aPrio - bPrio;

  const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
  const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
  return aDate - bDate;
}
