/**
 * Shared contracts for featured set shortage ranking and checklist browsing.
 * These types are consumed by the web app, mobile app, and the set-shortage service.
 */

// ---------------------------------------------------------------------------
// Set Category
// ---------------------------------------------------------------------------

/** "decks" only when every child definition name matches "Starter Decks" or "Re:Collection"; otherwise "booster". */
export type SetCategory = "booster" | "decks";

// ---------------------------------------------------------------------------
// Featured Set Summary (displayed on /sets ranking page)
// ---------------------------------------------------------------------------

export interface FeaturedSetSummary {
  groupUuid: string;
  groupName: string;
  slug: string;
  imageUrl: string | null;
  sortOrder: number;

  /** Sum of peakMissing across all short cards attributed to this set group. */
  hardShortageCopies: number;
  /** Sum of (concurrentMissing - peakMissing) across all short cards attributed. */
  sharedShortageCopies: number;
  /** hard + shared = sum of concurrentMissing. */
  totalShortageCopies: number;

  /** Number of distinct card slugs with any shortage attributed to this group. */
  uniqueShortageCards: number;
  /** Number of distinct decks requiring at least one short card in this group. */
  impactedDecks: number;

  /** Number of distinct card slugs the user owns at least 1 copy of in this group. */
  ownedCards: number;
  /** Total number of distinct card slugs available in this group. */
  totalCards: number;
  /** ownedCards / totalCards * 100, or 0 when totalCards is 0. */
  completionPercent: number;

  /** Earliest child set definition release date (ISO string), or null. */
  releaseDate: string | null;
  /** Sorted list of child set definition prefixes. */
  childPrefixes: string[];

  category: SetCategory;
  isHidden: boolean;
}

// ---------------------------------------------------------------------------
// Set Group Stats (aggregate across all groups, shown in /sets header)
// ---------------------------------------------------------------------------

export interface SetGroupStats {
  totalGroups: number;
  totalHardShortageCopies: number;
  totalSharedShortageCopies: number;
  totalShortageCopies: number;
  totalCardsAcrossGroups: number;
  totalOwnedCardsAcrossGroups: number;
  overallCompletionPercent: number;
}

// ---------------------------------------------------------------------------
// Set Checklist Card (displayed on /sets/[groupSlug] checklist)
// ---------------------------------------------------------------------------

export interface SetChecklistCard {
  cardSlug: string;
  cardName: string;
  element: string;
  class: string;
  type: string;
  rarity: number;
  imageUrl: string | null;
  /** The set prefixes this card appears in within the group. */
  prefixes: string[];

  /** Total copies owned in the user's collection for this card. */
  ownedQuantity: number;
  /** Total copies required across all active decks. */
  requiredQuantity: number;
  /** Math.max(0, requiredQuantity - ownedQuantity). */
  missingQuantity: number;
  /** Whether missingQuantity > 0. */
  isShortage: boolean;

  /** Deck IDs that require this card. */
  requiringDeckIds: string[];
}

// ---------------------------------------------------------------------------
// Set Checklist Filters
// ---------------------------------------------------------------------------

export type SetChecklistFilterStatus = "all" | "shortages" | "owned" | "unowned";

export interface SetChecklistFilters {
  prefix: string | null;
  status: SetChecklistFilterStatus;
  /** Element code, e.g. "FIRE". Null/undefined matches every element. */
  element?: string | null;
  /** Rarity number. Null/undefined matches every rarity. */
  rarity?: number | null;
  /** Case-insensitive card-name search. Empty/undefined matches every card. */
  search?: string | null;
}

// ---------------------------------------------------------------------------
// Filter Helper
// ---------------------------------------------------------------------------

/**
 * Pure filter predicate for set checklist cards.
 * Returns true when the card matches the given filters.
 */
export function matchesSetChecklistFilters(
  card: SetChecklistCard,
  filters: SetChecklistFilters,
): boolean {
  if (filters.prefix !== null && !card.prefixes.includes(filters.prefix)) {
    return false;
  }

  if (filters.element && card.element.toUpperCase() !== filters.element.toUpperCase()) {
    return false;
  }

  if (filters.rarity != null && card.rarity !== filters.rarity) {
    return false;
  }

  const search = filters.search?.trim().toLowerCase();
  if (search && !card.cardName.toLowerCase().includes(search)) {
    return false;
  }

  switch (filters.status) {
    case "shortages":
      return card.isShortage;
    case "owned":
      return card.ownedQuantity > 0;
    case "unowned":
      return card.ownedQuantity === 0;
    case "all":
    default:
      return true;
  }
}