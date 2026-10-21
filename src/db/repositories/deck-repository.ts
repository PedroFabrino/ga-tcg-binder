import { db } from "../index";
import { decks, deckCards, cards, cardEditions } from "../schema";
import { eq, inArray, sql } from "drizzle-orm";

export type DeckDatabase = typeof db;
export type DeckRow = typeof decks.$inferSelect;
export type DeckInsert = typeof decks.$inferInsert;
export type DeckCardRow = typeof deckCards.$inferSelect;
export type DeckCardInsert = typeof deckCards.$inferInsert;

export async function getUserDecks(
  userId: string,
  database = db
): Promise<DeckRow[]> {
  return database
    .select()
    .from(decks)
    .where(eq(decks.userId, userId));
}

export async function getDeckCardsCounts(
  deckId: string,
  database = db
): Promise<{ zone: string; quantity: number }[]> {
  return database
    .select({
      zone: deckCards.zone,
      quantity: deckCards.quantity,
    })
    .from(deckCards)
    .where(eq(deckCards.deckId, deckId));
}

export async function getDeckById(
  deckId: string,
  database = db
): Promise<DeckRow | undefined> {
  const [deck] = await database
    .select()
    .from(decks)
    .where(eq(decks.id, deckId))
    .limit(1);
  return deck;
}

export async function createDeck(
  values: DeckInsert,
  database = db
): Promise<void> {
  await database.insert(decks).values(values);
}

export async function createDeckWithCards(
  values: DeckInsert,
  cardsToInsert: DeckCardInsert[],
  database: DeckDatabase = db
): Promise<void> {
  const statements: [
    Parameters<DeckDatabase["batch"]>[0][number],
    ...Array<Parameters<DeckDatabase["batch"]>[0][number]>,
  ] = [database.insert(decks).values(values)];

  if (cardsToInsert.length > 0) {
    statements.push(database.insert(deckCards).values(cardsToInsert));
  }

  await database.batch(statements);
}

export async function updateDeck(
  deckId: string,
  values: Partial<DeckInsert>,
  database = db
): Promise<void> {
  await database
    .update(decks)
    .set({
      ...values,
      updatedAt: new Date(),
    })
    .where(eq(decks.id, deckId));
}

export async function deleteDeck(
  deckId: string,
  database = db
): Promise<void> {
  await database.delete(deckCards).where(eq(deckCards.deckId, deckId));
  await database.delete(decks).where(eq(decks.id, deckId));
}

export async function insertDeckCards(
  cardsToInsert: DeckCardInsert[],
  database = db
): Promise<void> {
  if (cardsToInsert.length === 0) return;
  await database.insert(deckCards).values(cardsToInsert);
}

export async function deleteDeckCard(
  deckCardId: string,
  database = db
): Promise<void> {
  await database.delete(deckCards).where(eq(deckCards.id, deckCardId));
}

export async function updateDeckCard(
  deckCardId: string,
  values: Partial<Pick<DeckCardInsert, "quantity" | "assignedEditionId">>,
  database = db
): Promise<void> {
  await database
    .update(deckCards)
    .set(values)
    .where(eq(deckCards.id, deckCardId));
}

export async function getDeckCardsWithDetails(
  deckId: string,
  database = db
) {
  return database
    .select({
      id: deckCards.id,
      cardSlug: deckCards.cardSlug,
      zone: deckCards.zone,
      quantity: deckCards.quantity,
      assignedEditionId: deckCards.assignedEditionId,
      cardName: cards.name,
      element: cards.element,
      class: cards.class,
      type: cards.type,
      costReserve: cards.costReserve,
      costMemory: cards.costMemory,
    })
    .from(deckCards)
    .leftJoin(cards, eq(deckCards.cardSlug, cards.slug))
    .where(eq(deckCards.deckId, deckId));
}

export async function getEditionsForCardSlugs(
  slugs: string[],
  database = db
) {
  if (slugs.length === 0) return [];
  return database
    .select({
      id: cardEditions.id,
      cardSlug: cardEditions.cardSlug,
      imageUrl: cardEditions.imageUrl,
    })
    .from(cardEditions)
    .where(inArray(cardEditions.cardSlug, slugs));
}
