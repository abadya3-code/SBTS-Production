import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
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
  getBlindWorkflowRuntimeView,
  placeWorkflowSafetyHold,
  recordWorkflowApproval,
  releaseWorkflowSafetyHold,
  transitionBlindWorkflow,
  updateWorkflowChecklistItem,
  upsertEntryReadinessRecord,
  getWorkflowPolicySettings,
  getBlindInspectionActivities,
  listInspectionActivityTemplates,
  upsertBlindInspectionActivity,
  upsertInspectionActivityTemplate,
  getQualityRecords,
  upsertDefectNotification,
  upsertPunchItem,
  upsertNdtRecord,
} from "../db";
import { storagePut } from "../storage";

const phaseKeySchema = z.enum([
  "operationsInitialIsolation",
  "blindInstallation",
  "mechanicalVerification",
  "internalInspection",
  "reinstatementPreparation",
  "blindRemovalReinstatement",
  "reinstatementVerification",
  "finalApprovalReturnToService",
]);

const actionKeySchema = z.enum([
  "completeInitialIsolation",
  "submitInstallationRecord",
  "approveMechanicalVerification",
  "declareReadyForClosure",
  "authorizeBlindRemoval",
  "submitReinstatementRecord",
  "approveReinstatement",
  "authorizeReturnToService",
]);

const recordStatusSchema = z.enum(["draft", "active", "valid", "expired", "closed", "cancelled", "rejected"]);
const actingUser = (user: { openId: string; name?: string | null; email?: string | null; role: "user" | "admin" }) => ({
  openId: user.openId,
  name: user.name ?? null,
  email: user.email ?? null,
  role: user.role,
});

function mapRuntimeError(error: unknown): never {
  const message = error instanceof Error ? error.message : "Workflow runtime operation failed.";
  if (message.includes("not found")) throw new TRPCError({ code: "NOT_FOUND", message });
  if (message.includes("Permission") || message.includes("must hold role")) throw new TRPCError({ code: "FORBIDDEN", message });
  if (message.includes("updated by another user")) throw new TRPCError({ code: "CONFLICT", message });
  throw new TRPCError({ code: "BAD_REQUEST", message });
}

export const workflowRuntimeRouter = router({
  state: protectedProcedure.input(z.object({
    projectId: z.string().min(2).max(40),
    blindTag: z.string().min(2).max(40),
  })).query(async ({ input, ctx }) => {
    try {
      return await getBlindWorkflowRuntimeView(input.projectId, input.blindTag, actingUser(ctx.user));
    } catch (error) {
      mapRuntimeError(error);
    }
  }),

  checklist: router({
    update: protectedProcedure.input(z.object({
      projectId: z.string().min(2).max(40),
      blindTag: z.string().min(2).max(40),
      phaseKey: phaseKeySchema,
      itemKey: z.string().min(1).max(160),
      completed: z.boolean(),
      response: z.unknown().optional(),
    })).mutation(async ({ input, ctx }) => {
      try {
        return await updateWorkflowChecklistItem(input, actingUser(ctx.user));
      } catch (error) {
        mapRuntimeError(error);
      }
    }),
  }),

  transition: protectedProcedure.input(z.object({
    projectId: z.string().min(2).max(40),
    blindTag: z.string().min(2).max(40),
    actionKey: actionKeySchema,
    expectedRecordVersion: z.number().int().positive(),
    reason: z.string().trim().max(1000).nullable().optional(),
    override: z.boolean().optional(),
  })).mutation(async ({ input, ctx }) => {
    try {
      return await transitionBlindWorkflow(input, actingUser(ctx.user));
    } catch (error) {
      mapRuntimeError(error);
    }
  }),

  permit: router({
    save: protectedProcedure.input(z.object({
      id: z.number().int().positive().optional(),
      projectId: z.string().min(2).max(40),
      blindTag: z.string().min(2).max(40),
      permitType: z.string().trim().min(2).max(60),
      permitNumber: z.string().trim().min(1).max(120),
      status: recordStatusSchema,
      validFrom: z.coerce.date().nullable().optional(),
      validUntil: z.coerce.date().nullable().optional(),
      notes: z.string().trim().max(1000).nullable().optional(),
    })).mutation(async ({ input, ctx }) => {
      try { return await createOrUpdatePermitRecord(input, actingUser(ctx.user)); }
      catch (error) { mapRuntimeError(error); }
    }),
  }),

  loto: router({
    save: protectedProcedure.input(z.object({
      id: z.number().int().positive().optional(),
      projectId: z.string().min(2).max(40),
      blindTag: z.string().min(2).max(40),
      certificateNumber: z.string().trim().min(1).max(120),
      status: recordStatusSchema,
      lockNumbers: z.array(z.string().trim().min(1).max(80)).max(100),
      zeroEnergyVerified: z.boolean(),
      releasedAt: z.coerce.date().nullable().optional(),
      notes: z.string().trim().max(1000).nullable().optional(),
    })).mutation(async ({ input, ctx }) => {
      try { return await createOrUpdateLotoRecord(input, actingUser(ctx.user)); }
      catch (error) { mapRuntimeError(error); }
    }),
  }),

  gasTest: router({
    create: protectedProcedure.input(z.object({
      projectId: z.string().min(2).max(40),
      blindTag: z.string().min(2).max(40),
      testPurpose: z.enum(["lineBreaking", "entry", "deblinding", "other"]),
      status: recordStatusSchema,
      oxygenPercent: z.number().min(0).max(100).nullable().optional(),
      lelPercent: z.number().min(0).max(100).nullable().optional(),
      h2sPpm: z.number().min(0).nullable().optional(),
      coPpm: z.number().min(0).nullable().optional(),
      instrumentId: z.string().trim().max(120).nullable().optional(),
      calibrationExpiry: z.coerce.date().nullable().optional(),
      testedAt: z.coerce.date().nullable().optional(),
      validUntil: z.coerce.date().nullable().optional(),
      notes: z.string().trim().max(1000).nullable().optional(),
    })).mutation(async ({ input, ctx }) => {
      try { return await createGasTestRecord(input, actingUser(ctx.user)); }
      catch (error) { mapRuntimeError(error); }
    }),
  }),

  torque: router({
    save: protectedProcedure.input(z.object({
      id: z.number().int().positive().optional(),
      projectId: z.string().min(2).max(40),
      blindTag: z.string().min(2).max(40),
      stage: z.enum(["installation", "reinstatement"]),
      status: z.enum(["draft", "submitted", "accepted", "rejected"]),
      procedureReference: z.string().trim().max(160).nullable().optional(),
      toolType: z.string().trim().min(1).max(120),
      toolSerialNumber: z.string().trim().max(120).nullable().optional(),
      calibrationCertificateNumber: z.string().trim().max(120).nullable().optional(),
      calibrationExpiry: z.coerce.date().nullable().optional(),
      targetTorque: z.number().nonnegative().nullable().optional(),
      actualTorque: z.number().nonnegative().nullable().optional(),
      torqueUnit: z.string().trim().min(1).max(20),
      pumpPressure: z.number().nonnegative().nullable().optional(),
      pumpPressureUnit: z.string().trim().max(20).nullable().optional(),
      passes: z.array(z.unknown()).max(20).optional(),
      witnessOpenId: z.string().trim().max(64).nullable().optional(),
      notes: z.string().trim().max(1000).nullable().optional(),
    })).mutation(async ({ input, ctx }) => {
      try { return await createOrUpdateTorqueRecord(input, actingUser(ctx.user)); }
      catch (error) { mapRuntimeError(error); }
    }),
  }),

  leakTest: router({
    save: protectedProcedure.input(z.object({
      projectId: z.string().min(2).max(40),
      blindTag: z.string().min(2).max(40),
      status: z.enum(["draft", "in_progress", "passed", "failed", "cancelled"]),
      testType: z.string().trim().max(80).nullable().optional(),
      testMedium: z.string().trim().max(80).nullable().optional(),
      testPressure: z.number().nonnegative().nullable().optional(),
      pressureUnit: z.string().trim().max(20).nullable().optional(),
      durationMinutes: z.number().int().nonnegative().nullable().optional(),
      noLeakObserved: z.boolean(),
      notes: z.string().trim().max(1000).nullable().optional(),
    })).mutation(async ({ input, ctx }) => {
      try { return await createOrUpdateLeakTestRecord(input, actingUser(ctx.user)); }
      catch (error) { mapRuntimeError(error); }
    }),
  }),

  safetyHold: router({
    place: protectedProcedure.input(z.object({
      projectId: z.string().min(2).max(40),
      blindTag: z.string().min(2).max(40),
      reasonCode: z.string().trim().min(2).max(80),
      description: z.string().trim().min(5).max(2000),
    })).mutation(async ({ input, ctx }) => {
      try { return await placeWorkflowSafetyHold(input, actingUser(ctx.user)); }
      catch (error) { mapRuntimeError(error); }
    }),
    release: protectedProcedure.input(z.object({
      projectId: z.string().min(2).max(40),
      blindTag: z.string().min(2).max(40),
      holdId: z.number().int().positive(),
      correctiveAction: z.string().trim().min(5).max(2000),
    })).mutation(async ({ input, ctx }) => {
      try { return await releaseWorkflowSafetyHold(input, actingUser(ctx.user)); }
      catch (error) { mapRuntimeError(error); }
    }),
  }),

  approval: router({
    record: protectedProcedure.input(z.object({
      projectId: z.string().min(2).max(40),
      blindTag: z.string().min(2).max(40),
      roleKey: z.string().trim().min(2).max(80),
      approved: z.boolean(),
      note: z.string().trim().max(1000).nullable().optional(),
    })).mutation(async ({ input, ctx }) => {
      try { return await recordWorkflowApproval(input, actingUser(ctx.user)); }
      catch (error) { mapRuntimeError(error); }
    }),
  }),

  inspection: router({
    templates: protectedProcedure.input(z.object({ includeInactive: z.boolean().optional() }).optional()).query(async ({ input, ctx }) => {
      try { return await listInspectionActivityTemplates({ includeInactive: input?.includeInactive ?? false }, actingUser(ctx.user)); }
      catch (error) { mapRuntimeError(error); }
    }),
    saveTemplate: protectedProcedure.input(z.object({
      id: z.number().int().positive().optional(),
      activityKey: z.string().trim().min(2).max(100).regex(/^[a-z0-9-]+$/),
      name: z.string().trim().min(2).max(180),
      description: z.string().trim().max(2000).nullable().optional(),
      applicableEquipmentTypes: z.array(z.string().trim().min(1).max(80)).max(50),
      mandatory: z.boolean(),
      evidenceRequired: z.boolean(),
      approvalRequired: z.boolean(),
      active: z.boolean(),
      sortOrder: z.number().int().min(0).max(10000),
    })).mutation(async ({ input, ctx }) => {
      try { return await upsertInspectionActivityTemplate(input, actingUser(ctx.user)); }
      catch (error) { mapRuntimeError(error); }
    }),
    forBlind: protectedProcedure.input(z.object({
      projectId: z.string().min(2).max(40),
      blindTag: z.string().min(2).max(40),
    })).query(async ({ input, ctx }) => {
      try { return await getBlindInspectionActivities(input, actingUser(ctx.user)); }
      catch (error) { mapRuntimeError(error); }
    }),
    saveRecord: protectedProcedure.input(z.object({
      projectId: z.string().min(2).max(40),
      blindTag: z.string().min(2).max(40),
      templateId: z.number().int().positive(),
      status: z.enum(["not_started", "in_progress", "completed", "approved", "rejected", "not_applicable"]),
      result: z.string().trim().max(500).nullable().optional(),
      notes: z.string().trim().max(4000).nullable().optional(),
    })).mutation(async ({ input, ctx }) => {
      try { return await upsertBlindInspectionActivity(input, actingUser(ctx.user)); }
      catch (error) { mapRuntimeError(error); }
    }),
  }),

  quality: router({
    forBlind: protectedProcedure.input(z.object({
      projectId: z.string().min(2).max(40),
      blindTag: z.string().min(2).max(40),
    })).query(async ({ input, ctx }) => {
      try { return await getQualityRecords(input, actingUser(ctx.user)); }
      catch (error) { mapRuntimeError(error); }
    }),
    saveDefect: protectedProcedure.input(z.object({
      id: z.number().int().positive().optional(),
      projectId: z.string().min(2).max(40), blindTag: z.string().min(2).max(40),
      expectedRecordVersion: z.number().int().positive().optional(),
      title: z.string().trim().min(2).max(240), description: z.string().trim().min(3).max(8000),
      severity: z.enum(["low", "medium", "high", "critical"]),
      status: z.enum(["open", "under_review", "accepted_as_is", "repair_required", "closed", "transferred", "cancelled"]),
      disposition: z.string().trim().max(8000).nullable().optional(), requiresRepair: z.boolean(), requiresNdt: z.boolean(),
      assignedToOpenId: z.string().trim().max(64).nullable().optional(), dueAt: z.coerce.date().nullable().optional(),
    })).mutation(async ({ input, ctx }) => {
      try { return await upsertDefectNotification(input, actingUser(ctx.user)); }
      catch (error) { mapRuntimeError(error); }
    }),
    savePunch: protectedProcedure.input(z.object({
      id: z.number().int().positive().optional(), projectId: z.string().min(2).max(40), blindTag: z.string().min(2).max(40),
      defectId: z.number().int().positive().nullable().optional(), expectedRecordVersion: z.number().int().positive().optional(),
      title: z.string().trim().min(2).max(240), description: z.string().trim().max(8000).nullable().optional(),
      category: z.string().trim().max(100).nullable().optional(), severity: z.enum(["low", "medium", "high", "critical"]),
      mandatory: z.boolean(), status: z.enum(["open", "in_progress", "ready_for_verification", "closed", "transferred", "cancelled"]),
      ownerOpenId: z.string().trim().max(64).nullable().optional(), targetDate: z.coerce.date().nullable().optional(),
      verificationNotes: z.string().trim().max(8000).nullable().optional(), transferReference: z.string().trim().max(200).nullable().optional(),
    })).mutation(async ({ input, ctx }) => {
      try { return await upsertPunchItem(input, actingUser(ctx.user)); }
      catch (error) { mapRuntimeError(error); }
    }),
    saveNdt: protectedProcedure.input(z.object({
      id: z.number().int().positive().optional(), projectId: z.string().min(2).max(40), blindTag: z.string().min(2).max(40),
      defectId: z.number().int().positive().nullable().optional(), expectedRecordVersion: z.number().int().positive().optional(),
      method: z.string().trim().min(1).max(80), procedureReference: z.string().trim().max(160).nullable().optional(),
      acceptanceCriteria: z.string().trim().max(8000).nullable().optional(),
      status: z.enum(["planned", "in_progress", "passed", "failed", "retest_required", "cancelled"]),
      result: z.string().trim().max(8000).nullable().optional(), reportNumber: z.string().trim().max(160).nullable().optional(),
      performedAt: z.coerce.date().nullable().optional(),
    })).mutation(async ({ input, ctx }) => {
      try { return await upsertNdtRecord(input, actingUser(ctx.user)); }
      catch (error) { mapRuntimeError(error); }
    }),
  }),

  evidence: router({
    upload: protectedProcedure.input(z.object({
      projectId: z.string().min(2).max(40),
      blindTag: z.string().min(2).max(40),
      phaseKey: phaseKeySchema,
      category: z.string().trim().min(2).max(120),
      fileName: z.string().trim().min(1).max(255),
      mimeType: z.string().trim().min(3).max(120),
      base64: z.string().min(8),
    })).mutation(async ({ input, ctx }) => {
      try {
        const policy = await getWorkflowPolicySettings();
        const defaultAllowedEvidenceTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
        const allowed = (() => {
          try {
            const parsed = JSON.parse(policy.evidenceAllowedMimeTypesJson || "null");
            return Array.isArray(parsed) && parsed.length > 0 && parsed.every((item) => typeof item === "string")
              ? parsed as string[]
              : defaultAllowedEvidenceTypes;
          } catch { return defaultAllowedEvidenceTypes; }
        })();
        if (!allowed.includes(input.mimeType)) {
          throw new Error(`Evidence type ${input.mimeType} is not allowed by Workflow & Safety Settings.`);
        }
        const buffer = Buffer.from(input.base64, "base64");
        const maxBytes = Math.max(1, policy.evidenceMaxFileSizeMb || 10) * 1024 * 1024;
        if (buffer.byteLength === 0 || buffer.byteLength > maxBytes) {
          throw new Error(`Evidence file must be between 1 byte and ${policy.evidenceMaxFileSizeMb || 10} MB.`);
        }
        const safeName = input.fileName.replace(/[^A-Za-z0-9._-]+/g, "_");
        const key = `workflow/${input.projectId}/${input.blindTag}/${input.phaseKey}/${Date.now()}-${safeName}`;
        const stored = await storagePut(key, buffer, input.mimeType);
        return await createWorkflowEvidenceRecord({
          projectId: input.projectId,
          blindTag: input.blindTag,
          phaseKey: input.phaseKey,
          category: input.category,
          fileName: input.fileName,
          fileUrl: stored.url,
          storageKey: stored.key,
          mimeType: input.mimeType,
          fileSizeBytes: buffer.byteLength,
        }, actingUser(ctx.user));
      } catch (error) { mapRuntimeError(error); }
    }),
    remove: protectedProcedure.input(z.object({
      projectId: z.string().min(2).max(40),
      blindTag: z.string().min(2).max(40),
      evidenceId: z.number().int().positive(),
    })).mutation(async ({ input, ctx }) => {
      try { return await deleteWorkflowEvidenceRecord(input, actingUser(ctx.user)); }
      catch (error) { mapRuntimeError(error); }
    }),
  }),

  isolationPackage: router({
    list: protectedProcedure.input(z.object({ projectId: z.string().min(2).max(40).nullable().optional() }).optional()).query(async ({ input }) => {
      try { return await getIsolationPackages({ projectId: input?.projectId ?? null }); }
      catch (error) { mapRuntimeError(error); }
    }),
    detail: protectedProcedure.input(z.object({ packageId: z.string().trim().min(3).max(64) })).query(async ({ input }) => {
      try { return await getIsolationPackageDetail(input.packageId); }
      catch (error) { mapRuntimeError(error); }
    }),
    create: protectedProcedure.input(z.object({
      id: z.string().trim().min(3).max(64).optional(),
      projectId: z.string().min(2).max(40),
      equipment: z.string().trim().min(2).max(160),
      description: z.string().trim().max(2000).nullable().optional(),
      blindTags: z.array(z.string().trim().min(2).max(40)).min(1).max(500),
    })).mutation(async ({ input, ctx }) => {
      try { return await createIsolationPackage(input, actingUser(ctx.user)); }
      catch (error) { mapRuntimeError(error); }
    }),
    entryReadiness: protectedProcedure.input(z.object({
      packageId: z.string().trim().min(3).max(64),
      status: z.enum(["draft", "ready", "authorized", "rejected", "expired"]),
      pressureZero: z.boolean(),
      drainedAndPurged: z.boolean(),
      confinedSpacePermitValid: z.boolean(),
      operationsApproved: z.boolean(),
      entrySupervisorApproved: z.boolean(),
      validUntil: z.coerce.date().nullable().optional(),
    })).mutation(async ({ input, ctx }) => {
      try { return await upsertEntryReadinessRecord(input, actingUser(ctx.user)); }
      catch (error) { mapRuntimeError(error); }
    }),
  }),
});
