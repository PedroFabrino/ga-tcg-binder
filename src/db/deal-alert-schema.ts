import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Tracks the single rolling deal-alert DM per Discord user so the bot can
 * delete the previous snapshot before sending an updated one. `lastListingKeys`
 * holds a JSON array of the listing identities shown in the last snapshot and is
 * used to detect whether new matching listings have appeared.
 */
export const dealAlertMessages = sqliteTable("deal_alert_messages", {
  discordUserId: text("discord_user_id").primaryKey(),
  channelId: text("channel_id").notNull(),
  messageId: text("message_id").notNull(),
  lastListingKeys: text("last_listing_keys").notNull().default("[]"),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
});

export type DealAlertMessageRow = typeof dealAlertMessages.$inferSelect;
export type InsertDealAlertMessageRow = typeof dealAlertMessages.$inferInsert;
