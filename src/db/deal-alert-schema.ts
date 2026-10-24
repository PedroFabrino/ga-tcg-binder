import { sql } from "drizzle-orm";
import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
export const dealAlertMessages = sqliteTable(
  "deal_alert_messages",
  {
    destination: text("destination").notNull(),
    recipientId: text("recipient_id").notNull(),
    channelId: text("channel_id").notNull(),
    messageId: text("message_id").notNull(),
    lastListingKeys: text("last_listing_keys").notNull().default("[]"),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
  },
  (table) => ({
    notificationDestinationPk: primaryKey({
      columns: [table.destination, table.recipientId],
    }),
  })
);

export type DealAlertMessageRow = typeof dealAlertMessages.$inferSelect;
export type InsertDealAlertMessageRow = typeof dealAlertMessages.$inferInsert;
