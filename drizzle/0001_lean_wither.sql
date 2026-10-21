CREATE TABLE `card_hashes` (
	`edition_id` text PRIMARY KEY NOT NULL,
	`phash` text NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`edition_id`) REFERENCES `card_editions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `fulfillment_order_printings` (
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
CREATE TABLE `fulfillment_orders` (
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
CREATE UNIQUE INDEX `fulfillment_orders_user_order_idx` ON `fulfillment_orders` (`user_id`,`myp_order_id`);--> statement-breakpoint
CREATE TABLE `market_cards` (
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
	`first_seen_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`last_seen_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`store_id`) REFERENCES `market_stores`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`card_slug`) REFERENCES `cards`(`slug`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`edition_id`) REFERENCES `card_editions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `market_cards_store_item_idx` ON `market_cards` (`store_id`,`item_id`);--> statement-breakpoint
CREATE INDEX `market_cards_store_card_slug_idx` ON `market_cards` (`store_id`,`card_slug`);--> statement-breakpoint
CREATE INDEX `market_cards_store_edition_idx` ON `market_cards` (`store_id`,`edition_id`);--> statement-breakpoint
CREATE TABLE `market_notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`card_name` text NOT NULL,
	`set_prefix` text NOT NULL,
	`collector_number` text NOT NULL,
	`is_foil` integer DEFAULT false NOT NULL,
	`price` text NOT NULL,
	`ref_id` text NOT NULL,
	`image_url` text,
	`detected_at` integer NOT NULL,
	`sent_at` integer,
	`message_id` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `market_stores`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `market_stores` (
	`id` text PRIMARY KEY NOT NULL,
	`platform` text NOT NULL,
	`name` text NOT NULL,
	`base_url` text NOT NULL,
	`tcg_id` text,
	`enabled` integer DEFAULT true NOT NULL,
	`last_count` integer,
	`last_count_checked_at` integer,
	`last_full_scan_at` integer,
	`last_latest_card_ref_id` text,
	`last_notified_at` integer,
	`updated_at` integer DEFAULT (strftime('%s', 'now'))
);
--> statement-breakpoint
CREATE TABLE `meta_staples` (
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
CREATE TABLE `myp_cards` (
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
CREATE TABLE `myp_watchlist` (
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
	`target_price_brl` real DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'pending_add' NOT NULL,
	`last_error` text,
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `myp_watchlist_user_printing_idx` ON `myp_watchlist` (`user_id`,`edition_slug`,`collector_number`);--> statement-breakpoint
CREATE TABLE `shipping_tickets` (
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
CREATE UNIQUE INDEX `shipping_tickets_user_ticket_idx` ON `shipping_tickets` (`user_id`,`superfrete_order_id`);--> statement-breakpoint
ALTER TABLE `meta_archetypes` ADD `element` text;--> statement-breakpoint
ALTER TABLE `meta_archetypes` ADD `signature_card_image_url` text;--> statement-breakpoint
ALTER TABLE `meta_archetypes` ADD `deck_count` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `meta_archetypes` ADD `detail_url` text;--> statement-breakpoint
ALTER TABLE `meta_archetypes` ADD `sample_event_deck_url` text;--> statement-breakpoint
ALTER TABLE `users` ADD `locale` text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `myp_username` text;--> statement-breakpoint
ALTER TABLE `users` ADD `watchlist_policy_hard` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `watchlist_policy_shared` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `watchlist_policy_staples` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `myp_login` text;--> statement-breakpoint
ALTER TABLE `users` ADD `myp_password_encrypted` text;--> statement-breakpoint
ALTER TABLE `users` ADD `seller_mode_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `myp_auto_watchlist_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `superfrete_api_key_encrypted` text;--> statement-breakpoint
ALTER TABLE `users` ADD `shipping_package_preset` text DEFAULT 'standard-box' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `shipping_package_height` real DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `shipping_package_width` real DEFAULT 21 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `shipping_package_length` real DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `shipping_package_base_weight` real DEFAULT 200 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `shipping_package_tape_weight` real DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `shipping_card_weight` real DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `slightly_overpriced_multiplier` real DEFAULT 1.2 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `heavily_overpriced_multiplier` real DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `watchlist_sync_token` text;