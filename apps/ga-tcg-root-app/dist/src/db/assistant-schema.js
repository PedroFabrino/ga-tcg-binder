"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.collectorWants = exports.collectorPairingTokens = exports.collectorIdentities = void 0;
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
    wantlistNotificationsEnabled: (0, sqlite_core_1.integer)("wantlist_notifications_enabled", { mode: "boolean" })
        .default(false)
        .notNull(),
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
// ---------------------------------------------------------------------------
// Collector Wants (Direct Wishlist / Ad-hoc personal want cards)
// ---------------------------------------------------------------------------
exports.collectorWants = (0, sqlite_core_1.sqliteTable)("collector_wants", {
    id: (0, sqlite_core_1.text)("id").primaryKey(),
    collectorId: (0, sqlite_core_1.text)("collector_id")
        .notNull()
        .references(() => schema_1.users.id, { onDelete: "cascade" }),
    cardSlug: (0, sqlite_core_1.text)("card_slug")
        .notNull()
        .references(() => schema_1.cards.slug, { onDelete: "cascade" }),
    editionId: (0, sqlite_core_1.text)("edition_id")
        .references(() => schema_1.cardEditions.id, { onDelete: "set null" }),
    desiredQuantity: (0, sqlite_core_1.integer)("desired_quantity").default(1).notNull(),
    foil: (0, sqlite_core_1.integer)("foil", { mode: "boolean" }), // null = any, false = normal, true = foil
    targetMaxPrice: (0, sqlite_core_1.real)("target_max_price"),
    source: (0, sqlite_core_1.text)("source").default("manual").notNull(), // 'manual' | 'omnidex'
    createdAt: (0, sqlite_core_1.integer)("created_at", { mode: "timestamp" }).default((0, drizzle_orm_1.sql) `(strftime('%s', 'now'))`),
    updatedAt: (0, sqlite_core_1.integer)("updated_at", { mode: "timestamp" }).default((0, drizzle_orm_1.sql) `(strftime('%s', 'now'))`),
}, (table) => ({
    collectorWantUniqIdx: (0, sqlite_core_1.uniqueIndex)("collector_wants_collector_card_edition_foil_idx").on(table.collectorId, table.cardSlug, table.editionId, table.foil),
}));
