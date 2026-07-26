CREATE TABLE `blinds` (
	`tag` varchar(40) NOT NULL,
	`projectId` varchar(40) NOT NULL,
	`type` varchar(120) NOT NULL,
	`size` varchar(60) NOT NULL,
	`blindPhase` enum('Broken / Preparation','Assembly','Tight & Torque','Final Tight','Inspection Ready') NOT NULL DEFAULT 'Broken / Preparation',
	`owner` varchar(160) NOT NULL,
	`blindPriority` enum('Low','Normal','High','Critical') NOT NULL DEFAULT 'Normal',
	`lineNumber` varchar(120),
	`location` varchar(220),
	`isolationPoint` varchar(220),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `blinds_tag` PRIMARY KEY(`tag`)
);
--> statement-breakpoint
ALTER TABLE `blinds` ADD CONSTRAINT `blinds_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE no action ON UPDATE no action;