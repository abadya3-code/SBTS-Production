ALTER TABLE `workflow_evidence_attachments`
  ADD COLUMN `storageKey` varchar(500);

UPDATE `workflow_evidence_attachments`
SET `storageKey` = CASE
  WHEN `fileUrl` LIKE '/storage/%' THEN SUBSTRING(`fileUrl`, 10)
  WHEN `fileUrl` LIKE '/manus-storage/%' THEN SUBSTRING(`fileUrl`, 17)
  ELSE NULL
END
WHERE `storageKey` IS NULL;

ALTER TABLE `workflow_policy_settings`
  ADD COLUMN `certificateNumberPrefix` varchar(20) NOT NULL DEFAULT 'CERT',
  ADD COLUMN `certificateVerificationEnabled` int NOT NULL DEFAULT 1,
  ADD COLUMN `certificateRequireClosedWorkflow` int NOT NULL DEFAULT 1,
  ADD COLUMN `certificateReissueRequiresReason` int NOT NULL DEFAULT 1,
  ADD COLUMN `certificateAllowRevocation` int NOT NULL DEFAULT 1,
  ADD COLUMN `certificatePublicBaseUrl` varchar(500),
  ADD COLUMN `defectNumberPrefix` varchar(20) NOT NULL DEFAULT 'DEF',
  ADD COLUMN `punchNumberPrefix` varchar(20) NOT NULL DEFAULT 'PCH',
  ADD COLUMN `ndtNumberPrefix` varchar(20) NOT NULL DEFAULT 'NDT',
  ADD COLUMN `requireDefectDispositionBeforeClosure` int NOT NULL DEFAULT 1,
  ADD COLUMN `requireMandatoryPunchClosureBeforeReadyForClosure` int NOT NULL DEFAULT 1,
  ADD COLUMN `requireNdtAcceptanceBeforeReadyForClosure` int NOT NULL DEFAULT 1,
  ADD COLUMN `allowPunchTransfer` int NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS `certificate_records` (
  `id` int NOT NULL AUTO_INCREMENT,
  `certificateNumber` varchar(120) NOT NULL,
  `verificationToken` varchar(96) NOT NULL,
  `projectId` varchar(40) NOT NULL,
  `blindTag` varchar(40) NOT NULL,
  `version` int NOT NULL DEFAULT 1,
  `certificateRecordStatus` enum('issued','superseded','revoked') NOT NULL DEFAULT 'issued',
  `snapshotJson` longtext NOT NULL,
  `snapshotHash` varchar(64) NOT NULL,
  `previousCertificateId` int,
  `issuanceReason` text,
  `issuedByOpenId` varchar(64) NOT NULL,
  `issuedByName` varchar(160),
  `issuedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `supersededAt` timestamp NULL,
  `revokedByOpenId` varchar(64),
  `revokedAt` timestamp NULL,
  `revocationReason` text,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `certificate_number_unique` (`certificateNumber`),
  UNIQUE KEY `certificate_verification_token_unique` (`verificationToken`),
  UNIQUE KEY `blind_certificate_version_unique` (`blindTag`,`version`),
  KEY `certificate_project_idx` (`projectId`),
  CONSTRAINT `certificate_blind_fk` FOREIGN KEY (`blindTag`) REFERENCES `blinds` (`tag`),
  CONSTRAINT `certificate_project_fk` FOREIGN KEY (`projectId`) REFERENCES `projects` (`id`)
);

CREATE TABLE IF NOT EXISTS `defect_notifications` (
  `id` int NOT NULL AUTO_INCREMENT,
  `defectNumber` varchar(120) NOT NULL,
  `projectId` varchar(40) NOT NULL,
  `blindTag` varchar(40) NOT NULL,
  `phaseKey` enum('broken','assembly','tightTorque','finalTight','inspectionReady','operationsInitialIsolation','blindInstallation','mechanicalVerification','internalInspection','reinstatementPreparation','blindRemovalReinstatement','reinstatementVerification','finalApprovalReturnToService') NOT NULL DEFAULT 'internalInspection',
  `title` varchar(240) NOT NULL,
  `description` text NOT NULL,
  `qualitySeverity` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
  `defectStatus` enum('open','under_review','accepted_as_is','repair_required','closed','transferred','cancelled') NOT NULL DEFAULT 'open',
  `disposition` text,
  `requiresRepair` int NOT NULL DEFAULT 0,
  `requiresNdt` int NOT NULL DEFAULT 0,
  `assignedToOpenId` varchar(64),
  `reportedByOpenId` varchar(64) NOT NULL,
  `reviewedByOpenId` varchar(64),
  `closedByOpenId` varchar(64),
  `dueAt` timestamp NULL,
  `closedAt` timestamp NULL,
  `recordVersion` int NOT NULL DEFAULT 1,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `defect_number_unique` (`defectNumber`),
  KEY `defect_blind_idx` (`blindTag`),
  KEY `defect_project_idx` (`projectId`),
  CONSTRAINT `defect_blind_fk` FOREIGN KEY (`blindTag`) REFERENCES `blinds` (`tag`),
  CONSTRAINT `defect_project_fk` FOREIGN KEY (`projectId`) REFERENCES `projects` (`id`)
);

CREATE TABLE IF NOT EXISTS `punch_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `punchNumber` varchar(120) NOT NULL,
  `projectId` varchar(40) NOT NULL,
  `blindTag` varchar(40) NOT NULL,
  `defectId` int,
  `title` varchar(240) NOT NULL,
  `description` text,
  `category` varchar(100),
  `qualitySeverity` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
  `mandatory` int NOT NULL DEFAULT 1,
  `punchStatus` enum('open','in_progress','ready_for_verification','closed','transferred','cancelled') NOT NULL DEFAULT 'open',
  `ownerOpenId` varchar(64),
  `targetDate` timestamp NULL,
  `verificationNotes` text,
  `transferReference` varchar(200),
  `createdByOpenId` varchar(64) NOT NULL,
  `verifiedByOpenId` varchar(64),
  `closedAt` timestamp NULL,
  `recordVersion` int NOT NULL DEFAULT 1,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `punch_number_unique` (`punchNumber`),
  KEY `punch_blind_idx` (`blindTag`),
  KEY `punch_project_idx` (`projectId`),
  CONSTRAINT `punch_blind_fk` FOREIGN KEY (`blindTag`) REFERENCES `blinds` (`tag`),
  CONSTRAINT `punch_project_fk` FOREIGN KEY (`projectId`) REFERENCES `projects` (`id`),
  CONSTRAINT `punch_defect_fk` FOREIGN KEY (`defectId`) REFERENCES `defect_notifications` (`id`)
);

CREATE TABLE IF NOT EXISTS `ndt_records` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ndtNumber` varchar(120) NOT NULL,
  `projectId` varchar(40) NOT NULL,
  `blindTag` varchar(40) NOT NULL,
  `defectId` int,
  `method` varchar(80) NOT NULL,
  `procedureReference` varchar(160),
  `acceptanceCriteria` text,
  `ndtStatus` enum('planned','in_progress','passed','failed','retest_required','cancelled') NOT NULL DEFAULT 'planned',
  `result` text,
  `reportNumber` varchar(160),
  `performedByOpenId` varchar(64),
  `reviewedByOpenId` varchar(64),
  `performedAt` timestamp NULL,
  `reviewedAt` timestamp NULL,
  `recordVersion` int NOT NULL DEFAULT 1,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ndt_number_unique` (`ndtNumber`),
  KEY `ndt_blind_idx` (`blindTag`),
  KEY `ndt_project_idx` (`projectId`),
  CONSTRAINT `ndt_blind_fk` FOREIGN KEY (`blindTag`) REFERENCES `blinds` (`tag`),
  CONSTRAINT `ndt_project_fk` FOREIGN KEY (`projectId`) REFERENCES `projects` (`id`),
  CONSTRAINT `ndt_defect_fk` FOREIGN KEY (`defectId`) REFERENCES `defect_notifications` (`id`)
);

INSERT INTO `access_permissions` (`key`,`label`,`description`,`group`,`createdAt`,`updatedAt`) VALUES
('workflow.quality.defect.record','Record defect notifications','Create and update inspection defect notifications','Inspection & Quality',now(),now()),
('workflow.quality.defect.review','Review and disposition defects','Accept, transfer, repair or close controlled defect notifications','Inspection & Quality',now(),now()),
('workflow.quality.punch.manage','Manage punch items','Create and progress inspection punch items','Inspection & Quality',now(),now()),
('workflow.quality.punch.verify','Verify punch closure','Independently verify punch-item closure or transfer','Inspection & Quality',now(),now()),
('workflow.quality.ndt.record','Record NDT work','Create and update NDT method, report and result records','Inspection & Quality',now(),now()),
('workflow.quality.ndt.review','Review NDT results','Accept or reject NDT results independently','Inspection & Quality',now(),now()),
('workflow.certificate.issue','Issue locked certificate','Issue a hashed immutable certificate snapshot after all gates pass','Certificates',now(),now()),
('workflow.certificate.reissue','Reissue certificate revision','Create a controlled superseding certificate revision with reason','Certificates',now(),now()),
('workflow.certificate.revoke','Revoke certificate','Revoke an issued certificate with a permanent audit reason','Certificates',now(),now())
ON DUPLICATE KEY UPDATE `label`=VALUES(`label`),`description`=VALUES(`description`),`group`=VALUES(`group`),`updatedAt`=VALUES(`updatedAt`);

INSERT INTO `access_role_permissions` (`roleKey`,`permissionKey`,`createdAt`)
SELECT candidates.`roleKey`, candidates.`permissionKey`, now()
FROM (
  SELECT 'inspection' AS `roleKey`, 'workflow.quality.defect.record' AS `permissionKey`
  UNION ALL SELECT 'inspection', 'workflow.quality.defect.review'
  UNION ALL SELECT 'inspection', 'workflow.quality.punch.manage'
  UNION ALL SELECT 'inspection', 'workflow.quality.punch.verify'
  UNION ALL SELECT 'inspection', 'workflow.quality.ndt.record'
  UNION ALL SELECT 'inspection', 'workflow.quality.ndt.review'
  UNION ALL SELECT 'coordinator', 'workflow.certificate.issue'
  UNION ALL SELECT 'coordinator', 'workflow.certificate.reissue'
  UNION ALL SELECT 'operationsForeman', 'workflow.certificate.issue'
  UNION ALL SELECT 'operationsForeman', 'workflow.certificate.revoke'
) candidates
LEFT JOIN `access_role_permissions` existing
  ON existing.`roleKey`=candidates.`roleKey` AND existing.`permissionKey`=candidates.`permissionKey`
WHERE existing.`id` IS NULL;
