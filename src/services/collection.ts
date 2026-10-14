import { eq, and, inArray, sql } from "drizzle-orm";
import {
  collectionItems,
  cardEditions,
  cardCirculations,
  cards,
  deckCards,
  decks,
  users,
} from "../db/schema";

export interface AddCollectionItemParams {
  userId: string;
  editionId: string;
  foil: boolean;
  quantity: number;
  isDedicated?: boolean;
}

export interface CollectionItemView {
  id: string;
  editionId: string;
  cardSlug: string;
  cardName: string;
  element: string;
  class: string;
  type: string;
  setPrefix: string;
  setName: string;
  collectorNumber: string;
  rarity: number;
  imageUrl: string;
  foil: boolean;
  quantity: number;
  isDedicated: boolean;
  population: number;
  isLowPop: boolean;
  activeDeckUsages: number;
  idleQuantity: number;
}

export type SmartViewType = "ALL" | "STAPLES" | "LOW_POP" | "IDLE";

export async function addOrUpdateCollectionItem(
  params: AddCollectionItemParams,
  database: any
): Promise<void> {
  const existing = await database
    .select()
    .from(collectionItems)
    .where(
      and(
        eq(collectionItems.userId, params.userId),
        eq(collectionItems.editionId, params.editionId),
        eq(collectionItems.foil, params.foil)
      )
    )
    .get();

  if (existing) {
    const newQty = existing.quantity + params.quantity;
    if (newQty <= 0) {
      await database.delete(collectionItems).where(eq(collectionItems.id, existing.id));
    } else {
      await database
        .update(collectionItems)
        .set({
          quantity: newQty,
          isDedicated: params.isDedicated !== undefined ? params.isDedicated : existing.isDedicated,
          updatedAt: sql`(strftime('%s', 'now'))`,
        })
        .where(eq(collectionItems.id, existing.id));
    }
  } else {
    if (params.quantity > 0) {
      const id = `col-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      await database.insert(collectionItems).values({
        id,
        userId: params.userId,
        editionId: params.editionId,
        foil: params.foil,
        quantity: params.quantity,
        isDedicated: params.isDedicated ?? false,
      });
    }
  }
}

export async function importBulkCollectionText(
  userId: string,
  rawText: string,
  database: any
): Promise<{ addedCount: number; errors: string[] }> {
  const lines = rawText.split(/\r?\n/);
  let addedCount = 0;
  const errors: string[] = [];

  for (let line of lines) {
    line = line.trim();
    if (!line || line.startsWith("#") || line.startsWith("//")) continue;

    // Pattern: 4x Fracturize [DOA 001 Foil] or 4 Fracturize
    const match = line.match(/^(\d+)[xX]?\s+(.+)$/);
    if (!match) {
      errors.push(`Could not parse quantity on line: "${line}"`);
      continue;
    }

    const qty = parseInt(match[1], 10);
    let cardPart = match[2].trim();
    let isFoil = false;

    // Check foil / non-foil mention (non-foil must be checked before foil)
    if (/\bnon-?foil\b/i.test(cardPart)) {
      isFoil = false;
      cardPart = cardPart.replace(/\bnon-?foil\b/gi, "").trim();
    } else if (/\bfoil\b/i.test(cardPart)) {
      isFoil = true;
      cardPart = cardPart.replace(/\bfoil\b/gi, "").trim();
    }

    // Extract set prefix or collector number if in brackets/parens
    let setOrCode = "";
    const bracketMatch = cardPart.match(/[\(\[]([A-Za-z0-9\s\-]+)[\)\]]$/);
    if (bracketMatch) {
      setOrCode = bracketMatch[1].trim();
      cardPart = cardPart.replace(/[\(\[][A-Za-z0-9\s\-]+[\)\]]$/, "").trim();
    }

    // Find card in database
    const cardMatch = await database
      .select()
      .from(cards)
      .where(sql`lower(${cards.name}) = lower(${cardPart})`)
      .get();

    if (!cardMatch) {
      errors.push(`Card not found in catalog: "${cardPart}"`);
      continue;
    }

    // Find matching edition
    const eds = await database
      .select()
      .from(cardEditions)
      .where(eq(cardEditions.cardSlug, cardMatch.slug));

    if (eds.length === 0) {
      errors.push(`No editions found for card: "${cardMatch.name}"`);
      continue;
    }

    let targetEdition = eds[0];
    if (setOrCode) {
      const matchEd = eds.find(
        (e: any) =>
          e.setPrefix.toLowerCase() === setOrCode.toLowerCase() ||
          `${e.setPrefix} ${e.collectorNumber}`.toLowerCase().includes(setOrCode.toLowerCase())
      );
      if (matchEd) {
        targetEdition = matchEd;
      }
    }

    await addOrUpdateCollectionItem(
      {
        userId,
        editionId: targetEdition.id,
        foil: isFoil,
        quantity: qty,
      },
      database
    );
    addedCount += qty;
  }

  return { addedCount, errors };
}

export async function getCollectionSmartView(
  userId: string,
  view: SmartViewType,
  database: any
): Promise<CollectionItemView[]> {
  // Fetch user settings
  const user = await database.select().from(users).where(eq(users.id, userId)).get();
  const threshold = user?.lowPopThreshold ?? 1000;

  // Fetch all user collection items
  const items = await database
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

  if (items.length === 0) return [];

  // Fetch circulations for population
  const editionIds = items.map((i: any) => i.editionId);
  const circs = await database
    .select()
    .from(cardCirculations)
    .where(inArray(cardCirculations.editionId, editionIds));

  // Fetch user active deck card usages to compute multi-deck staples & idle binder counts
  const userDecks = await database
    .select({
      deckId: decks.id,
      cardSlug: deckCards.cardSlug,
      quantity: deckCards.quantity,
    })
    .from(deckCards)
    .innerJoin(decks, eq(deckCards.deckId, decks.id))
    .where(eq(decks.userId, userId));

  // Count how many different decks use each cardSlug, and total copies used
  const deckUsageBySlug = new Map<string, { deckCount: number; maxUsage: number }>();
  for (const ud of userDecks) {
    const cur = deckUsageBySlug.get(ud.cardSlug) || { deckCount: 0, maxUsage: 0 };
    cur.deckCount += 1;
    cur.maxUsage = Math.max(cur.maxUsage, ud.quantity);
    deckUsageBySlug.set(ud.cardSlug, cur);
  }

  const results: CollectionItemView[] = [];

  for (const item of items) {
    const circList = circs.filter(
      (c: any) => c.editionId === item.editionId && Boolean(c.foil) === Boolean(item.foil)
    );
    const population = circList.length > 0 ? circList[0].population : 999999;
    const isLowPop = population <= threshold;

    const usageInfo = deckUsageBySlug.get(item.cardSlug) || { deckCount: 0, maxUsage: 0 };
    const idleQty = Math.max(0, item.quantity - usageInfo.maxUsage);

    const viewItem: CollectionItemView = {
      id: item.id,
      editionId: item.editionId,
      cardSlug: item.cardSlug,
      cardName: item.cardName,
      element: item.element,
      class: item.class,
      type: item.type,
      setPrefix: item.setPrefix,
      setName: item.setName,
      collectorNumber: item.collectorNumber,
      rarity: item.rarity,
      imageUrl: item.imageUrl,
      foil: item.foil,
      quantity: item.quantity,
      isDedicated: item.isDedicated,
      population,
      isLowPop,
      activeDeckUsages: usageInfo.deckCount,
      idleQuantity: idleQty,
    };

    // Filter by Smart View
    if (view === "STAPLES" && usageInfo.deckCount < 2) {
      continue;
    }
    if (view === "LOW_POP" && !isLowPop) {
      continue;
    }
    if (view === "IDLE" && idleQty <= 0) {
      continue;
    }

    results.push(viewItem);
  }

  return results;
}
