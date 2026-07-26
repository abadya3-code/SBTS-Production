ALTER TABLE `workflow_policy_settings`
  ADD COLUMN `requireEvidenceBeforePhaseSubmit` int NOT NULL DEFAULT 0,
  ADD COLUMN `evidenceMaxFileSizeMb` int NOT NULL DEFAULT 10,
  ADD COLUMN `evidenceAllowedMimeTypesJson` text,
  ADD COLUMN `defaultTorqueUnit` varchar(20) NOT NULL DEFAULT 'N·m',
  ADD COLUMN `defaultPumpPressureUnit` varchar(20) NOT NULL DEFAULT 'psi',
  ADD COLUMN `fieldRecordEditorMode` varchar(20) NOT NULL DEFAULT 'dialog';

UPDATE `workflow_policy_settings`
SET `evidenceAllowedMimeTypesJson`='["image/jpeg","image/png","image/webp","application/pdf"]'
WHERE `evidenceAllowedMimeTypesJson` IS NULL OR TRIM(`evidenceAllowedMimeTypesJson`)='';

INSERT INTO `access_permissions` (`key`,`label`,`description`,`group`,`createdAt`,`updatedAt`) VALUES
('workflow.record.evidence','Manage workflow evidence','Upload and remove controlled photos and documents for the active workflow phase','Workflow & Sign-off',now(),now())
ON DUPLICATE KEY UPDATE `label`=VALUES(`label`),`description`=VALUES(`description`),`group`=VALUES(`group`),`updatedAt`=VALUES(`updatedAt`);

INSERT INTO `access_role_permissions` (`roleKey`,`permissionKey`,`createdAt`)
SELECT candidates.`roleKey`, candidates.`permissionKey`, now()
FROM (
  SELECT 'operations' AS `roleKey`, 'workflow.record.evidence' AS `permissionKey`
  UNION ALL SELECT 'operationsForeman', 'workflow.record.evidence'
  UNION ALL SELECT 'gasTester', 'workflow.record.evidence'
  UNION ALL SELECT 'technician', 'workflow.record.evidence'
  UNION ALL SELECT 'mechanicalVerifier', 'workflow.record.evidence'
  UNION ALL SELECT 'inspection', 'workflow.record.evidence'
  UNION ALL SELECT 'entrySupervisor', 'workflow.record.evidence'
  UNION ALL SELECT 'coordinator', 'workflow.record.evidence'
  UNION ALL SELECT 'metalForeman', 'workflow.record.evidence'
  UNION ALL SELECT 'safety', 'workflow.record.evidence'
) candidates
LEFT JOIN `access_role_permissions` existing
  ON existing.`roleKey`=candidates.`roleKey` AND existing.`permissionKey`=candidates.`permissionKey`
WHERE existing.`id` IS NULL;

CREATE TABLE IF NOT EXISTS `inspection_activity_templates` (
  `id` int NOT NULL AUTO_INCREMENT,
  `activityKey` varchar(100) NOT NULL,
  `name` varchar(180) NOT NULL,
  `description` text,
  `applicableEquipmentTypesJson` text,
  `mandatory` int NOT NULL DEFAULT 0,
  `evidenceRequired` int NOT NULL DEFAULT 0,
  `approvalRequired` int NOT NULL DEFAULT 0,
  `active` int NOT NULL DEFAULT 1,
  `sortOrder` int NOT NULL DEFAULT 0,
  `createdByOpenId` varchar(64),
  `updatedByOpenId` varchar(64),
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `inspection_activity_key_unique` (`activityKey`)
);

CREATE TABLE IF NOT EXISTS `inspection_activity_records` (
  `id` int NOT NULL AUTO_INCREMENT,
  `blindTag` varchar(40) NOT NULL,
  `projectId` varchar(40) NOT NULL,
  `templateId` int NOT NULL,
  `phaseKey` enum('operationsInitialIsolation','blindInstallation','mechanicalVerification','internalInspection','reinstatementPreparation','blindRemovalReinstatement','reinstatementVerification','finalApprovalReturnToService') NOT NULL DEFAULT 'internalInspection',
  `status` varchar(30) NOT NULL DEFAULT 'not_started',
  `result` varchar(60),
  `notes` text,
  `completedByOpenId` varchar(64),
  `approvedByOpenId` varchar(64),
  `completedAt` timestamp NULL,
  `approvedAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `blind_inspection_activity_unique` (`blindTag`,`templateId`),
  KEY `inspection_activity_record_project_idx` (`projectId`),
  CONSTRAINT `inspection_activity_record_blind_fk` FOREIGN KEY (`blindTag`) REFERENCES `blinds` (`tag`),
  CONSTRAINT `inspection_activity_record_project_fk` FOREIGN KEY (`projectId`) REFERENCES `projects` (`id`),
  CONSTRAINT `inspection_activity_record_template_fk` FOREIGN KEY (`templateId`) REFERENCES `inspection_activity_templates` (`id`)
);

INSERT INTO `inspection_activity_templates`
(`activityKey`,`name`,`description`,`applicableEquipmentTypesJson`,`mandatory`,`evidenceRequired`,`approvalRequired`,`active`,`sortOrder`,`createdAt`,`updatedAt`) VALUES
('manway-condition','Manway Condition','Inspect manway neck, flange face, cover, studs, gasket seating and visible damage.','["Tank","Vessel","Drum"]',1,1,0,1,10,now(),now()),
('internal-visual','Internal Visual Inspection','Record the internal equipment condition, deposits, corrosion and visible defects.','["Tank","Vessel","Drum"]',1,1,1,1,20,now(),now()),
('coating-inspection','Coating Inspection','Inspect coating breakdown, blistering, delamination and repair requirements.','["Tank","Vessel"]',0,1,1,1,30,now(),now()),
('defect-notification','Defect Notification','Create or link defect notifications and recommended corrective actions.','["Tank","Vessel","Drum"]',0,1,1,1,40,now(),now()),
('ndt-requirement','NDT Requirement','Record whether NDT is required and link the approved method or report.','["Tank","Vessel","Drum"]',0,1,1,1,50,now(),now()),
('ready-for-closure','Ready for Closure','Confirm internal work, punch items, tools, materials and personnel are cleared for closure.','["Tank","Vessel","Drum"]',1,1,1,1,60,now(),now())
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`),`description`=VALUES(`description`),`applicableEquipmentTypesJson`=VALUES(`applicableEquipmentTypesJson`),`sortOrder`=VALUES(`sortOrder`),`updatedAt`=VALUES(`updatedAt`);

INSERT INTO `access_permissions` (`key`,`label`,`description`,`group`,`createdAt`,`updatedAt`) VALUES
('workflow.record.inspection','Manage inspection activity records','Complete configured inspection activities, results and approval evidence for a Blind','Workflow & Sign-off',now(),now()),
('workflow.inspection.configure','Configure inspection activities','Create, edit and enable plant inspection activity templates','Workflow & Sign-off',now(),now()),
('workflow.inspection.approve','Approve inspection activities independently','Approve or reject inspection activities configured for independent review','Workflow & Sign-off',now(),now())
ON DUPLICATE KEY UPDATE `label`=VALUES(`label`),`description`=VALUES(`description`),`group`=VALUES(`group`),`updatedAt`=VALUES(`updatedAt`);

INSERT INTO `access_role_permissions` (`roleKey`,`permissionKey`,`createdAt`)
SELECT candidates.`roleKey`, candidates.`permissionKey`, now()
FROM (
  SELECT 'inspection' AS `roleKey`, 'workflow.record.inspection' AS `permissionKey`
  UNION ALL SELECT 'entrySupervisor', 'workflow.record.inspection'
  UNION ALL SELECT 'coordinator', 'workflow.inspection.configure'
  UNION ALL SELECT 'inspection', 'workflow.inspection.approve'
  UNION ALL SELECT 'entrySupervisor', 'workflow.inspection.approve'
) candidates
LEFT JOIN `access_role_permissions` existing
  ON existing.`roleKey`=candidates.`roleKey` AND existing.`permissionKey`=candidates.`permissionKey`
WHERE existing.`id` IS NULL;

