CREATE TABLE IF NOT EXISTS `root_bot_installs` (
	`app_id` text NOT NULL,
	`community_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`revoked_at` integer,
	PRIMARY KEY (`app_id`, `community_id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `root_bot_installs_token_hash_idx` ON `root_bot_installs` (`token_hash`);
