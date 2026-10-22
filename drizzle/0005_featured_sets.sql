CREATE TABLE IF NOT EXISTS `featured_set_groups` (
`uuid` text PRIMARY KEY NOT NULL,
`name` text NOT NULL,
`slug` text NOT NULL,
`image_url` text,
`sort_order` integer DEFAULT 0 NOT NULL,
`created_at` integer DEFAULT (strftime('%s', 'now')),
`updated_at` integer DEFAULT (strftime('%s', 'now'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_featured_set_groups_slug` ON `featured_set_groups` (`slug`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `set_definitions` (
`id` text PRIMARY KEY NOT NULL,
`group_uuid` text NOT NULL,
`prefix` text NOT NULL,
`name` text NOT NULL,
`language` text DEFAULT 'EN' NOT NULL,
`release_date` text,
`created_at` integer DEFAULT (strftime('%s', 'now')),
`updated_at` integer DEFAULT (strftime('%s', 'now')),
FOREIGN KEY (`group_uuid`) REFERENCES `featured_set_groups`(`uuid`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_set_definitions_group_uuid` ON `set_definitions` (`group_uuid`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_set_definitions_prefix` ON `set_definitions` (`prefix`);
