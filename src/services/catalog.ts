import { and, eq, like, or, sql, inArray } from "drizzle-orm";
import { cards, cardEditions, cardCirculations, decks, deckCards } from "../db/schema";

export interface CatalogSearchFilters {
  query?: string;
  element?: string;
  class?: string;
  type?: string;
  setPrefix?: string;
  lowPopOnly?: boolean;
  lowPopThreshold?: number;
  userId?: string;
  limit?: number;
  offset?: number;
}

export interface DeckUsage {
  deckId: string;
  deckName: string;
  quantity: number;
  zone: string;
}

export interface EditionWithCirculations {
  id: string;
  cardSlug: string;
  setPrefix: string;
  setName: string;
  collectorNumber: string;
  rarity: number;
  imageUrl: string;
  lowestPopulation: number;
  isLowPop: boolean;
  circulations: {
    id: string;
    kind: string;
    population: number;
    foil: boolean;
    printing: boolean;
  }[];
}

export interface CatalogCardResult {
  slug: string;
  name: string;
  element: string;
  class: string;
  type: string;
  subtypes: string[];
  effect: string | null;
  costReserve: number | null;
  costMemory: number | null;
  level: number | null;
  speed: boolean | null;
  hasLowPopEdition: boolean;
  deckUsage: DeckUsage[];
  editions: EditionWithCirculations[];
}

export async function searchCatalog(
  filters: CatalogSearchFilters,
  database: any
): Promise<{ cards: CatalogCardResult[]; total: number }> {
  const threshold = filters.lowPopThreshold ?? 1000;
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;

  // Build conditions for cards
  const conditions = [];

  if (filters.query && filters.query.trim().length > 0) {
    const q = `%${filters.query.trim()}%`;
    conditions.push(or(like(cards.name, q), like(cards.slug, q)));
  }

  if (filters.element && filters.element !== "ALL") {
    conditions.push(eq(cards.element, filters.element));
  }

  if (filters.class && filters.class !== "ALL") {
    conditions.push(eq(cards.class, filters.class));
  }

  if (filters.type && filters.type !== "ALL") {
    conditions.push(eq(cards.type, filters.type));
  }

  // Base cards query
  let baseQuery = database.select().from(cards);
  if (conditions.length > 0) {
    baseQuery = baseQuery.where(and(...conditions));
  }

  const matchingCards = await baseQuery;

  if (matchingCards.length === 0) {
    return { cards: [], total: 0 };
  }

  const matchingSlugs = matchingCards.map((c: any) => c.slug);

  // Fetch editions for these cards
  let editionQuery = database
    .select()
    .from(cardEditions)
    .where(inArray(cardEditions.cardSlug, matchingSlugs));

  if (filters.setPrefix && filters.setPrefix !== "ALL") {
    editionQuery = database
      .select()
      .from(cardEditions)
      .where(
        and(
          inArray(cardEditions.cardSlug, matchingSlugs),
          eq(cardEditions.setPrefix, filters.setPrefix)
        )
      );
  }

  const editionsData = await editionQuery;
  const editionIds = editionsData.map((e: any) => e.id);

  let circulationsData: any[] = [];
  if (editionIds.length > 0) {
    circulationsData = await database
      .select()
      .from(cardCirculations)
      .where(inArray(cardCirculations.editionId, editionIds));
  }

  // Fetch deck usage if userId is provided
  let deckUsageData: any[] = [];
  if (filters.userId && matchingSlugs.length > 0) {
    deckUsageData = await database
      .select({
        cardSlug: deckCards.cardSlug,
        deckId: deckCards.deckId,
        deckName: decks.name,
        quantity: deckCards.quantity,
        zone: deckCards.zone,
      })
      .from(deckCards)
      .innerJoin(decks, eq(deckCards.deckId, decks.id))
      .where(
        and(
          eq(decks.userId, filters.userId),
          inArray(deckCards.cardSlug, matchingSlugs)
        )
      );
  }

  // Group editions and circulations by card slug
  const results: CatalogCardResult[] = [];

  for (const card of matchingCards) {
    const cardEds = editionsData.filter((e: any) => e.cardSlug === card.slug);
    if (filters.setPrefix && filters.setPrefix !== "ALL" && cardEds.length === 0) {
      continue; // Filtered out by set prefix
    }

    const populatedEditions: EditionWithCirculations[] = [];
    let cardHasLowPop = false;

    for (const ed of cardEds) {
      const circs = circulationsData.filter((c: any) => c.editionId === ed.id);
      const lowestPop =
        circs.length > 0
          ? Math.min(...circs.map((c: any) => c.population))
          : 999999;
      const isLowPop = lowestPop <= threshold;
      if (isLowPop) {
        cardHasLowPop = true;
      }

      populatedEditions.push({
        id: ed.id,
        cardSlug: ed.cardSlug,
        setPrefix: ed.setPrefix,
        setName: ed.setName,
        collectorNumber: ed.collectorNumber,
        rarity: ed.rarity,
        imageUrl: ed.imageUrl,
        lowestPopulation: lowestPop,
        isLowPop,
        circulations: circs.map((c: any) => ({
          id: c.id,
          kind: c.kind,
          population: c.population,
          foil: Boolean(c.foil),
          printing: Boolean(c.printing),
        })),
      });
    }

    if (filters.lowPopOnly && !cardHasLowPop) {
      continue;
    }

    const cardDeckUsage: DeckUsage[] = deckUsageData
      .filter((d: any) => d.cardSlug === card.slug)
      .map((d: any) => ({
        deckId: d.deckId,
        deckName: d.deckName,
        quantity: d.quantity,
        zone: d.zone,
      }));

    results.push({
      slug: card.slug,
      name: card.name,
      element: card.element,
      class: card.class,
      type: card.type,
      subtypes: JSON.parse(card.subtypes || "[]"),
      effect: card.effect,
      costReserve: card.costReserve,
      costMemory: card.costMemory,
      level: card.level,
      speed: card.speed,
      hasLowPopEdition: cardHasLowPop,
      deckUsage: cardDeckUsage,
      editions: populatedEditions,
    });
  }

  const paginated = results.slice(offset, offset + limit);

  return {
    cards: paginated,
    total: results.length,
  };
}
