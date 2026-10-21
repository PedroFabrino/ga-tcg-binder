CREATE TABLE `notification_deliveries` (
	`notification_id` text NOT NULL,
	`destination` text NOT NULL,
	`delivered_at` integer NOT NULL,
	`message_id` text,
	PRIMARY KEY (`notification_id`, `destination`),
	FOREIGN KEY (`notification_id`) REFERENCES `market_notifications`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `notification_deliveries` (`notification_id`, `destination`, `delivered_at`)
SELECT `id`, 'discord', COALESCE(`sent_at`, `detected_at`)
FROM `market_notifications`
WHERE `id` NOT IN (SELECT `notification_id` FROM `notification_deliveries` WHERE `destination` = 'discord');
