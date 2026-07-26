# SBTS Sprint 3 Delivery Notes

## Release

`SBTS Professional 2.0.0-beta.3`

## Purpose

Connect Sprint 2's canonical workflow runtime to real field-operation forms, Isolation Packages, inspection configuration and evidence handling while retaining the existing application design system and database-backed workflow policies.

## Installation sequence

1. Use a Staging environment.
2. Back up and restore-test the database.
3. Install dependencies with the lockfile.
4. Run all verification commands.
5. Apply migrations in numeric order.
6. Configure Workflow & Safety Settings.
7. Execute the multi-role end-to-end scenario.
8. Do not promote to Production until UAT and security gates pass.

## Important boundaries

- The legacy phase projection remains for compatibility.
- Inline field-editor mode is stored but not enabled; dialog mode is supported.
- Evidence database deletion does not yet remove the underlying object from storage.
- Certificate locking/hashing and controlled reissue remain a later release item.
- Detailed defect/punch/NDT sub-workflows remain future vertical modules.

## Primary changed areas

- `drizzle/0015_sprint3_vertical_integration.sql`
- `drizzle/schema.ts`
- `server/db/workflowRuntime.ts`
- `server/db/workflowRecords.ts`
- `server/db/inspectionActivities.ts`
- `server/routers/workflowRuntime.ts`
- `server/routers/settings.ts`
- `client/src/components/workflow/WorkflowOperationsPanel.tsx`
- `client/src/components/workflow/InspectionActivitiesPanel.tsx`
- `client/src/components/settings/InspectionActivityBuilder.tsx`
- `client/src/pages/BlindDetailHub.tsx`
- `client/src/pages/IsolationPackages.tsx`
- `client/src/pages/SystemSettings.tsx`
