import {
 getMarketStoreById,
 type MarketplaceDatabase,
 type MarketNotification,
} from "../db/repositories/marketplace-repository";
import { getUndeliveredNotifications } from "../db/repositories/notification-delivery-repository";
import { groupMarketNotificationsByStore } from "./market-notification-message";

/**
 * A notification sink owns one delivery channel: formatting, sending, and
 * recording delivery for a single destination (e.g. Discord). Root remains
 * the only pull-based consumer and does not use this abstraction.
 */
export interface MarketNotificationSink {
 readonly destination: string;
 formatGroup(
  notifications: MarketNotification[],
  storeName: string,
  lastSyncDate?: Date | string | null
 ): string[];
 send(content: string): Promise<string | null>;
 markDelivered(
  notificationIds: string[],
  messageId: string | null,
  database?: MarketplaceDatabase
 ): Promise<void>;
}

export interface MarketNotificationDeliveryResult {
 attempted: number;
 delivered: number;
}

/**
 * Delivers every market notification that has no delivery recorded for the
 * sink's destination. Notifications are grouped by store, formatted into one
 * or more messages, sent, and then marked delivered. A failed or crashed run
 * is retried on the next invocation because undelivered rows are re-selected.
 */
export async function deliverMarketNotifications(
 sink: MarketNotificationSink,
 database?: MarketplaceDatabase
): Promise<MarketNotificationDeliveryResult> {
 const pending = await getUndeliveredNotifications(sink.destination, database);

 if (pending.length === 0) {
  return { attempted: 0, delivered: 0 };
 }

 const byStore = groupMarketNotificationsByStore(pending);
 let delivered = 0;

 for (const [storeId, notifications] of byStore) {
  const store = await getMarketStoreById(storeId, database);
  const storeName = store?.name ?? storeId;
  const lastSyncDate = store?.lastFullScanAt ?? null;

  const chunks = sink.formatGroup(notifications, storeName, lastSyncDate);
  if (chunks.length === 0) {
   continue;
  }

  const messageIds: string[] = [];
  let allSent = true;

  for (const chunk of chunks) {
   const messageId = await sink.send(chunk);
   if (messageId === null) {
    allSent = false;
    break;
   }
   messageIds.push(messageId);
  }

  if (!allSent) {
   continue;
  }

  await sink.markDelivered(
   notifications.map((notification) => notification.id),
   messageIds.join(","),
   database
  );
  delivered += notifications.length;
 }

 return { attempted: pending.length, delivered };
}
