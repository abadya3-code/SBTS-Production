# SBTS Sprint 4 — Delivery Notes

## Delivered release

`SBTS v2.0.0-beta.4`

## Apply order

1. Read `SBTS_LOCAL_AND_RAILWAY_DEPLOYMENT.md`.
2. Install dependencies.
3. Run all static and full toolchain checks.
4. Back up and restore-test the Staging database.
5. Apply `pnpm db:migrate`.
6. Create the first Admin if required.
7. Deploy Staging.
8. Run smoke and authenticated E2E.
9. Complete the manual UAT checklist.
10. Obtain Operations, Maintenance, Inspection, Safety and Application Owner sign-off.

## Important migration note

Do not run only `drizzle-kit migrate`. Sprint domain migrations are applied by:

```bash
pnpm db:migrate
```

Never modify a migration recorded in `sbts_domain_migrations` or `sbts_domain_migration_steps`. Add a new migration.

## Important certificate note

The public certificate verification page is deliberately data-minimized. Do not expand it to expose permits, LOTO, atmospheric readings, internal user IDs or controlled evidence without a formal security review.

## Important Railway note

The package is configured and documented for Railway, but it has not been uploaded or deployed by this delivery process. Railway Project, MySQL, Bucket, variables and domain must be created by the authorized account owner.

## Production restriction

This Beta package is not approved for live plant operation until all unchecked items in `SBTS_Sprint4_Acceptance_Checklist.md` are completed.
