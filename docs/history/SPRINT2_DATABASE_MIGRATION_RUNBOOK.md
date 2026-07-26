# SBTS Sprint 2 — Database Migration Runbook

## Migration

`drizzle/0014_sprint2_workflow_runtime.sql`

This is an additive migration. It preserves `blinds.phase`, creates the canonical runtime domain, maps legacy records and seeds Sprint 2 RBAC/workflow catalogs.

## Supported target

The project uses the MySQL dialect and is documented for TiDB/MySQL. The migration intentionally does not use `JSON_TABLE`; canonical checklist records are materialized with portable derived rows. Always validate against the exact Staging database version.

## Pre-migration checklist

- Freeze application writes.
- Confirm Migration `0013_sprint0_sprint1_foundation.sql` is applied.
- Take a full logical backup and record its checksum.
- Export row counts for `projects`, `blinds`, `workflow_templates`, `workflow_phases`, `access_roles` and `access_permissions`.
- Verify every Blind references an existing Project.
- Verify `blinds.tag` values are unique and non-null.
- Confirm no manually created table uses a Sprint 2 table name.

## Apply on Staging

1. Configure `DATABASE_URL` for the Staging database.
2. Apply migrations with the project migration tool or execute `0014` in one controlled change window.
3. Start the application once so normal seed reconciliation can update catalog descriptions safely.
4. Run the application verification commands after dependencies are installed:

```bash
pnpm install --frozen-lockfile
pnpm sprint2:verify
pnpm check
pnpm test
pnpm build
```

## Post-migration validation SQL

```sql
SELECT COUNT(*) AS projects FROM projects;
SELECT COUNT(*) AS blinds FROM blinds;
SELECT COUNT(*) AS runtimes FROM blind_workflow_runtime;
SELECT COUNT(*) AS phase_instances FROM blind_phase_instances;
SELECT COUNT(*) AS checklist_items FROM blind_checklist_responses;
SELECT COUNT(*) AS assignments FROM project_workflow_assignments;

SELECT blindTag, COUNT(*) AS phase_count
FROM blind_phase_instances
GROUP BY blindTag
HAVING phase_count <> 8;

SELECT blindTag, COUNT(*) AS checklist_count
FROM blind_checklist_responses
GROUP BY blindTag
HAVING checklist_count <> 64;

SELECT b.tag
FROM blinds b
LEFT JOIN blind_workflow_runtime r ON r.blindTag = b.tag
WHERE r.blindTag IS NULL;

SELECT r.blindTag, r.currentPhaseKey, r.lifecycleStatus, b.blindPhase
FROM blind_workflow_runtime r
JOIN blinds b ON b.tag = r.blindTag
ORDER BY r.projectId, r.blindTag;
```

Expected results:

- Runtime count equals Blind count.
- Every Blind has 8 phase instances.
- Every migrated Blind has 64 canonical checklist items.
- No orphan Blind is returned.

## Functional smoke test

Use a dedicated Staging project and one test Blind:

1. Open Blind Detail and confirm the canonical phase and record version.
2. Attempt an unauthorized transition; confirm rejection and event logging.
3. Complete one checklist item; refresh and confirm persistence.
4. Create PTW/LOTO records through the API or approved UI.
5. Confirm an expired permit blocks progression.
6. Place a Safety Hold and confirm package/runtime freeze.
7. Submit corrective action and approve with a different user.
8. Confirm exact lifecycle restoration.
9. Test stale `expectedRecordVersion` rejection with two sessions.

## Rollback

Because the migration backfills and creates multiple related tables, Production rollback should use the verified pre-migration database backup rather than ad-hoc destructive `DROP TABLE` commands. If code rollback is required before any Sprint 2 writes, stop the application, restore the backup, deploy the Sprint 1 artifact and verify row counts/checksums.

## Production gate

Do not apply to Production until:

- Staging migration and restore rehearsal both pass.
- Full TypeScript, tests and build pass with locked dependencies.
- UAT validates Operations, Maintenance, Inspection, Safety and final approval roles.
- Site gas-test limits have been formally approved and configured.
