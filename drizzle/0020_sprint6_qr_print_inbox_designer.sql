-- SBTS Sprint 6: secure QR lifecycle, integrated printing, actionable inbox,
-- and the production 70 x 110 mm tag designer contract.

CREATE TABLE IF NOT EXISTS `blind_qr_tokens` (
  `id` int NOT NULL AUTO_INCREMENT,
  `projectId` varchar(40) NOT NULL,
  `blindTag` varchar(40) NOT NULL,
  `verificationToken` varchar(96) NOT NULL,
  `version` int NOT NULL DEFAULT 1,
  `blindQrTokenStatus` enum('active','superseded','revoked') NOT NULL DEFAULT 'active',
  `issuedByOpenId` varchar(64) NOT NULL,
  `issuedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `previousTokenId` int NULL,
  `revokedByOpenId` varchar(64) NULL,
  `revokedAt` timestamp NULL,
  `revocationReason` text NULL,
  `lastScannedAt` timestamp NULL,
  `scanCount` int NOT NULL DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `blind_qr_token_unique` (`verificationToken`),
  UNIQUE KEY `blind_qr_version_unique` (`blindTag`, `version`),
  KEY `blind_qr_status_idx` (`blindTag`, `blindQrTokenStatus`),
  KEY `blind_qr_project_idx` (`projectId`),
  CONSTRAINT `blind_qr_blind_fk` FOREIGN KEY (`blindTag`) REFERENCES `blinds` (`tag`),
  CONSTRAINT `blind_qr_project_fk` FOREIGN KEY (`projectId`) REFERENCES `projects` (`id`)
);

ALTER TABLE `default_tag_settings`
  ADD COLUMN `layoutJson` longtext NULL;

ALTER TABLE `default_tag_settings`
  ADD COLUMN `templateSlotsJson` longtext NULL;

ALTER TABLE `default_tag_settings`
  MODIFY COLUMN `tagWidth` int NULL DEFAULT 70;

ALTER TABLE `default_tag_settings`
  MODIFY COLUMN `tagHeight` int NULL DEFAULT 110;

UPDATE `default_tag_settings`
   SET `tagWidth` = 70,
       `tagHeight` = 110
 WHERE `tagWidth` = 85
   AND `tagHeight` = 55;

ALTER TABLE `notifications`
  MODIFY COLUMN `notificationType` enum(
    'registration_request','registration_approved','registration_rejected',
    'blind_phase_changed','blind_phase_approval','blind_assigned',
    'project_created','project_status_changed','phase_owner_assigned',
    'workflow_updated','workflow_transition','workflow_gate_blocked',
    'workflow_approval_required','safety_hold_placed','safety_hold_released',
    'qr_token_issued','qr_token_rotated','qr_token_revoked',
    'certificate_issued','certificate_revoked','tag_printed',
    'system_announcement'
  ) NOT NULL;

ALTER TABLE `notifications`
  ADD COLUMN `notificationPriority` enum('info','action','warning','critical') NOT NULL DEFAULT 'info';

ALTER TABLE `notifications`
  ADD COLUMN `isArchived` int NOT NULL DEFAULT 0;

ALTER TABLE `notifications`
  ADD COLUMN `archivedAt` timestamp NULL;

ALTER TABLE `notification_preferences`
  ADD COLUMN `qrTokenChanged` int NOT NULL DEFAULT 1;

ALTER TABLE `notification_preferences`
  ADD COLUMN `certificateStatusChanged` int NOT NULL DEFAULT 1;

ALTER TABLE `notification_preferences`
  ADD COLUMN `tagPrintRequested` int NOT NULL DEFAULT 1;
