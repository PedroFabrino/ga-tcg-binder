import { sql } from "drizzle-orm";
import {
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/**
 * One row per app install in a community. Holds the hash of the per-install
 * API token the Root bot uses to authenticate to the Root bot API. The raw
 * token is never stored; the bot keeps it in Root's per-install key-value
 * store (`dataStore.appData`).
 */
export const rootBotInstalls = sqliteTable(
  "root_bot_installs",
  {
    appId: text("app_id").notNull(),
    communityId: text("community_id").notNull(),
    tokenHash: text("token_hash").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
    revokedAt: integer("revoked_at", { mode: "timestamp" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.appId, table.communityId] }),
    tokenHashIdx: uniqueIndex("root_bot_installs_token_hash_idx").on(
      table.tokenHash
    ),
  })
);

export type RootBotInstallRow = typeof rootBotInstalls.$inferSelect;
export type InsertRootBotInstallRow = typeof rootBotInstalls.$inferInsert;
