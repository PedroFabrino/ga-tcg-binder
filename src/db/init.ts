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
`;

export async function runMigrations(customClient = client) {
  let sqlContent = EMBEDDED_MIGRATION_SQL;
  try {
    const sqlPath = path.join(process.cwd(), "drizzle", "0000_thankful_tinkerer.sql");
    if (fs.existsSync(sqlPath)) {
      sqlContent = fs.readFileSync(sqlPath, "utf-8");
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
      if (msg.includes("already exists")) {
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
    "ALTER TABLE `users` ADD COLUMN `myp_auto_watchlist_enabled` integer DEFAULT 0 NOT NULL;",
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
    "ALTER TABLE `users` ADD COLUMN `slightly_overpriced_multiplier` real DEFAULT 1.2 NOT NULL;",
    "ALTER TABLE `users` ADD COLUMN `heavily_overpriced_multiplier` real DEFAULT 2.0 NOT NULL;",
  ];

  for (const alterStmt of alterColumns) {
    try {
      await customClient.execute(alterStmt);
    } catch (err: any) {
      const msg = (err?.message || "").toLowerCase();
      if (!msg.includes("duplicate column")) {
        // Ignore if column already exists
      }
    }
  }
}

