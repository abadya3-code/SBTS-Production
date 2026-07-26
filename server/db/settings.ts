/**
 * server/db/settings.ts
 * ─────────────────────
 * System Settings, Default Tag Settings, and Certificate Settings helpers.
 */

import { requireDb } from "./core";
import { certificateSettings, defaultTagSettings, systemSettings, securitySettings, notificationPreferences, workflowPolicySettings } from "../../drizzle/schema";

// ─── System Settings ───────────────────────────────────────────────────────

export async function getSystemSettings() {
  const db = await requireDb();
  const rows = await db.select().from(systemSettings).limit(1);
  if (rows.length === 0) {
    return {
      id: 0,
      companyName: "Shedgum Gas Plant",
      companyCode: "SGP",
      plantName: "Shedgum Gas Plant",
      contractNumber: null as string | null,
      language: "en",
      timezone: "Asia/Riyadh",
      dateFormat: "DD/MM/YYYY",
      defaultTheme: "standard",
      allowUserThemeOverride: 1,
      emailNotifications: 1,
      phaseChangeAlerts: 1,
      criticalPriorityAlerts: 1,
      systemVersion: "1.0.0",
      maintenanceMode: 0,
      appName: "SBTS Professional",
      appDescription: null as string | null,
      appImageUrl: null as string | null,
      companyLogoUrl: null as string | null,
      companyDescription: null as string | null,
      regionName: "",
      dashboardHeroTitle: "SBTS command center rebuilt for maintainable React architecture.",
      dashboardHeroDescription: null as string | null,
      dashboardHeroBadge: "Access-first migration",
      dashboardHeroImageUrl: null as string | null,
      dashboardCtaButtons: null as string | null,
      versionName: "Professional Edition v1.0",
      versionDate: null as string | null,
      updatedByOpenId: null as string | null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
  return rows[0];
}

export async function upsertSystemSettings(
  data: Partial<Omit<typeof systemSettings.$inferInsert, "id" | "createdAt" | "updatedAt">>,
  actorOpenId: string,
) {
  const db = await requireDb();
  const existing = await db.select({ id: systemSettings.id }).from(systemSettings).limit(1);
  if (existing.length === 0) {
    await db.insert(systemSettings).values({ ...data, updatedByOpenId: actorOpenId });
  } else {
    await db.update(systemSettings).set({ ...data, updatedByOpenId: actorOpenId });
  }
  return getSystemSettings();
}

// ─── Default Tag Settings ──────────────────────────────────────────────────

export async function getDefaultTagSettings() {
  const db = await requireDb();
  const rows = await db.select().from(defaultTagSettings).limit(1);
  if (rows.length === 0) {
    return {
      id: 0,
      tagPrefix: "BLD",
      tagSeparator: "-",
      tagPaddingDigits: 3,
      tagStartNumber: 1,
      defaultType: "Spectacle Blind",
      defaultSize: '2"',
      defaultRate: "150#",
      defaultPriority: "Normal" as const,
      defaultPhase: "Broken / Preparation" as const,
      autoGenerateTag: 1,
      requireEquipment: 0,
      requireLocation: 0,
      requireIsolationPoint: 0,
      tagColor: "#0f172a",
      tagWidth: 85,
      tagHeight: 55,
      tagFontSize: 14,
      tagFontColor: "#0f172a",
      tagTheme: "industrial",
      tagShowLogo: 1,
      tagShowQR: 1,
      tagHoleEnabled: 1,
      tagHolePosition: "top-center",
      updatedByOpenId: null as string | null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
  return rows[0];
}

export async function upsertDefaultTagSettings(
  data: Partial<Omit<typeof defaultTagSettings.$inferInsert, "id" | "createdAt" | "updatedAt">>,
  actorOpenId: string,
) {
  const db = await requireDb();
  const existing = await db.select({ id: defaultTagSettings.id }).from(defaultTagSettings).limit(1);
  if (existing.length === 0) {
    await db.insert(defaultTagSettings).values({ ...data, updatedByOpenId: actorOpenId });
  } else {
    await db.update(defaultTagSettings).set({ ...data, updatedByOpenId: actorOpenId });
  }
  return getDefaultTagSettings();
}

// ─── Certificate Settings ──────────────────────────────────────────────────

export async function getCertificateSettings() {
  const db = await requireDb();
  const rows = await db.select().from(certificateSettings).limit(1);
  if (rows.length === 0) {
    return {
      id: 0,
      certificateTitle: "Blind Installation Certificate",
      headerCompanyName: "Shedgum Gas Plant",
      headerSubtitle: "Smart Blind Tracking System - SBTS",
      logoUrl: null as string | null,
      signature1Label: "Prepared By",
      signature1Name: null as string | null,
      signature1Title: null as string | null,
      signature2Label: "Reviewed By",
      signature2Name: null as string | null,
      signature2Title: null as string | null,
      signature3Label: "Approved By",
      signature3Name: null as string | null,
      signature3Title: null as string | null,
      footerText: null as string | null,
      showPageNumbers: 1,
      showGenerationDate: 1,
      showSystemVersion: 1,
      paperSize: "A4",
      orientation: "portrait",
      showWorkflowLog: 1,
      showExecutionTorque: 1,
      showFinalApprovals: 1,
      showBlindInfo: 1,
      showProjectInfo: 1,
      showQrCode: 1,
      showLockStatus: 1,
      showAreaInfo: 1,
      statusBadgeText: "APPROVED",
      lockBadgeText: "LOCKED / FINAL",
      updatedByOpenId: null as string | null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
  return rows[0];
}

export async function upsertCertificateSettings(
  data: Partial<Omit<typeof certificateSettings.$inferInsert, "id" | "createdAt" | "updatedAt">>,
  actorOpenId: string,
) {
  const db = await requireDb();
  const existing = await db.select({ id: certificateSettings.id }).from(certificateSettings).limit(1);
  if (existing.length === 0) {
    await db.insert(certificateSettings).values({ ...data, updatedByOpenId: actorOpenId });
  } else {
    await db.update(certificateSettings).set({ ...data, updatedByOpenId: actorOpenId });
  }
  return getCertificateSettings();
}

// ─── Security Settings ────────────────────────────────────────────────────

export async function getSecuritySettings() {
  const db = await requireDb();
  const rows = await db.select().from(securitySettings).limit(1);
  if (rows.length === 0) {
    return {
      id: 0,
      qrPublicAccess: 1,
      qrRequireAuth: 0,
      allowDeleteBlinds: 0,
      allowDeleteProjects: 0,
      requireDeleteConfirmation: 1,
      auditTrailEnabled: 1,
      auditRetentionDays: 90,
      sessionTimeoutMinutes: 480,
      maxLoginAttempts: 5,
      lockoutDurationMinutes: 15,
      requireStrongPassword: 1,
      minPasswordLength: 12,
      updatedByOpenId: null as string | null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
  return rows[0];
}

export async function upsertSecuritySettings(
  data: Partial<Omit<typeof securitySettings.$inferInsert, "id" | "createdAt" | "updatedAt">>,
  actorOpenId: string,
) {
  const db = await requireDb();
  const existing = await db.select({ id: securitySettings.id }).from(securitySettings).limit(1);
  if (existing.length === 0) {
    await db.insert(securitySettings).values({ ...data, updatedByOpenId: actorOpenId });
  } else {
    await db.update(securitySettings).set({ ...data, updatedByOpenId: actorOpenId });
  }
  return getSecuritySettings();
}

// ─── Notification Preferences ─────────────────────────────────────────────

export async function getNotificationPreferences() {
  const db = await requireDb();
  const rows = await db.select().from(notificationPreferences).limit(1);
  if (rows.length === 0) {
    return {
      id: 0,
      registrationRequest: 1,
      registrationApproved: 1,
      registrationRejected: 1,
      blindPhaseChanged: 1,
      blindPhaseApproval: 1,
      blindAssigned: 1,
      projectCreated: 1,
      projectStatusChanged: 1,
      phaseOwnerAssigned: 1,
      workflowUpdated: 1,
      workflowTransition: 1,
      workflowGateBlocked: 1,
      workflowApprovalRequired: 1,
      safetyHoldPlaced: 1,
      safetyHoldReleased: 1,
      systemAnnouncement: 1,
      updatedByOpenId: null as string | null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
  return rows[0];
}

export async function upsertNotificationPreferences(
  data: Partial<Omit<typeof notificationPreferences.$inferInsert, "id" | "createdAt" | "updatedAt">>,
  actorOpenId: string,
) {
  const db = await requireDb();
  const existing = await db.select({ id: notificationPreferences.id }).from(notificationPreferences).limit(1);
  if (existing.length === 0) {
    await db.insert(notificationPreferences).values({ ...data, updatedByOpenId: actorOpenId });
  } else {
    await db.update(notificationPreferences).set({ ...data, updatedByOpenId: actorOpenId });
  }
  return getNotificationPreferences();
}


// ─── Workflow & Safety Policy Settings ───────────────────────────────────

export async function getWorkflowPolicySettings() {
  const db = await requireDb();
  const rows = await db.select().from(workflowPolicySettings).limit(1);
  if (rows.length > 0) return rows[0];
  return {
    id: 0,
    activeWorkflowTemplateId: "wf-sbts-standard-v2",
    enforceServerGates: 1,
    requireIndependentVerifier: 1,
    requirePtwActive: 1,
    requireLotoActive: 1,
    requireGasTestForEntry: 1,
    requireGasTestForDeBlinding: 1,
    defaultGasTestValidityMinutes: 240,
    gasTestExpiryWarningMinutes: 30,
    safetyHoldEnabled: 1,
    holdReleaseRequiresIndependentApproval: 1,
    metalForemanRequiredForSlipBlind: 1,
    operationsForemanFinalApprover: 1,
    certificateRequiresLeakTest: 1,
    allowPhaseReopen: 1,
    phaseReopenRequiresApproval: 1,
    showBlockingReasons: 1,
    enableFieldMode: 1,
    requireIsolationPackageForEntry: 1,
    requireLineBreakingPermit: 1,
    requireGasTestForLineBreaking: 0,
    requireTorqueCalibration: 1,
    requireInstallationTorque: 1,
    requireReinstatementTorque: 1,
    requireSequentialFinalApprovals: 1,
    requireLotoReleasedForCloseout: 1,
    blockTransitionWhenPermitExpired: 1,
    allowAdminWorkflowOverride: 0,
    showGateReadinessPanel: 1,
    showLegacyPhaseReference: 0,
    workflowUiDensity: "comfortable",
    safetyBannerMode: "prominent",
    authorizedGasTesterRoleKey: "gasTester",
    gasTestRequiresInstrumentCalibration: 1,
    gasTestLimitsConfigured: 0,
    gasTestOxygenMinPercent: null as string | null,
    gasTestOxygenMaxPercent: null as string | null,
    gasTestMaxLelPercent: null as string | null,
    gasTestMaxH2sPpm: null as string | null,
    gasTestMaxCoPpm: null as string | null,
    entryReadinessValidityMinutes: 720,
    isolationPackageIdPrefix: "VIP",
    preventBlindInMultipleActivePackages: 1,
    requireEvidenceBeforePhaseSubmit: 0,
    evidenceMaxFileSizeMb: 10,
    evidenceAllowedMimeTypesJson: JSON.stringify(["image/jpeg", "image/png", "image/webp", "application/pdf"]),
    defaultTorqueUnit: "N·m",
    defaultPumpPressureUnit: "psi",
    fieldRecordEditorMode: "dialog",
    certificateNumberPrefix: "CERT",
    certificateVerificationEnabled: 1,
    certificateRequireClosedWorkflow: 1,
    certificateReissueRequiresReason: 1,
    certificateAllowRevocation: 1,
    certificatePublicBaseUrl: null as string | null,
    defectNumberPrefix: "DEF",
    punchNumberPrefix: "PCH",
    ndtNumberPrefix: "NDT",
    requireDefectDispositionBeforeClosure: 1,
    requireMandatoryPunchClosureBeforeReadyForClosure: 1,
    requireNdtAcceptanceBeforeReadyForClosure: 1,
    allowPunchTransfer: 1,
    updatedByOpenId: null as string | null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export async function upsertWorkflowPolicySettings(
  data: Partial<Omit<typeof workflowPolicySettings.$inferInsert, "id" | "createdAt" | "updatedAt">>,
  actorOpenId: string,
) {
  const db = await requireDb();
  const existing = await db.select({ id: workflowPolicySettings.id }).from(workflowPolicySettings).limit(1);
  if (existing.length === 0) {
    await db.insert(workflowPolicySettings).values({ ...data, updatedByOpenId: actorOpenId });
  } else {
    await db.update(workflowPolicySettings).set({ ...data, updatedByOpenId: actorOpenId });
  }
  return getWorkflowPolicySettings();
}
