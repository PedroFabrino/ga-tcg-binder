import {
  loadDeckShortageData,
  loadAggregatedShortageData,
} from "@/db/repositories/shortage-repository";
import { DEFAULT_USER_ID } from "./seed";
import {
  computeCombinedQuota,
  getEffectiveQuotaPolicy,
  summarizeWatchlistRows,
  type WatchlistQuotaPolicy,
} from "./watchlist-policy";
import {
  resolveMarketAvailability,
  type MarketShortageAvailability,
} from "./shortage-market";
import type { WatchlistStatus } from "../db/schema";
import { allocateCardDemand, type DeckCardDemand } from "./deck-allocation";
import type { DeckSection } from "@ga/contracts";

export type { MarketShortageAvailability };

export {
  calculateDeckShortage,
  type FriendIdleCard,
  type CardShortageDetail,
  type DeckShortageReport,
} from "./deck-shortage";

export interface DeckRequirement {
  deckId: string;
  deckName: string;
  quantity: number;
  zone: string;
  section?: DeckSection;
  priority?: number;
  hardMissing?: number;
  sharedMissing?: number;
}

export interface CardEditionSummary {
  id: string;
  setPrefix: string;
  setName: string;
  collectorNumber: string;
  rarity: number;
  imageUrl: string;
}

export interface WatchlistSummaryItem {
  id: string;
  editionSlug: string;
  collectorNumber: string;
  status: WatchlistStatus;
  targetQuantity: number;
  targetPriceBrl: number;
  mypProductUrl?: string | null;
}

export interface AggregatedShortageCard extends MarketShortageAvailability {
  cardSlug: string;
  cardName: string;
  element: string;
  class: string;
  type: string;
  rarity: number;
  imageUrl: string | null;
  editions: CardEditionSummary[];
  deckRequirements: DeckRequirement[];
  totalDemand: number;
  peakDemand: number;
  totalOwned: number;
  dedicatedOwned: number;
  sharedOwned: number;
  peakMissing: number;
  concurrentMissing: number;
  quota: number;
  missing: number;
  watchlistItems: WatchlistSummaryItem[];
}

export interface AggregatedShortageReport {
  summary: {
    totalShortageCopies: number;
    totalPeakShortageCopies: number;
    uniqueShortageCards: number;
    deckCount: number;
    activePolicy: WatchlistQuotaPolicy;
    pendingAdds: number;
    pendingUpdates: number;
    pendingRemoves: number;
    watchingCount: number;
    ignoredCount: number;
    hasSavedMypCredentials: boolean;
    mypUsername: string | null;
    watchlistSyncToken?: string | null;
  };
  cards: AggregatedShortageCard[];
}

export async function calculateAggregatedShortages(
  userId?: string,
  database?: unknown
): Promise<AggregatedShortageReport> {
  const effectiveUserId = userId || DEFAULT_USER_ID;

  const {
    user,
    userDecks,
    allDeckCards,
    userInventory,
    userMypListings,
    marketListings,
    allEditions,
    uniqueSlugs,
    userWatchlistRows,
    stapleMap,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- repositories accept in-memory test database or singleton db
  } = await loadAggregatedShortageData(effectiveUserId, database as any);

  const activePolicy: WatchlistQuotaPolicy = getEffectiveQuotaPolicy(user);

  if (!userDecks || userDecks.length === 0) {
    const counts = summarizeWatchlistRows(userWatchlistRows);
    return {
      summary: {
        totalShortageCopies: 0,
        totalPeakShortageCopies: 0,
        uniqueShortageCards: 0,
        deckCount: 0,
        activePolicy,
        ...counts,
        hasSavedMypCredentials: Boolean(user?.mypPasswordEncrypted),
        mypUsername: user?.mypUsername || null,
        watchlistSyncToken: user?.watchlistSyncToken || null,
      },
      cards: [],
    };
  }

  const shortageCards: AggregatedShortageCard[] = [];

  for (const slug of uniqueSlugs) {
    const matchingDeckCards = allDeckCards.filter((c) => c.cardSlug === slug);
    const firstMatch = matchingDeckCards[0];
    const cardName = firstMatch?.cardName || slug;
    const element = firstMatch?.element || "NORM";
    const cardClass = firstMatch?.class || "WARRIOR";
    const cardType = firstMatch?.type || "ACTION";

    const editionsForSlug = allEditions
      .filter((e) => e.cardSlug === slug)
      .map((e) => ({
        id: e.id,
        setPrefix: e.setPrefix,
        setName: e.setName,
        collectorNumber: e.collectorNumber,
        rarity: e.rarity,
        imageUrl: e.imageUrl,
      }));

    const rarity = editionsForSlug.length > 0 ? Math.max(...editionsForSlug.map((e) => e.rarity)) : 1;
    const imageUrl = editionsForSlug[0]?.imageUrl || null;

    const totalDemand = matchingDeckCards.reduce((sum, c) => sum + c.quantity, 0);

    const demandByDeck: Record<string, number> = {};
    for (const c of matchingDeckCards) {
      demandByDeck[c.deckId] = (demandByDeck[c.deckId] || 0) + c.quantity;
    }
    const peakDemand = Object.values(demandByDeck).reduce((max, q) => Math.max(max, q), 0);

    const ownedForCard = userInventory.filter((inv) => inv.cardSlug === slug);
    const dedicatedOwned = ownedForCard
      .filter((inv) => inv.isDedicated)
      .reduce((sum, inv) => sum + inv.quantity, 0);
    const sharedOwned = ownedForCard
      .filter((inv) => !inv.isDedicated)
      .reduce((sum, inv) => sum + inv.quantity, 0);
    const totalOwned = dedicatedOwned + sharedOwned;

    // Use shared allocation engine for two-section priority allocation
    const deckMap = new Map(userDecks.map((d) => [d.id, d]));
    const deckDemands: DeckCardDemand[] = [];
    for (const [deckId, demand] of Object.entries(demandByDeck)) {
      const d = deckMap.get(deckId);
      deckDemands.push({
        deckId,
        deckName: d?.name,
        section: (d?.section as DeckSection) || "4fun",
        priority: d?.priority ?? 0,
        demand,
      });
    }

    const allocation = allocateCardDemand(totalOwned, deckDemands);
    const allocMap = new Map(allocation.deckAllocations.map((a) => [a.deckId, a]));

    const deckRequirements: DeckRequirement[] = matchingDeckCards.map((c) => {
      const alloc = allocMap.get(c.deckId);
      const deckInfo = deckMap.get(c.deckId);
      return {
        deckId: c.deckId,
        deckName: c.deckName,
        quantity: c.quantity,
        zone: c.zone,
        section: (deckInfo?.section as DeckSection) || "4fun",
        priority: deckInfo?.priority ?? 0,
        hardMissing: alloc?.hardMissing ?? 0,
        sharedMissing: alloc?.sharedMissing ?? 0,
      };
    });

    const peakMissing = allocation.peakMissing;
    const concurrentMissing = allocation.concurrentMissing;

    const stapleCopies = stapleMap.get(slug) || 0;
    const policyQuota = computeCombinedQuota({
      totalDemand,
      peakDemand,
      policyHard: Boolean(user?.watchlistPolicyHard ?? true),
      policyShared: Boolean(user?.watchlistPolicyShared ?? false),
      policyStaples: Boolean(user?.watchlistPolicyStaples ?? false),
      stapleCopies,
    });
    const policyMissing = Math.max(0, policyQuota - totalOwned);

    const cardWatchlistItems: WatchlistSummaryItem[] = userWatchlistRows
      .filter((w) => w.cardSlug === slug)
      .map((w) => ({
        id: w.id,
        editionSlug: w.editionSlug,
        collectorNumber: w.collectorNumber,
        status: w.status as WatchlistStatus,
        targetQuantity: w.targetQuantity,
        targetPriceBrl: w.targetPriceBrl,
        mypProductUrl: w.mypProductUrl,
      }));

    const marketInfo = resolveMarketAvailability(slug, marketListings, userMypListings);

    // Only include cards with a shortage under any policy or active watchlist
    if (concurrentMissing > 0 || peakMissing > 0 || policyMissing > 0 || cardWatchlistItems.length > 0) {
      shortageCards.push({
        cardSlug: slug,
        cardName,
        element,
        class: cardClass,
        type: cardType,
        rarity,
        imageUrl,
        editions: editionsForSlug,
        deckRequirements,
        totalDemand,
        peakDemand,
        totalOwned,
        dedicatedOwned,
        sharedOwned,
        peakMissing,
        concurrentMissing,
        quota: policyQuota,
        missing: policyMissing,
        watchlistItems: cardWatchlistItems,
        ...marketInfo,
      });
    }
  }

  shortageCards.sort((a, b) =>
    b.concurrentMissing !== a.concurrentMissing ? b.concurrentMissing - a.concurrentMissing : b.peakMissing - a.peakMissing
  );

  const totalShortageCopies = shortageCards.reduce((sum, c) => sum + c.concurrentMissing, 0);
  const totalPeakShortageCopies = shortageCards.reduce((sum, c) => sum + c.peakMissing, 0);
  const counts = summarizeWatchlistRows(userWatchlistRows);

  return {
    summary: {
      totalShortageCopies,
      totalPeakShortageCopies,
      uniqueShortageCards: shortageCards.length,
      deckCount: userDecks.length,
      activePolicy,
      ...counts,
      hasSavedMypCredentials: Boolean(user?.mypPasswordEncrypted),
      mypUsername: user?.mypUsername || null,
      watchlistSyncToken: user?.watchlistSyncToken || null,
    },
    cards: shortageCards,
  };
}
