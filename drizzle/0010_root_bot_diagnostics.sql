CREATE TABLE IF NOT EXISTS `root_bot_diagnostics` (
	`id` text PRIMARY KEY NOT NULL,
	`community_id` text NOT NULL,
	`stage` text NOT NULL,
	`message` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
