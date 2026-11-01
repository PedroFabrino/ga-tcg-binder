import { db } from "../index";
import { decks, deckCards, cards, cardEditions } from "../schema";
import { eq, inArray, sql, asc, and } from "drizzle-orm";

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
    .where(eq(decks.userId, userId))
    .orderBy(
      // 'competitive' comes before '4fun'
      sql`CASE WHEN ${decks.section} = 'competitive' THEN 0 ELSE 1 END`,
      asc(decks.priority),
      asc(decks.createdAt)
    );
}

export type PublicDeckRow = Omit<DeckRow, "section">;

export async function getPublicDecksByUserId(
  userId: string,
  database = db
): Promise<PublicDeckRow[]> {
  return database
    .select({
      id: decks.id,
      userId: decks.userId,
      name: decks.name,
      champion: decks.champion,
      format: decks.format,
      priority: decks.priority,
      isPublic: decks.isPublic,
      createdAt: decks.createdAt,
      updatedAt: decks.updatedAt,
    })
    .from(decks)
    .where(and(eq(decks.userId, userId), eq(decks.isPublic, true)))
    .orderBy(
      sql`CASE WHEN ${decks.section} = 'competitive' THEN 0 ELSE 1 END`,
      asc(decks.priority),
      asc(decks.createdAt)
    );
}

export async function getNextDeckPriority(
  userId: string,
  section: string = "4fun",
  database = db
): Promise<number> {
  const result = await database
    .select({ maxPriority: sql<number>`COALESCE(MAX(${decks.priority}), -1)` })
    .from(decks)
    .where(and(eq(decks.userId, userId), eq(decks.section, section)));
  const max = result[0]?.maxPriority ?? -1;
  return max + 1;
}

export async function updateDeckSectionAndPriorities(
  userId: string,
  updates: { id: string; section: string; priority: number }[],
  database = db
): Promise<void> {
  if (updates.length === 0) return;

  // 1. Verify all deck IDs belong to the user
  const ids = updates.map((u) => u.id);
  const existing = await database
    .select({ id: decks.id })
    .from(decks)
    .where(and(eq(decks.userId, userId), inArray(decks.id, ids)));

  if (existing.length !== ids.length) {
    const foundIds = new Set(existing.map((e) => e.id));
    const missingIds = ids.filter((id) => !foundIds.has(id));
    throw new Error(`Deck(s) not found for user: ${missingIds.join(", ")}`);
  }

  // 2. Perform updates atomically via batch where available
  const updateStatements = updates.map((item) =>
    database
      .update(decks)
      .set({
        section: item.section,
        priority: item.priority,
        updatedAt: new Date(),
      })
      .where(and(eq(decks.id, item.id), eq(decks.userId, userId)))
  );

  // LibSQL drizzle client provides atomic batch updates; fallback sequentially for in-memory mocks
  const batchClient = database as unknown as { batch?: (stmts: unknown[]) => Promise<unknown> };
  if (typeof batchClient.batch === "function" && updateStatements.length > 0) {
    await batchClient.batch(updateStatements);
  } else {
    for (const stmt of updateStatements) {
      await stmt;
    }
  }
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

export async function replaceDeckCards(
  deckId: string,
  cardsToInsert: DeckCardInsert[],
  database: DeckDatabase = db
): Promise<void> {
  const statements: [
    Parameters<DeckDatabase["batch"]>[0][number],
    ...Array<Parameters<DeckDatabase["batch"]>[0][number]>,
  ] = [database.delete(deckCards).where(eq(deckCards.deckId, deckId))];

  if (cardsToInsert.length > 0) {
    statements.push(database.insert(deckCards).values(cardsToInsert));
  }

  await database.batch(statements);
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
