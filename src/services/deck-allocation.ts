/**
 * Pure card demand allocation engine across Competitive and 4Fun deck sections.
 * Implements ADR 0030 and ADR 0031.
 */

import { type DeckSection, compareDecksBySectionAndPriority } from "@ga/contracts";

export interface DeckCardDemand {
  deckId: string;
  deckName?: string;
  section: DeckSection;
  priority: number;
  createdAt?: Date | string | null;
  demand: number;
}

export interface DeckAllocationResult {
  deckId: string;
  section: DeckSection;
  priority: number;
  demand: number;
  allocated: number;
  hardMissing: number;
  sharedMissing: number;
}

export interface CardDemandAllocation {
  ownedTotal: number;
  competitiveReserved: number;
  leftover4Fun: number;
  peakMissing: number;
  concurrentMissing: number;
  deckAllocations: DeckAllocationResult[];
}

export function allocateCardDemand(
  ownedTotal: number,
  rawDemands: DeckCardDemand[]
): CardDemandAllocation {
  const safeOwned = Math.max(0, ownedTotal);
  const demands = [...rawDemands].sort(compareDecksBySectionAndPriority);

  let remaining = safeOwned;
  const competitiveAllocations: DeckAllocationResult[] = [];
  let competitiveHardShortage = 0;
  let competitiveReserved = 0;

  const competitiveDecks = demands.filter((d) => d.section === "competitive");
  const fourFunDecks = demands.filter((d) => d.section !== "competitive");

  // 1. Walk Competitive Decks top-down (exclusive pre-emption)
  for (const cDeck of competitiveDecks) {
    const allocated = Math.min(cDeck.demand, remaining);
    const hardMissing = Math.max(0, cDeck.demand - allocated);
    remaining = Math.max(0, remaining - allocated);
    competitiveHardShortage += hardMissing;
    competitiveReserved += cDeck.demand;

    competitiveAllocations.push({
      deckId: cDeck.deckId,
      section: "competitive",
      priority: cDeck.priority,
      demand: cDeck.demand,
      allocated,
      hardMissing,
      sharedMissing: 0,
    });
  }

  // 2. 4Fun Decks (Shared Floating Pool from remaining leftovers)
  const leftover4Fun = remaining;
  const fourFunAllocations: DeckAllocationResult[] = [];

  const peakDemand4Fun = fourFunDecks.reduce((max, d) => Math.max(max, d.demand), 0);
  const totalDemand4Fun = fourFunDecks.reduce((sum, d) => sum + d.demand, 0);

  let unassigned4FunHard = Math.max(0, peakDemand4Fun - leftover4Fun);
  let unassigned4FunShared = Math.max(0, totalDemand4Fun - leftover4Fun - unassigned4FunHard);

  // Attribution Step A: Hard shortage attributed to topmost deck(s) with highest demand
  for (const fDeck of fourFunDecks) {
    let deckHard = 0;
    if (unassigned4FunHard > 0 && fDeck.demand === peakDemand4Fun) {
      const deficit = Math.max(0, fDeck.demand - leftover4Fun);
      deckHard = Math.min(unassigned4FunHard, deficit);
      unassigned4FunHard -= deckHard;
    }

    fourFunAllocations.push({
      deckId: fDeck.deckId,
      section: "4fun",
      priority: fDeck.priority,
      demand: fDeck.demand,
      allocated: Math.min(fDeck.demand, leftover4Fun),
      hardMissing: deckHard,
      sharedMissing: 0,
    });
  }

  // Fallback for any residual unassigned hard shortage
  if (unassigned4FunHard > 0) {
    for (const alloc of fourFunAllocations) {
      if (unassigned4FunHard <= 0) break;
      const room = Math.max(0, alloc.demand - leftover4Fun - alloc.hardMissing);
      const add = Math.min(unassigned4FunHard, room);
      alloc.hardMissing += add;
      unassigned4FunHard -= add;
    }
  }

  // Attribution Step B: Shared shortage attributed to decks that cannot be sleeved concurrently
  let concurrentPool = leftover4Fun;
  for (const alloc of fourFunAllocations) {
    const needFromPool = Math.max(0, alloc.demand - alloc.hardMissing);
    const takenFromPool = Math.min(needFromPool, concurrentPool);
    concurrentPool = Math.max(0, concurrentPool - takenFromPool);
    alloc.sharedMissing = needFromPool - takenFromPool;
  }

  const allAllocations = [...competitiveAllocations, ...fourFunAllocations];
  const fourFunHardTotal = fourFunAllocations.reduce((sum, d) => sum + d.hardMissing, 0);

  const totalDemand = demands.reduce((sum, d) => sum + d.demand, 0);
  const peakDemandAll = demands.reduce((max, d) => Math.max(max, d.demand), 0);

  const peakMissing = competitiveDecks.length > 0
    ? competitiveHardShortage + fourFunHardTotal
    : Math.max(0, peakDemandAll - safeOwned);

  const concurrentMissing = Math.max(0, totalDemand - safeOwned);

  return {
    ownedTotal: safeOwned,
    competitiveReserved,
    leftover4Fun,
    peakMissing,
    concurrentMissing,
    deckAllocations: allAllocations,
  };
}
