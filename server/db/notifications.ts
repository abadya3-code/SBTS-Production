/**
 * server/db/notifications.ts
 * ──────────────────────────
 * Database helpers for the in-app notification system.
 * All functions operate on the `notifications` table.
 * Notification creation respects `notification_preferences` settings.
 */

import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { notifications, notificationPreferences } from "../../drizzle/schema";
import type { InsertNotification, NotificationRow } from "../../drizzle/schema";
import { requireDb } from "./core";

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotificationType = NonNullable<InsertNotification["type"]>;

export interface CreateNotificationInput {
  recipientOpenId: string;
  actorOpenId?: string;
  actorName?: string;
  type: NotificationType;
  title: string;
  body: string;
  linkUrl?: string;
  projectId?: string;
  blindTag?: string;
}

// ─── Notification Preferences ─────────────────────────────────────────────────

/**
 * Maps notification types to their preference column names.
 * If a type is not mapped here, it's always allowed.
 */
const typeToPreferenceMap: Record<string, string> = {
  registration_request: "registrationRequest",
  registration_approved: "registrationApproved",
  registration_rejected: "registrationRejected",
  blind_phase_changed: "blindPhaseChanged",
  blind_phase_approval: "blindPhaseApproval",
  blind_assigned: "blindAssigned",
  project_created: "projectCreated",
  project_status_changed: "projectStatusChanged",
  phase_owner_assigned: "phaseOwnerAssigned",
  workflow_updated: "workflowUpdated",
  workflow_transition: "workflowTransition",
  workflow_gate_blocked: "workflowGateBlocked",
  workflow_approval_required: "workflowApprovalRequired",
  safety_hold_placed: "safetyHoldPlaced",
  safety_hold_released: "safetyHoldReleased",
  system_announcement: "systemAnnouncement",
};

/**
 * Check if a notification type is enabled in global preferences.
 * Returns true if enabled or if no preferences row exists (default = all enabled).
 */
async function isNotificationTypeEnabled(type: string): Promise<boolean> {
  const db = await requireDb();
  const rows = await db.select().from(notificationPreferences).limit(1);
  if (rows.length === 0) return true; // No preferences configured = all enabled
  const prefs = rows[0] as any;
  const prefKey = typeToPreferenceMap[type];
  if (!prefKey) return true; // Unmapped types are always allowed
  return prefs[prefKey] !== 0;
}

// ─── Write helpers ────────────────────────────────────────────────────────────

/**
 * Create a single notification for one recipient.
 * Respects notification preferences — skips silently if the type is disabled.
 */
export async function createNotification(
  input: CreateNotificationInput
): Promise<void> {
  // Check preferences before creating
  const enabled = await isNotificationTypeEnabled(input.type);
  if (!enabled) return;

  const db = await requireDb();
  await db.insert(notifications).values({
    recipientOpenId: input.recipientOpenId,
    actorOpenId: input.actorOpenId ?? null,
    actorName: input.actorName ?? null,
    type: input.type,
    title: input.title,
    body: input.body,
    linkUrl: input.linkUrl ?? null,
    projectId: input.projectId ?? null,
    blindTag: input.blindTag ?? null,
    isRead: 0,
  });
}

/**
 * Broadcast a notification to multiple recipients at once.
 * Respects notification preferences — skips silently if the type is disabled.
 */
export async function broadcastNotification(
  recipients: string[],
  input: Omit<CreateNotificationInput, "recipientOpenId">
): Promise<void> {
  if (recipients.length === 0) return;

  // Check preferences before broadcasting
  const enabled = await isNotificationTypeEnabled(input.type);
  if (!enabled) return;

  const db = await requireDb();
  await db.insert(notifications).values(
    recipients.map((openId) => ({
      recipientOpenId: openId,
      actorOpenId: input.actorOpenId ?? null,
      actorName: input.actorName ?? null,
      type: input.type,
      title: input.title,
      body: input.body,
      linkUrl: input.linkUrl ?? null,
      projectId: input.projectId ?? null,
      blindTag: input.blindTag ?? null,
      isRead: 0,
    }))
  );
}

// ─── Read helpers ─────────────────────────────────────────────────────────────

/**
 * Get all notifications for a user, newest first.
 * Optionally limit to unread only.
 */
export async function getNotificationsForUser(
  recipientOpenId: string,
  options: { unreadOnly?: boolean; limit?: number } = {}
): Promise<NotificationRow[]> {
  const db = await requireDb();
  const { unreadOnly = false, limit = 50 } = options;

  const conditions = [eq(notifications.recipientOpenId, recipientOpenId)];
  if (unreadOnly) {
    conditions.push(eq(notifications.isRead, 0));
  }

  return db
    .select()
    .from(notifications)
    .where(and(...conditions))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

/**
 * Count unread notifications for a user (used for the bell badge).
 */
export async function countUnreadNotifications(
  recipientOpenId: string
): Promise<number> {
  const db = await requireDb();
  const result = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(notifications)
    .where(
      and(
        eq(notifications.recipientOpenId, recipientOpenId),
        eq(notifications.isRead, 0)
      )
    );
  return result[0]?.count ?? 0;
}

// ─── Update helpers ───────────────────────────────────────────────────────────

/**
 * Mark a single notification as read.
 */
export async function markNotificationRead(
  id: number,
  recipientOpenId: string
): Promise<void> {
  const db = await requireDb();
  await db
    .update(notifications)
    .set({ isRead: 1, readAt: new Date() })
    .where(
      and(
        eq(notifications.id, id),
        eq(notifications.recipientOpenId, recipientOpenId)
      )
    );
}

/**
 * Mark all notifications as read for a user.
 */
export async function markAllNotificationsRead(
  recipientOpenId: string
): Promise<void> {
  const db = await requireDb();
  await db
    .update(notifications)
    .set({ isRead: 1, readAt: new Date() })
    .where(
      and(
        eq(notifications.recipientOpenId, recipientOpenId),
        eq(notifications.isRead, 0)
      )
    );
}

/**
 * Delete a single notification by id (only if owned by the recipient).
 */
export async function deleteNotificationById(
  id: number,
  recipientOpenId: string
): Promise<void> {
  const db = await requireDb();
  await db
    .delete(notifications)
    .where(
      and(
        eq(notifications.id, id),
        eq(notifications.recipientOpenId, recipientOpenId)
      )
    );
}

/**
 * Delete notifications older than N days (cleanup utility).
 */
export async function deleteOldNotifications(daysOld: number): Promise<void> {
  const db = await requireDb();
  const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
  await db
    .delete(notifications)
    .where(sql`${notifications.createdAt} < ${cutoff}`);
}
