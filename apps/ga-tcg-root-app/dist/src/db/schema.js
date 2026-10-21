"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.shippingTickets = exports.fulfillmentOrderPrintings = exports.fulfillmentOrders = exports.mypWatchlist = exports.notificationDeliveries = exports.marketNotifications = exports.marketCards = exports.marketStores = exports.mypCards = exports.metaStaples = exports.metaArchetypes = exports.scannerSessions = exports.cardHashes = exports.friendLinks = exports.deckCards = exports.decks = exports.collectionItems = exports.cardCirculations = exports.cardEditions = exports.cards = exports.users = void 0;
const sqlite_core_1 = require("drizzle-orm/sqlite-core");
const drizzle_orm_1 = require("drizzle-orm");
// ---------------------------------------------------------------------------
// Users & Auth
// ---------------------------------------------------------------------------
exports.users = (0, sqlite_core_1.sqliteTable)("users", {
    id: (0, sqlite_core_1.text)("id").primaryKey(),
    name: (0, sqlite_core_1.text)("name"),
    email: (0, sqlite_core_1.text)("email").unique(),
    image: (0, sqlite_core_1.text)("image"),
    friendCode: (0, sqlite_core_1.text)("friend_code").unique().notNull(),
    locale: (0, sqlite_core_1.text)("locale").notNull().default("en"),
    lowPopThreshold: (0, sqlite_core_1.integer)("low_pop_threshold").notNull().default(1000),
    mypUsername: (0, sqlite_core_1.text)("myp_username"),
    watchlistPolicyHard: (0, sqlite_core_1.integer)("watchlist_policy_hard", { mode: "boolean" }).notNull().default(true),
    watchlistPolicyShared: (0, sqlite_core_1.integer)("watchlist_policy_shared", { mode: "boolean" }).notNull().default(false),
    watchlistPolicyStaples: (0, sqlite_core_1.integer)("watchlist_policy_staples", { mode: "boolean" }).notNull().default(false),
    mypLogin: (0, sqlite_core_1.text)("myp_login"),
    mypPasswordEncrypted: (0, sqlite_core_1.text)("myp_password_encrypted"),
    sellerModeEnabled: (0, sqlite_core_1.integer)("seller_mode_enabled", { mode: "boolean" }).notNull().default(false),
    mypAutoWatchlistEnabled: (0, sqlite_core_1.integer)("myp_auto_watchlist_enabled", { mode: "boolean" }).notNull().default(false),
    superfreteApiKeyEncrypted: (0, sqlite_core_1.text)("superfrete_api_key_encrypted"),
    shippingPackagePreset: (0, sqlite_core_1.text)("shipping_package_preset").notNull().default("standard-box"),
    shippingPackageHeight: (0, sqlite_core_1.real)("shipping_package_height").notNull().default(2),
    shippingPackageWidth: (0, sqlite_core_1.real)("shipping_package_width").notNull().default(21),
    shippingPackageLength: (0, sqlite_core_1.real)("shipping_package_length").notNull().default(30),
    shippingPackageBaseWeight: (0, sqlite_core_1.real)("shipping_package_base_weight").notNull().default(200),
    shippingPackageTapeWeight: (0, sqlite_core_1.real)("shipping_package_tape_weight").notNull().default(5),
    shippingCardWeight: (0, sqlite_core_1.real)("shipping_card_weight").notNull().default(3),
    slightlyOverpricedMultiplier: (0, sqlite_core_1.real)("slightly_overpriced_multiplier").notNull().default(1.2),
    heavilyOverpricedMultiplier: (0, sqlite_core_1.real)("heavily_overpriced_multiplier").notNull().default(2.0),
    watchlistSyncToken: (0, sqlite_core_1.text)("watchlist_sync_token"),
    createdAt: (0, sqlite_core_1.integer)("created_at", { mode: "timestamp" }).default((0, drizzle_orm_1.sql) `(strftime('%s', 'now'))`),
});
// ---------------------------------------------------------------------------
// Card Catalog (Synchronized from api.gatcg.com)
// ---------------------------------------------------------------------------
exports.cards = (0, sqlite_core_1.sqliteTable)("cards", {
    slug: (0, sqlite_core_1.text)("slug").primaryKey(),
    name: (0, sqlite_core_1.text)("name").notNull(),
    element: (0, sqlite_core_1.text)("element").notNull(), // NORM, FIRE, WATER, WIND, EARTH, etc.
    class: (0, sqlite_core_1.text)("class").notNull(), // WARRIOR, MAGE, etc.
    type: (0, sqlite_core_1.text)("type").notNull(), // CHAMPION, ACTION, ATTACK, ITEM, etc.
    subtypes: (0, sqlite_core_1.text)("subtypes").notNull().default("[]"), // JSON string array
    effect: (0, sqlite_core_1.text)("effect"),
    costReserve: (0, sqlite_core_1.integer)("cost_reserve"),
    costMemory: (0, sqlite_core_1.integer)("cost_memory"),
    level: (0, sqlite_core_1.integer)("level"),
    speed: (0, sqlite_core_1.integer)("speed", { mode: "boolean" }),
    createdAt: (0, sqlite_core_1.integer)("created_at", { mode: "timestamp" }).default((0, drizzle_orm_1.sql) `(strftime('%s', 'now'))`),
    updatedAt: (0, sqlite_core_1.integer)("updated_at", { mode: "timestamp" }).default((0, drizzle_orm_1.sql) `(strftime('%s', 'now'))`),
});
exports.cardEditions = (0, sqlite_core_1.sqliteTable)("card_editions", {
    id: (0, sqlite_core_1.text)("id").primaryKey(), // edition uuid
    cardSlug: (0, sqlite_core_1.text)("card_slug").notNull().references(() => exports.cards.slug, { onDelete: "cascade" }),
    setPrefix: (0, sqlite_core_1.text)("set_prefix").notNull(), // e.g. DOA, FTC, ALC, P24
    setName: (0, sqlite_core_1.text)("set_name").notNull(),
    collectorNumber: (0, sqlite_core_1.text)("collector_number").notNull(),
    rarity: (0, sqlite_core_1.integer)("rarity").notNull(),
    imageUrl: (0, sqlite_core_1.text)("image_url").notNull(),
});
exports.cardCirculations = (0, sqlite_core_1.sqliteTable)("card_circulations", {
    id: (0, sqlite_core_1.text)("id").primaryKey(), // circulation uuid
    editionId: (0, sqlite_core_1.text)("edition_id").notNull().references(() => exports.cardEditions.id, { onDelete: "cascade" }),
    kind: (0, sqlite_core_1.text)("kind").notNull(), // 'FOIL' | 'NONFOIL'
    population: (0, sqlite_core_1.integer)("population").notNull().default(0),
    foil: (0, sqlite_core_1.integer)("foil", { mode: "boolean" }).notNull().default(false),
    printing: (0, sqlite_core_1.integer)("printing", { mode: "boolean" }).notNull().default(false),
});
// ---------------------------------------------------------------------------
// User Collection Items
// ---------------------------------------------------------------------------
exports.collectionItems = (0, sqlite_core_1.sqliteTable)("collection_items", {
    id: (0, sqlite_core_1.text)("id").primaryKey(),
    userId: (0, sqlite_core_1.text)("user_id").notNull().references(() => exports.users.id, { onDelete: "cascade" }),
    editionId: (0, sqlite_core_1.text)("edition_id").notNull().references(() => exports.cardEditions.id, { onDelete: "cascade" }),
    foil: (0, sqlite_core_1.integer)("foil", { mode: "boolean" }).notNull().default(false),
    quantity: (0, sqlite_core_1.integer)("quantity").notNull().default(1),
    isDedicated: (0, sqlite_core_1.integer)("is_dedicated", { mode: "boolean" }).notNull().default(false),
    createdAt: (0, sqlite_core_1.integer)("created_at", { mode: "timestamp" }).default((0, drizzle_orm_1.sql) `(strftime('%s', 'now'))`),
    updatedAt: (0, sqlite_core_1.integer)("updated_at", { mode: "timestamp" }).default((0, drizzle_orm_1.sql) `(strftime('%s', 'now'))`),
}, (table) => ({
    userEditionFoilIdx: (0, sqlite_core_1.uniqueIndex)("user_edition_foil_idx").on(table.userId, table.editionId, table.foil),
}));
// ---------------------------------------------------------------------------
// Decks & Deck Cards
// ---------------------------------------------------------------------------
exports.decks = (0, sqlite_core_1.sqliteTable)("decks", {
    id: (0, sqlite_core_1.text)("id").primaryKey(),
    userId: (0, sqlite_core_1.text)("user_id").notNull().references(() => exports.users.id, { onDelete: "cascade" }),
    name: (0, sqlite_core_1.text)("name").notNull(),
    champion: (0, sqlite_core_1.text)("champion"),
    format: (0, sqlite_core_1.text)("format").notNull().default("standard"),
    isPublic: (0, sqlite_core_1.integer)("is_public", { mode: "boolean" }).notNull().default(false),
    createdAt: (0, sqlite_core_1.integer)("created_at", { mode: "timestamp" }).default((0, drizzle_orm_1.sql) `(strftime('%s', 'now'))`),
    updatedAt: (0, sqlite_core_1.integer)("updated_at", { mode: "timestamp" }).default((0, drizzle_orm_1.sql) `(strftime('%s', 'now'))`),
});
exports.deckCards = (0, sqlite_core_1.sqliteTable)("deck_cards", {
    id: (0, sqlite_core_1.text)("id").primaryKey(),
    deckId: (0, sqlite_core_1.text)("deck_id").notNull().references(() => exports.decks.id, { onDelete: "cascade" }),
    cardSlug: (0, sqlite_core_1.text)("card_slug").notNull().references(() => exports.cards.slug, { onDelete: "cascade" }),
    zone: (0, sqlite_core_1.text)("zone").notNull(), // 'main' | 'material' | 'side'
    quantity: (0, sqlite_core_1.integer)("quantity").notNull().default(1),
    assignedEditionId: (0, sqlite_core_1.text)("assigned_edition_id").references(() => exports.cardEditions.id, { onDelete: "set null" }),
});
// ---------------------------------------------------------------------------
// Social: Friend Links
// ---------------------------------------------------------------------------
exports.friendLinks = (0, sqlite_core_1.sqliteTable)("friend_links", {
    id: (0, sqlite_core_1.text)("id").primaryKey(),
    userId1: (0, sqlite_core_1.text)("user_id_1").notNull().references(() => exports.users.id, { onDelete: "cascade" }),
    userId2: (0, sqlite_core_1.text)("user_id_2").notNull().references(() => exports.users.id, { onDelete: "cascade" }),
    status: (0, sqlite_core_1.text)("status").notNull().default("accepted"), // 'pending' | 'accepted'
    createdAt: (0, sqlite_core_1.integer)("created_at", { mode: "timestamp" }).default((0, drizzle_orm_1.sql) `(strftime('%s', 'now'))`),
}, (table) => ({
    friendPairIdx: (0, sqlite_core_1.uniqueIndex)("friend_pair_idx").on(table.userId1, table.userId2),
}));
// ---------------------------------------------------------------------------
// Mobile Camera Scanner Sessions (QR Pairing)
// ---------------------------------------------------------------------------
exports.cardHashes = (0, sqlite_core_1.sqliteTable)("card_hashes", {
    editionId: (0, sqlite_core_1.text)("edition_id").primaryKey().references(() => exports.cardEditions.id, { onDelete: "cascade" }),
    phash: (0, sqlite_core_1.text)("phash").notNull(), // 64-bit dHash, 16 hex chars
    updatedAt: (0, sqlite_core_1.integer)("updated_at", { mode: "timestamp" }).default((0, drizzle_orm_1.sql) `(strftime('%s', 'now'))`),
});
exports.scannerSessions = (0, sqlite_core_1.sqliteTable)("scanner_sessions", {
    id: (0, sqlite_core_1.text)("id").primaryKey(),
    userId: (0, sqlite_core_1.text)("user_id").notNull().references(() => exports.users.id, { onDelete: "cascade" }),
    token: (0, sqlite_core_1.text)("token").unique().notNull(),
    status: (0, sqlite_core_1.text)("status").notNull().default("active"), // 'active' | 'completed' | 'expired'
    expiresAt: (0, sqlite_core_1.integer)("expires_at", { mode: "timestamp" }).notNull(),
    scannedPayload: (0, sqlite_core_1.text)("scanned_payload").notNull().default("[]"), // JSON string of detections
    createdAt: (0, sqlite_core_1.integer)("created_at", { mode: "timestamp" }).default((0, drizzle_orm_1.sql) `(strftime('%s', 'now'))`),
});
// ---------------------------------------------------------------------------
// Tournament Meta Archetypes & Decks (GrandArchiveStats integration)
// ---------------------------------------------------------------------------
exports.metaArchetypes = (0, sqlite_core_1.sqliteTable)("meta_archetypes", {
    id: (0, sqlite_core_1.text)("id").primaryKey(),
    name: (0, sqlite_core_1.text)("name").notNull(),
    tier: (0, sqlite_core_1.text)("tier").notNull().default("A"), // 'Tier 1' | 'Tier 2' | 'Tier 3' | 'Rogue' | 'S' | 'A' | 'B' | 'C'
    champion: (0, sqlite_core_1.text)("champion").notNull(),
    element: (0, sqlite_core_1.text)("element"), // e.g. 'Wind', 'Water', 'Fire'
    signatureCardImageUrl: (0, sqlite_core_1.text)("signature_card_image_url"),
    shareRate: (0, sqlite_core_1.text)("share_rate").notNull().default("0%"),
    winRate: (0, sqlite_core_1.text)("win_rate").notNull().default("50%"),
    deckCount: (0, sqlite_core_1.integer)("deck_count").default(0),
    decklist: (0, sqlite_core_1.text)("decklist").notNull(), // Omnidex text representation
    detailUrl: (0, sqlite_core_1.text)("detail_url"),
    sampleEventDeckUrl: (0, sqlite_core_1.text)("sample_event_deck_url"),
    sourceUrl: (0, sqlite_core_1.text)("source_url"),
    updatedAt: (0, sqlite_core_1.integer)("updated_at", { mode: "timestamp" }).default((0, drizzle_orm_1.sql) `(strftime('%s', 'now'))`),
});
// ---------------------------------------------------------------------------
// Format Meta Staples (GrandArchiveStats integration)
// ---------------------------------------------------------------------------
exports.metaStaples = (0, sqlite_core_1.sqliteTable)("meta_staples", {
    cardSlug: (0, sqlite_core_1.text)("card_slug").primaryKey().references(() => exports.cards.slug, { onDelete: "cascade" }),
    cardName: (0, sqlite_core_1.text)("card_name").notNull(),
    categories: (0, sqlite_core_1.text)("categories").notNull().default("[]"), // JSON string array of sections, e.g. ["Water Main Deck", "Sideboard Tech"]
    primaryCategory: (0, sqlite_core_1.text)("primary_category").notNull(),
    element: (0, sqlite_core_1.text)("element").notNull().default("NORM"),
    inclusionRate: (0, sqlite_core_1.text)("inclusion_rate").notNull().default("0%"), // e.g. "97.6%"
    avgCopies: (0, sqlite_core_1.text)("avg_copies").notNull().default("1.0"), // e.g. "3.9"
    recommendedCopies: (0, sqlite_core_1.integer)("recommended_copies").notNull().default(1),
    deckCount: (0, sqlite_core_1.integer)("deck_count").notNull().default(0),
    imageUrl: (0, sqlite_core_1.text)("image_url"),
    updatedAt: (0, sqlite_core_1.integer)("updated_at", { mode: "timestamp" }).default((0, drizzle_orm_1.sql) `(strftime('%s', 'now'))`),
});
// ---------------------------------------------------------------------------
// Marketplace Listings (MyPCards Integration)
// ---------------------------------------------------------------------------
exports.mypCards = (0, sqlite_core_1.sqliteTable)("myp_cards", {
    id: (0, sqlite_core_1.text)("id").primaryKey(),
    userId: (0, sqlite_core_1.text)("user_id").notNull().references(() => exports.users.id, { onDelete: "cascade" }),
    cardSlug: (0, sqlite_core_1.text)("card_slug").references(() => exports.cards.slug, { onDelete: "set null" }),
    editionId: (0, sqlite_core_1.text)("edition_id").references(() => exports.cardEditions.id, { onDelete: "set null" }),
    rawName: (0, sqlite_core_1.text)("raw_name").notNull(),
    cardName: (0, sqlite_core_1.text)("card_name").notNull(),
    setPrefix: (0, sqlite_core_1.text)("set_prefix").notNull(),
    quantity: (0, sqlite_core_1.integer)("quantity").notNull().default(1),
    price: (0, sqlite_core_1.text)("price").notNull().default("R$ 0,00"),
    quality: (0, sqlite_core_1.text)("quality").notNull().default("NM"),
    isFoil: (0, sqlite_core_1.integer)("is_foil", { mode: "boolean" }).notNull().default(false),
    mypItemId: (0, sqlite_core_1.text)("myp_item_id"),
    mypProductUrl: (0, sqlite_core_1.text)("myp_product_url"),
    updatedAt: (0, sqlite_core_1.integer)("updated_at", { mode: "timestamp" }).default((0, drizzle_orm_1.sql) `(strftime('%s', 'now'))`),
});
// ---------------------------------------------------------------------------
// Multi-Marketplace Stores Registry & Unified Listings (ADR 0015)
// ---------------------------------------------------------------------------
exports.marketStores = (0, sqlite_core_1.sqliteTable)("market_stores", {
    id: (0, sqlite_core_1.text)("id").primaryKey(), // e.g. 'myp', 'brandao'
    platform: (0, sqlite_core_1.text)("platform").notNull(), // 'myp' | 'liga_store'
    name: (0, sqlite_core_1.text)("name").notNull(),
    baseUrl: (0, sqlite_core_1.text)("base_url").notNull(),
    tcgId: (0, sqlite_core_1.text)("tcg_id"),
    enabled: (0, sqlite_core_1.integer)("enabled", { mode: "boolean" }).notNull().default(true),
    lastCount: (0, sqlite_core_1.integer)("last_count"),
    lastCountCheckedAt: (0, sqlite_core_1.integer)("last_count_checked_at", { mode: "timestamp" }),
    lastFullScanAt: (0, sqlite_core_1.integer)("last_full_scan_at", { mode: "timestamp" }),
    lastLatestCardRefId: (0, sqlite_core_1.text)("last_latest_card_ref_id"),
    lastNotifiedAt: (0, sqlite_core_1.integer)("last_notified_at", { mode: "timestamp" }),
    updatedAt: (0, sqlite_core_1.integer)("updated_at", { mode: "timestamp" }).default((0, drizzle_orm_1.sql) `(strftime('%s', 'now'))`),
});
exports.marketCards = (0, sqlite_core_1.sqliteTable)("market_cards", {
    id: (0, sqlite_core_1.text)("id").primaryKey(),
    storeId: (0, sqlite_core_1.text)("store_id").notNull().references(() => exports.marketStores.id, { onDelete: "cascade" }),
    cardSlug: (0, sqlite_core_1.text)("card_slug").references(() => exports.cards.slug, { onDelete: "set null" }),
    editionId: (0, sqlite_core_1.text)("edition_id").references(() => exports.cardEditions.id, { onDelete: "set null" }),
    rawName: (0, sqlite_core_1.text)("raw_name").notNull(),
    cardName: (0, sqlite_core_1.text)("card_name").notNull(),
    setPrefix: (0, sqlite_core_1.text)("set_prefix").notNull(),
    quantity: (0, sqlite_core_1.integer)("quantity").notNull().default(1),
    price: (0, sqlite_core_1.text)("price").notNull().default("R$ 0,00"),
    priceNumeric: (0, sqlite_core_1.real)("price_numeric").notNull().default(0),
    tcgPrice: (0, sqlite_core_1.text)("tcg_price"),
    tcgPriceNumeric: (0, sqlite_core_1.real)("tcg_price_numeric"),
    quality: (0, sqlite_core_1.text)("quality").notNull().default("NM"),
    isFoil: (0, sqlite_core_1.integer)("is_foil", { mode: "boolean" }).notNull().default(false),
    itemId: (0, sqlite_core_1.text)("item_id"),
    productUrl: (0, sqlite_core_1.text)("product_url"),
    vendorName: (0, sqlite_core_1.text)("vendor_name"),
    vendorUrl: (0, sqlite_core_1.text)("vendor_url"),
    firstSeenAt: (0, sqlite_core_1.integer)("first_seen_at", { mode: "timestamp" }).notNull().default((0, drizzle_orm_1.sql) `(strftime('%s', 'now'))`),
    lastSeenAt: (0, sqlite_core_1.integer)("last_seen_at", { mode: "timestamp" }).default((0, drizzle_orm_1.sql) `(strftime('%s', 'now'))`),
    updatedAt: (0, sqlite_core_1.integer)("updated_at", { mode: "timestamp" }).default((0, drizzle_orm_1.sql) `(strftime('%s', 'now'))`),
}, (table) => ({
    storeItemUnique: (0, sqlite_core_1.uniqueIndex)("market_cards_store_item_idx").on(table.storeId, table.itemId),
    storeCardSlugIdx: (0, sqlite_core_1.index)("market_cards_store_card_slug_idx").on(table.storeId, table.cardSlug),
    storeEditionIdx: (0, sqlite_core_1.index)("market_cards_store_edition_idx").on(table.storeId, table.editionId),
}));
exports.marketNotifications = (0, sqlite_core_1.sqliteTable)("market_notifications", {
    id: (0, sqlite_core_1.text)("id").primaryKey(),
    storeId: (0, sqlite_core_1.text)("store_id").notNull().references(() => exports.marketStores.id, { onDelete: "cascade" }),
    cardName: (0, sqlite_core_1.text)("card_name").notNull(),
    setPrefix: (0, sqlite_core_1.text)("set_prefix").notNull(),
    collectorNumber: (0, sqlite_core_1.text)("collector_number").notNull(),
    isFoil: (0, sqlite_core_1.integer)("is_foil", { mode: "boolean" }).notNull().default(false),
    price: (0, sqlite_core_1.text)("price").notNull(),
    refId: (0, sqlite_core_1.text)("ref_id").notNull(),
    imageUrl: (0, sqlite_core_1.text)("image_url"),
    detectedAt: (0, sqlite_core_1.integer)("detected_at", { mode: "timestamp" }).notNull(),
    sentAt: (0, sqlite_core_1.integer)("sent_at", { mode: "timestamp" }),
    messageId: (0, sqlite_core_1.text)("message_id"),
    createdAt: (0, sqlite_core_1.integer)("created_at", { mode: "timestamp" }).notNull().default((0, drizzle_orm_1.sql) `(strftime('%s', 'now'))`),
});
// Notification deliveries live in ./notification-delivery-schema to keep this file under 400 lines.
var notification_delivery_schema_1 = require("./notification-delivery-schema");
Object.defineProperty(exports, "notificationDeliveries", { enumerable: true, get: function () { return notification_delivery_schema_1.notificationDeliveries; } });
exports.mypWatchlist = (0, sqlite_core_1.sqliteTable)("myp_watchlist", {
    id: (0, sqlite_core_1.text)("id").primaryKey(),
    userId: (0, sqlite_core_1.text)("user_id").notNull().references(() => exports.users.id, { onDelete: "cascade" }),
    cardSlug: (0, sqlite_core_1.text)("card_slug").notNull(),
    cardName: (0, sqlite_core_1.text)("card_name").notNull(),
    editionSlug: (0, sqlite_core_1.text)("edition_slug").notNull(),
    collectorNumber: (0, sqlite_core_1.text)("collector_number").notNull(),
    mypItemId: (0, sqlite_core_1.text)("myp_item_id"),
    mypProductUrl: (0, sqlite_core_1.text)("myp_product_url"),
    mypWishlistItemId: (0, sqlite_core_1.text)("myp_wishlist_item_id"),
    targetQuantity: (0, sqlite_core_1.integer)("target_quantity").notNull().default(1),
    syncedQuantity: (0, sqlite_core_1.integer)("synced_quantity"),
    targetPriceBrl: (0, sqlite_core_1.real)("target_price_brl").notNull().default(1.00),
    status: (0, sqlite_core_1.text)("status").notNull().default("pending_add"), // 'watching' | 'pending_add' | 'pending_update' | 'pending_remove' | 'ignored'
    lastError: (0, sqlite_core_1.text)("last_error"),
    updatedAt: (0, sqlite_core_1.integer)("updated_at", { mode: "timestamp" }).default((0, drizzle_orm_1.sql) `(strftime('%s', 'now'))`),
}, (table) => ({
    userPrintingIdx: (0, sqlite_core_1.uniqueIndex)("myp_watchlist_user_printing_idx").on(table.userId, table.editionSlug, table.collectorNumber),
}));
exports.fulfillmentOrders = (0, sqlite_core_1.sqliteTable)("fulfillment_orders", {
    id: (0, sqlite_core_1.text)("id").primaryKey(),
    userId: (0, sqlite_core_1.text)("user_id").notNull().references(() => exports.users.id, { onDelete: "cascade" }),
    mypOrderId: (0, sqlite_core_1.text)("myp_order_id").notNull(),
    orderDate: (0, sqlite_core_1.text)("order_date").notNull(),
    buyerNick: (0, sqlite_core_1.text)("buyer_nick").notNull(),
    buyerFullName: (0, sqlite_core_1.text)("buyer_full_name").notNull(),
    buyerDocument: (0, sqlite_core_1.text)("buyer_document"),
    buyerStreet: (0, sqlite_core_1.text)("buyer_street").notNull(),
    buyerNumber: (0, sqlite_core_1.text)("buyer_number").notNull(),
    buyerComplement: (0, sqlite_core_1.text)("buyer_complement"),
    buyerDistrict: (0, sqlite_core_1.text)("buyer_district").notNull(),
    buyerCity: (0, sqlite_core_1.text)("buyer_city").notNull(),
    buyerStateAbbr: (0, sqlite_core_1.text)("buyer_state_abbr").notNull(),
    buyerPostalCode: (0, sqlite_core_1.text)("buyer_postal_code").notNull(),
    senderFullName: (0, sqlite_core_1.text)("sender_full_name").notNull(),
    senderDocument: (0, sqlite_core_1.text)("sender_document"),
    senderStreet: (0, sqlite_core_1.text)("sender_street").notNull(),
    senderNumber: (0, sqlite_core_1.text)("sender_number").notNull(),
    senderComplement: (0, sqlite_core_1.text)("sender_complement"),
    senderDistrict: (0, sqlite_core_1.text)("sender_district").notNull(),
    senderCity: (0, sqlite_core_1.text)("sender_city").notNull(),
    senderStateAbbr: (0, sqlite_core_1.text)("sender_state_abbr").notNull(),
    senderPostalCode: (0, sqlite_core_1.text)("sender_postal_code").notNull(),
    subtotalCents: (0, sqlite_core_1.integer)("subtotal_cents").notNull(),
    shippingCents: (0, sqlite_core_1.integer)("shipping_cents").notNull(),
    totalCents: (0, sqlite_core_1.integer)("total_cents").notNull(),
    shippingMethod: (0, sqlite_core_1.text)("shipping_method"),
    status: (0, sqlite_core_1.text)("status").notNull().default("open"), // 'open' | 'processed' | 'sent'
    isPhotographed: (0, sqlite_core_1.integer)("is_photographed", { mode: "boolean" }).notNull().default(false),
    shippingTicketId: (0, sqlite_core_1.text)("shipping_ticket_id"),
    mypConfirmedAt: (0, sqlite_core_1.text)("myp_confirmed_at"),
    importedAt: (0, sqlite_core_1.text)("imported_at").notNull(),
    createdAt: (0, sqlite_core_1.integer)("created_at", { mode: "timestamp" }).default((0, drizzle_orm_1.sql) `(strftime('%s', 'now'))`),
    updatedAt: (0, sqlite_core_1.integer)("updated_at", { mode: "timestamp" }).default((0, drizzle_orm_1.sql) `(strftime('%s', 'now'))`),
}, (table) => ({
    userOrderUnique: (0, sqlite_core_1.uniqueIndex)("fulfillment_orders_user_order_idx").on(table.userId, table.mypOrderId),
}));
exports.fulfillmentOrderPrintings = (0, sqlite_core_1.sqliteTable)("fulfillment_order_printings", {
    id: (0, sqlite_core_1.text)("id").primaryKey(),
    fulfillmentOrderId: (0, sqlite_core_1.text)("fulfillment_order_id").notNull().references(() => exports.fulfillmentOrders.id, { onDelete: "cascade" }),
    cardSlug: (0, sqlite_core_1.text)("card_slug"),
    cardName: (0, sqlite_core_1.text)("card_name").notNull(),
    element: (0, sqlite_core_1.text)("element").notNull().default("UNMATCHED"),
    setCode: (0, sqlite_core_1.text)("set_code"),
    collectorNumber: (0, sqlite_core_1.text)("collector_number"),
    condition: (0, sqlite_core_1.text)("condition").notNull().default("NM"),
    language: (0, sqlite_core_1.text)("language").notNull().default("EN"),
    isFoil: (0, sqlite_core_1.integer)("is_foil", { mode: "boolean" }).notNull().default(false),
    quantity: (0, sqlite_core_1.integer)("quantity").notNull().default(1),
    unitPriceBrl: (0, sqlite_core_1.text)("unit_price_brl").notNull().default("R$ 0,00"),
    mypCode: (0, sqlite_core_1.text)("myp_code").notNull(),
    imageUrl: (0, sqlite_core_1.text)("image_url"),
    createdAt: (0, sqlite_core_1.integer)("created_at", { mode: "timestamp" }).default((0, drizzle_orm_1.sql) `(strftime('%s', 'now'))`),
    updatedAt: (0, sqlite_core_1.integer)("updated_at", { mode: "timestamp" }).default((0, drizzle_orm_1.sql) `(strftime('%s', 'now'))`),
});
exports.shippingTickets = (0, sqlite_core_1.sqliteTable)("shipping_tickets", {
    id: (0, sqlite_core_1.text)("id").primaryKey(),
    userId: (0, sqlite_core_1.text)("user_id").notNull().references(() => exports.users.id, { onDelete: "cascade" }),
    superfreteOrderId: (0, sqlite_core_1.text)("superfrete_order_id").notNull(),
    buyerNick: (0, sqlite_core_1.text)("buyer_nick").notNull(),
    status: (0, sqlite_core_1.text)("status").notNull().default("pending"), // 'pending' | 'released' | 'posted' | 'unknown'
    carrier: (0, sqlite_core_1.text)("carrier").notNull(), // 'correios' | 'loggi' | 'jadlog' | 'outro'
    serviceCode: (0, sqlite_core_1.text)("service_code").notNull(),
    serviceName: (0, sqlite_core_1.text)("service_name").notNull(),
    quotedPriceCents: (0, sqlite_core_1.integer)("quoted_price_cents"),
    insuranceValueCents: (0, sqlite_core_1.integer)("insurance_value_cents").notNull(),
    trackingCode: (0, sqlite_core_1.text)("tracking_code"),
    printUrl: (0, sqlite_core_1.text)("print_url"),
    providerPayloadJson: (0, sqlite_core_1.text)("provider_payload_json"),
    synchronizedAt: (0, sqlite_core_1.text)("synchronized_at"),
    createdAt: (0, sqlite_core_1.integer)("created_at", { mode: "timestamp" }).default((0, drizzle_orm_1.sql) `(strftime('%s', 'now'))`),
    updatedAt: (0, sqlite_core_1.integer)("updated_at", { mode: "timestamp" }).default((0, drizzle_orm_1.sql) `(strftime('%s', 'now'))`),
}, (table) => ({
    userTicketUnique: (0, sqlite_core_1.uniqueIndex)("shipping_tickets_user_ticket_idx").on(table.userId, table.superfreteOrderId),
}));
__exportStar(require("./assistant-schema"), exports);
