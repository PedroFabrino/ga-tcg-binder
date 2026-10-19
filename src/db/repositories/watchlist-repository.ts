import { db } from "../index";
import {
  mypWatchlist,
  users,
  decks,
  deckCards,
  collectionItems,
  cardEditions,
  cardCirculations,
  marketCards,
  metaStaples,
  cards,
} from "../schema";
import { eq, and, inArray, sql } from "drizzle-orm";

export type WatchlistRow = typeof mypWatchlist.$inferSelect;
export type WatchlistInsert = typeof mypWatchlist.$inferInsert;

export async function getWatchlistByUser(
  userId: string,
  database = db
): Promise<WatchlistRow[]> {
  return database
    .select()
    .from(mypWatchlist)
    .where(eq(mypWatchlist.userId, userId));
}

export async function getPendingWatchlistByUser(
  userId: string,
  database = db
): Promise<WatchlistRow[]> {
  return database
    .select()
    .from(mypWatchlist)
    .where(
      and(
        eq(mypWatchlist.userId, userId),
        inArray(mypWatchlist.status, ["pending_add", "pending_update", "pending_remove"])
      )
    );
}

export async function getWatchlistEntryById(
  id: string,
  database = db
): Promise<WatchlistRow | undefined> {
  const [row] = await database
    .select()
    .from(mypWatchlist)
    .where(eq(mypWatchlist.id, id))
    .limit(1);
  return row;
}

export async function insertWatchlistEntry(
  entry: WatchlistInsert,
  database = db
): Promise<void> {
  await database.insert(mypWatchlist).values(entry);
}

export async function updateWatchlistEntry(
  id: string,
  patch: Partial<WatchlistInsert>,
  database = db
): Promise<void> {
  await database
    .update(mypWatchlist)
    .set({
      ...patch,
      updatedAt: sql`(strftime('%s', 'now'))`,
    })
    .where(eq(mypWatchlist.id, id));
}

export async function markWatchlistItemsWatching(
  userId: string,
  ids: string[],
  database = db
): Promise<number> {
  if (ids.length === 0) return 0;
  await database
    .update(mypWatchlist)
    .set({
      status: "watching",
      updatedAt: sql`(strftime('%s', 'now'))`,
    })
    .where(
      and(
        eq(mypWatchlist.userId, userId),
        inArray(mypWatchlist.id, ids)
      )
    );
  return ids.length;
}

export async function deleteWatchlistItemsByIds(
  userId: string,
  ids: string[],
  database = db
): Promise<number> {
  if (ids.length === 0) return 0;
  await database
    .delete(mypWatchlist)
    .where(
      and(
        eq(mypWatchlist.userId, userId),
        inArray(mypWatchlist.id, ids)
      )
    );
  return ids.length;
}

export interface WatchlistReconciliationData {
  user: typeof users.$inferSelect;
  allDeckCards: Array<{
    deckId: string;
    cardSlug: string;
    quantity: number;
    zone: string;
    name: string;
  }>;
  userInventory: Array<{
    cardSlug: string;
    quantity: number;
  }>;
  existingWatchlistRows: WatchlistRow[];
  allCatalogEditions: Array<{
    id: string;
    cardSlug: string;
    setPrefix: string;
    collectorNumber: string;
    rarity: number;
    imageUrl: string;
    foil: boolean | null;
    kind: string | null;
  }>;
  marketCards: Array<{
    id: string;
    cardSlug: string | null;
    editionId: string | null;
    rawName: string;
    cardName: string;
    setPrefix: string;
    quantity: number;
    price: string;
    priceNumeric: number;
    tcgPrice: string | null;
    tcgPriceNumeric: number | null;
    isFoil: boolean;
    mypItemId: string | null;
    mypProductUrl: string | null;
    vendorName: string | null;
    vendorUrl: string | null;
    updatedAt: Date | null;
  }>;
  stapleMap: Map<string, number>;
  uniqueSlugs: string[];
}

export async function loadWatchlistReconciliationData(
  userId: string,
  database = db
): Promise<WatchlistReconciliationData> {
  const [user] = await database
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    throw new Error(`User not found with id ${userId}`);
  }

  // 1. Fetch user decks & deck cards
  const userDecks = await database
    .select({ id: decks.id, name: decks.name })
    .from(decks)
    .where(eq(decks.userId, userId));

  const deckIds = userDecks.map((d) => d.id);
  let allDeckCards: WatchlistReconciliationData["allDeckCards"] = [];
  if (deckIds.length > 0) {
    allDeckCards = await database
      .select({
        deckId: deckCards.deckId,
        cardSlug: deckCards.cardSlug,
        quantity: deckCards.quantity,
        zone: deckCards.zone,
        name: cards.name,
      })
      .from(deckCards)
      .innerJoin(cards, eq(deckCards.cardSlug, cards.slug))
      .where(inArray(deckCards.deckId, deckIds));
  }

  // 2. Fetch user collection items (Binder)
  const userInventory = await database
    .select({
      cardSlug: cardEditions.cardSlug,
      quantity: collectionItems.quantity,
    })
    .from(collectionItems)
    .innerJoin(cardEditions, eq(collectionItems.editionId, cardEditions.id))
    .where(eq(collectionItems.userId, userId));

  // 3. Fetch existing myp_watchlist rows for this user
  const existingWatchlistRows = await database
    .select()
    .from(mypWatchlist)
    .where(eq(mypWatchlist.userId, userId));

  // 4. Fetch staple recommendations if staples policy is active, including all meta staples slugs
  const stapleMap = new Map<string, number>();
  const stapleSlugs: string[] = [];
  if (user.watchlistPolicyStaples) {
    try {
      const staplesList = await database
        .select({
          cardSlug: metaStaples.cardSlug,
          recommendedCopies: metaStaples.recommendedCopies,
        })
        .from(metaStaples);

      for (const st of staplesList) {
        stapleMap.set(st.cardSlug, st.recommendedCopies);
        stapleSlugs.push(st.cardSlug);
      }
    } catch {
      // metaStaples might not be synced yet
    }
  }

  const deckSlugs = allDeckCards.map((c) => String(c.cardSlug));
  const watchlistSlugs = existingWatchlistRows.map((r) => String(r.cardSlug));
  const uniqueSlugs = Array.from(new Set([...deckSlugs, ...watchlistSlugs, ...stapleSlugs]));

  // 5. Fetch catalog editions for all candidate slugs
  let allCatalogEditions: WatchlistReconciliationData["allCatalogEditions"] = [];
  if (uniqueSlugs.length > 0) {
    allCatalogEditions = await database
      .select({
        id: cardEditions.id,
        cardSlug: cardEditions.cardSlug,
        setPrefix: cardEditions.setPrefix,
        collectorNumber: cardEditions.collectorNumber,
        rarity: cardEditions.rarity,
        imageUrl: cardEditions.imageUrl,
        foil: cardCirculations.foil,
        kind: cardCirculations.kind,
      })
      .from(cardEditions)
      .leftJoin(cardCirculations, eq(cardCirculations.editionId, cardEditions.id))
      .where(inArray(cardEditions.cardSlug, uniqueSlugs));
  }

  // 6. Fetch market pricing
  let marketRows: WatchlistReconciliationData["marketCards"] = [];
  if (uniqueSlugs.length > 0) {
    try {
      const raw = await database
        .select()
        .from(marketCards)
        .where(
          and(
            eq(marketCards.storeId, "myp"),
            inArray(marketCards.cardSlug, uniqueSlugs)
          )
        );

      marketRows = raw.map((r) => ({
        id: r.id,
        cardSlug: r.cardSlug,
        editionId: r.editionId,
        rawName: r.rawName,
        cardName: r.cardName,
        setPrefix: r.setPrefix,
        quantity: r.quantity,
        price: r.price,
        priceNumeric: r.priceNumeric,
        tcgPrice: r.tcgPrice,
        tcgPriceNumeric: r.tcgPriceNumeric,
        isFoil: r.isFoil,
        mypItemId: r.itemId,
        mypProductUrl: r.productUrl,
        vendorName: r.vendorName,
        vendorUrl: r.vendorUrl,
        updatedAt: r.updatedAt,
      }));
    } catch {
      // market cards table fallback
    }
  }

  return {
    user,
    allDeckCards,
    userInventory,
    existingWatchlistRows,
    allCatalogEditions,
    marketCards: marketRows,
    stapleMap,
    uniqueSlugs,
  };
}
