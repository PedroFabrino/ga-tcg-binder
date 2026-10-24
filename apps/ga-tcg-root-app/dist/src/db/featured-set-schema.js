"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setDefinitions = exports.featuredSetGroups = void 0;
const sqlite_core_1 = require("drizzle-orm/sqlite-core");
const drizzle_orm_1 = require("drizzle-orm");
// ---------------------------------------------------------------------------
// Featured Set Groups & Set Definitions
// Must be in a separate file to keep schema.ts under 400 lines.
// ---------------------------------------------------------------------------
exports.featuredSetGroups = (0, sqlite_core_1.sqliteTable)("featured_set_groups", {
    uuid: (0, sqlite_core_1.text)("uuid").primaryKey(),
    name: (0, sqlite_core_1.text)("name").notNull(),
    slug: (0, sqlite_core_1.text)("slug").notNull(),
    imageUrl: (0, sqlite_core_1.text)("image_url").notNull().default(""),
    sortOrder: (0, sqlite_core_1.integer)("sort_order").notNull().default(0),
    createdAt: (0, sqlite_core_1.integer)("created_at", { mode: "timestamp" }).default((0, drizzle_orm_1.sql) `(strftime('%s', 'now'))`),
    updatedAt: (0, sqlite_core_1.integer)("updated_at", { mode: "timestamp" }).default((0, drizzle_orm_1.sql) `(strftime('%s', 'now'))`),
}, (table) => ({
    slugUnique: (0, sqlite_core_1.uniqueIndex)("idx_featured_set_groups_slug").on(table.slug),
}));
exports.setDefinitions = (0, sqlite_core_1.sqliteTable)("set_definitions", {
    id: (0, sqlite_core_1.text)("id").primaryKey(),
    groupUuid: (0, sqlite_core_1.text)("group_uuid")
        .notNull()
        .references(() => exports.featuredSetGroups.uuid, { onDelete: "cascade" }),
    prefix: (0, sqlite_core_1.text)("prefix").notNull(),
    name: (0, sqlite_core_1.text)("name").notNull(),
    language: (0, sqlite_core_1.text)("language").notNull().default("EN"),
    releaseDate: (0, sqlite_core_1.text)("release_date").notNull().default(""),
    createdAt: (0, sqlite_core_1.integer)("created_at", { mode: "timestamp" }).default((0, drizzle_orm_1.sql) `(strftime('%s', 'now'))`),
    updatedAt: (0, sqlite_core_1.integer)("updated_at", { mode: "timestamp" }).default((0, drizzle_orm_1.sql) `(strftime('%s', 'now'))`),
}, (table) => ({
    groupUuidIdx: (0, sqlite_core_1.index)("idx_set_definitions_group_uuid").on(table.groupUuid),
    prefixIdx: (0, sqlite_core_1.index)("idx_set_definitions_prefix").on(table.prefix),
}));
