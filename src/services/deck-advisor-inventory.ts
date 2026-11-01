import type {
  DeckAdvisorCandidateCard,
  DeckAdvisorAcquisitionTier,
  DeckAdvisorDeckCardSnapshot,
} from "@ga/contracts";
import type { DeckAdvisorRawUserData } from "../db/repositories/deck-advisor-repository";

/**
 * Parses card subtypes from JSON or comma-separated string, with fallback
 * pattern matching on card name/slug if empty.
 */
export function parseCardSubtypes(rawSubtypes: unknown, cardName: string): string[] {
  if (Array.isArray(rawSubtypes)) {
    return rawSubtypes.map(String).map((s) => s.trim().toUpperCase()).filter(Boolean);
  }

  if (typeof rawSubtypes === "string") {
    try {
      const parsed = JSON.parse(rawSubtypes);
      if (Array.isArray(parsed)) {
        return parsed.map(String).map((s) => s.trim().toUpperCase()).filter(Boolean);
      }
    } catch {
      // not JSON, fallback to comma split
      const parts = rawSubtypes.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
      if (parts.length > 0) return parts;
    }
  }

  // Fallback heuristics based on canonical Grand Archive naming rules
  const subtypes: string[] = [];
  const lower = cardName.toLowerCase();
  if (/distortion/i.test(lower)) subtypes.push("DISTORTION");
  if (/spirit/i.test(lower)) subtypes.push("SPIRIT");
  if (/regalia/i.test(lower)) subtypes.push("REGALIA");
  if (/weapon/i.test(lower)) subtypes.push("WEAPON");
  if (/ally/i.test(lower)) subtypes.push("ALLY");
  if (/attack/i.test(lower)) subtypes.push("ATTACK");
  if (/action/i.test(lower)) subtypes.push("ACTION");

  return subtypes;
}

/**
 * Aggregates user's binder inventory and active store listings by card slug,
 * computing idle vs shared quantities based on other deck usages and priority.
 */
export function aggregateUserHoldingsBySlug(
  userData: DeckAdvisorRawUserData,
  selectedDeckId?: string,
  selectedDeckSection?: string,
  selectedDeckPriority?: number
): Map<string, DeckAdvisorCandidateCard> {
  const holdings = new Map<string, DeckAdvisorCandidateCard>();

  // 1. Ingest Personal Binder Collection (collection_items)
  const collectionItems = (userData as any)?.collectionItems || userData?.inventory || [];
  const otherDeckCardUsages = userData?.otherDeckCardUsages || [];
  const storeListings = userData?.storeListings || [];

  for (const inv of collectionItems) {
    if (!inv.cardSlug) continue;

    let entry = holdings.get(inv.cardSlug);
    if (!entry) {
      entry = {
        cardSlug: inv.cardSlug,
        cardName: inv.name || inv.cardName || inv.cardSlug,
        element: inv.element || "NORM",
        class: inv.class || "ALL",
        type: inv.type || "UNKNOWN",
        subtypes: parseCardSubtypes(inv.subtypes, inv.name || inv.cardName || inv.cardSlug),
        effect: inv.effect || "",
        costReserve: inv.costReserve ?? null,
        costMemory: inv.costMemory ?? null,
        speed: inv.speed ?? null,
        tier: "binder_available",
        ownedQuantity: 0,
        idleQuantity: 0,
        sharedQuantity: 0,
        storeQuantity: 0,
        classBonusActive: false,
        isDedicatedToOtherDeck: false,
      };
      holdings.set(inv.cardSlug, entry);
    }

    const usedInOtherDeck = otherDeckCardUsages.some(
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
  // - If advising a Competitive deck:
  //   - Only higher-priority Competitive decks subtract reserved copies.
  //   - Competitive decks never share copies with 4Fun decks, so available copies are idle to this deck.
  // - If advising a 4Fun deck:
  //   - All Competitive decks reserve copies first, forming the leftover pool for 4Fun decks.
  //   - Other 4Fun decks share that leftover pool without double-deduction.
  for (const entry of Array.from(holdings.values())) {
    if (selectedDeckSection === "competitive") {
      const higherPriorityCompReserved = otherDeckCardUsages
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

      const effectiveOwned = Math.max(0, entry.ownedQuantity - higherPriorityCompReserved);
      entry.ownedQuantity = effectiveOwned;
      entry.idleQuantity = effectiveOwned;
      entry.sharedQuantity = 0;
    } else {
      // 4Fun deck
      const allCompReserved = otherDeckCardUsages
        .filter(
          (u) =>
            u.cardSlug === entry.cardSlug &&
            (!selectedDeckId || u.deckId !== selectedDeckId) &&
            u.section === "competitive"
        )
        .reduce((sum, u) => sum + u.quantity, 0);

      const leftover4Fun = Math.max(0, entry.ownedQuantity - allCompReserved);

      const otherFunDemand = otherDeckCardUsages
        .filter(
          (u) =>
            u.cardSlug === entry.cardSlug &&
            (!selectedDeckId || u.deckId !== selectedDeckId) &&
            u.section !== "competitive"
        )
        .reduce((sum, u) => sum + u.quantity, 0);

      entry.ownedQuantity = leftover4Fun;
      entry.idleQuantity = Math.max(0, leftover4Fun - otherFunDemand);
      entry.sharedQuantity = Math.min(leftover4Fun, otherFunDemand);
    }
  }

  // 2. Ingest Personal Store Listings (myp_cards)
  for (const s of storeListings) {
    if (!s.cardSlug) continue;
    let entry = holdings.get(s.cardSlug);
    if (!entry) {
      entry = {
        cardSlug: s.cardSlug,
        cardName: s.name || s.cardName || s.cardSlug,
        element: s.element || "NORM",
        class: s.class || "ALL",
        type: s.type || "UNKNOWN",
        subtypes: parseCardSubtypes(s.subtypes, s.name || s.cardName || s.cardSlug),
        effect: s.effect || "",
        costReserve: s.costReserve ?? null,
        costMemory: s.costMemory ?? null,
        speed: s.speed ?? null,
        tier: "store_pullback",
        ownedQuantity: 0,
        idleQuantity: 0,
        sharedQuantity: 0,
        storeQuantity: 0,
        classBonusActive: false,
      };
      holdings.set(s.cardSlug, entry);
    }

    entry.storeQuantity += s.quantity;

    // Promote tier to binder_available if user also has physical copies in binder,
    // otherwise it remains store_pullback
    if (entry.ownedQuantity === 0 && entry.storeQuantity > 0) {
      entry.tier = "store_pullback";
    }
  }

  return holdings;
}

/**
 * Computes up to 2 fallback alternatives for cards with shared shortages in 4Fun decks.
 */
export function compute4FunFallbackAlternatives(
  deckSection: string | undefined,
  deckCards: Array<{ cardSlug: string }>,
  deckCardSnapshots: DeckAdvisorDeckCardSnapshot[],
  candidatePool: DeckAdvisorCandidateCard[]
): void {
  if (deckSection === "competitive") return;

  const tierOrder: Record<DeckAdvisorAcquisitionTier, number> = {
    binder_available: 0,
    store_pullback: 1,
    unowned_upgrade: 2,
  };

  const existingDeckSlugs = new Set(deckCards.map((c) => c.cardSlug));

  for (const card of deckCardSnapshots) {
    if (card.sharedShortage > 0) {
      const compatibleCandidates = candidatePool
        .filter(
          (c) =>
            c.cardSlug !== card.cardSlug &&
            !existingDeckSlugs.has(c.cardSlug) &&
            (c.element.toUpperCase() === "NORM" || c.element.toUpperCase() === card.element.toUpperCase()) &&
            (c.class.toUpperCase() === "ALL" || c.class.toUpperCase() === card.class.toUpperCase())
        )
        .sort((a, b) => (tierOrder[a.tier] ?? 3) - (tierOrder[b.tier] ?? 3));

      if (compatibleCandidates.length > 0) {
        card.fallbackAlternatives = compatibleCandidates
          .slice(0, 2)
          .map((c) => c.cardName);
      }
    }
  }
}
