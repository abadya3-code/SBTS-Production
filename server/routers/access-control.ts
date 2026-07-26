/**
 * server/routers/access-control.ts
 * ─────────────────────────────────
 * Procedures for role-based access control, user management,
 * and registration approval workflow.
 */

import { z } from "zod";
import { notifyOwner } from "../_core/notification";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
import {
  approveUserRegistration,
  assignRolesToUser,
  broadcastNotification,
  completeUserRegistration,
  createAccessRole,
  createNotification,
  deleteAccessRole,
  getAccessControlModel,
  getAllUsers,
  getPendingUsers,
  rejectUserRegistration,
  updateAccessControlModel,
  updateUserSystemRole,
} from "../db";

export const accessControlRouter = router({
  model: protectedProcedure.query(async () => getAccessControlModel()),

  users: protectedProcedure.query(async () => getAllUsers()),

  assignRoles: adminProcedure.input(z.object({
    userId: z.number().int().positive(),
    roleKeys: z.array(z.string().min(1).max(80)),
  })).mutation(async ({ input, ctx }) => {
    await assignRolesToUser(input.userId, input.roleKeys, ctx.user.openId);
    return { success: true };
  }),

  updateSystemRole: adminProcedure.input(z.object({
    userId: z.number().int().positive(),
    role: z.enum(["user", "admin"]),
  })).mutation(async ({ input }) => {
    await updateUserSystemRole(input.userId, input.role);
    return { success: true };
  }),

  updateRoles: adminProcedure.input(z.array(z.object({
    key: z.string().min(1).max(80),
    name: z.string().min(1).max(120),
    subtitle: z.string().max(200),
    color: z.string().max(20),
    permissionKeys: z.array(z.string()),
    menuKeys: z.array(z.string()),
    phaseKeys: z.array(z.string()),
  }))).mutation(async ({ input }) => {
    await updateAccessControlModel(input);
    return { success: true };
  }),

  createRole: adminProcedure.input(z.object({
    key: z.string().min(1).max(80),
    name: z.string().min(1).max(120),
    subtitle: z.string().max(200),
    color: z.string().max(20),
    permissionKeys: z.array(z.string()),
    menuKeys: z.array(z.string()),
    phaseKeys: z.array(z.string()),
  })).mutation(async ({ input }) => {
    await createAccessRole(input);
    return { success: true };
  }),

  deleteRole: adminProcedure.input(z.object({
    roleKey: z.string().min(1).max(80),
  })).mutation(async ({ input }) => {
    await deleteAccessRole(input.roleKey);
    return { success: true };
  }),

  pendingUsers: adminProcedure.query(async () => getPendingUsers()),

  approveUser: adminProcedure.input(z.object({
    userId: z.number().int().positive(),
  })).mutation(async ({ input, ctx }) => {
    // Fetch user info before approval to get their openId
    const allUsers = await getAllUsers();
    const targetUser = allUsers.find((u) => u.id === input.userId);

    await approveUserRegistration(input.userId, ctx.user.openId);

    // Notify the approved user
    if (targetUser) {
      await createNotification({
        recipientOpenId: targetUser.openId,
        actorOpenId: ctx.user.openId,
        actorName: ctx.user.name ?? undefined,
        type: "registration_approved",
        title: "تم قبول طلب التسجيل",
        body: `مرحباً ${targetUser.name ?? ""}! تم قبول طلب تسجيلك في نظام SBTS. يمكنك الآن الدخول والبدء باستخدام النظام.`,
        linkUrl: "/dashboard",
      }).catch(() => { /* non-critical */ });
    }

    return { success: true };
  }),

  rejectUser: adminProcedure.input(z.object({
    userId: z.number().int().positive(),
    reason: z.string().trim().max(500).optional(),
  })).mutation(async ({ input, ctx }) => {
    // Fetch user info before rejection to get their openId
    const allUsers = await getAllUsers();
    const targetUser = allUsers.find((u) => u.id === input.userId);

    await rejectUserRegistration(input.userId, ctx.user.openId);

    // Notify the rejected user
    if (targetUser) {
      await createNotification({
        recipientOpenId: targetUser.openId,
        actorOpenId: ctx.user.openId,
        actorName: ctx.user.name ?? undefined,
        type: "registration_rejected",
        title: "تم رفض طلب التسجيل",
        body: input.reason
          ? `نأسف لإبلاغك بأنه تم رفض طلب تسجيلك في نظام SBTS.\n\nالسبب: ${input.reason}`
          : "نأسف لإبلاغك بأنه تم رفض طلب تسجيلك في نظام SBTS. يرجى التواصل مع المدير للمزيد من المعلومات.",
        linkUrl: "/approve",
      }).catch(() => { /* non-critical */ });
    }

    return { success: true };
  }),

  completeRegistration: protectedProcedure.input(z.object({
    department: z.string().trim().min(1).max(160),
    specialty: z.string().trim().min(1).max(160),
    employeeNumber: z.string().trim().min(1).max(64),
    registrationNote: z.string().trim().max(1000).optional(),
  })).mutation(async ({ input, ctx }) => {
    await completeUserRegistration(ctx.user.openId, input);

    // Get all admins to notify them about the new registration
    const allUsers = await getAllUsers();
    const adminOpenIds = allUsers
      .filter((u) => u.role === "admin")
      .map((u) => u.openId);

    // Notify all admins about the new registration request
    if (adminOpenIds.length > 0) {
      await broadcastNotification(adminOpenIds, {
        actorOpenId: ctx.user.openId,
        actorName: ctx.user.name ?? undefined,
        type: "registration_request",
        title: `طلب تسجيل جديد - ${ctx.user.name ?? ctx.user.openId}`,
        body: `مستخدم جديد يطلب الانضمام إلى SBTS:\n\nالاسم: ${ctx.user.name ?? "غير محدد"}\nالتخصص: ${input.specialty}\nالقسم: ${input.department}\nرقم الموظف: ${input.employeeNumber}`,
        linkUrl: "/users",
      }).catch(() => { /* non-critical */ });
    }

    // Also notify owner via system notification (non-critical)
    await notifyOwner({
      title: `طلب تسجيل جديد - ${ctx.user.name ?? ctx.user.openId}`,
      content: `مستخدم جديد يطلب الانضمام إلى SBTS:\n\nالاسم: ${ctx.user.name ?? "غير محدد"}\nالتخصص: ${input.specialty}\nالقسم: ${input.department}\nرقم الموظف: ${input.employeeNumber}\n\nيرجى مراجعة طلبات التسجيل في لوحة إدارة المستخدمين.`,
    }).catch(() => { /* non-critical */ });

    return { success: true };
  }),
});
