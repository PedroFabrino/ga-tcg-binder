import { db } from "../index";
import {
  decks,
  deckCards,
  cards,
  cardEditions,
  collectionItems,
  mypCards,
  metaArchetypes,
  metaStaples,
} from "../schema";
import { eq, inArray } from "drizzle-orm";

export interface DeckAdvisorRawDeckData {
  deck: typeof decks.$inferSelect;
  deckCards: Array<{
    id: string;
    deckId: string;
    cardSlug: string;
    zone: string;
    quantity: number;
    assignedEditionId: string | null;
    name: string | null;
    element: string | null;
    class: string | null;
    type: string | null;
    subtypes: string | null;
    effect: string | null;
    costReserve: number | null;
    costMemory: number | null;
    speed: boolean | null;
  }>;
}

export interface DeckAdvisorRawUserData {
  inventory: Array<{
    id: string;
    cardSlug: string;
    editionId: string;
    foil: boolean;
    quantity: number;
    isDedicated: boolean;
    name: string;
    element: string;
    class: string;
    type: string;
    subtypes: string;
    effect: string | null;
    costReserve: number | null;
    costMemory: number | null;
    speed: boolean | null;
  }>;
  storeListings: Array<{
    id: string;
    cardSlug: string | null;
    cardName: string;
    quantity: number;
  }>;
  otherDeckCardUsages: Array<{
    deckId: string;
    cardSlug: string;
    quantity: number;
  }>;
}

/**
 * Loads a deck with its cards and full oracle card metadata.
 */
export async function getDeckAdvisorDeckData(
  deckId: string,
  database = db
): Promise<DeckAdvisorRawDeckData | null> {
  const [deck] = await database
    .select()
    .from(decks)
    .where(eq(decks.id, deckId))
    .limit(1);

  if (!deck) return null;

  const rawCards = await database
    .select({
      id: deckCards.id,
      deckId: deckCards.deckId,
      cardSlug: deckCards.cardSlug,
      zone: deckCards.zone,
      quantity: deckCards.quantity,
      assignedEditionId: deckCards.assignedEditionId,
      name: cards.name,
      element: cards.element,
      class: cards.class,
      type: cards.type,
      subtypes: cards.subtypes,
      effect: cards.effect,
      costReserve: cards.costReserve,
      costMemory: cards.costMemory,
      speed: cards.speed,
    })
    .from(deckCards)
    .leftJoin(cards, eq(deckCards.cardSlug, cards.slug))
    .where(eq(deckCards.deckId, deckId));

  return { deck, deckCards: rawCards };
}

/**
 * Loads user collection holdings, store listings, and card usages across other decks.
 */
export async function getDeckAdvisorUserData(
  userId: string,
  database = db
): Promise<DeckAdvisorRawUserData> {
  const [inventory, storeListings, otherDeckCardUsages] = await Promise.all([
    database
      .select({
        id: collectionItems.id,
        cardSlug: cardEditions.cardSlug,
        editionId: collectionItems.editionId,
        foil: collectionItems.foil,
        quantity: collectionItems.quantity,
        isDedicated: collectionItems.isDedicated,
        name: cards.name,
        element: cards.element,
        class: cards.class,
        type: cards.type,
        subtypes: cards.subtypes,
        effect: cards.effect,
        costReserve: cards.costReserve,
        costMemory: cards.costMemory,
        speed: cards.speed,
      })
      .from(collectionItems)
      .innerJoin(cardEditions, eq(collectionItems.editionId, cardEditions.id))
      .innerJoin(cards, eq(cardEditions.cardSlug, cards.slug))
      .where(eq(collectionItems.userId, userId)),
    database
      .select({
        id: mypCards.id,
        cardSlug: mypCards.cardSlug,
        cardName: mypCards.cardName,
        quantity: mypCards.quantity,
      })
      .from(mypCards)
      .where(eq(mypCards.userId, userId)),
    database
      .select({
        deckId: decks.id,
        cardSlug: deckCards.cardSlug,
        quantity: deckCards.quantity,
      })
      .from(deckCards)
      .innerJoin(decks, eq(deckCards.deckId, decks.id))
      .where(eq(decks.userId, userId)),
  ]);

  return { inventory, storeListings, otherDeckCardUsages };
}

/**
 * Loads all Meta Archetypes and Meta Staples for benchmarking.
 */
export async function getDeckAdvisorMetaBenchmarks(database = db) {
  const [archetypes, staples] = await Promise.all([
    database.select().from(metaArchetypes),
    database.select().from(metaStaples),
  ]);

  return { archetypes, staples };
}

/**
 * Queries cards in the catalog for candidate search tools.
 */
export async function searchCatalogCards(
  filters: {
    element?: string;
    cardClass?: string;
    cardType?: string;
    keyword?: string;
    limit?: number;
  },
  database = db
) {
  const rows = await database.select().from(cards);

  return rows.filter((c) => {
    if (filters.element && c.element.toLowerCase() !== filters.element.toLowerCase()) {
      return false;
    }
    if (filters.cardClass && c.class.toLowerCase() !== filters.cardClass.toLowerCase()) {
      return false;
    }
    if (filters.cardType && c.type.toLowerCase() !== filters.cardType.toLowerCase()) {
      return false;
    }
    if (filters.keyword) {
      const q = filters.keyword.toLowerCase();
      const inName = c.name.toLowerCase().includes(q);
      const inEffect = (c.effect || "").toLowerCase().includes(q);
      const inSubtypes = (c.subtypes || "").toLowerCase().includes(q);
      if (!inName && !inEffect && !inSubtypes) return false;
    }
    return true;
  }).slice(0, filters.limit || 20);
}
