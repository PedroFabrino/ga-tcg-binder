export type WatchlistQuotaPolicy = "hard" | "shared" | "staples";

export interface StandardPlayablePrintingCandidate {
  setPrefix?: string;
  collectorNumber?: string;
  rarity?: number;
  isFoil?: boolean;
  rawName?: string;
}

/**
 * Checks whether an edition or product qualifies as a Standard Playable Printing:
 * - isFoil === false
 * - rarity <= 5 (Common 1 through Ultra Rare 5; excludes Collector Rarity 7)
 * - No special collector tags (CSR, CUR, CPR, Full Art, Extended Art, Foil, Judge)
 */
export function isStandardPlayablePrinting(candidate: StandardPlayablePrintingCandidate): boolean {
  if (candidate.isFoil) return false;
  if (candidate.rarity !== undefined && candidate.rarity > 5) return false;

  const collectorPattern = /(?:\b|_|\()(CSR|CUR|CPR|Full\s*Art|Extended\s*Art|Foil|Judge)(?:\b|_|\))/i;
  if (candidate.rawName && collectorPattern.test(candidate.rawName)) return false;
  if (candidate.collectorNumber && collectorPattern.test(candidate.collectorNumber)) return false;

  return true;
}

/**
 * Checks whether an edition or product is a Collector Printing (foil, high rarity, or special tags).
 */
export function isCollectorPrinting(candidate: StandardPlayablePrintingCandidate): boolean {
  return !isStandardPlayablePrinting(candidate);
}

/**
 * Computes required quota for a card under the specified policy.
 */
export function computeQuotaForCard(
  totalDemand: number,
  peakDemand: number,
  policy: WatchlistQuotaPolicy
): number {
  switch (policy) {
    case "shared":
      return peakDemand;
    case "staples":
      return Math.min(totalDemand, 4);
    case "hard":
    default:
      return totalDemand;
  }
}

/**
 * Resolves user's active quota policy.
 */
export function getEffectiveQuotaPolicy(user?: {
  watchlistPolicyHard?: boolean | null;
  watchlistPolicyShared?: boolean | null;
  watchlistPolicyStaples?: boolean | null;
}): WatchlistQuotaPolicy {
  if (user?.watchlistPolicyShared) return "shared";
  if (user?.watchlistPolicyStaples) return "staples";
  return "hard";
}
