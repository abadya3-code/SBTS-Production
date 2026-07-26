/**
 * server/routers/profile.ts
 * ──────────────────────────
 * tRPC procedures for user profile management.
 * Covers: get profile, update personal info, upload avatar, change password, update theme.
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getUserProfile, updateUserAvatar, updateUserProfile } from "../db/profile";
import { getUserByEmail, hashPassword, verifyPassword } from "../db/auth";
import { requireDb } from "../db/core";
import { users, blindWorkflowLogs, blindPhaseApprovals, blinds, projects } from "../../drizzle/schema";
import { eq, desc, or, and } from "drizzle-orm";
import { storagePut } from "../storage";
import { protectedProcedure, router } from "../_core/trpc";

export const profileRouter = router({
  // ─── Get current user's profile ─────────────────────────────────────────
  get: protectedProcedure.query(async ({ ctx }) => {
    const profile = await getUserProfile(ctx.user.openId);
    if (!profile) throw new TRPCError({ code: "NOT_FOUND", message: "Profile not found" });
    return profile;
  }),

  // ─── Update personal information ─────────────────────────────────────────
  update: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(120).optional(),
        bio: z.string().max(500).optional(),
        phone: z.string().max(40).optional(),
        userLocation: z.string().max(200).optional(),
        linkedIn: z.string().max(255).optional(),
        department: z.string().max(160).optional(),
        specialty: z.string().max(160).optional(),
        employeeNumber: z.string().max(64).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await updateUserProfile(ctx.user.openId, input);
      return { success: true };
    }),

  // ─── Update theme preference ──────────────────────────────────────────────
  updateTheme: protectedProcedure
    // Accepts new ThemeId values (standard | modern | manus) plus legacy (light | dark | system)
    .input(z.object({ theme: z.enum(["standard", "modern", "manus", "light", "dark", "system"]) }))
    .mutation(async ({ ctx, input }) => {
      await updateUserProfile(ctx.user.openId, { preferredTheme: input.theme });
      return { success: true };
    }),

  // ─── Upload avatar (base64 encoded) ──────────────────────────────────────
  uploadAvatar: protectedProcedure
    .input(
      z.object({
        base64: z.string().max(5 * 1024 * 1024), // ~3.75MB original file
        mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
        filename: z.string().max(255),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Decode base64 to buffer
      const base64Data = input.base64.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");

      // Validate size (max 3MB after decode)
      if (buffer.length > 3 * 1024 * 1024) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Image too large (max 3MB)" });
      }

      const ext = input.mimeType.split("/")[1];
      const key = `avatars/${ctx.user.openId.replace(/[^a-zA-Z0-9]/g, "_")}_${Date.now()}.${ext}`;
      const { key: savedKey, url } = await storagePut(key, buffer, input.mimeType);
      await updateUserAvatar(ctx.user.openId, savedKey, url);
      return { avatarUrl: url, avatarKey: savedKey };
    }),

  // ─── Change password ──────────────────────────────────────────────────────
  changePassword: protectedProcedure
    .input(
      z.object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(8).max(128),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const rows = await db
        .select()
        .from(users)
        .where(eq(users.openId, ctx.user.openId))
        .limit(1);
      if (rows.length === 0) throw new TRPCError({ code: "NOT_FOUND" });
      const user = rows[0];

      // Verify current password
      if (!user.passwordHash) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No password set for this account" });
      }
      const valid = await verifyPassword(input.currentPassword, user.passwordHash);
      if (!valid) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Current password is incorrect" });
      }

      // Hash and save new password
      const newHash = await hashPassword(input.newPassword);
      await db
        .update(users)
        .set({ passwordHash: newHash })
        .where(eq(users.openId, ctx.user.openId));

      return { success: true };
    }),

  // ─── Get activity stats for profile page ─────────────────────────────────
  stats: protectedProcedure.query(async ({ ctx }) => {
    const profile = await getUserProfile(ctx.user.openId);
    if (!profile) throw new TRPCError({ code: "NOT_FOUND" });
    return {
      memberSince: profile.createdAt,
      lastSignedIn: profile.lastSignedIn,
    };
  }),

  // ─── Activity Timeline ────────────────────────────────────────────────────
  // Returns the last 50 actions this user performed across the system.
  // Sources: blind workflow logs (actor), phase approvals (approvedBy), project creation.
  activity: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(50) }))
    .query(async ({ ctx, input }) => {
      const db = await requireDb();
      const openId = ctx.user.openId;

      // 1. Workflow log entries where this user was the actor
      const wfLogs = await db
        .select({
          id: blindWorkflowLogs.id,
          blindTag: blindWorkflowLogs.blindTag,
          projectId: blindWorkflowLogs.projectId,
          phase: blindWorkflowLogs.phase,
          action: blindWorkflowLogs.action,
          message: blindWorkflowLogs.message,
          createdAt: blindWorkflowLogs.createdAt,
        })
        .from(blindWorkflowLogs)
        .where(eq(blindWorkflowLogs.actorOpenId, openId))
        .orderBy(desc(blindWorkflowLogs.createdAt))
        .limit(input.limit);

      // 2. Phase approvals where this user approved/revoked
      const approvals = await db
        .select({
          id: blindPhaseApprovals.id,
          blindTag: blindPhaseApprovals.blindTag,
          projectId: blindPhaseApprovals.projectId,
          phase: blindPhaseApprovals.phase,
          approved: blindPhaseApprovals.approved,
          approvedAt: blindPhaseApprovals.approvedAt,
          revokedAt: blindPhaseApprovals.revokedAt,
          createdAt: blindPhaseApprovals.createdAt,
        })
        .from(blindPhaseApprovals)
        .where(eq(blindPhaseApprovals.approvedByOpenId, openId))
        .orderBy(desc(blindPhaseApprovals.createdAt))
        .limit(input.limit);

      // 3. Projects created by this user
      const userProjects = await db
        .select({
          id: projects.id,
          name: projects.name,
          status: projects.status,
          createdAt: projects.createdAt,
        })
        .from(projects)
        .orderBy(desc(projects.createdAt))
        .limit(20);

      // Merge and normalise into a unified timeline event list
      type TimelineEvent = {
        id: string;
        type: "workflow" | "approval" | "project";
        action: string;
        description: string;
        blindTag?: string;
        projectId?: string;
        phase?: string;
        createdAt: Date;
        icon: string;
        color: string;
      };

      const events: TimelineEvent[] = [];

      // Map workflow logs
      for (const log of wfLogs) {
        events.push({
          id: `wf-${log.id}`,
          type: "workflow",
          action: log.action,
          description: log.message,
          blindTag: log.blindTag,
          projectId: log.projectId,
          phase: log.phase,
          createdAt: log.createdAt,
          icon: "activity",
          color: "blue",
        });
      }

      // Map approvals
      for (const appr of approvals) {
        const isApproved = appr.approved === 1;
        const eventDate = isApproved
          ? (appr.approvedAt ?? appr.createdAt)
          : (appr.revokedAt ?? appr.createdAt);
        events.push({
          id: `appr-${appr.id}`,
          type: "approval",
          action: isApproved ? "Phase Approved" : "Approval Revoked",
          description: `${isApproved ? "Approved" : "Revoked"} phase "${appr.phase}" for blind ${appr.blindTag}`,
          blindTag: appr.blindTag,
          projectId: appr.projectId,
          phase: appr.phase,
          createdAt: eventDate,
          icon: isApproved ? "check-circle" : "x-circle",
          color: isApproved ? "green" : "red",
        });
      }

      // Sort all events by date descending and cap at limit
      events.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      const trimmed = events.slice(0, input.limit);

      // Enrich with project names for display
      const projectIds = Array.from(new Set(trimmed.map((e) => e.projectId).filter(Boolean) as string[]));
      const projectMap: Record<string, string> = {};
      if (projectIds.length > 0) {
        const projRows = await db
          .select({ id: projects.id, name: projects.name })
          .from(projects)
          .limit(projectIds.length * 2);
        for (const p of projRows) {
          projectMap[p.id] = p.name;
        }
      }

      return {
        events: trimmed.map((e) => ({
          ...e,
          projectName: e.projectId ? (projectMap[e.projectId] ?? e.projectId) : undefined,
        })),
        total: events.length,
        workflowCount: wfLogs.length,
        approvalCount: approvals.length,
      };
    }),
});
