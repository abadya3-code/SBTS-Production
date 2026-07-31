import {
  Activity,
  BarChart3,
  Bell,
  FolderKanban,
  Gauge,
  GitBranch,
  Layers3,
  ListChecks,
  MapPinned,
  ShieldCheck,
  SlidersHorizontal,
  Users,
} from "lucide-react";
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

export type PermissionGroupModel = {
  group: string;
  permissions: Permission[];
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

export type WorkflowStatus = "Draft" | "Active" | "Locked";

export type WorkflowPhaseTemplate = {
  id: string;
  label: string;
  phaseKey: PhaseKey;
  roleKey: RoleKey;
  requiredPermissionKey: string;
  gate: string;
  purpose?: string;
  actionKey?: string;
  actionLabel?: string;
  checklist?: string[];
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

export const appMeta = {
  title: "SBTS Professional",
  subtitle: "Smart Blind Tracking System",
  site: "Shedgum Gas Plant",
  version: "Professional Edition",
};

export const navItems: { key: string; label: string; path: string; icon: LucideIcon; description: string }[] = [
  { key: "dashboard", label: "Dashboard", path: "/dashboard", icon: Gauge, description: "Operational command overview" },
  { key: "areas", label: "Areas", path: "/areas", icon: MapPinned, description: "Area command map" },
  { key: "projects", label: "Projects", path: "/projects", icon: FolderKanban, description: "Linked project scopes" },
  { key: "isolation-packages", label: "Isolation Packages", path: "/isolation-packages", icon: Layers3, description: "Vessel package readiness and linked blinds" },
  { key: "blinds", label: "Blinds", path: "/blinds", icon: ListChecks, description: "Blind registry and phases" },
  { key: "workflow-studio", label: "Workflow Studio", path: "/workflow-studio", icon: GitBranch, description: "Workflow builder and gates" },
  { key: "access-control", label: "Access Control", path: "/access-control", icon: ShieldCheck, description: "Roles, permissions, workflow" },
  { key: "users", label: "User Management", path: "/users", icon: Users, description: "Manage users and assign roles" },
  { key: "settings", label: "System Settings", path: "/settings", icon: SlidersHorizontal, description: "General, tag defaults, and certificates" },
  { key: "notifications", label: "Notifications", path: "/notifications", icon: Bell, description: "In-app alerts and updates" },
  { key: "reports", label: "Reports", path: "/reports", icon: BarChart3, description: "Operational reports and exports" },
];

export const secondaryNavItems: { key: string; label: string; path: string; icon: LucideIcon; description: string }[] = [
  { key: "audit", label: "Audit Logs", path: "/audit-logs", icon: Activity, description: "System-wide audit trail" },
];

export const menuCatalog = [...navItems, ...secondaryNavItems].map((item) => ({
  key: item.key,
  label: item.label,
  icon: item.icon,
}));
