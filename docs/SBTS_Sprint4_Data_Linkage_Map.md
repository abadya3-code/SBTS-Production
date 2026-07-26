# SBTS Sprint 4 — Data Linkage Map

## 1. End-to-end architecture

```text
React UI
  ├─ Blind Detail / Workflow Operations
  ├─ Quality Governance Panel
  ├─ Certificate Governance Panel
  ├─ Public Certificate Verification
  └─ Workflow & Safety Settings
          ↓
tRPC Routers
  ├─ workflowRuntime.quality.*
  ├─ certificates.*
  ├─ workflowRuntime.evidence.*
  └─ settings.workflowPolicy.*
          ↓
Server Domain Services
  ├─ qualityGovernance.ts
  ├─ certificateGovernance.ts
  ├─ workflowRuntime.ts
  ├─ workflowRecords.ts
  └─ storage.ts
          ↓
Drizzle / MySQL / TiDB
  ├─ canonical workflow runtime
  ├─ defect_notifications
  ├─ punch_items
  ├─ ndt_records
  ├─ certificate_records
  ├─ workflow_evidence_attachments
  ├─ workflow_policy_settings
  └─ audit/workflow logs
          ↓
S3-compatible Object Storage
  ├─ Railway Storage Bucket
  ├─ Local MinIO
  └─ Manus Forge legacy adapter
```

## 2. Blind and workflow linkage

Primary record:

```text
projects.id
  → blinds.projectId
  → blind_workflow_runtime.projectId + blindTag
  → blind_phase_instances
```

Sprint 4 records all carry both `projectId` and `blindTag`. Server functions validate that the Blind belongs to the Project before creation or update.

## 3. Defect linkage

```text
blinds.tag
  → defect_notifications.blindTag
  → punch_items.defectId (optional)
  → ndt_records.defectId (optional/required by defect policy)
```

A defect requiring NDT is satisfied only by accepted NDT linked to that defect. An unrelated NDT record does not release the quality gate.

## 4. Quality readiness linkage

```text
Workflow transition / certificate readiness
  → getQualityGateReadiness(projectId, blindTag)
      ├─ unresolved defects
      ├─ mandatory open punch items
      └─ required NDT not accepted
```

Policy source:

```text
workflow_policy_settings
  ├─ requireDefectDispositionBeforeClosure
  ├─ requireMandatoryPunchClosureBeforeReadyForClosure
  ├─ requireNdtAcceptanceBeforeReadyForClosure
  └─ allowPunchTransfer
```

The policy is enforced server-side and is not trusted from the client.

## 5. Certificate linkage

```text
certificate_records
  ├─ projectId → projects.id
  ├─ blindTag → blinds.tag
  ├─ previousCertificateId → prior controlled version
  ├─ snapshotJson → immutable controlled snapshot
  ├─ snapshotHash → SHA-256 of canonical snapshot
  └─ verificationToken → public lookup token
```

Snapshot sources:

- project and blind identity;
- canonical workflow runtime and phase records;
- checklists and transitions;
- compliance and mechanical records;
- final approvals;
- evidence metadata;
- defects, punches and NDT;
- isolation package membership;
- system/certificate settings.

Public verification returns a restricted projection, not `snapshotJson`.

## 6. Evidence/storage linkage

```text
workflow_evidence_attachments
  ├─ fileUrl = /storage/{key}
  └─ storageKey = provider-neutral object key
          ↓
storage.ts
  ├─ S3/Railway Put/Get/Delete
  └─ Forge Put/Get legacy mode
```

The database remains independent from the bucket hostname or signed URL.

## 7. RBAC linkage

Permissions include:

- `workflow.quality.defect.record`
- `workflow.quality.defect.review`
- `workflow.quality.punch.manage`
- `workflow.quality.punch.verify`
- `workflow.quality.ndt.record`
- `workflow.quality.ndt.review`
- `workflow.certificate.issue`
- `workflow.certificate.reissue`
- `workflow.certificate.revoke`

RBAC is seeded for fresh installations and provisioned by the Sprint 4 migration for upgraded installations.

## 8. Audit linkage

Certificate issue/reissue/revoke writes to workflow logs. Quality and field actions use the existing runtime audit trail. Record versions preserve concurrency boundaries; approved/final records require controlled review actions rather than silent overwrites.

## 9. Deployment linkage

```text
railway.json preDeployCommand
  → pnpm db:migrate
      ├─ drizzle-kit migrate
      └─ apply-sbts-domain-migrations.ts
            ├─ sbts_domain_migrations
            └─ sbts_domain_migration_steps
```

Application startup follows only after the pre-deploy command succeeds.
