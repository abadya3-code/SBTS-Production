import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const exists = (file) => fs.existsSync(path.join(root, file));
const failures = [];
const checks = [];
function check(name, condition, detail) { checks.push({ name, passed: Boolean(condition), detail }); if (!condition) failures.push(`${name}: ${detail}`); }

const required = [
  "drizzle/0015_sprint3_vertical_integration.sql",
  "server/db/inspectionActivities.ts",
  "client/src/components/workflow/WorkflowOperationsPanel.tsx",
  "client/src/components/workflow/InspectionActivitiesPanel.tsx",
  "client/src/components/settings/InspectionActivityBuilder.tsx",
  "client/src/pages/IsolationPackages.tsx",
];
for (const file of required) check(`Required file ${file}`, exists(file), file);

const migration = read("drizzle/0015_sprint3_vertical_integration.sql");
const schema = read("drizzle/schema.ts");
const router = read("server/routers/workflowRuntime.ts");
const records = read("server/db/workflowRecords.ts");
const runtime = read("server/db/workflowRuntime.ts");
const inspection = read("server/db/inspectionActivities.ts");
const panel = read("client/src/components/workflow/WorkflowOperationsPanel.tsx");
const inspectionPanel = read("client/src/components/workflow/InspectionActivitiesPanel.tsx");
const settings = read("client/src/pages/SystemSettings.tsx");
const packagesPage = read("client/src/pages/IsolationPackages.tsx");
const app = read("client/src/App.tsx");
const navigation = read("client/src/lib/domainCatalog.ts");
const seed = read("server/db/seed.ts");

for (const table of ["inspection_activity_templates", "inspection_activity_records"]) {
  check(`Schema contains ${table}`, schema.includes(`"${table}"`), table);
  check(`Migration creates ${table}`, migration.includes(`\`${table}\``), table);
}
for (const field of ["requireEvidenceBeforePhaseSubmit", "evidenceMaxFileSizeMb", "evidenceAllowedMimeTypesJson", "defaultTorqueUnit", "defaultPumpPressureUnit", "fieldRecordEditorMode"]) {
  check(`Workflow policy field ${field}`, schema.includes(field) && migration.includes(field) && settings.includes(field), field);
}
check("Evidence MIME validation", router.includes("defaultAllowedEvidenceTypes") && router.includes("Evidence type") && settings.includes("Allowed MIME types"), "Both client/admin and server must control MIME types.");
check("Evidence size validation", router.includes("evidenceMaxFileSizeMb") && panel.includes("Maximum evidence size"), "Evidence size must be checked on both sides.");
check("Evidence gate", runtime.includes("EVIDENCE_REQUIRED") && runtime.includes("requireEvidenceBeforePhaseSubmit"), "State machine must enforce configured evidence requirement.");
check("Evidence audit", records.includes("Workflow Evidence Uploaded") && records.includes("Workflow Evidence Removed"), "Evidence operations must appear in the audit trail.");
check("Field record audit", records.includes("Permit Record Created") && records.includes("LOTO Record Created") && records.includes("Gas Test Recorded") && records.includes("Torque Record Created") && records.includes("Leak Test Created"), "All field records require audit events.");
check("Torque roles separated in runtime", runtime.includes("canSubmitInstallationTorque") && runtime.includes("canVerifyInstallationTorque"), "Execution and independent verification permissions must be separate.");
check("Torque roles separated in UI", panel.includes("Execution roles create and submit") && panel.includes("effectiveStatuses"), "UI must not offer unsafe torque decisions.");
check("Inspection builder backend", router.includes("saveTemplate") && inspection.includes("upsertInspectionActivityTemplate"), "Inspection templates must be database-backed.");
check("Inspection mandatory gate", runtime.includes("INSPECTION_ACTIVITIES_INCOMPLETE") && runtime.includes("inspectionActivityTemplates"), "Mandatory configured inspection activities must block progression.");
check("Inspection evidence enforcement", inspection.includes("requires inspection evidence") && inspection.includes("workflowEvidenceAttachments"), "Evidence-required inspection activities must be enforced.");
check("Independent inspection approval", inspection.includes("workflow.inspection.approve") && inspection.includes("different user than the activity completer"), "Approval-required inspection activities need a dedicated permission and independent user.");
check("Inspection gate waits for approval", inspection.includes("inspectionActivityIsGateComplete") && inspection.includes('status === "approved"'), "Completed activities requiring approval must remain gate-incomplete until approved.");
check("Approved inspection records locked", inspection.includes("is approved and locked"), "Approved inspection activities must not be silently edited.");
check("Local readiness datetime", packagesPage.includes("toLocalDateTimeInput"), "Datetime-local controls must not display UTC-shifted values.");
check("Inspection builder in Settings", settings.includes("InspectionActivityBuilder") && read("client/src/components/settings/InspectionActivityBuilder.tsx").includes("Mandatory transition gate"), "Settings must support future inspection configuration.");
check("Inspection field panel", inspectionPanel.includes("saveRecord") && panel.includes("InspectionActivitiesPanel"), "Blind Detail must expose live inspection activity records.");
check("Isolation Package API", router.includes("isolationPackage: router") && router.includes("detail:") && records.includes("getIsolationPackageDetail"), "Package listing and detail APIs must exist.");
check("Isolation Package page route", app.includes("/isolation-packages") && navigation.includes("Isolation Packages") && packagesPage.includes("Vessel Isolation Packages"), "Package management must be navigable.");
check("Entry readiness editor", packagesPage.includes("Update Entry Readiness") && panel.includes("EntryReadinessDialog"), "Entry readiness must be editable from package and blind context.");
check("Theme-aligned components", panel.includes("bg-card") || panel.includes("bg-muted") && packagesPage.includes("text-foreground"), "New UI must use semantic theme tokens.");
check("Sprint 3 permissions in migration", migration.includes("workflow.record.evidence") && migration.includes("workflow.record.inspection") && migration.includes("workflow.inspection.configure") && migration.includes("workflow.inspection.approve"), "Migration must provision new RBAC permissions.");
check("Sprint 3 permissions in seed", seed.includes("workflow.record.evidence") && seed.includes("workflow.record.inspection") && seed.includes("workflow.inspection.configure") && seed.includes("workflow.inspection.approve"), "Fresh databases must receive the same permissions.");
check("TiDB compatibility", !migration.includes("JSON_TABLE("), "Sprint 3 migration must remain TiDB compatible.");
check("Safe evidence defaults backfilled", migration.includes("UPDATE `workflow_policy_settings`") && migration.includes("image/jpeg"), "Existing policy rows must receive restrictive MIME defaults.");

const report = { generatedAt: new Date().toISOString(), checks: checks.length, passed: checks.filter((x) => x.passed).length, failed: failures.length, failures };
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exit(1);
