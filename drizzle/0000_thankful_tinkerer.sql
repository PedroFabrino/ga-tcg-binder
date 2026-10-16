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
	`share_rate` text DEFAULT '0%' NOT NULL,
	`win_rate` text DEFAULT '50%' NOT NULL,
	`decklist` text NOT NULL,
	`source_url` text,
	`updated_at` integer DEFAULT (strftime('%s', 'now'))
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
	`is_foil` integer DEFAULT false NOT NULL,
	`myp_item_id` text,
	`myp_product_url` text,
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`card_slug`) REFERENCES `cards`(`slug`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`edition_id`) REFERENCES `card_editions`(`id`) ON UPDATE no action ON DELETE set null
);

