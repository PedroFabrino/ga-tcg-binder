"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dealAlertMessages = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const sqlite_core_1 = require("drizzle-orm/sqlite-core");
/**
 * Tracks the single rolling deal-alert message for one recipient on one
 * destination (Discord DM or a Root private channel) so the bot can delete or
 * replace the previous snapshot before sending an updated one. `lastListingKeys`
 * holds a JSON array of the listing identities shown in the last snapshot and is
 * used to detect whether the match list has changed.
 *
 * Keyed by `(destination, recipientId)` so a single table serves every platform:
 * `recipientId` is the Discord user id for `discord-dm` and the Root user id for
 * `root-alert`.
 */
exports.dealAlertMessages = (0, sqlite_core_1.sqliteTable)("deal_alert_messages", {
    destination: (0, sqlite_core_1.text)("destination").notNull(),
    recipientId: (0, sqlite_core_1.text)("recipient_id").notNull(),
    channelId: (0, sqlite_core_1.text)("channel_id").notNull(),
    messageId: (0, sqlite_core_1.text)("message_id").notNull(),
    lastListingKeys: (0, sqlite_core_1.text)("last_listing_keys").notNull().default("[]"),
    updatedAt: (0, sqlite_core_1.integer)("updated_at", { mode: "timestamp" })
        .notNull()
        .default((0, drizzle_orm_1.sql) `(strftime('%s', 'now'))`),
}, (table) => ({
    notificationDestinationPk: (0, sqlite_core_1.primaryKey)({
        columns: [table.destination, table.recipientId],
    }),
}));
