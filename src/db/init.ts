import fs from "fs";
import path from "path";
import { client } from "./index";

const EMBEDDED_MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS \`card_circulations\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`edition_id\` text NOT NULL,
	\`kind\` text NOT NULL,
	\`population\` integer DEFAULT 0 NOT NULL,
	\`foil\` integer DEFAULT false NOT NULL,
	\`printing\` integer DEFAULT false NOT NULL,
	FOREIGN KEY (\`edition_id\`) REFERENCES \`card_editions\`(\`id\`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS \`card_editions\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`card_slug\` text NOT NULL,
	\`set_prefix\` text NOT NULL,
	\`set_name\` text NOT NULL,
	\`collector_number\` text NOT NULL,
	\`rarity\` integer NOT NULL,
	\`image_url\` text NOT NULL,
	FOREIGN KEY (\`card_slug\`) REFERENCES \`cards\`(\`slug\`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS \`cards\` (
	\`slug\` text PRIMARY KEY NOT NULL,
	\`name\` text NOT NULL,
	\`element\` text NOT NULL,
	\`class\` text NOT NULL,
	\`type\` text NOT NULL,
	\`subtypes\` text DEFAULT '[]' NOT NULL,
	\`effect\` text,
	\`cost_reserve\` integer,
	\`cost_memory\` integer,
	\`level\` integer,
	\`speed\` integer,
	\`created_at\` integer DEFAULT (strftime('%s', 'now')),
	\`updated_at\` integer DEFAULT (strftime('%s', 'now'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS \`collection_items\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`user_id\` text NOT NULL,
	\`edition_id\` text NOT NULL,
	\`foil\` integer DEFAULT false NOT NULL,
	\`quantity\` integer DEFAULT 1 NOT NULL,
	\`is_dedicated\` integer DEFAULT false NOT NULL,
	\`created_at\` integer DEFAULT (strftime('%s', 'now')),
	\`updated_at\` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`edition_id\`) REFERENCES \`card_editions\`(\`id\`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS \`user_edition_foil_idx\` ON \`collection_items\` (\`user_id\`,\`edition_id\`,\`foil\`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS \`deck_cards\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`deck_id\` text NOT NULL,
	\`card_slug\` text NOT NULL,
	\`zone\` text NOT NULL,
	\`quantity\` integer DEFAULT 1 NOT NULL,
	\`assigned_edition_id\` text,
	FOREIGN KEY (\`deck_id\`) REFERENCES \`decks\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`card_slug\`) REFERENCES \`cards\`(\`slug\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`assigned_edition_id\`) REFERENCES \`card_editions\`(\`id\`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS \`decks\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`user_id\` text NOT NULL,
	\`name\` text NOT NULL,
	\`champion\` text,
	\`format\` text DEFAULT 'standard' NOT NULL,
	\`is_public\` integer DEFAULT false NOT NULL,
	\`created_at\` integer DEFAULT (strftime('%s', 'now')),
	\`updated_at\` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS \`friend_links\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`user_id_1\` text NOT NULL,
	\`user_id_2\` text NOT NULL,
	\`status\` text DEFAULT 'accepted' NOT NULL,
	\`created_at\` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (\`user_id_1\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`user_id_2\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS \`friend_pair_idx\` ON \`friend_links\` (\`user_id_1\`,\`user_id_2\`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS \`meta_archetypes\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`name\` text NOT NULL,
	\`tier\` text DEFAULT 'A' NOT NULL,
	\`champion\` text NOT NULL,
	\`element\` text,
	\`signature_card_image_url\` text,
	\`share_rate\` text DEFAULT '0%' NOT NULL,
	\`win_rate\` text DEFAULT '50%' NOT NULL,
	\`deck_count\` integer DEFAULT 0,
	\`decklist\` text NOT NULL,
	\`detail_url\` text,
	\`sample_event_deck_url\` text,
	\`source_url\` text,
	\`updated_at\` integer DEFAULT (strftime('%s', 'now'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS \`meta_staples\` (
	\`card_slug\` text PRIMARY KEY NOT NULL,
	\`card_name\` text NOT NULL,
	\`categories\` text DEFAULT '[]' NOT NULL,
	\`primary_category\` text NOT NULL,
	\`element\` text DEFAULT 'NORM' NOT NULL,
	\`inclusion_rate\` text DEFAULT '0%' NOT NULL,
	\`avg_copies\` text DEFAULT '1.0' NOT NULL,
	\`recommended_copies\` integer DEFAULT 1 NOT NULL,
	\`deck_count\` integer DEFAULT 0 NOT NULL,
	\`image_url\` text,
	\`updated_at\` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (\`card_slug\`) REFERENCES \`cards\`(\`slug\`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS \`card_hashes\` (
	\`edition_id\` text PRIMARY KEY NOT NULL,
	\`phash\` text NOT NULL,
	\`updated_at\` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (\`edition_id\`) REFERENCES \`card_editions\`(\`id\`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS \`scanner_sessions\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`user_id\` text NOT NULL,
	\`token\` text NOT NULL,
	\`status\` text DEFAULT 'active' NOT NULL,
	\`expires_at\` integer NOT NULL,
	\`scanned_payload\` text DEFAULT '[]' NOT NULL,
	\`created_at\` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS \`scanner_sessions_token_unique\` ON \`scanner_sessions\` (\`token\`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS \`users\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`name\` text,
	\`email\` text,
	\`image\` text,
	\`friend_code\` text NOT NULL,
	\`locale\` text DEFAULT 'en' NOT NULL,
	\`low_pop_threshold\` integer DEFAULT 1000 NOT NULL,
	\`myp_username\` text,
	\`created_at\` integer DEFAULT (strftime('%s', 'now'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS \`users_email_unique\` ON \`users\` (\`email\`);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS \`users_friend_code_unique\` ON \`users\` (\`friend_code\`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS \`myp_cards\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`user_id\` text NOT NULL,
	\`card_slug\` text,
	\`edition_id\` text,
	\`raw_name\` text NOT NULL,
	\`card_name\` text NOT NULL,
	\`set_prefix\` text NOT NULL,
	\`quantity\` integer DEFAULT 1 NOT NULL,
	\`price\` text DEFAULT 'R$ 0,00' NOT NULL,
	\`quality\` text DEFAULT 'NM' NOT NULL,
	\`is_foil\` integer DEFAULT false NOT NULL,
	\`myp_item_id\` text,
	\`myp_product_url\` text,
	\`updated_at\` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`card_slug\`) REFERENCES \`cards\`(\`slug\`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (\`edition_id\`) REFERENCES \`card_editions\`(\`id\`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS \`myp_market_cards\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`card_slug\` text,
	\`edition_id\` text,
	\`raw_name\` text NOT NULL,
	\`card_name\` text NOT NULL,
	\`set_prefix\` text NOT NULL,
	\`quantity\` integer DEFAULT 1 NOT NULL,
	\`price\` text DEFAULT 'R$ 0,00' NOT NULL,
	\`price_numeric\` real DEFAULT 0 NOT NULL,
	\`tcg_price\` text,
	\`tcg_price_numeric\` real,
	\`is_foil\` integer DEFAULT false NOT NULL,
	\`myp_item_id\` text,
	\`myp_product_url\` text,
	\`vendor_name\` text,
	\`vendor_url\` text,
	\`updated_at\` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (\`card_slug\`) REFERENCES \`cards\`(\`slug\`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (\`edition_id\`) REFERENCES \`card_editions\`(\`id\`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS \`myp_watchlist\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`user_id\` text NOT NULL,
	\`card_slug\` text NOT NULL,
	\`card_name\` text NOT NULL,
	\`edition_slug\` text NOT NULL,
	\`collector_number\` text NOT NULL,
	\`myp_item_id\` text,
	\`myp_product_url\` text,
	\`target_quantity\` integer DEFAULT 1 NOT NULL,
	\`target_price_brl\` real DEFAULT 1.0 NOT NULL,
	\`status\` text DEFAULT 'pending_add' NOT NULL,
	\`last_error\` text,
	\`updated_at\` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS \`myp_watchlist_user_printing_idx\` ON \`myp_watchlist\` (\`user_id\`,\`edition_slug\`,\`collector_number\`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS \`fulfillment_orders\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`user_id\` text NOT NULL,
	\`myp_order_id\` text NOT NULL,
	\`order_date\` text NOT NULL,
	\`buyer_nick\` text NOT NULL,
	\`buyer_full_name\` text NOT NULL,
	\`buyer_document\` text,
	\`buyer_street\` text NOT NULL,
	\`buyer_number\` text NOT NULL,
	\`buyer_complement\` text,
	\`buyer_district\` text NOT NULL,
	\`buyer_city\` text NOT NULL,
	\`buyer_state_abbr\` text NOT NULL,
	\`buyer_postal_code\` text NOT NULL,
	\`sender_full_name\` text NOT NULL,
	\`sender_document\` text,
	\`sender_street\` text NOT NULL,
	\`sender_number\` text NOT NULL,
	\`sender_complement\` text,
	\`sender_district\` text NOT NULL,
	\`sender_city\` text NOT NULL,
	\`sender_state_abbr\` text NOT NULL,
	\`sender_postal_code\` text NOT NULL,
	\`subtotal_cents\` integer NOT NULL,
	\`shipping_cents\` integer NOT NULL,
	\`total_cents\` integer NOT NULL,
	\`shipping_method\` text,
	\`status\` text DEFAULT 'open' NOT NULL,
	\`is_photographed\` integer DEFAULT false NOT NULL,
	\`shipping_ticket_id\` text,
	\`myp_confirmed_at\` text,
	\`imported_at\` text NOT NULL,
	\`created_at\` integer DEFAULT (strftime('%s', 'now')),
	\`updated_at\` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS \`fulfillment_orders_user_order_idx\` ON \`fulfillment_orders\` (\`user_id\`,\`myp_order_id\`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS \`fulfillment_order_printings\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`fulfillment_order_id\` text NOT NULL,
	\`card_slug\` text,
	\`card_name\` text NOT NULL,
	\`element\` text DEFAULT 'UNMATCHED' NOT NULL,
	\`set_code\` text,
	\`collector_number\` text,
	\`condition\` text DEFAULT 'NM' NOT NULL,
	\`language\` text DEFAULT 'EN' NOT NULL,
	\`is_foil\` integer DEFAULT false NOT NULL,
	\`quantity\` integer DEFAULT 1 NOT NULL,
	\`unit_price_brl\` text DEFAULT 'R$ 0,00' NOT NULL,
	\`myp_code\` text NOT NULL,
	\`image_url\` text,
	\`created_at\` integer DEFAULT (strftime('%s', 'now')),
	\`updated_at\` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (\`fulfillment_order_id\`) REFERENCES \`fulfillment_orders\`(\`id\`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS \`shipping_tickets\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`user_id\` text NOT NULL,
	\`superfrete_order_id\` text NOT NULL,
	\`buyer_nick\` text NOT NULL,
	\`status\` text DEFAULT 'pending' NOT NULL,
	\`carrier\` text NOT NULL,
	\`service_code\` text NOT NULL,
	\`service_name\` text NOT NULL,
	\`quoted_price_cents\` integer,
	\`insurance_value_cents\` integer NOT NULL,
	\`tracking_code\` text,
	\`print_url\` text,
	\`provider_payload_json\` text,
	\`synchronized_at\` text,
	\`created_at\` integer DEFAULT (strftime('%s', 'now')),
	\`updated_at\` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS \`shipping_tickets_user_ticket_idx\` ON \`shipping_tickets\` (\`user_id\`,\`superfrete_order_id\`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS \`market_stores\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`platform\` text NOT NULL,
	\`name\` text NOT NULL,
	\`base_url\` text NOT NULL,
	\`tcg_id\` text,
	\`enabled\` integer DEFAULT true NOT NULL,
	\`last_count\` integer,
	\`last_count_checked_at\` integer,
	\`last_full_scan_at\` integer,
	\`last_latest_card_ref_id\` text,
	\`last_notified_at\` integer,
	\`updated_at\` integer DEFAULT (strftime('%s', 'now'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS \`market_cards\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`store_id\` text NOT NULL,
	\`card_slug\` text,
	\`edition_id\` text,
	\`raw_name\` text NOT NULL,
	\`card_name\` text NOT NULL,
	\`set_prefix\` text NOT NULL,
	\`quantity\` integer DEFAULT 1 NOT NULL,
	\`price\` text DEFAULT 'R$ 0,00' NOT NULL,
	\`price_numeric\` real DEFAULT 0 NOT NULL,
	\`tcg_price\` text,
	\`tcg_price_numeric\` real,
	\`quality\` text DEFAULT 'NM' NOT NULL,
	\`is_foil\` integer DEFAULT false NOT NULL,
	\`item_id\` text,
	\`product_url\` text,
	\`vendor_name\` text,
	\`vendor_url\` text,
	\`first_seen_at\` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	\`last_seen_at\` integer DEFAULT (strftime('%s', 'now')),
	\`updated_at\` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (\`store_id\`) REFERENCES \`market_stores\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`card_slug\`) REFERENCES \`cards\`(\`slug\`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (\`edition_id\`) REFERENCES \`card_editions\`(\`id\`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS \`market_cards_store_item_idx\` ON \`market_cards\` (\`store_id\`,\`item_id\`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS \`market_cards_store_card_slug_idx\` ON \`market_cards\` (\`store_id\`,\`card_slug\`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS \`market_cards_store_edition_idx\` ON \`market_cards\` (\`store_id\`,\`edition_id\`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS \`market_notifications\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`store_id\` text NOT NULL,
	\`card_name\` text NOT NULL,
	\`set_prefix\` text NOT NULL,
	\`collector_number\` text NOT NULL,
	\`is_foil\` integer DEFAULT 0 NOT NULL,
	\`price\` text NOT NULL,
	\`ref_id\` text NOT NULL,
	\`image_url\` text,
	\`detected_at\` integer NOT NULL,
	\`sent_at\` integer,
	\`message_id\` text,
	\`created_at\` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (\`store_id\`) REFERENCES \`market_stores\`(\`id\`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS \`notification_deliveries\` (
	\`notification_id\` text NOT NULL,
	\`destination\` text NOT NULL,
	\`delivered_at\` integer NOT NULL,
	\`message_id\` text,
	PRIMARY KEY (\`notification_id\`, \`destination\`),
	FOREIGN KEY (\`notification_id\`) REFERENCES \`market_notifications\`(\`id\`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS \`deal_alert_messages\` (
	\`discord_user_id\` text PRIMARY KEY NOT NULL,
	\`channel_id\` text NOT NULL,
	\`message_id\` text NOT NULL,
	\`last_listing_keys\` text DEFAULT '[]' NOT NULL,
	\`updated_at\` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS \`collector_identities\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`collector_id\` text NOT NULL,
	\`provider\` text NOT NULL,
	\`provider_user_id\` text NOT NULL,
	\`provider_username\` text,
	\`linked_at\` integer NOT NULL,
	\`created_at\` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (\`collector_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS \`collector_identities_provider_user_idx\` ON \`collector_identities\` (\`provider\`, \`provider_user_id\`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS \`collector_pairing_tokens\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`collector_id\` text NOT NULL,
	\`token\` text NOT NULL UNIQUE,
	\`expires_at\` integer NOT NULL,
	\`used_at\` integer,
	\`created_at\` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (\`collector_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS \`collector_wants\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`collector_id\` text NOT NULL,
	\`card_slug\` text NOT NULL,
	\`edition_id\` text,
	\`desired_quantity\` integer DEFAULT 1 NOT NULL,
	\`foil\` integer,
	\`target_max_price\` real,
	\`source\` text DEFAULT 'manual' NOT NULL,
	\`created_at\` integer DEFAULT (strftime('%s', 'now')),
	\`updated_at\` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (\`collector_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`card_slug\`) REFERENCES \`cards\`(\`slug\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`edition_id\`) REFERENCES \`card_editions\`(\`id\`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS \`collector_wants_collector_card_edition_foil_idx\` ON \`collector_wants\` (\`collector_id\`, \`card_slug\`, \`edition_id\`, \`foil\`);
--> statement-breakpoint
INSERT INTO \`notification_deliveries\` (\`notification_id\`, \`destination\`, \`delivered_at\`)
SELECT \`id\`, 'discord', COALESCE(\`sent_at\`, \`detected_at\`)
FROM \`market_notifications\`
WHERE \`id\` NOT IN (SELECT \`notification_id\` FROM \`notification_deliveries\` WHERE \`destination\` = 'discord');
--> statement-breakpoint
INSERT OR IGNORE INTO \`market_stores\` (\`id\`, \`platform\`, \`name\`, \`base_url\`, \`tcg_id\`, \`enabled\`)
VALUES ('myp', 'myp', 'MyP Cards', 'https://mypcards.com', 'grandarchive', 1);
--> statement-breakpoint
INSERT OR IGNORE INTO \`market_cards\` (
	\`id\`,
	\`store_id\`,
	\`card_slug\`,
	\`edition_id\`,
	\`raw_name\`,
	\`card_name\`,
	\`set_prefix\`,
	\`quantity\`,
	\`price\`,
	\`price_numeric\`,
	\`tcg_price\`,
	\`tcg_price_numeric\`,
	\`quality\`,
	\`is_foil\`,
	\`item_id\`,
	\`product_url\`,
	\`vendor_name\`,
	\`vendor_url\`,
	\`updated_at\`
)
SELECT
	\`id\`,
	'myp',
	\`card_slug\`,
	\`edition_id\`,
	\`raw_name\`,
	\`card_name\`,
	\`set_prefix\`,
	\`quantity\`,
	\`price\`,
	\`price_numeric\`,
	\`tcg_price\`,
	\`tcg_price_numeric\`,
	'NM',
	\`is_foil\`,
	\`myp_item_id\`,
	\`myp_product_url\`,
	\`vendor_name\`,
	\`vendor_url\`,
	\`updated_at\`
FROM \`myp_market_cards\`;
--> statement-breakpoint
DROP TABLE IF EXISTS \`myp_market_cards\`;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS \`featured_set_groups\` (
\`uuid\` text PRIMARY KEY NOT NULL,
\`name\` text NOT NULL,
\`slug\` text NOT NULL,
\`image_url\` text DEFAULT '' NOT NULL,
\`sort_order\` integer DEFAULT 0 NOT NULL,
\`created_at\` integer DEFAULT (strftime('%s', 'now')),
\`updated_at\` integer DEFAULT (strftime('%s', 'now'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS \`idx_featured_set_groups_slug\` ON \`featured_set_groups\` (\`slug\`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS \`set_definitions\` (
\`id\` text PRIMARY KEY NOT NULL,
\`group_uuid\` text NOT NULL,
\`prefix\` text NOT NULL,
\`name\` text NOT NULL,
\`language\` text DEFAULT 'EN' NOT NULL,
\`release_date\` text DEFAULT '' NOT NULL,
\`created_at\` integer DEFAULT (strftime('%s', 'now')),
\`updated_at\` integer DEFAULT (strftime('%s', 'now')),
FOREIGN KEY (\`group_uuid\`) REFERENCES \`featured_set_groups\`(\`uuid\`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS \`idx_set_definitions_group_uuid\` ON \`set_definitions\` (\`group_uuid\`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS \`idx_set_definitions_prefix\` ON \`set_definitions\` (\`prefix\`);
`;

let defaultClientMigrationsPromise: Promise<void> | null = null;

export async function runMigrations(customClient?: any) {
  if (customClient) {
    return doRunMigrations(customClient);
  }
  if (!defaultClientMigrationsPromise) {
    defaultClientMigrationsPromise = doRunMigrations(client).catch((err) => {
      defaultClientMigrationsPromise = null;
      throw err;
    });
  }
  return defaultClientMigrationsPromise;
}

async function doRunMigrations(customClient: typeof client) {
  let sqlContent = EMBEDDED_MIGRATION_SQL;
  try {
    const drizzleDir = path.join(process.cwd(), "drizzle");
    if (fs.existsSync(drizzleDir)) {
      const sqlFiles = fs
        .readdirSync(drizzleDir)
        .filter((file) => file.endsWith(".sql"))
        .sort();
      if (sqlFiles.length > 0) {
        sqlContent = sqlFiles
          .map((file) => fs.readFileSync(path.join(drizzleDir, file), "utf-8"))
          .join("\n--> statement-breakpoint\n");
      }
    }
  } catch {
    // Fall back to EMBEDDED_MIGRATION_SQL in serverless / restricted environments
  }

  const statements = sqlContent
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const statement of statements) {
    // Ensure all CREATE statements are IF NOT EXISTS for idempotency
    const idempotentStmt = statement
      .replace(/^CREATE TABLE\s+(?!IF NOT EXISTS\s)/i, "CREATE TABLE IF NOT EXISTS ")
      .replace(/^CREATE UNIQUE INDEX\s+(?!IF NOT EXISTS\s)/i, "CREATE UNIQUE INDEX IF NOT EXISTS ")
      .replace(/^CREATE INDEX\s+(?!IF NOT EXISTS\s)/i, "CREATE INDEX IF NOT EXISTS ");

    try {
      await customClient.execute(idempotentStmt);
    } catch (err: any) {
      const msg = (err?.message || "").toLowerCase();
      if (msg.includes("already exists") || msg.includes("duplicate column")) {
        continue;
      }
      throw err;
    }
  }

  // Idempotent column migration for existing databases
  const alterColumns = [
    "ALTER TABLE `users` ADD COLUMN `myp_username` text;",
    "ALTER TABLE `users` ADD COLUMN `watchlist_policy_hard` integer DEFAULT 1 NOT NULL;",
    "ALTER TABLE `users` ADD COLUMN `watchlist_policy_shared` integer DEFAULT 0 NOT NULL;",
    "ALTER TABLE `users` ADD COLUMN `watchlist_policy_staples` integer DEFAULT 0 NOT NULL;",
    "ALTER TABLE `users` ADD COLUMN `myp_login` text;",
    "ALTER TABLE `users` ADD COLUMN `myp_password_encrypted` text;",
    "ALTER TABLE `users` ADD COLUMN `seller_mode_enabled` integer DEFAULT 0 NOT NULL;",
    "ALTER TABLE `users` ADD COLUMN `myp_auto_watchlist_enabled` integer DEFAULT 0 NOT NULL;",
    "ALTER TABLE `users` ADD COLUMN `locale` text DEFAULT 'en' NOT NULL;",
    "ALTER TABLE `users` ADD COLUMN `watchlist_sync_token` text;",
    "ALTER TABLE `myp_watchlist` ADD COLUMN `myp_wishlist_item_id` text;",
    "ALTER TABLE `myp_watchlist` ADD COLUMN `synced_quantity` integer;",
    "ALTER TABLE `meta_archetypes` ADD COLUMN `element` text;",
    "ALTER TABLE `meta_archetypes` ADD COLUMN `signature_card_image_url` text;",
    "ALTER TABLE `meta_archetypes` ADD COLUMN `deck_count` integer DEFAULT 0;",
    "ALTER TABLE `meta_archetypes` ADD COLUMN `detail_url` text;",
    "ALTER TABLE `meta_archetypes` ADD COLUMN `sample_event_deck_url` text;",
    "ALTER TABLE `myp_market_cards` ADD COLUMN `tcg_price` text;",
    "ALTER TABLE `myp_market_cards` ADD COLUMN `tcg_price_numeric` real;",
    "ALTER TABLE `myp_market_cards` ADD COLUMN `vendor_name` text;",
    "ALTER TABLE `myp_market_cards` ADD COLUMN `vendor_url` text;",
    "ALTER TABLE `users` ADD COLUMN `superfrete_api_key_encrypted` text;",
    "ALTER TABLE `users` ADD COLUMN `shipping_package_preset` text DEFAULT 'standard-box' NOT NULL;",
    "ALTER TABLE `users` ADD COLUMN `shipping_package_height` real DEFAULT 2 NOT NULL;",
    "ALTER TABLE `users` ADD COLUMN `shipping_package_width` real DEFAULT 21 NOT NULL;",
    "ALTER TABLE `users` ADD COLUMN `shipping_package_length` real DEFAULT 30 NOT NULL;",
    "ALTER TABLE `users` ADD COLUMN `shipping_package_base_weight` real DEFAULT 200 NOT NULL;",
    "ALTER TABLE `users` ADD COLUMN `shipping_package_tape_weight` real DEFAULT 5 NOT NULL;",
    "ALTER TABLE `users` ADD COLUMN `shipping_card_weight` real DEFAULT 3 NOT NULL;",
    "ALTER TABLE `users` ADD COLUMN `slightly_overpriced_multiplier` real DEFAULT 1.2 NOT NULL;",
    "ALTER TABLE `users` ADD COLUMN `heavily_overpriced_multiplier` real DEFAULT 2.0 NOT NULL;",
    "ALTER TABLE `market_stores` ADD COLUMN `last_latest_card_ref_id` text;",
    "ALTER TABLE `market_stores` ADD COLUMN `last_notified_at` integer;",
    "ALTER TABLE `market_cards` ADD COLUMN `first_seen_at` integer DEFAULT 0 NOT NULL;",
    "ALTER TABLE `collector_identities` ADD COLUMN `wantlist_notifications_enabled` integer DEFAULT 0 NOT NULL;",
 "ALTER TABLE `users` ADD COLUMN `hidden_set_uuids` text DEFAULT '[]' NOT NULL;",
  ];

  for (const alterStmt of alterColumns) {
    try {
      await customClient.execute(alterStmt);
    } catch (err: any) {
      const msg = (err?.message || "").toLowerCase();
      if (!msg.includes("duplicate column")) {
        console.warn(`[migrations] ALTER column warning: ${(err as any)?.message || err}`);
      }
    }
  }
}

