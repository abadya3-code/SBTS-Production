CREATE TABLE `access_permissions` (
	`key` varchar(120) NOT NULL,
	`label` varchar(180) NOT NULL,
	`description` text NOT NULL,
	`group` varchar(120) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `access_permissions_key` PRIMARY KEY(`key`)
);
--> statement-breakpoint
CREATE TABLE `access_role_permissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`roleKey` varchar(80) NOT NULL,
	`permissionKey` varchar(120) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `access_role_permissions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `access_roles` (
	`key` varchar(80) NOT NULL,
	`name` varchar(140) NOT NULL,
	`subtitle` text NOT NULL,
	`members` int NOT NULL DEFAULT 0,
	`color` varchar(24) NOT NULL,
	`menuKeysJson` text NOT NULL,
	`phaseKeysJson` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `access_roles_key` PRIMARY KEY(`key`)
);
--> statement-breakpoint
ALTER TABLE `access_role_permissions` ADD CONSTRAINT `access_role_permissions_roleKey_access_roles_key_fk` FOREIGN KEY (`roleKey`) REFERENCES `access_roles`(`key`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `access_role_permissions` ADD CONSTRAINT `access_role_permissions_permissionKey_access_permissions_key_fk` FOREIGN KEY (`permissionKey`) REFERENCES `access_permissions`(`key`) ON DELETE no action ON UPDATE no action;