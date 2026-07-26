/*
Design Philosophy: Industrial Command Center Minimalism.
This file centralizes current frontend domain models and mock data so future API integration can replace one source of truth without scattering sample objects across pages.
*/
import { Activity, BarChart3, Bell, ClipboardCheck, FileText, FolderKanban, Gauge, GitBranch, Layers3, ListChecks, LockKeyhole, MapPinned, ShieldCheck, SlidersHorizontal, Users, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { WorkflowPhaseKey, WorkflowRoleKey } from "../../../shared/workflowSpecification";

export type PhaseKey = WorkflowPhaseKey;
export type RoleKey = WorkflowRoleKey;

export type Permission = {
  key: string;
  label: string;
  description: string;
  group: string;
};

export type RoleModel = {
  key: RoleKey;
  name: string;
  subtitle: string;
  members: number;
  color: string;
  permissionKeys: string[];
  menuKeys: string[];
  phaseKeys: PhaseKey[];
};

export const appMeta = {
  title: "SBTS Professional",
  subtitle: "Smart Blind Tracking System",
  site: "Shedgum Gas Plant",
  version: "React Frontend Alpha",
};

export const navItems: { key: string; label: string; path: string; icon: LucideIcon; description: string }[] = [
  { key: "dashboard", label: "Dashboard", path: "/dashboard", icon: Gauge, description: "Operational command overview" },
  { key: "areas", label: "Areas", path: "/areas", icon: MapPinned, description: "Area command map" },
  { key: "projects", label: "Projects", path: "/projects", icon: FolderKanban, description: "Linked project scopes" },
  { key: "isolation-packages", label: "Isolation Packages", path: "/isolation-packages", icon: Layers3, description: "Vessel package readiness and linked blinds" },
  { key: "blinds", label: "Blinds", path: "/blinds", icon: ListChecks, description: "Blind registry and phases" },
  { key: "workflow-studio", label: "Workflow Studio", path: "/workflow-studio", icon: GitBranch, description: "Workflow builder and gates" },
  { key: "access-control", label: "Access Control", path: "/access-control", icon: ShieldCheck, description: "Roles, permissions, workflow" },
  { key: "users", label: "User Management", path: "/users", icon: Users, description: "Manage users, assign roles" },
  { key: "settings", label: "System Settings", path: "/settings", icon: SlidersHorizontal, description: "General, tag defaults & certificates" },
  { key: "notifications", label: "Notifications", path: "/notifications", icon: Bell, description: "In-app alerts and updates" },
  { key: "reports", label: "Reports", path: "/reports", icon: BarChart3, description: "Operational reports and exports" },
];

export const secondaryNavItems: { key: string; label: string; path: string; icon: LucideIcon; description: string }[] = [
  { key: "audit", label: "Audit Logs", path: "/audit-logs", icon: Activity, description: "System-wide audit trail" },
];

export const phases: { key: PhaseKey; label: string; color: string; count: number; owner: string }[] = [
  { key: "broken", label: "Broken / Preparation", color: "#ef4444", count: 16, owner: "Coordinator" },
  { key: "assembly", label: "Assembly", color: "#f59e0b", count: 22, owner: "Technician" },
  { key: "tightTorque", label: "Tight & Torque", color: "#eab308", count: 18, owner: "T&I Engineer" },
  { key: "finalTight", label: "Final Tight", color: "#22c55e", count: 31, owner: "QC Inspector" },
  { key: "inspectionReady", label: "Inspection Ready", color: "#3b82f6", count: 12, owner: "Inspection" },
];

export type WorkflowStatus = "Draft" | "Active" | "Locked";

export type WorkflowPhaseTemplate = {
  id: string;
  label: string;
  phaseKey: PhaseKey;
  roleKey: RoleKey;
  requiredPermissionKey: string;
  gate: string;
  slaHours: number;
  evidence: string[];
  automation: string;
  color: string;
  isCritical: boolean;
};

export type WorkflowTemplate = {
  id: string;
  name: string;
  description: string;
  status: WorkflowStatus;
  projectType: string;
  version: string;
  phases: WorkflowPhaseTemplate[];
};

export const workflowTemplates: WorkflowTemplate[] = [
  {
    id: "wf-shutdown-standard",
    name: "Shutdown Blind Control",
    description: "Standard route for blind installation, torque gate, and final inspection sign-off.",
    status: "Active",
    projectType: "Shutdown / Turnaround",
    version: "1.4",
    phases: [
      { id: "wf-prepare", label: "Preparation & broken blind request", phaseKey: "broken", roleKey: "coordinator", requiredPermissionKey: "blinds.create", gate: "Area and line number must be verified before field execution starts.", slaHours: 6, evidence: ["Line list", "Isolation reference"], automation: "Notify Technician team when approved", color: "#ef4444", isCritical: true },
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

export const permissionGroups: { group: string; icon: LucideIcon; permissions: Permission[] }[] = [
  {
    group: "Projects & Areas",
    icon: FolderKanban,
    permissions: [
      { key: "projects.view", label: "View projects", description: "Read project and area lists", group: "Projects & Areas" },
      { key: "projects.create", label: "Create project", description: "Open new project records", group: "Projects & Areas" },
      { key: "projects.edit", label: "Edit project", description: "Update project details and areas", group: "Projects & Areas" },
      { key: "projects.delete", label: "Delete project", description: "Archive or remove project data", group: "Projects & Areas" },
    ],
  },
  {
    group: "Blind Registry",
    icon: ClipboardCheck,
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
    icon: Wrench,
    permissions: [
      { key: "workflow.view", label: "View workflow", description: "Read workflow ownership rules", group: "Workflow & Sign-off" },
      { key: "workflow.configure", label: "Configure workflow", description: "Change owners, gates, and sign-off rules", group: "Workflow & Sign-off" },
      { key: "workflow.approve", label: "Approve task", description: "Apply approval on assigned phases", group: "Workflow & Sign-off" },
      { key: "workflow.override", label: "Emergency override", description: "Use controlled admin override", group: "Workflow & Sign-off" },
    ],
  },
  {
    group: "Users, Roles & Audit",
    icon: LockKeyhole,
    permissions: [
      { key: "users.view", label: "View users", description: "Read users and specialties", group: "Users, Roles & Audit" },
      { key: "users.manage", label: "Manage users", description: "Create, approve, suspend users", group: "Users, Roles & Audit" },
      { key: "roles.manage", label: "Manage roles", description: "Edit role templates and permissions", group: "Users, Roles & Audit" },
      { key: "audit.view", label: "View audit logs", description: "Read system activity trail", group: "Users, Roles & Audit" },
    ],
  },
  {
    group: "Reports & Certificates",
    icon: FileText,
    permissions: [
      { key: "reports.view", label: "View reports", description: "Open dashboard and report cards", group: "Reports & Certificates" },
      { key: "reports.export", label: "Export reports", description: "Download CSV/PDF summaries", group: "Reports & Certificates" },
      { key: "certificates.manage", label: "Manage certificates", description: "Configure certificate templates", group: "Reports & Certificates" },
      { key: "qr.manage", label: "Manage QR tags", description: "Generate or reissue QR links", group: "Reports & Certificates" },
    ],
  },
];

const allPermissionKeys = permissionGroups.flatMap((group) => group.permissions.map((permission) => permission.key));

export const initialRoles: RoleModel[] = [
  {
    key: "admin",
    name: "Administrator",
    subtitle: "Full platform owner and emergency override",
    members: 2,
    color: "#38bdf8",
    permissionKeys: allPermissionKeys,
    menuKeys: ["dashboard", "projects", "blinds", "access-control", "reports", "audit", "settings"],
    phaseKeys: phases.map((phase) => phase.key),
  },
  {
    key: "coordinator",
    name: "Coordinator",
    subtitle: "Project setup, area control, assignment follow-up",
    members: 4,
    color: "#60a5fa",
    permissionKeys: ["projects.view", "projects.create", "projects.edit", "blinds.view", "blinds.create", "blinds.edit", "workflow.view", "reports.view", "users.view"],
    menuKeys: ["dashboard", "projects", "blinds", "reports"],
    phaseKeys: ["broken"],
  },
  {
    key: "technician",
    name: "Technician",
    subtitle: "Field execution and blind status updates",
    members: 18,
    color: "#f59e0b",
    permissionKeys: ["projects.view", "blinds.view", "blinds.phase.change", "workflow.view", "workflow.approve", "qr.manage"],
    menuKeys: ["dashboard", "blinds"],
    phaseKeys: ["assembly"],
  },
  {
    key: "qc",
    name: "QC Inspector",
    subtitle: "Quality verification and final tightening approval",
    members: 7,
    color: "#22c55e",
    permissionKeys: ["projects.view", "blinds.view", "blinds.phase.change", "workflow.view", "workflow.approve", "reports.view", "audit.view"],
    menuKeys: ["dashboard", "blinds", "reports", "audit"],
    phaseKeys: ["finalTight", "inspectionReady"],
  },
  {
    key: "safety",
    name: "Safety Officer",
    subtitle: "Safety oversight, restrictions, and compliance review",
    members: 5,
    color: "#ef4444",
    permissionKeys: ["projects.view", "blinds.view", "workflow.view", "workflow.approve", "reports.view", "audit.view"],
    menuKeys: ["dashboard", "blinds", "reports", "audit"],
    phaseKeys: ["broken", "inspectionReady"],
  },
  {
    key: "tiEngineer",
    name: "T&I Engineer",
    subtitle: "Torque gate owner and technical validation",
    members: 6,
    color: "#eab308",
    permissionKeys: ["projects.view", "blinds.view", "blinds.phase.change", "workflow.view", "workflow.approve", "reports.view"],
    menuKeys: ["dashboard", "blinds", "reports"],
    phaseKeys: ["tightTorque"],
  },
  {
    key: "inspection",
    name: "Inspection Team",
    subtitle: "Final inspection readiness and certificate package review",
    members: 9,
    color: "#3b82f6",
    permissionKeys: ["projects.view", "blinds.view", "workflow.view", "reports.view", "audit.view"],
    menuKeys: ["dashboard", "blinds", "reports", "audit"],
    phaseKeys: ["inspectionReady"],
  },
];

export const projects = [
  { id: "PRJ-1027", name: "Shedgum Train-4 Shutdown", area: "SGP-04", blinds: 42, progress: 74, status: "Active" },
  { id: "PRJ-1033", name: "North Manifold Isolation", area: "NMG-02", blinds: 31, progress: 58, status: "Active" },
  { id: "PRJ-1041", name: "Utility Header Maintenance", area: "UHM-01", blinds: 26, progress: 91, status: "Final Review" },
];

export const blindRows = [
  { tag: "SB-4219", project: "Shedgum Train-4 Shutdown", area: "SGP-04", type: "Slip Blind", size: "12 in", phase: "Final Tight", owner: "QC Inspector", priority: "High" },
  { tag: "SB-4244", project: "North Manifold Isolation", area: "NMG-02", type: "Spectacle Blind", size: "8 in", phase: "Assembly", owner: "Technician", priority: "Normal" },
  { tag: "SB-4302", project: "Utility Header Maintenance", area: "UHM-01", type: "Slip Blind", size: "16 in", phase: "Inspection Ready", owner: "Inspection", priority: "High" },
  { tag: "SB-4338", project: "Shedgum Train-4 Shutdown", area: "SGP-04", type: "Spacer", size: "6 in", phase: "Tight & Torque", owner: "T&I Engineer", priority: "Normal" },
];

export const recentEvents = [
  { title: "Role template consolidated", detail: "Workflow permissions moved into Access Control", time: "09:42", type: "SYSTEM" },
  { title: "SB-4219 phase changed", detail: "Final Tight approved by QC Inspector", time: "08:57", type: "BLIND" },
  { title: "New technician pending", detail: "User request routed to Administrator", time: "08:21", type: "USER" },
];

export const menuCatalog = [...navItems, ...secondaryNavItems].map((item) => ({ key: item.key, label: item.label, icon: item.icon }));
