# Sprint 0 Baseline Report

Generated: 2026-07-31T12:44:50.048Z

## Application inventory

- Package: sbts-professional 2.2.2
- Source files: 273
- Client pages: 22
- Server routers: 16
- Automated tests: 32
- SQL migrations: 20

## Baseline findings

### Legacy phase references

- Count: 259
- Example files: `client/src/components/blinds/BlindDetailSheet.tsx`, `client/src/components/dashboard/BlindsRegistry.tsx`, `client/src/components/dashboard/MetricsCards.tsx`, `client/src/components/profile/ActivityTimeline.tsx`, `client/src/pages/BlindDetail.tsx`, `client/src/pages/BlindDetailHub.tsx`, `client/src/pages/ProjectDetail.tsx`, `client/src/pages/Reports.tsx`

### Mock-data imports

- Count: 0
- Example files: None

### TODO/FIXME markers

- Count: 0
- Example files: None

### Potential placeholder actions

- Count: 111
- Example files: `client/src/components/access-control/PermissionMatrix.tsx`, `client/src/components/areas/CreateAreaDialog.tsx`, `client/src/components/blinds/SurveyDialog.tsx`, `client/src/components/dashboard/BlindsRegistry.tsx`, `client/src/components/projects/CreateProjectDialog.tsx`, `client/src/components/settings/CertificateQualitySettings.tsx`, `client/src/components/settings/InspectionActivityBuilder.tsx`, `client/src/components/ui/command.tsx`

## Sprint 0 controls

- Canonical workflow specification: `shared/workflowSpecification.ts`
- Workflow policy settings: database-backed singleton
- Foundation migration: `drizzle/0013_sprint0_sprint1_foundation.sql`
- Runtime domain migration: `drizzle/0014_sprint2_workflow_runtime.sql`
- Verification command: `pnpm verify`

## Known boundary

The canonical eight-phase runtime is authoritative after Migration 0014. The five legacy phase values remain as a synchronized compatibility projection for older reports and components until their removal in a later controlled migration; direct legacy phase changes are blocked.
