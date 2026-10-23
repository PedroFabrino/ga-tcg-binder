CREATE TABLE IF NOT EXISTS `deal_alert_messages` (
	`discord_user_id` text PRIMARY KEY NOT NULL,
	`channel_id` text NOT NULL,
	`message_id` text NOT NULL,
	`last_listing_keys` text DEFAULT '[]' NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
