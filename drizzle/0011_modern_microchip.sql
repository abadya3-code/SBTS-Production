CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`recipientOpenId` varchar(64) NOT NULL,
	`actorOpenId` varchar(64),
	`actorName` varchar(200),
	`notificationType` enum('registration_request','registration_approved','registration_rejected','blind_phase_changed','blind_phase_approval','blind_assigned','project_created','project_status_changed','phase_owner_assigned','workflow_updated','system_announcement') NOT NULL,
	`title` varchar(200) NOT NULL,
	`body` text NOT NULL,
	`linkUrl` varchar(500),
	`projectId` int,
	`blindTag` varchar(80),
	`isRead` int NOT NULL DEFAULT 0,
	`readAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
