import {
  getMarketStoreById,
  getMarketCardsSeenAfter,
  insertMarketNotifications,
  updateStoreLastNotifiedAt,
  type MarketplaceDatabase,
  type InsertMarketNotification,
} from "../db/repositories/marketplace-repository";

export function extractCollectorNumber(
  rawName: string,
  itemId?: string | null
): string {
  const rawMatch = rawName.match(/\(#\s*([a-z\d-]+)\)/i);
  if (rawMatch?.[1]) {
    return rawMatch[1];
  }

  // MyP item IDs encode the printing, e.g. "grandarchive_dtr1e_064".
  const mypMatch = itemId?.match(
    /^grandarchive_[a-z0-9]+_([0-9]+[a-z0-9]*)$/i
  );
  return mypMatch?.[1] ?? "";
}

export interface WriteMarketNotificationsOptions {
  /**
   * When a store has never sent a notification, record a baseline instead of
   * treating its entire current catalog as newly detected stock. Used when
   * enabling notifications for a store that already has a populated catalog.
   */
  bootstrapIfNeverNotified?: boolean;
}

/**
 * Writes newly detected market cards to the notification outbox for a store.
 *
 * Queries marketCards for rows first seen after the store's lastNotifiedAt
 * (or all cards if never notified), creates outbox rows, and updates
 * lastNotifiedAt. Returns the count of notifications written.
 */
export async function writeMarketNotifications(
  storeId: string,
  database?: MarketplaceDatabase,
  options: WriteMarketNotificationsOptions = {}
): Promise<number> {
  const store = await getMarketStoreById(storeId, database);

  if (!store) {
    return 0;
  }

  if (!store.lastNotifiedAt && options.bootstrapIfNeverNotified) {
    await updateStoreLastNotifiedAt(storeId, new Date(), database);
    return 0;
  }

  const newCards = await getMarketCardsSeenAfter(storeId, store.lastNotifiedAt, database);

  if (newCards.length === 0) {
    return 0;
  }

  const now = new Date();
  const notifications: InsertMarketNotification[] = newCards.map((card) => ({
    id: crypto.randomUUID(),
    storeId: card.storeId,
    cardName: card.cardName,
    setPrefix: card.setPrefix,
    collectorNumber: extractCollectorNumber(card.rawName, card.itemId),
    isFoil: card.isFoil,
    price: card.price,
    refId: card.itemId ?? "",
    imageUrl: card.productUrl ?? null,
    detectedAt: now,
  }));

  await insertMarketNotifications(notifications, database);
  await updateStoreLastNotifiedAt(storeId, now, database);

  return notifications.length;
}
