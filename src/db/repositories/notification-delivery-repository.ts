import { eq, notInArray } from "drizzle-orm";
import { db } from "../index";
import {
 marketNotifications,
 notificationDeliveries,
 type InsertNotificationDelivery,
 type MarketNotification,
 type NotificationDelivery,
} from "../schema";

export type {
 MarketNotification,
 InsertNotificationDelivery,
 NotificationDelivery,
};

export type NotificationDeliveryDatabase = typeof db;

/**
 * Stable identifier for the Discord webhook sink. Future destinations reuse
 * the same `notification_deliveries` table keyed by this value.
 */
export const DISCORD_DESTINATION = "discord";

/**
 * Returns market notifications that have not yet been delivered to the given
 * destination. Rows already tracked in `notification_deliveries` for the
 * destination are excluded, so a crashed run retries on the next invocation.
 */
export async function getUndeliveredNotifications(
 destination: string,
 database: NotificationDeliveryDatabase = db
): Promise<MarketNotification[]> {
 const deliveredIds = database
  .select({ id: notificationDeliveries.notificationId })
  .from(notificationDeliveries)
  .where(eq(notificationDeliveries.destination, destination));

 return database
  .select()
  .from(marketNotifications)
  .where(notInArray(marketNotifications.id, deliveredIds))
  .orderBy(marketNotifications.createdAt);
}

/**
 * Records that the given notifications were delivered to the destination.
 * The (notification_id, destination) primary key makes this idempotent:
 * re-marking already-delivered rows is a no-op.
 */
export async function markNotificationsDelivered(
 notificationIds: string[],
 destination: string,
 messageId: string | null,
 deliveredAt = new Date(),
 database: NotificationDeliveryDatabase = db
): Promise<void> {
 if (notificationIds.length === 0) {
  return;
 }

 const rows: InsertNotificationDelivery[] = notificationIds.map(
  (notificationId) => ({
   notificationId,
   destination,
   messageId,
   deliveredAt,
  })
 );

 await database.insert(notificationDeliveries).values(rows).onConflictDoNothing();
}
