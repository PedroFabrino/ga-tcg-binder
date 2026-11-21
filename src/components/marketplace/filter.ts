import { normalizeElement } from "@/lib/elements";
import type {
  GlobalMarketplaceCardItem,
  MarketplaceCardItem,
} from "@/services/marketplace";

export type ShortageFilter =
  | "ALL_SHORTAGES"
  | "HARD_ONLY"
  | "SHARED_ONLY"
  | "STAPLES_ONLY"
  | "ALL_MARKET";

export type PriceFilter =
  | "ALL"
  | "FAIR_ONLY"
  | "OVERPRICED_ONLY"
  | "HEAVILY_OVERPRICED_ONLY";

export interface MarketplaceAttributeFilterState {
  query: string;
  selectedElements: string[];
  selectedRarities: number[];
}

export interface GlobalMarketplaceFilterState extends MarketplaceAttributeFilterState {
  selectedStoreId: string | null;
  shortageFilter: ShortageFilter;
  priceFilter: PriceFilter;
}

export interface PersonalMarketplaceFilterState extends MarketplaceAttributeFilterState {
  filterMode: "ALL" | "SHORTAGES" | "STAPLES";
  onlyShortages: boolean;
}

export interface MarketplaceFilterCounts {
  allStoresCount: number;
  storeCounts: Map<string, number>;
  hardCount: number;
  sharedCount: number;
  totalListings: number;
  totalMarketCopies: number;
  overpricedCount: number;
  heavilyOverpricedCount: number;
}

/**
 * Matches a marketplace listing against a free-text query using only card identity
 * (card name, raw listing name, and set prefix). Excludes deck names and staple categories.
 */
export function matchesMarketplaceQuery(
  card: { cardName?: string | null; rawName?: string | null; setPrefix?: string | null },
  query: string
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const cardName = (card.cardName || "").toLowerCase();
  const rawName = (card.rawName || "").toLowerCase();
  const setPrefix = (card.setPrefix || "").toLowerCase();

  return (
    cardName.includes(q) ||
    rawName.includes(q) ||
    setPrefix.includes(q) ||
    `${setPrefix} ${cardName}`.includes(q) ||
    `${setPrefix} ${rawName}`.includes(q)
  );
}

/** Checks whether a global marketplace listing satisfies the active shortage priority tab. */
export function matchesShortageFilter(
  card: GlobalMarketplaceCardItem,
  shortageFilter: ShortageFilter
): boolean {
  if (shortageFilter === "ALL_SHORTAGES") {
    return card.shortageTier !== "NONE" && card.netExternalStock > 0;
  }
  if (shortageFilter === "HARD_ONLY") {
    return card.shortageTier === "HARD" && card.netExternalStock > 0;
  }
  if (shortageFilter === "SHARED_ONLY") {
    return card.shortageTier === "SHARED" && card.netExternalStock > 0;
  }
  if (shortageFilter === "STAPLES_ONLY") {
    return Boolean(card.isMetaStaple) && card.netExternalStock > 0;
  }
  return true;
}

/** Checks whether a global marketplace listing matches the selected price fairness filter. */
export function matchesPriceFilter(
  card: GlobalMarketplaceCardItem,
  priceFilter: PriceFilter
): boolean {
  const tier = card.priceFairness?.tier;
  if (priceFilter === "FAIR_ONLY") {
    return tier === "NORMAL" || tier === "BELOW_MARKET";
  }
  if (priceFilter === "OVERPRICED_ONLY") {
    return tier === "SLIGHTLY_OVERPRICED" || tier === "HEAVILY_OVERPRICED";
  }
  if (priceFilter === "HEAVILY_OVERPRICED_ONLY") {
    return tier === "HEAVILY_OVERPRICED";
  }
  return true;
}

/** Matches text query, element chips, and rarity chips against any marketplace card item. */
export function matchesAttributeFilters(
  card: {
    cardName?: string | null;
    rawName?: string | null;
    setPrefix?: string | null;
    element?: string | null;
    rarity?: number | null;
  },
  filters: MarketplaceAttributeFilterState
): boolean {
  if (!matchesMarketplaceQuery(card, filters.query)) {
    return false;
  }

  if (filters.selectedElements.length > 0) {
    const el = normalizeElement(card.element);
    const matchesElement = filters.selectedElements.some((sel) => normalizeElement(sel) === el);
    if (!matchesElement) return false;
  }

  if (filters.selectedRarities.length > 0) {
    if (!filters.selectedRarities.includes(card.rarity || 1)) return false;
  }

  return true;
}

/** Filters global marketplace listings across store, shortage tier, price fairness, and attributes. */
export function filterGlobalMarketplaceCards(
  cards: GlobalMarketplaceCardItem[],
  filters: GlobalMarketplaceFilterState
): GlobalMarketplaceCardItem[] {
  return cards.filter((card) => {
    if (filters.selectedStoreId && card.storeId !== filters.selectedStoreId) {
      return false;
    }
    if (!matchesShortageFilter(card, filters.shortageFilter)) {
      return false;
    }
    if (!matchesPriceFilter(card, filters.priceFilter)) {
      return false;
    }
    return matchesAttributeFilters(card, filters);
  });
}

/**
 * Computes reactive badge and summary counts reflecting the active search query,
 * element/rarity chips, store selection, shortage tier, and price filter.
 */
export function computeMarketplaceFilterCounts(
  cards: GlobalMarketplaceCardItem[],
  filters: GlobalMarketplaceFilterState
): MarketplaceFilterCounts {
  const attributeAndPriceMatched = cards.filter(
    (card) => matchesPriceFilter(card, filters.priceFilter) && matchesAttributeFilters(card, filters)
  );

  const storeCounts = new Map<string, number>();
  for (const card of attributeAndPriceMatched) {
    storeCounts.set(card.storeId, (storeCounts.get(card.storeId) || 0) + 1);
  }

  const storeScopedCards = filters.selectedStoreId
    ? attributeAndPriceMatched.filter((card) => card.storeId === filters.selectedStoreId)
    : attributeAndPriceMatched;

  let hardCount = 0;
  let sharedCount = 0;
  let totalMarketCopies = 0;
  for (const card of storeScopedCards) {
    totalMarketCopies += card.quantity;
    if (card.shortageTier === "HARD" && card.netExternalStock > 0) {
      hardCount++;
    } else if (card.shortageTier === "SHARED" && card.netExternalStock > 0) {
      sharedCount++;
    }
  }

  let overpricedCount = 0;
  let heavilyOverpricedCount = 0;
  for (const card of cards) {
    if (filters.selectedStoreId && card.storeId !== filters.selectedStoreId) continue;
    if (!matchesShortageFilter(card, filters.shortageFilter)) continue;
    if (!matchesAttributeFilters(card, filters)) continue;

    const tier = card.priceFairness?.tier;
    if (tier === "HEAVILY_OVERPRICED") {
      heavilyOverpricedCount++;
      overpricedCount++;
    } else if (tier === "SLIGHTLY_OVERPRICED") {
      overpricedCount++;
    }
  }

  return {
    allStoresCount: attributeAndPriceMatched.length,
    storeCounts,
    hardCount,
    sharedCount,
    totalListings: storeScopedCards.length,
    totalMarketCopies,
    overpricedCount,
    heavilyOverpricedCount,
  };
}

/** Filters personal MyP Store listings across shortage/staple mode and card attributes. */
export function filterPersonalMarketplaceCards(
  cards: MarketplaceCardItem[],
  filters: PersonalMarketplaceFilterState
): MarketplaceCardItem[] {
  return cards.filter((card) => {
    if (filters.filterMode === "SHORTAGES" || filters.onlyShortages) {
      if (!card.isShortageOffset) return false;
    } else if (filters.filterMode === "STAPLES") {
      if (!card.isStapleDeficit) return false;
    }
    return matchesAttributeFilters(card, filters);
  });
}
