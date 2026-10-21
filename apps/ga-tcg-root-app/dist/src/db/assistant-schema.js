"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.collectorPairingTokens = exports.collectorIdentities = void 0;
const sqlite_core_1 = require("drizzle-orm/sqlite-core");
const drizzle_orm_1 = require("drizzle-orm");
const schema_1 = require("./schema");
// ---------------------------------------------------------------------------
// Collector Identities (Chat platform bindings: Discord Snowflake / Root GUID)
// ---------------------------------------------------------------------------
exports.collectorIdentities = (0, sqlite_core_1.sqliteTable)("collector_identities", {
    id: (0, sqlite_core_1.text)("id").primaryKey(),
    collectorId: (0, sqlite_core_1.text)("collector_id")
        .notNull()
        .references(() => schema_1.users.id, { onDelete: "cascade" }),
    provider: (0, sqlite_core_1.text)("provider").notNull(), // 'discord' | 'root'
    providerUserId: (0, sqlite_core_1.text)("provider_user_id").notNull(),
    providerUsername: (0, sqlite_core_1.text)("provider_username"),
    linkedAt: (0, sqlite_core_1.integer)("linked_at", { mode: "timestamp" }).notNull(),
    createdAt: (0, sqlite_core_1.integer)("created_at", { mode: "timestamp" }).default((0, drizzle_orm_1.sql) `(strftime('%s', 'now'))`),
}, (table) => ({
    providerUserIdx: (0, sqlite_core_1.uniqueIndex)("collector_identities_provider_user_idx").on(table.provider, table.providerUserId),
}));
// ---------------------------------------------------------------------------
// Collector Pairing Tokens (Ephemeral 6-digit pairing codes with 10-min TTL)
// ---------------------------------------------------------------------------
exports.collectorPairingTokens = (0, sqlite_core_1.sqliteTable)("collector_pairing_tokens", {
    id: (0, sqlite_core_1.text)("id").primaryKey(),
    collectorId: (0, sqlite_core_1.text)("collector_id")
        .notNull()
        .references(() => schema_1.users.id, { onDelete: "cascade" }),
    token: (0, sqlite_core_1.text)("token").notNull().unique(),
    expiresAt: (0, sqlite_core_1.integer)("expires_at", { mode: "timestamp" }).notNull(),
    usedAt: (0, sqlite_core_1.integer)("used_at", { mode: "timestamp" }),
    createdAt: (0, sqlite_core_1.integer)("created_at", { mode: "timestamp" }).default((0, drizzle_orm_1.sql) `(strftime('%s', 'now'))`),
});
