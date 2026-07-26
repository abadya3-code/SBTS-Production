/**
 * server/routers/projects.ts
 * ──────────────────────────
 * Procedures for projects, blinds, phase approvals, and project settings.
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
import {
  addBlindToProject,
  broadcastNotification,
  bulkAddBlindsToProject,
  canUserEditProjectPhase,
  createNotification,
  createProject,
  getAllProjects,
  getAllUsers,
  getAssignableProjectUsers,
  getBlindDetail,
  getProjectDetail,
  getProjectSettings,
  getProjectsByArea,
  setBlindPhaseApproval,
  updateBlindInProject,
  updateProjectSettings,
} from "../db";
import {
  blindCreateSchema,
  blindInputSchema,
  blindPhaseApprovalSchema,
  blindUpdateSchema,
  projectCreateSchema,
  projectSettingsSchema,
} from "./shared";

// ─── Helpers ───────────────────────────────────────────────────────────────

type RouterContextUser = {
  openId: string;
  name?: string | null;
  email?: string | null;
  role: "user" | "admin";
};

const toActingUser = (ctxUser: RouterContextUser) => ({
  openId: ctxUser.openId,
  name: ctxUser.name ?? null,
  email: ctxUser.email ?? null,
  role: ctxUser.role,
});


// ─── Router ────────────────────────────────────────────────────────────────

export const projectsRouter = router({
  list: protectedProcedure.query(async () => getAllProjects()),

  listByArea: protectedProcedure
    .input(z.object({ areaId: z.number().int().positive() }))
    .query(async ({ input }) => getProjectsByArea(input.areaId)),

  detail: protectedProcedure
    .input(z.object({ id: z.string().min(2).max(40) }))
    .query(async ({ input }) => getProjectDetail(input.id)),

  blindDetail: protectedProcedure
    .input(z.object({
      projectId: z.string().min(2).max(40),
      tag: z.string().trim().min(2).max(40),
    }))
    .query(async ({ input }) => getBlindDetail(input.projectId, input.tag)),

  create: protectedProcedure
    .input(projectCreateSchema)
    .mutation(async ({ input, ctx }) => {
      const project = await createProject(input);

      // Notify all admins about the new project
      const allUsers = await getAllUsers();
      const adminOpenIds = allUsers
        .filter((u) => u.role === "admin" && u.openId !== ctx.user.openId)
        .map((u) => u.openId);

      if (adminOpenIds.length > 0) {
        await broadcastNotification(adminOpenIds, {
          actorOpenId: ctx.user.openId,
          actorName: ctx.user.name ?? undefined,
          type: "project_created",
          title: `مشروع جديد: ${input.name}`,
          body: `تم إنشاء مشروع جديد "${input.name}" بواسطة ${ctx.user.name ?? ctx.user.openId}.`,
          linkUrl: `/projects/${input.id}`,
          projectId: typeof input.id === "string" ? undefined : input.id,
        }).catch(() => { /* non-critical */ });
      }

      return project;
    }),

  addBlind: protectedProcedure.input(blindCreateSchema).mutation(async ({ input, ctx }) => {
    const actingUser = toActingUser(ctx.user);
    const allowed = await canUserEditProjectPhase(
      input.projectId,
      input.phase ?? "Broken / Preparation",
      actingUser,
    );
    if (!allowed) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only the configured phase owner can add or update blinds in this phase.",
      });
    }
    return addBlindToProject(input, actingUser);
  }),

  bulkAddBlinds: protectedProcedure
    .input(z.object({
      projectId: z.string().min(2).max(40),
      blinds: z.array(blindInputSchema).min(1).max(500),
    }))
    .mutation(async ({ input, ctx }) => {
      const actingUser = toActingUser(ctx.user);
      const phases = Array.from(
        new Set(input.blinds.map((blind) => blind.phase ?? "Broken / Preparation")),
      );
      const permissionResults = await Promise.all(
        phases.map((phase) => canUserEditProjectPhase(input.projectId, phase, actingUser)),
      );
      if (permissionResults.some((allowed) => !allowed)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Bulk import includes phases assigned to another owner.",
        });
      }
      return bulkAddBlindsToProject(input.projectId, input.blinds);
    }),

  updateBlind: protectedProcedure.input(blindUpdateSchema).mutation(async ({ input, ctx }) => {
    const detail = await getProjectDetail(input.projectId);
    const existing = detail?.blinds.find((blind) => blind.tag === input.tag);
    if (!existing) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Blind was not found in this project." });
    }
    const actingUser = toActingUser(ctx.user);
    if (input.phase !== undefined && input.phase !== existing.phase) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Direct phase changes are disabled. Use the canonical workflow action in Blind Detail.",
      });
    }
    const targetPhase = existing.phase;
    const [allowedExistingPhase, allowedTargetPhase] = await Promise.all([
      canUserEditProjectPhase(input.projectId, existing.phase, actingUser),
      canUserEditProjectPhase(input.projectId, targetPhase, actingUser),
    ]);
    if (!allowedExistingPhase || !allowedTargetPhase) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only the configured phase owner can update this blind or move it to another phase.",
      });
    }
    const settings = await getProjectSettings(input.projectId);
    const result = await updateBlindInProject(input, actingUser);

    // Notify phase owner if the blind moved to a different phase
    if (input.phase && input.phase !== existing.phase && settings) {
      const newPhaseOwners = settings.phaseOwners.find((po) => po.phase === input.phase);
      if (newPhaseOwners?.owners?.length) {
        const ownerOpenIds = newPhaseOwners.owners
          .map((o) => o.openId)
          .filter((id): id is string => !!id && id !== ctx.user.openId);

        if (ownerOpenIds.length > 0) {
          await broadcastNotification(ownerOpenIds, {
            actorOpenId: ctx.user.openId,
            actorName: ctx.user.name ?? undefined,
            type: "blind_phase_changed",
            title: `تغيير مرحلة: ${input.tag}`,
            body: `تم نقل الـ Blind "${input.tag}" من مرحلة "${existing.phase}" إلى مرحلة "${input.phase}" بواسطة ${ctx.user.name ?? ctx.user.openId}.`,
            linkUrl: `/projects/${input.projectId}/blinds/${input.tag}`,
            projectId: undefined,
            blindTag: input.tag,
          }).catch(() => { /* non-critical */ });
        }
      }
    }

    return result;
  }),

  approveBlindPhase: protectedProcedure
    .input(blindPhaseApprovalSchema)
    .mutation(async ({ input, ctx }) => {
      const actingUser = toActingUser(ctx.user);
      let result;
      try {
        result = await setBlindPhaseApproval(input, actingUser);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Electronic phase approval failed.";
        if (message.includes("not found")) throw new TRPCError({ code: "NOT_FOUND", message });
        if (message.includes("Only the configured phase owner"))
          throw new TRPCError({ code: "FORBIDDEN", message });
        throw new TRPCError({ code: "BAD_REQUEST", message });
      }

      // Notify admins about the phase approval
      const allUsers = await getAllUsers();
      const adminOpenIds = allUsers
        .filter((u) => u.role === "admin" && u.openId !== ctx.user.openId)
        .map((u) => u.openId);

      if (adminOpenIds.length > 0) {
        await broadcastNotification(adminOpenIds, {
          actorOpenId: ctx.user.openId,
          actorName: ctx.user.name ?? undefined,
          type: "blind_phase_approval",
          title: `موافقة إلكترونية: ${input.tag}`,
          body: `تمت الموافقة الإلكترونية على مرحلة "${input.phase}" للـ Blind "${input.tag}" بواسطة ${ctx.user.name ?? ctx.user.openId}.`,
          linkUrl: `/projects/${input.projectId}/blinds/${input.tag}`,
          blindTag: input.tag,
        }).catch(() => { /* non-critical */ });
      }

      return result;
    }),

  settings: router({
    get: protectedProcedure
      .input(z.object({ projectId: z.string().min(2).max(40) }))
      .query(async ({ input }) => getProjectSettings(input.projectId)),

    assignableUsers: protectedProcedure.query(async () => getAssignableProjectUsers()),

    update: adminProcedure
      .input(projectSettingsSchema)
      .mutation(async ({ input, ctx }) => {
        // Get old settings to detect newly assigned phase owners
        const oldSettings = await getProjectSettings(input.projectId);

        const result = await updateProjectSettings(
          input.projectId,
          input.phaseOwners,
          ctx.user.openId,
          input.slipBlindGateRequired,
        );

        // Notify newly assigned phase owners
        const oldOwnerIds = new Set(
          (oldSettings?.phaseOwners ?? [])
            .flatMap((po) => po.owners?.map((o) => o.openId) ?? [])
            .filter(Boolean),
        );

        const newlyAssigned = input.phaseOwners
          .flatMap((po) =>
            (po.owners ?? [])
              .filter((o) => o.openId && !oldOwnerIds.has(o.openId) && o.openId !== ctx.user.openId)
              .map((o) => ({ openId: o.openId!, phase: po.phase })),
          );

        await Promise.all(
          newlyAssigned.map(({ openId, phase }) =>
            createNotification({
              recipientOpenId: openId,
              actorOpenId: ctx.user.openId,
              actorName: ctx.user.name ?? undefined,
              type: "phase_owner_assigned",
              title: `تم تعيينك مالكاً لمرحلة`,
              body: `تم تعيينك مالكاً لمرحلة "${phase}" في المشروع "${input.projectId}" بواسطة ${ctx.user.name ?? ctx.user.openId}.`,
              linkUrl: `/projects/${input.projectId}`,
            }).catch(() => { /* non-critical */ }),
          ),
        );

        return result;
      }),
  }),
});
