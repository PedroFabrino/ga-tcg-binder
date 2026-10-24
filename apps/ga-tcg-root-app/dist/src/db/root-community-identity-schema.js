"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rootCommunityIdentities = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const sqlite_core_1 = require("drizzle-orm/sqlite-core");
/**
 * Which Root users have been seen in which community. Root identities are
 * global, so this mapping is what lets the Root bot API scope deal alerts (and
 * identity lookups) to the authenticated community instead of every install.
 */
exports.rootCommunityIdentities = (0, sqlite_core_1.sqliteTable)("root_community_identities", {
    communityId: (0, sqlite_core_1.text)("community_id").notNull(),
    providerUserId: (0, sqlite_core_1.text)("provider_user_id").notNull(),
    createdAt: (0, sqlite_core_1.integer)("created_at", { mode: "timestamp" })
        .notNull()
        .default((0, drizzle_orm_1.sql) `(strftime('%s', 'now'))`),
}, (table) => ({
    pk: (0, sqlite_core_1.primaryKey)({ columns: [table.communityId, table.providerUserId] }),
}));
