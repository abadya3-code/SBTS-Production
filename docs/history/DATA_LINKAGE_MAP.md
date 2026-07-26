# SBTS Data Linkage Map — Sprint 0/1

## Purpose

This map prevents UI, API and database drift. Every production feature must follow the same path:

`React page/component → tRPC procedure → database helper → Drizzle table → audit/validation`.

## Implemented linkages

| Product surface | Frontend | tRPC | Database helper | Table / source |
|---|---|---|---|---|
| General identity | `SystemSettings.tsx` | `settings.general.get/update` | `get/upsertSystemSettings` | `system_settings` |
| System theme policy | `SystemSettings.tsx`, `ThemeContext.tsx`, `UserProfile.tsx` | `settings.appearance.get`, `settings.general.update` | `get/upsertSystemSettings` | `system_settings.defaultTheme`, `allowUserThemeOverride` |
| Workflow & safety policy | `SystemSettings.tsx` | `settings.workflowPolicy.get/update` | `get/upsertWorkflowPolicySettings` | `workflow_policy_settings` |
| Workflow Studio | `WorkflowStudio.tsx` | `workflow.list/get/save/delete` | workflow CRUD | `workflow_templates`, `workflow_phases` |
| Canonical workflow truth | Shared frontend/backend import | N/A | Seed consumes specification | `shared/workflowSpecification.ts` |
| Access roles and permissions | Access Control + Workflow Studio | `accessControl.*` | access-control helpers and seed | `access_roles`, `access_permissions`, `access_role_permissions` |
| Dashboard hero and branding | `Dashboard.tsx` | `settings.general.get` | `getSystemSettings` | `system_settings.dashboardHero*` |
| Legacy blind lifecycle | Project/Blind pages | `projects.*` | blind/project helpers | `blinds`, `project_phase_owners`, legacy phase approvals/logs |

## Canonical workflow insertion

`seedWorkflows()` now inserts `wf-sbts-standard-v2` even when older workflow templates already exist. It does not overwrite active legacy records.

The active canonical workflow is selected by:

`workflow_policy_settings.activeWorkflowTemplateId`.

## Controlled migration boundary

The following items remain legacy until the database-domain and state-machine sprint:

- `blinds.phase` still uses five legacy values.
- `project_phase_owners.phase` still uses the legacy enum.
- Existing blind phase approvals and logs still reference legacy phases.
- Dashboard registry metrics still include mock-backed content.

This is intentional. Directly replacing a MySQL enum and current production records without phase-instance migration could create invalid records or false safety states.

## Next required linkage

The next vertical slice must create runtime records for:

1. Operations Initial Isolation.
2. PTW and LOTO verification.
3. Gas-test validity.
4. Installation and torque record.
5. Independent mechanical verification.
6. Active Isolation state.

No UI action should advance those records until the server transition guard verifies every mandatory requirement.
