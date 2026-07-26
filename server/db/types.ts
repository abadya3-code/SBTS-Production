/**
 * server/db/types.ts
 * ──────────────────
 * All shared TypeScript types and interfaces used across the db/* modules
 * and exposed to server/routers.ts.
 */

// ─── Primitive Enums ───────────────────────────────────────────────────────

import type { WorkflowPhaseKey, WorkflowRoleKey } from "../../shared/workflowSpecification";

export type PhaseKey = WorkflowPhaseKey;
export type RoleKey = WorkflowRoleKey;
export type WorkflowStatus = "Draft" | "Active" | "Locked";

// ─── Access Control ────────────────────────────────────────────────────────

export type PermissionModel = {
  key: string;
  label: string;
  description: string;
  group: string;
};

export type PermissionGroupModel = {
  group: string;
  permissions: PermissionModel[];
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

export type AccessControlModel = {
  permissionGroups: PermissionGroupModel[];
  roles: RoleModel[];
};

// ─── Workflow ──────────────────────────────────────────────────────────────

export type WorkflowPhaseInput = {
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

export type WorkflowTemplateInput = {
  id: string;
  name: string;
  description: string;
  status: WorkflowStatus;
  projectType: string;
  version: string;
  phases: WorkflowPhaseInput[];
};

// ─── Areas & Projects ─────────────────────────────────────────────────────

export type ProjectStatus = "Active" | "Completed" | "On Hold" | "Planning" | "Final Review";

export type AreaInput = {
  name: string;
  code: string;
  description?: string | null;
  location?: string | null;
  isActive?: boolean;
};

export type AreaModel = {
  id: number;
  name: string;
  code: string;
  description: string | null;
  location: string | null;
  isActive: boolean;
  projectCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export type ProjectInput = {
  id: string;
  name: string;
  areaId: number;
  status: ProjectStatus;
  blindsCount?: number;
  progress?: number;
  description?: string | null;
};

export type ProjectModel = {
  id: string;
  name: string;
  areaId: number;
  areaCode: string;
  areaName: string;
  status: ProjectStatus;
  blindsCount: number;
  progress: number;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
};

// ─── Blinds ───────────────────────────────────────────────────────────────

export type BlindPhase = "Broken / Preparation" | "Assembly" | "Tight & Torque" | "Final Tight" | "Inspection Ready";
export type BlindPriority = "Low" | "Normal" | "High" | "Critical";
export type BlindType = "Slip Blind" | "Drop Spool" | "Isolation";

export type BlindModel = {
  tag: string;
  projectId: string;
  type: BlindType | string;
  size: string;
  rate: string | null;
  phase: BlindPhase;
  owner: string;
  priority: BlindPriority;
  equipment: string | null;
  location: string | null;
  isolationPoint: string | null;
  slipMetalForemanApproved: boolean;
  slipBlindMerged: boolean;
  notes: string | null;
  // Industrial Specifications
  material: string | null;
  flangeType: string | null;
  gasketType: string | null;
  boltSize: string | null;
  torqueValue: string | null;
  thickness: string | null;
  tempRating: string | null;
  pidRef: string | null;
  isoDrawing: string | null;
  lineNumber: string | null;
  installDate: Date | null;
  expiryDate: Date | null;
  workflowPhaseKey?: import("../../shared/workflowSpecification").CanonicalPhaseKey | null;
  workflowPhaseLabel?: string | null;
  workflowLifecycleStatus?: import("../../shared/workflowSpecification").WorkflowLifecycleState | null;
  workflowRecordVersion?: number | null;
  workflowLocked?: boolean;
  updatedAt: Date;
};

export type BlindInput = {
  projectId: string;
  tag: string;
  type: BlindType | string;
  size: string;
  rate?: string | null;
  phase?: BlindPhase;
  owner?: string | null;
  priority: BlindPriority;
  equipment?: string | null;
  location?: string | null;
  isolationPoint?: string | null;
  slipMetalForemanApproved?: boolean;
  slipBlindMerged?: boolean;
  notes?: string | null;
};

export type BlindUpdateInput = Partial<Omit<BlindInput, "projectId" | "tag">> & {
  tag: string;
  projectId: string;
};

// ─── Project Phase Owners ─────────────────────────────────────────────────

export type ProjectPhaseAssigneeInput = {
  openId: string;
  name: string;
  email?: string | null;
  avatarUrl?: string | null;
};

export type ProjectPhaseOwnerInput = {
  phase: BlindPhase;
  owners: ProjectPhaseAssigneeInput[];
  ownerName?: string;
  ownerRole?: string;
  phaseColor?: string;
};

export type PhaseColorConfig = {
  phase: BlindPhase;
  color: string;
};

export type ProjectPhaseOwnerModel = {
  projectId: string;
  phase: BlindPhase;
  owners: ProjectPhaseAssigneeInput[];
  ownerName: string;
  ownerRole: string;
  phaseColor: string;
  updatedAt: Date | null;
};

export type AssignableProjectUser = ProjectPhaseAssigneeInput & {
  role: "user" | "admin";
};

export type ProjectSettingsModel = {
  projectId: string;
  slipBlindGateRequired: boolean;
  phaseOwners: ProjectPhaseOwnerModel[];
};

// ─── Blind Workflow & Approvals ───────────────────────────────────────────

export type BlindWorkflowLogModel = {
  id: number | string;
  blindTag: string;
  projectId: string;
  phase: BlindPhase;
  action: string;
  message: string;
  actorName: string | null;
  createdAt: Date;
};

export type BlindPhaseApprovalModel = {
  id: number | string;
  blindTag: string;
  projectId: string;
  phase: BlindPhase;
  approved: boolean;
  approvedByName: string | null;
  approvedAt: Date | null;
  revokedAt: Date | null;
  note: string | null;
};

export type BlindPhaseDetailModel = {
  phase: BlindPhase;
  color: string;
  count: number;
  status: "completed" | "current" | "waiting";
  owners: ProjectPhaseAssigneeInput[];
  approval: BlindPhaseApprovalModel;
  canApprove: boolean;
};

export type BlindDetailModel = {
  project: ProjectModel;
  blind: BlindModel;
  settings: ProjectSettingsModel;
  phaseTimeline: BlindPhaseDetailModel[];
  logs: BlindWorkflowLogModel[];
};

export type ActingProjectUser = {
  openId: string;
  name: string | null;
  email: string | null;
  role: "user" | "admin";
};

export type BlindPhaseApprovalInput = {
  projectId: string;
  tag: string;
  phase: BlindPhase;
  approved: boolean;
  note?: string | null;
};

export type ProjectDetailModel = {
  project: ProjectModel;
  blinds: BlindModel[];
  settings: ProjectSettingsModel;
  metrics: {
    registeredBlinds: number;
    plannedBlinds: number;
    highPriorityBlinds: number;
    criticalBlinds: number;
    inspectionReadyBlinds: number;
    phaseCounts: Record<BlindPhase, number>;
    priorityCounts: Record<BlindPriority, number>;
    nextAction: string;
  };
};

// ─── Users ────────────────────────────────────────────────────────────────

export interface UserWithRoles {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  role: "user" | "admin";
  userStatus: "pending" | "active" | "rejected";
  department: string | null;
  specialty: string | null;
  employeeNumber: string | null;
  registrationNote: string | null;
  approvedByOpenId: string | null;
  approvedAt: Date | null;
  createdAt: Date;
  lastSignedIn: Date;
  assignedRoles: string[];
}
