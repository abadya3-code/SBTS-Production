# SBTS Sprint 2 — Implementation Report

## Delivered scope

Sprint 2 introduces the database domain and authoritative backend state machine required to move SBTS from a five-phase compatibility model toward the canonical eight-phase operational lifecycle.

## Main implementation

- Canonical project workflow assignment and per-Blind runtime state.
- Eight phase instances and 64 checklist responses per migrated Blind.
- Action-command transitions instead of arbitrary target phases.
- Server-owned gate evaluator for checklist, PTW, line-breaking permit, LOTO, gas testing, torque, independent verification, Isolation Package readiness, leak test and final approvals.
- Optimistic concurrency using `expectedRecordVersion`.
- Accepted/rejected/override transition events with gate snapshots.
- Non-destructive synchronization to legacy `blinds.phase`.
- Isolation Package creation, linked Blind validation and derived package status.
- Operations preparation separated from Entry Supervisor authorization.
- Gas tests restricted to configured Authorized Gas Tester role, valid calibrated instrument and site-configured acceptance limits.
- Torque execution separated from independent acceptance.
- Two-step Safety Hold release with different-person approval and exact lifecycle restoration.
- Conditional Metal Foreman approval for Slip Blind/Spade only at final closeout.
- Operations Foreman as final return-to-service authority.
- Workflow notifications and Settings controls integrated.

## UI integration

Blind Detail Hub now displays canonical phases, lifecycle status, record version, gate readiness, persisted checklist responses and controlled actions. Safety Hold release is visible and follows the backend two-step policy. Project Detail uses canonical runtime summaries while retaining legacy reference only when enabled in Settings.

## Database compatibility correction

The initial checklist backfill used `JSON_TABLE`, but the documented target includes TiDB. Sprint 2 replaces it with static canonical derived rows, preserving the same 64 checklist records per Blind without relying on unsupported JSON table expansion.

## Verification completed in this environment

- `node scripts/sprint2-verify.mjs`: 73 passed, 0 failed.
- `node scripts/sprint2-sql-validate.mjs`: passed, 33 SQL statements.
- `node scripts/typescript-syntax-check.mjs`: 207 files, 0 syntax errors.
- Baseline inventory: 232 source files, 21 client pages, 15 routers, 25 tests and 15 migrations.

## Verification not executable here

The supplied artifact did not include installed dependencies and the environment could not download pnpm packages. Therefore `pnpm check`, Vitest and the production build were not executed. Global TypeScript confirmed parsing, while the full compiler stopped only because `@types/node` and `vite/client` dependencies were unavailable. These checks remain mandatory before Staging acceptance.

## Remaining boundaries

Sprint 2 exposes backend APIs for compliance and mechanical records but does not complete every field record editor in the frontend. Evidence upload, the full Isolation Package page, final approval controls and locked certificate generation belong to subsequent vertical-slice/UI integration work. The application must not be treated as Production-ready until those workflows and Staging/UAT tests are complete.
