# SBTS Sprint 3 Data Linkage Map

## 1. Canonical operational path

```text
Project
  └─ Project Workflow Assignment
      └─ Isolation Package
          ├─ Required Blind Links
          └─ Entry Readiness
              └─ Blind Workflow Runtime
                  ├─ Current Phase Instance
                  ├─ Checklist Responses
                  ├─ Permit Records
                  ├─ LOTO Record
                  ├─ Gas Tests
                  ├─ Torque Records
                  ├─ Inspection Activities
                  ├─ Evidence Attachments
                  ├─ Leak Test
                  ├─ Safety Hold
                  ├─ Sequential Approvals
                  └─ Transition/Audit Events
```

## 2. Frontend to backend linkage

| UI surface | tRPC API | Database authority |
|---|---|---|
| Blind Detail current state | `workflowRuntime.state` | `blind_workflow_runtime`, phase/checklist/record tables |
| Checklist item | `workflowRuntime.checklist.update` | `blind_checklist_responses` |
| Phase command | `workflowRuntime.transition` | runtime, phase instances, transition events |
| Permit editor | `workflowRuntime.permit.save` | `permit_records` |
| LOTO editor | `workflowRuntime.loto.save` | `loto_records` |
| Gas-test editor | `workflowRuntime.gasTest.create` | `gas_test_records` |
| Torque editor/review | `workflowRuntime.torque.save` | `torque_records` |
| Leak-test editor | `workflowRuntime.leakTest.save` | `leak_test_records` |
| Inspection activity | `workflowRuntime.inspection.saveRecord` | `inspection_activity_records` |
| Inspection Builder | `workflowRuntime.inspection.saveTemplate` | `inspection_activity_templates` |
| Evidence upload/remove | `workflowRuntime.evidence.*` | storage + `workflow_evidence_attachments` |
| Isolation Package list/detail | `workflowRuntime.isolationPackage.list/detail` | package/link/readiness/runtime tables |
| Entry readiness update | `workflowRuntime.isolationPackage.entryReadiness` | `entry_readiness_records` plus server-derived gates |
| Final approval review | `workflowRuntime.approval.record` | `workflow_approval_steps` |
| Safety Hold | `workflowRuntime.safetyHold.*` | `safety_holds`, runtime lock and audit |
| Workflow & Safety Settings | `settings.workflowPolicy.*` | `workflow_policy_settings` |

## 3. Blind Detail data composition

`WorkflowOperationsPanel` receives one authoritative runtime response. It does not maintain independent client-only compliance states. The response combines:

- Runtime phase and lifecycle.
- Current phase definition.
- Gate readiness and blocking reasons.
- User permissions.
- Permits, LOTO, gas tests, torque and leak test.
- Isolation Packages and entry-readiness records.
- Approval chain.
- Current-phase evidence.

After every mutation, the relevant query and runtime are refetched so displayed gates remain server-derived.

## 4. Settings linkage

| Setting | Backend behavior | UI behavior |
|---|---|---|
| `requireEvidenceBeforePhaseSubmit` | blocks transition with no current-phase evidence | shows evidence panel and gate reason |
| `evidenceMaxFileSizeMb` | validates decoded file bytes | validates before upload and displays limit |
| `evidenceAllowedMimeTypesJson` | MIME allow-list, safe restrictive fallback | drives file picker validation |
| `defaultTorqueUnit` | stored plant default | pre-fills torque editor |
| `defaultPumpPressureUnit` | stored plant default | pre-fills torque editor |
| `fieldRecordEditorMode` | policy record | dialog mode supported; inline reserved |
| Inspection templates | server gate evaluates active mandatory rows | Builder and Blind Detail render database configuration |

## 5. Theme linkage

The new components use the global design tokens and inherit the active application theme. Workflow settings control behavior, not an isolated component theme. Theme selection remains governed by the existing database-backed system theme policy.

## 6. Compatibility boundary

`blind_workflow_runtime.currentPhaseKey` is authoritative. `blinds.phase` remains a synchronized compatibility projection for legacy reports/components. Sprint 3 forms read and write canonical runtime tables and do not directly mutate the legacy phase.
