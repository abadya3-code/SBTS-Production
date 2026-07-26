CREATE TABLE `notification_preferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`registrationRequest` int NOT NULL DEFAULT 1,
	`registrationApproved` int NOT NULL DEFAULT 1,
	`registrationRejected` int NOT NULL DEFAULT 1,
	`blindPhaseChanged` int NOT NULL DEFAULT 1,
	`blindPhaseApproval` int NOT NULL DEFAULT 1,
	`blindAssigned` int NOT NULL DEFAULT 1,
	`projectCreated` int NOT NULL DEFAULT 1,
	`projectStatusChanged` int NOT NULL DEFAULT 1,
	`phaseOwnerAssigned` int NOT NULL DEFAULT 1,
	`workflowUpdated` int NOT NULL DEFAULT 1,
	`systemAnnouncement` int NOT NULL DEFAULT 1,
	`updatedByOpenId` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `notification_preferences_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `security_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`qrPublicAccess` int NOT NULL DEFAULT 1,
	`qrRequireAuth` int NOT NULL DEFAULT 0,
	`allowDeleteBlinds` int NOT NULL DEFAULT 0,
	`allowDeleteProjects` int NOT NULL DEFAULT 0,
	`requireDeleteConfirmation` int NOT NULL DEFAULT 1,
	`auditTrailEnabled` int NOT NULL DEFAULT 1,
	`auditRetentionDays` int NOT NULL DEFAULT 90,
	`sessionTimeoutMinutes` int NOT NULL DEFAULT 480,
	`maxLoginAttempts` int NOT NULL DEFAULT 5,
	`lockoutDurationMinutes` int NOT NULL DEFAULT 15,
	`requireStrongPassword` int NOT NULL DEFAULT 1,
	`minPasswordLength` int NOT NULL DEFAULT 8,
	`updatedByOpenId` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `security_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `slip_blind_survey_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`surveyId` int NOT NULL,
	`blindTag` varchar(40) NOT NULL,
	`projectId` varchar(40) NOT NULL,
	`slipStatus` enum('in_service','removed','merged','unknown') NOT NULL DEFAULT 'in_service',
	`foremanApproved` int NOT NULL DEFAULT 0,
	`physicalCondition` enum('good','fair','damaged','missing') NOT NULL DEFAULT 'good',
	`location` varchar(220),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `slip_blind_survey_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `slip_blind_surveys` (
	`id` int AUTO_INCREMENT NOT NULL,
	`surveyDate` date NOT NULL,
	`conductedByOpenId` varchar(64),
	`conductedByName` varchar(160),
	`areaId` int,
	`projectId` varchar(40),
	`totalCount` int NOT NULL DEFAULT 0,
	`inServiceCount` int NOT NULL DEFAULT 0,
	`removedCount` int NOT NULL DEFAULT 0,
	`mergedCount` int NOT NULL DEFAULT 0,
	`foremanApprovedCount` int NOT NULL DEFAULT 0,
	`criticalCount` int NOT NULL DEFAULT 0,
	`notes` text,
	`surveyDataJson` text,
	`status` enum('draft','submitted','approved') NOT NULL DEFAULT 'submitted',
	`approvedByOpenId` varchar(64),
	`approvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `slip_blind_surveys_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `certificate_settings` ADD `showWorkflowLog` int DEFAULT 1;--> statement-breakpoint
ALTER TABLE `certificate_settings` ADD `showExecutionTorque` int DEFAULT 1;--> statement-breakpoint
ALTER TABLE `certificate_settings` ADD `showFinalApprovals` int DEFAULT 1;--> statement-breakpoint
ALTER TABLE `certificate_settings` ADD `showBlindInfo` int DEFAULT 1;--> statement-breakpoint
ALTER TABLE `certificate_settings` ADD `showProjectInfo` int DEFAULT 1;--> statement-breakpoint
ALTER TABLE `certificate_settings` ADD `showQrCode` int DEFAULT 1;--> statement-breakpoint
ALTER TABLE `certificate_settings` ADD `showLockStatus` int DEFAULT 1;--> statement-breakpoint
ALTER TABLE `certificate_settings` ADD `showAreaInfo` int DEFAULT 1;--> statement-breakpoint
ALTER TABLE `certificate_settings` ADD `statusBadgeText` varchar(40) DEFAULT 'APPROVED';--> statement-breakpoint
ALTER TABLE `certificate_settings` ADD `lockBadgeText` varchar(40) DEFAULT 'LOCKED / FINAL';--> statement-breakpoint
ALTER TABLE `default_tag_settings` ADD `tagColor` varchar(20) DEFAULT '#0f172a';--> statement-breakpoint
ALTER TABLE `default_tag_settings` ADD `tagWidth` int DEFAULT 85;--> statement-breakpoint
ALTER TABLE `default_tag_settings` ADD `tagHeight` int DEFAULT 55;--> statement-breakpoint
ALTER TABLE `default_tag_settings` ADD `tagFontSize` int DEFAULT 14;--> statement-breakpoint
ALTER TABLE `default_tag_settings` ADD `tagFontColor` varchar(20) DEFAULT '#0f172a';--> statement-breakpoint
ALTER TABLE `default_tag_settings` ADD `tagTheme` varchar(40) DEFAULT 'industrial';--> statement-breakpoint
ALTER TABLE `default_tag_settings` ADD `tagShowLogo` int DEFAULT 1;--> statement-breakpoint
ALTER TABLE `default_tag_settings` ADD `tagShowQR` int DEFAULT 1;--> statement-breakpoint
ALTER TABLE `default_tag_settings` ADD `tagHoleEnabled` int DEFAULT 1;--> statement-breakpoint
ALTER TABLE `default_tag_settings` ADD `tagHolePosition` varchar(20) DEFAULT 'top-center';--> statement-breakpoint
ALTER TABLE `system_settings` ADD `appName` varchar(200) DEFAULT 'SBTS Professional' NOT NULL;--> statement-breakpoint
ALTER TABLE `system_settings` ADD `appDescription` text;--> statement-breakpoint
ALTER TABLE `system_settings` ADD `appImageUrl` text;--> statement-breakpoint
ALTER TABLE `system_settings` ADD `companyLogoUrl` text;--> statement-breakpoint
ALTER TABLE `system_settings` ADD `companyDescription` text;--> statement-breakpoint
ALTER TABLE `system_settings` ADD `regionName` varchar(200) DEFAULT '';--> statement-breakpoint
ALTER TABLE `system_settings` ADD `dashboardHeroTitle` varchar(500) DEFAULT 'SBTS command center rebuilt for maintainable React architecture.';--> statement-breakpoint
ALTER TABLE `system_settings` ADD `dashboardHeroDescription` text;--> statement-breakpoint
ALTER TABLE `system_settings` ADD `dashboardHeroBadge` varchar(200) DEFAULT 'Access-first migration';--> statement-breakpoint
ALTER TABLE `system_settings` ADD `dashboardHeroImageUrl` text;--> statement-breakpoint
ALTER TABLE `system_settings` ADD `dashboardCtaButtons` text;--> statement-breakpoint
ALTER TABLE `system_settings` ADD `versionName` varchar(100) DEFAULT 'Professional Edition v1.0';--> statement-breakpoint
ALTER TABLE `system_settings` ADD `versionDate` varchar(40);--> statement-breakpoint
ALTER TABLE `users` ADD `passwordHash` text;--> statement-breakpoint
ALTER TABLE `users` ADD `bio` text;--> statement-breakpoint
ALTER TABLE `users` ADD `phone` varchar(40);--> statement-breakpoint
ALTER TABLE `users` ADD `userLocation` varchar(200);--> statement-breakpoint
ALTER TABLE `users` ADD `linkedIn` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `preferredTheme` varchar(20) DEFAULT 'dark';--> statement-breakpoint
ALTER TABLE `users` ADD `avatarKey` text;