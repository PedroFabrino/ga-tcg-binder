import { db } from "../index";
import {
  collectionItems,
  cardEditions,
  cardCirculations,
  cards,
  deckCards,
  decks,
  users,
  metaStaples,
} from "../schema";
import { eq, and, inArray, sql } from "drizzle-orm";

export type CollectionItemRow = typeof collectionItems.$inferSelect;
export type CollectionItemInsert = typeof collectionItems.$inferInsert;

export async function findCollectionItem(
  userId: string,
  editionId: string,
  foil: boolean,
  database = db
): Promise<CollectionItemRow | undefined> {
  const [item] = await database
    .select()
    .from(collectionItems)
    .where(
      and(
        eq(collectionItems.userId, userId),
        eq(collectionItems.editionId, editionId),
        eq(collectionItems.foil, foil)
      )
    )
    .limit(1);
  return item;
}

export async function deleteCollectionItem(
  id: string,
  database = db
): Promise<void> {
  await database
    .delete(collectionItems)
    .where(eq(collectionItems.id, id));
}

export async function updateCollectionItemQuantity(
  id: string,
  quantity: number,
  isDedicated?: boolean,
  database = db
): Promise<void> {
  const updateValues: any = {
    quantity,
    updatedAt: new Date(),
  };
  if (isDedicated !== undefined) {
    updateValues.isDedicated = isDedicated;
  }

  await database
    .update(collectionItems)
    .set(updateValues)
    .where(eq(collectionItems.id, id));
}

export async function insertCollectionItem(
  values: CollectionItemInsert,
  database = db
): Promise<void> {
  await database.insert(collectionItems).values(values);
}

export async function findCardByNameCaseInsensitive(
  cardName: string,
  database = db
) {
  const [card] = await database
    .select()
    .from(cards)
    .where(sql`lower(${cards.name}) = lower(${cardName})`)
    .limit(1);
  return card;
}

export async function findCardsByNamesCaseInsensitive(
  cardNames: string[],
  database = db
) {
  if (cardNames.length === 0) return [];
  const lowerNames = Array.from(
    new Set(cardNames.map((n) => n.toLowerCase().trim()))
  ).filter(Boolean);
  if (lowerNames.length === 0) return [];

  return database
    .select()
    .from(cards)
    .where(inArray(sql`lower(${cards.name})`, lowerNames));
}

export async function findEditionsByCardSlug(
  cardSlug: string,
  database = db
) {
  return database
    .select()
    .from(cardEditions)
    .where(eq(cardEditions.cardSlug, cardSlug));
}

export async function getUserLowPopThreshold(
  userId: string,
  database = db
): Promise<number> {
  const [user] = await database
    .select({ threshold: users.lowPopThreshold })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return user?.threshold ?? 1000;
}

export interface CollectionItemWithDetails {
  id: string;
  editionId: string;
  foil: boolean;
  quantity: number;
  isDedicated: boolean;
  cardSlug: string;
  setPrefix: string;
  setName: string;
  collectorNumber: string;
  rarity: number;
  imageUrl: string;
  cardName: string;
  element: string;
  class: string;
  type: string;
}

export async function getUserCollectionItems(
  userId: string,
  database = db
): Promise<CollectionItemWithDetails[]> {
  return database
    .select({
      id: collectionItems.id,
      editionId: collectionItems.editionId,
      foil: collectionItems.foil,
      quantity: collectionItems.quantity,
      isDedicated: collectionItems.isDedicated,
      cardSlug: cardEditions.cardSlug,
      setPrefix: cardEditions.setPrefix,
      setName: cardEditions.setName,
      collectorNumber: cardEditions.collectorNumber,
      rarity: cardEditions.rarity,
      imageUrl: cardEditions.imageUrl,
      cardName: cards.name,
      element: cards.element,
      class: cards.class,
      type: cards.type,
    })
    .from(collectionItems)
    .innerJoin(cardEditions, eq(collectionItems.editionId, cardEditions.id))
    .innerJoin(cards, eq(cardEditions.cardSlug, cards.slug))
    .where(eq(collectionItems.userId, userId));
}

export async function getCirculationsForEditions(
  editionIds: string[],
  database = db
) {
  if (editionIds.length === 0) return [];
  return database
    .select()
    .from(cardCirculations)
    .where(inArray(cardCirculations.editionId, editionIds));
}

export async function getUserDeckCardUsages(
  userId: string,
  database = db
) {
  return database
    .select({
      deckId: decks.id,
      cardSlug: deckCards.cardSlug,
      quantity: deckCards.quantity,
    })
    .from(deckCards)
    .innerJoin(decks, eq(deckCards.deckId, decks.id))
    .where(eq(decks.userId, userId));
}

export async function getAllMetaStaples(database = db) {
  return database.select().from(metaStaples);
}
