-- SBTS 2.1.1 — align the production database with the current Drizzle schema.
-- Additive only: no tables or user data are removed.

ALTER TABLE `blinds`
  ADD COLUMN IF NOT EXISTS `material` varchar(80) NULL,
  ADD COLUMN IF NOT EXISTS `flangeType` varchar(80) NULL,
  ADD COLUMN IF NOT EXISTS `gasketType` varchar(80) NULL,
  ADD COLUMN IF NOT EXISTS `boltSize` varchar(40) NULL,
  ADD COLUMN IF NOT EXISTS `torqueValue` varchar(40) NULL,
  ADD COLUMN IF NOT EXISTS `thickness` varchar(40) NULL,
  ADD COLUMN IF NOT EXISTS `tempRating` varchar(40) NULL,
  ADD COLUMN IF NOT EXISTS `pidRef` varchar(80) NULL,
  ADD COLUMN IF NOT EXISTS `isoDrawing` varchar(80) NULL,
  ADD COLUMN IF NOT EXISTS `lineNumber2` varchar(120) NULL,
  ADD COLUMN IF NOT EXISTS `installDate` timestamp NULL,
  ADD COLUMN IF NOT EXISTS `expiryDate` timestamp NULL;

CREATE TABLE IF NOT EXISTS `feature_toggles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `enableWorkflowTab` int NOT NULL DEFAULT 1,
  `enableComplianceTab` int NOT NULL DEFAULT 1,
  `enableFieldActionsTab` int NOT NULL DEFAULT 1,
  `enableQrMobileTab` int NOT NULL DEFAULT 1,
  `enableHistoryTab` int NOT NULL DEFAULT 1,
  `enableSafetyChecklists` int NOT NULL DEFAULT 1,
  `enableTorqueRecords` int NOT NULL DEFAULT 1,
  `enableInspectionRecords` int NOT NULL DEFAULT 1,
  `enablePhotoEvidence` int NOT NULL DEFAULT 1,
  `enablePtw` int NOT NULL DEFAULT 1,
  `enableLoto` int NOT NULL DEFAULT 1,
  `enableRiskAssessment` int NOT NULL DEFAULT 1,
  `enableFieldNotes` int NOT NULL DEFAULT 1,
  `enableQrGeneration` int NOT NULL DEFAULT 1,
  `enableMobileVerification` int NOT NULL DEFAULT 1,
  `enableOfflineAccess` int NOT NULL DEFAULT 0,
  `enableSlipBlindSurveys` int NOT NULL DEFAULT 1,
  `enableCertificates` int NOT NULL DEFAULT 1,
  `enableExpiryTracking` int NOT NULL DEFAULT 1,
  `enableProgressRing` int NOT NULL DEFAULT 1,
  `enableQuickActions` int NOT NULL DEFAULT 1,
  `enableBreadcrumb` int NOT NULL DEFAULT 1,
  `updatedByOpenId` varchar(64) NULL,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
);

INSERT INTO `feature_toggles` (`id`) VALUES (1)
ON DUPLICATE KEY UPDATE `id` = VALUES(`id`);
