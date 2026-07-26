# SBTS Sprint 4 — Implementation Report

**Release:** `2.0.0-beta.4`  
**Sprint:** Certificate Governance + Defect/Punch/NDT + Staging Validation Foundation  
**Status:** Implemented in code; deployment and live E2E execution remain subject to Staging environment validation.

## 1. Executive result

Sprint 4 converts the final portion of the SBTS workflow from display-only concepts into controlled records:

```text
Inspection Work
→ Defect / Punch / NDT Governance
→ Quality Readiness Gate
→ Leak Test + Final Approval Chain
→ Closed and Locked Workflow
→ Immutable Certificate Snapshot
→ SHA-256 Verification
→ Controlled Reissue / Revocation
```

The implementation is additive and retains Sprint 1–3 data. It introduces production deployment foundations for Railway without claiming that a Railway deployment has already occurred.

## 2. Certificate governance

Implemented:

- Immutable certificate snapshot stored in `certificate_records.snapshotJson`.
- Deterministic SHA-256 calculated from canonicalized data.
- Date normalization before generic object normalization.
- Versioned certificate number and secure public verification token.
- Initial issue, controlled reissue, superseded history and revocation.
- Reissue reason enforcement from Settings.
- Revocation policy and permanent reason.
- Previous certificate relationship.
- Workflow audit entries for issue, reissue and revoke.
- Certificate issue blocked unless server-side readiness passes.
- Public verification route and printable UI.
- Public response is data-minimized and does not expose permits, LOTO, gas readings, evidence URLs or internal user IDs.

Certificate readiness evaluates:

- Canonical workflow closed and locked when configured.
- Passed leak/service test when configured.
- Complete final approval chain.
- Defect, punch and NDT quality gates.

## 3. Defect Notification module

Implemented:

- Controlled defect numbers with configurable prefix.
- Project and Blind ownership validation.
- Severity, description, disposition, repair and NDT requirements.
- Assignment and due date.
- Independent review: reporter cannot complete final disposition.
- Optimistic concurrency through `recordVersion`.
- Final states cannot be created directly; the defect must first be recorded.
- Audit and workflow-readiness integration.

## 4. Punch Item module

Implemented:

- Controlled punch numbers with configurable prefix.
- Optional relationship to a defect.
- Mandatory/optional classification.
- Owner, target date and verification notes.
- Closed, transferred and cancelled governance.
- Independent verification: creator cannot verify final closure.
- Transfer support controlled from Settings.
- Optimistic concurrency.
- Mandatory open items block closure when policy is active.

## 5. NDT module

Implemented:

- Controlled NDT numbers with configurable prefix.
- NDT method, procedure reference and acceptance criteria.
- Performance record separated from independent review.
- Performer cannot review the same NDT result.
- Passed, failed, retest-required and cancelled statuses.
- NDT is linked to its related defect through `defectId`.
- Defects requiring NDT are not cleared by an unrelated global NDT record.
- Optimistic concurrency and audit support.

## 6. Settings additions

`Settings → Workflow & Safety` now controls:

- Certificate number prefix.
- Public verification enable/disable.
- Require closed and locked workflow.
- Require reason for reissue.
- Certificate revocation policy.
- Public verification base URL.
- Defect, punch and NDT prefixes.
- Require defect disposition before closure.
- Require mandatory punch closure.
- Require accepted NDT before closure.
- Allow or prohibit punch transfer.

All new components use the central theme tokens and remain consistent with existing Standard, Modern and Manus themes.

## 7. Database migration

Added:

```text
drizzle/0016_sprint4_certificate_quality_governance.sql
```

New tables:

- `certificate_records`
- `defect_notifications`
- `punch_items`
- `ndt_records`

Additional changes:

- `workflow_evidence_attachments.storageKey`
- Certificate and quality policy fields.
- Quality and certificate RBAC permissions.

The migration is additive and avoids `JSON_TABLE`, preserving TiDB/MySQL compatibility.

## 8. Domain migration governance

A critical deployment issue was corrected: Sprint domain migrations 0013–0016 are not part of the original Drizzle journal, so `drizzle-kit migrate` alone is insufficient.

Added:

```text
scripts/apply-sbts-domain-migrations.ts
```

`pnpm db:migrate` now runs:

```text
Drizzle base migrations
+
SBTS domain migrations
```

The domain runner provides:

- Ordered discovery of `####_sprint*.sql`.
- File SHA-256 checksums.
- Per-statement SHA-256 checksums.
- Resume from previously recorded statements.
- Refusal when an applied migration or statement changes.
- Explicit baseline control for databases where older Sprint migrations were manually applied.

Tracking tables:

- `sbts_domain_migrations`
- `sbts_domain_migration_steps`

## 9. Object storage

The storage layer now supports:

- Existing Manus Forge signed storage.
- S3-compatible storage.
- Railway Storage Bucket variables.
- Local MinIO.
- Signed reads.
- Physical object deletion for S3/Railway.
- Legacy Forge compatibility.
- Backend-neutral `/storage/{key}` URLs.

Evidence records now retain `storageKey`, decoupling application records from the storage provider.

## 10. Railway production foundation

Added:

- `railway.json`.
- Build command with dev tooling available for build/migrations.
- Pre-deploy database migration.
- Dynamic `PORT` and `0.0.0.0` binding.
- `/health` process endpoint.
- `/ready` database endpoint.
- Graceful shutdown.
- Production environment validation.
- Railway/MySQL/S3 variable mapping.
- Local MySQL + MinIO Docker Compose environment.
- Admin bootstrap command.

## 11. Staging E2E foundation

Added:

- `pnpm staging:smoke`
- `pnpm staging:e2e`
- `SBTS_Sprint4_Staging_UAT_Checklist.md`

Automated Staging E2E checks:

- Health and readiness.
- Frontend response.
- Authentication and session.
- Project ↔ Blind linkage.
- Canonical runtime.
- Eight phase instances.
- RBAC projection.
- Defect/Punch/NDT APIs.
- Certificate readiness and history.
- Optional closed/locked workflow expectation.
- Optional public certificate hash and data-minimization verification.

Manual UAT covers the complete field lifecycle, safety failure paths, quality gates, concurrency, evidence, certificate reissue/revocation and backup restore.

## 12. Validation completed in the working environment

Passed:

- Sprint 2 acceptance: `73/73`.
- Sprint 2 SQL structural validation: `33 statements`.
- Sprint 3 acceptance: `40/40`.
- Sprint 3 SQL structural validation: `9 statements`.
- Sprint 4 acceptance: `66/66`.
- Sprint 4 SQL structural validation: `9 statements`.
- TypeScript/TSX syntax parser: `221 files`, `0 parse errors`.
- TiDB static compatibility checks.

Not executed successfully in this environment:

- `pnpm check`
- `pnpm test`
- `pnpm build`
- Live Staging E2E
- Live database migration
- Live Railway deployment

Reason: `node_modules` is absent and the environment could not resolve `registry.npmjs.org` to download the pinned pnpm package. These commands remain mandatory on Local/Staging.

## 13. Release position

Sprint 4 is code-complete as a Beta implementation and ready for controlled Local/Staging validation. It is not approved for Production until:

- dependencies install successfully;
- `check`, `test` and `build` pass;
- migrations apply to a backup-restorable Staging database;
- automated E2E passes;
- manual UAT is signed;
- security and backup-restore reviews pass.
