import { sqliteTable, text, integer, real, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { users, cards, cardEditions } from "./schema";

// ---------------------------------------------------------------------------
// Collector Identities (Chat platform bindings: Discord Snowflake / Root GUID)
// ---------------------------------------------------------------------------
export const collectorIdentities = sqliteTable(
  "collector_identities",
  {
    id: text("id").primaryKey(),
    collectorId: text("collector_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(), // 'discord' | 'root'
    providerUserId: text("provider_user_id").notNull(),
    providerUsername: text("provider_username"),
    wantlistNotificationsEnabled: integer("wantlist_notifications_enabled", { mode: "boolean" })
      .default(false)
      .notNull(),
    dealAlertMode: text("deal_alert_mode").default("all").notNull(), // 'all' | 'hard'
    linkedAt: integer("linked_at", { mode: "timestamp" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),
  },
  (table) => ({
    providerUserIdx: uniqueIndex("collector_identities_provider_user_idx").on(
      table.provider,
      table.providerUserId
    ),
  })
);

// ---------------------------------------------------------------------------
// Collector Pairing Tokens (Ephemeral 6-digit pairing codes with 10-min TTL)
// ---------------------------------------------------------------------------
export const collectorPairingTokens = sqliteTable(
  "collector_pairing_tokens",
  {
    id: text("id").primaryKey(),
    collectorId: text("collector_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    usedAt: integer("used_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),
  }
);

// ---------------------------------------------------------------------------
// Collector Wants (Direct Wishlist / Ad-hoc personal want cards)
// ---------------------------------------------------------------------------
export const collectorWants = sqliteTable(
  "collector_wants",
  {
    id: text("id").primaryKey(),
    collectorId: text("collector_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    cardSlug: text("card_slug")
      .notNull()
      .references(() => cards.slug, { onDelete: "cascade" }),
    editionId: text("edition_id")
      .references(() => cardEditions.id, { onDelete: "set null" }),
    desiredQuantity: integer("desired_quantity").default(1).notNull(),
    foil: integer("foil", { mode: "boolean" }), // null = any, false = normal, true = foil
    targetMaxPrice: real("target_max_price"),
    source: text("source").default("manual").notNull(), // 'manual' | 'omnidex'
    createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),
    updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),
  },
  (table) => ({
    collectorWantUniqIdx: uniqueIndex("collector_wants_collector_card_edition_foil_idx").on(
      table.collectorId,
      table.cardSlug,
      table.editionId,
      table.foil
    ),
  })
);

export type CollectorIdentity = typeof collectorIdentities.$inferSelect;
export type InsertCollectorIdentity = typeof collectorIdentities.$inferInsert;
export type CollectorPairingToken = typeof collectorPairingTokens.$inferSelect;
export type InsertCollectorPairingToken = typeof collectorPairingTokens.$inferInsert;
export type CollectorWant = typeof collectorWants.$inferSelect;
export type InsertCollectorWant = typeof collectorWants.$inferInsert;

/** Deal-alert scope: "all" (hard + shared + wantlist) or "hard" (hard + wantlist). */
export type DealAlertMode = "all" | "hard";
