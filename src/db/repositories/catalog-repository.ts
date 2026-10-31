import { db } from "../index";
import {
  cards,
  cardEditions,
  cardCirculations,
  decks,
  deckCards,
  metaStaples,
} from "../schema";
import { eq, sql, and, or, like, inArray } from "drizzle-orm";

export type CatalogDatabase = typeof db;
export type CardRow = typeof cards.$inferSelect;
export type CardInsert = typeof cards.$inferInsert;
export type CardEditionRow = typeof cardEditions.$inferSelect;
export type CardEditionInsert = typeof cardEditions.$inferInsert;
export type CardCirculationRow = typeof cardCirculations.$inferSelect;
export type CardCirculationInsert = typeof cardCirculations.$inferInsert;

export interface CatalogEditionMatch {
  cardSlug: string;
  cardName: string;
  element: string;
  setPrefix: string;
  collectorNumber: string;
  rarity: number;
  imageUrl: string;
}

function normalizeCollectorNum(num: string): string {
  const clean = num.replace(/^0+/, "").trim();
  return clean || "0";
}

export async function findCatalogEditionForFulfillment(
  params: {
    setPrefix?: string | null;
    collectorNumber?: string | null;
    cardName?: string | null;
  },
  database: CatalogDatabase = db
): Promise<CatalogEditionMatch | null> {
  const { setPrefix, collectorNumber, cardName } = params;

  if (setPrefix && collectorNumber) {
    const normPrefix = setPrefix.trim().toUpperCase();
    const cleanNum = normalizeCollectorNum(collectorNumber);

    const rows = await database
      .select({
        cardSlug: cards.slug,
        cardName: cards.name,
        element: cards.element,
        setPrefix: cardEditions.setPrefix,
        collectorNumber: cardEditions.collectorNumber,
        rarity: cardEditions.rarity,
        imageUrl: cardEditions.imageUrl,
      })
      .from(cardEditions)
      .innerJoin(cards, eq(cardEditions.cardSlug, cards.slug))
      .where(sql`UPPER(${cardEditions.setPrefix}) = ${normPrefix}`);

    const match = rows.find(
      (r) => normalizeCollectorNum(r.collectorNumber) === cleanNum
    );
    if (match) return match;
  }

  if (cardName && setPrefix) {
    const normName = cardName.trim().toLowerCase();
    const normPrefix = setPrefix.trim().toUpperCase();

    const rows = await database
      .select({
        cardSlug: cards.slug,
        cardName: cards.name,
        element: cards.element,
        setPrefix: cardEditions.setPrefix,
        collectorNumber: cardEditions.collectorNumber,
        rarity: cardEditions.rarity,
        imageUrl: cardEditions.imageUrl,
      })
      .from(cardEditions)
      .innerJoin(cards, eq(cardEditions.cardSlug, cards.slug))
      .where(sql`UPPER(${cardEditions.setPrefix}) = ${normPrefix}`);

    const match = rows.find((r) => r.cardName.trim().toLowerCase() === normName);
    if (match) return match;
  }

  if (cardName) {
    const normName = cardName.trim().toLowerCase();

    const rows = await database
      .select({
        cardSlug: cards.slug,
        cardName: cards.name,
        element: cards.element,
        setPrefix: cardEditions.setPrefix,
        collectorNumber: cardEditions.collectorNumber,
        rarity: cardEditions.rarity,
        imageUrl: cardEditions.imageUrl,
      })
      .from(cardEditions)
      .innerJoin(cards, eq(cardEditions.cardSlug, cards.slug))
      .where(sql`LOWER(${cards.name}) = ${normName}`);

    if (rows.length > 0) return rows[0];
  }

  return null;
}

export async function upsertCatalogCard(
  card: CardInsert,
  database: CatalogDatabase = db
): Promise<void> {
  await database
    .insert(cards)
    .values(card)
    .onConflictDoUpdate({
      target: cards.slug,
      set: {
        name: card.name,
        element: card.element,
        class: card.class,
        type: card.type,
        subtypes: card.subtypes,
        effect: card.effect,
        costReserve: card.costReserve ?? null,
        costMemory: card.costMemory ?? null,
        level: card.level ?? null,
        speed: card.speed ? true : false,
        updatedAt: sql`(strftime('%s', 'now'))`,
      },
    });
}

export async function upsertCatalogCardEdition(
  edition: CardEditionInsert,
  database: CatalogDatabase = db
): Promise<void> {
  await database
    .insert(cardEditions)
    .values(edition)
    .onConflictDoUpdate({
      target: cardEditions.id,
      set: {
        cardSlug: edition.cardSlug,
        setPrefix: edition.setPrefix,
        setName: edition.setName,
        collectorNumber: edition.collectorNumber,
        rarity: edition.rarity,
        imageUrl: edition.imageUrl,
      },
    });
}

export async function upsertCatalogCardCirculation(
  circulation: CardCirculationInsert,
  database: CatalogDatabase = db
): Promise<void> {
  await database
    .insert(cardCirculations)
    .values(circulation)
    .onConflictDoUpdate({
      target: cardCirculations.id,
      set: {
        kind: circulation.kind,
        population: circulation.population,
        foil: circulation.foil,
        printing: circulation.printing,
      },
    });
}

export interface CatalogSearchFilterParams {
  query?: string;
  element?: string;
  class?: string;
  type?: string;
  keywords?: string[];
  keywordsMatchMode?: "all" | "any";
}

export async function queryCatalogCards(
  filters: CatalogSearchFilterParams,
  database: CatalogDatabase = db
): Promise<CardRow[]> {
  const conditions = [];

  if (filters.query && filters.query.trim().length > 0) {
    const q = `%${filters.query.trim()}%`;
    conditions.push(or(like(cards.name, q), like(cards.slug, q)));
  }

  if (filters.keywords && filters.keywords.length > 0) {
    const cleanedKeywords = filters.keywords
      .map((k) => k.trim())
      .filter((k) => k.length > 0);

    if (cleanedKeywords.length > 0) {
      const mode = filters.keywordsMatchMode || "all";
      const kwConditions = cleanedKeywords.map((kw) => {
        const pattern = `%${kw}%`;
        return or(like(cards.effect, pattern), like(cards.subtypes, pattern));
      });

      if (kwConditions.length === 1) {
        conditions.push(kwConditions[0]);
      } else if (mode === "all") {
        conditions.push(and(...kwConditions));
      } else {
        conditions.push(or(...kwConditions));
      }
    }
  }

  if (filters.element && filters.element !== "ALL") {
    const el = filters.element.toUpperCase().trim();
    if (el === "EARTH" || el === "TERA") {
      conditions.push(or(eq(cards.element, "TERA"), eq(cards.element, "EARTH")));
    } else if (el === "LUMEN" || el === "LUXEM") {
      conditions.push(or(eq(cards.element, "LUXEM"), eq(cards.element, "LUMEN")));
    } else if (el === "ARCANA" || el === "ARCANE") {
      conditions.push(or(eq(cards.element, "ARCANE"), eq(cards.element, "ARCANA")));
    } else {
      conditions.push(eq(cards.element, el));
    }
  }

  if (filters.class && filters.class !== "ALL") {
    conditions.push(eq(cards.class, filters.class));
  }

  if (filters.type && filters.type !== "ALL") {
    conditions.push(eq(cards.type, filters.type));
  }

  let query = database.select().from(cards);
  if (conditions.length > 0) {
    query = (query as any).where(and(...conditions));
  }

  return query;
}

export async function queryMetaStaplesByCardSlugs(
  slugs: string[],
  database: CatalogDatabase = db
) {
  if (slugs.length === 0) return [];
  return database
    .select()
    .from(metaStaples)
    .where(inArray(metaStaples.cardSlug, slugs));
}

export async function queryEditionsByCardSlugs(
  slugs: string[],
  setPrefix?: string,
  database: CatalogDatabase = db
) {
  if (slugs.length === 0) return [];
  if (setPrefix && setPrefix !== "ALL") {
    return database
      .select()
      .from(cardEditions)
      .where(
        and(
          inArray(cardEditions.cardSlug, slugs),
          eq(cardEditions.setPrefix, setPrefix)
        )
      );
  }
  return database
    .select()
    .from(cardEditions)
    .where(inArray(cardEditions.cardSlug, slugs));
}

export async function queryCirculationsByEditionIds(
  editionIds: string[],
  database: CatalogDatabase = db
) {
  if (editionIds.length === 0) return [];
  return database
    .select()
    .from(cardCirculations)
    .where(inArray(cardCirculations.editionId, editionIds));
}

export async function queryDeckUsageForUserCards(
  userId: string,
  slugs: string[],
  database: CatalogDatabase = db
) {
  if (slugs.length === 0) return [];
  return database
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
        eq(decks.userId, userId),
        inArray(deckCards.cardSlug, slugs)
      )
    );
}

/**
 * Fast search of catalog cards by name for autocomplete suggestions (max limit).
 */
export async function searchCardsForAutocomplete(
  query: string,
  limit: number = 25,
  database: CatalogDatabase = db
) {
  const clean = query.trim().toLowerCase();
  return database
    .select({
      slug: cards.slug,
      name: cards.name,
      element: cards.element,
      type: cards.type,
      class: cards.class,
    })
    .from(cards)
    .where(sql`LOWER(${cards.name}) LIKE ${"%" + clean + "%"}`)
    .limit(limit);
}

/**
 * Resolves a card by exact slug or exact display name, case-insensitively.
 * Used by Discord commands where the user may submit a display name instead of a slug.
 */
export async function findCardBySlugOrName(
  query: string,
  database: CatalogDatabase = db
): Promise<CardRow | undefined> {
  const clean = query.trim().toLowerCase();
  if (!clean) return undefined;

  const [bySlug] = await database
    .select()
    .from(cards)
    .where(sql`LOWER(${cards.slug}) = ${clean}`)
    .limit(1);
  if (bySlug) return bySlug;

  const [byName] = await database
    .select()
    .from(cards)
    .where(sql`LOWER(${cards.name}) = ${clean}`)
    .limit(1);
  return byName;
}
