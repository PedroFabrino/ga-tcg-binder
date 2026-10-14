import { eq, and, inArray, sql } from "drizzle-orm";
import {
  cards,
  cardEditions,
  collectionItems,
  decks,
  deckCards,
  friendLinks,
  users,
} from "../db/schema";
import { db } from "../db";
import { DEFAULT_USER_ID } from "./seed";

export interface FriendIdleCard {
  friendId: string;
  friendName: string;
  friendCode: string;
  idleQuantity: number;
}

export interface CardShortageDetail {
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
  database: any = db
): Promise<DeckShortageReport> {
  // 1. Fetch current deck
  const deck = await database
    .select()
    .from(decks)
    .where(eq(decks.id, deckId))
    .get();

  if (!deck) {
    throw new Error(`Deck not found with id ${deckId}`);
  }

  // If userId is unspecified or default, use the deck owner's ID
  const effectiveUserId = !userId || userId === DEFAULT_USER_ID ? deck.userId : userId;

  // 2. Fetch cards in this deck
  const targetDeckCards = await database
    .select({
      id: deckCards.id,
      deckId: deckCards.deckId,
      cardSlug: deckCards.cardSlug,
      zone: deckCards.zone,
      quantity: deckCards.quantity,
      assignedEditionId: deckCards.assignedEditionId,
      name: cards.name,
    })
    .from(deckCards)
    .leftJoin(cards, eq(deckCards.cardSlug, cards.slug))
    .where(eq(deckCards.deckId, deckId));

  // 3. Fetch all other decks owned by user (to check contention and dedicated allocations)
  const allUserDecks = await database
    .select()
    .from(decks)
    .where(eq(decks.userId, effectiveUserId));

  const otherDeckIds = allUserDecks
    .filter((d: any) => d.id !== deckId)
    .map((d: any) => d.id);

  let otherDeckCards: any[] = [];
  if (otherDeckIds.length > 0) {
    otherDeckCards = await database
      .select({
        deckId: deckCards.deckId,
        cardSlug: deckCards.cardSlug,
        quantity: deckCards.quantity,
        assignedEditionId: deckCards.assignedEditionId,
        deckName: decks.name,
      })
      .from(deckCards)
      .leftJoin(decks, eq(deckCards.deckId, decks.id))
      .where(inArray(deckCards.deckId, otherDeckIds));
  }

  // 4. Fetch user's collection items with edition info
  const userInventory = await database
    .select({
      id: collectionItems.id,
      editionId: collectionItems.editionId,
      cardSlug: cardEditions.cardSlug,
      foil: collectionItems.foil,
      quantity: collectionItems.quantity,
      isDedicated: collectionItems.isDedicated,
    })
    .from(collectionItems)
    .innerJoin(cardEditions, eq(collectionItems.editionId, cardEditions.id))
    .where(eq(collectionItems.userId, effectiveUserId));

  // 5. Fetch accepted friends
  const friendLinks1 = await database
    .select({
      friendId: friendLinks.userId2,
    })
    .from(friendLinks)
    .where(and(eq(friendLinks.userId1, effectiveUserId), eq(friendLinks.status, "accepted")));

  const friendLinks2 = await database
    .select({
      friendId: friendLinks.userId1,
    })
    .from(friendLinks)
    .where(and(eq(friendLinks.userId2, effectiveUserId), eq(friendLinks.status, "accepted")));

  const friendIds = Array.from(
    new Set([...friendLinks1.map((f: any) => f.friendId), ...friendLinks2.map((f: any) => f.friendId)])
  );

  let friendUsers: any[] = [];
  let friendCollection: any[] = [];
  let friendDecks: any[] = [];

  if (friendIds.length > 0) {
    friendUsers = await database
      .select()
      .from(users)
      .where(inArray(users.id, friendIds));

    friendCollection = await database
      .select({
        id: collectionItems.id,
        userId: collectionItems.userId,
        editionId: collectionItems.editionId,
        cardSlug: cardEditions.cardSlug,
        quantity: collectionItems.quantity,
        isDedicated: collectionItems.isDedicated,
      })
      .from(collectionItems)
      .innerJoin(cardEditions, eq(collectionItems.editionId, cardEditions.id))
      .where(inArray(collectionItems.userId, friendIds));

    // Friend decks and assignments to compute idle availability
    friendDecks = await database
      .select({
        deckId: deckCards.deckId,
        userId: decks.userId,
        cardSlug: deckCards.cardSlug,
        quantity: deckCards.quantity,
      })
      .from(deckCards)
      .innerJoin(decks, eq(deckCards.deckId, decks.id))
      .where(inArray(decks.userId, friendIds));
  }

  // 6. Aggregate shortage per card in target deck
  const items: CardShortageDetail[] = [];
  let totalCardsRequired = 0;
  let totalCardsMissing = 0;

  const targetSlugs = Array.from(new Set(targetDeckCards.map((c: any) => c.cardSlug)));
  let targetEditions: any[] = [];
  if (targetSlugs.length > 0) {
    targetEditions = await database
      .select({
        id: cardEditions.id,
        cardSlug: cardEditions.cardSlug,
        imageUrl: cardEditions.imageUrl,
      })
      .from(cardEditions)
      .where(inArray(cardEditions.cardSlug, targetSlugs));
  }

  for (const dc of targetDeckCards) {
    const slug = dc.cardSlug;
    const cardName = dc.name || slug;
    const required = dc.quantity;
    totalCardsRequired += required;

    const matchingEd = dc.assignedEditionId
      ? targetEditions.find((e: any) => e.id === dc.assignedEditionId)
      : targetEditions.find((e: any) => e.cardSlug === slug);
    const imageUrl = matchingEd?.imageUrl || null;

    // Copies owned by user for this card slug
    const ownedForSlug = userInventory.filter((inv: any) => inv.cardSlug === slug);
    const dedicatedOwned = ownedForSlug
      .filter((inv: any) => inv.isDedicated)
      .reduce((sum: number, inv: any) => sum + inv.quantity, 0);
    const sharedOwned = ownedForSlug
      .filter((inv: any) => !inv.isDedicated)
      .reduce((sum: number, inv: any) => sum + inv.quantity, 0);
    const totalOwned = dedicatedOwned + sharedOwned;

    // Check copies dedicated to OTHER decks
    // If a dedicated copy is assigned to another deck, it cannot be used by this deck
    const dedicatedToOtherDecks = otherDeckCards
      .filter((od: any) => od.cardSlug === slug && od.assignedEditionId)
      .reduce((sum: number, od: any) => sum + od.quantity, 0);

    // Available copies for this deck = totalOwned - dedicatedToOtherDecks
    const available = Math.max(0, totalOwned - dedicatedToOtherDecks);
    const missing = Math.max(0, required - available);
    totalCardsMissing += missing;

    // Check multi-deck contention
    // Contention occurs if total demand across ALL user decks exceeds total owned copies
    const otherDemandForSlug = otherDeckCards
      .filter((od: any) => od.cardSlug === slug)
      .reduce((sum: number, od: any) => sum + od.quantity, 0);
    const totalSystemDemand = required + otherDemandForSlug;
    const isContended = totalSystemDemand > totalOwned && otherDemandForSlug > 0;

    const contendingDeckNames = otherDeckCards
      .filter((od: any) => od.cardSlug === slug && od.deckName)
      .map((od: any) => od.deckName as string)
      .filter((name, idx, arr) => arr.indexOf(name) === idx);

    // Friend idle search if missing > 0
    const friendsWithIdle: FriendIdleCard[] = [];
    if (missing > 0 && friendIds.length > 0) {
      for (const friendId of friendIds) {
        const friend = friendUsers.find((u: any) => u.id === friendId);
        if (!friend) continue;

        // Friend owned non-dedicated copies of this slug
        const friendOwned = friendCollection
          .filter((fc: any) => fc.userId === friendId && fc.cardSlug === slug && !fc.isDedicated)
          .reduce((sum: number, fc: any) => sum + fc.quantity, 0);

        // Friend used copies in their active decks
        const friendUsedInDecks = friendDecks
          .filter((fd: any) => fd.userId === friendId && fd.cardSlug === slug)
          .reduce((sum: number, fd: any) => Math.max(sum, fd.quantity), 0); // Shared max across friend decks

        const friendIdle = Math.max(0, friendOwned - friendUsedInDecks);
        if (friendIdle > 0) {
          friendsWithIdle.push({
            friendId,
            friendName: friend.name || "Playgroup Friend",
            friendCode: friend.friendCode,
            idleQuantity: friendIdle,
          });
        }
      }
    }

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
