/**
 * server/routers/settings.ts
 * ──────────────────────────
 * Procedures for system settings, default tag settings, certificate settings,
 * security settings, and notification preferences.
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "../_core/trpc";
import {
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
} from "../db";
import { storagePut } from "../storage";
import {
  sanitizeTagLayout,
  sanitizeTagTemplateSlots,
} from "../../shared/tagLayout";

function parseSettingsJson(value: string, label: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `${label} must contain valid JSON.`,
    });
  }
}

export const settingsRouter = router({
  appearance: router({
    get: publicProcedure.query(async () => {
      const settings = await getSystemSettings();
      return {
        appName: settings.appName,
        companyName: settings.companyName,
        companyLogoUrl: settings.companyLogoUrl,
        defaultTheme: settings.defaultTheme as "standard" | "modern" | "manus",
        allowUserThemeOverride: settings.allowUserThemeOverride === 1,
      };
    }),
  }),
  workflowPolicy: router({
    get: protectedProcedure.query(async () => getWorkflowPolicySettings()),
    update: adminProcedure.input(z.object({
      activeWorkflowTemplateId: z.string().trim().min(1).max(96).optional(),
      enforceServerGates: z.boolean().optional(),
      requireIndependentVerifier: z.boolean().optional(),
      requirePtwActive: z.boolean().optional(),
      requireLotoActive: z.boolean().optional(),
      requireGasTestForEntry: z.boolean().optional(),
      requireGasTestForDeBlinding: z.boolean().optional(),
      defaultGasTestValidityMinutes: z.number().int().min(5).max(1440).optional(),
      gasTestExpiryWarningMinutes: z.number().int().min(1).max(240).optional(),
      safetyHoldEnabled: z.boolean().optional(),
      holdReleaseRequiresIndependentApproval: z.boolean().optional(),
      metalForemanRequiredForSlipBlind: z.boolean().optional(),
      operationsForemanFinalApprover: z.boolean().optional(),
      certificateRequiresLeakTest: z.boolean().optional(),
      allowPhaseReopen: z.boolean().optional(),
      phaseReopenRequiresApproval: z.boolean().optional(),
      showBlockingReasons: z.boolean().optional(),
      enableFieldMode: z.boolean().optional(),
      requireIsolationPackageForEntry: z.boolean().optional(),
      requireLineBreakingPermit: z.boolean().optional(),
      requireGasTestForLineBreaking: z.boolean().optional(),
      requireTorqueCalibration: z.boolean().optional(),
      requireInstallationTorque: z.boolean().optional(),
      requireReinstatementTorque: z.boolean().optional(),
      requireSequentialFinalApprovals: z.boolean().optional(),
      requireLotoReleasedForCloseout: z.boolean().optional(),
      blockTransitionWhenPermitExpired: z.boolean().optional(),
      allowAdminWorkflowOverride: z.boolean().optional(),
      showGateReadinessPanel: z.boolean().optional(),
      showLegacyPhaseReference: z.boolean().optional(),
      workflowUiDensity: z.enum(["comfortable", "compact"]).optional(),
      safetyBannerMode: z.enum(["prominent", "standard", "compact"]).optional(),
      authorizedGasTesterRoleKey: z.string().trim().min(1).max(80).optional(),
      gasTestRequiresInstrumentCalibration: z.boolean().optional(),
      gasTestLimitsConfigured: z.boolean().optional(),
      gasTestOxygenMinPercent: z.number().min(0).max(100).nullable().optional(),
      gasTestOxygenMaxPercent: z.number().min(0).max(100).nullable().optional(),
      gasTestMaxLelPercent: z.number().min(0).max(100).nullable().optional(),
      gasTestMaxH2sPpm: z.number().min(0).nullable().optional(),
      gasTestMaxCoPpm: z.number().min(0).nullable().optional(),
      entryReadinessValidityMinutes: z.number().int().min(15).max(2880).optional(),
      isolationPackageIdPrefix: z.string().trim().min(1).max(20).regex(/^[A-Za-z0-9_-]+$/).optional(),
      preventBlindInMultipleActivePackages: z.boolean().optional(),
      requireEvidenceBeforePhaseSubmit: z.boolean().optional(),
      evidenceMaxFileSizeMb: z.number().int().min(1).max(50).optional(),
      evidenceAllowedMimeTypesJson: z.string().trim().min(2).max(2000).optional(),
      defaultTorqueUnit: z.enum(["N·m", "ft·lbf"]).optional(),
      defaultPumpPressureUnit: z.enum(["psi", "bar"]).optional(),
      fieldRecordEditorMode: z.enum(["dialog", "inline"]).optional(),
      certificateNumberPrefix: z.string().trim().min(1).max(20).regex(/^[A-Za-z0-9_-]+$/).optional(),
      certificateVerificationEnabled: z.boolean().optional(),
      certificateRequireClosedWorkflow: z.boolean().optional(),
      certificateReissueRequiresReason: z.boolean().optional(),
      certificateAllowRevocation: z.boolean().optional(),
      certificatePublicBaseUrl: z.string().trim().url().max(500).nullable().optional(),
      defectNumberPrefix: z.string().trim().min(1).max(20).regex(/^[A-Za-z0-9_-]+$/).optional(),
      punchNumberPrefix: z.string().trim().min(1).max(20).regex(/^[A-Za-z0-9_-]+$/).optional(),
      ndtNumberPrefix: z.string().trim().min(1).max(20).regex(/^[A-Za-z0-9_-]+$/).optional(),
      requireDefectDispositionBeforeClosure: z.boolean().optional(),
      requireMandatoryPunchClosureBeforeReadyForClosure: z.boolean().optional(),
      requireNdtAcceptanceBeforeReadyForClosure: z.boolean().optional(),
      allowPunchTransfer: z.boolean().optional(),
    })).mutation(async ({ input, ctx }) => {
      if (input.activeWorkflowTemplateId && input.activeWorkflowTemplateId !== "wf-sbts-standard-v2") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Sprint 2 runtime supports the SBTS Standard 8-Phase Isolation Lifecycle only. Additional runtime-compatible templates require a versioned workflow adapter.",
        });
      }
      if (input.evidenceAllowedMimeTypesJson !== undefined) {
        try {
          const parsed = JSON.parse(input.evidenceAllowedMimeTypesJson);
          if (!Array.isArray(parsed) || parsed.length === 0 || parsed.some((item) => typeof item !== "string" || !item.includes("/"))) {
            throw new Error("invalid");
          }
        } catch {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Allowed evidence MIME types must be a non-empty JSON array of MIME type strings." });
        }
      }
      if (input.gasTestLimitsConfigured) {
        if (input.gasTestOxygenMinPercent == null || input.gasTestOxygenMaxPercent == null || input.gasTestMaxLelPercent == null) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Oxygen minimum, oxygen maximum, and maximum LEL are required before gas-test limits can be marked configured." });
        }
        if (input.gasTestOxygenMinPercent >= input.gasTestOxygenMaxPercent) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Gas-test oxygen minimum must be lower than the oxygen maximum." });
        }
      }
      const decimalGasLimitKeys = new Set([
        "gasTestOxygenMinPercent",
        "gasTestOxygenMaxPercent",
        "gasTestMaxLelPercent",
        "gasTestMaxH2sPpm",
        "gasTestMaxCoPpm",
      ]);
      const data = Object.fromEntries(Object.entries(input).map(([key, value]) => [
        key,
        typeof value === "boolean" ? (value ? 1 : 0) : typeof value === "number" && decimalGasLimitKeys.has(key) ? String(value) : value,
      ]));
      return upsertWorkflowPolicySettings(data as Parameters<typeof upsertWorkflowPolicySettings>[0], ctx.user.openId);
    }),
  }),
  general: router({
    get: protectedProcedure.query(async () => getSystemSettings()),

    update: adminProcedure.input(z.object({
      companyName: z.string().trim().min(1).max(200).optional(),
      companyCode: z.string().trim().min(1).max(40).optional(),
      plantName: z.string().trim().min(1).max(200).optional(),
      contractNumber: z.string().trim().max(100).nullable().optional(),
      language: z.enum(["en", "ar"]).optional(),
      timezone: z.string().trim().min(1).max(80).optional(),
      dateFormat: z.string().trim().min(1).max(40).optional(),
      defaultTheme: z.enum(["standard", "modern", "manus"]).optional(),
      allowUserThemeOverride: z.boolean().optional(),
      emailNotifications: z.boolean().optional(),
      phaseChangeAlerts: z.boolean().optional(),
      criticalPriorityAlerts: z.boolean().optional(),
      maintenanceMode: z.boolean().optional(),
      // New fields
      appName: z.string().trim().min(1).max(200).optional(),
      appDescription: z.string().trim().max(1000).nullable().optional(),
      appImageUrl: z.string().trim().nullable().optional(),
      companyLogoUrl: z.string().trim().nullable().optional(),
      companyDescription: z.string().trim().max(2000).nullable().optional(),
      regionName: z.string().trim().max(200).optional(),
      dashboardHeroTitle: z.string().trim().max(500).optional(),
      dashboardHeroDescription: z.string().trim().max(2000).nullable().optional(),
      dashboardHeroBadge: z.string().trim().max(200).optional(),
      dashboardHeroImageUrl: z.string().trim().nullable().optional(),
      dashboardCtaButtons: z.string().trim().nullable().optional(), // JSON string
      versionName: z.string().trim().max(100).optional(),
      versionDate: z.string().trim().max(40).nullable().optional(),
    })).mutation(async ({ input, ctx }) => {
      const data: Record<string, unknown> = {};
      // Original fields
      if (input.companyName !== undefined) data.companyName = input.companyName;
      if (input.companyCode !== undefined) data.companyCode = input.companyCode;
      if (input.plantName !== undefined) data.plantName = input.plantName;
      if (input.contractNumber !== undefined) data.contractNumber = input.contractNumber;
      if (input.language !== undefined) data.language = input.language;
      if (input.timezone !== undefined) data.timezone = input.timezone;
      if (input.dateFormat !== undefined) data.dateFormat = input.dateFormat;
      if (input.defaultTheme !== undefined) data.defaultTheme = input.defaultTheme;
      if (input.allowUserThemeOverride !== undefined) data.allowUserThemeOverride = input.allowUserThemeOverride ? 1 : 0;
      if (input.emailNotifications !== undefined) data.emailNotifications = input.emailNotifications ? 1 : 0;
      if (input.phaseChangeAlerts !== undefined) data.phaseChangeAlerts = input.phaseChangeAlerts ? 1 : 0;
      if (input.criticalPriorityAlerts !== undefined) data.criticalPriorityAlerts = input.criticalPriorityAlerts ? 1 : 0;
      if (input.maintenanceMode !== undefined) data.maintenanceMode = input.maintenanceMode ? 1 : 0;
      // New fields
      if (input.appName !== undefined) data.appName = input.appName;
      if (input.appDescription !== undefined) data.appDescription = input.appDescription;
      if (input.appImageUrl !== undefined) data.appImageUrl = input.appImageUrl;
      if (input.companyLogoUrl !== undefined) data.companyLogoUrl = input.companyLogoUrl;
      if (input.companyDescription !== undefined) data.companyDescription = input.companyDescription;
      if (input.regionName !== undefined) data.regionName = input.regionName;
      if (input.dashboardHeroTitle !== undefined) data.dashboardHeroTitle = input.dashboardHeroTitle;
      if (input.dashboardHeroDescription !== undefined) data.dashboardHeroDescription = input.dashboardHeroDescription;
      if (input.dashboardHeroBadge !== undefined) data.dashboardHeroBadge = input.dashboardHeroBadge;
      if (input.dashboardHeroImageUrl !== undefined) data.dashboardHeroImageUrl = input.dashboardHeroImageUrl;
      if (input.dashboardCtaButtons !== undefined) data.dashboardCtaButtons = input.dashboardCtaButtons;
      if (input.versionName !== undefined) data.versionName = input.versionName;
      if (input.versionDate !== undefined) data.versionDate = input.versionDate;
      return upsertSystemSettings(data, ctx.user.openId);
    }),

    uploadImage: adminProcedure.input(z.object({
      base64: z.string().min(1),
      mimeType: z.enum(["image/png", "image/jpeg", "image/jpg", "image/svg+xml", "image/webp"]),
      target: z.enum(["appImage", "companyLogo", "heroImage"]),
    })).mutation(async ({ input, ctx }) => {
      const buffer = Buffer.from(input.base64, "base64");
      if (buffer.byteLength > 2 * 1024 * 1024) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "File must be under 2MB" });
      }
      const ext = input.mimeType === "image/svg+xml" ? "svg" : input.mimeType.split("/")[1];
      const key = `settings/${input.target}_${Date.now()}.${ext}`;
      const { url } = await storagePut(key, buffer, input.mimeType);
      const fieldMap = { appImage: "appImageUrl", companyLogo: "companyLogoUrl", heroImage: "dashboardHeroImageUrl" };
      await upsertSystemSettings({ [fieldMap[input.target]]: url }, ctx.user.openId);
      return { url };
    }),
  }),

  defaultTag: router({
    get: protectedProcedure.query(async () => getDefaultTagSettings()),

    update: adminProcedure.input(z.object({
      tagPrefix: z.string().trim().min(1).max(20).optional(),
      tagSeparator: z.string().trim().max(5).optional(),
      tagPaddingDigits: z.number().int().min(1).max(6).optional(),
      tagStartNumber: z.number().int().min(1).optional(),
      defaultType: z.string().trim().min(1).max(120).optional(),
      defaultSize: z.string().trim().min(1).max(60).optional(),
      defaultRate: z.string().trim().max(60).optional(),
      defaultPriority: z.enum(["Low", "Normal", "High", "Critical"]).optional(),
      defaultPhase: z.enum(["Broken / Preparation", "Assembly", "Tight & Torque", "Final Tight", "Inspection Ready"]).optional(),
      autoGenerateTag: z.boolean().optional(),
      requireEquipment: z.boolean().optional(),
      requireLocation: z.boolean().optional(),
      requireIsolationPoint: z.boolean().optional(),
      // Visual settings
      tagColor: z.string().trim().max(20).optional(),
      tagWidth: z.number().int().min(40).max(200).optional(),
      tagHeight: z.number().int().min(30).max(150).optional(),
      tagFontSize: z.number().int().min(8).max(32).optional(),
      tagFontColor: z.string().trim().max(20).optional(),
      tagTheme: z.string().trim().max(40).optional(),
      tagShowLogo: z.boolean().optional(),
      tagShowQR: z.boolean().optional(),
      tagHoleEnabled: z.boolean().optional(),
      tagHolePosition: z.string().trim().max(20).optional(),
      layoutJson: z.string().max(100_000).nullable().optional(),
      templateSlotsJson: z.string().max(300_000).nullable().optional(),
    })).mutation(async ({ input, ctx }) => {
      const data: Record<string, unknown> = {};
      if (input.tagPrefix !== undefined) data.tagPrefix = input.tagPrefix;
      if (input.tagSeparator !== undefined) data.tagSeparator = input.tagSeparator;
      if (input.tagPaddingDigits !== undefined) data.tagPaddingDigits = input.tagPaddingDigits;
      if (input.tagStartNumber !== undefined) data.tagStartNumber = input.tagStartNumber;
      if (input.defaultType !== undefined) data.defaultType = input.defaultType;
      if (input.defaultSize !== undefined) data.defaultSize = input.defaultSize;
      if (input.defaultRate !== undefined) data.defaultRate = input.defaultRate;
      if (input.defaultPriority !== undefined) data.defaultPriority = input.defaultPriority;
      if (input.defaultPhase !== undefined) data.defaultPhase = input.defaultPhase;
      if (input.autoGenerateTag !== undefined) data.autoGenerateTag = input.autoGenerateTag ? 1 : 0;
      if (input.requireEquipment !== undefined) data.requireEquipment = input.requireEquipment ? 1 : 0;
      if (input.requireLocation !== undefined) data.requireLocation = input.requireLocation ? 1 : 0;
      if (input.requireIsolationPoint !== undefined) data.requireIsolationPoint = input.requireIsolationPoint ? 1 : 0;
      // Visual settings
      if (input.tagColor !== undefined) data.tagColor = input.tagColor;
      if (input.tagWidth !== undefined) data.tagWidth = input.tagWidth;
      if (input.tagHeight !== undefined) data.tagHeight = input.tagHeight;
      if (input.tagFontSize !== undefined) data.tagFontSize = input.tagFontSize;
      if (input.tagFontColor !== undefined) data.tagFontColor = input.tagFontColor;
      if (input.tagTheme !== undefined) data.tagTheme = input.tagTheme;
      if (input.tagShowLogo !== undefined) data.tagShowLogo = input.tagShowLogo ? 1 : 0;
      if (input.tagShowQR !== undefined) data.tagShowQR = input.tagShowQR ? 1 : 0;
      if (input.tagHoleEnabled !== undefined) data.tagHoleEnabled = input.tagHoleEnabled ? 1 : 0;
      if (input.tagHolePosition !== undefined) data.tagHolePosition = input.tagHolePosition;
      if (input.layoutJson !== undefined) {
        data.layoutJson = input.layoutJson === null
          ? null
          : JSON.stringify(
              sanitizeTagLayout(parseSettingsJson(input.layoutJson, "Tag layout"), {
                widthMm: input.tagWidth,
                heightMm: input.tagHeight,
              })
            );
      }
      if (input.templateSlotsJson !== undefined) {
        data.templateSlotsJson = input.templateSlotsJson === null
          ? null
          : JSON.stringify(
              sanitizeTagTemplateSlots(
                parseSettingsJson(input.templateSlotsJson, "Tag templates")
              )
            );
      }
      return upsertDefaultTagSettings(data, ctx.user.openId);
    }),
  }),

  certificate: router({
    get: protectedProcedure.query(async () => getCertificateSettings()),

    uploadLogo: adminProcedure.input(z.object({
      base64: z.string().min(1),
      mimeType: z.enum(["image/png", "image/jpeg", "image/jpg", "image/svg+xml", "image/webp"]),
      fileName: z.string().max(200),
    })).mutation(async ({ input, ctx }) => {
      const buffer = Buffer.from(input.base64, "base64");
      if (buffer.byteLength > 2 * 1024 * 1024) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Logo file must be under 2MB" });
      }
      const ext = input.mimeType === "image/svg+xml" ? "svg" : input.mimeType.split("/")[1];
      const key = `logos/certificate-logo_${Date.now()}.${ext}`;
      const { url } = await storagePut(key, buffer, input.mimeType);
      await upsertCertificateSettings({ logoUrl: url }, ctx.user.openId);
      return { url };
    }),

    removeLogo: adminProcedure.mutation(async ({ ctx }) => {
      await upsertCertificateSettings({ logoUrl: null }, ctx.user.openId);
      return { success: true };
    }),

    update: adminProcedure.input(z.object({
      certificateTitle: z.string().trim().min(1).max(200).optional(),
      headerCompanyName: z.string().trim().min(1).max(200).optional(),
      headerSubtitle: z.string().trim().max(300).optional(),
      logoUrl: z.string().trim().nullable().optional(),
      signature1Label: z.string().trim().min(1).max(100).optional(),
      signature1Name: z.string().trim().max(160).nullable().optional(),
      signature1Title: z.string().trim().max(160).nullable().optional(),
      signature2Label: z.string().trim().min(1).max(100).optional(),
      signature2Name: z.string().trim().max(160).nullable().optional(),
      signature2Title: z.string().trim().max(160).nullable().optional(),
      signature3Label: z.string().trim().min(1).max(100).optional(),
      signature3Name: z.string().trim().max(160).nullable().optional(),
      signature3Title: z.string().trim().max(160).nullable().optional(),
      footerText: z.string().trim().max(500).nullable().optional(),
      showPageNumbers: z.boolean().optional(),
      showGenerationDate: z.boolean().optional(),
      showSystemVersion: z.boolean().optional(),
      paperSize: z.enum(["A4", "A3", "Letter", "Legal"]).optional(),
      orientation: z.enum(["portrait", "landscape"]).optional(),
      // Section visibility
      showWorkflowLog: z.boolean().optional(),
      showExecutionTorque: z.boolean().optional(),
      showFinalApprovals: z.boolean().optional(),
      showBlindInfo: z.boolean().optional(),
      showProjectInfo: z.boolean().optional(),
      showQrCode: z.boolean().optional(),
      showLockStatus: z.boolean().optional(),
      showAreaInfo: z.boolean().optional(),
      statusBadgeText: z.string().trim().max(40).optional(),
      lockBadgeText: z.string().trim().max(40).optional(),
    })).mutation(async ({ input, ctx }) => {
      const data: Record<string, unknown> = { ...input };
      // Convert booleans to int
      const boolFields = ["showPageNumbers", "showGenerationDate", "showSystemVersion", "showWorkflowLog", "showExecutionTorque", "showFinalApprovals", "showBlindInfo", "showProjectInfo", "showQrCode", "showLockStatus", "showAreaInfo"] as const;
      for (const field of boolFields) {
        if (input[field] !== undefined) data[field] = input[field] ? 1 : 0;
      }
      return upsertCertificateSettings(data, ctx.user.openId);
    }),
  }),

  security: router({
    get: protectedProcedure.query(async () => getSecuritySettings()),

    update: adminProcedure.input(z.object({
      qrPublicAccess: z.boolean().optional(),
      qrRequireAuth: z.boolean().optional(),
      allowDeleteBlinds: z.boolean().optional(),
      allowDeleteProjects: z.boolean().optional(),
      requireDeleteConfirmation: z.boolean().optional(),
      auditTrailEnabled: z.boolean().optional(),
      auditRetentionDays: z.number().int().min(7).max(365).optional(),
      sessionTimeoutMinutes: z.number().int().min(15).max(1440).optional(),
      maxLoginAttempts: z.number().int().min(3).max(20).optional(),
      lockoutDurationMinutes: z.number().int().min(5).max(60).optional(),
      requireStrongPassword: z.boolean().optional(),
      minPasswordLength: z.number().int().min(8).max(64).optional(),
    })).mutation(async ({ input, ctx }) => {
      const data: Record<string, unknown> = {};
      const boolFields = ["qrPublicAccess", "qrRequireAuth", "allowDeleteBlinds", "allowDeleteProjects", "requireDeleteConfirmation", "auditTrailEnabled", "requireStrongPassword"] as const;
      for (const field of boolFields) {
        if (input[field] !== undefined) data[field] = input[field] ? 1 : 0;
      }
      const numFields = ["auditRetentionDays", "sessionTimeoutMinutes", "maxLoginAttempts", "lockoutDurationMinutes", "minPasswordLength"] as const;
      for (const field of numFields) {
        if (input[field] !== undefined) data[field] = input[field];
      }
      return upsertSecuritySettings(data, ctx.user.openId);
    }),
  }),

  notifications: router({
    get: protectedProcedure.query(async () => getNotificationPreferences()),

    update: adminProcedure.input(z.object({
      registrationRequest: z.boolean().optional(),
      registrationApproved: z.boolean().optional(),
      registrationRejected: z.boolean().optional(),
      blindPhaseChanged: z.boolean().optional(),
      blindPhaseApproval: z.boolean().optional(),
      blindAssigned: z.boolean().optional(),
      projectCreated: z.boolean().optional(),
      projectStatusChanged: z.boolean().optional(),
      phaseOwnerAssigned: z.boolean().optional(),
      workflowUpdated: z.boolean().optional(),
      workflowTransition: z.boolean().optional(),
      workflowGateBlocked: z.boolean().optional(),
      workflowApprovalRequired: z.boolean().optional(),
      safetyHoldPlaced: z.boolean().optional(),
      safetyHoldReleased: z.boolean().optional(),
      qrTokenChanged: z.boolean().optional(),
      certificateStatusChanged: z.boolean().optional(),
      tagPrintRequested: z.boolean().optional(),
      systemAnnouncement: z.boolean().optional(),
    })).mutation(async ({ input, ctx }) => {
      const data = Object.fromEntries(
        Object.entries(input)
          .filter(([, value]) => value !== undefined)
          .map(([field, value]) => [field, value ? 1 : 0]),
      );
      return upsertNotificationPreferences(
        data as Parameters<typeof upsertNotificationPreferences>[0],
        ctx.user.openId,
      );
    }),
  }),
});
