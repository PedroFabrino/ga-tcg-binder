import { sqliteTable, text, integer, real, uniqueIndex, index } from "drizzle-orm/sqlite-core";
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
  watchlistPolicyHard: integer("watchlist_policy_hard", { mode: "boolean" }).notNull().default(true),
  watchlistPolicyShared: integer("watchlist_policy_shared", { mode: "boolean" }).notNull().default(false),
  watchlistPolicyStaples: integer("watchlist_policy_staples", { mode: "boolean" }).notNull().default(false),
  mypLogin: text("myp_login"),
  mypPasswordEncrypted: text("myp_password_encrypted"),
  mypAutoWatchlistEnabled: integer("myp_auto_watchlist_enabled", { mode: "boolean" }).notNull().default(false),
  superfreteApiKeyEncrypted: text("superfrete_api_key_encrypted"),
  slightlyOverpricedMultiplier: real("slightly_overpriced_multiplier").notNull().default(1.2),
  heavilyOverpricedMultiplier: real("heavily_overpriced_multiplier").notNull().default(2.0),
  watchlistSyncToken: text("watchlist_sync_token"),
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
  tier: text("tier").notNull().default("A"), // 'Tier 1' | 'Tier 2' | 'Tier 3' | 'Rogue' | 'S' | 'A' | 'B' | 'C'
  champion: text("champion").notNull(),
  element: text("element"), // e.g. 'Wind', 'Water', 'Fire'
  signatureCardImageUrl: text("signature_card_image_url"),
  shareRate: text("share_rate").notNull().default("0%"),
  winRate: text("win_rate").notNull().default("50%"),
  deckCount: integer("deck_count").default(0),
  decklist: text("decklist").notNull(), // Omnidex text representation
  detailUrl: text("detail_url"),
  sampleEventDeckUrl: text("sample_event_deck_url"),
  sourceUrl: text("source_url"),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),
});

// ---------------------------------------------------------------------------
// Format Meta Staples (GrandArchiveStats integration)
// ---------------------------------------------------------------------------
export const metaStaples = sqliteTable("meta_staples", {
  cardSlug: text("card_slug").primaryKey().references(() => cards.slug, { onDelete: "cascade" }),
  cardName: text("card_name").notNull(),
  categories: text("categories").notNull().default("[]"), // JSON string array of sections, e.g. ["Water Main Deck", "Sideboard Tech"]
  primaryCategory: text("primary_category").notNull(),
  element: text("element").notNull().default("NORM"),
  inclusionRate: text("inclusion_rate").notNull().default("0%"), // e.g. "97.6%"
  avgCopies: text("avg_copies").notNull().default("1.0"), // e.g. "3.9"
  recommendedCopies: integer("recommended_copies").notNull().default(1),
  deckCount: integer("deck_count").notNull().default(0),
  imageUrl: text("image_url"),
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

// ---------------------------------------------------------------------------
// Multi-Marketplace Stores Registry & Unified Listings (ADR 0015)
// ---------------------------------------------------------------------------
export const marketStores = sqliteTable("market_stores", {
  id: text("id").primaryKey(), // e.g. 'myp', 'brandao'
  platform: text("platform").notNull(), // 'myp' | 'liga_store'
  name: text("name").notNull(),
  baseUrl: text("base_url").notNull(),
  tcgId: text("tcg_id"),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  lastCount: integer("last_count"),
  lastCountCheckedAt: integer("last_count_checked_at", { mode: "timestamp" }),
  lastFullScanAt: integer("last_full_scan_at", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),
});

export const marketCards = sqliteTable(
  "market_cards",
  {
    id: text("id").primaryKey(),
    storeId: text("store_id")
      .notNull()
      .references(() => marketStores.id, { onDelete: "cascade" }),
    cardSlug: text("card_slug").references(() => cards.slug, { onDelete: "set null" }),
    editionId: text("edition_id").references(() => cardEditions.id, { onDelete: "set null" }),
    rawName: text("raw_name").notNull(),
    cardName: text("card_name").notNull(),
    setPrefix: text("set_prefix").notNull(),
    quantity: integer("quantity").notNull().default(1),
    price: text("price").notNull().default("R$ 0,00"),
    priceNumeric: real("price_numeric").notNull().default(0),
    tcgPrice: text("tcg_price"),
    tcgPriceNumeric: real("tcg_price_numeric"),
    quality: text("quality").notNull().default("NM"),
    isFoil: integer("is_foil", { mode: "boolean" }).notNull().default(false),
    itemId: text("item_id"),
    productUrl: text("product_url"),
    vendorName: text("vendor_name"),
    vendorUrl: text("vendor_url"),
    lastSeenAt: integer("last_seen_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),
    updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),
  },
  (table) => ({
    storeItemUnique: uniqueIndex("market_cards_store_item_idx").on(table.storeId, table.itemId),
    storeCardSlugIdx: index("market_cards_store_card_slug_idx").on(table.storeId, table.cardSlug),
    storeEditionIdx: index("market_cards_store_edition_idx").on(table.storeId, table.editionId),
  })
);

export type MarketStore = typeof marketStores.$inferSelect;
export type InsertMarketStore = typeof marketStores.$inferInsert;
export type MarketCard = typeof marketCards.$inferSelect;
export type InsertMarketCard = typeof marketCards.$inferInsert;

// ---------------------------------------------------------------------------
// Managed MyPCards Watchlist Ledger
// ---------------------------------------------------------------------------
export type WatchlistStatus =
  | "watching"
  | "pending_add"
  | "pending_update"
  | "pending_remove"
  | "ignored";

export const mypWatchlist = sqliteTable("myp_watchlist", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  cardSlug: text("card_slug").notNull(),
  cardName: text("card_name").notNull(),
  editionSlug: text("edition_slug").notNull(),
  collectorNumber: text("collector_number").notNull(),
  mypItemId: text("myp_item_id"),
  mypProductUrl: text("myp_product_url"),
  mypWishlistItemId: text("myp_wishlist_item_id"),
  targetQuantity: integer("target_quantity").notNull().default(1),
  syncedQuantity: integer("synced_quantity"),
  targetPriceBrl: real("target_price_brl").notNull().default(1.00),
  status: text("status").notNull().default("pending_add"), // 'watching' | 'pending_add' | 'pending_update' | 'pending_remove' | 'ignored'
  lastError: text("last_error"),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
  userPrintingIdx: uniqueIndex("myp_watchlist_user_printing_idx").on(table.userId, table.editionSlug, table.collectorNumber),
}));

// ---------------------------------------------------------------------------
// Order Fulfillment & Superfrete Shipping Tickets
// ---------------------------------------------------------------------------
export type FulfillmentOrderStatus = "open" | "processed" | "sent";
export type ShippingTicketStatus = "pending" | "released" | "posted" | "unknown";
export type CarrierCode = "correios" | "loggi" | "jadlog" | "outro";

export const fulfillmentOrders = sqliteTable("fulfillment_orders", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  mypOrderId: text("myp_order_id").notNull(),
  orderDate: text("order_date").notNull(),
  buyerNick: text("buyer_nick").notNull(),
  buyerFullName: text("buyer_full_name").notNull(),
  buyerDocument: text("buyer_document"),
  buyerStreet: text("buyer_street").notNull(),
  buyerNumber: text("buyer_number").notNull(),
  buyerComplement: text("buyer_complement"),
  buyerDistrict: text("buyer_district").notNull(),
  buyerCity: text("buyer_city").notNull(),
  buyerStateAbbr: text("buyer_state_abbr").notNull(),
  buyerPostalCode: text("buyer_postal_code").notNull(),
  senderFullName: text("sender_full_name").notNull(),
  senderDocument: text("sender_document"),
  senderStreet: text("sender_street").notNull(),
  senderNumber: text("sender_number").notNull(),
  senderComplement: text("sender_complement"),
  senderDistrict: text("sender_district").notNull(),
  senderCity: text("sender_city").notNull(),
  senderStateAbbr: text("sender_state_abbr").notNull(),
  senderPostalCode: text("sender_postal_code").notNull(),
  subtotalCents: integer("subtotal_cents").notNull(),
  shippingCents: integer("shipping_cents").notNull(),
  totalCents: integer("total_cents").notNull(),
  shippingMethod: text("shipping_method"),
  status: text("status").notNull().default("open"), // 'open' | 'processed' | 'sent'
  isPhotographed: integer("is_photographed", { mode: "boolean" }).notNull().default(false),
  shippingTicketId: text("shipping_ticket_id"),
  mypConfirmedAt: text("myp_confirmed_at"),
  importedAt: text("imported_at").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
  userOrderUnique: uniqueIndex("fulfillment_orders_user_order_idx").on(table.userId, table.mypOrderId),
}));

export const fulfillmentOrderPrintings = sqliteTable("fulfillment_order_printings", {
  id: text("id").primaryKey(),
  fulfillmentOrderId: text("fulfillment_order_id").notNull().references(() => fulfillmentOrders.id, { onDelete: "cascade" }),
  cardSlug: text("card_slug"),
  cardName: text("card_name").notNull(),
  element: text("element").notNull().default("UNMATCHED"),
  setCode: text("set_code"),
  collectorNumber: text("collector_number"),
  condition: text("condition").notNull().default("NM"),
  language: text("language").notNull().default("EN"),
  isFoil: integer("is_foil", { mode: "boolean" }).notNull().default(false),
  quantity: integer("quantity").notNull().default(1),
  unitPriceBrl: text("unit_price_brl").notNull().default("R$ 0,00"),
  mypCode: text("myp_code").notNull(),
  imageUrl: text("image_url"),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),
});

export const shippingTickets = sqliteTable("shipping_tickets", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  superfreteOrderId: text("superfrete_order_id").notNull(),
  buyerNick: text("buyer_nick").notNull(),
  status: text("status").notNull().default("pending"), // 'pending' | 'released' | 'posted' | 'unknown'
  carrier: text("carrier").notNull(), // 'correios' | 'loggi' | 'jadlog' | 'outro'
  serviceCode: text("service_code").notNull(),
  serviceName: text("service_name").notNull(),
  quotedPriceCents: integer("quoted_price_cents"),
  insuranceValueCents: integer("insurance_value_cents").notNull(),
  trackingCode: text("tracking_code"),
  printUrl: text("print_url"),
  providerPayloadJson: text("provider_payload_json"),
  synchronizedAt: text("synchronized_at"),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
  userTicketUnique: uniqueIndex("shipping_tickets_user_ticket_idx").on(table.userId, table.superfreteOrderId),
}));


