import { sqliteTable, text, integer, uniqueIndex, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Featured Set Groups & Set Definitions
// Must be in a separate file to keep schema.ts under 400 lines.
// ---------------------------------------------------------------------------

export const featuredSetGroups = sqliteTable(
  "featured_set_groups",
  {
    uuid: text("uuid").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    imageUrl: text("image_url"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),
    updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),
  },
  (table) => ({
    slugUnique: uniqueIndex("idx_featured_set_groups_slug").on(table.slug),
  }),
);

export type FeaturedSetGroup = typeof featuredSetGroups.$inferSelect;
export type InsertFeaturedSetGroup = typeof featuredSetGroups.$inferInsert;

export const setDefinitions = sqliteTable(
  "set_definitions",
  {
    id: text("id").primaryKey(),
    groupUuid: text("group_uuid")
      .notNull()
      .references(() => featuredSetGroups.uuid, { onDelete: "cascade" }),
    prefix: text("prefix").notNull(),
    name: text("name").notNull(),
    language: text("language").notNull().default("EN"),
    releaseDate: text("release_date"),
    createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),
    updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),
  },
  (table) => ({
    groupUuidIdx: index("idx_set_definitions_group_uuid").on(table.groupUuid),
    prefixIdx: index("idx_set_definitions_prefix").on(table.prefix),
  }),
);

export type SetDefinition = typeof setDefinitions.$inferSelect;
export type InsertSetDefinition = typeof setDefinitions.$inferInsert;
