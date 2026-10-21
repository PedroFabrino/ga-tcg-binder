import {
  getMarketStoreById,
  getMarketCardsSeenAfter,
  insertMarketNotifications,
  updateStoreLastNotifiedAt,
  type MarketplaceDatabase,
  type InsertMarketNotification,
} from "../db/repositories/marketplace-repository";

function extractCollectorNumber(rawName: string): string {
  const match = rawName.match(/\(#\s*([a-z\d-]+)\)/i);
  return match?.[1] ?? "";
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
  database?: MarketplaceDatabase
): Promise<number> {
  const store = await getMarketStoreById(storeId, database);

  if (!store) {
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
    collectorNumber: extractCollectorNumber(card.rawName),
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
