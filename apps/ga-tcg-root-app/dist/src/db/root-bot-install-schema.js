"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rootBotInstalls = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const sqlite_core_1 = require("drizzle-orm/sqlite-core");
/**
 * One row per app install in a community. Holds the hash of the per-install
 * API token the Root bot uses to authenticate to the Root bot API. The raw
 * token is never stored; the bot keeps it in Root's per-install key-value
 * store (`dataStore.appData`).
 */
exports.rootBotInstalls = (0, sqlite_core_1.sqliteTable)("root_bot_installs", {
    appId: (0, sqlite_core_1.text)("app_id").notNull(),
    communityId: (0, sqlite_core_1.text)("community_id").notNull(),
    tokenHash: (0, sqlite_core_1.text)("token_hash").notNull(),
    createdAt: (0, sqlite_core_1.integer)("created_at", { mode: "timestamp" })
        .notNull()
        .default((0, drizzle_orm_1.sql) `(strftime('%s', 'now'))`),
    revokedAt: (0, sqlite_core_1.integer)("revoked_at", { mode: "timestamp" }),
}, (table) => ({
    pk: (0, sqlite_core_1.primaryKey)({ columns: [table.appId, table.communityId] }),
    tokenHashIdx: (0, sqlite_core_1.uniqueIndex)("root_bot_installs_token_hash_idx").on(table.tokenHash),
}));
