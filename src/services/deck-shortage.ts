import { loadDeckShortageData } from "@/db/repositories/shortage-repository";
import { DEFAULT_USER_ID } from "./seed";
import {
  resolveMarketAvailability,
  type MarketShortageAvailability,
} from "./shortage-market";
import { allocateCardDemand, type DeckCardDemand } from "./deck-allocation";
import { type DeckSection } from "@ga/contracts";

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

    // Build demands for target deck and other decks to run shared allocation engine
    const demands: DeckCardDemand[] = [
      {
        deckId: deck.id,
        deckName: deck.name,
        section: (deck.section as DeckSection) || "4fun",
        priority: deck.priority ?? 0,
        createdAt: deck.createdAt,
        demand: required,
      },
    ];

    const otherByDeck = new Map<string, DeckCardDemand>();
    for (const od of otherDeckCards) {
      if (od.cardSlug === slug) {
        const existing = otherByDeck.get(od.deckId);
        if (existing) {
          existing.demand += od.quantity;
        } else {
          otherByDeck.set(od.deckId, {
            deckId: od.deckId,
            deckName: od.deckName,
            section: (od.section as DeckSection) || "4fun",
            priority: od.priority ?? 0,
            demand: od.quantity,
          });
        }
      }
    }
    for (const od of otherByDeck.values()) {
      demands.push(od);
    }

    const availableOwned = Math.max(0, totalOwned - dedicatedToOtherDecks);
    const allocation = allocateCardDemand(availableOwned, demands);
    const targetAlloc = allocation.deckAllocations.find((d) => d.deckId === deck.id);

    const available = targetAlloc ? targetAlloc.allocated : 0;
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
