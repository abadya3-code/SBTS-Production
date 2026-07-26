# SBTS Sprint 2 — Backend Workflow State Machine Specification

## Purpose

The state machine is the authoritative controller for every Blind lifecycle. A client cannot change a phase label directly. It sends an action command, the server validates the current state and required evidence, then either records a rejected transition with blocking reasons or commits an accepted transition atomically.

## Canonical phases and commands

| # | Phase key | Command | Owner role | Required permission |
|---:|---|---|---|---|
| 1 | `operationsInitialIsolation` | `completeInitialIsolation` | Operations | `workflow.phase.operations.complete` |
| 2 | `blindInstallation` | `submitInstallationRecord` | Maintenance Technician | `workflow.phase.installation.submit` |
| 3 | `mechanicalVerification` | `approveMechanicalVerification` | Independent Mechanical Verifier | `workflow.phase.mechanical.verify` |
| 4 | `internalInspection` | `declareReadyForClosure` | Inspection | `workflow.phase.inspection.manage` |
| 5 | `reinstatementPreparation` | `authorizeBlindRemoval` | Operations | `workflow.phase.removal.authorize` |
| 6 | `blindRemovalReinstatement` | `submitReinstatementRecord` | Maintenance Technician | `workflow.phase.reinstatement.submit` |
| 7 | `reinstatementVerification` | `approveReinstatement` | Independent Mechanical Verifier | `workflow.phase.reinstatement.verify` |
| 8 | `finalApprovalReturnToService` | `authorizeReturnToService` | Operations Foreman | `workflow.phase.returnToService.authorize` |

## Lifecycle statuses

`PLANNED → INITIAL_ISOLATION → READY_FOR_BLIND_INSTALLATION → BLIND_INSTALLED → MECHANICAL_VERIFICATION_PENDING → ACTIVE_ISOLATION → ENTRY_AUTHORIZED → WORK_IN_PROGRESS → READY_FOR_CLOSURE → READY_FOR_BLIND_REMOVAL → REINSTATED → LEAK_TEST_PENDING → READY_FOR_SERVICE → CLOSED`

`SAFETY_HOLD` temporarily replaces the operational lifecycle. The exact prior lifecycle is stored and restored only after the configured release process completes.

## Gate evaluation order

1. Workflow lock and active Safety Hold.
2. Actor permission for the current command.
3. Mandatory current-phase checklist.
4. PTW and line-breaking permit status/expiry.
5. LOTO active status and zero-energy verification.
6. Purpose-specific gas test, instrument calibration, validity and site-approved acceptance limits.
7. Installation or reinstatement torque submission/independent acceptance.
8. Independent-verifier separation from the executor.
9. Isolation Package and Vessel Entry Readiness authorization.
10. Leak/service test result.
11. Sequential final approval chain and LOTO closeout.

## Transition transaction

An accepted command updates the current phase instance, activates the next phase, updates `blind_workflow_runtime`, synchronizes the legacy `blinds.phase`, inserts `workflow_transition_events` and appends `blind_workflow_logs` in one transaction. `expectedRecordVersion` prevents lost updates.

## Safety Hold governance

1. An authorized field user places a hold and supplies reason/description.
2. Runtime lifecycle becomes `SAFETY_HOLD`; phase does not advance.
3. Authorized releaser submits corrective action.
4. If independent approval is enabled, hold status becomes `release_pending`.
5. A different authorized person approves release.
6. Runtime restores the exact stored lifecycle and notifies affected roles.

## Final approval chain

1. Inspection.
2. T&I Coordinator.
3. Mechanical Verifier or Metal Foreman when the Blind is Slip Blind/Spade.
4. Operations Foreman.

The final command is rejected until every required step is approved, LOTO closeout is recorded, the leak test passes where configured and no Safety Hold remains active.
