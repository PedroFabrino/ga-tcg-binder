import type { DeckAdvisorRawUserData } from "../db/repositories/deck-advisor-repository";

export interface UserAggregatedHolding {
  cardSlug: string;
  name: string;
  element: string;
  class: string;
  type: string;
  subtypes: string[];
  effect: string;
  costReserve: number | null;
  costMemory: number | null;
  speed: boolean | null;
  ownedQuantity: number;
  idleQuantity: number;
  sharedQuantity: number;
  storeQuantity: number;
  isDedicatedToOtherDeck: boolean;
}

/**
 * Parses JSON card subtypes safely with observable warning degradation.
 */
export function parseCardSubtypes(
  raw: string | null | undefined,
  contextLabel = "card"
): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.warn(`[DeckAdvisor] Failed to parse subtypes for ${contextLabel} (${raw}): ${message}`);
    return [];
  }
}

/**
 * Aggregates user collection inventory and personal store listings by card slug,
 * strictly accounting for dedicated cards, other deck demand, and idle/shared quantities.
 */
export function aggregateUserHoldingsBySlug(
  userData: DeckAdvisorRawUserData,
  selectedDeckId?: string,
  selectedDeckSection?: string,
  selectedDeckPriority?: number
): Map<string, UserAggregatedHolding> {
  const holdings = new Map<string, UserAggregatedHolding>();

  // 1. Ingest Binder Inventory (collection_items)
  for (const inv of userData.inventory) {
    let entry = holdings.get(inv.cardSlug);
    if (!entry) {
      entry = {
        cardSlug: inv.cardSlug,
        name: inv.name,
        element: inv.element || "NORM",
        class: inv.class || "ALL",
        type: inv.type || "UNKNOWN",
        subtypes: parseCardSubtypes(inv.subtypes, inv.name || inv.cardSlug),
        effect: inv.effect || "",
        costReserve: inv.costReserve,
        costMemory: inv.costMemory,
        speed: inv.speed,
        ownedQuantity: 0,
        idleQuantity: 0,
        sharedQuantity: 0,
        storeQuantity: 0,
        isDedicatedToOtherDeck: false,
      };
      holdings.set(inv.cardSlug, entry);
    }

    const usedInOtherDeck = userData.otherDeckCardUsages.some(
      (u) => u.cardSlug === inv.cardSlug && (!selectedDeckId || u.deckId !== selectedDeckId)
    );

    if (inv.isDedicated && usedInOtherDeck) {
      // Dedicated copy reserved strictly for another deck
      entry.isDedicatedToOtherDeck = true;
    } else {
      // Available to this deck (Shared copy or dedicated to this deck)
      entry.ownedQuantity += inv.quantity;
    }
  }

  // Calculate Idle vs Shared copies after summing available owned copies.
  // Respects Deck Section and Priority:
  // - If advising a 4Fun deck, all Competitive deck usages are reserved and subtracted first.
  // - If advising a Competitive deck, only higher-priority Competitive deck usages are subtracted.
  for (const entry of Array.from(holdings.values())) {
    let reservedByPriorDecks = 0;
    if (selectedDeckSection === "competitive") {
      reservedByPriorDecks = userData.otherDeckCardUsages
        .filter(
          (u) =>
            u.cardSlug === entry.cardSlug &&
            (!selectedDeckId || u.deckId !== selectedDeckId) &&
            u.section === "competitive" &&
            selectedDeckPriority !== undefined &&
            u.priority !== undefined &&
            u.priority < selectedDeckPriority
        )
        .reduce((sum, u) => sum + u.quantity, 0);
    } else {
      reservedByPriorDecks = userData.otherDeckCardUsages
        .filter(
          (u) =>
            u.cardSlug === entry.cardSlug &&
            (!selectedDeckId || u.deckId !== selectedDeckId) &&
            u.section === "competitive"
        )
        .reduce((sum, u) => sum + u.quantity, 0);
    }

    const effectiveOwned = Math.max(0, entry.ownedQuantity - reservedByPriorDecks);

    const otherDemand = userData.otherDeckCardUsages
      .filter((u) => u.cardSlug === entry.cardSlug && (!selectedDeckId || u.deckId !== selectedDeckId))
      .reduce((sum, u) => sum + u.quantity, 0);

    entry.idleQuantity = Math.max(0, effectiveOwned - otherDemand);
    entry.sharedQuantity = Math.max(0, effectiveOwned - entry.idleQuantity);
    entry.ownedQuantity = effectiveOwned;
  }

  // 2. Ingest Personal Store Listings (myp_cards)
  for (const s of userData.storeListings) {
    if (!s.cardSlug) continue;
    let entry = holdings.get(s.cardSlug);
    if (!entry) {
      entry = {
        cardSlug: s.cardSlug,
        name: s.name || s.cardName || s.cardSlug,
        element: s.element || "NORM",
        class: s.class || "ALL",
        type: s.type || "UNKNOWN",
        subtypes: parseCardSubtypes(s.subtypes, s.cardName || s.cardSlug),
        effect: s.effect || "",
        costReserve: s.costReserve ?? null,
        costMemory: s.costMemory ?? null,
        speed: s.speed ?? null,
        ownedQuantity: 0,
        idleQuantity: 0,
        sharedQuantity: 0,
        storeQuantity: 0,
        isDedicatedToOtherDeck: false,
      };
      holdings.set(s.cardSlug, entry);
    }
    entry.storeQuantity += s.quantity;
  }

  return holdings;
}
