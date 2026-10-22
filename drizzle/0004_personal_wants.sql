CREATE TABLE IF NOT EXISTS `collector_wants` (
	`id` text PRIMARY KEY NOT NULL,
	`collector_id` text NOT NULL,
	`card_slug` text NOT NULL,
	`edition_id` text,
	`desired_quantity` integer DEFAULT 1 NOT NULL,
	`foil` integer,
	`target_max_price` real,
	`source` text DEFAULT 'manual' NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`collector_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`card_slug`) REFERENCES `cards`(`slug`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`edition_id`) REFERENCES `card_editions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `collector_wants_collector_card_edition_foil_idx` ON `collector_wants` (`collector_id`, `card_slug`, `edition_id`, `foil`);
--> statement-breakpoint
ALTER TABLE `collector_identities` ADD COLUMN `wantlist_notifications_enabled` integer DEFAULT 0 NOT NULL;
