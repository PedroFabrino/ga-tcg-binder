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
 * Computes required quota for a card given active policies and demands.
 * - Hard Shortage (Compra Necessária): single-deck peak demand (`peakDemand`) to ensure at least 1 deck is playable.
 * - Shared Shortage (Revezamento entre Decks): concurrent demand across all decks (`totalDemand`).
 * - Staples Policy: staple recommended copies (e.g. from meta_staples or playset cap).
 */
export function computeQuotaForCard(
  totalDemand: number,
  peakDemand: number,
  policy: WatchlistQuotaPolicy,
  stapleRecommendedCopies = 0
): number {
  switch (policy) {
    case "hard":
      return peakDemand;
    case "shared":
      return totalDemand;
    case "staples":
      return Math.max(totalDemand, Math.min(stapleRecommendedCopies || 4, 4));
    default:
      return peakDemand;
  }
}

/**
 * Computes combined quota when multiple boolean policy flags are enabled.
 */
export function computeCombinedQuota(options: {
  totalDemand: number;
  peakDemand: number;
  policyHard: boolean;
  policyShared: boolean;
  policyStaples: boolean;
  stapleCopies?: number;
}): number {
  const quotas: number[] = [];
  if (options.policyHard) {
    quotas.push(options.peakDemand);
  }
  if (options.policyShared) {
    quotas.push(options.totalDemand);
  }
  if (options.policyStaples) {
    quotas.push(Math.max(options.totalDemand, Math.min(options.stapleCopies || 4, 4)));
  }
  if (quotas.length === 0) {
    return options.peakDemand; // default to Hard
  }
  return Math.max(...quotas);
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

export interface WatchlistStatusCounts {
  pendingAdds: number;
  pendingUpdates: number;
  pendingRemoves: number;
  watchingCount: number;
  ignoredCount: number;
}

/**
 * Counts watchlist items by status. Single shared helper eliminating Fowler smell across 4 files.
 */
export function summarizeWatchlistRows(rows: { status: string }[]): WatchlistStatusCounts {
  let pendingAdds = 0;
  let pendingUpdates = 0;
  let pendingRemoves = 0;
  let watchingCount = 0;
  let ignoredCount = 0;

  for (const r of rows) {
    if (r.status === "pending_add") pendingAdds++;
    else if (r.status === "pending_update") pendingUpdates++;
    else if (r.status === "pending_remove") pendingRemoves++;
    else if (r.status === "watching") watchingCount++;
    else if (r.status === "ignored") ignoredCount++;
  }

  return {
    pendingAdds,
    pendingUpdates,
    pendingRemoves,
    watchingCount,
    ignoredCount,
  };
}

/**
 * Normalizes policy input into consistent boolean flags.
 */
export function normalizePolicyFlags(input: {
  hard?: boolean;
  shared?: boolean;
  staples?: boolean;
  legacyPolicy?: string;
}): { hard: boolean; shared: boolean; staples: boolean } {
  if (input.legacyPolicy) {
    if (input.legacyPolicy === "shared") {
      return { hard: false, shared: true, staples: false };
    }
    if (input.legacyPolicy === "staples") {
      return { hard: false, shared: false, staples: true };
    }
    return { hard: true, shared: false, staples: false };
  }

  return {
    hard: input.hard ?? true,
    shared: input.shared ?? false,
    staples: input.staples ?? false,
  };
}

export interface WatchlistPartitionItem {
  id: string;
  cardName: string;
  setPrefix: string;
  collectorNumber: string;
  targetQuantity: number;
  targetPriceBrl: number;
  status: string;
  mypProductUrl?: string | null;
}

export function partitionPendingWatchlistItems(
  cards: Array<{
    cardName: string;
    watchlistItems?: Array<{
      id: string;
      editionSlug: string;
      collectorNumber: string;
      status: string;
      targetQuantity: number;
      targetPriceBrl: number;
      mypProductUrl?: string | null;
    }>;
  }>
): {
  pendingAdds: WatchlistPartitionItem[];
  pendingUpdates: WatchlistPartitionItem[];
  pendingRemoves: WatchlistPartitionItem[];
} {
  const pendingAdds: WatchlistPartitionItem[] = [];
  const pendingUpdates: WatchlistPartitionItem[] = [];
  const pendingRemoves: WatchlistPartitionItem[] = [];

  for (const card of cards) {
    if (!card.watchlistItems) continue;
    for (const item of card.watchlistItems) {
      const partItem: WatchlistPartitionItem = {
        id: item.id,
        cardName: card.cardName,
        setPrefix: item.editionSlug,
        collectorNumber: item.collectorNumber,
        targetQuantity: item.targetQuantity,
        targetPriceBrl: item.targetPriceBrl,
        status: item.status,
        mypProductUrl: item.mypProductUrl,
      };

      if (item.status === "pending_add") {
        pendingAdds.push(partItem);
      } else if (item.status === "pending_update") {
        pendingUpdates.push(partItem);
      } else if (item.status === "pending_remove") {
        pendingRemoves.push(partItem);
      }
    }
  }

  return { pendingAdds, pendingUpdates, pendingRemoves };
}

