import { db } from "../index";
import { marketStores, type InsertMarketCard, type MarketCard, type MarketStore, type InsertMarketStore, type InsertMarketNotification, type MarketNotification } from "../schema";
export type { MarketStore, InsertMarketStore, MarketCard, InsertMarketCard, MarketNotification, InsertMarketNotification, };
export type MarketplaceDatabase = typeof db;
export interface MarketCardFilters {
    storeId?: string;
    cardSlug?: string;
    inStockOnly?: boolean;
}
/**
 * Returns market stores, optionally limited to enabled stores.
 */
export declare function getMarketStores(database?: MarketplaceDatabase, enabledOnly?: boolean): Promise<MarketStore[]>;
/**
 * Returns all enabled market stores.
 */
export declare function getEnabledMarketStores(database?: MarketplaceDatabase): Promise<MarketStore[]>;
/**
 * Returns a single market store by its stable registry ID.
 */
export declare function getMarketStoreById(storeId: string, database?: MarketplaceDatabase): Promise<MarketStore | undefined>;
/**
 * Records the most recently observed listing count for a store.
 */
export declare function updateStoreCount(storeId: string, count: number, checkedAt?: Date, database?: MarketplaceDatabase): Promise<void>;
/**
 * Records completion time for a full marketplace listing scan.
 */
export declare function updateStoreFullScanAt(storeId: string, scannedAt?: Date, database?: MarketplaceDatabase): Promise<void>;
/**
 * Inserts or refreshes market listings by the stable (storeId, itemId) key.
 */
export declare function upsertMarketCards(listings: Array<InsertMarketCard>, database?: MarketplaceDatabase): Promise<void>;
/**
 * Marks active listings that were absent from the latest full scan as out of stock.
 * Observed IDs must be source-platform item IDs for the supplied store.
 */
export declare function reconcileStoreListings(storeId: string, observedItemIds: string[], database?: MarketplaceDatabase): Promise<void>;
/**
 * Lists normalized market cards with optional store/card/stock filtering.
 */
export declare function getMarketCards(filters?: MarketCardFilters, database?: MarketplaceDatabase): Promise<MarketCard[]>;
export declare function upsertMarketStore(store: typeof marketStores.$inferInsert, database?: MarketplaceDatabase): Promise<void>;
/**
 * Updates the lastLatestCardRefId for a market store.
 */
export declare function updateStoreLatestCardRefId(storeId: string, refId: string, database?: MarketplaceDatabase): Promise<void>;
/**
 * Updates the lastNotifiedAt timestamp for a market store.
 */
export declare function updateStoreLastNotifiedAt(storeId: string, notifiedAt: Date, database?: MarketplaceDatabase): Promise<void>;
/**
 * Returns pending (unsent) market notifications.
 */
/**
 * Returns cards for a store observed after the specified timestamp (or all cards if null/undefined).
 */
export declare function getMarketCardsSeenAfter(storeId: string, since?: Date | null, database?: MarketplaceDatabase): Promise<MarketCard[]>;
/**
 * Returns pending (unsent) market notifications.
 */
export declare function getPendingNotifications(database?: MarketplaceDatabase): Promise<MarketNotification[]>;
/**
 * Marks notifications as sent with a message ID.
 */
export declare function markNotificationsSent(ids: string[], messageId: string, sentAtOrDb?: Date | MarketplaceDatabase, database?: MarketplaceDatabase): Promise<void>;
/**
 * Inserts market notification rows into the outbox.
 */
export declare function insertMarketNotifications(notifications: InsertMarketNotification[], database?: MarketplaceDatabase): Promise<void>;
