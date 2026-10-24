"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMarketStores = getMarketStores;
exports.getEnabledMarketStores = getEnabledMarketStores;
exports.getMarketStoreById = getMarketStoreById;
exports.updateStoreCount = updateStoreCount;
exports.updateStoreFullScanAt = updateStoreFullScanAt;
exports.upsertMarketCards = upsertMarketCards;
exports.reconcileStoreListings = reconcileStoreListings;
exports.getMarketCards = getMarketCards;
exports.upsertMarketStore = upsertMarketStore;
exports.updateStoreLatestCardRefId = updateStoreLatestCardRefId;
exports.updateStoreLastNotifiedAt = updateStoreLastNotifiedAt;
exports.getMarketCardsSeenAfter = getMarketCardsSeenAfter;
exports.getPendingNotifications = getPendingNotifications;
exports.markNotificationsSent = markNotificationsSent;
exports.insertMarketNotifications = insertMarketNotifications;
const drizzle_orm_1 = require("drizzle-orm");
const index_1 = require("../index");
const schema_1 = require("../schema");
/**
 * Returns market stores, optionally limited to enabled stores.
 */
async function getMarketStores(database = index_1.db, enabledOnly = false) {
    if (enabledOnly) {
        return database
            .select()
            .from(schema_1.marketStores)
            .where((0, drizzle_orm_1.eq)(schema_1.marketStores.enabled, true))
            .orderBy(schema_1.marketStores.name);
    }
    return database.select().from(schema_1.marketStores).orderBy(schema_1.marketStores.name);
}
/**
 * Returns all enabled market stores.
 */
async function getEnabledMarketStores(database = index_1.db) {
    return getMarketStores(database, true);
}
/**
 * Returns a single market store by its stable registry ID.
 */
async function getMarketStoreById(storeId, database = index_1.db) {
    const [store] = await database
        .select()
        .from(schema_1.marketStores)
        .where((0, drizzle_orm_1.eq)(schema_1.marketStores.id, storeId))
        .limit(1);
    return store;
}
/**
 * Records the most recently observed listing count for a store.
 */
async function updateStoreCount(storeId, count, checkedAt = new Date(), database = index_1.db) {
    await database
        .update(schema_1.marketStores)
        .set({
        lastCount: count,
        lastCountCheckedAt: checkedAt,
        updatedAt: checkedAt,
    })
        .where((0, drizzle_orm_1.eq)(schema_1.marketStores.id, storeId));
}
/**
 * Records completion time for a full marketplace listing scan.
 */
async function updateStoreFullScanAt(storeId, scannedAt = new Date(), database = index_1.db) {
    await database
        .update(schema_1.marketStores)
        .set({
        lastFullScanAt: scannedAt,
        updatedAt: scannedAt,
    })
        .where((0, drizzle_orm_1.eq)(schema_1.marketStores.id, storeId));
}
/**
 * Inserts or refreshes market listings by the stable (storeId, itemId) key.
 */
async function upsertMarketCards(listings, database = index_1.db) {
    if (listings.length === 0) {
        return;
    }
    const observedAt = new Date();
    for (const listing of listings) {
        const row = {
            ...listing,
            lastStockedAt: (listing.quantity ?? 1) > 0 ? (listing.lastStockedAt ?? observedAt) : null,
            lastSeenAt: listing.lastSeenAt ?? observedAt,
            updatedAt: listing.updatedAt ?? observedAt,
        };
        const conflictUpdate = {
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
            lastStockedAt: (0, drizzle_orm_1.sql) `CASE WHEN ${schema_1.marketCards.quantity} <= 0 AND ${row.quantity} > 0 THEN strftime('%s', 'now') ELSE ${schema_1.marketCards.lastStockedAt} END`,
            lastSeenAt: row.lastSeenAt,
            updatedAt: row.updatedAt,
        };
        if (row.itemId) {
            await database
                .insert(schema_1.marketCards)
                .values(row)
                .onConflictDoUpdate({
                target: [schema_1.marketCards.storeId, schema_1.marketCards.itemId],
                set: conflictUpdate,
            });
        }
        else {
            await database
                .insert(schema_1.marketCards)
                .values(row)
                .onConflictDoUpdate({
                target: schema_1.marketCards.id,
                set: conflictUpdate,
            });
        }
    }
}
/**
 * Marks active listings that were absent from the latest full scan as out of stock.
 * Observed IDs must be source-platform item IDs for the supplied store.
 */
async function reconcileStoreListings(storeId, observedItemIds, database = index_1.db) {
    const reconciledAt = new Date();
    const conditions = [
        (0, drizzle_orm_1.eq)(schema_1.marketCards.storeId, storeId),
        (0, drizzle_orm_1.gt)(schema_1.marketCards.quantity, 0),
    ];
    if (observedItemIds.length > 0) {
        conditions.push((0, drizzle_orm_1.notInArray)(schema_1.marketCards.itemId, observedItemIds));
    }
    await database
        .update(schema_1.marketCards)
        .set({
        quantity: 0,
        updatedAt: reconciledAt,
    })
        .where((0, drizzle_orm_1.and)(...conditions));
}
/**
 * Lists normalized market cards with optional store/card/stock filtering.
 */
async function getMarketCards(filters = {}, database = index_1.db) {
    const conditions = [];
    if (filters.storeId) {
        conditions.push((0, drizzle_orm_1.eq)(schema_1.marketCards.storeId, filters.storeId));
    }
    if (filters.cardSlug) {
        conditions.push((0, drizzle_orm_1.eq)(schema_1.marketCards.cardSlug, filters.cardSlug));
    }
    if (filters.inStockOnly) {
        conditions.push((0, drizzle_orm_1.gt)(schema_1.marketCards.quantity, 0));
    }
    if (conditions.length === 0) {
        return database.select().from(schema_1.marketCards);
    }
    return database
        .select()
        .from(schema_1.marketCards)
        .where((0, drizzle_orm_1.and)(...conditions));
}
async function upsertMarketStore(store, database = index_1.db) {
    const existing = await getMarketStoreById(store.id, database);
    if (!existing) {
        await database.insert(schema_1.marketStores).values(store);
    }
}
/**
 * Updates the lastLatestCardRefId for a market store.
 */
async function updateStoreLatestCardRefId(storeId, refId, database = index_1.db) {
    await database
        .update(schema_1.marketStores)
        .set({
        lastLatestCardRefId: refId,
        updatedAt: new Date(),
    })
        .where((0, drizzle_orm_1.eq)(schema_1.marketStores.id, storeId));
}
/**
 * Updates the lastNotifiedAt timestamp for a market store.
 */
async function updateStoreLastNotifiedAt(storeId, notifiedAt, database = index_1.db) {
    await database
        .update(schema_1.marketStores)
        .set({
        lastNotifiedAt: notifiedAt,
        updatedAt: new Date(),
    })
        .where((0, drizzle_orm_1.eq)(schema_1.marketStores.id, storeId));
}
/**
 * Returns pending (unsent) market notifications.
 */
/**
 * Returns cards for a store observed after the specified timestamp (or all cards if null/undefined).
 */
async function getMarketCardsSeenAfter(storeId, since, database = index_1.db) {
    const conditions = [
        (0, drizzle_orm_1.eq)(schema_1.marketCards.storeId, storeId),
        (0, drizzle_orm_1.gt)(schema_1.marketCards.quantity, 0),
    ];
    if (since) {
        const sinceSec = Math.floor(since.getTime() / 1000);
        conditions.push((0, drizzle_orm_1.sql) `COALESCE(${schema_1.marketCards.lastStockedAt}, ${schema_1.marketCards.firstSeenAt}) > ${sinceSec}`);
    }
    return database
        .select()
        .from(schema_1.marketCards)
        .where((0, drizzle_orm_1.and)(...conditions))
        .orderBy(schema_1.marketCards.firstSeenAt);
}
/**
 * Returns pending (unsent) market notifications.
 */
async function getPendingNotifications(database = index_1.db) {
    return database
        .select()
        .from(schema_1.marketNotifications)
        .where((0, drizzle_orm_1.isNull)(schema_1.marketNotifications.sentAt))
        .orderBy(schema_1.marketNotifications.createdAt);
}
/**
 * Marks notifications as sent with a message ID.
 */
async function markNotificationsSent(ids, messageId, sentAtOrDb, database) {
    if (ids.length === 0)
        return;
    const isDate = sentAtOrDb instanceof Date;
    const sentAt = isDate ? sentAtOrDb : new Date();
    const targetDb = isDate ? (database ?? index_1.db) : (sentAtOrDb ?? index_1.db);
    await targetDb
        .update(schema_1.marketNotifications)
        .set({
        sentAt,
        messageId,
    })
        .where((0, drizzle_orm_1.inArray)(schema_1.marketNotifications.id, ids));
}
/**
 * Inserts market notification rows into the outbox.
 */
async function insertMarketNotifications(notifications, database = index_1.db) {
    if (notifications.length === 0)
        return;
    await database.insert(schema_1.marketNotifications).values(notifications);
}
