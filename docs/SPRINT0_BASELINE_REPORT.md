# Sprint 0 Baseline Report

Generated: 2026-07-26T07:18:40.678Z

## Application inventory

- Package: sbts-professional 2.1.0
- Source files: 262
- Client pages: 23
- Server routers: 16
- Automated tests: 28
- SQL migrations: 18

## Baseline findings

### Legacy phase references

- Count: 270
- Example files: `client/src/components/blinds/BlindDetailSheet.tsx`, `client/src/components/dashboard/BlindsRegistry.tsx`, `client/src/components/dashboard/MetricsCards.tsx`, `client/src/components/profile/ActivityTimeline.tsx`, `client/src/lib/mockData.ts`, `client/src/pages/BlindDetail.tsx`, `client/src/pages/BlindDetailHub.tsx`, `client/src/pages/ProjectDetail.tsx`

### Mock-data imports

- Count: 5
- Example files: `client/src/components/access-control/PermissionMatrix.tsx`, `client/src/components/layout/AppShell.tsx`, `client/src/pages/AccessControl.tsx`, `client/src/pages/Dashboard.tsx`, `client/src/pages/WorkflowStudio.tsx`

### TODO/FIXME markers

- Count: 0
- Example files: None

### Potential placeholder actions

- Count: 106
- Example files: `client/src/components/AIChatBox.tsx`, `client/src/components/access-control/PermissionMatrix.tsx`, `client/src/components/blinds/SurveyDialog.tsx`, `client/src/components/dashboard/BlindsRegistry.tsx`, `client/src/components/settings/CertificateQualitySettings.tsx`, `client/src/components/settings/InspectionActivityBuilder.tsx`, `client/src/components/ui/command.tsx`, `client/src/components/ui/input.tsx`

## Sprint 0 controls

- Canonical workflow specification: `shared/workflowSpecification.ts`
- Workflow policy settings: database-backed singleton
- Foundation migration: `drizzle/0013_sprint0_sprint1_foundation.sql`
- Runtime domain migration: `drizzle/0014_sprint2_workflow_runtime.sql`
- Verification command: `pnpm verify`

## Known boundary

The canonical eight-phase runtime is authoritative after Migration 0014. The five legacy phase values remain as a synchronized compatibility projection for older reports and components until their removal in a later controlled migration; direct legacy phase changes are blocked.
