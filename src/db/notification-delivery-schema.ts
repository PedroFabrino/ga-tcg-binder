import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { marketNotifications } from "./schema";

// ---------------------------------------------------------------------------
// Notification Deliveries (per-notification, per-destination sink tracking)
// ---------------------------------------------------------------------------
// `market_notifications.sent_at` / `message_id` remain the Root bot's state.
// Deliveries to other sinks (e.g. Discord) are tracked here so each
// destination can independently mark a notification as delivered.
export const notificationDeliveries = sqliteTable(
 "notification_deliveries",
 {
  notificationId: text("notification_id")
   .notNull()
   .references(() => marketNotifications.id, { onDelete: "cascade" }),
  destination: text("destination").notNull(),
  deliveredAt: integer("delivered_at", { mode: "timestamp" }).notNull(),
  messageId: text("message_id"),
 },
 (table) => ({
  notificationDestinationPk: primaryKey({
   columns: [table.notificationId, table.destination],
  }),
 })
);

export type NotificationDelivery = typeof notificationDeliveries.$inferSelect;
export type InsertNotificationDelivery = typeof notificationDeliveries.$inferInsert;
