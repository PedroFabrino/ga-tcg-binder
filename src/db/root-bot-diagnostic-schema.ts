import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Startup/poll diagnostics written by the cloud bot. Root's pod log shipper is
 * unreliable, so the bot reports lifecycle stages here instead.
 */
export const rootBotDiagnostics = sqliteTable("root_bot_diagnostics", {
  id: text("id").primaryKey(),
  communityId: text("community_id").notNull(),
  stage: text("stage").notNull(),
  message: text("message"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
});

export type RootBotDiagnosticRow = typeof rootBotDiagnostics.$inferSelect;
