import { and, eq, gt, inArray, isNull, notInArray } from "drizzle-orm";
import { db } from "../index";
import {
marketCards,
marketNotifications,
marketStores,
type InsertMarketCard,
type MarketCard,
type MarketStore,
type InsertMarketStore,
type InsertMarketNotification,
type MarketNotification,
} from "../schema";

export type {
  MarketStore,
  InsertMarketStore,
  MarketCard,
  InsertMarketCard,
  MarketNotification,
  InsertMarketNotification,
};

export type MarketplaceDatabase = typeof db;

export interface MarketCardFilters {
  storeId?: string;
  cardSlug?: string;
  inStockOnly?: boolean;
}

/**
 * Returns market stores, optionally limited to enabled stores.
 */
export async function getMarketStores(
  database: MarketplaceDatabase = db,
  enabledOnly = false
): Promise<MarketStore[]> {
  if (enabledOnly) {
    return database
      .select()
      .from(marketStores)
      .where(eq(marketStores.enabled, true))
      .orderBy(marketStores.name);
  }

  return database.select().from(marketStores).orderBy(marketStores.name);
}

/**
 * Returns all enabled market stores.
 */
export async function getEnabledMarketStores(
  database: MarketplaceDatabase = db
): Promise<MarketStore[]> {
  return getMarketStores(database, true);
}

/**
 * Returns a single market store by its stable registry ID.
 */
export async function getMarketStoreById(
  storeId: string,
  database: MarketplaceDatabase = db
): Promise<MarketStore | undefined> {
  const [store] = await database
    .select()
    .from(marketStores)
    .where(eq(marketStores.id, storeId))
    .limit(1);

  return store;
}

/**
 * Records the most recently observed listing count for a store.
 */
export async function updateStoreCount(
  storeId: string,
  count: number,
  checkedAt = new Date(),
  database: MarketplaceDatabase = db
): Promise<void> {
  await database
    .update(marketStores)
    .set({
      lastCount: count,
      lastCountCheckedAt: checkedAt,
      updatedAt: checkedAt,
    })
    .where(eq(marketStores.id, storeId));
}

/**
 * Records completion time for a full marketplace listing scan.
 */
export async function updateStoreFullScanAt(
  storeId: string,
  scannedAt = new Date(),
  database: MarketplaceDatabase = db
): Promise<void> {
  await database
    .update(marketStores)
    .set({
      lastFullScanAt: scannedAt,
      updatedAt: scannedAt,
    })
    .where(eq(marketStores.id, storeId));
}

/**
 * Inserts or refreshes market listings by the stable (storeId, itemId) key.
 */
export async function upsertMarketCards(
  listings: Array<InsertMarketCard>,
  database: MarketplaceDatabase = db
): Promise<void> {
  if (listings.length === 0) {
    return;
  }

  const observedAt = new Date();

  for (const listing of listings) {
    const row = {
      ...listing,
      lastSeenAt: listing.lastSeenAt ?? observedAt,
      updatedAt: listing.updatedAt ?? observedAt,
    };

    if (row.itemId) {
      await database
        .insert(marketCards)
        .values(row)
        .onConflictDoUpdate({
          target: [marketCards.storeId, marketCards.itemId],
          set: {
            cardSlug: row.cardSlug,
            editionId: row.editionId,
            rawName: row.rawName,
            cardName: row.cardName,
            setPrefix: row.setPrefix,
            quantity: row.quantity,
            price: row.price,
            priceNumeric: row.priceNumeric,
            tcgPrice: row.tcgPrice,
            tcgPriceNumeric: row.tcgPriceNumeric,
            quality: row.quality,
            isFoil: row.isFoil,
            productUrl: row.productUrl,
            vendorName: row.vendorName,
            vendorUrl: row.vendorUrl,
            lastSeenAt: row.lastSeenAt,
            updatedAt: row.updatedAt,
          },
        });
    } else {
      await database
        .insert(marketCards)
        .values(row)
        .onConflictDoUpdate({
          target: marketCards.id,
          set: {
            cardSlug: row.cardSlug,
            editionId: row.editionId,
            rawName: row.rawName,
            cardName: row.cardName,
            setPrefix: row.setPrefix,
            quantity: row.quantity,
            price: row.price,
            priceNumeric: row.priceNumeric,
            tcgPrice: row.tcgPrice,
            tcgPriceNumeric: row.tcgPriceNumeric,
            quality: row.quality,
            isFoil: row.isFoil,
            productUrl: row.productUrl,
            vendorName: row.vendorName,
            vendorUrl: row.vendorUrl,
            lastSeenAt: row.lastSeenAt,
            updatedAt: row.updatedAt,
          },
        });
    }
  }
}

/**
 * Marks active listings that were absent from the latest full scan as out of stock.
 * Observed IDs must be source-platform item IDs for the supplied store.
 */
export async function reconcileStoreListings(
  storeId: string,
  observedItemIds: string[],
  database: MarketplaceDatabase = db
): Promise<void> {
  const reconciledAt = new Date();

  const conditions = [
    eq(marketCards.storeId, storeId),
    gt(marketCards.quantity, 0),
  ];

  if (observedItemIds.length > 0) {
    conditions.push(notInArray(marketCards.itemId, observedItemIds));
  }

  await database
    .update(marketCards)
    .set({
      quantity: 0,
      updatedAt: reconciledAt,
    })
    .where(and(...conditions));
}

/**
 * Lists normalized market cards with optional store/card/stock filtering.
 */
export async function getMarketCards(
  filters: MarketCardFilters = {},
  database: MarketplaceDatabase = db
): Promise<MarketCard[]> {
  const conditions = [];

  if (filters.storeId) {
    conditions.push(eq(marketCards.storeId, filters.storeId));
  }

  if (filters.cardSlug) {
    conditions.push(eq(marketCards.cardSlug, filters.cardSlug));
  }

  if (filters.inStockOnly) {
    conditions.push(gt(marketCards.quantity, 0));
  }

  if (conditions.length === 0) {
    return database.select().from(marketCards);
  }

  return database
    .select()
    .from(marketCards)
    .where(and(...conditions));
}

export async function upsertMarketStore(
store: typeof marketStores.$inferInsert,
database: MarketplaceDatabase = db
): Promise<void> {
const existing = await getMarketStoreById(store.id, database);
if (!existing) {
await database.insert(marketStores).values(store);
}
}

/**
 * Updates the lastLatestCardRefId for a market store.
 */
export async function updateStoreLatestCardRefId(
storeId: string,
refId: string,
database: MarketplaceDatabase = db
): Promise<void> {
await database
.update(marketStores)
.set({
lastLatestCardRefId: refId,
updatedAt: new Date(),
})
.where(eq(marketStores.id, storeId));
}

/**
 * Updates the lastNotifiedAt timestamp for a market store.
 */
export async function updateStoreLastNotifiedAt(
storeId: string,
notifiedAt: Date,
database: MarketplaceDatabase = db
): Promise<void> {
await database
.update(marketStores)
.set({
lastNotifiedAt: notifiedAt,
updatedAt: new Date(),
})
.where(eq(marketStores.id, storeId));
}

/**
 * Returns pending (unsent) market notifications.
 */
/**
 * Returns cards for a store observed after the specified timestamp (or all cards if null/undefined).
 */
export async function getMarketCardsSeenAfter(
  storeId: string,
  since?: Date | null,
  database: MarketplaceDatabase = db
): Promise<MarketCard[]> {
  const conditions = [eq(marketCards.storeId, storeId)];
  if (since) {
    conditions.push(gt(marketCards.firstSeenAt, since));
  }
  return database
    .select()
    .from(marketCards)
    .where(and(...conditions))
    .orderBy(marketCards.firstSeenAt);
}

/**
 * Returns pending (unsent) market notifications.
 */
export async function getPendingNotifications(
  database: MarketplaceDatabase = db
): Promise<MarketNotification[]> {
  return database
    .select()
    .from(marketNotifications)
    .where(isNull(marketNotifications.sentAt))
    .orderBy(marketNotifications.createdAt);
}

/**
 * Marks notifications as sent with a message ID.
 */
export async function markNotificationsSent(
  ids: string[],
  messageId: string,
  sentAtOrDb?: Date | MarketplaceDatabase,
  database?: MarketplaceDatabase
): Promise<void> {
  if (ids.length === 0) return;
  const isDate = sentAtOrDb instanceof Date;
  const sentAt = isDate ? sentAtOrDb : new Date();
  const targetDb = isDate ? (database ?? db) : ((sentAtOrDb as MarketplaceDatabase) ?? db);

  await targetDb
    .update(marketNotifications)
    .set({
      sentAt,
      messageId,
    })
    .where(inArray(marketNotifications.id, ids));
}

/**
 * Inserts market notification rows into the outbox.
 */
export async function insertMarketNotifications(
  notifications: InsertMarketNotification[],
  database: MarketplaceDatabase = db
): Promise<void> {
  if (notifications.length === 0) return;
  await database.insert(marketNotifications).values(notifications);
}
