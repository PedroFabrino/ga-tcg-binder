CREATE TABLE IF NOT EXISTS `root_community_identities` (
	`community_id` text NOT NULL,
	`provider_user_id` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	PRIMARY KEY (`community_id`, `provider_user_id`)
);
