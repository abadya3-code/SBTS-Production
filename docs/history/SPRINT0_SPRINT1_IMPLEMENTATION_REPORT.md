# Sprint 0 and Sprint 1 Implementation Report

## Delivered

### Sprint 0 — Baseline and controls

- Added an automated repository inventory script: `pnpm baseline`.
- Generated `docs/SPRINT0_BASELINE_REPORT.md`.
- Added a combined verification command: `pnpm verify`.
- Recorded the current number of pages, routers, tests, migrations, legacy phase references and mock-data dependencies.
- Fixed render-time state updates in every System Settings form and the User Profile form.
- Corrected Dashboard hero settings so the UI reads the actual `dashboardHero*` database fields.
- Preserved legacy phase data instead of applying a destructive enum migration.

### Sprint 1 — Workflow product truth

- Added `shared/workflowSpecification.ts` as the frontend/backend single source of truth.
- Defined the eight canonical phases, owners, permissions, gates, checklist requirements, evidence and action names.
- Defined Vessel Entry Readiness and Final Reinstatement gates.
- Defined full workflow lifecycle states including `SAFETY_HOLD`.
- Added canonical workflow phase keys to the database enum while retaining legacy keys.
- Added a seeded active workflow template: `wf-sbts-standard-v2`.
- Added Operations, Independent Mechanical Verifier and Entry Supervisor role definitions.
- Added granular phase and Safety Hold permissions.
- Updated access-control seeding to insert missing roles/permissions safely into an existing database instead of seeding only an empty database.

### Workflow & Safety Settings

Added a database-backed Settings section covering:

- Active Workflow Template.
- Server-side gate enforcement policy.
- PTW and LOTO requirements.
- Entry and de-blinding gas-test requirements.
- Gas-test validity and expiry warning windows.
- Safety Hold and independent release.
- Independent mechanical verification.
- Conditional Metal Foreman approval for slip blinds.
- Final Operations Foreman approval.
- Leak-test requirement for certificate issuance.
- Controlled phase reopening.
- Blocking-reason visibility.
- Tablet/mobile field mode.

### Theme and design integration

- Added system default theme and user-override policy to `system_settings`.
- Added a public, non-sensitive appearance procedure for login and protected pages.
- Connected `ThemeContext` to the database setting.
- Enforced the plant theme when user override is disabled.
- Updated User Profile to explain when theme selection is administrator-controlled.
- Kept all new Settings cards within the current SBTS visual language and theme tokens.

## Database migration

Apply:

`drizzle/0013_sprint0_sprint1_foundation.sql`

The migration:

1. Adds application-theme policy columns.
2. Extends workflow-template phase keys.
3. Creates `workflow_policy_settings`.

The application code must not be deployed before this migration succeeds.

## Verification performed in this environment

- Parsed every TS/TSX source file using the TypeScript compiler API: passed.
- Ran partial TypeScript semantic checks with external modules excluded: no intrinsic errors in modified files.
- Loaded the canonical workflow with Node type stripping and verified eight ordered phases: passed.
- Executed the Sprint 0 baseline inventory script: passed.
- Validated `package.json`: passed.

## Verification not completed here

The package does not include `node_modules`, and the environment could not access the npm registry. Therefore the following commands could not be executed in this environment:

- Full `pnpm check`.
- Full Vitest suite.
- Vite production build.
- Live database migration.
- Browser visual regression test.

These checks remain mandatory in a connected development or CI environment using `pnpm verify`.

## Release status

Sprint 0 and Sprint 1 foundations are complete in code, but the system is not production-ready yet. Runtime blind transitions still use the legacy five-phase record model. The next sprint must implement the normalized workflow records and server state machine before the eight-phase lifecycle can control field work.
