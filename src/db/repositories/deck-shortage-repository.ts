import { db } from "../index";
import {
  cards,
  cardEditions,
  collectionItems,
  decks,
  deckCards,
  friendLinks,
  users,
  mypCards,
  marketCards,
} from "../schema";
import { eq, inArray, and, gt } from "drizzle-orm";

export async function loadDeckShortageData(
  deckId: string,
  effectiveUserId: string,
  database = db
) {
  const [deck] = await database
    .select()
    .from(decks)
    .where(eq(decks.id, deckId))
    .limit(1);

  if (!deck) {
    throw new Error(`Deck not found with id ${deckId}`);
  }

  const targetDeckCards = await database
    .select({
      id: deckCards.id,
      deckId: deckCards.deckId,
      cardSlug: deckCards.cardSlug,
      zone: deckCards.zone,
      quantity: deckCards.quantity,
      assignedEditionId: deckCards.assignedEditionId,
      cardName: cards.name,
    })
    .from(deckCards)
    .leftJoin(cards, eq(deckCards.cardSlug, cards.slug))
    .where(eq(deckCards.deckId, deckId));

  const otherUserDecks = await database
    .select({ id: decks.id, name: decks.name })
    .from(decks)
    .where(eq(decks.userId, effectiveUserId));

  const otherDeckIds = otherUserDecks
    .filter((d) => d.id !== deckId)
    .map((d) => d.id);

  let otherDeckCards: Array<{
    cardSlug: string;
    deckName: string;
    quantity: number;
    assignedEditionId: string | null;
  }> = [];

  if (otherDeckIds.length > 0) {
    otherDeckCards = await database
      .select({
        cardSlug: deckCards.cardSlug,
        deckName: decks.name,
        quantity: deckCards.quantity,
        assignedEditionId: deckCards.assignedEditionId,
      })
      .from(deckCards)
      .innerJoin(decks, eq(deckCards.deckId, decks.id))
      .where(inArray(deckCards.deckId, otherDeckIds));
  }

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

  const friendLinks1 = await database
    .select({ friendId: friendLinks.userId2 })
    .from(friendLinks)
    .where(and(eq(friendLinks.userId1, effectiveUserId), eq(friendLinks.status, "accepted")));

  const friendLinks2 = await database
    .select({ friendId: friendLinks.userId1 })
    .from(friendLinks)
    .where(and(eq(friendLinks.userId2, effectiveUserId), eq(friendLinks.status, "accepted")));

  const friendIds = Array.from(
    new Set([...friendLinks1.map((f) => f.friendId), ...friendLinks2.map((f) => f.friendId)])
  );

  let friends: Array<{ id: string; name: string | null; friendCode: string }> = [];
  let friendsInventory: Array<{
    userId: string;
    cardSlug: string;
    quantity: number;
    isDedicated: boolean;
  }> = [];
  let friendDecks: Array<{
    userId: string;
    cardSlug: string;
    quantity: number;
  }> = [];

  if (friendIds.length > 0) {
    friends = await database
      .select({ id: users.id, name: users.name, friendCode: users.friendCode })
      .from(users)
      .where(inArray(users.id, friendIds));

    friendsInventory = await database
      .select({
        userId: collectionItems.userId,
        cardSlug: cardEditions.cardSlug,
        quantity: collectionItems.quantity,
        isDedicated: collectionItems.isDedicated,
      })
      .from(collectionItems)
      .innerJoin(cardEditions, eq(collectionItems.editionId, cardEditions.id))
      .where(inArray(collectionItems.userId, friendIds));

    friendDecks = await database
      .select({
        userId: decks.userId,
        cardSlug: deckCards.cardSlug,
        quantity: deckCards.quantity,
      })
      .from(deckCards)
      .innerJoin(decks, eq(deckCards.deckId, decks.id))
      .where(inArray(decks.userId, friendIds));
  }

  let userMypListings: Array<{
    cardSlug: string | null;
    editionId: string | null;
    setPrefix: string | null;
    mypItemId: string | null;
    quantity: number;
  }> = [];
  try {
    userMypListings = await database
      .select({
        cardSlug: mypCards.cardSlug,
        editionId: mypCards.editionId,
        setPrefix: mypCards.setPrefix,
        mypItemId: mypCards.mypItemId,
        quantity: mypCards.quantity,
      })
      .from(mypCards)
      .where(eq(mypCards.userId, effectiveUserId));
  } catch {
    // fallback if table not migrated
  }

  const slugsInDeck = Array.from(new Set(targetDeckCards.map((c) => c.cardSlug)));

  let marketListings: Array<{
    cardSlug: string | null;
    editionId: string | null;
    setPrefix: string | null;
    mypItemId: string | null;
    quantity: number;
    price: string;
    priceNumeric: number | null;
    tcgPrice: string | null;
    tcgPriceNumeric: number | null;
    mypProductUrl: string | null;
    vendorName: string | null;
    vendorUrl: string | null;
  }> = [];

  if (slugsInDeck.length > 0) {
    try {
      const rawMarketCards = await database
        .select({
          cardSlug: marketCards.cardSlug,
          editionId: marketCards.editionId,
          setPrefix: marketCards.setPrefix,
          itemId: marketCards.itemId,
          quantity: marketCards.quantity,
          price: marketCards.price,
          priceNumeric: marketCards.priceNumeric,
          tcgPrice: marketCards.tcgPrice,
          tcgPriceNumeric: marketCards.tcgPriceNumeric,
          productUrl: marketCards.productUrl,
          vendorName: marketCards.vendorName,
          vendorUrl: marketCards.vendorUrl,
        })
        .from(marketCards)
        .where(
          and(
            eq(marketCards.storeId, "myp"),
            inArray(marketCards.cardSlug, slugsInDeck),
            gt(marketCards.quantity, 0)
          )
        );

      marketListings = rawMarketCards.map((r) => ({
        ...r,
        mypItemId: r.itemId,
        mypProductUrl: r.productUrl,
      }));
    } catch {
      // fallback
    }
  }

  let editionsInDeck: Array<{
    id: string;
    cardSlug: string;
    imageUrl: string;
  }> = [];
  if (slugsInDeck.length > 0) {
    editionsInDeck = await database
      .select({
        id: cardEditions.id,
        cardSlug: cardEditions.cardSlug,
        imageUrl: cardEditions.imageUrl,
      })
      .from(cardEditions)
      .where(inArray(cardEditions.cardSlug, slugsInDeck));
  }

  return {
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
  };
}
