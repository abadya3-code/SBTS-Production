/**
 * server/routers/notifications.ts
 * ────────────────────────────────
 * tRPC procedures for the in-app notification system.
 *
 * Procedures:
 *   notifications.list         → get paginated notifications for current user
 *   notifications.unreadCount  → get unread count (used for bell badge polling)
 *   notifications.markRead     → mark a single notification as read
 *   notifications.markAllRead  → mark all notifications as read
 *   notifications.delete       → delete a single notification
 */

import { z } from "zod";
import {
  countUnreadNotifications,
  deleteNotificationById,
  getNotificationsForUser,
  markAllNotificationsRead,
  markNotificationRead,
} from "../db";
import { protectedProcedure, router } from "../_core/trpc";

export const notificationsRouter = router({
  /**
   * Get notifications for the current user.
   * Polled every 10 seconds by the frontend for real-time updates.
   */
  list: protectedProcedure
    .input(
      z.object({
        unreadOnly: z.boolean().optional().default(false),
        limit: z.number().min(1).max(100).optional().default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const rows = await getNotificationsForUser(ctx.user.openId, {
        unreadOnly: input.unreadOnly,
        limit: input.limit,
      });
      return rows.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        linkUrl: n.linkUrl,
        projectId: n.projectId,
        blindTag: n.blindTag,
        actorName: n.actorName,
        isRead: n.isRead === 1,
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
    .input(z.object({ id: z.number() }))
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

  /**
   * Delete a single notification (only if owned by the current user).
   */
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await deleteNotificationById(input.id, ctx.user.openId);
      return { success: true };
    }),
});
