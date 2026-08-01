/**
 * server/routers/notifications.ts
 * ────────────────────────────────
 * tRPC procedures for the in-app notification system.
 *
 * Procedures:
 *   notifications.list         → get filtered notifications for current user
 *   notifications.unreadCount  → get unread count (used for bell badge polling)
 *   notifications.markRead     → mark a single notification as read
 *   notifications.markAllRead  → mark all notifications as read
 *   notifications.archive      → archive a single notification
 *   notifications.restore      → restore a single notification
 *   notifications.delete       → delete a single notification
 */

import { z } from "zod";
import {
  archiveNotification,
  countUnreadNotifications,
  deleteNotificationById,
  getNotificationsForUser,
  markAllNotificationsRead,
  markNotificationRead,
  restoreNotification,
} from "../db/notifications";
import type {
  NotificationPriority,
  NotificationType,
} from "../db/notifications";
import { protectedProcedure, router } from "../_core/trpc";

const notificationTypeSchema = z.enum([
  "registration_request",
  "registration_approved",
  "registration_rejected",
  "blind_phase_changed",
  "blind_phase_approval",
  "blind_assigned",
  "project_created",
  "project_status_changed",
  "phase_owner_assigned",
  "workflow_updated",
  "workflow_transition",
  "workflow_gate_blocked",
  "workflow_approval_required",
  "safety_hold_placed",
  "safety_hold_released",
  "qr_token_issued",
  "qr_token_rotated",
  "qr_token_revoked",
  "certificate_issued",
  "certificate_revoked",
  "tag_printed",
  "system_announcement",
]);

const notificationPrioritySchema = z.enum([
  "info",
  "action",
  "warning",
  "critical",
]);

export const notificationsRouter = router({
  /**
   * Get notifications for the current user.
   * Polled every 10 seconds by the frontend for real-time updates.
   */
  list: protectedProcedure
    .input(
      z.object({
        scope: z.enum(["active", "archived", "all"]).default("active"),
        unreadOnly: z.boolean().optional().default(false),
        type: notificationTypeSchema.optional(),
        priority: notificationPrioritySchema.optional(),
        limit: z.number().int().min(1).max(200).optional().default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const rows = await getNotificationsForUser(ctx.user.openId, {
        unreadOnly: input.unreadOnly,
        scope: input.scope,
        type: input.type as NotificationType | undefined,
        priority: input.priority as NotificationPriority | undefined,
        limit: input.limit,
      });
      return rows.map(n => ({
        id: n.id,
        type: n.type,
        priority: n.priority,
        title: n.title,
        body: n.body,
        linkUrl: n.linkUrl,
        projectId: n.projectId,
        blindTag: n.blindTag,
        actorName: n.actorName,
        isRead: n.isRead === 1,
        readAt: n.readAt,
        isArchived: n.isArchived === 1,
        archivedAt: n.archivedAt,
        createdAt: n.createdAt,
      }));
    }),

  /**
   * Get unread notification count for the bell badge.
   * Polled every 10 seconds.
   */
  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    const count = await countUnreadNotifications(ctx.user.openId);
    return { count };
  }),

  /**
   * Mark a single notification as read.
   */
  markRead: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await markNotificationRead(input.id, ctx.user.openId);
      return { success: true };
    }),

  /**
   * Mark all notifications as read for the current user.
   */
  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    await markAllNotificationsRead(ctx.user.openId);
    return { success: true };
  }),

  /** Archive one notification owned by the current user. */
  archive: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await archiveNotification(input.id, ctx.user.openId);
      return { success: true };
    }),

  /** Restore one archived notification owned by the current user. */
  restore: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await restoreNotification(input.id, ctx.user.openId);
      return { success: true };
    }),

  /**
   * Delete a single notification (only if owned by the current user).
   */
  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await deleteNotificationById(input.id, ctx.user.openId);
      return { success: true };
    }),
});
