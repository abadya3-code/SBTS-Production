-- Sprint 0/1 foundation migration
ALTER TABLE `system_settings`
  ADD COLUMN `defaultTheme` varchar(20) NOT NULL DEFAULT 'standard',
  ADD COLUMN `allowUserThemeOverride` int NOT NULL DEFAULT 1;
-- Keeps legacy workflow phase keys while adding the canonical eight-phase workflow.

ALTER TABLE `workflow_phases`
  MODIFY COLUMN `phaseKey` enum(
    'broken','assembly','tightTorque','finalTight','inspectionReady',
    'operationsInitialIsolation','blindInstallation','mechanicalVerification','internalInspection',
    'reinstatementPreparation','blindRemovalReinstatement','reinstatementVerification',
    'finalApprovalReturnToService'
  ) NOT NULL;

CREATE TABLE IF NOT EXISTS `workflow_policy_settings` (
  `id` int AUTO_INCREMENT NOT NULL,
  `activeWorkflowTemplateId` varchar(96) NOT NULL DEFAULT 'wf-sbts-standard-v2',
  `enforceServerGates` int NOT NULL DEFAULT 1,
  `requireIndependentVerifier` int NOT NULL DEFAULT 1,
  `requirePtwActive` int NOT NULL DEFAULT 1,
  `requireLotoActive` int NOT NULL DEFAULT 1,
  `requireGasTestForEntry` int NOT NULL DEFAULT 1,
  `requireGasTestForDeBlinding` int NOT NULL DEFAULT 1,
  `defaultGasTestValidityMinutes` int NOT NULL DEFAULT 240,
  `gasTestExpiryWarningMinutes` int NOT NULL DEFAULT 30,
  `safetyHoldEnabled` int NOT NULL DEFAULT 1,
  `holdReleaseRequiresIndependentApproval` int NOT NULL DEFAULT 1,
  `metalForemanRequiredForSlipBlind` int NOT NULL DEFAULT 1,
  `operationsForemanFinalApprover` int NOT NULL DEFAULT 1,
  `certificateRequiresLeakTest` int NOT NULL DEFAULT 1,
  `allowPhaseReopen` int NOT NULL DEFAULT 1,
  `phaseReopenRequiresApproval` int NOT NULL DEFAULT 1,
  `showBlockingReasons` int NOT NULL DEFAULT 1,
  `enableFieldMode` int NOT NULL DEFAULT 1,
  `updatedByOpenId` varchar(64),
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `workflow_policy_settings_id` PRIMARY KEY(`id`)
);
