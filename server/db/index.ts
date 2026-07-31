/**
 * server/db/index.ts
 * ──────────────────
 * Unified re-export barrel for all database helpers.
 *
 * Import from here in routers and other server code:
 *   import { getProjectDetail, getAllUsers } from "./db";
 *
 * Module map:
 *   core.ts      → getDb, requireDb, upsertUser, getUserByOpenId
 *   types.ts     → all TypeScript types and interfaces
 *   seed.ts      → seed data constants and seed functions
 *   blinds.ts    → blind CRUD, phase approvals, workflow logs
 *   projects.ts  → areas, projects, project settings
 *   workflows.ts → workflow template CRUD
 *   settings.ts  → system/tag/certificate settings
 *   users.ts     → user management, roles, registration/approval
 */

// Core connection
export { getDb, getUserByOpenId, requireDb, upsertUser } from "./core";

// Types
export type {
  AccessControlModel,
  ActingProjectUser,
  AreaInput,
  AreaModel,
  AssignableProjectUser,
  BlindDetailModel,
  BlindInput,
  BlindModel,
  BlindPhase,
  BlindPhaseApprovalInput,
  BlindPhaseApprovalModel,
  BlindPhaseDetailModel,
  BlindPriority,
  BlindType,
  BlindUpdateInput,
  BlindWorkflowLogModel,
  PermissionGroupModel,
  PermissionModel,
  PhaseColorConfig,
  PhaseKey,
  ProjectDetailModel,
  ProjectInput,
  ProjectModel,
  ProjectPhaseAssigneeInput,
  ProjectPhaseOwnerInput,
  ProjectPhaseOwnerModel,
  ProjectSettingsModel,
  ProjectStatus,
  RoleKey,
  RoleModel,
  UserWithRoles,
  WorkflowPhaseInput,
  WorkflowStatus,
  WorkflowTemplateInput,
} from "./types";

// Seed data and seed functions
export {
  blindPhaseOrder,
  blindPriorityOrder,
  defaultPhaseColors,
  defaultPhaseOwners,
  sanitizePhaseColor,
  seedAccessControl,
  seedAreasAndProjects,
  seedWorkflows,
  seedSystemReferenceData,
  serializePhaseAssignees,
} from "./seed";

// Blinds
export {
  addBlindToProject,
  bulkAddBlindsToProject,
  canActingUserEditAssignedPhase,
  getBlindDetail,
  normalizeBlindRows,
  setBlindPhaseApproval,
  updateBlindInProject,
} from "./blinds";

// Projects
export {
  canUserEditProjectPhase,
  createArea,
  createProject,
  getAllProjects,
  getAreaById,
  getAreas,
  getAssignableProjectUsers,
  getProjectDetail,
  getProjectSettings,
  getProjectsByArea,
  normalizeProjectRows,
  normalizeProjectSettingsRows,
  updateProjectSettings,
} from "./projects";

// Workflows
export {
  deleteWorkflow,
  getAllWorkflows,
  getWorkflowById,
  upsertWorkflow,
} from "./workflows";

// Settings
export {
  getCertificateSettings,
  getDefaultTagSettings,
  getSystemSettings,
  upsertCertificateSettings,
  upsertDefaultTagSettings,
  upsertSystemSettings,
  getSecuritySettings,
  upsertSecuritySettings,
  getNotificationPreferences,
  upsertNotificationPreferences,
  getWorkflowPolicySettings,
  upsertWorkflowPolicySettings,
} from "./settings";

// Users & Access Control
export {
  approveUserRegistration,
  assignRolesToUser,
  completeUserRegistration,
  createAccessRole,
  deleteAccessRole,
  getAllUsers,
  getAccessControlModel,
  getPendingUsers,
  rejectUserRegistration,
  syncRoleMemberCounts,
  updateAccessControlModel,
  updateUserSystemRole,
} from "./users";

// Auth (standalone email/password)
export {
  clearFailedLogin,
  createUserWithPassword,
  getUserByEmail,
  hashPassword,
  recordFailedLogin,
  updateUserPassword,
  verifyPassword,
} from "./auth";

// Reports
export {
  getDashboardSnapshot,
  getReportAreaSummaries,
  getReportBlinds,
  getReportGlobalStats,
  getReportProjectSummaries,
} from "./reports";
export type { ReportAreaSummary, ReportBlindRow, ReportFilters, ReportProjectSummary } from "./reports";

// Profile
export {
  getUserProfile,
  updateUserAvatar,
  updateUserProfile,
} from "./profile";
export type { UpdateProfileInput, UserProfile } from "./profile";

// Notifications
export {
  broadcastNotification,
  countUnreadNotifications,
  createNotification,
  deleteNotificationById,
  deleteOldNotifications,
  getNotificationsForUser,
  markAllNotificationsRead,
  markNotificationRead,
} from "./notifications";
export type { CreateNotificationInput, NotificationType } from "./notifications";

// Slip Blinds
export {
  createSlipBlindSurvey,
  getSlipBlindSurveyDetail,
  getSlipBlindSurveys,
  getSlipBlindsList,
  getSlipBlindsStats,
} from "./slipBlinds";
export type { SlipBlindRow, SlipBlindStatus, SlipBlindsStats, SurveyRow } from "./slipBlinds";

// Feature Toggles
export {
  getFeatureToggles,
  updateFeatureToggles,
} from "./featureToggles";

// Sprint 2 canonical workflow runtime
export {
  ensureBlindWorkflowRuntime,
  evaluateWorkflowGate,
  getBlindWorkflowRuntimeView,
  placeWorkflowSafetyHold,
  recordWorkflowApproval,
  releaseWorkflowSafetyHold,
  transitionBlindWorkflow,
  updateWorkflowChecklistItem,
} from "./workflowRuntime";
export {
  createGasTestRecord,
  createIsolationPackage,
  createWorkflowEvidenceRecord,
  deleteWorkflowEvidenceRecord,
  getIsolationPackageDetail,
  getIsolationPackages,
  createOrUpdateLeakTestRecord,
  createOrUpdateLotoRecord,
  createOrUpdatePermitRecord,
  createOrUpdateTorqueRecord,
  upsertEntryReadinessRecord,
} from "./workflowRecords";

export * from "./inspectionActivities";

// Sprint 4 certificate and quality governance
export {
  getQualityRecords,
  upsertDefectNotification,
  upsertPunchItem,
  upsertNdtRecord,
  getQualityGateReadiness,
} from "./qualityGovernance";
export {
  getCertificateReadiness,
  listBlindCertificates,
  issueCertificate,
  revokeCertificate,
  getPublicCertificateVerification,
} from "./certificateGovernance";
