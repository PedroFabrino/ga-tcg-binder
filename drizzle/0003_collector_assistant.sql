CREATE TABLE `collector_identities` (
	`id` text PRIMARY KEY NOT NULL,
	`collector_id` text NOT NULL,
	`provider` text NOT NULL,
	`provider_user_id` text NOT NULL,
	`provider_username` text,
	`linked_at` integer NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`collector_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `collector_identities_provider_user_idx` ON `collector_identities` (`provider`, `provider_user_id`);
--> statement-breakpoint
CREATE TABLE `collector_pairing_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`collector_id` text NOT NULL,
	`token` text NOT NULL UNIQUE,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`collector_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
