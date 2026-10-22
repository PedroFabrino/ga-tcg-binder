import type { AssistantShortageItem } from "@ga/contracts";

export interface AssistantShortageCalculationResult {
  deckId: string;
  deckName: string;
  format: string;
  champion: string | null;
  totalCards: number;
  uniqueCards: number;
  completionPercentage: number;
  hardShortages: AssistantShortageItem[];
  sharedShortages: AssistantShortageItem[];
  totalHardShortages: number;
  totalSharedShortages: number;
}

/**
 * Pure in-memory shortage computation from preloaded batch data.
 * Respects Grand Archive domain rules: Hard Shortages (unowned copies)
 * vs Shared Shortages (owned copies contended across multiple decks).
 */
export function computeDeckShortagesFromData(
  deck: { id: string; name: string; format?: string | null; champion?: string | null },
  targetDeckCards: Array<{
    id: string;
    cardSlug: string;
    zone: string;
    quantity: number;
    assignedEditionId: string | null;
    cardName: string | null;
    element: string | null;
  }>,
  otherDeckCards: Array<{
    cardSlug: string;
    deckName: string;
    quantity: number;
    assignedEditionId: string | null;
  }>,
  userInventory: Array<{
    id: string;
    cardSlug: string;
    quantity: number;
    isDedicated: boolean;
  }>
): AssistantShortageCalculationResult {
  let totalCardsRequired = 0;
  let totalHardMissingCopies = 0;
  const hardShortages: AssistantShortageItem[] = [];
  const sharedShortages: AssistantShortageItem[] = [];

  for (const dc of targetDeckCards) {
    const slug = dc.cardSlug;
    const cardName = dc.cardName || slug;
    const required = dc.quantity;
    totalCardsRequired += required;

    const ownedForCard = userInventory.filter((inv) => inv.cardSlug === slug);
    const dedicatedOwned = ownedForCard
      .filter((inv) => inv.isDedicated)
      .reduce((sum, inv) => sum + inv.quantity, 0);
    const sharedOwned = ownedForCard
      .filter((inv) => !inv.isDedicated)
      .reduce((sum, inv) => sum + inv.quantity, 0);
    const totalOwned = dedicatedOwned + sharedOwned;

    const dedicatedToOtherDecks = otherDeckCards
      .filter((od) => od.cardSlug === slug && od.assignedEditionId)
      .reduce((sum, od) => sum + od.quantity, 0);

    const available = Math.max(0, totalOwned - dedicatedToOtherDecks);
    const missing = Math.max(0, required - available);
    const hardMissing = Math.max(0, required - totalOwned);

    const otherDemandForSlug = otherDeckCards
      .filter((od) => od.cardSlug === slug)
      .reduce((sum, od) => sum + od.quantity, 0);
    const totalSystemDemand = required + otherDemandForSlug;
    const isContended = totalSystemDemand > totalOwned && otherDemandForSlug > 0;

    const contendingDeckNames = Array.from(
      new Set(otherDeckCards.filter((od) => od.cardSlug === slug).map((od) => od.deckName))
    );

    if (hardMissing > 0) {
      totalHardMissingCopies += hardMissing;
      hardShortages.push({
        cardSlug: slug,
        cardName,
        element: dc.element || "Norm",
        rarity: null,
        requiredQuantity: required,
        missingQuantity: hardMissing,
        sharedQuantity: 0,
        competingDecks: contendingDeckNames,
        type: "hard",
        zone: dc.zone,
        imageUrl: null,
      });
    } else if (missing > 0 || isContended) {
      const sharedMissing = missing > 0 ? missing : required;
      sharedShortages.push({
        cardSlug: slug,
        cardName,
        element: dc.element || "Norm",
        rarity: null,
        requiredQuantity: required,
        missingQuantity: 0,
        sharedQuantity: sharedMissing,
        competingDecks: contendingDeckNames,
        type: "shared",
        zone: dc.zone,
        imageUrl: null,
      });
    }
  }

  const playableOwned = Math.max(0, totalCardsRequired - totalHardMissingCopies);
  const completionPercentage =
    totalCardsRequired > 0
      ? Math.max(0, Math.min(100, Math.round((playableOwned / totalCardsRequired) * 100)))
      : 100;

  return {
    deckId: deck.id,
    deckName: deck.name,
    format: deck.format || "standard",
    champion: deck.champion || null,
    totalCards: totalCardsRequired,
    uniqueCards: targetDeckCards.length,
    completionPercentage,
    hardShortages,
    sharedShortages,
    totalHardShortages: hardShortages.length,
    totalSharedShortages: sharedShortages.length,
  };
}
