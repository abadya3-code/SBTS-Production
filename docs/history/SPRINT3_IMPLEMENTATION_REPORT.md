# SBTS Sprint 3 Implementation Report

**Release:** `2.0.0-beta.3`  
**Date:** 2026-07-24  
**Scope:** Vertical Integration & Field Operations UI

## 1. Executive result

Sprint 3 connects the Sprint 2 workflow runtime to operational screens used by field and supervisory roles. PTW, LOTO, gas tests, torque, leak/service tests, Isolation Packages, entry readiness, inspection activities, evidence and final approvals now have database-backed tRPC operations and usable UI inside Blind Detail or the dedicated Isolation Packages page.

This release is suitable for controlled Staging migration and integration testing. It is not yet approved for Production or live safety-critical field use because dependency-based typecheck, Vitest, production build, database execution and end-to-end browser testing must still be completed in a connected Staging environment.

## 2. Delivered vertical integration

### Blind Detail → Field Actions

`BlindDetailHub.tsx` now hosts `WorkflowOperationsPanel.tsx`, which reads the canonical workflow runtime and displays only database-backed operational records:

- Permit to Work, line-breaking and confined-space permits.
- LOTO certificate, lock numbers and zero-energy verification.
- Authorized atmospheric gas tests and validity.
- Installation torque and reinstatement torque.
- Configurable internal-inspection activities.
- Leak/service-test result.
- Isolation Package membership and entry readiness.
- Sequential final approvals.
- Current-phase evidence attachments.

The interface follows the existing semantic theme tokens and responsive card patterns. Existing application themes remain authoritative; Sprint 3 did not introduce isolated hard-coded page themes.

### Isolation Packages

A new route and page, `/isolation-packages`, provides:

- Project filtering and package search.
- Package creation with required Blind selection.
- Live package status and linked-Blind counts.
- Linked Blind canonical phase and lifecycle status.
- Entry-readiness overview.
- Operations preparation and Entry Supervisor authorization form.
- Direct navigation to each linked Blind.

Package readiness remains server-derived. The client cannot declare that all blinds, LOTO or gas tests are acceptable by submitting arbitrary Boolean values.

## 3. Database changes

Migration `drizzle/0015_sprint3_vertical_integration.sql` is additive and TiDB/MySQL-compatible.

### Workflow policy additions

- `requireEvidenceBeforePhaseSubmit`
- `evidenceMaxFileSizeMb`
- `evidenceAllowedMimeTypesJson`
- `defaultTorqueUnit`
- `defaultPumpPressureUnit`
- `fieldRecordEditorMode`

### Inspection domain

- `inspection_activity_templates`
- `inspection_activity_records`

Default templates are seeded idempotently:

1. Manway Condition.
2. Internal Visual Inspection.
3. Coating Inspection.
4. Defect Notification.
5. NDT Requirement.
6. Ready for Closure.

### RBAC additions

- `workflow.record.evidence`
- `workflow.record.inspection`
- `workflow.inspection.configure`
- `workflow.inspection.approve`

The migration provisions permissions for existing environments, while `server/db/seed.ts` provisions the same catalog for clean environments.

## 4. Inspection Activity Builder

System Settings now contains a database-backed Inspection Activity Builder. Administrators or coordinators with `workflow.inspection.configure` can control:

- Stable activity key.
- Name and instructions.
- Applicable equipment types.
- Mandatory or optional status.
- Evidence requirement.
- Independent approval requirement.
- Active/inactive status.
- Display and execution order.

Mandatory activities are evaluated by the backend phase gate. For activities requiring independent approval:

- A recorder completes the activity.
- A different user with `workflow.inspection.approve` approves or rejects it.
- A completed-but-unapproved activity does not satisfy the phase gate.
- The same user cannot complete and approve the activity.
- Approved records are locked from ordinary editing.

## 5. Evidence governance

Evidence upload is controlled by Workflow & Safety Settings:

- Maximum file size.
- Explicit MIME allow-list.
- Optional requirement for evidence before phase submission.
- Phase-specific evidence association.
- Feature-toggle visibility.

The server validates MIME type and decoded byte size before storage, generates a unique storage path, then creates the database metadata record and audit entry.

Known limitation: deleting an evidence record removes its database reference but does not yet delete the underlying storage object because the current storage abstraction exposes upload/read but no delete operation. A storage lifecycle/orphan cleanup task is required before Production.

## 6. Mechanical record governance

### Torque

The UI and backend distinguish execution from acceptance:

- Maintenance/Bolting Technician: draft or submit installation/reinstatement torque.
- Independent Mechanical Verifier: accept or reject the relevant submitted record.
- Tool calibration and phase ownership are enforced by the Sprint 2 state machine.
- Default torque and pump-pressure units come from Settings.

### Leak/service test

The leak-test editor stores status, type, medium, pressure, duration, no-leak confirmation and notes. Workflow transition remains blocked until the configured final gate is satisfied.

## 7. Compliance record governance

### Permit records

PTW, line-breaking and confined-space permits use real tRPC mutations, date validity and audit logs.

### LOTO

LOTO records include certificate number, lock numbers, lifecycle status, zero-energy verification, release time and notes.

### Gas tests

Gas tests require the dedicated permission and remain subject to Sprint 2 controls:

- Authorized Gas Tester role.
- Instrument identification.
- Calibration validity.
- Site-configured O2/LEL/H2S/CO acceptance limits.
- Automatic validity window.
- Purpose-specific records for line breaking, entry or de-blinding.

## 8. Audit and notifications

Operational create/update actions write to `blind_workflow_logs`, including:

- Permit.
- LOTO.
- Gas test.
- Torque execution and verification.
- Leak test.
- Package linkage and entry readiness.
- Evidence upload/removal.
- Inspection activity completion and approval.

Sprint 2 transition events, Safety Holds and workflow notifications remain active.

## 9. Settings and theme integration

System Settings → Workflow & Safety now controls:

- Evidence required before phase submission.
- Maximum evidence file size.
- Allowed evidence MIME types.
- Default torque unit.
- Default pump-pressure unit.
- Field editor mode.
- Inspection activity templates.

`dialog` is the supported field editor mode in Sprint 3. `inline` is persisted as a future option but is not activated as a production editor.

All new screens use existing semantic classes such as `bg-card`, `text-foreground`, `border-border`, `bg-muted` and `text-primary`. No separate visual theme or page-specific color system was created.

## 10. Verification performed

- TypeScript/TSX syntax: **213 files, 0 parse errors**.
- Sprint 2 static acceptance: **73/73 passed**.
- Sprint 2 SQL structural validation: **passed, 33 statements**.
- Sprint 3 static acceptance: **40/40 passed**.
- Sprint 3 SQL structural/TiDB static validation: **passed, 9 statements**.
- Baseline inventory: **241 source files, 22 pages, 15 routers, 26 tests, 16 migrations**.

## 11. Verification not performed in this environment

The supplied source package did not contain a complete installed dependency tree. Therefore the following must be executed in Staging:

```bash
pnpm install --frozen-lockfile
pnpm sprint3:verify
pnpm check
pnpm test
pnpm build
```

The migration was not applied to the user's actual database. Apply it only after backup and restore verification in Staging.

## 12. Remaining work before Production

- Dependency-based typecheck, tests and build.
- Apply and validate migrations 0013–0015 in Staging.
- End-to-end browser testing for every role.
- Evidence storage deletion/orphan cleanup.
- Certificate locking, hashing and controlled reissue.
- Detailed defect, punch-list and NDT submodules.
- Project-level Active Work Queue and production Dashboard cleanup if not completed in another branch.
- Accessibility and tablet field usability test with real users.
- Security and load testing.
