CREATE TABLE `areas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	`code` varchar(40) NOT NULL,
	`description` text,
	`location` varchar(200),
	`isActive` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `areas_id` PRIMARY KEY(`id`),
	CONSTRAINT `areas_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` varchar(40) NOT NULL,
	`name` varchar(200) NOT NULL,
	`areaId` int NOT NULL,
	`projectStatus` enum('Active','Completed','On Hold','Planning','Final Review') NOT NULL DEFAULT 'Planning',
	`blindsCount` int NOT NULL DEFAULT 0,
	`progress` int NOT NULL DEFAULT 0,
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `projects` ADD CONSTRAINT `projects_areaId_areas_id_fk` FOREIGN KEY (`areaId`) REFERENCES `areas`(`id`) ON DELETE no action ON UPDATE no action;