/**
 * server/routers/access-control.ts
 * ─────────────────────────────────
 * Procedures for role-based access control, user management,
 * and registration approval workflow.
 */

import { z } from "zod";
import { notifyOwner } from "../_core/notification";
import {
  adminProcedure,
  permissionProcedure,
  protectedProcedure,
  router,
} from "../_core/trpc";
import { getWorkflowActorAccess } from "../db/workflowRuntime";
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
  myAccess: protectedProcedure.query(async ({ ctx }) =>
    getWorkflowActorAccess(ctx.user.openId, ctx.user.role)
  ),

  model: permissionProcedure("roles.manage").query(async () =>
    getAccessControlModel()
  ),

  users: permissionProcedure("users.view").query(async () => getAllUsers()),

  assignRoles: adminProcedure
    .input(
      z.object({
        userId: z.number().int().positive(),
        roleKeys: z.array(z.string().min(1).max(80)),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await assignRolesToUser(input.userId, input.roleKeys, ctx.user.openId);
      return { success: true };
    }),

  updateSystemRole: adminProcedure
    .input(
      z.object({
        userId: z.number().int().positive(),
        role: z.enum(["user", "admin"]),
      })
    )
    .mutation(async ({ input }) => {
      await updateUserSystemRole(input.userId, input.role);
      return { success: true };
    }),

  updateRoles: adminProcedure
    .input(
      z.array(
        z.object({
          key: z.string().min(1).max(80),
          name: z.string().min(1).max(120),
          subtitle: z.string().max(200),
          color: z.string().max(20),
          permissionKeys: z.array(z.string()),
          menuKeys: z.array(z.string()),
          phaseKeys: z.array(z.string()),
        })
      )
    )
    .mutation(async ({ input }) => {
      await updateAccessControlModel(input);
      return { success: true };
    }),

  createRole: adminProcedure
    .input(
      z.object({
        key: z.string().min(1).max(80),
        name: z.string().min(1).max(120),
        subtitle: z.string().max(200),
        color: z.string().max(20),
        permissionKeys: z.array(z.string()),
        menuKeys: z.array(z.string()),
        phaseKeys: z.array(z.string()),
      })
    )
    .mutation(async ({ input }) => {
      await createAccessRole(input);
      return { success: true };
    }),

  deleteRole: adminProcedure
    .input(
      z.object({
        roleKey: z.string().min(1).max(80),
      })
    )
    .mutation(async ({ input }) => {
      await deleteAccessRole(input.roleKey);
      return { success: true };
    }),

  pendingUsers: adminProcedure.query(async () => getPendingUsers()),

  approveUser: adminProcedure
    .input(
      z.object({
        userId: z.number().int().positive(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Fetch user info before approval to get their openId
      const allUsers = await getAllUsers();
      const targetUser = allUsers.find(u => u.id === input.userId);

      await approveUserRegistration(input.userId, ctx.user.openId);

      // Notify the approved user
      if (targetUser) {
        await createNotification({
          recipientOpenId: targetUser.openId,
          actorOpenId: ctx.user.openId,
          actorName: ctx.user.name ?? undefined,
          type: "registration_approved",
          title: "Registration request approved",
          body: `Hello ${targetUser.name ?? ""}! Your SBTS registration request has been approved. You can now sign in and begin using the system.`,
          linkUrl: "/dashboard",
        }).catch(() => {
          /* non-critical */
        });
      }

      return { success: true };
    }),

  rejectUser: adminProcedure
    .input(
      z.object({
        userId: z.number().int().positive(),
        reason: z.string().trim().max(500).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Fetch user info before rejection to get their openId
      const allUsers = await getAllUsers();
      const targetUser = allUsers.find(u => u.id === input.userId);

      await rejectUserRegistration(input.userId, ctx.user.openId);

      // Notify the rejected user
      if (targetUser) {
        await createNotification({
          recipientOpenId: targetUser.openId,
          actorOpenId: ctx.user.openId,
          actorName: ctx.user.name ?? undefined,
          type: "registration_rejected",
          title: "Registration request rejected",
          body: input.reason
            ? `Your SBTS registration request was rejected.\n\nReason: ${input.reason}`
            : "Your SBTS registration request was rejected. Contact the System Administrator for more information.",
          linkUrl: "/approve",
        }).catch(() => {
          /* non-critical */
        });
      }

      return { success: true };
    }),

  completeRegistration: protectedProcedure
    .input(
      z.object({
        department: z.string().trim().min(1).max(160),
        specialty: z.string().trim().min(1).max(160),
        employeeNumber: z.string().trim().min(1).max(64),
        registrationNote: z.string().trim().max(1000).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await completeUserRegistration(ctx.user.openId, input);

      // Get all admins to notify them about the new registration
      const allUsers = await getAllUsers();
      const adminOpenIds = allUsers
        .filter(u => u.role === "admin")
        .map(u => u.openId);

      // Notify all admins about the new registration request
      if (adminOpenIds.length > 0) {
        await broadcastNotification(adminOpenIds, {
          actorOpenId: ctx.user.openId,
          actorName: ctx.user.name ?? undefined,
          type: "registration_request",
          title: `New registration request — ${ctx.user.name ?? ctx.user.openId}`,
          body: `A new user has requested access to SBTS:\n\nName: ${ctx.user.name ?? "Not provided"}\nSpecialty: ${input.specialty}\nDepartment: ${input.department}\nEmployee number: ${input.employeeNumber}`,
          linkUrl: "/users",
        }).catch(() => {
          /* non-critical */
        });
      }

      // Also notify owner via system notification (non-critical)
      await notifyOwner({
        title: `New registration request — ${ctx.user.name ?? ctx.user.openId}`,
        content: `A new user has requested access to SBTS:\n\nName: ${ctx.user.name ?? "Not provided"}\nSpecialty: ${input.specialty}\nDepartment: ${input.department}\nEmployee number: ${input.employeeNumber}\n\nReview the request in User Management.`,
      }).catch(() => {
        /* non-critical */
      });

      return { success: true };
    }),
});
