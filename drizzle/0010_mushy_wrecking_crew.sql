CREATE TABLE `user_role_assignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`roleKey` varchar(80) NOT NULL,
	`assignedByOpenId` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_role_assignments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `userStatus` enum('pending','active','rejected') DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `department` varchar(160);--> statement-breakpoint
ALTER TABLE `users` ADD `specialty` varchar(160);--> statement-breakpoint
ALTER TABLE `users` ADD `employeeNumber` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `registrationNote` text;--> statement-breakpoint
ALTER TABLE `users` ADD `approvedByOpenId` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `approvedAt` timestamp;--> statement-breakpoint
ALTER TABLE `user_role_assignments` ADD CONSTRAINT `user_role_assignments_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_role_assignments` ADD CONSTRAINT `user_role_assignments_roleKey_access_roles_key_fk` FOREIGN KEY (`roleKey`) REFERENCES `access_roles`(`key`) ON DELETE no action ON UPDATE no action;