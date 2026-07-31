import { date, decimal, int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match application fields; legacy storage names are retained when needed to preserve data.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }).unique(),
  avatarUrl: text("avatarUrl"),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  /** Registration status: pending = awaiting admin approval, active = approved, rejected = denied */
  userStatus: mysqlEnum("userStatus", ["pending", "active", "rejected"]).default("active").notNull(),
  /** Additional registration fields collected after OAuth */
  department: varchar("department", { length: 160 }),
  specialty: varchar("specialty", { length: 160 }),
  employeeNumber: varchar("employeeNumber", { length: 64 }),
  registrationNote: text("registrationNote"),
  approvedByOpenId: varchar("approvedByOpenId", { length: 64 }),
  approvedAt: timestamp("approvedAt"),
  /** Hashed password for standalone auth (bcrypt). Null for OAuth-only users. */
  passwordHash: text("passwordHash"),
  failedLoginAttempts: int("failedLoginAttempts").default(0).notNull(),
  lockedUntil: timestamp("lockedUntil"),
  passwordChangedAt: timestamp("passwordChangedAt"),
  /** Profile fields */
  bio: text("bio"),
  phone: varchar("phone", { length: 40 }),
  userLocation: varchar("userLocation", { length: 200 }),
  linkedIn: varchar("linkedIn", { length: 255 }),
  preferredTheme: varchar("preferredTheme", { length: 20 }).default("standard"),
  avatarKey: text("avatarKey"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const workflowStatusEnum = mysqlEnum("status", ["Draft", "Active", "Locked"]);
export const workflowPhaseKeyEnum = mysqlEnum("phaseKey", [
  // Legacy phase keys retained during the controlled migration window.
  "broken", "assembly", "tightTorque", "finalTight", "inspectionReady",
  // Canonical Sprint 1 workflow keys.
  "operationsInitialIsolation", "blindInstallation", "mechanicalVerification", "internalInspection",
  "reinstatementPreparation", "blindRemovalReinstatement", "reinstatementVerification",
  "finalApprovalReturnToService",
]);
export const projectStatusEnum = mysqlEnum("projectStatus", ["Active", "Completed", "On Hold", "Planning", "Final Review"]);
export const blindPhaseEnum = mysqlEnum("blindPhase", ["Broken / Preparation", "Assembly", "Tight & Torque", "Final Tight", "Inspection Ready"]);
export const blindPriorityEnum = mysqlEnum("blindPriority", ["Low", "Normal", "High", "Critical"]);

/**
 * Physical plant areas. Areas are first-class operational containers so projects can be browsed
 * contextually rather than as isolated cards with a repeated area string.
 */
export const areas = mysqlTable("areas", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  code: varchar("code", { length: 40 }).notNull().unique(),
  description: text("description"),
  location: varchar("location", { length: 200 }),
  isActive: int("isActive").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/**
 * Project records linked to one area. Progress and blind counts are kept on the project row for
 * fast command-center summaries until the blind registry becomes the authoritative aggregation source.
 */
export const projects = mysqlTable("projects", {
  id: varchar("id", { length: 40 }).primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  areaId: int("areaId")
    .notNull()
    .references(() => areas.id),
  status: projectStatusEnum.default("Planning").notNull(),
  blindsCount: int("blindsCount").default(0).notNull(),
  progress: int("progress").default(0).notNull(),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/**
 * Detailed blind registry rows. Each blind belongs to exactly one project, allowing the project
 * detail view to act as an operational drill-down without duplicating registry information.
 */
export const blinds = mysqlTable("blinds", {
  tag: varchar("tag", { length: 40 }).primaryKey(),
  projectId: varchar("projectId", { length: 40 })
    .notNull()
    .references(() => projects.id),
  type: varchar("type", { length: 120 }).notNull(),
  size: varchar("size", { length: 60 }).notNull(),
  rate: varchar("rate", { length: 60 }),
  phase: blindPhaseEnum.default("Broken / Preparation").notNull(),
  owner: varchar("owner", { length: 160 }).notNull(),
  priority: blindPriorityEnum.default("Normal").notNull(),
  equipment: varchar("lineNumber", { length: 120 }),
  location: varchar("location", { length: 220 }),
  isolationPoint: varchar("isolationPoint", { length: 220 }),
  slipMetalForemanApproved: int("slipMetalForemanApproved").default(0).notNull(),
  slipBlindMerged: int("slipBlindMerged").default(0).notNull(),
  notes: text("notes"),
  // Industrial Specifications (added for Blind Detail Hub)
  material: varchar("material", { length: 80 }),
  flangeType: varchar("flangeType", { length: 80 }),
  gasketType: varchar("gasketType", { length: 80 }),
  boltSize: varchar("boltSize", { length: 40 }),
  torqueValue: varchar("torqueValue", { length: 40 }),
  thickness: varchar("thickness", { length: 40 }),
  tempRating: varchar("tempRating", { length: 40 }),
  pidRef: varchar("pidRef", { length: 80 }),
  isoDrawing: varchar("isoDrawing", { length: 80 }),
  lineNumber: varchar("lineNumber2", { length: 120 }),
  installDate: timestamp("installDate"),
  expiryDate: timestamp("expiryDate"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/**
 * Project-specific phase owners. These settings make each project able to assign one named owner
 * per blind phase while preserving the central workflow vocabulary used by the registry.
 */
export const projectPhaseOwners = mysqlTable("project_phase_owners", {
  id: int("id").autoincrement().primaryKey(),
  projectId: varchar("projectId", { length: 40 })
    .notNull()
    .references(() => projects.id),
  phase: blindPhaseEnum.notNull(),
  ownerName: varchar("ownerName", { length: 160 }).notNull(),
  ownerRole: varchar("ownerRole", { length: 120 }).notNull(),
  phaseColor: varchar("phaseColor", { length: 24 }).default("#f59e0b").notNull(),
  ownersJson: text("ownersJson"),
  createdByOpenId: varchar("createdByOpenId", { length: 64 }),
  updatedByOpenId: varchar("updatedByOpenId", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  projectPhaseUnique: uniqueIndex("project_phase_owner_unique").on(table.projectId, table.phase),
}));

/**
 * Project-level operational settings. Phase assignees stay in project_phase_owners;
 * policy switches that apply to the project as a whole live here.
 */
export const projectSettings = mysqlTable("project_settings", {
  projectId: varchar("projectId", { length: 40 })
    .primaryKey()
    .references(() => projects.id),
  slipBlindGateRequired: int("slipBlindGateRequired").default(1).notNull(),
  updatedByOpenId: varchar("updatedByOpenId", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/**
 * Blind-level workflow log for the detail page. It records future operational actions;
 * existing rows can still render a synthesized baseline log if no audit rows exist.
 */
export const blindWorkflowLogs = mysqlTable("blind_workflow_logs", {
  id: int("id").autoincrement().primaryKey(),
  blindTag: varchar("blindTag", { length: 40 })
    .notNull()
    .references(() => blinds.tag),
  projectId: varchar("projectId", { length: 40 })
    .notNull()
    .references(() => projects.id),
  phase: blindPhaseEnum.notNull(),
  action: varchar("action", { length: 120 }).notNull(),
  message: text("message").notNull(),
  actorOpenId: varchar("actorOpenId", { length: 64 }),
  actorName: varchar("actorName", { length: 160 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/**
 * Electronic phase approvals for each blind. One row per blind and phase keeps sign-off
 * state traceable while the workflow log records every approval or revocation event.
 */
export const blindPhaseApprovals = mysqlTable("blind_phase_approvals", {
  id: int("id").autoincrement().primaryKey(),
  blindTag: varchar("blindTag", { length: 40 })
    .notNull()
    .references(() => blinds.tag),
  projectId: varchar("projectId", { length: 40 })
    .notNull()
    .references(() => projects.id),
  phase: blindPhaseEnum.notNull(),
  approved: int("approved").default(1).notNull(),
  approvedByOpenId: varchar("approvedByOpenId", { length: 64 }),
  approvedByName: varchar("approvedByName", { length: 160 }),
  note: text("note"),
  approvedAt: timestamp("approvedAt"),
  revokedAt: timestamp("revokedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  blindPhaseApprovalUnique: uniqueIndex("blind_phase_approval_unique").on(table.blindTag, table.phase),
}));

/**
 * Central permission catalog used by Access Control and Workflow Studio.
 */
export const accessPermissions = mysqlTable("access_permissions", {
  key: varchar("key", { length: 120 }).primaryKey(),
  label: varchar("label", { length: 180 }).notNull(),
  description: text("description").notNull(),
  group: varchar("group", { length: 120 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/**
 * Central role catalog. JSON fields keep UI menu and workflow phase ownership explicit.
 */
export const accessRoles = mysqlTable("access_roles", {
  key: varchar("key", { length: 80 }).primaryKey(),
  name: varchar("name", { length: 140 }).notNull(),
  subtitle: text("subtitle").notNull(),
  members: int("members").default(0).notNull(),
  color: varchar("color", { length: 24 }).notNull(),
  menuKeysJson: text("menuKeysJson").notNull(),
  phaseKeysJson: text("phaseKeysJson").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/**
 * Many-to-many role permission assignments.
 */
export const accessRolePermissions = mysqlTable("access_role_permissions", {
  id: int("id").autoincrement().primaryKey(),
  roleKey: varchar("roleKey", { length: 80 })
    .notNull()
    .references(() => accessRoles.key),
  permissionKey: varchar("permissionKey", { length: 120 })
    .notNull()
    .references(() => accessPermissions.key),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/**
 * Workflow template header. A template represents one reusable operational route.
 * Role and permission enforcement is held at phase level so every task owner remains traceable.
 */
export const workflowTemplates = mysqlTable("workflow_templates", {
  id: varchar("id", { length: 96 }).primaryKey(),
  name: varchar("name", { length: 180 }).notNull(),
  description: text("description").notNull(),
  status: workflowStatusEnum.default("Draft").notNull(),
  projectType: varchar("projectType", { length: 120 }).notNull(),
  version: varchar("version", { length: 32 }).notNull(),
  createdByOpenId: varchar("createdByOpenId", { length: 64 }),
  updatedByOpenId: varchar("updatedByOpenId", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/**
 * Workflow phase detail. roleKey and requiredPermissionKey deliberately mirror the centralized
 * access-control model, allowing the frontend to verify RBAC alignment and the backend to persist it.
 */
export const workflowPhases = mysqlTable("workflow_phases", {
  id: varchar("id", { length: 120 }).primaryKey(),
  workflowId: varchar("workflowId", { length: 96 })
    .notNull()
    .references(() => workflowTemplates.id),
  sortOrder: int("sortOrder").notNull(),
  label: varchar("label", { length: 220 }).notNull(),
  phaseKey: workflowPhaseKeyEnum.notNull(),
  roleKey: varchar("roleKey", { length: 80 }).notNull(),
  requiredPermissionKey: varchar("requiredPermissionKey", { length: 120 }).notNull(),
  gate: text("gate").notNull(),
  purpose: text("purpose"),
  actionKey: varchar("actionKey", { length: 120 }),
  actionLabel: varchar("actionLabel", { length: 220 }),
  checklistJson: text("checklistJson"),
  slaHours: int("slaHours").notNull(),
  evidenceJson: text("evidenceJson").notNull(),
  automation: text("automation").notNull(),
  color: varchar("color", { length: 24 }).notNull(),
  isCritical: int("isCritical").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type AreaRow = typeof areas.$inferSelect;
export type InsertArea = typeof areas.$inferInsert;
export type ProjectRow = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;
export type BlindRow = typeof blinds.$inferSelect;
export type InsertBlind = typeof blinds.$inferInsert;
export type ProjectPhaseOwnerRow = typeof projectPhaseOwners.$inferSelect;
export type InsertProjectPhaseOwner = typeof projectPhaseOwners.$inferInsert;
export type ProjectSettingsRow = typeof projectSettings.$inferSelect;
export type InsertProjectSettings = typeof projectSettings.$inferInsert;
export type BlindWorkflowLogRow = typeof blindWorkflowLogs.$inferSelect;
export type InsertBlindWorkflowLog = typeof blindWorkflowLogs.$inferInsert;
export type BlindPhaseApprovalRow = typeof blindPhaseApprovals.$inferSelect;
export type InsertBlindPhaseApproval = typeof blindPhaseApprovals.$inferInsert;
export type AccessPermissionRow = typeof accessPermissions.$inferSelect;
export type InsertAccessPermission = typeof accessPermissions.$inferInsert;
export type AccessRoleRow = typeof accessRoles.$inferSelect;
export type InsertAccessRole = typeof accessRoles.$inferInsert;
export type AccessRolePermissionRow = typeof accessRolePermissions.$inferSelect;
export type InsertAccessRolePermission = typeof accessRolePermissions.$inferInsert;
export type WorkflowTemplateRow = typeof workflowTemplates.$inferSelect;
export type InsertWorkflowTemplate = typeof workflowTemplates.$inferInsert;
export type WorkflowPhaseRow = typeof workflowPhases.$inferSelect;
export type InsertWorkflowPhase = typeof workflowPhases.$inferInsert;

/**
 * Periodic safety survey header. Each survey captures a snapshot of all slip blinds
 * in the plant (or a specific area/project) at a point in time.
 */
export const slipBlindSurveys = mysqlTable("slip_blind_surveys", {
  id: int("id").autoincrement().primaryKey(),
  surveyDate: date("surveyDate").notNull(),
  conductedByOpenId: varchar("conductedByOpenId", { length: 64 }),
  conductedByName: varchar("conductedByName", { length: 160 }),
  areaId: int("areaId"),
  projectId: varchar("projectId", { length: 40 }),
  totalCount: int("totalCount").default(0).notNull(),
  inServiceCount: int("inServiceCount").default(0).notNull(),
  removedCount: int("removedCount").default(0).notNull(),
  mergedCount: int("mergedCount").default(0).notNull(),
  foremanApprovedCount: int("foremanApprovedCount").default(0).notNull(),
  criticalCount: int("criticalCount").default(0).notNull(),
  notes: text("notes"),
  surveyDataJson: text("surveyDataJson"),
  status: mysqlEnum("status", ["draft", "submitted", "approved"]).default("submitted").notNull(),
  approvedByOpenId: varchar("approvedByOpenId", { length: 64 }),
  approvedAt: timestamp("approvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/**
 * Individual blind entries within a survey. One row per blind per survey.
 */
export const slipBlindSurveyItems = mysqlTable("slip_blind_survey_items", {
  id: int("id").autoincrement().primaryKey(),
  surveyId: int("surveyId").notNull(),
  blindTag: varchar("blindTag", { length: 40 }).notNull(),
  projectId: varchar("projectId", { length: 40 }).notNull(),
  slipStatus: mysqlEnum("slipStatus", ["in_service", "removed", "merged", "unknown"]).default("in_service").notNull(),
  foremanApproved: int("foremanApproved").default(0).notNull(),
  physicalCondition: mysqlEnum("physicalCondition", ["good", "fair", "damaged", "missing"]).default("good").notNull(),
  location: varchar("location", { length: 220 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SlipBlindSurveyRow = typeof slipBlindSurveys.$inferSelect;
export type InsertSlipBlindSurvey = typeof slipBlindSurveys.$inferInsert;
export type SlipBlindSurveyItemRow = typeof slipBlindSurveyItems.$inferSelect;
export type InsertSlipBlindSurveyItem = typeof slipBlindSurveyItems.$inferInsert;

/**
 * System-wide general settings. One row per system (singleton pattern).
 * Covers language, timezone, company info, and notification preferences.
 */
export const systemSettings = mysqlTable("system_settings", {
  id: int("id").autoincrement().primaryKey(),
  // Company Info
  companyName: varchar("companyName", { length: 200 }).default("Shedgum Gas Plant").notNull(),
  companyCode: varchar("companyCode", { length: 40 }).default("SGP").notNull(),
  plantName: varchar("plantName", { length: 200 }).default("Shedgum Gas Plant").notNull(),
  contractNumber: varchar("contractNumber", { length: 100 }),
  // Localization and application appearance
  language: varchar("language", { length: 10 }).default("en").notNull(),
  timezone: varchar("timezone", { length: 80 }).default("Asia/Riyadh").notNull(),
  dateFormat: varchar("dateFormat", { length: 40 }).default("DD/MM/YYYY").notNull(),
  defaultTheme: varchar("defaultTheme", { length: 20 }).default("standard").notNull(),
  allowUserThemeOverride: int("allowUserThemeOverride").default(1).notNull(),
  // Notifications
  emailNotifications: int("emailNotifications").default(1).notNull(),
  phaseChangeAlerts: int("phaseChangeAlerts").default(1).notNull(),
  criticalPriorityAlerts: int("criticalPriorityAlerts").default(1).notNull(),
  // System
  systemVersion: varchar("systemVersion", { length: 40 }).default("1.0.0").notNull(),
  maintenanceMode: int("maintenanceMode").default(0).notNull(),
  // App Branding & Identity
  appName: varchar("appName", { length: 200 }).default("SBTS Professional").notNull(),
  appDescription: text("appDescription"),
  appImageUrl: text("appImageUrl"),
  companyLogoUrl: text("companyLogoUrl"),
  companyDescription: text("companyDescription"),
  regionName: varchar("regionName", { length: 200 }).default(""),
  // Dashboard Hero
  dashboardHeroTitle: varchar("dashboardHeroTitle", { length: 500 }).default("SBTS command center rebuilt for maintainable React architecture."),
  dashboardHeroDescription: text("dashboardHeroDescription"),
  dashboardHeroBadge: varchar("dashboardHeroBadge", { length: 200 }).default("Access-first migration"),
  dashboardHeroImageUrl: text("dashboardHeroImageUrl"),
  dashboardCtaButtons: text("dashboardCtaButtons"), // JSON array [{label, href, variant}]
  // Version
  versionName: varchar("versionName", { length: 100 }).default("Professional Edition"),
  versionDate: varchar("versionDate", { length: 40 }),
  updatedByOpenId: varchar("updatedByOpenId", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/**
 * Default tag settings for blind registration.
 * Controls auto-generated tag format, default values, and numbering.
 */
/**
 * Workflow and safety policy settings. This singleton controls future workflow-engine
 * guard behavior and keeps plant-specific rules configurable without code changes.
 */
export const workflowPolicySettings = mysqlTable("workflow_policy_settings", {
  id: int("id").autoincrement().primaryKey(),
  activeWorkflowTemplateId: varchar("activeWorkflowTemplateId", { length: 96 }).default("wf-sbts-standard-v2").notNull(),
  enforceServerGates: int("enforceServerGates").default(1).notNull(),
  requireIndependentVerifier: int("requireIndependentVerifier").default(1).notNull(),
  requirePtwActive: int("requirePtwActive").default(1).notNull(),
  requireLotoActive: int("requireLotoActive").default(1).notNull(),
  requireGasTestForEntry: int("requireGasTestForEntry").default(1).notNull(),
  requireGasTestForDeBlinding: int("requireGasTestForDeBlinding").default(1).notNull(),
  defaultGasTestValidityMinutes: int("defaultGasTestValidityMinutes").default(240).notNull(),
  gasTestExpiryWarningMinutes: int("gasTestExpiryWarningMinutes").default(30).notNull(),
  safetyHoldEnabled: int("safetyHoldEnabled").default(1).notNull(),
  holdReleaseRequiresIndependentApproval: int("holdReleaseRequiresIndependentApproval").default(1).notNull(),
  metalForemanRequiredForSlipBlind: int("metalForemanRequiredForSlipBlind").default(1).notNull(),
  operationsForemanFinalApprover: int("operationsForemanFinalApprover").default(1).notNull(),
  certificateRequiresLeakTest: int("certificateRequiresLeakTest").default(1).notNull(),
  allowPhaseReopen: int("allowPhaseReopen").default(1).notNull(),
  phaseReopenRequiresApproval: int("phaseReopenRequiresApproval").default(1).notNull(),
  showBlockingReasons: int("showBlockingReasons").default(1).notNull(),
  enableFieldMode: int("enableFieldMode").default(1).notNull(),
  requireIsolationPackageForEntry: int("requireIsolationPackageForEntry").default(1).notNull(),
  requireLineBreakingPermit: int("requireLineBreakingPermit").default(1).notNull(),
  requireGasTestForLineBreaking: int("requireGasTestForLineBreaking").default(0).notNull(),
  requireTorqueCalibration: int("requireTorqueCalibration").default(1).notNull(),
  requireInstallationTorque: int("requireInstallationTorque").default(1).notNull(),
  requireReinstatementTorque: int("requireReinstatementTorque").default(1).notNull(),
  requireSequentialFinalApprovals: int("requireSequentialFinalApprovals").default(1).notNull(),
  requireLotoReleasedForCloseout: int("requireLotoReleasedForCloseout").default(1).notNull(),
  blockTransitionWhenPermitExpired: int("blockTransitionWhenPermitExpired").default(1).notNull(),
  allowAdminWorkflowOverride: int("allowAdminWorkflowOverride").default(0).notNull(),
  showGateReadinessPanel: int("showGateReadinessPanel").default(1).notNull(),
  showLegacyPhaseReference: int("showLegacyPhaseReference").default(0).notNull(),
  workflowUiDensity: varchar("workflowUiDensity", { length: 20 }).default("comfortable").notNull(),
  safetyBannerMode: varchar("safetyBannerMode", { length: 20 }).default("prominent").notNull(),
  authorizedGasTesterRoleKey: varchar("authorizedGasTesterRoleKey", { length: 80 }).default("gasTester").notNull(),
  gasTestRequiresInstrumentCalibration: int("gasTestRequiresInstrumentCalibration").default(1).notNull(),
  gasTestLimitsConfigured: int("gasTestLimitsConfigured").default(0).notNull(),
  gasTestOxygenMinPercent: decimal("gasTestOxygenMinPercent", { precision: 6, scale: 2 }),
  gasTestOxygenMaxPercent: decimal("gasTestOxygenMaxPercent", { precision: 6, scale: 2 }),
  gasTestMaxLelPercent: decimal("gasTestMaxLelPercent", { precision: 6, scale: 2 }),
  gasTestMaxH2sPpm: decimal("gasTestMaxH2sPpm", { precision: 8, scale: 2 }),
  gasTestMaxCoPpm: decimal("gasTestMaxCoPpm", { precision: 8, scale: 2 }),
  entryReadinessValidityMinutes: int("entryReadinessValidityMinutes").default(720).notNull(),
  isolationPackageIdPrefix: varchar("isolationPackageIdPrefix", { length: 20 }).default("VIP").notNull(),
  preventBlindInMultipleActivePackages: int("preventBlindInMultipleActivePackages").default(1).notNull(),
  requireEvidenceBeforePhaseSubmit: int("requireEvidenceBeforePhaseSubmit").default(0).notNull(),
  evidenceMaxFileSizeMb: int("evidenceMaxFileSizeMb").default(10).notNull(),
  evidenceAllowedMimeTypesJson: text("evidenceAllowedMimeTypesJson"),
  defaultTorqueUnit: varchar("defaultTorqueUnit", { length: 20 }).default("N·m").notNull(),
  defaultPumpPressureUnit: varchar("defaultPumpPressureUnit", { length: 20 }).default("psi").notNull(),
  fieldRecordEditorMode: varchar("fieldRecordEditorMode", { length: 20 }).default("dialog").notNull(),
  certificateNumberPrefix: varchar("certificateNumberPrefix", { length: 20 }).default("CERT").notNull(),
  certificateVerificationEnabled: int("certificateVerificationEnabled").default(1).notNull(),
  certificateRequireClosedWorkflow: int("certificateRequireClosedWorkflow").default(1).notNull(),
  certificateReissueRequiresReason: int("certificateReissueRequiresReason").default(1).notNull(),
  certificateAllowRevocation: int("certificateAllowRevocation").default(1).notNull(),
  certificatePublicBaseUrl: varchar("certificatePublicBaseUrl", { length: 500 }),
  defectNumberPrefix: varchar("defectNumberPrefix", { length: 20 }).default("DEF").notNull(),
  punchNumberPrefix: varchar("punchNumberPrefix", { length: 20 }).default("PCH").notNull(),
  ndtNumberPrefix: varchar("ndtNumberPrefix", { length: 20 }).default("NDT").notNull(),
  requireDefectDispositionBeforeClosure: int("requireDefectDispositionBeforeClosure").default(1).notNull(),
  requireMandatoryPunchClosureBeforeReadyForClosure: int("requireMandatoryPunchClosureBeforeReadyForClosure").default(1).notNull(),
  requireNdtAcceptanceBeforeReadyForClosure: int("requireNdtAcceptanceBeforeReadyForClosure").default(1).notNull(),
  allowPunchTransfer: int("allowPunchTransfer").default(1).notNull(),
  updatedByOpenId: varchar("updatedByOpenId", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type WorkflowPolicySettingsRow = typeof workflowPolicySettings.$inferSelect;
export type InsertWorkflowPolicySettings = typeof workflowPolicySettings.$inferInsert;

// ─── Sprint 2 runtime workflow domain ────────────────────────────────────────
// Legacy blind.phase remains available during migration. Runtime workflow state
// is authoritative for the eight-phase lifecycle and is versioned independently.
export const workflowLifecycleStatusEnum = mysqlEnum("lifecycleStatus", [
  "PLANNED", "INITIAL_ISOLATION", "READY_FOR_BLIND_INSTALLATION", "BLIND_INSTALLED",
  "MECHANICAL_VERIFICATION_PENDING", "ACTIVE_ISOLATION", "ENTRY_AUTHORIZED",
  "WORK_IN_PROGRESS", "READY_FOR_CLOSURE", "READY_FOR_BLIND_REMOVAL", "REINSTATED",
  "LEAK_TEST_PENDING", "READY_FOR_SERVICE", "CLOSED", "SAFETY_HOLD",
]);
export const phaseInstanceStatusEnum = mysqlEnum("phaseInstanceStatus", [
  "pending", "current", "completed", "blocked", "rework", "skipped",
]);
export const transitionEventStatusEnum = mysqlEnum("transitionEventStatus", [
  "accepted", "rejected", "override",
]);
export const projectWorkflowAssignmentStatusEnum = mysqlEnum("assignmentStatus", [
  "active", "migrating", "locked",
]);
export const complianceRecordStatusEnum = mysqlEnum("recordStatus", [
  "draft", "active", "valid", "expired", "closed", "cancelled", "rejected",
]);
export const torqueRecordStageEnum = mysqlEnum("torqueStage", ["installation", "reinstatement"]);
export const torqueRecordStatusEnum = mysqlEnum("torqueStatus", ["draft", "submitted", "accepted", "rejected"]);
export const safetyHoldStatusEnum = mysqlEnum("holdStatus", ["active", "release_pending", "released", "rejected"]);
export const approvalStepStatusEnum = mysqlEnum("approvalStatus", ["pending", "approved", "rejected", "revoked", "not_required"]);
export const isolationPackageStatusEnum = mysqlEnum("packageStatus", [
  "draft", "active", "entry_authorized", "work_in_progress", "ready_for_removal",
  "reinstated", "ready_for_service", "closed", "on_hold",
]);
export const entryReadinessStatusEnum = mysqlEnum("entryReadinessStatus", ["draft", "ready", "authorized", "rejected", "expired"]);
export const leakTestStatusEnum = mysqlEnum("leakTestStatus", ["draft", "in_progress", "passed", "failed", "cancelled"]);
export const certificateRecordStatusEnum = mysqlEnum("certificateRecordStatus", ["issued", "superseded", "revoked"]);
export const qualitySeverityEnum = mysqlEnum("qualitySeverity", ["low", "medium", "high", "critical"]);
export const defectStatusEnum = mysqlEnum("defectStatus", ["open", "under_review", "accepted_as_is", "repair_required", "closed", "transferred", "cancelled"]);
export const punchStatusEnum = mysqlEnum("punchStatus", ["open", "in_progress", "ready_for_verification", "closed", "transferred", "cancelled"]);
export const ndtStatusEnum = mysqlEnum("ndtStatus", ["planned", "in_progress", "passed", "failed", "retest_required", "cancelled"]);

export const projectWorkflowAssignments = mysqlTable("project_workflow_assignments", {
  projectId: varchar("projectId", { length: 40 }).primaryKey().references(() => projects.id),
  workflowTemplateId: varchar("workflowTemplateId", { length: 96 }).notNull().references(() => workflowTemplates.id),
  workflowVersion: varchar("workflowVersion", { length: 32 }).notNull(),
  status: projectWorkflowAssignmentStatusEnum.default("active").notNull(),
  migrationVersion: int("migrationVersion").default(2).notNull(),
  assignedByOpenId: varchar("assignedByOpenId", { length: 64 }),
  assignedAt: timestamp("assignedAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const blindWorkflowRuntime = mysqlTable("blind_workflow_runtime", {
  blindTag: varchar("blindTag", { length: 40 }).primaryKey().references(() => blinds.tag),
  projectId: varchar("projectId", { length: 40 }).notNull().references(() => projects.id),
  workflowTemplateId: varchar("workflowTemplateId", { length: 96 }).notNull().references(() => workflowTemplates.id),
  workflowVersion: varchar("workflowVersion", { length: 32 }).notNull(),
  currentPhaseKey: workflowPhaseKeyEnum.notNull(),
  lifecycleStatus: workflowLifecycleStatusEnum.default("PLANNED").notNull(),
  recordVersion: int("recordVersion").default(1).notNull(),
  isLocked: int("isLocked").default(0).notNull(),
  lockedAt: timestamp("lockedAt"),
  lockedByOpenId: varchar("lockedByOpenId", { length: 64 }),
  lastTransitionAt: timestamp("lastTransitionAt"),
  migrationSourcePhase: varchar("migrationSourcePhase", { length: 80 }),
  migrationVersion: int("migrationVersion").default(2).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const blindPhaseInstances = mysqlTable("blind_phase_instances", {
  id: int("id").autoincrement().primaryKey(),
  blindTag: varchar("blindTag", { length: 40 }).notNull().references(() => blinds.tag),
  projectId: varchar("projectId", { length: 40 }).notNull().references(() => projects.id),
  workflowTemplateId: varchar("workflowTemplateId", { length: 96 }).notNull().references(() => workflowTemplates.id),
  phaseKey: workflowPhaseKeyEnum.notNull(),
  sortOrder: int("sortOrder").notNull(),
  status: phaseInstanceStatusEnum.default("pending").notNull(),
  assignedRoleKey: varchar("assignedRoleKey", { length: 80 }).notNull(),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  completedByOpenId: varchar("completedByOpenId", { length: 64 }),
  approvedByOpenId: varchar("approvedByOpenId", { length: 64 }),
  checklistComplete: int("checklistComplete").default(0).notNull(),
  evidenceComplete: int("evidenceComplete").default(0).notNull(),
  gateSnapshotJson: text("gateSnapshotJson"),
  recordVersion: int("recordVersion").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  blindPhaseInstanceUnique: uniqueIndex("blind_phase_instance_unique").on(table.blindTag, table.phaseKey),
}));

export const blindChecklistResponses = mysqlTable("blind_checklist_responses", {
  id: int("id").autoincrement().primaryKey(),
  blindTag: varchar("blindTag", { length: 40 }).notNull().references(() => blinds.tag),
  projectId: varchar("projectId", { length: 40 }).notNull().references(() => projects.id),
  phaseKey: workflowPhaseKeyEnum.notNull(),
  itemKey: varchar("itemKey", { length: 160 }).notNull(),
  itemLabel: varchar("itemLabel", { length: 500 }).notNull(),
  required: int("required").default(1).notNull(),
  completed: int("completed").default(0).notNull(),
  responseJson: text("responseJson"),
  completedByOpenId: varchar("completedByOpenId", { length: 64 }),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  blindChecklistUnique: uniqueIndex("blind_checklist_unique").on(table.blindTag, table.phaseKey, table.itemKey),
}));

export const workflowTransitionEvents = mysqlTable("workflow_transition_events", {
  id: int("id").autoincrement().primaryKey(),
  blindTag: varchar("blindTag", { length: 40 }).notNull().references(() => blinds.tag),
  projectId: varchar("projectId", { length: 40 }).notNull().references(() => projects.id),
  fromPhaseKey: workflowPhaseKeyEnum,
  toPhaseKey: workflowPhaseKeyEnum.notNull(),
  actionKey: varchar("actionKey", { length: 120 }).notNull(),
  status: transitionEventStatusEnum.notNull(),
  blockingReasonsJson: text("blockingReasonsJson"),
  gateSnapshotJson: text("gateSnapshotJson"),
  reason: text("reason"),
  actorOpenId: varchar("actorOpenId", { length: 64 }).notNull(),
  actorName: varchar("actorName", { length: 160 }),
  recordVersionBefore: int("recordVersionBefore").notNull(),
  recordVersionAfter: int("recordVersionAfter").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const isolationPackages = mysqlTable("isolation_packages", {
  id: varchar("id", { length: 64 }).primaryKey(),
  projectId: varchar("projectId", { length: 40 }).notNull().references(() => projects.id),
  equipment: varchar("equipment", { length: 160 }).notNull(),
  description: text("description"),
  status: isolationPackageStatusEnum.default("draft").notNull(),
  recordVersion: int("recordVersion").default(1).notNull(),
  createdByOpenId: varchar("createdByOpenId", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const isolationPackageBlinds = mysqlTable("isolation_package_blinds", {
  id: int("id").autoincrement().primaryKey(),
  packageId: varchar("packageId", { length: 64 }).notNull().references(() => isolationPackages.id),
  blindTag: varchar("blindTag", { length: 40 }).notNull().references(() => blinds.tag),
  required: int("required").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  packageBlindUnique: uniqueIndex("isolation_package_blind_unique").on(table.packageId, table.blindTag),
}));

export const entryReadinessRecords = mysqlTable("entry_readiness_records", {
  id: int("id").autoincrement().primaryKey(),
  packageId: varchar("packageId", { length: 64 }).notNull().references(() => isolationPackages.id),
  status: entryReadinessStatusEnum.default("draft").notNull(),
  allRequiredBlindsActive: int("allRequiredBlindsActive").default(0).notNull(),
  lotoActive: int("lotoActive").default(0).notNull(),
  pressureZero: int("pressureZero").default(0).notNull(),
  drainedAndPurged: int("drainedAndPurged").default(0).notNull(),
  gasTestAcceptable: int("gasTestAcceptable").default(0).notNull(),
  confinedSpacePermitValid: int("confinedSpacePermitValid").default(0).notNull(),
  operationsApproved: int("operationsApproved").default(0).notNull(),
  entrySupervisorApproved: int("entrySupervisorApproved").default(0).notNull(),
  validUntil: timestamp("validUntil"),
  approvedByOpenId: varchar("approvedByOpenId", { length: 64 }),
  approvedAt: timestamp("approvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const permitRecords = mysqlTable("permit_records", {
  id: int("id").autoincrement().primaryKey(),
  blindTag: varchar("blindTag", { length: 40 }).notNull().references(() => blinds.tag),
  projectId: varchar("projectId", { length: 40 }).notNull().references(() => projects.id),
  permitType: varchar("permitType", { length: 60 }).notNull(),
  permitNumber: varchar("permitNumber", { length: 120 }).notNull(),
  status: complianceRecordStatusEnum.default("draft").notNull(),
  validFrom: timestamp("validFrom"),
  validUntil: timestamp("validUntil"),
  issuedByOpenId: varchar("issuedByOpenId", { length: 64 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const lotoRecords = mysqlTable("loto_records", {
  id: int("id").autoincrement().primaryKey(),
  blindTag: varchar("blindTag", { length: 40 }).notNull().references(() => blinds.tag),
  projectId: varchar("projectId", { length: 40 }).notNull().references(() => projects.id),
  certificateNumber: varchar("certificateNumber", { length: 120 }).notNull(),
  status: complianceRecordStatusEnum.default("draft").notNull(),
  lockNumbersJson: text("lockNumbersJson"),
  zeroEnergyVerified: int("zeroEnergyVerified").default(0).notNull(),
  appliedByOpenId: varchar("appliedByOpenId", { length: 64 }),
  verifiedByOpenId: varchar("verifiedByOpenId", { length: 64 }),
  appliedAt: timestamp("appliedAt"),
  releasedAt: timestamp("releasedAt"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const gasTestRecords = mysqlTable("gas_test_records", {
  id: int("id").autoincrement().primaryKey(),
  blindTag: varchar("blindTag", { length: 40 }).notNull().references(() => blinds.tag),
  projectId: varchar("projectId", { length: 40 }).notNull().references(() => projects.id),
  testPurpose: varchar("testPurpose", { length: 80 }).notNull(),
  status: complianceRecordStatusEnum.default("draft").notNull(),
  oxygenPercent: decimal("oxygenPercent", { precision: 6, scale: 2 }),
  lelPercent: decimal("lelPercent", { precision: 6, scale: 2 }),
  h2sPpm: decimal("h2sPpm", { precision: 8, scale: 2 }),
  coPpm: decimal("coPpm", { precision: 8, scale: 2 }),
  testerOpenId: varchar("testerOpenId", { length: 64 }),
  testerName: varchar("testerName", { length: 160 }),
  instrumentId: varchar("instrumentId", { length: 120 }),
  calibrationExpiry: timestamp("calibrationExpiry"),
  testedAt: timestamp("testedAt"),
  validUntil: timestamp("validUntil"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const torqueRecords = mysqlTable("torque_records", {
  id: int("id").autoincrement().primaryKey(),
  blindTag: varchar("blindTag", { length: 40 }).notNull().references(() => blinds.tag),
  projectId: varchar("projectId", { length: 40 }).notNull().references(() => projects.id),
  stage: torqueRecordStageEnum.notNull(),
  status: torqueRecordStatusEnum.default("draft").notNull(),
  procedureReference: varchar("procedureReference", { length: 160 }),
  toolType: varchar("toolType", { length: 120 }).notNull(),
  toolSerialNumber: varchar("toolSerialNumber", { length: 120 }),
  calibrationCertificateNumber: varchar("calibrationCertificateNumber", { length: 120 }),
  calibrationExpiry: timestamp("calibrationExpiry"),
  targetTorque: decimal("targetTorque", { precision: 12, scale: 3 }),
  actualTorque: decimal("actualTorque", { precision: 12, scale: 3 }),
  torqueUnit: varchar("torqueUnit", { length: 20 }).default("N·m").notNull(),
  pumpPressure: decimal("pumpPressure", { precision: 12, scale: 3 }),
  pumpPressureUnit: varchar("pumpPressureUnit", { length: 20 }),
  passesJson: text("passesJson"),
  technicianOpenId: varchar("technicianOpenId", { length: 64 }),
  witnessOpenId: varchar("witnessOpenId", { length: 64 }),
  acceptedByOpenId: varchar("acceptedByOpenId", { length: 64 }),
  completedAt: timestamp("completedAt"),
  acceptedAt: timestamp("acceptedAt"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  blindTorqueStageUnique: uniqueIndex("blind_torque_stage_unique").on(table.blindTag, table.stage),
}));

export const leakTestRecords = mysqlTable("leak_test_records", {
  id: int("id").autoincrement().primaryKey(),
  blindTag: varchar("blindTag", { length: 40 }).notNull().references(() => blinds.tag),
  projectId: varchar("projectId", { length: 40 }).notNull().references(() => projects.id),
  status: leakTestStatusEnum.default("draft").notNull(),
  testType: varchar("testType", { length: 80 }),
  testMedium: varchar("testMedium", { length: 80 }),
  testPressure: decimal("testPressure", { precision: 12, scale: 3 }),
  pressureUnit: varchar("pressureUnit", { length: 20 }),
  durationMinutes: int("durationMinutes"),
  noLeakObserved: int("noLeakObserved").default(0).notNull(),
  performedByOpenId: varchar("performedByOpenId", { length: 64 }),
  acceptedByOpenId: varchar("acceptedByOpenId", { length: 64 }),
  testedAt: timestamp("testedAt"),
  acceptedAt: timestamp("acceptedAt"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  blindLeakTestUnique: uniqueIndex("blind_leak_test_unique").on(table.blindTag),
}));

export const safetyHolds = mysqlTable("safety_holds", {
  id: int("id").autoincrement().primaryKey(),
  blindTag: varchar("blindTag", { length: 40 }).notNull().references(() => blinds.tag),
  projectId: varchar("projectId", { length: 40 }).notNull().references(() => projects.id),
  phaseKey: workflowPhaseKeyEnum.notNull(),
  status: safetyHoldStatusEnum.default("active").notNull(),
  reasonCode: varchar("reasonCode", { length: 80 }).notNull(),
  description: text("description").notNull(),
  previousLifecycleStatus: varchar("previousLifecycleStatus", { length: 40 }),
  correctiveAction: text("correctiveAction"),
  placedByOpenId: varchar("placedByOpenId", { length: 64 }).notNull(),
  releaseRequestedByOpenId: varchar("releaseRequestedByOpenId", { length: 64 }),
  releaseRequestedAt: timestamp("releaseRequestedAt"),
  releasedByOpenId: varchar("releasedByOpenId", { length: 64 }),
  releaseApprovedByOpenId: varchar("releaseApprovedByOpenId", { length: 64 }),
  placedAt: timestamp("placedAt").defaultNow().notNull(),
  releasedAt: timestamp("releasedAt"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const workflowApprovalSteps = mysqlTable("workflow_approval_steps", {
  id: int("id").autoincrement().primaryKey(),
  blindTag: varchar("blindTag", { length: 40 }).notNull().references(() => blinds.tag),
  projectId: varchar("projectId", { length: 40 }).notNull().references(() => projects.id),
  phaseKey: workflowPhaseKeyEnum.notNull(),
  approvalRoleKey: varchar("approvalRoleKey", { length: 80 }).notNull(),
  sequence: int("sequence").notNull(),
  conditional: int("conditional").default(0).notNull(),
  status: approvalStepStatusEnum.default("pending").notNull(),
  approvedByOpenId: varchar("approvedByOpenId", { length: 64 }),
  approvedByName: varchar("approvedByName", { length: 160 }),
  note: text("note"),
  approvedAt: timestamp("approvedAt"),
  revokedAt: timestamp("revokedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  workflowApprovalUnique: uniqueIndex("workflow_approval_unique").on(table.blindTag, table.phaseKey, table.approvalRoleKey),
}));

export const workflowEvidenceAttachments = mysqlTable("workflow_evidence_attachments", {
  id: int("id").autoincrement().primaryKey(),
  blindTag: varchar("blindTag", { length: 40 }).notNull().references(() => blinds.tag),
  projectId: varchar("projectId", { length: 40 }).notNull().references(() => projects.id),
  phaseKey: workflowPhaseKeyEnum.notNull(),
  category: varchar("category", { length: 120 }).notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  fileUrl: text("fileUrl").notNull(),
  storageKey: varchar("storageKey", { length: 500 }),
  mimeType: varchar("mimeType", { length: 120 }),
  fileSizeBytes: int("fileSizeBytes"),
  uploadedByOpenId: varchar("uploadedByOpenId", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const inspectionActivityTemplates = mysqlTable("inspection_activity_templates", {
  id: int("id").autoincrement().primaryKey(),
  activityKey: varchar("activityKey", { length: 100 }).notNull(),
  name: varchar("name", { length: 180 }).notNull(),
  description: text("description"),
  applicableEquipmentTypesJson: text("applicableEquipmentTypesJson"),
  mandatory: int("mandatory").default(0).notNull(),
  evidenceRequired: int("evidenceRequired").default(0).notNull(),
  approvalRequired: int("approvalRequired").default(0).notNull(),
  active: int("active").default(1).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdByOpenId: varchar("createdByOpenId", { length: 64 }),
  updatedByOpenId: varchar("updatedByOpenId", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  activityKeyUnique: uniqueIndex("inspection_activity_key_unique").on(table.activityKey),
}));

export const inspectionActivityRecords = mysqlTable("inspection_activity_records", {
  id: int("id").autoincrement().primaryKey(),
  blindTag: varchar("blindTag", { length: 40 }).notNull().references(() => blinds.tag),
  projectId: varchar("projectId", { length: 40 }).notNull().references(() => projects.id),
  templateId: int("templateId").notNull().references(() => inspectionActivityTemplates.id),
  phaseKey: workflowPhaseKeyEnum.default("internalInspection").notNull(),
  status: varchar("status", { length: 30 }).default("not_started").notNull(),
  result: varchar("result", { length: 60 }),
  notes: text("notes"),
  completedByOpenId: varchar("completedByOpenId", { length: 64 }),
  approvedByOpenId: varchar("approvedByOpenId", { length: 64 }),
  completedAt: timestamp("completedAt"),
  approvedAt: timestamp("approvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  blindInspectionActivityUnique: uniqueIndex("blind_inspection_activity_unique").on(table.blindTag, table.templateId),
}));

export const certificateRecords = mysqlTable("certificate_records", {
  id: int("id").autoincrement().primaryKey(),
  certificateNumber: varchar("certificateNumber", { length: 120 }).notNull().unique(),
  verificationToken: varchar("verificationToken", { length: 96 }).notNull().unique(),
  projectId: varchar("projectId", { length: 40 }).notNull().references(() => projects.id),
  blindTag: varchar("blindTag", { length: 40 }).notNull().references(() => blinds.tag),
  version: int("version").default(1).notNull(),
  status: certificateRecordStatusEnum.default("issued").notNull(),
  snapshotJson: text("snapshotJson").notNull(),
  snapshotHash: varchar("snapshotHash", { length: 64 }).notNull(),
  previousCertificateId: int("previousCertificateId"),
  issuanceReason: text("issuanceReason"),
  issuedByOpenId: varchar("issuedByOpenId", { length: 64 }).notNull(),
  issuedByName: varchar("issuedByName", { length: 160 }),
  issuedAt: timestamp("issuedAt").defaultNow().notNull(),
  supersededAt: timestamp("supersededAt"),
  revokedByOpenId: varchar("revokedByOpenId", { length: 64 }),
  revokedAt: timestamp("revokedAt"),
  revocationReason: text("revocationReason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  blindCertificateVersionUnique: uniqueIndex("blind_certificate_version_unique").on(table.blindTag, table.version),
}));

export const defectNotifications = mysqlTable("defect_notifications", {
  id: int("id").autoincrement().primaryKey(),
  defectNumber: varchar("defectNumber", { length: 120 }).notNull().unique(),
  projectId: varchar("projectId", { length: 40 }).notNull().references(() => projects.id),
  blindTag: varchar("blindTag", { length: 40 }).notNull().references(() => blinds.tag),
  phaseKey: workflowPhaseKeyEnum.default("internalInspection").notNull(),
  title: varchar("title", { length: 240 }).notNull(),
  description: text("description").notNull(),
  severity: qualitySeverityEnum.default("medium").notNull(),
  status: defectStatusEnum.default("open").notNull(),
  disposition: text("disposition"),
  requiresRepair: int("requiresRepair").default(0).notNull(),
  requiresNdt: int("requiresNdt").default(0).notNull(),
  assignedToOpenId: varchar("assignedToOpenId", { length: 64 }),
  reportedByOpenId: varchar("reportedByOpenId", { length: 64 }).notNull(),
  reviewedByOpenId: varchar("reviewedByOpenId", { length: 64 }),
  closedByOpenId: varchar("closedByOpenId", { length: 64 }),
  dueAt: timestamp("dueAt"),
  closedAt: timestamp("closedAt"),
  recordVersion: int("recordVersion").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const punchItems = mysqlTable("punch_items", {
  id: int("id").autoincrement().primaryKey(),
  punchNumber: varchar("punchNumber", { length: 120 }).notNull().unique(),
  projectId: varchar("projectId", { length: 40 }).notNull().references(() => projects.id),
  blindTag: varchar("blindTag", { length: 40 }).notNull().references(() => blinds.tag),
  defectId: int("defectId").references(() => defectNotifications.id),
  title: varchar("title", { length: 240 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 100 }),
  severity: qualitySeverityEnum.default("medium").notNull(),
  mandatory: int("mandatory").default(1).notNull(),
  status: punchStatusEnum.default("open").notNull(),
  ownerOpenId: varchar("ownerOpenId", { length: 64 }),
  targetDate: timestamp("targetDate"),
  verificationNotes: text("verificationNotes"),
  transferReference: varchar("transferReference", { length: 200 }),
  createdByOpenId: varchar("createdByOpenId", { length: 64 }).notNull(),
  verifiedByOpenId: varchar("verifiedByOpenId", { length: 64 }),
  closedAt: timestamp("closedAt"),
  recordVersion: int("recordVersion").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const ndtRecords = mysqlTable("ndt_records", {
  id: int("id").autoincrement().primaryKey(),
  ndtNumber: varchar("ndtNumber", { length: 120 }).notNull().unique(),
  projectId: varchar("projectId", { length: 40 }).notNull().references(() => projects.id),
  blindTag: varchar("blindTag", { length: 40 }).notNull().references(() => blinds.tag),
  defectId: int("defectId").references(() => defectNotifications.id),
  method: varchar("method", { length: 80 }).notNull(),
  procedureReference: varchar("procedureReference", { length: 160 }),
  acceptanceCriteria: text("acceptanceCriteria"),
  status: ndtStatusEnum.default("planned").notNull(),
  result: text("result"),
  reportNumber: varchar("reportNumber", { length: 160 }),
  performedByOpenId: varchar("performedByOpenId", { length: 64 }),
  reviewedByOpenId: varchar("reviewedByOpenId", { length: 64 }),
  performedAt: timestamp("performedAt"),
  reviewedAt: timestamp("reviewedAt"),
  recordVersion: int("recordVersion").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ProjectWorkflowAssignmentRow = typeof projectWorkflowAssignments.$inferSelect;
export type BlindWorkflowRuntimeRow = typeof blindWorkflowRuntime.$inferSelect;
export type BlindPhaseInstanceRow = typeof blindPhaseInstances.$inferSelect;
export type BlindChecklistResponseRow = typeof blindChecklistResponses.$inferSelect;
export type WorkflowTransitionEventRow = typeof workflowTransitionEvents.$inferSelect;
export type IsolationPackageRow = typeof isolationPackages.$inferSelect;
export type EntryReadinessRecordRow = typeof entryReadinessRecords.$inferSelect;
export type PermitRecordRow = typeof permitRecords.$inferSelect;
export type LotoRecordRow = typeof lotoRecords.$inferSelect;
export type GasTestRecordRow = typeof gasTestRecords.$inferSelect;
export type TorqueRecordRow = typeof torqueRecords.$inferSelect;
export type LeakTestRecordRow = typeof leakTestRecords.$inferSelect;
export type SafetyHoldRow = typeof safetyHolds.$inferSelect;
export type WorkflowApprovalStepRow = typeof workflowApprovalSteps.$inferSelect;
export type InspectionActivityTemplateRow = typeof inspectionActivityTemplates.$inferSelect;
export type InspectionActivityRecordRow = typeof inspectionActivityRecords.$inferSelect;
export type CertificateRecordRow = typeof certificateRecords.$inferSelect;
export type DefectNotificationRow = typeof defectNotifications.$inferSelect;
export type PunchItemRow = typeof punchItems.$inferSelect;
export type NdtRecordRow = typeof ndtRecords.$inferSelect;

export const defaultTagSettings = mysqlTable("default_tag_settings", {
  id: int("id").autoincrement().primaryKey(),
  // Tag Format
  tagPrefix: varchar("tagPrefix", { length: 20 }).default("BLD").notNull(),
  tagSeparator: varchar("tagSeparator", { length: 5 }).default("-").notNull(),
  tagPaddingDigits: int("tagPaddingDigits").default(3).notNull(),
  tagStartNumber: int("tagStartNumber").default(1).notNull(),
  // Default Blind Values
  defaultType: varchar("defaultType", { length: 120 }).default("Spectacle Blind").notNull(),
  defaultSize: varchar("defaultSize", { length: 60 }).default('2"').notNull(),
  defaultRate: varchar("defaultRate", { length: 60 }).default("150#").notNull(),
  defaultPriority: blindPriorityEnum.default("Normal").notNull(),
  defaultPhase: blindPhaseEnum.default("Broken / Preparation").notNull(),
  // Auto-fill Options
  autoGenerateTag: int("autoGenerateTag").default(1).notNull(),
  requireEquipment: int("requireEquipment").default(0).notNull(),
  requireLocation: int("requireLocation").default(0).notNull(),
  requireIsolationPoint: int("requireIsolationPoint").default(0).notNull(),
  // Visual Settings
  tagColor: varchar("tagColor", { length: 20 }).default("#0f172a"),
  tagWidth: int("tagWidth").default(85),
  tagHeight: int("tagHeight").default(55),
  tagFontSize: int("tagFontSize").default(14),
  tagFontColor: varchar("tagFontColor", { length: 20 }).default("#0f172a"),
  tagTheme: varchar("tagTheme", { length: 40 }).default("industrial"),
  tagShowLogo: int("tagShowLogo").default(1),
  tagShowQR: int("tagShowQR").default(1),
  tagHoleEnabled: int("tagHoleEnabled").default(1),
  tagHolePosition: varchar("tagHolePosition", { length: 20 }).default("top-center"),
  updatedByOpenId: varchar("updatedByOpenId", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/**
 * Certificate settings for printing and document generation.
 * Controls header, footer, signatures, and branding on printed certificates.
 */
export const certificateSettings = mysqlTable("certificate_settings", {
  id: int("id").autoincrement().primaryKey(),
  // Header
  certificateTitle: varchar("certificateTitle", { length: 200 }).default("Blind Installation Certificate").notNull(),
  headerCompanyName: varchar("headerCompanyName", { length: 200 }).default("Shedgum Gas Plant").notNull(),
  headerSubtitle: varchar("headerSubtitle", { length: 300 }).default("Smart Blind Tracking System - SBTS").notNull(),
  logoUrl: text("logoUrl"),
  // Signature Fields
  signature1Label: varchar("signature1Label", { length: 100 }).default("Prepared By").notNull(),
  signature1Name: varchar("signature1Name", { length: 160 }),
  signature1Title: varchar("signature1Title", { length: 160 }),
  signature2Label: varchar("signature2Label", { length: 100 }).default("Reviewed By").notNull(),
  signature2Name: varchar("signature2Name", { length: 160 }),
  signature2Title: varchar("signature2Title", { length: 160 }),
  signature3Label: varchar("signature3Label", { length: 100 }).default("Approved By").notNull(),
  signature3Name: varchar("signature3Name", { length: 160 }),
  signature3Title: varchar("signature3Title", { length: 160 }),
  // Footer
  footerText: text("footerText"),
  showPageNumbers: int("showPageNumbers").default(1).notNull(),
  showGenerationDate: int("showGenerationDate").default(1).notNull(),
  showSystemVersion: int("showSystemVersion").default(1).notNull(),
  // Print Options
  paperSize: varchar("paperSize", { length: 20 }).default("A4").notNull(),
  orientation: varchar("orientation", { length: 20 }).default("portrait").notNull(),
  // Section Visibility
  showWorkflowLog: int("showWorkflowLog").default(1),
  showExecutionTorque: int("showExecutionTorque").default(1),
  showFinalApprovals: int("showFinalApprovals").default(1),
  showBlindInfo: int("showBlindInfo").default(1),
  showProjectInfo: int("showProjectInfo").default(1),
  showQrCode: int("showQrCode").default(1),
  showLockStatus: int("showLockStatus").default(1),
  showAreaInfo: int("showAreaInfo").default(1),
  statusBadgeText: varchar("statusBadgeText", { length: 40 }).default("APPROVED"),
  lockBadgeText: varchar("lockBadgeText", { length: 40 }).default("LOCKED / FINAL"),
  updatedByOpenId: varchar("updatedByOpenId", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SystemSettingsRow = typeof systemSettings.$inferSelect;
export type InsertSystemSettings = typeof systemSettings.$inferInsert;
export type DefaultTagSettingsRow = typeof defaultTagSettings.$inferSelect;
export type InsertDefaultTagSettings = typeof defaultTagSettings.$inferInsert;
export type CertificateSettingsRow = typeof certificateSettings.$inferSelect;
export type InsertCertificateSettings = typeof certificateSettings.$inferInsert;

/**
 * Security settings. Controls QR access, delete policies, audit trail, and session behavior.
 */
export const securitySettings = mysqlTable("security_settings", {
  id: int("id").autoincrement().primaryKey(),
  qrPublicAccess: int("qrPublicAccess").default(1).notNull(),
  qrRequireAuth: int("qrRequireAuth").default(0).notNull(),
  allowDeleteBlinds: int("allowDeleteBlinds").default(0).notNull(),
  allowDeleteProjects: int("allowDeleteProjects").default(0).notNull(),
  requireDeleteConfirmation: int("requireDeleteConfirmation").default(1).notNull(),
  auditTrailEnabled: int("auditTrailEnabled").default(1).notNull(),
  auditRetentionDays: int("auditRetentionDays").default(90).notNull(),
  sessionTimeoutMinutes: int("sessionTimeoutMinutes").default(480).notNull(),
  maxLoginAttempts: int("maxLoginAttempts").default(5).notNull(),
  lockoutDurationMinutes: int("lockoutDurationMinutes").default(15).notNull(),
  requireStrongPassword: int("requireStrongPassword").default(1).notNull(),
  minPasswordLength: int("minPasswordLength").default(12).notNull(),
  updatedByOpenId: varchar("updatedByOpenId", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SecuritySettingsRow = typeof securitySettings.$inferSelect;
export type InsertSecuritySettings = typeof securitySettings.$inferInsert;

/**
 * Notification preferences. Controls which operational events create inbox notifications.
 */
export const notificationPreferences = mysqlTable("notification_preferences", {
  id: int("id").autoincrement().primaryKey(),
  registrationRequest: int("registrationRequest").default(1).notNull(),
  registrationApproved: int("registrationApproved").default(1).notNull(),
  registrationRejected: int("registrationRejected").default(1).notNull(),
  blindPhaseChanged: int("blindPhaseChanged").default(1).notNull(),
  blindPhaseApproval: int("blindPhaseApproval").default(1).notNull(),
  blindAssigned: int("blindAssigned").default(1).notNull(),
  projectCreated: int("projectCreated").default(1).notNull(),
  projectStatusChanged: int("projectStatusChanged").default(1).notNull(),
  phaseOwnerAssigned: int("phaseOwnerAssigned").default(1).notNull(),
  workflowUpdated: int("workflowUpdated").default(1).notNull(),
  workflowTransition: int("workflowTransition").default(1).notNull(),
  workflowGateBlocked: int("workflowGateBlocked").default(1).notNull(),
  workflowApprovalRequired: int("workflowApprovalRequired").default(1).notNull(),
  safetyHoldPlaced: int("safetyHoldPlaced").default(1).notNull(),
  safetyHoldReleased: int("safetyHoldReleased").default(1).notNull(),
  systemAnnouncement: int("systemAnnouncement").default(1).notNull(),
  updatedByOpenId: varchar("updatedByOpenId", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type NotificationPreferencesRow = typeof notificationPreferences.$inferSelect;
export type InsertNotificationPreferences = typeof notificationPreferences.$inferInsert;


/**
 * User-to-Role assignments. Links users to access_roles for centralized permission management.
 * A user can have multiple roles; permissions are the union of all assigned roles.
 */
export const userRoleAssignments = mysqlTable("user_role_assignments", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  roleKey: varchar("roleKey", { length: 80 }).notNull().references(() => accessRoles.key),
  assignedByOpenId: varchar("assignedByOpenId", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type UserRoleAssignmentRow = typeof userRoleAssignments.$inferSelect;
export type InsertUserRoleAssignment = typeof userRoleAssignments.$inferInsert;

/**
 * In-App Notifications.
 * Stores notifications for all users. Each notification targets a specific user (recipientOpenId).
 * Supports categorized event types for filtering and display.
 */
export const notificationTypeEnum = mysqlEnum("notificationType", [
  // Registration events
  "registration_request",      // new user submitted registration → admin
  "registration_approved",     // admin approved user → user
  "registration_rejected",     // admin rejected user → user
  // Blind phase events
  "blind_phase_changed",       // blind moved to new phase → phase owner
  "blind_phase_approval",      // electronic approval submitted → project coordinator
  "blind_assigned",            // blind assigned to user → assignee
  // Project events
  "project_created",           // new project created → all admins
  "project_status_changed",    // project status changed → phase owners
  "phase_owner_assigned",      // user assigned as phase owner → that user
  // Workflow events
  "workflow_updated",          // workflow template updated → admins
  "workflow_transition",       // canonical runtime phase transition
  "workflow_gate_blocked",     // transition rejected by a server gate
  "workflow_approval_required",// approval step requires action
  "safety_hold_placed",        // stop-work / safety hold placed
  "safety_hold_released",      // safety hold released after approval
  // System events
  "system_announcement",       // general system announcement → all users
]);

export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  /** Target user's openId */
  recipientOpenId: varchar("recipientOpenId", { length: 64 }).notNull(),
  /** Actor who triggered the event (null for system events) */
  actorOpenId: varchar("actorOpenId", { length: 64 }),
  actorName: varchar("actorName", { length: 200 }),
  /** Notification category */
  type: notificationTypeEnum.notNull(),
  /** Short title shown in the bell dropdown */
  title: varchar("title", { length: 200 }).notNull(),
  /** Full message body shown in the notifications page */
  body: text("body").notNull(),
  /** Optional deep-link URL (e.g. /projects/5/blinds/BL-001) */
  linkUrl: varchar("linkUrl", { length: 500 }),
  /** Reference IDs for context */
  projectId: varchar("projectId", { length: 40 }),
  blindTag: varchar("blindTag", { length: 80 }),
  /** Read state */
  isRead: int("isRead").default(0).notNull(),
  readAt: timestamp("readAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type NotificationRow = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;


/**
 * Feature Toggles — التحكم بالخصائص من الإعدادات
 * كل خاصية يمكن تفعيلها أو تعطيلها من صفحة الإعدادات
 */
export const featureToggles = mysqlTable("feature_toggles", {
  id: int("id").autoincrement().primaryKey(),
  // Blind Detail Hub Tabs
  enableWorkflowTab: int("enableWorkflowTab").default(1).notNull(),
  enableComplianceTab: int("enableComplianceTab").default(1).notNull(),
  enableFieldActionsTab: int("enableFieldActionsTab").default(1).notNull(),
  enableQrMobileTab: int("enableQrMobileTab").default(1).notNull(),
  enableHistoryTab: int("enableHistoryTab").default(1).notNull(),
  // Compliance Features
  enableSafetyChecklists: int("enableSafetyChecklists").default(1).notNull(),
  enableTorqueRecords: int("enableTorqueRecords").default(1).notNull(),
  enableInspectionRecords: int("enableInspectionRecords").default(1).notNull(),
  enablePhotoEvidence: int("enablePhotoEvidence").default(1).notNull(),
  // Field Actions Features
  enablePtw: int("enablePtw").default(1).notNull(),
  enableLoto: int("enableLoto").default(1).notNull(),
  enableRiskAssessment: int("enableRiskAssessment").default(1).notNull(),
  enableFieldNotes: int("enableFieldNotes").default(1).notNull(),
  // QR & Mobile Features
  enableQrGeneration: int("enableQrGeneration").default(1).notNull(),
  enableMobileVerification: int("enableMobileVerification").default(1).notNull(),
  enableOfflineAccess: int("enableOfflineAccess").default(0).notNull(),
  // General Features
  enableSlipBlindSurveys: int("enableSlipBlindSurveys").default(1).notNull(),
  enableCertificates: int("enableCertificates").default(1).notNull(),
  enableExpiryTracking: int("enableExpiryTracking").default(1).notNull(),
  enableProgressRing: int("enableProgressRing").default(1).notNull(),
  enableQuickActions: int("enableQuickActions").default(1).notNull(),
  enableBreadcrumb: int("enableBreadcrumb").default(1).notNull(),
  // Timestamps
  updatedByOpenId: varchar("updatedByOpenId", { length: 64 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type FeatureToggleRow = typeof featureToggles.$inferSelect;
