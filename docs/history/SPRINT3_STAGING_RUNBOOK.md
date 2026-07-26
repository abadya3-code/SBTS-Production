# SBTS Sprint 3 Staging Runbook

## 1. Do not deploy directly to Production

Sprint 3 contains database additions and new role/permission behavior. Use a dedicated Staging database copied from a recent sanitized Production backup.

## 2. Pre-migration controls

1. Record current application release and database version.
2. Stop background writes or place Staging in maintenance mode.
3. Create a full database backup.
4. Perform a restore test into a temporary database.
5. Count existing projects, blinds, runtime rows, packages and workflow records.
6. Confirm migrations `0013` and `0014` are already applied or schedule all three in order.
7. Confirm the exact TiDB/MySQL version.

## 3. Install and verify source

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm sprint2:verify
pnpm sprint3:verify
pnpm check
pnpm test
pnpm build
```

Stop if any command fails.

## 4. Migration order

```text
0013_sprint0_sprint1_foundation.sql
0014_sprint2_workflow_runtime.sql
0015_sprint3_vertical_integration.sql
```

Use the project's approved migration command only after confirming it points to Staging:

```bash
pnpm db:push
```

## 5. Post-migration validation

Confirm:

- `workflow_policy_settings` contains the Sprint 3 fields.
- Six default inspection activity templates exist exactly once.
- `inspection_activity_records` exists with expected foreign keys/indexes.
- New access permissions exist.
- Inspection and Entry Supervisor roles have the intended permissions.
- Existing projects and blinds retain their counts.
- Existing runtime record versions and lifecycle statuses are unchanged.

Suggested checks:

```sql
SELECT COUNT(*) FROM inspection_activity_templates;
SELECT activityKey, mandatory, evidenceRequired, approvalRequired, active
FROM inspection_activity_templates ORDER BY sortOrder;

SELECT `key` FROM access_permissions
WHERE `key` IN (
  'workflow.record.evidence',
  'workflow.record.inspection',
  'workflow.inspection.configure',
  'workflow.inspection.approve'
);

SELECT COUNT(*) FROM projects;
SELECT COUNT(*) FROM blinds;
SELECT COUNT(*) FROM blind_workflow_runtime;
```

## 6. Configuration before functional testing

In **Settings → Workflow & Safety**:

1. Confirm evidence MIME allow-list.
2. Set maximum evidence file size.
3. Choose torque and pump-pressure units.
4. Keep field editor mode on `dialog`.
5. Review every inspection template.
6. Confirm which activities are mandatory.
7. Confirm which activities require evidence.
8. Confirm which activities require independent approval.
9. Do not enable evidence-required gates until upload storage is tested.

## 7. Required role test matrix

Test with separate accounts:

- Operations.
- Maintenance/Bolting Technician.
- Authorized Gas Tester.
- Inspection recorder.
- Independent inspection approver.
- Mechanical Verifier.
- Entry Supervisor.
- Operations Foreman.
- Administrator.

Never use one admin account to represent all UAT roles.

## 8. End-to-end scenario

1. Open one Staging project and Blind.
2. Add valid PTW and line-breaking permit.
3. Add active LOTO with zero-energy verification.
4. Add an acceptable gas test with calibrated instrument.
5. Submit installation torque as Technician.
6. Accept torque as a different Mechanical Verifier.
7. Complete internal inspection activities.
8. Approve approval-required activities with a different user.
9. Upload current-phase evidence.
10. Create an Isolation Package and link all required Blinds.
11. Prepare and authorize entry readiness with separate roles.
12. Record reinstatement torque and leak test.
13. Complete the final approval chain.
14. Confirm runtime lock and audit history.

## 9. Rollback decision

Migration 0015 is additive. If application validation fails:

- Stop the Sprint 3 application release.
- Restore the pre-migration Staging backup rather than manually deleting tables in a partially used environment.
- Preserve logs and failed migration output.
- Do not reuse a partially validated database for Production deployment.

## 10. Production gate

Production deployment requires:

- All checklist items in `SPRINT3_ACCEPTANCE_CHECKLIST.md` completed.
- Zero critical or high defects.
- Signed UAT.
- Successful backup/restore drill.
- Security review.
- Confirmed support and rollback owners.
