"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationDeliveries = void 0;
const sqlite_core_1 = require("drizzle-orm/sqlite-core");
const schema_1 = require("./schema");
// ---------------------------------------------------------------------------
// Notification Deliveries (per-notification, per-destination sink tracking)
// ---------------------------------------------------------------------------
// `market_notifications.sent_at` / `message_id` remain the Root bot's state.
// Deliveries to other sinks (e.g. Discord) are tracked here so each
// destination can independently mark a notification as delivered.
exports.notificationDeliveries = (0, sqlite_core_1.sqliteTable)("notification_deliveries", {
    notificationId: (0, sqlite_core_1.text)("notification_id")
        .notNull()
        .references(() => schema_1.marketNotifications.id, { onDelete: "cascade" }),
    destination: (0, sqlite_core_1.text)("destination").notNull(),
    deliveredAt: (0, sqlite_core_1.integer)("delivered_at", { mode: "timestamp" }).notNull(),
    messageId: (0, sqlite_core_1.text)("message_id"),
}, (table) => ({
    notificationDestinationPk: (0, sqlite_core_1.primaryKey)({
        columns: [table.notificationId, table.destination],
    }),
}));
