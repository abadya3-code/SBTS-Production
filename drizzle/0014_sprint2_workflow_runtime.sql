-- SBTS Sprint 2: Database Domain Migration + Backend Workflow Runtime
-- This migration is additive. Legacy blinds.phase remains intact as a migration reference.

ALTER TABLE `workflow_policy_settings`
  ADD COLUMN `requireIsolationPackageForEntry` int NOT NULL DEFAULT 1,
  ADD COLUMN `requireLineBreakingPermit` int NOT NULL DEFAULT 1,
  ADD COLUMN `requireGasTestForLineBreaking` int NOT NULL DEFAULT 0,
  ADD COLUMN `requireTorqueCalibration` int NOT NULL DEFAULT 1,
  ADD COLUMN `requireInstallationTorque` int NOT NULL DEFAULT 1,
  ADD COLUMN `requireReinstatementTorque` int NOT NULL DEFAULT 1,
  ADD COLUMN `requireSequentialFinalApprovals` int NOT NULL DEFAULT 1,
  ADD COLUMN `requireLotoReleasedForCloseout` int NOT NULL DEFAULT 1,
  ADD COLUMN `blockTransitionWhenPermitExpired` int NOT NULL DEFAULT 1,
  ADD COLUMN `allowAdminWorkflowOverride` int NOT NULL DEFAULT 0,
  ADD COLUMN `showGateReadinessPanel` int NOT NULL DEFAULT 1,
  ADD COLUMN `showLegacyPhaseReference` int NOT NULL DEFAULT 0,
  ADD COLUMN `workflowUiDensity` varchar(20) NOT NULL DEFAULT 'comfortable',
  ADD COLUMN `safetyBannerMode` varchar(20) NOT NULL DEFAULT 'prominent',
  ADD COLUMN `authorizedGasTesterRoleKey` varchar(80) NOT NULL DEFAULT 'gasTester',
  ADD COLUMN `gasTestRequiresInstrumentCalibration` int NOT NULL DEFAULT 1,
  ADD COLUMN `gasTestLimitsConfigured` int NOT NULL DEFAULT 0,
  ADD COLUMN `gasTestOxygenMinPercent` decimal(6,2) NULL,
  ADD COLUMN `gasTestOxygenMaxPercent` decimal(6,2) NULL,
  ADD COLUMN `gasTestMaxLelPercent` decimal(6,2) NULL,
  ADD COLUMN `gasTestMaxH2sPpm` decimal(8,2) NULL,
  ADD COLUMN `gasTestMaxCoPpm` decimal(8,2) NULL,
  ADD COLUMN `entryReadinessValidityMinutes` int NOT NULL DEFAULT 720,
  ADD COLUMN `isolationPackageIdPrefix` varchar(20) NOT NULL DEFAULT 'VIP',
  ADD COLUMN `preventBlindInMultipleActivePackages` int NOT NULL DEFAULT 1;

ALTER TABLE `workflow_phases`
  ADD COLUMN `purpose` text,
  ADD COLUMN `actionKey` varchar(120),
  ADD COLUMN `actionLabel` varchar(220),
  ADD COLUMN `checklistJson` text;

ALTER TABLE `notifications`
  MODIFY COLUMN `notificationType` enum(
    'registration_request','registration_approved','registration_rejected',
    'blind_phase_changed','blind_phase_approval','blind_assigned',
    'project_created','project_status_changed','phase_owner_assigned',
    'workflow_updated','workflow_transition','workflow_gate_blocked',
    'workflow_approval_required','safety_hold_placed','safety_hold_released',
    'system_announcement'
  ) NOT NULL,
  MODIFY COLUMN `projectId` varchar(40);

ALTER TABLE `notification_preferences`
  ADD COLUMN `workflowTransition` int NOT NULL DEFAULT 1,
  ADD COLUMN `workflowGateBlocked` int NOT NULL DEFAULT 1,
  ADD COLUMN `workflowApprovalRequired` int NOT NULL DEFAULT 1,
  ADD COLUMN `safetyHoldPlaced` int NOT NULL DEFAULT 1,
  ADD COLUMN `safetyHoldReleased` int NOT NULL DEFAULT 1;

CREATE TABLE `project_workflow_assignments` (
  `projectId` varchar(40) NOT NULL,
  `workflowTemplateId` varchar(96) NOT NULL,
  `workflowVersion` varchar(32) NOT NULL,
  `assignmentStatus` enum('active','migrating','locked') NOT NULL DEFAULT 'active',
  `migrationVersion` int NOT NULL DEFAULT 2,
  `assignedByOpenId` varchar(64),
  `assignedAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`projectId`),
  CONSTRAINT `project_workflow_assignment_project_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`),
  CONSTRAINT `project_workflow_assignment_template_fk` FOREIGN KEY (`workflowTemplateId`) REFERENCES `workflow_templates`(`id`)
);

CREATE TABLE `blind_workflow_runtime` (
  `blindTag` varchar(40) NOT NULL,
  `projectId` varchar(40) NOT NULL,
  `workflowTemplateId` varchar(96) NOT NULL,
  `workflowVersion` varchar(32) NOT NULL,
  `phaseKey` enum(
    'broken','assembly','tightTorque','finalTight','inspectionReady',
    'operationsInitialIsolation','blindInstallation','mechanicalVerification','internalInspection',
    'reinstatementPreparation','blindRemovalReinstatement','reinstatementVerification',
    'finalApprovalReturnToService'
  ) NOT NULL,
  `lifecycleStatus` enum(
    'PLANNED','INITIAL_ISOLATION','READY_FOR_BLIND_INSTALLATION','BLIND_INSTALLED',
    'MECHANICAL_VERIFICATION_PENDING','ACTIVE_ISOLATION','ENTRY_AUTHORIZED',
    'WORK_IN_PROGRESS','READY_FOR_CLOSURE','READY_FOR_BLIND_REMOVAL','REINSTATED',
    'LEAK_TEST_PENDING','READY_FOR_SERVICE','CLOSED','SAFETY_HOLD'
  ) NOT NULL DEFAULT 'PLANNED',
  `recordVersion` int NOT NULL DEFAULT 1,
  `isLocked` int NOT NULL DEFAULT 0,
  `lockedAt` timestamp NULL,
  `lockedByOpenId` varchar(64),
  `lastTransitionAt` timestamp NULL,
  `migrationSourcePhase` varchar(80),
  `migrationVersion` int NOT NULL DEFAULT 2,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`blindTag`),
  KEY `blind_runtime_project_idx` (`projectId`),
  KEY `blind_runtime_phase_idx` (`phaseKey`),
  CONSTRAINT `blind_runtime_blind_fk` FOREIGN KEY (`blindTag`) REFERENCES `blinds`(`tag`),
  CONSTRAINT `blind_runtime_project_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`),
  CONSTRAINT `blind_runtime_template_fk` FOREIGN KEY (`workflowTemplateId`) REFERENCES `workflow_templates`(`id`)
);

CREATE TABLE `blind_phase_instances` (
  `id` int AUTO_INCREMENT NOT NULL,
  `blindTag` varchar(40) NOT NULL,
  `projectId` varchar(40) NOT NULL,
  `workflowTemplateId` varchar(96) NOT NULL,
  `phaseKey` enum(
    'broken','assembly','tightTorque','finalTight','inspectionReady',
    'operationsInitialIsolation','blindInstallation','mechanicalVerification','internalInspection',
    'reinstatementPreparation','blindRemovalReinstatement','reinstatementVerification',
    'finalApprovalReturnToService'
  ) NOT NULL,
  `sortOrder` int NOT NULL,
  `phaseInstanceStatus` enum('pending','current','completed','blocked','rework','skipped') NOT NULL DEFAULT 'pending',
  `assignedRoleKey` varchar(80) NOT NULL,
  `startedAt` timestamp NULL,
  `completedAt` timestamp NULL,
  `completedByOpenId` varchar(64),
  `approvedByOpenId` varchar(64),
  `checklistComplete` int NOT NULL DEFAULT 0,
  `evidenceComplete` int NOT NULL DEFAULT 0,
  `gateSnapshotJson` text,
  `recordVersion` int NOT NULL DEFAULT 1,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `blind_phase_instance_unique` (`blindTag`,`phaseKey`),
  KEY `blind_phase_project_idx` (`projectId`),
  CONSTRAINT `blind_phase_instance_blind_fk` FOREIGN KEY (`blindTag`) REFERENCES `blinds`(`tag`),
  CONSTRAINT `blind_phase_instance_project_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`),
  CONSTRAINT `blind_phase_instance_template_fk` FOREIGN KEY (`workflowTemplateId`) REFERENCES `workflow_templates`(`id`)
);

CREATE TABLE `blind_checklist_responses` (
  `id` int AUTO_INCREMENT NOT NULL,
  `blindTag` varchar(40) NOT NULL,
  `projectId` varchar(40) NOT NULL,
  `phaseKey` enum(
    'broken','assembly','tightTorque','finalTight','inspectionReady',
    'operationsInitialIsolation','blindInstallation','mechanicalVerification','internalInspection',
    'reinstatementPreparation','blindRemovalReinstatement','reinstatementVerification',
    'finalApprovalReturnToService'
  ) NOT NULL,
  `itemKey` varchar(160) NOT NULL,
  `itemLabel` varchar(500) NOT NULL,
  `required` int NOT NULL DEFAULT 1,
  `completed` int NOT NULL DEFAULT 0,
  `responseJson` text,
  `completedByOpenId` varchar(64),
  `completedAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `blind_checklist_unique` (`blindTag`,`phaseKey`,`itemKey`),
  CONSTRAINT `blind_checklist_blind_fk` FOREIGN KEY (`blindTag`) REFERENCES `blinds`(`tag`),
  CONSTRAINT `blind_checklist_project_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`)
);

CREATE TABLE `workflow_transition_events` (
  `id` int AUTO_INCREMENT NOT NULL,
  `blindTag` varchar(40) NOT NULL,
  `projectId` varchar(40) NOT NULL,
  `fromPhaseKey` enum(
    'broken','assembly','tightTorque','finalTight','inspectionReady',
    'operationsInitialIsolation','blindInstallation','mechanicalVerification','internalInspection',
    'reinstatementPreparation','blindRemovalReinstatement','reinstatementVerification',
    'finalApprovalReturnToService'
  ),
  `toPhaseKey` enum(
    'broken','assembly','tightTorque','finalTight','inspectionReady',
    'operationsInitialIsolation','blindInstallation','mechanicalVerification','internalInspection',
    'reinstatementPreparation','blindRemovalReinstatement','reinstatementVerification',
    'finalApprovalReturnToService'
  ) NOT NULL,
  `actionKey` varchar(120) NOT NULL,
  `transitionEventStatus` enum('accepted','rejected','override') NOT NULL,
  `blockingReasonsJson` text,
  `gateSnapshotJson` text,
  `reason` text,
  `actorOpenId` varchar(64) NOT NULL,
  `actorName` varchar(160),
  `recordVersionBefore` int NOT NULL,
  `recordVersionAfter` int NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  PRIMARY KEY (`id`),
  KEY `transition_blind_idx` (`blindTag`,`createdAt`),
  CONSTRAINT `transition_blind_fk` FOREIGN KEY (`blindTag`) REFERENCES `blinds`(`tag`),
  CONSTRAINT `transition_project_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`)
);

CREATE TABLE `isolation_packages` (
  `id` varchar(64) NOT NULL,
  `projectId` varchar(40) NOT NULL,
  `equipment` varchar(160) NOT NULL,
  `description` text,
  `packageStatus` enum('draft','active','entry_authorized','work_in_progress','ready_for_removal','reinstated','ready_for_service','closed','on_hold') NOT NULL DEFAULT 'draft',
  `recordVersion` int NOT NULL DEFAULT 1,
  `createdByOpenId` varchar(64),
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `isolation_package_project_idx` (`projectId`),
  CONSTRAINT `isolation_package_project_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`)
);

CREATE TABLE `isolation_package_blinds` (
  `id` int AUTO_INCREMENT NOT NULL,
  `packageId` varchar(64) NOT NULL,
  `blindTag` varchar(40) NOT NULL,
  `required` int NOT NULL DEFAULT 1,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  PRIMARY KEY (`id`),
  UNIQUE KEY `isolation_package_blind_unique` (`packageId`,`blindTag`),
  CONSTRAINT `package_blind_package_fk` FOREIGN KEY (`packageId`) REFERENCES `isolation_packages`(`id`),
  CONSTRAINT `package_blind_blind_fk` FOREIGN KEY (`blindTag`) REFERENCES `blinds`(`tag`)
);

CREATE TABLE `entry_readiness_records` (
  `id` int AUTO_INCREMENT NOT NULL,
  `packageId` varchar(64) NOT NULL,
  `entryReadinessStatus` enum('draft','ready','authorized','rejected','expired') NOT NULL DEFAULT 'draft',
  `allRequiredBlindsActive` int NOT NULL DEFAULT 0,
  `lotoActive` int NOT NULL DEFAULT 0,
  `pressureZero` int NOT NULL DEFAULT 0,
  `drainedAndPurged` int NOT NULL DEFAULT 0,
  `gasTestAcceptable` int NOT NULL DEFAULT 0,
  `confinedSpacePermitValid` int NOT NULL DEFAULT 0,
  `operationsApproved` int NOT NULL DEFAULT 0,
  `entrySupervisorApproved` int NOT NULL DEFAULT 0,
  `validUntil` timestamp NULL,
  `approvedByOpenId` varchar(64),
  `approvedAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `entry_package_idx` (`packageId`,`createdAt`),
  CONSTRAINT `entry_package_fk` FOREIGN KEY (`packageId`) REFERENCES `isolation_packages`(`id`)
);

CREATE TABLE `permit_records` (
  `id` int AUTO_INCREMENT NOT NULL,
  `blindTag` varchar(40) NOT NULL,
  `projectId` varchar(40) NOT NULL,
  `permitType` varchar(60) NOT NULL,
  `permitNumber` varchar(120) NOT NULL,
  `recordStatus` enum('draft','active','valid','expired','closed','cancelled','rejected') NOT NULL DEFAULT 'draft',
  `validFrom` timestamp NULL,
  `validUntil` timestamp NULL,
  `issuedByOpenId` varchar(64),
  `notes` text,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `permit_blind_idx` (`blindTag`,`permitType`,`createdAt`),
  CONSTRAINT `permit_blind_fk` FOREIGN KEY (`blindTag`) REFERENCES `blinds`(`tag`),
  CONSTRAINT `permit_project_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`)
);

CREATE TABLE `loto_records` (
  `id` int AUTO_INCREMENT NOT NULL,
  `blindTag` varchar(40) NOT NULL,
  `projectId` varchar(40) NOT NULL,
  `certificateNumber` varchar(120) NOT NULL,
  `recordStatus` enum('draft','active','valid','expired','closed','cancelled','rejected') NOT NULL DEFAULT 'draft',
  `lockNumbersJson` text,
  `zeroEnergyVerified` int NOT NULL DEFAULT 0,
  `appliedByOpenId` varchar(64),
  `verifiedByOpenId` varchar(64),
  `appliedAt` timestamp NULL,
  `releasedAt` timestamp NULL,
  `notes` text,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `loto_blind_idx` (`blindTag`,`createdAt`),
  CONSTRAINT `loto_blind_fk` FOREIGN KEY (`blindTag`) REFERENCES `blinds`(`tag`),
  CONSTRAINT `loto_project_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`)
);

CREATE TABLE `gas_test_records` (
  `id` int AUTO_INCREMENT NOT NULL,
  `blindTag` varchar(40) NOT NULL,
  `projectId` varchar(40) NOT NULL,
  `testPurpose` varchar(80) NOT NULL,
  `recordStatus` enum('draft','active','valid','expired','closed','cancelled','rejected') NOT NULL DEFAULT 'draft',
  `oxygenPercent` decimal(6,2),
  `lelPercent` decimal(6,2),
  `h2sPpm` decimal(8,2),
  `coPpm` decimal(8,2),
  `testerOpenId` varchar(64),
  `testerName` varchar(160),
  `instrumentId` varchar(120),
  `calibrationExpiry` timestamp NULL,
  `testedAt` timestamp NULL,
  `validUntil` timestamp NULL,
  `notes` text,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `gas_test_blind_idx` (`blindTag`,`testPurpose`,`testedAt`),
  CONSTRAINT `gas_test_blind_fk` FOREIGN KEY (`blindTag`) REFERENCES `blinds`(`tag`),
  CONSTRAINT `gas_test_project_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`)
);

CREATE TABLE `torque_records` (
  `id` int AUTO_INCREMENT NOT NULL,
  `blindTag` varchar(40) NOT NULL,
  `projectId` varchar(40) NOT NULL,
  `torqueStage` enum('installation','reinstatement') NOT NULL,
  `torqueStatus` enum('draft','submitted','accepted','rejected') NOT NULL DEFAULT 'draft',
  `procedureReference` varchar(160),
  `toolType` varchar(120) NOT NULL,
  `toolSerialNumber` varchar(120),
  `calibrationCertificateNumber` varchar(120),
  `calibrationExpiry` timestamp NULL,
  `targetTorque` decimal(12,3),
  `actualTorque` decimal(12,3),
  `torqueUnit` varchar(20) NOT NULL DEFAULT 'N·m',
  `pumpPressure` decimal(12,3),
  `pumpPressureUnit` varchar(20),
  `passesJson` text,
  `technicianOpenId` varchar(64),
  `witnessOpenId` varchar(64),
  `acceptedByOpenId` varchar(64),
  `completedAt` timestamp NULL,
  `acceptedAt` timestamp NULL,
  `notes` text,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `blind_torque_stage_unique` (`blindTag`,`torqueStage`),
  CONSTRAINT `torque_blind_fk` FOREIGN KEY (`blindTag`) REFERENCES `blinds`(`tag`),
  CONSTRAINT `torque_project_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`)
);

CREATE TABLE `leak_test_records` (
  `id` int AUTO_INCREMENT NOT NULL,
  `blindTag` varchar(40) NOT NULL,
  `projectId` varchar(40) NOT NULL,
  `leakTestStatus` enum('draft','in_progress','passed','failed','cancelled') NOT NULL DEFAULT 'draft',
  `testType` varchar(80),
  `testMedium` varchar(80),
  `testPressure` decimal(12,3),
  `pressureUnit` varchar(20),
  `durationMinutes` int,
  `noLeakObserved` int NOT NULL DEFAULT 0,
  `performedByOpenId` varchar(64),
  `acceptedByOpenId` varchar(64),
  `testedAt` timestamp NULL,
  `acceptedAt` timestamp NULL,
  `notes` text,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `blind_leak_test_unique` (`blindTag`),
  CONSTRAINT `leak_blind_fk` FOREIGN KEY (`blindTag`) REFERENCES `blinds`(`tag`),
  CONSTRAINT `leak_project_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`)
);

CREATE TABLE `safety_holds` (
  `id` int AUTO_INCREMENT NOT NULL,
  `blindTag` varchar(40) NOT NULL,
  `projectId` varchar(40) NOT NULL,
  `phaseKey` enum(
    'broken','assembly','tightTorque','finalTight','inspectionReady',
    'operationsInitialIsolation','blindInstallation','mechanicalVerification','internalInspection',
    'reinstatementPreparation','blindRemovalReinstatement','reinstatementVerification',
    'finalApprovalReturnToService'
  ) NOT NULL,
  `holdStatus` enum('active','release_pending','released','rejected') NOT NULL DEFAULT 'active',
  `reasonCode` varchar(80) NOT NULL,
  `description` text NOT NULL,
  `previousLifecycleStatus` varchar(40),
  `correctiveAction` text,
  `placedByOpenId` varchar(64) NOT NULL,
  `releaseRequestedByOpenId` varchar(64),
  `releaseRequestedAt` timestamp NULL,
  `releasedByOpenId` varchar(64),
  `releaseApprovedByOpenId` varchar(64),
  `placedAt` timestamp NOT NULL DEFAULT (now()),
  `releasedAt` timestamp NULL,
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `hold_blind_idx` (`blindTag`,`holdStatus`),
  CONSTRAINT `hold_blind_fk` FOREIGN KEY (`blindTag`) REFERENCES `blinds`(`tag`),
  CONSTRAINT `hold_project_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`)
);

CREATE TABLE `workflow_approval_steps` (
  `id` int AUTO_INCREMENT NOT NULL,
  `blindTag` varchar(40) NOT NULL,
  `projectId` varchar(40) NOT NULL,
  `phaseKey` enum(
    'broken','assembly','tightTorque','finalTight','inspectionReady',
    'operationsInitialIsolation','blindInstallation','mechanicalVerification','internalInspection',
    'reinstatementPreparation','blindRemovalReinstatement','reinstatementVerification',
    'finalApprovalReturnToService'
  ) NOT NULL,
  `approvalRoleKey` varchar(80) NOT NULL,
  `sequence` int NOT NULL,
  `conditional` int NOT NULL DEFAULT 0,
  `approvalStatus` enum('pending','approved','rejected','revoked','not_required') NOT NULL DEFAULT 'pending',
  `approvedByOpenId` varchar(64),
  `approvedByName` varchar(160),
  `note` text,
  `approvedAt` timestamp NULL,
  `revokedAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `workflow_approval_unique` (`blindTag`,`phaseKey`,`approvalRoleKey`),
  CONSTRAINT `workflow_approval_blind_fk` FOREIGN KEY (`blindTag`) REFERENCES `blinds`(`tag`),
  CONSTRAINT `workflow_approval_project_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`)
);

CREATE TABLE `workflow_evidence_attachments` (
  `id` int AUTO_INCREMENT NOT NULL,
  `blindTag` varchar(40) NOT NULL,
  `projectId` varchar(40) NOT NULL,
  `phaseKey` enum(
    'broken','assembly','tightTorque','finalTight','inspectionReady',
    'operationsInitialIsolation','blindInstallation','mechanicalVerification','internalInspection',
    'reinstatementPreparation','blindRemovalReinstatement','reinstatementVerification',
    'finalApprovalReturnToService'
  ) NOT NULL,
  `category` varchar(120) NOT NULL,
  `fileName` varchar(255) NOT NULL,
  `fileUrl` text NOT NULL,
  `mimeType` varchar(120),
  `fileSizeBytes` int,
  `uploadedByOpenId` varchar(64),
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  PRIMARY KEY (`id`),
  KEY `evidence_blind_phase_idx` (`blindTag`,`phaseKey`),
  CONSTRAINT `evidence_blind_fk` FOREIGN KEY (`blindTag`) REFERENCES `blinds`(`tag`),
  CONSTRAINT `evidence_project_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`)
);

-- Seed Sprint 2 RBAC catalog in the same migration so a fresh database is
-- protected before the first application request triggers runtime seeding.
INSERT INTO `access_permissions` (`key`,`label`,`description`,`group`,`createdAt`,`updatedAt`) VALUES
('workflow.phase.operations.complete','Complete Operations isolation','Complete initial isolation and Operations handover','Workflow & Sign-off',now(),now()),
('workflow.phase.installation.submit','Submit installation and torque','Submit blind installation and controlled-tightening records','Workflow & Sign-off',now(),now()),
('workflow.phase.mechanical.verify','Verify mechanical isolation','Independently verify installed positive isolation','Workflow & Sign-off',now(),now()),
('workflow.phase.inspection.manage','Manage inspection execution','Complete inspection and ready-for-closure records','Workflow & Sign-off',now(),now()),
('workflow.phase.removal.authorize','Authorize blind removal','Authorize controlled de-blinding preparation','Workflow & Sign-off',now(),now()),
('workflow.phase.reinstatement.submit','Submit reinstatement','Submit blind removal and reinstatement records','Workflow & Sign-off',now(),now()),
('workflow.phase.reinstatement.verify','Verify reinstatement and leak test','Approve final joint and leak/service-test verification','Workflow & Sign-off',now(),now()),
('workflow.phase.final.approve','Record final approval','Complete an assigned final approval step','Workflow & Sign-off',now(),now()),
('workflow.phase.returnToService.authorize','Final return-to-service authorization','Perform the final Operations authorization','Workflow & Sign-off',now(),now()),
('workflow.entry.prepare','Prepare vessel entry readiness','Record Operations readiness conditions for an Isolation Package','Workflow & Sign-off',now(),now()),
('workflow.entry.authorize','Authorize vessel entry','Authorize Vessel Entry Readiness as Entry Supervisor','Workflow & Sign-off',now(),now()),
('workflow.safety.hold','Place safety hold','Stop workflow progression for an unsafe condition','Workflow & Sign-off',now(),now()),
('workflow.safety.release','Release safety hold','Approve corrective action and release a safety hold','Workflow & Sign-off',now(),now()),
('workflow.record.gasTest','Record gas test','Create an authorized atmospheric gas-test record','Workflow & Sign-off',now(),now()),
('workflow.record.permit','Manage permit records','Create and update PTW and line-breaking permits','Workflow & Sign-off',now(),now()),
('workflow.record.loto','Manage LOTO records','Create, verify and close LOTO records','Workflow & Sign-off',now(),now()),
('workflow.record.leakTest','Manage leak-test records','Record and accept controlled leak or service tests','Workflow & Sign-off',now(),now()),
('workflow.package.manage','Manage isolation packages','Create Vessel Isolation Packages and link required Blinds','Workflow & Sign-off',now(),now())
ON DUPLICATE KEY UPDATE `label`=VALUES(`label`),`description`=VALUES(`description`),`group`=VALUES(`group`),`updatedAt`=VALUES(`updatedAt`);

INSERT INTO `access_roles` (`key`,`name`,`subtitle`,`members`,`color`,`menuKeysJson`,`phaseKeysJson`,`createdAt`,`updatedAt`) VALUES
('operations','Operations','Initial isolation, process handover and controlled de-isolation preparation',10,'#0f766e','["dashboard","projects","blinds","reports"]','["operationsInitialIsolation","reinstatementPreparation"]',now(),now()),
('operationsForeman','Operations Foreman','Final operating line-up and return-to-service authority',3,'#047857','["dashboard","projects","blinds","reports","audit"]','["finalApprovalReturnToService"]',now(),now()),
('gasTester','Authorized Gas Tester','Atmospheric testing, instrument verification and validity control',6,'#14b8a6','["dashboard","blinds"]','["operationsInitialIsolation","internalInspection","reinstatementPreparation"]',now(),now()),
('technician','Maintenance Technician','Blind installation, controlled tightening and reinstatement execution',16,'#2563eb','["dashboard","projects","blinds"]','["blindInstallation","blindRemovalReinstatement"]',now(),now()),
('mechanicalVerifier','Independent Mechanical Verifier','Independent positive-isolation and reinstatement verification',6,'#0891b2','["dashboard","blinds","reports","audit"]','["mechanicalVerification","reinstatementVerification"]',now(),now()),
('inspection','Inspection','Internal inspection, defect management and closure readiness',8,'#7c3aed','["dashboard","projects","blinds","reports"]','["internalInspection"]',now(),now()),
('entrySupervisor','Entry Supervisor','Confined-space entry readiness authorization',4,'#7c3aed','["dashboard","blinds"]','["internalInspection"]',now(),now()),
('coordinator','T&I Coordinator','Project setup, isolation-package control and final coordination approval',4,'#60a5fa','["dashboard","projects","blinds","reports"]','["finalApprovalReturnToService"]',now(),now()),
('metalForeman','Metal Foreman','Conditional slip-blind/spade mechanical approval',4,'#b45309','["dashboard","projects","blinds"]','["finalApprovalReturnToService"]',now(),now()),
('safety','Safety','Stop-work authority and independent hold-release governance',5,'#dc2626','["dashboard","projects","blinds","audit"]','[]',now(),now())
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`),`subtitle`=VALUES(`subtitle`),`color`=VALUES(`color`),`menuKeysJson`=VALUES(`menuKeysJson`),`phaseKeysJson`=VALUES(`phaseKeysJson`),`updatedAt`=VALUES(`updatedAt`);

INSERT INTO `access_role_permissions` (`roleKey`,`permissionKey`,`createdAt`)
SELECT candidates.`roleKey`, candidates.`permissionKey`, now()
FROM (
  SELECT 'operations' AS `roleKey`, 'workflow.phase.operations.complete' AS `permissionKey`
  UNION ALL SELECT 'operations' AS `roleKey`, 'workflow.phase.removal.authorize' AS `permissionKey`
  UNION ALL SELECT 'operations' AS `roleKey`, 'workflow.entry.prepare' AS `permissionKey`
  UNION ALL SELECT 'operations' AS `roleKey`, 'workflow.record.permit' AS `permissionKey`
  UNION ALL SELECT 'operations' AS `roleKey`, 'workflow.record.loto' AS `permissionKey`
  UNION ALL SELECT 'operations' AS `roleKey`, 'workflow.safety.hold' AS `permissionKey`
  UNION ALL SELECT 'operationsForeman' AS `roleKey`, 'workflow.phase.final.approve' AS `permissionKey`
  UNION ALL SELECT 'operationsForeman' AS `roleKey`, 'workflow.phase.returnToService.authorize' AS `permissionKey`
  UNION ALL SELECT 'operationsForeman' AS `roleKey`, 'workflow.entry.prepare' AS `permissionKey`
  UNION ALL SELECT 'operationsForeman' AS `roleKey`, 'workflow.record.permit' AS `permissionKey`
  UNION ALL SELECT 'operationsForeman' AS `roleKey`, 'workflow.record.loto' AS `permissionKey`
  UNION ALL SELECT 'operationsForeman' AS `roleKey`, 'workflow.package.manage' AS `permissionKey`
  UNION ALL SELECT 'operationsForeman' AS `roleKey`, 'workflow.safety.hold' AS `permissionKey`
  UNION ALL SELECT 'operationsForeman' AS `roleKey`, 'workflow.safety.release' AS `permissionKey`
  UNION ALL SELECT 'gasTester' AS `roleKey`, 'workflow.record.gasTest' AS `permissionKey`
  UNION ALL SELECT 'gasTester' AS `roleKey`, 'workflow.safety.hold' AS `permissionKey`
  UNION ALL SELECT 'technician' AS `roleKey`, 'workflow.phase.installation.submit' AS `permissionKey`
  UNION ALL SELECT 'technician' AS `roleKey`, 'workflow.phase.reinstatement.submit' AS `permissionKey`
  UNION ALL SELECT 'technician' AS `roleKey`, 'workflow.safety.hold' AS `permissionKey`
  UNION ALL SELECT 'mechanicalVerifier' AS `roleKey`, 'workflow.phase.mechanical.verify' AS `permissionKey`
  UNION ALL SELECT 'mechanicalVerifier' AS `roleKey`, 'workflow.phase.reinstatement.verify' AS `permissionKey`
  UNION ALL SELECT 'mechanicalVerifier' AS `roleKey`, 'workflow.record.leakTest' AS `permissionKey`
  UNION ALL SELECT 'mechanicalVerifier' AS `roleKey`, 'workflow.safety.hold' AS `permissionKey`
  UNION ALL SELECT 'mechanicalVerifier' AS `roleKey`, 'workflow.safety.release' AS `permissionKey`
  UNION ALL SELECT 'inspection' AS `roleKey`, 'workflow.phase.inspection.manage' AS `permissionKey`
  UNION ALL SELECT 'inspection' AS `roleKey`, 'workflow.phase.final.approve' AS `permissionKey`
  UNION ALL SELECT 'inspection' AS `roleKey`, 'workflow.safety.hold' AS `permissionKey`
  UNION ALL SELECT 'entrySupervisor' AS `roleKey`, 'workflow.entry.authorize' AS `permissionKey`
  UNION ALL SELECT 'entrySupervisor' AS `roleKey`, 'workflow.safety.hold' AS `permissionKey`
  UNION ALL SELECT 'coordinator' AS `roleKey`, 'workflow.phase.final.approve' AS `permissionKey`
  UNION ALL SELECT 'coordinator' AS `roleKey`, 'workflow.package.manage' AS `permissionKey`
  UNION ALL SELECT 'metalForeman' AS `roleKey`, 'workflow.phase.final.approve' AS `permissionKey`
  UNION ALL SELECT 'metalForeman' AS `roleKey`, 'workflow.safety.hold' AS `permissionKey`
  UNION ALL SELECT 'safety' AS `roleKey`, 'workflow.safety.hold' AS `permissionKey`
  UNION ALL SELECT 'safety' AS `roleKey`, 'workflow.safety.release' AS `permissionKey`
) candidates
LEFT JOIN `access_role_permissions` existing
  ON existing.`roleKey`=candidates.`roleKey` AND existing.`permissionKey`=candidates.`permissionKey`
WHERE existing.`id` IS NULL;

-- Ensure the canonical workflow exists even before application seed execution.
INSERT INTO `workflow_templates`
(`id`,`name`,`description`,`status`,`projectType`,`version`,`createdByOpenId`,`updatedByOpenId`,`createdAt`,`updatedAt`)
VALUES
('wf-sbts-standard-v2','SBTS Standard 8-Phase Isolation Lifecycle',
 'Canonical positive-isolation lifecycle with server-side gates, independent verification, reinstatement and return to service.',
 'Active','Tank / Vessel / Drum Isolation','2.0','sprint2-migration','sprint2-migration',now(),now())
ON DUPLICATE KEY UPDATE
  `name`=VALUES(`name`), `description`=VALUES(`description`), `status`=VALUES(`status`),
  `projectType`=VALUES(`projectType`), `version`=VALUES(`version`),
  `updatedByOpenId`=VALUES(`updatedByOpenId`), `updatedAt`=VALUES(`updatedAt`);

INSERT INTO `workflow_phases`
(`id`,`workflowId`,`sortOrder`,`label`,`phaseKey`,`roleKey`,`requiredPermissionKey`,`gate`,`slaHours`,`evidenceJson`,`automation`,`color`,`isCritical`,`purpose`,`actionKey`,`actionLabel`,`checklistJson`,`createdAt`,`updatedAt`)
VALUES
('wf-v2-1-operationsInitialIsolation','wf-sbts-standard-v2',1,'Operations Initial Isolation','operationsInitialIsolation','operations','workflow.phase.operations.complete','PTW and LOTO active; zero pressure and Operations authorization.',8,'["PTW","LOTO certificate","Isolation plan","Gas test record","Operations handover"]','Evaluate initial isolation gates','#0f766e',1,'Establish initial process and energy isolation.','completeInitialIsolation','Complete Initial Isolation','["Equipment shutdown confirmed","Required isolation valves secured","LOTO applied and verified","Pressure verified zero","Drain and vent completed","Purge or flush completed where required","Initial gas test valid where required","Line-breaking authorization issued"]',now(),now()),
('wf-v2-2-blindInstallation','wf-sbts-standard-v2',2,'Blind Installation & Controlled Tightening','blindInstallation','technician','workflow.phase.installation.submit','Correct blind and joint details verified; installation torque complete.',12,'["Before photo","Installed blind photo","Torque record","Calibration certificate","Blind tag / QR"]','Evaluate installation and torque gates','#2563eb',1,'Install positive isolation and complete controlled tightening.','submitInstallationRecord','Submit Installation & Torque Record','["Permit and Operations handover verified","Zero pressure reconfirmed","Correct blind specification verified","Flange faces and alignment accepted","Approved new gasket installed","Bolting specification verified","Controlled tightening completed","Blind tag, QR and evidence attached"]',now(),now()),
('wf-v2-3-mechanicalVerification','wf-sbts-standard-v2',3,'Independent Mechanical Verification','mechanicalVerification','mechanicalVerifier','workflow.phase.mechanical.verify','Independent verifier accepts isolation and joint integrity.',8,'["Mechanical verification checklist","Verifier signature","Installation photos","Torque record"]','Evaluate independence and verification gates','#0891b2',1,'Independently verify positive isolation.','approveMechanicalVerification','Approve Positive Isolation','["Correct isolation point and blind verified","Blind size, class, material and thickness verified","Gasket and flange alignment accepted","Bolt engagement and stud projection accepted","Torque record and final pass reviewed","Tool calibration valid","No visible leakage or pressure build-up","Independent sign-off completed"]',now(),now()),
('wf-v2-4-internalInspection','wf-sbts-standard-v2',4,'Internal Inspection & Work Execution','internalInspection','inspection','workflow.phase.inspection.manage','Entry readiness and inspection closeout requirements complete.',24,'["Entry readiness record","Inspection reports","Defect notifications","Internal photos","Ready-for-closure sign-off"]','Evaluate entry and inspection gates','#7c3aed',0,'Manage entry readiness, inspection and closure readiness.','declareReadyForClosure','Declare Ready for Closure','["Vessel entry readiness gate passed where applicable","Manway condition recorded","Configured inspection activities completed","Defects and notifications recorded","Required repairs or NDT completed","Internal cleanliness accepted","Personnel and tools accounted for","Ready-for-closure authorization completed"]',now(),now()),
('wf-v2-5-reinstatementPreparation','wf-sbts-standard-v2',5,'Reinstatement Preparation & Authorization','reinstatementPreparation','operations','workflow.phase.removal.authorize','Inspection clearance, permit reconciliation and Operations removal authorization complete.',8,'["Inspection clearance","Personnel/tool clearance","Permit reconciliation","Operations removal authorization"]','Evaluate de-blinding preparation gates','#d97706',1,'Prepare and authorize controlled blind removal.','authorizeBlindRemoval','Authorize Blind Removal','["Inspection clearance received","All work complete and personnel accounted for","Tools and temporary materials removed","Manway and internal closure accepted","Related and conflicting permits reconciled","No work group relies on this isolation","No pressure build-up behind blind","Blind removal authorization issued"]',now(),now()),
('wf-v2-6-blindRemovalReinstatement','wf-sbts-standard-v2',6,'Blind Removal & Reinstatement','blindRemovalReinstatement','technician','workflow.phase.reinstatement.submit','Authorized removal, restored service position and reinstatement torque complete.',12,'["Removal photo","Blind condition record","Reinstatement photo","Reinstatement torque record","Storage/custody record"]','Evaluate reinstatement execution gates','#ea580c',1,'Remove/reposition blind and restore disturbed joint.','submitReinstatementRecord','Submit Reinstatement & Torque Record','["Removal authorization and permit verified","LOTO and initial isolation remain controlled","Vent/drain checked immediately before opening","Blind removed or moved to service position","Blind identity and condition recorded","Approved new gasket installed","Controlled tightening completed","Register and evidence updated"]',now(),now()),
('wf-v2-7-reinstatementVerification','wf-sbts-standard-v2',7,'Independent Reinstatement Verification & Leak Test','reinstatementVerification','mechanicalVerifier','workflow.phase.reinstatement.verify','Restored configuration accepted and leak/service test passed.',8,'["Final mechanical checklist","Leak test record","Final photos","Register reconciliation"]','Evaluate final mechanical and leak-test gates','#16a34a',1,'Verify reinstatement and leak test.','approveReinstatement','Approve Reinstatement','["Correct blind removed or service position restored","No unintended blind remains installed","Gasket, bolting and flange alignment accepted","Reinstatement torque and calibration reviewed","Drains and vents restored","Blind register reconciled","Controlled pressurization completed","Leak/service test passed"]',now(),now()),
('wf-v2-8-finalApprovalReturnToService','wf-sbts-standard-v2',8,'Final Approval & Return to Service','finalApprovalReturnToService','operationsForeman','workflow.phase.returnToService.authorize','Sequential approvals complete; LOTO closeout and final line-up accepted.',8,'["Approval chain","Final line-up","LOTO closeout","Locked certificate"]','Evaluate final approval chain and lock record','#15803d',1,'Authorize return to service and lock final record.','authorizeReturnToService','Authorize Return to Service','["Inspection approval complete","T&I Coordinator approval complete","Mechanical/Metal Foreman approval complete when applicable","Operations Foreman final approval complete","LOTO removal controlled and recorded","Final operating line-up verified","Certificate readiness checks passed","Package closed and certificate locked"]',now(),now())
ON DUPLICATE KEY UPDATE
  `sortOrder`=VALUES(`sortOrder`), `label`=VALUES(`label`), `phaseKey`=VALUES(`phaseKey`),
  `roleKey`=VALUES(`roleKey`), `requiredPermissionKey`=VALUES(`requiredPermissionKey`),
  `gate`=VALUES(`gate`), `slaHours`=VALUES(`slaHours`), `evidenceJson`=VALUES(`evidenceJson`),
  `automation`=VALUES(`automation`), `color`=VALUES(`color`), `isCritical`=VALUES(`isCritical`),
  `purpose`=VALUES(`purpose`), `actionKey`=VALUES(`actionKey`), `actionLabel`=VALUES(`actionLabel`),
  `checklistJson`=VALUES(`checklistJson`), `updatedAt`=VALUES(`updatedAt`);

INSERT IGNORE INTO `project_workflow_assignments`
(`projectId`,`workflowTemplateId`,`workflowVersion`,`assignmentStatus`,`migrationVersion`,`assignedByOpenId`,`assignedAt`,`updatedAt`)
SELECT `id`,'wf-sbts-standard-v2','2.0','active',2,'sprint2-migration',now(),now() FROM `projects`;

INSERT IGNORE INTO `blind_workflow_runtime`
(`blindTag`,`projectId`,`workflowTemplateId`,`workflowVersion`,`phaseKey`,`lifecycleStatus`,`recordVersion`,`isLocked`,`migrationSourcePhase`,`migrationVersion`,`createdAt`,`updatedAt`)
SELECT b.`tag`,b.`projectId`,'wf-sbts-standard-v2','2.0',
  CASE b.`blindPhase`
    WHEN 'Broken / Preparation' THEN 'operationsInitialIsolation'
    WHEN 'Assembly' THEN 'blindInstallation'
    WHEN 'Tight & Torque' THEN 'blindInstallation'
    WHEN 'Final Tight' THEN 'mechanicalVerification'
    WHEN 'Inspection Ready' THEN 'internalInspection'
    ELSE 'operationsInitialIsolation'
  END,
  CASE b.`blindPhase`
    WHEN 'Broken / Preparation' THEN 'INITIAL_ISOLATION'
    WHEN 'Assembly' THEN 'READY_FOR_BLIND_INSTALLATION'
    WHEN 'Tight & Torque' THEN 'BLIND_INSTALLED'
    WHEN 'Final Tight' THEN 'MECHANICAL_VERIFICATION_PENDING'
    WHEN 'Inspection Ready' THEN 'WORK_IN_PROGRESS'
    ELSE 'PLANNED'
  END,
  1,0,b.`blindPhase`,2,now(),now()
FROM `blinds` b;

INSERT IGNORE INTO `blind_phase_instances`
(`blindTag`,`projectId`,`workflowTemplateId`,`phaseKey`,`sortOrder`,`phaseInstanceStatus`,`assignedRoleKey`,`startedAt`,`completedAt`,`checklistComplete`,`evidenceComplete`,`recordVersion`,`createdAt`,`updatedAt`)
SELECT b.`tag`,b.`projectId`,p.`workflowId`,p.`phaseKey`,p.`sortOrder`,
  CASE
    WHEN p.`sortOrder` < CASE b.`blindPhase`
      WHEN 'Broken / Preparation' THEN 1 WHEN 'Assembly' THEN 2 WHEN 'Tight & Torque' THEN 2
      WHEN 'Final Tight' THEN 3 WHEN 'Inspection Ready' THEN 4 ELSE 1 END THEN 'completed'
    WHEN p.`sortOrder` = CASE b.`blindPhase`
      WHEN 'Broken / Preparation' THEN 1 WHEN 'Assembly' THEN 2 WHEN 'Tight & Torque' THEN 2
      WHEN 'Final Tight' THEN 3 WHEN 'Inspection Ready' THEN 4 ELSE 1 END THEN 'current'
    ELSE 'pending'
  END,
  p.`roleKey`,
  CASE WHEN p.`sortOrder` <= CASE b.`blindPhase`
      WHEN 'Broken / Preparation' THEN 1 WHEN 'Assembly' THEN 2 WHEN 'Tight & Torque' THEN 2
      WHEN 'Final Tight' THEN 3 WHEN 'Inspection Ready' THEN 4 ELSE 1 END THEN now() ELSE NULL END,
  CASE WHEN p.`sortOrder` < CASE b.`blindPhase`
      WHEN 'Broken / Preparation' THEN 1 WHEN 'Assembly' THEN 2 WHEN 'Tight & Torque' THEN 2
      WHEN 'Final Tight' THEN 3 WHEN 'Inspection Ready' THEN 4 ELSE 1 END THEN now() ELSE NULL END,
  0,0,1,now(),now()
FROM `blinds` b
JOIN `workflow_phases` p ON p.`workflowId`='wf-sbts-standard-v2';


-- Materialize canonical checklist instances without JSON_TABLE so the migration
-- remains compatible with the project's TiDB/MySQL deployment targets.
INSERT IGNORE INTO `blind_checklist_responses`
(`blindTag`,`projectId`,`phaseKey`,`itemKey`,`itemLabel`,`required`,`completed`,`createdAt`,`updatedAt`)
SELECT b.`tag`, b.`projectId`, c.`phaseKey`, c.`itemKey`, c.`itemLabel`, 1, 0, now(), now()
FROM `blinds` b
CROSS JOIN (
  SELECT 'operationsInitialIsolation' AS `phaseKey`, '01-equipment-shutdown-confirmed' AS `itemKey`, 'Equipment shutdown confirmed' AS `itemLabel`
  UNION ALL SELECT 'operationsInitialIsolation' AS `phaseKey`, '02-required-isolation-valves-secured' AS `itemKey`, 'Required isolation valves secured' AS `itemLabel`
  UNION ALL SELECT 'operationsInitialIsolation' AS `phaseKey`, '03-loto-applied-and-verified' AS `itemKey`, 'LOTO applied and verified' AS `itemLabel`
  UNION ALL SELECT 'operationsInitialIsolation' AS `phaseKey`, '04-pressure-verified-zero' AS `itemKey`, 'Pressure verified zero' AS `itemLabel`
  UNION ALL SELECT 'operationsInitialIsolation' AS `phaseKey`, '05-drain-and-vent-completed' AS `itemKey`, 'Drain and vent completed' AS `itemLabel`
  UNION ALL SELECT 'operationsInitialIsolation' AS `phaseKey`, '06-purge-or-flush-completed-where-required' AS `itemKey`, 'Purge or flush completed where required' AS `itemLabel`
  UNION ALL SELECT 'operationsInitialIsolation' AS `phaseKey`, '07-initial-gas-test-valid-where-required' AS `itemKey`, 'Initial gas test valid where required' AS `itemLabel`
  UNION ALL SELECT 'operationsInitialIsolation' AS `phaseKey`, '08-line-breaking-authorization-issued' AS `itemKey`, 'Line-breaking authorization issued' AS `itemLabel`
  UNION ALL SELECT 'blindInstallation' AS `phaseKey`, '01-permit-and-operations-handover-verified' AS `itemKey`, 'Permit and Operations handover verified' AS `itemLabel`
  UNION ALL SELECT 'blindInstallation' AS `phaseKey`, '02-zero-pressure-reconfirmed' AS `itemKey`, 'Zero pressure reconfirmed' AS `itemLabel`
  UNION ALL SELECT 'blindInstallation' AS `phaseKey`, '03-correct-blind-specification-verified' AS `itemKey`, 'Correct blind specification verified' AS `itemLabel`
  UNION ALL SELECT 'blindInstallation' AS `phaseKey`, '04-flange-faces-and-alignment-accepted' AS `itemKey`, 'Flange faces and alignment accepted' AS `itemLabel`
  UNION ALL SELECT 'blindInstallation' AS `phaseKey`, '05-approved-new-gasket-installed' AS `itemKey`, 'Approved new gasket installed' AS `itemLabel`
  UNION ALL SELECT 'blindInstallation' AS `phaseKey`, '06-bolting-specification-verified' AS `itemKey`, 'Bolting specification verified' AS `itemLabel`
  UNION ALL SELECT 'blindInstallation' AS `phaseKey`, '07-controlled-tightening-completed' AS `itemKey`, 'Controlled tightening completed' AS `itemLabel`
  UNION ALL SELECT 'blindInstallation' AS `phaseKey`, '08-blind-tag-qr-and-evidence-attached' AS `itemKey`, 'Blind tag, QR and evidence attached' AS `itemLabel`
  UNION ALL SELECT 'mechanicalVerification' AS `phaseKey`, '01-correct-isolation-point-and-blind-verified' AS `itemKey`, 'Correct isolation point and blind verified' AS `itemLabel`
  UNION ALL SELECT 'mechanicalVerification' AS `phaseKey`, '02-blind-size-class-material-and-thickness-verified' AS `itemKey`, 'Blind size, class, material and thickness verified' AS `itemLabel`
  UNION ALL SELECT 'mechanicalVerification' AS `phaseKey`, '03-gasket-and-flange-alignment-accepted' AS `itemKey`, 'Gasket and flange alignment accepted' AS `itemLabel`
  UNION ALL SELECT 'mechanicalVerification' AS `phaseKey`, '04-bolt-engagement-and-stud-projection-accepted' AS `itemKey`, 'Bolt engagement and stud projection accepted' AS `itemLabel`
  UNION ALL SELECT 'mechanicalVerification' AS `phaseKey`, '05-torque-record-and-final-pass-reviewed' AS `itemKey`, 'Torque record and final pass reviewed' AS `itemLabel`
  UNION ALL SELECT 'mechanicalVerification' AS `phaseKey`, '06-tool-calibration-valid' AS `itemKey`, 'Tool calibration valid' AS `itemLabel`
  UNION ALL SELECT 'mechanicalVerification' AS `phaseKey`, '07-no-visible-leakage-or-pressure-build-up' AS `itemKey`, 'No visible leakage or pressure build-up' AS `itemLabel`
  UNION ALL SELECT 'mechanicalVerification' AS `phaseKey`, '08-independent-sign-off-completed' AS `itemKey`, 'Independent sign-off completed' AS `itemLabel`
  UNION ALL SELECT 'internalInspection' AS `phaseKey`, '01-vessel-entry-readiness-gate-passed-where-applicable' AS `itemKey`, 'Vessel entry readiness gate passed where applicable' AS `itemLabel`
  UNION ALL SELECT 'internalInspection' AS `phaseKey`, '02-manway-condition-recorded' AS `itemKey`, 'Manway condition recorded' AS `itemLabel`
  UNION ALL SELECT 'internalInspection' AS `phaseKey`, '03-configured-inspection-activities-completed' AS `itemKey`, 'Configured inspection activities completed' AS `itemLabel`
  UNION ALL SELECT 'internalInspection' AS `phaseKey`, '04-defects-and-notifications-recorded' AS `itemKey`, 'Defects and notifications recorded' AS `itemLabel`
  UNION ALL SELECT 'internalInspection' AS `phaseKey`, '05-required-repairs-or-ndt-completed' AS `itemKey`, 'Required repairs or NDT completed' AS `itemLabel`
  UNION ALL SELECT 'internalInspection' AS `phaseKey`, '06-internal-cleanliness-accepted' AS `itemKey`, 'Internal cleanliness accepted' AS `itemLabel`
  UNION ALL SELECT 'internalInspection' AS `phaseKey`, '07-personnel-and-tools-accounted-for' AS `itemKey`, 'Personnel and tools accounted for' AS `itemLabel`
  UNION ALL SELECT 'internalInspection' AS `phaseKey`, '08-ready-for-closure-authorization-completed' AS `itemKey`, 'Ready-for-closure authorization completed' AS `itemLabel`
  UNION ALL SELECT 'reinstatementPreparation' AS `phaseKey`, '01-inspection-clearance-received' AS `itemKey`, 'Inspection clearance received' AS `itemLabel`
  UNION ALL SELECT 'reinstatementPreparation' AS `phaseKey`, '02-all-work-complete-and-personnel-accounted-for' AS `itemKey`, 'All work complete and personnel accounted for' AS `itemLabel`
  UNION ALL SELECT 'reinstatementPreparation' AS `phaseKey`, '03-tools-and-temporary-materials-removed' AS `itemKey`, 'Tools and temporary materials removed' AS `itemLabel`
  UNION ALL SELECT 'reinstatementPreparation' AS `phaseKey`, '04-manway-and-internal-closure-accepted' AS `itemKey`, 'Manway and internal closure accepted' AS `itemLabel`
  UNION ALL SELECT 'reinstatementPreparation' AS `phaseKey`, '05-related-and-conflicting-permits-reconciled' AS `itemKey`, 'Related and conflicting permits reconciled' AS `itemLabel`
  UNION ALL SELECT 'reinstatementPreparation' AS `phaseKey`, '06-no-work-group-relies-on-this-isolation' AS `itemKey`, 'No work group relies on this isolation' AS `itemLabel`
  UNION ALL SELECT 'reinstatementPreparation' AS `phaseKey`, '07-no-pressure-build-up-behind-blind' AS `itemKey`, 'No pressure build-up behind blind' AS `itemLabel`
  UNION ALL SELECT 'reinstatementPreparation' AS `phaseKey`, '08-blind-removal-authorization-issued' AS `itemKey`, 'Blind removal authorization issued' AS `itemLabel`
  UNION ALL SELECT 'blindRemovalReinstatement' AS `phaseKey`, '01-removal-authorization-and-permit-verified' AS `itemKey`, 'Removal authorization and permit verified' AS `itemLabel`
  UNION ALL SELECT 'blindRemovalReinstatement' AS `phaseKey`, '02-loto-and-initial-isolation-remain-controlled' AS `itemKey`, 'LOTO and initial isolation remain controlled' AS `itemLabel`
  UNION ALL SELECT 'blindRemovalReinstatement' AS `phaseKey`, '03-vent-drain-checked-immediately-before-opening' AS `itemKey`, 'Vent/drain checked immediately before opening' AS `itemLabel`
  UNION ALL SELECT 'blindRemovalReinstatement' AS `phaseKey`, '04-blind-removed-or-moved-to-service-position' AS `itemKey`, 'Blind removed or moved to service position' AS `itemLabel`
  UNION ALL SELECT 'blindRemovalReinstatement' AS `phaseKey`, '05-blind-identity-and-condition-recorded' AS `itemKey`, 'Blind identity and condition recorded' AS `itemLabel`
  UNION ALL SELECT 'blindRemovalReinstatement' AS `phaseKey`, '06-approved-new-gasket-installed' AS `itemKey`, 'Approved new gasket installed' AS `itemLabel`
  UNION ALL SELECT 'blindRemovalReinstatement' AS `phaseKey`, '07-controlled-tightening-completed' AS `itemKey`, 'Controlled tightening completed' AS `itemLabel`
  UNION ALL SELECT 'blindRemovalReinstatement' AS `phaseKey`, '08-register-and-evidence-updated' AS `itemKey`, 'Register and evidence updated' AS `itemLabel`
  UNION ALL SELECT 'reinstatementVerification' AS `phaseKey`, '01-correct-blind-removed-or-service-position-restored' AS `itemKey`, 'Correct blind removed or service position restored' AS `itemLabel`
  UNION ALL SELECT 'reinstatementVerification' AS `phaseKey`, '02-no-unintended-blind-remains-installed' AS `itemKey`, 'No unintended blind remains installed' AS `itemLabel`
  UNION ALL SELECT 'reinstatementVerification' AS `phaseKey`, '03-gasket-bolting-and-flange-alignment-accepted' AS `itemKey`, 'Gasket, bolting and flange alignment accepted' AS `itemLabel`
  UNION ALL SELECT 'reinstatementVerification' AS `phaseKey`, '04-reinstatement-torque-and-calibration-reviewed' AS `itemKey`, 'Reinstatement torque and calibration reviewed' AS `itemLabel`
  UNION ALL SELECT 'reinstatementVerification' AS `phaseKey`, '05-drains-and-vents-restored' AS `itemKey`, 'Drains and vents restored' AS `itemLabel`
  UNION ALL SELECT 'reinstatementVerification' AS `phaseKey`, '06-blind-register-reconciled' AS `itemKey`, 'Blind register reconciled' AS `itemLabel`
  UNION ALL SELECT 'reinstatementVerification' AS `phaseKey`, '07-controlled-pressurization-completed' AS `itemKey`, 'Controlled pressurization completed' AS `itemLabel`
  UNION ALL SELECT 'reinstatementVerification' AS `phaseKey`, '08-leak-service-test-passed' AS `itemKey`, 'Leak/service test passed' AS `itemLabel`
  UNION ALL SELECT 'finalApprovalReturnToService' AS `phaseKey`, '01-inspection-approval-complete' AS `itemKey`, 'Inspection approval complete' AS `itemLabel`
  UNION ALL SELECT 'finalApprovalReturnToService' AS `phaseKey`, '02-t-i-coordinator-approval-complete' AS `itemKey`, 'T&I Coordinator approval complete' AS `itemLabel`
  UNION ALL SELECT 'finalApprovalReturnToService' AS `phaseKey`, '03-mechanical-metal-foreman-approval-complete-when-applicable' AS `itemKey`, 'Mechanical/Metal Foreman approval complete when applicable' AS `itemLabel`
  UNION ALL SELECT 'finalApprovalReturnToService' AS `phaseKey`, '04-operations-foreman-final-approval-complete' AS `itemKey`, 'Operations Foreman final approval complete' AS `itemLabel`
  UNION ALL SELECT 'finalApprovalReturnToService' AS `phaseKey`, '05-loto-removal-controlled-and-recorded' AS `itemKey`, 'LOTO removal controlled and recorded' AS `itemLabel`
  UNION ALL SELECT 'finalApprovalReturnToService' AS `phaseKey`, '06-final-operating-line-up-verified' AS `itemKey`, 'Final operating line-up verified' AS `itemLabel`
  UNION ALL SELECT 'finalApprovalReturnToService' AS `phaseKey`, '07-certificate-readiness-checks-passed' AS `itemKey`, 'Certificate readiness checks passed' AS `itemLabel`
  UNION ALL SELECT 'finalApprovalReturnToService' AS `phaseKey`, '08-package-closed-and-certificate-locked' AS `itemKey`, 'Package closed and certificate locked' AS `itemLabel`
) c;

-- Create the default final approval chain. Runtime policy reconciliation updates
-- conditional roles and not-required states when the record is first opened.
INSERT IGNORE INTO `workflow_approval_steps`
(`blindTag`,`projectId`,`phaseKey`,`approvalRoleKey`,`sequence`,`conditional`,`approvalStatus`,`createdAt`,`updatedAt`)
SELECT b.`tag`,b.`projectId`,'finalApprovalReturnToService','inspection',1,0,'pending',now(),now() FROM `blinds` b;
INSERT IGNORE INTO `workflow_approval_steps`
(`blindTag`,`projectId`,`phaseKey`,`approvalRoleKey`,`sequence`,`conditional`,`approvalStatus`,`createdAt`,`updatedAt`)
SELECT b.`tag`,b.`projectId`,'finalApprovalReturnToService','coordinator',2,0,'pending',now(),now() FROM `blinds` b;
INSERT IGNORE INTO `workflow_approval_steps`
(`blindTag`,`projectId`,`phaseKey`,`approvalRoleKey`,`sequence`,`conditional`,`approvalStatus`,`createdAt`,`updatedAt`)
SELECT b.`tag`,b.`projectId`,'finalApprovalReturnToService',
  CASE WHEN LOWER(REPLACE(REPLACE(REPLACE(b.`type`,' ',''),'-',''),'/','')) LIKE '%slipblind%'
          OR LOWER(REPLACE(REPLACE(REPLACE(b.`type`,' ',''),'-',''),'/','')) LIKE '%spade%'
       THEN 'metalForeman' ELSE 'mechanicalVerifier' END,
  3,1,'pending',now(),now() FROM `blinds` b;
INSERT IGNORE INTO `workflow_approval_steps`
(`blindTag`,`projectId`,`phaseKey`,`approvalRoleKey`,`sequence`,`conditional`,`approvalStatus`,`createdAt`,`updatedAt`)
SELECT b.`tag`,b.`projectId`,'finalApprovalReturnToService','operationsForeman',4,0,'pending',now(),now() FROM `blinds` b;
