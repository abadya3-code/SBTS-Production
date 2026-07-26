# SBTS Sprint 4 — Acceptance Checklist

## A. Certificate governance

- [x] Certificate snapshot is immutable after issue.
- [x] Snapshot is hashed with SHA-256.
- [x] Dates are normalized before hashing.
- [x] Initial issue is permission protected.
- [x] Reissue creates a new version.
- [x] Prior issued version becomes superseded.
- [x] Reissue reason is enforced when configured.
- [x] Revocation is policy and permission controlled.
- [x] Revocation stores a permanent reason.
- [x] Certificate actions create audit records.
- [x] Public verification checks the stored hash.
- [x] Public response excludes controlled compliance details.

## B. Quality modules

- [x] Defect records are linked to Project and Blind.
- [x] Defect final disposition requires independent reviewer.
- [x] Punch closure/transfer requires independent verifier.
- [x] NDT result review requires a prior performed record.
- [x] NDT reviewer differs from performer.
- [x] NDT is linked to the related defect.
- [x] Quality records reject stale `recordVersion`.
- [x] Quality policy is configurable in Settings.
- [x] Workflow and certificate gates use server-side quality readiness.

## C. Database and migration

- [x] Sprint 4 migration is additive.
- [x] No `JSON_TABLE` dependency.
- [x] New permissions are included in migration and seed.
- [x] Domain migration files are discovered independently of Drizzle journal.
- [x] File checksums are stored.
- [x] Per-statement checksums are stored.
- [x] Interrupted domain migrations can resume from recorded statements.
- [x] Changed applied migrations are rejected.
- [x] Legacy manually applied migrations require explicit baseline variable.
- [ ] Migration applied successfully on Staging MySQL/TiDB.
- [ ] Backup restore tested before Production.

## D. Storage and deployment

- [x] S3-compatible upload supported.
- [x] Railway Bucket variable aliases supported.
- [x] S3 object deletion supported.
- [x] Existing Forge storage remains readable.
- [x] Evidence retains provider-neutral storage key.
- [x] `/health` endpoint implemented.
- [x] `/ready` database endpoint implemented.
- [x] Dynamic Railway `PORT` and `0.0.0.0` binding implemented.
- [x] `railway.json` includes build, pre-deploy migration, start and health check.
- [x] Local MySQL and MinIO Compose stack included.
- [x] Admin bootstrap script included.
- [ ] Live Railway Staging deployment completed.

## E. Validation

- [x] Sprint 2 static acceptance: 73/73.
- [x] Sprint 3 static acceptance: 40/40.
- [x] Sprint 4 static acceptance: 66/66.
- [x] Sprint 4 SQL structure: 9 statements, balanced.
- [x] TypeScript/TSX syntax: 221 files, zero parse errors.
- [x] Staging smoke test script provided.
- [x] Authenticated Staging E2E script provided.
- [x] Manual UAT checklist provided.
- [ ] `pnpm check` passes after dependency installation.
- [ ] `pnpm test` passes after dependency installation.
- [ ] `pnpm build` passes after dependency installation.
- [ ] Automated Staging E2E passes.
- [ ] Manual field UAT is signed.

## Release decision

**Current decision:** Ready for Local and Staging validation. Not yet approved for Production or plant pilot.
