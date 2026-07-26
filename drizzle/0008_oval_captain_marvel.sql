CREATE TABLE `blind_phase_approvals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`blindTag` varchar(40) NOT NULL,
	`projectId` varchar(40) NOT NULL,
	`blindPhase` enum('Broken / Preparation','Assembly','Tight & Torque','Final Tight','Inspection Ready') NOT NULL DEFAULT 'Broken / Preparation',
	`approved` int NOT NULL DEFAULT 1,
	`approvedByOpenId` varchar(64),
	`approvedByName` varchar(160),
	`note` text,
	`approvedAt` timestamp,
	`revokedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `blind_phase_approvals_id` PRIMARY KEY(`id`),
	CONSTRAINT `blind_phase_approval_unique` UNIQUE(`blindTag`,`blindPhase`)
);
--> statement-breakpoint
ALTER TABLE `blind_phase_approvals` ADD CONSTRAINT `blind_phase_approvals_blindTag_blinds_tag_fk` FOREIGN KEY (`blindTag`) REFERENCES `blinds`(`tag`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `blind_phase_approvals` ADD CONSTRAINT `blind_phase_approvals_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE no action ON UPDATE no action;