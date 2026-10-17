import { db } from "../index";
import { cards, cardEditions } from "../schema";
import { eq, sql } from "drizzle-orm";

export type CatalogDatabase = typeof db;

export interface CatalogEditionMatch {
  cardSlug: string;
  cardName: string;
  element: string;
  setPrefix: string;
  collectorNumber: string;
  rarity: number;
  imageUrl: string;
}

/**
 * Normalizes collector number for comparison (e.g., "029" -> "29", "1" -> "1").
 */
function normalizeCollectorNum(num: string): string {
  const clean = num.replace(/^0+/, "").trim();
  return clean || "0";
}

/**
 * Finds a matching card edition from the catalog for fulfillment enrichment.
 * Implements fallback cascade:
 * 1. Normalized (setPrefix, collectorNumber)
 * 2. Normalized cardName + setPrefix
 * 3. Normalized cardName alone
 */
export async function findCatalogEditionForFulfillment(
  params: {
    setPrefix?: string | null;
    collectorNumber?: string | null;
    cardName?: string | null;
  },
  database: CatalogDatabase = db
): Promise<CatalogEditionMatch | null> {
  const { setPrefix, collectorNumber, cardName } = params;

  // 1. Try setPrefix + collectorNumber
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

  // 2. Fallback: cardName + setPrefix
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

  // 3. Fallback: cardName alone
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
