/**
 * server/routers/featureToggles.ts
 * ─────────────────────────────────
 * Feature Toggles — التحكم بالخصائص من الإعدادات.
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getFeatureToggles, updateFeatureToggles } from "../db";

export const featureTogglesRouter = router({
  /** Get current feature toggles */
  get: protectedProcedure.query(async () => {
    return getFeatureToggles();
  }),

  /** Update feature toggles (admin only) */
  update: protectedProcedure
    .input(
      z.object({
        enableWorkflowTab: z.number().min(0).max(1).optional(),
        enableComplianceTab: z.number().min(0).max(1).optional(),
        enableFieldActionsTab: z.number().min(0).max(1).optional(),
        enableQrMobileTab: z.number().min(0).max(1).optional(),
        enableHistoryTab: z.number().min(0).max(1).optional(),
        enableSafetyChecklists: z.number().min(0).max(1).optional(),
        enableTorqueRecords: z.number().min(0).max(1).optional(),
        enableInspectionRecords: z.number().min(0).max(1).optional(),
        enablePhotoEvidence: z.number().min(0).max(1).optional(),
        enablePtw: z.number().min(0).max(1).optional(),
        enableLoto: z.number().min(0).max(1).optional(),
        enableRiskAssessment: z.number().min(0).max(1).optional(),
        enableFieldNotes: z.number().min(0).max(1).optional(),
        enableQrGeneration: z.number().min(0).max(1).optional(),
        enableMobileVerification: z.number().min(0).max(1).optional(),
        enableOfflineAccess: z.number().min(0).max(1).optional(),
        enableSlipBlindSurveys: z.number().min(0).max(1).optional(),
        enableCertificates: z.number().min(0).max(1).optional(),
        enableExpiryTracking: z.number().min(0).max(1).optional(),
        enableProgressRing: z.number().min(0).max(1).optional(),
        enableQuickActions: z.number().min(0).max(1).optional(),
        enableBreadcrumb: z.number().min(0).max(1).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new Error("Only admins can update feature toggles");
      }
      return updateFeatureToggles(input, ctx.user.openId);
    }),
});
