import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Users & Auth
// ---------------------------------------------------------------------------
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name"),
  email: text("email").unique(),
  image: text("image"),
  friendCode: text("friend_code").unique().notNull(),
  lowPopThreshold: integer("low_pop_threshold").notNull().default(1000),
  mypUsername: text("myp_username"),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),
});

// ---------------------------------------------------------------------------
// Card Catalog (Synchronized from api.gatcg.com)
// ---------------------------------------------------------------------------
export const cards = sqliteTable("cards", {
  slug: text("slug").primaryKey(),
  name: text("name").notNull(),
  element: text("element").notNull(), // NORM, FIRE, WATER, WIND, EARTH, etc.
  class: text("class").notNull(), // WARRIOR, MAGE, etc.
  type: text("type").notNull(), // CHAMPION, ACTION, ATTACK, ITEM, etc.
  subtypes: text("subtypes").notNull().default("[]"), // JSON string array
  effect: text("effect"),
  costReserve: integer("cost_reserve"),
  costMemory: integer("cost_memory"),
  level: integer("level"),
  speed: integer("speed", { mode: "boolean" }),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),
});

export const cardEditions = sqliteTable("card_editions", {
  id: text("id").primaryKey(), // edition uuid
  cardSlug: text("card_slug").notNull().references(() => cards.slug, { onDelete: "cascade" }),
  setPrefix: text("set_prefix").notNull(), // e.g. DOA, FTC, ALC, P24
  setName: text("set_name").notNull(),
  collectorNumber: text("collector_number").notNull(),
  rarity: integer("rarity").notNull(),
  imageUrl: text("image_url").notNull(),
});

export const cardCirculations = sqliteTable("card_circulations", {
  id: text("id").primaryKey(), // circulation uuid
  editionId: text("edition_id").notNull().references(() => cardEditions.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // 'FOIL' | 'NONFOIL'
  population: integer("population").notNull().default(0),
  foil: integer("foil", { mode: "boolean" }).notNull().default(false),
  printing: integer("printing", { mode: "boolean" }).notNull().default(false),
});

// ---------------------------------------------------------------------------
// User Collection Items
// ---------------------------------------------------------------------------
export const collectionItems = sqliteTable("collection_items", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  editionId: text("edition_id").notNull().references(() => cardEditions.id, { onDelete: "cascade" }),
  foil: integer("foil", { mode: "boolean" }).notNull().default(false),
  quantity: integer("quantity").notNull().default(1),
  isDedicated: integer("is_dedicated", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
  userEditionFoilIdx: uniqueIndex("user_edition_foil_idx").on(table.userId, table.editionId, table.foil),
}));

// ---------------------------------------------------------------------------
// Decks & Deck Cards
// ---------------------------------------------------------------------------
export const decks = sqliteTable("decks", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  champion: text("champion"),
  format: text("format").notNull().default("standard"),
  isPublic: integer("is_public", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),
});

export const deckCards = sqliteTable("deck_cards", {
  id: text("id").primaryKey(),
  deckId: text("deck_id").notNull().references(() => decks.id, { onDelete: "cascade" }),
  cardSlug: text("card_slug").notNull().references(() => cards.slug, { onDelete: "cascade" }),
  zone: text("zone").notNull(), // 'main' | 'material' | 'side'
  quantity: integer("quantity").notNull().default(1),
  assignedEditionId: text("assigned_edition_id").references(() => cardEditions.id, { onDelete: "set null" }),
});

// ---------------------------------------------------------------------------
// Social: Friend Links
// ---------------------------------------------------------------------------
export const friendLinks = sqliteTable("friend_links", {
  id: text("id").primaryKey(),
  userId1: text("user_id_1").notNull().references(() => users.id, { onDelete: "cascade" }),
  userId2: text("user_id_2").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("accepted"), // 'pending' | 'accepted'
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
  friendPairIdx: uniqueIndex("friend_pair_idx").on(table.userId1, table.userId2),
}));

// ---------------------------------------------------------------------------
// Mobile Camera Scanner Sessions (QR Pairing)
// ---------------------------------------------------------------------------
export const cardHashes = sqliteTable("card_hashes", {
  editionId: text("edition_id").primaryKey().references(() => cardEditions.id, { onDelete: "cascade" }),
  phash: text("phash").notNull(), // 64-bit dHash, 16 hex chars
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),
});

export const scannerSessions = sqliteTable("scanner_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").unique().notNull(),
  status: text("status").notNull().default("active"), // 'active' | 'completed' | 'expired'
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  scannedPayload: text("scanned_payload").notNull().default("[]"), // JSON string of detections
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),
});

// ---------------------------------------------------------------------------
// Tournament Meta Archetypes & Decks (GrandArchiveStats integration)
// ---------------------------------------------------------------------------
export const metaArchetypes = sqliteTable("meta_archetypes", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  tier: text("tier").notNull().default("A"), // 'S' | 'A' | 'B' | 'C'
  champion: text("champion").notNull(),
  shareRate: text("share_rate").notNull().default("0%"),
  winRate: text("win_rate").notNull().default("50%"),
  decklist: text("decklist").notNull(), // Omnidex text representation
  sourceUrl: text("source_url"),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),
});

// ---------------------------------------------------------------------------
// Marketplace Listings (MyPCards Integration)
// ---------------------------------------------------------------------------
export const mypCards = sqliteTable("myp_cards", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  cardSlug: text("card_slug").references(() => cards.slug, { onDelete: "set null" }),
  editionId: text("edition_id").references(() => cardEditions.id, { onDelete: "set null" }),
  rawName: text("raw_name").notNull(),
  cardName: text("card_name").notNull(),
  setPrefix: text("set_prefix").notNull(),
  quantity: integer("quantity").notNull().default(1),
  price: text("price").notNull().default("R$ 0,00"),
  quality: text("quality").notNull().default("NM"),
  isFoil: integer("is_foil", { mode: "boolean" }).notNull().default(false),
  mypItemId: text("myp_item_id"),
  mypProductUrl: text("myp_product_url"),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),
});

