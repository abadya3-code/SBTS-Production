CREATE TABLE `blind_workflow_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`blindTag` varchar(40) NOT NULL,
	`projectId` varchar(40) NOT NULL,
	`blindPhase` enum('Broken / Preparation','Assembly','Tight & Torque','Final Tight','Inspection Ready') NOT NULL DEFAULT 'Broken / Preparation',
	`action` varchar(120) NOT NULL,
	`message` text NOT NULL,
	`actorOpenId` varchar(64),
	`actorName` varchar(160),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `blind_workflow_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `project_settings` (
	`projectId` varchar(40) NOT NULL,
	`slipBlindGateRequired` int NOT NULL DEFAULT 1,
	`updatedByOpenId` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `project_settings_projectId` PRIMARY KEY(`projectId`)
);
--> statement-breakpoint
ALTER TABLE `project_phase_owners` ADD `phaseColor` varchar(24) DEFAULT '#f59e0b' NOT NULL;--> statement-breakpoint
ALTER TABLE `blind_workflow_logs` ADD CONSTRAINT `blind_workflow_logs_blindTag_blinds_tag_fk` FOREIGN KEY (`blindTag`) REFERENCES `blinds`(`tag`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `blind_workflow_logs` ADD CONSTRAINT `blind_workflow_logs_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `project_settings` ADD CONSTRAINT `project_settings_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE no action ON UPDATE no action;