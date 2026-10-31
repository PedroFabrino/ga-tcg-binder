import { loadDeckShortageData } from "@/db/repositories/shortage-repository";
import { DEFAULT_USER_ID } from "./seed";
import {
  resolveMarketAvailability,
  type MarketShortageAvailability,
} from "./shortage-market";

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

    // If the target deck is competitive, higher-priority competitive decks reserve copies first.
    // If the target deck is 4fun, all competitive decks reserve copies first.
    let competitiveReservedCopies = 0;
    if (deck.section === "competitive") {
      competitiveReservedCopies = otherDeckCards
        .filter(
          (od) =>
            od.cardSlug === slug &&
            od.section === "competitive" &&
            (od.priority < deck.priority ||
              (od.priority === deck.priority && od.deckId < deck.id))
        )
        .reduce((sum, od) => sum + od.quantity, 0);
    } else {
      competitiveReservedCopies = otherDeckCards
        .filter((od) => od.cardSlug === slug && od.section === "competitive")
        .reduce((sum, od) => sum + od.quantity, 0);
    }

    const available = Math.max(0, totalOwned - dedicatedToOtherDecks - competitiveReservedCopies);
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
