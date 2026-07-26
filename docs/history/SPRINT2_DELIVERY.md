# SBTS Sprint 2 — Delivery Notes

## Artifact

Version: `2.0.0-beta.2`

## First Staging steps

1. Back up the database.
2. Install locked dependencies.
3. Run Sprint 1 Migration `0013` if not already applied.
4. Apply Sprint 2 Migration `0014`.
5. Run `pnpm sprint2:verify`.
6. Run `pnpm check`, `pnpm test` and `pnpm build`.
7. Configure and formally approve Gas-Test Acceptance Limits before allowing active/valid gas-test records.
8. Perform the smoke test in `SPRINT2_DATABASE_MIGRATION_RUNBOOK.md`.

## Deployment warning

Do not apply directly to Production. The database migration has passed static validation but has not been executed against the user's actual database in this environment.
