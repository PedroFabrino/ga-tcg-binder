CREATE TABLE `card_circulations` (
	`id` text PRIMARY KEY NOT NULL,
	`edition_id` text NOT NULL,
	`kind` text NOT NULL,
	`population` integer DEFAULT 0 NOT NULL,
	`foil` integer DEFAULT false NOT NULL,
	`printing` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`edition_id`) REFERENCES `card_editions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `card_editions` (
	`id` text PRIMARY KEY NOT NULL,
	`card_slug` text NOT NULL,
	`set_prefix` text NOT NULL,
	`set_name` text NOT NULL,
	`collector_number` text NOT NULL,
	`rarity` integer NOT NULL,
	`image_url` text NOT NULL,
	FOREIGN KEY (`card_slug`) REFERENCES `cards`(`slug`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `cards` (
	`slug` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`element` text NOT NULL,
	`class` text NOT NULL,
	`type` text NOT NULL,
	`subtypes` text DEFAULT '[]' NOT NULL,
	`effect` text,
	`cost_reserve` integer,
	`cost_memory` integer,
	`level` integer,
	`speed` integer,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now'))
);
--> statement-breakpoint
CREATE TABLE `collection_items` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`edition_id` text NOT NULL,
	`foil` integer DEFAULT false NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`is_dedicated` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`edition_id`) REFERENCES `card_editions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_edition_foil_idx` ON `collection_items` (`user_id`,`edition_id`,`foil`);--> statement-breakpoint
CREATE TABLE `deck_cards` (
	`id` text PRIMARY KEY NOT NULL,
	`deck_id` text NOT NULL,
	`card_slug` text NOT NULL,
	`zone` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`assigned_edition_id` text,
	FOREIGN KEY (`deck_id`) REFERENCES `decks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`card_slug`) REFERENCES `cards`(`slug`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`assigned_edition_id`) REFERENCES `card_editions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `decks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`champion` text,
	`format` text DEFAULT 'standard' NOT NULL,
	`is_public` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `friend_links` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id_1` text NOT NULL,
	`user_id_2` text NOT NULL,
	`status` text DEFAULT 'accepted' NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`user_id_1`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id_2`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `friend_pair_idx` ON `friend_links` (`user_id_1`,`user_id_2`);--> statement-breakpoint
CREATE TABLE `meta_archetypes` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`tier` text DEFAULT 'A' NOT NULL,
	`champion` text NOT NULL,
	`element` text,
	`signature_card_image_url` text,
	`share_rate` text DEFAULT '0%' NOT NULL,
	`win_rate` text DEFAULT '50%' NOT NULL,
	`deck_count` integer DEFAULT 0,
	`decklist` text NOT NULL,
	`detail_url` text,
	`sample_event_deck_url` text,
	`source_url` text,
	`updated_at` integer DEFAULT (strftime('%s', 'now'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `meta_staples` (
	`card_slug` text PRIMARY KEY NOT NULL,
	`card_name` text NOT NULL,
	`categories` text DEFAULT '[]' NOT NULL,
	`primary_category` text NOT NULL,
	`element` text DEFAULT 'NORM' NOT NULL,
	`inclusion_rate` text DEFAULT '0%' NOT NULL,
	`avg_copies` text DEFAULT '1.0' NOT NULL,
	`recommended_copies` integer DEFAULT 1 NOT NULL,
	`deck_count` integer DEFAULT 0 NOT NULL,
	`image_url` text,
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`card_slug`) REFERENCES `cards`(`slug`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `scanner_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`expires_at` integer NOT NULL,
	`scanned_payload` text DEFAULT '[]' NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `scanner_sessions_token_unique` ON `scanner_sessions` (`token`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`email` text,
	`image` text,
	`friend_code` text NOT NULL,
	`low_pop_threshold` integer DEFAULT 1000 NOT NULL,
	`myp_username` text,
	`created_at` integer DEFAULT (strftime('%s', 'now'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_friend_code_unique` ON `users` (`friend_code`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `card_hashes` (`edition_id` text PRIMARY KEY NOT NULL, `phash` text NOT NULL, `updated_at` integer DEFAULT (strftime('%s', 'now')), FOREIGN KEY (`edition_id`) REFERENCES `card_editions`(`id`) ON UPDATE no action ON DELETE cascade);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `myp_cards` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`card_slug` text,
	`edition_id` text,
	`raw_name` text NOT NULL,
	`card_name` text NOT NULL,
	`set_prefix` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`price` text DEFAULT 'R$ 0,00' NOT NULL,
	`quality` text DEFAULT 'NM' NOT NULL,
	`is_foil` integer DEFAULT false NOT NULL,
	`myp_item_id` text,
	`myp_product_url` text,
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`card_slug`) REFERENCES `cards`(`slug`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`edition_id`) REFERENCES `card_editions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `myp_market_cards` (
	`id` text PRIMARY KEY NOT NULL,
	`card_slug` text,
	`edition_id` text,
	`raw_name` text NOT NULL,
	`card_name` text NOT NULL,
	`set_prefix` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`price` text DEFAULT 'R$ 0,00' NOT NULL,
	`price_numeric` real DEFAULT 0 NOT NULL,
	`tcg_price` text,
	`tcg_price_numeric` real,
	`is_foil` integer DEFAULT false NOT NULL,
	`myp_item_id` text,
	`myp_product_url` text,
	`vendor_name` text,
	`vendor_url` text,
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`card_slug`) REFERENCES `cards`(`slug`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`edition_id`) REFERENCES `card_editions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `myp_watchlist` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`card_slug` text NOT NULL,
	`card_name` text NOT NULL,
	`edition_slug` text NOT NULL,
	`collector_number` text NOT NULL,
	`myp_item_id` text,
	`myp_product_url` text,
	`myp_wishlist_item_id` text,
	`target_quantity` integer DEFAULT 1 NOT NULL,
	`synced_quantity` integer,
	`target_price_brl` real DEFAULT 1.0 NOT NULL,
	`status` text DEFAULT 'pending_add' NOT NULL,
	`last_error` text,
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `myp_watchlist_user_printing_idx` ON `myp_watchlist` (`user_id`,`edition_slug`,`collector_number`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `fulfillment_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`myp_order_id` text NOT NULL,
	`order_date` text NOT NULL,
	`buyer_nick` text NOT NULL,
	`buyer_full_name` text NOT NULL,
	`buyer_document` text,
	`buyer_street` text NOT NULL,
	`buyer_number` text NOT NULL,
	`buyer_complement` text,
	`buyer_district` text NOT NULL,
	`buyer_city` text NOT NULL,
	`buyer_state_abbr` text NOT NULL,
	`buyer_postal_code` text NOT NULL,
	`sender_full_name` text NOT NULL,
	`sender_document` text,
	`sender_street` text NOT NULL,
	`sender_number` text NOT NULL,
	`sender_complement` text,
	`sender_district` text NOT NULL,
	`sender_city` text NOT NULL,
	`sender_state_abbr` text NOT NULL,
	`sender_postal_code` text NOT NULL,
	`subtotal_cents` integer NOT NULL,
	`shipping_cents` integer NOT NULL,
	`total_cents` integer NOT NULL,
	`shipping_method` text,
	`status` text DEFAULT 'open' NOT NULL,
	`is_photographed` integer DEFAULT false NOT NULL,
	`shipping_ticket_id` text,
	`myp_confirmed_at` text,
	`imported_at` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `fulfillment_orders_user_order_idx` ON `fulfillment_orders` (`user_id`,`myp_order_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `fulfillment_order_printings` (
	`id` text PRIMARY KEY NOT NULL,
	`fulfillment_order_id` text NOT NULL,
	`card_slug` text,
	`card_name` text NOT NULL,
	`element` text DEFAULT 'UNMATCHED' NOT NULL,
	`set_code` text,
	`collector_number` text,
	`condition` text DEFAULT 'NM' NOT NULL,
	`language` text DEFAULT 'EN' NOT NULL,
	`is_foil` integer DEFAULT false NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`unit_price_brl` text DEFAULT 'R$ 0,00' NOT NULL,
	`myp_code` text NOT NULL,
	`image_url` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`fulfillment_order_id`) REFERENCES `fulfillment_orders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `shipping_tickets` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`superfrete_order_id` text NOT NULL,
	`buyer_nick` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`carrier` text NOT NULL,
	`service_code` text NOT NULL,
	`service_name` text NOT NULL,
	`quoted_price_cents` integer,
	`insurance_value_cents` integer NOT NULL,
	`tracking_code` text,
	`print_url` text,
	`provider_payload_json` text,
	`synchronized_at` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `shipping_tickets_user_ticket_idx` ON `shipping_tickets` (`user_id`,`superfrete_order_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `market_stores` (
	`id` text PRIMARY KEY NOT NULL,
	`platform` text NOT NULL,
	`name` text NOT NULL,
	`base_url` text NOT NULL,
	`tcg_id` text,
	`enabled` integer DEFAULT true NOT NULL,
	`last_count` integer,
	`last_count_checked_at` integer,
	`last_full_scan_at` integer,
	`updated_at` integer DEFAULT (strftime('%s', 'now'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `market_cards` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`card_slug` text,
	`edition_id` text,
	`raw_name` text NOT NULL,
	`card_name` text NOT NULL,
	`set_prefix` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`price` text DEFAULT 'R$ 0,00' NOT NULL,
	`price_numeric` real DEFAULT 0 NOT NULL,
	`tcg_price` text,
	`tcg_price_numeric` real,
	`quality` text DEFAULT 'NM' NOT NULL,
	`is_foil` integer DEFAULT false NOT NULL,
	`item_id` text,
	`product_url` text,
	`vendor_name` text,
	`vendor_url` text,
	`last_seen_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`store_id`) REFERENCES `market_stores`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`card_slug`) REFERENCES `cards`(`slug`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`edition_id`) REFERENCES `card_editions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `market_cards_store_item_idx` ON `market_cards` (`store_id`,`item_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `market_cards_store_card_slug_idx` ON `market_cards` (`store_id`,`card_slug`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `market_cards_store_edition_idx` ON `market_cards` (`store_id`,`edition_id`);

