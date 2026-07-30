/**
 * server/db/seed.ts
 * ─────────────────
 * Explicit seed routines.
 *
 * System reference data (permissions, roles, workflow templates) is installed
 * during deployment. Demo areas/projects/blinds are opt-in and are never
 * invoked from production read paths.
 */

import { asc } from "drizzle-orm";
import {
  InsertArea, InsertBlind, InsertProject, InsertProjectPhaseOwner, InsertProjectSettings,
  accessPermissions, accessRolePermissions, accessRoles, areas, blinds, featureToggles,
  projectPhaseOwners, projectSettings, projects, workflowPhases, workflowTemplates,
} from "../../drizzle/schema";
import { requireDb } from "./core";
import {
  BlindPhase, BlindPriority, PermissionGroupModel, PhaseKey, ProjectPhaseOwnerInput,
  RoleModel, WorkflowTemplateInput,
} from "./types";
import { canonicalWorkflowPhases, canonicalPhaseKeys } from "../../shared/workflowSpecification";
// upsertWorkflow imported lazily in seedWorkflows() to avoid circular dependency

// ─── Phase & Priority Constants ────────────────────────────────────────────

export const blindPhaseOrder: BlindPhase[] = [
  "Broken / Preparation", "Assembly", "Tight & Torque", "Final Tight", "Inspection Ready",
];
export const blindPriorityOrder: BlindPriority[] = ["Low", "Normal", "High", "Critical"];
export const defaultPhaseColors: Record<BlindPhase, string> = {
  "Broken / Preparation": "#f59e0b",
  Assembly: "#2563eb",
  "Tight & Torque": "#7c3aed",
  "Final Tight": "#0891b2",
  "Inspection Ready": "#059669",
};

export function sanitizePhaseColor(value: string | null | undefined, phase: BlindPhase): string {
  const color = (value ?? "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : defaultPhaseColors[phase];
}

export const defaultPhaseOwners: ProjectPhaseOwnerInput[] = blindPhaseOrder.map((phase) => ({
  phase,
  owners: [],
  ownerName: "Unassigned",
  ownerRole: "unassigned",
  phaseColor: defaultPhaseColors[phase],
}));

// ─── Seed Data ─────────────────────────────────────────────────────────────

const seedAreas: (InsertArea & { id: number })[] = [
  { id: 1, name: "Shedgum Process Train 4", code: "SGP-04", description: "Shutdown work pack for Train-4 with the highest current blind activity.", location: "Shedgum Gas Plant · Process Trains", isActive: 1 },
  { id: 2, name: "North Manifold Group", code: "NMG-02", description: "Manifold isolation zone for northern field interfaces and shared headers.", location: "North Manifold Corridor", isActive: 1 },
  { id: 3, name: "Utility Header Maintenance", code: "UHM-01", description: "Utility header scope covering maintenance preparations, isolation, and final review.", location: "Utilities and Offsites", isActive: 1 },
];

const seedProjects: InsertProject[] = [
  { id: "PRJ-1027", name: "Shedgum Train-4 Shutdown", areaId: 1, status: "Active", blindsCount: 42, progress: 74, description: "Coordinated blind installation and verification package for the Train-4 shutdown scope." },
  { id: "PRJ-1033", name: "North Manifold Isolation", areaId: 2, status: "Active", blindsCount: 31, progress: 58, description: "Isolation sequence for manifold tie-ins with technician and QC checkpoints." },
  { id: "PRJ-1041", name: "Utility Header Maintenance", areaId: 3, status: "Final Review", blindsCount: 26, progress: 91, description: "Utility header maintenance scope in inspection-ready review before closeout." },
];

const seedBlinds: InsertBlind[] = [
  { tag: "BLD-1042", projectId: "PRJ-1027", type: "Spectacle Blind", size: "24 in", phase: "Tight & Torque", owner: "T&I Engineer", priority: "High", equipment: "SGP-04-FG-2401", location: "Train-4 inlet gas header", isolationPoint: "Upstream ESDV-401", notes: "Torque verification required before QC walkdown." },
  { tag: "BLD-1088", projectId: "PRJ-1027", type: "Spade", size: "18 in", phase: "Assembly", owner: "Metal Foreman", priority: "Normal", equipment: "SGP-04-CN-1812", location: "Condensate exchanger bay", isolationPoint: "Downstream flange set CN-1812-B", notes: "Mechanical crew assigned for assembly follow-up." },
  { tag: "BLD-1115", projectId: "PRJ-1027", type: "Spacer", size: "10 in", phase: "Inspection Ready", owner: "QC Inspector", priority: "Low", equipment: "SGP-04-UT-1007", location: "Utility tie-in skid", isolationPoint: "Skid boundary valve UT-17", notes: "Ready for final package review." },
  { tag: "BLD-1174", projectId: "PRJ-1033", type: "Blind Flange", size: "30 in", phase: "Broken / Preparation", owner: "Safety Officer", priority: "Critical", equipment: "NMG-02-MF-3004", location: "North manifold main header", isolationPoint: "Header inlet block valve NMG-22", notes: "Safety hold point must be cleared before assembly." },
  { tag: "BLD-1190", projectId: "PRJ-1033", type: "Spectacle Blind", size: "16 in", phase: "Tight & Torque", owner: "T&I Engineer", priority: "High", equipment: "NMG-02-GS-1609", location: "Shared gas service branch", isolationPoint: "Tie-in spool GS-1609-A", notes: "Torque sheet pending upload by field team." },
  { tag: "BLD-1226", projectId: "PRJ-1033", type: "Spacer", size: "8 in", phase: "Final Tight", owner: "QC Inspector", priority: "Normal", equipment: "NMG-02-VT-0802", location: "Vent header branch", isolationPoint: "Vent spool VT-0802-C", notes: "Final tight accepted; waiting inspection package." },
  { tag: "BLD-1302", projectId: "PRJ-1041", type: "Spade", size: "12 in", phase: "Inspection Ready", owner: "Inspection Team", priority: "Normal", equipment: "UHM-01-ST-1206", location: "Steam utility header", isolationPoint: "Steam header outlet ST-12", notes: "Inspection package staged for sign-off." },
  { tag: "BLD-1339", projectId: "PRJ-1041", type: "Spectacle Blind", size: "6 in", phase: "Final Tight", owner: "QC Inspector", priority: "High", equipment: "UHM-01-IA-0603", location: "Instrument air branch", isolationPoint: "IA branch flange 0603-D", notes: "High-priority closeout before utility restoration." },
];

export const seedPermissionGroups: PermissionGroupModel[] = [
  {
    group: "Projects & Areas",
    permissions: [
      { key: "projects.view", label: "View projects", description: "Read project and area lists", group: "Projects & Areas" },
      { key: "projects.create", label: "Create project", description: "Open new project records", group: "Projects & Areas" },
      { key: "projects.edit", label: "Edit project", description: "Update project details and areas", group: "Projects & Areas" },
      { key: "projects.delete", label: "Delete project", description: "Archive or remove project data", group: "Projects & Areas" },
    ],
  },
  {
    group: "Blind Registry",
    permissions: [
      { key: "blinds.view", label: "View blinds", description: "Read blind registry and QR pages", group: "Blind Registry" },
      { key: "blinds.create", label: "Create blind", description: "Add field blind records", group: "Blind Registry" },
      { key: "blinds.edit", label: "Edit blind", description: "Modify blind details and metadata", group: "Blind Registry" },
      { key: "blinds.phase.change", label: "Change phase", description: "Move a blind through workflow", group: "Blind Registry" },
      { key: "blinds.delete", label: "Delete blind", description: "Archive or delete blind records", group: "Blind Registry" },
    ],
  },
  {
    group: "Workflow & Sign-off",
    permissions: [
      { key: "workflow.view", label: "View workflow", description: "Read workflow ownership rules", group: "Workflow & Sign-off" },
      { key: "workflow.configure", label: "Configure workflow", description: "Change owners, gates, and sign-off rules", group: "Workflow & Sign-off" },
      { key: "workflow.approve", label: "Approve task", description: "Apply approval on assigned phases", group: "Workflow & Sign-off" },
      { key: "workflow.override", label: "Emergency override", description: "Use controlled admin override", group: "Workflow & Sign-off" },
      { key: "workflow.phase.operations.complete", label: "Complete Operations isolation", description: "Complete initial isolation and Operations handover", group: "Workflow & Sign-off" },
      { key: "workflow.phase.installation.submit", label: "Submit installation and torque", description: "Submit blind installation and controlled-tightening records", group: "Workflow & Sign-off" },
      { key: "workflow.phase.mechanical.verify", label: "Verify mechanical isolation", description: "Independently verify installed or reinstated joints", group: "Workflow & Sign-off" },
      { key: "workflow.phase.inspection.manage", label: "Manage inspection execution", description: "Complete inspection activities and ready-for-closure decision", group: "Workflow & Sign-off" },
      { key: "workflow.phase.removal.authorize", label: "Authorize blind removal", description: "Authorize controlled de-blinding preparation", group: "Workflow & Sign-off" },
      { key: "workflow.phase.reinstatement.submit", label: "Submit reinstatement", description: "Submit blind removal and reinstatement records", group: "Workflow & Sign-off" },
      { key: "workflow.phase.reinstatement.verify", label: "Verify reinstatement and leak test", description: "Approve final joint and leak/service-test verification", group: "Workflow & Sign-off" },
      { key: "workflow.phase.final.approve", label: "Authorize return to service", description: "Complete final approval and return-to-service authorization", group: "Workflow & Sign-off" },
      { key: "workflow.phase.returnToService.authorize", label: "Final return-to-service authorization", description: "Perform the final Operations authorization after the sequential approval chain is complete", group: "Workflow & Sign-off" },
      { key: "workflow.entry.prepare", label: "Prepare vessel entry readiness", description: "Record Operations readiness conditions for an Isolation Package", group: "Workflow & Sign-off" },
      { key: "workflow.entry.authorize", label: "Authorize vessel entry", description: "Authorize Vessel Entry Readiness as the assigned Entry Supervisor", group: "Workflow & Sign-off" },
      { key: "workflow.safety.hold", label: "Place safety hold", description: "Stop workflow progression for an unsafe condition", group: "Workflow & Sign-off" },
      { key: "workflow.safety.release", label: "Release safety hold", description: "Approve corrective action and release a safety hold", group: "Workflow & Sign-off" },
      { key: "workflow.record.gasTest", label: "Record gas test", description: "Create an authorized atmospheric gas-test record using a calibrated instrument", group: "Workflow & Sign-off" },
      { key: "workflow.record.permit", label: "Manage permit records", description: "Create and update PTW and line-breaking permit records linked to a Blind", group: "Workflow & Sign-off" },
      { key: "workflow.record.loto", label: "Manage LOTO records", description: "Create, verify and close LOTO records linked to a Blind", group: "Workflow & Sign-off" },
      { key: "workflow.record.leakTest", label: "Manage leak-test records", description: "Record and accept controlled leak or service tests", group: "Workflow & Sign-off" },
      { key: "workflow.record.evidence", label: "Manage workflow evidence", description: "Upload and remove phase-specific photos and supporting documents", group: "Workflow & Sign-off" },
      { key: "workflow.record.inspection", label: "Manage inspection activity records", description: "Complete configured inspection activities, results and approval evidence for a Blind", group: "Workflow & Sign-off" },
      { key: "workflow.inspection.configure", label: "Configure inspection activities", description: "Create, edit and enable plant inspection activity templates", group: "Workflow & Sign-off" },
      { key: "workflow.inspection.approve", label: "Approve inspection activities independently", description: "Approve or reject inspection activities configured for independent review", group: "Workflow & Sign-off" },
      { key: "workflow.quality.defect.record", label: "Record defect notifications", description: "Create and update inspection defect notifications", group: "Inspection & Quality" },
      { key: "workflow.quality.defect.review", label: "Review and disposition defects", description: "Accept, transfer, repair or close defect notifications", group: "Inspection & Quality" },
      { key: "workflow.quality.punch.manage", label: "Manage punch items", description: "Create and progress inspection punch items", group: "Inspection & Quality" },
      { key: "workflow.quality.punch.verify", label: "Verify punch closure", description: "Independently verify punch closure or transfer", group: "Inspection & Quality" },
      { key: "workflow.quality.ndt.record", label: "Record NDT work", description: "Create and update NDT work records", group: "Inspection & Quality" },
      { key: "workflow.quality.ndt.review", label: "Review NDT results", description: "Accept or reject NDT results independently", group: "Inspection & Quality" },
      { key: "workflow.certificate.issue", label: "Issue locked certificate", description: "Issue a hashed immutable certificate snapshot", group: "Certificates" },
      { key: "workflow.certificate.reissue", label: "Reissue certificate revision", description: "Create a controlled superseding certificate revision", group: "Certificates" },
      { key: "workflow.certificate.revoke", label: "Revoke certificate", description: "Revoke an issued certificate with audit reason", group: "Certificates" },
      { key: "workflow.package.manage", label: "Manage isolation packages", description: "Create Vessel Isolation Packages and link required Blinds", group: "Workflow & Sign-off" },
    ],
  },
  {
    group: "Users, Roles & Audit",
    permissions: [
      { key: "users.view", label: "View users", description: "Read users and specialties", group: "Users, Roles & Audit" },
      { key: "users.manage", label: "Manage users", description: "Create, approve, suspend users", group: "Users, Roles & Audit" },
      { key: "roles.manage", label: "Manage roles", description: "Edit role templates and permissions", group: "Users, Roles & Audit" },
      { key: "audit.view", label: "View audit logs", description: "Read system activity trail", group: "Users, Roles & Audit" },
    ],
  },
  {
    group: "Reports & Certificates",
    permissions: [
      { key: "reports.view", label: "View reports", description: "Open dashboard and report cards", group: "Reports & Certificates" },
      { key: "reports.export", label: "Export reports", description: "Download CSV/PDF summaries", group: "Reports & Certificates" },
      { key: "certificates.manage", label: "Manage certificates", description: "Configure certificate templates", group: "Reports & Certificates" },
      { key: "qr.manage", label: "Manage QR tags", description: "Generate or reissue QR links", group: "Reports & Certificates" },
    ],
  },
];

const allSeedPermissionKeys = seedPermissionGroups.flatMap((g) => g.permissions.map((p) => p.key));
const allSeedPhaseKeys: PhaseKey[] = ["broken", "assembly", "tightTorque", "finalTight", "inspectionReady", ...canonicalPhaseKeys];

export const seedRoles: RoleModel[] = [
  { key: "admin", name: "Administrator", subtitle: "Full platform owner and emergency override", members: 2, color: "#38bdf8", permissionKeys: allSeedPermissionKeys, menuKeys: ["dashboard", "projects", "blinds", "access-control", "reports", "audit", "settings"], phaseKeys: allSeedPhaseKeys },
  { key: "coordinator", name: "Coordinator", subtitle: "Project setup, area control, assignment follow-up", members: 4, color: "#60a5fa", permissionKeys: ["workflow.inspection.configure", "workflow.certificate.issue", "workflow.certificate.reissue", "workflow.record.evidence", "projects.view", "projects.create", "projects.edit", "blinds.view", "blinds.create", "blinds.edit", "workflow.view", "workflow.phase.final.approve", "workflow.package.manage", "reports.view", "users.view"], menuKeys: ["dashboard", "projects", "blinds", "reports"], phaseKeys: ["broken", "finalApprovalReturnToService"] },
  { key: "operations", name: "Operations", subtitle: "Initial isolation, process handover and controlled de-isolation preparation", members: 10, color: "#0f766e", permissionKeys: ["workflow.record.evidence", "projects.view", "blinds.view", "workflow.view", "workflow.phase.operations.complete", "workflow.phase.removal.authorize", "workflow.entry.prepare", "workflow.record.permit", "workflow.record.loto", "workflow.safety.hold"], menuKeys: ["dashboard", "projects", "blinds", "reports"], phaseKeys: ["operationsInitialIsolation", "reinstatementPreparation"] },
  { key: "operationsForeman", name: "Operations Foreman", subtitle: "Final operating line-up and return-to-service authority", members: 3, color: "#047857", permissionKeys: ["workflow.record.evidence", "projects.view", "blinds.view", "workflow.view", "workflow.phase.final.approve", "workflow.phase.returnToService.authorize", "workflow.certificate.issue", "workflow.certificate.revoke", "workflow.entry.prepare", "workflow.record.permit", "workflow.record.loto", "workflow.package.manage", "workflow.safety.hold", "workflow.safety.release", "reports.view", "audit.view"], menuKeys: ["dashboard", "projects", "blinds", "reports", "audit"], phaseKeys: ["finalApprovalReturnToService"] },
  { key: "mechanicalVerifier", name: "Independent Mechanical Verifier", subtitle: "Independent positive-isolation and reinstatement verification", members: 6, color: "#0891b2", permissionKeys: ["workflow.record.evidence", "projects.view", "blinds.view", "workflow.view", "workflow.phase.mechanical.verify", "workflow.phase.reinstatement.verify", "workflow.record.leakTest", "workflow.safety.hold", "workflow.safety.release", "reports.view", "audit.view"], menuKeys: ["dashboard", "blinds", "reports", "audit"], phaseKeys: ["mechanicalVerification", "reinstatementVerification"] },
  { key: "entrySupervisor", name: "Entry Supervisor", subtitle: "Confined-space entry readiness authorization", members: 4, color: "#7c3aed", permissionKeys: ["workflow.record.inspection", "workflow.inspection.approve", "workflow.quality.defect.record", "workflow.quality.defect.review", "workflow.quality.punch.manage", "workflow.quality.punch.verify", "workflow.quality.ndt.record", "workflow.quality.ndt.review", "workflow.record.evidence", "projects.view", "blinds.view", "workflow.view", "workflow.entry.authorize", "workflow.phase.inspection.manage", "workflow.safety.hold"], menuKeys: ["dashboard", "blinds"], phaseKeys: ["internalInspection"] },
  { key: "gasTester", name: "Authorized Gas Tester", subtitle: "Atmospheric testing, instrument verification and validity control", members: 6, color: "#14b8a6", permissionKeys: ["workflow.record.evidence", "projects.view", "blinds.view", "workflow.view", "workflow.record.gasTest", "workflow.safety.hold"], menuKeys: ["dashboard", "blinds"], phaseKeys: ["operationsInitialIsolation", "internalInspection", "reinstatementPreparation"] },
  { key: "technician", name: "Maintenance / Bolting Technician", subtitle: "Blind installation, removal and controlled-tightening execution", members: 18, color: "#f59e0b", permissionKeys: ["workflow.record.evidence", "projects.view", "blinds.view", "blinds.phase.change", "workflow.view", "workflow.approve", "workflow.phase.installation.submit", "workflow.phase.reinstatement.submit", "workflow.safety.hold", "qr.manage"], menuKeys: ["dashboard", "blinds"], phaseKeys: ["assembly", "blindInstallation", "blindRemovalReinstatement"] },
  { key: "qc", name: "QC Inspector", subtitle: "Quality verification and final tightening approval", members: 7, color: "#22c55e", permissionKeys: ["projects.view", "blinds.view", "blinds.phase.change", "workflow.view", "workflow.approve", "reports.view", "audit.view"], menuKeys: ["dashboard", "blinds", "reports", "audit"], phaseKeys: ["finalTight", "inspectionReady"] },
  { key: "safety", name: "Safety Officer", subtitle: "Safety oversight, restrictions, and compliance review", members: 5, color: "#ef4444", permissionKeys: ["workflow.record.evidence", "projects.view", "blinds.view", "workflow.view", "workflow.approve", "workflow.safety.hold", "workflow.safety.release", "reports.view", "audit.view"], menuKeys: ["dashboard", "blinds", "reports", "audit"], phaseKeys: ["broken", "inspectionReady", "operationsInitialIsolation", "internalInspection", "reinstatementPreparation"] },
  { key: "tiEngineer", name: "T&I Engineer", subtitle: "Torque gate owner and technical validation", members: 6, color: "#eab308", permissionKeys: ["projects.view", "blinds.view", "blinds.phase.change", "workflow.view", "workflow.approve", "reports.view"], menuKeys: ["dashboard", "blinds", "reports"], phaseKeys: ["tightTorque"] },
  { key: "inspection", name: "Inspection Team", subtitle: "Internal inspection, defects, punch items and closure readiness", members: 9, color: "#3b82f6", permissionKeys: ["workflow.record.inspection", "workflow.inspection.approve", "workflow.quality.defect.record", "workflow.quality.defect.review", "workflow.quality.punch.manage", "workflow.quality.punch.verify", "workflow.quality.ndt.record", "workflow.quality.ndt.review", "workflow.record.evidence", "projects.view", "blinds.view", "workflow.view", "workflow.phase.inspection.manage", "workflow.phase.final.approve", "workflow.safety.hold", "reports.view", "audit.view"], menuKeys: ["dashboard", "blinds", "reports", "audit"], phaseKeys: ["inspectionReady", "internalInspection", "finalApprovalReturnToService"] },
  { key: "metalForeman", name: "Metal Foreman", subtitle: "Conditional mechanical approval for slip blind and spade work", members: 3, color: "#94a3b8", permissionKeys: ["workflow.record.evidence", "projects.view", "blinds.view", "blinds.phase.change", "workflow.view", "workflow.approve", "workflow.phase.final.approve", "workflow.safety.hold"], menuKeys: ["dashboard", "blinds"], phaseKeys: ["assembly", "tightTorque", "blindInstallation", "blindRemovalReinstatement", "finalApprovalReturnToService"] },
];

const seedWorkflowTemplates: WorkflowTemplateInput[] = [
  {
    id: "wf-sbts-standard-v2",
    name: "SBTS Standard 8-Phase Isolation Lifecycle",
    description: "Canonical positive-isolation lifecycle covering Operations isolation, controlled bolting, independent verification, inspection, reinstatement, leak test and final return to service.",
    status: "Active",
    projectType: "Tank / Vessel / Drum Isolation",
    version: "2.0",
    phases: canonicalWorkflowPhases.map((phase, index) => ({
      id: `wf-v2-${index + 1}-${phase.key}`,
      label: phase.label,
      phaseKey: phase.key,
      roleKey: phase.ownerRoleKey,
      requiredPermissionKey: phase.requiredPermissionKey,
      gate: phase.gate,
      purpose: phase.purpose,
      actionKey: phase.actionKey,
      actionLabel: phase.actionLabel,
      checklist: [...phase.checklist],
      slaHours: phase.slaHours,
      evidence: [...phase.evidence],
      automation: `Record audit event and evaluate gate after ${phase.actionLabel}`,
      color: phase.color,
      isCritical: phase.critical,
    })),
  },
  {
    id: "wf-shutdown-standard",
    name: "Shutdown Blind Control",
    description: "Standard route for blind installation, torque gate, and final inspection sign-off.",
    status: "Active",
    projectType: "Shutdown / Turnaround",
    version: "1.4",
    phases: [
      { id: "wf-prepare", label: "Preparation & broken blind request", phaseKey: "broken", roleKey: "coordinator", requiredPermissionKey: "blinds.create", gate: "Area and equipment must be verified before field execution starts.", slaHours: 6, evidence: ["Line list", "Isolation reference"], automation: "Notify Technician team when approved", color: "#ef4444", isCritical: true },
      { id: "wf-assembly", label: "Assembly / installation execution", phaseKey: "assembly", roleKey: "technician", requiredPermissionKey: "workflow.approve", gate: "Technician confirms tag, size, blind type, and QR scan from site.", slaHours: 12, evidence: ["QR scan", "Field photo"], automation: "Escalate to Coordinator after SLA breach", color: "#f59e0b", isCritical: false },
      { id: "wf-torque", label: "Tight & Torque validation", phaseKey: "tightTorque", roleKey: "tiEngineer", requiredPermissionKey: "workflow.approve", gate: "Torque values and flange condition must be signed by T&I Engineering.", slaHours: 8, evidence: ["Torque sheet", "Tool calibration"], automation: "Unlock Final Tight only after approval", color: "#eab308", isCritical: true },
      { id: "wf-final", label: "Final Tight quality sign-off", phaseKey: "finalTight", roleKey: "qc", requiredPermissionKey: "workflow.approve", gate: "QC inspector verifies final tight and records acceptance.", slaHours: 8, evidence: ["QC checklist", "Inspector signature"], automation: "Create audit event and update dashboard", color: "#22c55e", isCritical: true },
      { id: "wf-inspection", label: "Inspection ready handover", phaseKey: "inspectionReady", roleKey: "inspection", requiredPermissionKey: "reports.view", gate: "Inspection team can view final status and release certificate package.", slaHours: 10, evidence: ["Final report", "Certificate reference"], automation: "Notify project stakeholders", color: "#3b82f6", isCritical: false },
    ],
  },
  {
    id: "wf-maintenance-lite",
    name: "Maintenance Quick Route",
    description: "Lean workflow for short maintenance scopes that still requires centralized permission ownership.",
    status: "Draft",
    projectType: "Maintenance",
    version: "0.8",
    phases: [
      { id: "wf-lite-request", label: "Request validation", phaseKey: "broken", roleKey: "coordinator", requiredPermissionKey: "projects.view", gate: "Coordinator validates scope and allowed area.", slaHours: 4, evidence: ["Scope note"], automation: "Open task list for Technician", color: "#ef4444", isCritical: false },
      { id: "wf-lite-execute", label: "Field execution", phaseKey: "assembly", roleKey: "technician", requiredPermissionKey: "blinds.phase.change", gate: "Technician updates blind state from mobile QR scan.", slaHours: 8, evidence: ["QR scan"], automation: "Notify QC when complete", color: "#f59e0b", isCritical: false },
      { id: "wf-lite-close", label: "QC closeout", phaseKey: "finalTight", roleKey: "qc", requiredPermissionKey: "workflow.approve", gate: "QC reviews closeout evidence and locks the record.", slaHours: 6, evidence: ["Closeout note"], automation: "Write audit log entry", color: "#22c55e", isCritical: true },
    ],
  },
];

// ─── Seed Functions ────────────────────────────────────────────────────────

export function serializePhaseAssignees(owners: { openId: string; name: string; email?: string | null; avatarUrl?: string | null }[]): string {
  return JSON.stringify(owners.map((owner) => ({
    openId: owner.openId.trim(),
    name: owner.name.trim(),
    email: owner.email?.trim() || null,
    avatarUrl: owner.avatarUrl?.trim() || null,
  })).filter((owner) => owner.openId && owner.name));
}

export async function seedAreasAndProjects(): Promise<void> {
  const db = await requireDb();
  const now = new Date();
  const existingAreas = await db.select({ id: areas.id }).from(areas).limit(1);
  if (existingAreas.length === 0) {
    await db.insert(areas).values(seedAreas.map((area) => ({ ...area, createdAt: now, updatedAt: now })));
  }

  const existingProjects = await db.select({ id: projects.id }).from(projects).limit(1);
  if (existingProjects.length === 0) {
    await db.insert(projects).values(seedProjects.map((project) => ({ ...project, createdAt: now, updatedAt: now })));
  }

  const existingBlinds = await db.select({ tag: blinds.tag }).from(blinds).limit(1);
  if (existingBlinds.length === 0) {
    await db.insert(blinds).values(seedBlinds.map((blind) => ({ ...blind, createdAt: now, updatedAt: now })));
  }
  const ownerRows: InsertProjectPhaseOwner[] = seedProjects.flatMap((project) =>
    defaultPhaseOwners.map((owner) => ({
      projectId: project.id,
      phase: owner.phase,
      ownerName: owner.ownerName ?? "Unassigned",
      ownerRole: owner.ownerRole ?? "unassigned",
      phaseColor: owner.phaseColor ?? defaultPhaseColors[owner.phase],
      ownersJson: serializePhaseAssignees(owner.owners ?? []),
      createdByOpenId: "system-seed",
      updatedByOpenId: "system-seed",
      createdAt: now,
      updatedAt: now,
    }))
  );
  await db.insert(projectPhaseOwners).values(ownerRows).onDuplicateKeyUpdate({
    set: { updatedByOpenId: "system-seed", updatedAt: now },
  });
  await db.insert(projectSettings).values(
    seedProjects.map((project) => ({
      projectId: project.id,
      slipBlindGateRequired: 1,
      updatedByOpenId: "system-seed",
      createdAt: now,
      updatedAt: now,
    }))
  ).onDuplicateKeyUpdate({ set: { updatedAt: now } });
}

export async function seedAccessControl(): Promise<void> {
  const db = await requireDb();
  const [existingPermissionRows, existingRoleRows, existingAssignments] = await Promise.all([
    db.select({ key: accessPermissions.key }).from(accessPermissions),
    db.select({ key: accessRoles.key }).from(accessRoles),
    db.select({ roleKey: accessRolePermissions.roleKey, permissionKey: accessRolePermissions.permissionKey }).from(accessRolePermissions),
  ]);
  const existingPermissionKeys = new Set(existingPermissionRows.map((row) => row.key));
  const existingRoleKeys = new Set(existingRoleRows.map((row) => row.key));
  const existingAssignmentKeys = new Set(existingAssignments.map((row) => `${row.roleKey}:${row.permissionKey}`));
  const now = new Date();
  const permissions = seedPermissionGroups.flatMap((group) => group.permissions);
  const missingPermissions = permissions.filter((permission) => !existingPermissionKeys.has(permission.key));
  const missingRoles = seedRoles.filter((role) => !existingRoleKeys.has(role.key));
  const missingAssignments = seedRoles.flatMap((role) =>
    role.permissionKeys
      .filter((permissionKey) => !existingAssignmentKeys.has(`${role.key}:${permissionKey}`))
      .map((permissionKey) => ({ roleKey: role.key, permissionKey, createdAt: now })),
  );

  if (missingPermissions.length === 0 && missingRoles.length === 0 && missingAssignments.length === 0) return;
  await db.transaction(async (tx) => {
    if (missingPermissions.length > 0) {
      await tx.insert(accessPermissions).values(
        missingPermissions.map((permission) => ({ ...permission, createdAt: now, updatedAt: now })),
      );
    }
    if (missingRoles.length > 0) {
      await tx.insert(accessRoles).values(
        missingRoles.map((role) => ({
          key: role.key,
          name: role.name,
          subtitle: role.subtitle,
          members: role.members,
          color: role.color,
          menuKeysJson: JSON.stringify(role.menuKeys),
          phaseKeysJson: JSON.stringify(role.phaseKeys),
          createdAt: now,
          updatedAt: now,
        })),
      );
    }
    if (missingAssignments.length > 0) {
      await tx.insert(accessRolePermissions).values(missingAssignments);
    }
  });
}

export async function seedWorkflows(): Promise<void> {
  await seedAccessControl();
  const db = await requireDb();
  const existing = await db.select({ id: workflowTemplates.id }).from(workflowTemplates);
  const existingIds = new Set(existing.map((row) => row.id));
  // Lazy import to avoid circular dependency with workflows.ts
  const { upsertWorkflow } = await import("./workflows");
  for (const workflow of seedWorkflowTemplates) {
    if (!existingIds.has(workflow.id)) await upsertWorkflow(workflow, "system-seed");
  }
}


/**
 * Install idempotent system-owned reference rows required by the application.
 * This intentionally excludes demo Areas, Projects, and Blinds.
 */
export async function seedSystemReferenceData(): Promise<void> {
  await seedWorkflows();
  const db = await requireDb();
  await db
    .insert(featureToggles)
    .values({ id: 1 })
    .onDuplicateKeyUpdate({ set: { id: 1 } });
}
