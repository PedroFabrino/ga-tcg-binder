import { sql } from "drizzle-orm";
import {
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

/**
 * Which Root users have been seen in which community. Root identities are
 * global, so this mapping is what lets the Root bot API scope deal alerts (and
 * identity lookups) to the authenticated community instead of every install.
 */
export const rootCommunityIdentities = sqliteTable(
  "root_community_identities",
  {
    communityId: text("community_id").notNull(),
    providerUserId: text("provider_user_id").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.communityId, table.providerUserId] }),
  })
);

export type RootCommunityIdentityRow =
  typeof rootCommunityIdentities.$inferSelect;
