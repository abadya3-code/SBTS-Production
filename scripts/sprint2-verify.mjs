import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const exists = (relative) => fs.existsSync(path.join(root, relative));
const failures = [];
const checks = [];

function check(name, condition, detail) {
  checks.push({ name, passed: Boolean(condition), detail });
  if (!condition) failures.push(`${name}: ${detail}`);
}

const requiredFiles = [
  "drizzle/0014_sprint2_workflow_runtime.sql",
  "server/db/workflowRuntime.ts",
  "server/db/workflowRecords.ts",
  "server/routers/workflowRuntime.ts",
  "shared/workflowRuntime.ts",
  "server/workflowRuntime.logic.test.ts",
];
for (const file of requiredFiles) check(`Required file ${file}`, exists(file), file);

const schema = read("drizzle/schema.ts");
const migration = read("drizzle/0014_sprint2_workflow_runtime.sql");
const runtime = read("server/db/workflowRuntime.ts");
const records = read("server/db/workflowRecords.ts");
const settingsUi = read("client/src/pages/SystemSettings.tsx");
const projectDetail = read("client/src/pages/ProjectDetail.tsx");
const blindDetail = read("client/src/pages/BlindDetailHub.tsx");
const projectsRouter = read("server/routers/projects.ts");
const blindsDb = read("server/db/blinds.ts");
const routersIndex = read("server/routers/index.ts");

const domainTables = [
  "project_workflow_assignments",
  "blind_workflow_runtime",
  "blind_phase_instances",
  "blind_checklist_responses",
  "workflow_transition_events",
  "isolation_packages",
  "isolation_package_blinds",
  "entry_readiness_records",
  "permit_records",
  "loto_records",
  "gas_test_records",
  "torque_records",
  "leak_test_records",
  "safety_holds",
  "workflow_approval_steps",
  "workflow_evidence_attachments",
];
for (const table of domainTables) {
  check(`Schema table ${table}`, schema.includes(`\"${table}\"`) || schema.includes(`'${table}'`), table);
  check(`Migration table ${table}`, migration.includes(`\`${table}\``), table);
}

const canonicalPhases = [
  "operationsInitialIsolation",
  "blindInstallation",
  "mechanicalVerification",
  "internalInspection",
  "reinstatementPreparation",
  "blindRemovalReinstatement",
  "reinstatementVerification",
  "finalApprovalReturnToService",
];
for (const phase of canonicalPhases) check(`Canonical phase ${phase}`, runtime.includes(phase) && migration.includes(phase), phase);

check("Action-command state machine", runtime.includes("workflowActionToPhase") && runtime.includes("transitionBlindWorkflow"), "Runtime must accept commands rather than arbitrary phase labels.");
check("Optimistic concurrency", runtime.includes("expectedRecordVersion") && runtime.includes("STALE_RECORD_VERSION"), "Record version validation must be present.");
check("Safety Hold runtime", runtime.includes("placeWorkflowSafetyHold") && runtime.includes("releaseWorkflowSafetyHold"), "Safety Hold operations must be present.");
check("Isolation Package reconciliation", runtime.includes("reconcileIsolationPackagesForBlind"), "Package status must derive from linked Blind runtimes.");
check("Authorized Gas Tester", records.includes("workflow.record.gasTest") && records.includes("authorizedGasTesterRoleKey"), "Gas-test authorization must be role and permission controlled.");
check("Granular compliance permissions", records.includes("workflow.record.permit") && records.includes("workflow.record.loto") && records.includes("workflow.record.leakTest") && records.includes("workflow.package.manage"), "Permit, LOTO, leak-test and package APIs must use dedicated permissions.");
check("Migration seeds Sprint 2 RBAC", migration.includes("workflow.record.permit") && migration.includes("workflow.package.manage") && migration.includes("access_role_permissions"), "Migration must seed required roles and permissions before runtime use.");
check("Gas calibration enforcement", records.includes("gasTestRequiresInstrumentCalibration") && runtime.includes("gasTestRequiresInstrumentCalibration"), "Record creation and gates must validate calibration.");
check("Plant gas limits enforced", records.includes("evaluateGasTestAcceptance") && runtime.includes("GAS_TEST_OUT_OF_LIMITS") && settingsUi.includes("gasTestLimitsConfigured"), "Gas-test acceptance limits must be configured, enforced and editable in Settings.");
check("Torque execution and acceptance separated", records.includes("verificationPermission") && records.includes("acceptedByOpenId") && runtime.includes("independently accepted"), "Technicians submit torque; independent verifiers accept it.");
check("Entry authorization role separated", records.includes("workflow.entry.prepare") && records.includes("workflow.entry.authorize") && records.includes("Only an authorized Entry Supervisor") && records.includes("const pressureZero = canPrepare ?"), "Operations preparation and Entry Supervisor authorization must remain separate.");
check("Operations Foreman final authority", runtime.includes("operationsForeman") && migration.includes("workflow.phase.returnToService.authorize") && migration.includes("'operationsForeman',4"), "Final return-to-service authority must be assigned to Operations Foreman.");
check("Safety Hold restores exact lifecycle", runtime.includes("previousLifecycleStatus") && runtime.includes("releaseRequestedByOpenId") && migration.includes("previousLifecycleStatus"), "Two-person release must restore the pre-hold lifecycle state.");
check("Workflow notifications connected", runtime.includes("workflow_gate_blocked") && runtime.includes("workflow_transition") && runtime.includes("safety_hold_placed"), "Canonical runtime events must reach the notification engine.");
check("Notification preferences exposed", settingsUi.includes("workflowGateBlocked") && settingsUi.includes("safetyHoldReleased"), "Admins must be able to manage Sprint 2 notifications.");
check("Migration refreshes canonical template", migration.includes("ON DUPLICATE KEY UPDATE") && !migration.includes("INSERT IGNORE INTO `workflow_phases`"), "Existing Sprint 1 seed rows must receive Sprint 2 action/checklist fields.");
check("Migration materializes checklists", migration.includes("blind_checklist_responses") && migration.includes("CROSS JOIN (") && migration.includes("01-equipment-shutdown-confirmed"), "Checklist instances must be generated for migrated Blinds without unsupported JSON_TABLE usage.");
check("TiDB-compatible migration", !migration.includes("JSON_TABLE("), "TiDB does not support JSON_TABLE; Sprint 2 migration must use portable derived rows.");
check("Direct legacy phase update blocked in router", projectsRouter.includes("Direct phase changes are disabled"), "Projects router must reject arbitrary phase update.");
check("Direct legacy phase update blocked in DB", blindsDb.includes("Direct legacy phase changes are disabled"), "DB mutation must reject arbitrary phase update.");
check("Runtime router registered", routersIndex.includes("workflowRuntime"), "Root tRPC router must expose workflowRuntime.");
check("Settings contains gas tester controls", settingsUi.includes("authorizedGasTesterRoleKey") && settingsUi.includes("entryReadinessValidityMinutes"), "Workflow & Safety UI must expose future-safe policies.");
check("Settings limits workflow adapter", settingsUi.includes('workflow.id === "wf-sbts-standard-v2"'), "Settings must not activate a template unsupported by the Sprint 2 runtime adapter.");
check("Project page shows canonical phases", projectDetail.includes("canonicalWorkflowPhases.map"), "Project Detail must show the eight-phase runtime.");
check("Blind Detail consumes runtime", blindDetail.includes("workflowRuntime.state") || blindDetail.includes("workflowRuntime"), "Blind Detail must read runtime state from the backend.");
check("Blind Detail controls hold release", blindDetail.includes("safetyHold.release") && blindDetail.includes("Approve Independent Hold Release"), "Safety Hold release must be visible and connected to the backend.");
check("Slip Blind no longer blocked at creation", !projectDetail.includes("requires Foreman Metal approval and merged confirmation while the project setting is active"), "Metal Foreman belongs in the conditional final approval chain.");

const report = {
  generatedAt: new Date().toISOString(),
  checks: checks.length,
  passed: checks.filter((item) => item.passed).length,
  failed: failures.length,
  failures,
};
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exit(1);
