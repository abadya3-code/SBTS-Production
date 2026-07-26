# SBTS Sprint 2 — Data Linkage Map

## Authoritative relationships

| Source | Target | Relationship | Purpose |
|---|---|---|---|
| `projects.id` | `project_workflow_assignments.projectId` | 1:1 | Assign canonical template/version to a project |
| `blinds.tag` | `blind_workflow_runtime.blindTag` | 1:1 | Current canonical state and concurrency version |
| `blinds.tag` | `blind_phase_instances.blindTag` | 1:8 | Runtime phase history/state |
| `blinds.tag` | `blind_checklist_responses.blindTag` | 1:64 initial | Persist phase checklist responses |
| `blinds.tag` | `workflow_transition_events.blindTag` | 1:N | Accepted/rejected/override command history |
| `blinds.tag` | compliance/mechanical tables | 1:N or 1:1 | PTW, LOTO, gas tests, torque and leak tests |
| `isolation_packages.id` | `isolation_package_blinds.packageId` | 1:N | Group all required isolation points for equipment |
| `isolation_packages.id` | `entry_readiness_records.packageId` | 1:N revisions | Authorize vessel entry from derived package state |
| `blinds.tag` | `safety_holds.blindTag` | 1:N | Stop-work and release governance |
| `blinds.tag` | `workflow_approval_steps.blindTag` | 1:N | Sequential final approvals |

## Write ownership

- `blind_workflow_runtime`: state machine only.
- `blinds.phase`: state-machine compatibility projection only.
- `blind_phase_instances`: state machine and checklist service.
- `workflow_transition_events`: append-only runtime event log.
- Compliance records: dedicated record APIs with granular permissions.
- Package status: derived by package reconciliation, not manually edited.
- Workflow policy: Admin Settings API only.

## Frontend linkage

- Project Detail reads canonical runtime summaries for phase distribution and lifecycle status.
- Blind Detail Hub reads `workflowRuntime.state`, updates checklist records, sends action commands and manages Safety Holds.
- Workflow & Safety Settings reads/writes the database singleton used by the same backend gate evaluator.
- Theme settings remain database-controlled and apply through the existing theme provider across project, Blind and Settings pages.

## Legacy compatibility

The five legacy phase labels remain for older dashboards/reports. Their values are synchronized from canonical transitions. Direct edits are blocked. A future controlled migration can remove the compatibility projection after every consumer moves to canonical phase/lifecycle fields.
