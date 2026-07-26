CREATE TABLE `workflow_phases` (
	`id` varchar(120) NOT NULL,
	`workflowId` varchar(96) NOT NULL,
	`sortOrder` int NOT NULL,
	`label` varchar(220) NOT NULL,
	`phaseKey` enum('broken','assembly','tightTorque','finalTight','inspectionReady') NOT NULL,
	`roleKey` varchar(80) NOT NULL,
	`requiredPermissionKey` varchar(120) NOT NULL,
	`gate` text NOT NULL,
	`slaHours` int NOT NULL,
	`evidenceJson` text NOT NULL,
	`automation` text NOT NULL,
	`color` varchar(24) NOT NULL,
	`isCritical` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workflow_phases_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workflow_templates` (
	`id` varchar(96) NOT NULL,
	`name` varchar(180) NOT NULL,
	`description` text NOT NULL,
	`status` enum('Draft','Active','Locked') NOT NULL DEFAULT 'Draft',
	`projectType` varchar(120) NOT NULL,
	`version` varchar(32) NOT NULL,
	`createdByOpenId` varchar(64),
	`updatedByOpenId` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workflow_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `workflow_phases` ADD CONSTRAINT `workflow_phases_workflowId_workflow_templates_id_fk` FOREIGN KEY (`workflowId`) REFERENCES `workflow_templates`(`id`) ON DELETE no action ON UPDATE no action;