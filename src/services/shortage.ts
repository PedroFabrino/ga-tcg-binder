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

export type { MarketShortageAvailability };

export interface FriendIdleCard {
  friendId: string;
  friendName: string;
  friendCode: string;
  idleQuantity: number;
}

export interface CardShortageDetail extends MarketShortageAvailability {
  cardSlug: string;
  cardName: string;
  zone: string;
  imageUrl?: string | null;
  requiredQuantity: number;
  availableQuantity: number;
  missingQuantity: number;
  isContended: boolean;
  contendingDeckNames: string[];
  dedicatedCopiesOwned: number;
  sharedCopiesOwned: number;
  friendsWithIdle: FriendIdleCard[];
}

export interface DeckShortageReport {
  deckId: string;
  deckName: string;
  totalCardsRequired: number;
  totalCardsMissing: number;
  items: CardShortageDetail[];
}

export async function calculateDeckShortage(
  deckId: string,
  userId?: string,
  database?: unknown
): Promise<DeckShortageReport> {
  const effectiveUserId = !userId || userId === DEFAULT_USER_ID ? DEFAULT_USER_ID : userId;

  const {
    deck,
    targetDeckCards,
    otherDeckCards,
    userInventory,
    friends,
    friendsInventory,
    friendDecks,
    userMypListings,
    marketListings,
    editionsInDeck,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- repositories accept in-memory test database or singleton db
  } = await loadDeckShortageData(deckId, effectiveUserId, database as any);

  let totalCardsRequired = 0;
  let totalCardsMissing = 0;
  const items: CardShortageDetail[] = [];

  for (const dc of targetDeckCards) {
    const slug = dc.cardSlug;
    const cardName = dc.cardName || slug;
    const required = dc.quantity;
    totalCardsRequired += required;

    const assignedEdition = editionsInDeck.find((e) => e.cardSlug === slug);
    const imageUrl = assignedEdition?.imageUrl || null;

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
    totalCardsMissing += missing;

    const otherDemandForSlug = otherDeckCards
      .filter((od) => od.cardSlug === slug)
      .reduce((sum, od) => sum + od.quantity, 0);
    const totalSystemDemand = required + otherDemandForSlug;
    const isContended = totalSystemDemand > totalOwned && otherDemandForSlug > 0;

    const contendingDeckNames = otherDeckCards
      .filter((od) => od.cardSlug === slug && od.deckName)
      .map((od) => od.deckName)
      .filter((name, idx, arr) => arr.indexOf(name) === idx);

    const friendsWithIdle: FriendIdleCard[] = [];
    if (missing > 0 && friends.length > 0) {
      for (const friend of friends) {
        const friendOwned = friendsInventory
          .filter((fi) => fi.userId === friend.id && fi.cardSlug === slug && !fi.isDedicated)
          .reduce((sum, fi) => sum + fi.quantity, 0);

        const friendUsedInDecks = friendDecks
          .filter((fd) => fd.userId === friend.id && fd.cardSlug === slug)
          .reduce((sum, fd) => Math.max(sum, fd.quantity), 0);

        const friendIdle = Math.max(0, friendOwned - friendUsedInDecks);
        if (friendIdle > 0) {
          friendsWithIdle.push({
            friendId: friend.id,
            friendName: friend.name || "Friend",
            friendCode: friend.friendCode,
            idleQuantity: friendIdle,
          });
        }
      }
    }

    const marketInfo = resolveMarketAvailability(slug, marketListings, userMypListings);

    items.push({
      cardSlug: slug,
      cardName,
      zone: dc.zone,
      imageUrl,
      requiredQuantity: required,
      availableQuantity: available,
      missingQuantity: missing,
      isContended,
      contendingDeckNames,
      dedicatedCopiesOwned: dedicatedOwned,
      sharedCopiesOwned: sharedOwned,
      friendsWithIdle,
      ...marketInfo,
    });
  }

  return {
    deckId,
    deckName: deck.name,
    totalCardsRequired,
    totalCardsMissing,
    items,
  };
}

export interface DeckRequirement {
  deckId: string;
  deckName: string;
  quantity: number;
  zone: string;
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

    const deckRequirements: DeckRequirement[] = matchingDeckCards.map((c) => ({
      deckId: c.deckId,
      deckName: c.deckName,
      quantity: c.quantity,
      zone: c.zone,
    }));

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

    const peakMissing = Math.max(0, peakDemand - totalOwned);
    const concurrentMissing = Math.max(0, totalDemand - totalOwned);

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
