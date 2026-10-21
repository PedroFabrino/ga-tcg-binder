import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { users } from "./schema";

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

export type CollectorIdentity = typeof collectorIdentities.$inferSelect;
export type InsertCollectorIdentity = typeof collectorIdentities.$inferInsert;
export type CollectorPairingToken = typeof collectorPairingTokens.$inferSelect;
export type InsertCollectorPairingToken = typeof collectorPairingTokens.$inferInsert;
