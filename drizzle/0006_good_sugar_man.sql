ALTER TABLE `blinds` ADD `rate` varchar(60);--> statement-breakpoint
ALTER TABLE `blinds` ADD `slipMetalForemanApproved` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `blinds` ADD `slipBlindMerged` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `project_phase_owners` ADD `ownersJson` text;--> statement-breakpoint
ALTER TABLE `users` ADD `avatarUrl` text;