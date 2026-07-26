# SBTS Sprint 4 — Staging Validation Runbook

Use this runbook after following `SBTS_LOCAL_AND_RAILWAY_DEPLOYMENT.md`.

## 1. Pre-deployment gate

```bash
pnpm install --frozen-lockfile
pnpm sprint2:verify
pnpm sprint3:verify
pnpm sprint4:verify
pnpm check
pnpm test
pnpm build
```

Stop if any command fails.

## 2. Database safety

1. Export a Staging backup.
2. Prove restore into a temporary database.
3. Review whether Sprint 1–3 were previously applied manually.
4. Set `SBTS_DOMAIN_MIGRATION_BASELINE_UP_TO` only after verifying the corresponding schema.
5. Run:

```bash
pnpm db:migrate
```

6. Verify:

```sql
SELECT * FROM sbts_domain_migrations ORDER BY migrationName;
SELECT migrationName, COUNT(*) AS appliedStatements
FROM sbts_domain_migration_steps
GROUP BY migrationName
ORDER BY migrationName;
```

## 3. Service readiness

```bash
SBTS_BASE_URL=https://YOUR-STAGING-DOMAIN pnpm staging:smoke
```

Expected:

- `/health` = 200.
- `/ready` = 200.
- frontend root = 200.

## 4. Test data

Use a dedicated non-production Project and Blind. Do not reuse a live isolation record. Assign separate users for:

- Maintenance execution.
- Independent mechanical verification.
- Inspection execution.
- Independent quality review.
- Operations.
- Entry Supervisor.
- T&I Coordinator.
- Operations Foreman.
- Metal Foreman for Slip Blind scenario.

## 5. Automated authenticated E2E

```bash
export SBTS_E2E_BASE_URL=https://YOUR-STAGING-DOMAIN
export SBTS_E2E_EMAIL=e2e.admin@example.com
export SBTS_E2E_PASSWORD='strong-test-password'
export SBTS_E2E_PROJECT_ID=TEST-PROJECT
export SBTS_E2E_BLIND_TAG=TEST-BLIND
export SBTS_E2E_EXPECT_CLOSED=false
pnpm staging:e2e
```

After completing the lifecycle and issuing a certificate:

```bash
export SBTS_E2E_EXPECT_CLOSED=true
export SBTS_E2E_CERTIFICATE_TOKEN=ISSUED-TOKEN
pnpm staging:e2e
```

## 6. Manual UAT

Execute every item in `SBTS_Sprint4_Staging_UAT_Checklist.md`. Evidence required:

- screenshot or screen recording;
- user/role used;
- record ID;
- expected result;
- actual result;
- pass/fail;
- issue number for failures.

## 7. Security checks

- Public verification token must not return PTW, LOTO, gas readings, files or internal IDs.
- Self-approval must fail for defect, punch and NDT final review.
- Stale record versions must return conflict.
- Revoked certificate must remain verifiable as revoked.
- Superseded certificate must remain in history.
- Signed object URLs must expire.

## 8. Production go/no-go

Production is **NO-GO** if any of the following remains:

- Critical or High defect.
- migration uncertainty;
- failed backup restore;
- failed build/test/check;
- failed safety gate;
- public data exposure;
- certificate hash mismatch;
- self-approval path;
- orphaned or inaccessible mandatory evidence;
- incomplete manual UAT sign-off.
