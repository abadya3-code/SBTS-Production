CREATE TABLE `project_phase_owners` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` varchar(40) NOT NULL,
	`blindPhase` enum('Broken / Preparation','Assembly','Tight & Torque','Final Tight','Inspection Ready') NOT NULL DEFAULT 'Broken / Preparation',
	`ownerName` varchar(160) NOT NULL,
	`ownerRole` varchar(120) NOT NULL,
	`createdByOpenId` varchar(64),
	`updatedByOpenId` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `project_phase_owners_id` PRIMARY KEY(`id`),
	CONSTRAINT `project_phase_owner_unique` UNIQUE(`projectId`,`blindPhase`)
);
--> statement-breakpoint
ALTER TABLE `project_phase_owners` ADD CONSTRAINT `project_phase_owners_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE no action ON UPDATE no action;