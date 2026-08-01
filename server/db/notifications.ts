/**
 * server/db/notifications.ts
 * ──────────────────────────
 * Database helpers for the in-app notification system.
 * All functions operate on the `notifications` table.
 * Notification creation respects `notification_preferences` settings.
 */

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  notifications,
  notificationPreferences,
  userRoleAssignments,
  users,
} from "../../drizzle/schema";
import type { InsertNotification, NotificationRow } from "../../drizzle/schema";
import { requireDb } from "./core";

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotificationType = NonNullable<InsertNotification["type"]>;
export type NotificationPriority = "info" | "action" | "warning" | "critical";
export type NotificationScope = "active" | "archived" | "all";

export interface NotificationListOptions {
  scope?: NotificationScope;
  unreadOnly?: boolean;
  type?: NotificationType;
  priority?: NotificationPriority;
  limit?: number;
}

export interface CreateNotificationInput {
  recipientOpenId: string;
  actorOpenId?: string;
  actorName?: string;
  type: NotificationType;
  priority?: NotificationPriority;
  title: string;
  body: string;
  linkUrl?: string;
  projectId?: string;
  blindTag?: string;
}

/**
 * Resolve active administrators plus explicitly assigned operational roles.
 * Event producers use this shared resolver so QR, certificate and print
 * notifications follow the same audience contract without copying role SQL.
 */
export async function getOperationalNotificationRecipients(
  roleKeys: string[],
  excludeOpenIds: string[] = []
): Promise<string[]> {
  const db = await requireDb();
  const [adminRows, roleRows] = await Promise.all([
    db
      .select({ openId: users.openId })
      .from(users)
      .where(and(eq(users.role, "admin"), eq(users.userStatus, "active"))),
    roleKeys.length
      ? db
          .select({ openId: users.openId })
          .from(userRoleAssignments)
          .innerJoin(users, eq(users.id, userRoleAssignments.userId))
          .where(
            and(
              inArray(userRoleAssignments.roleKey, roleKeys),
              eq(users.userStatus, "active")
            )
          )
      : Promise.resolve([]),
  ]);
  const excluded = new Set(excludeOpenIds);
  return Array.from(
    new Set([...adminRows, ...roleRows].map(row => String(row.openId)))
  ).filter(openId => openId && !excluded.has(openId));
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
  qr_token_issued: "qrTokenChanged",
  qr_token_rotated: "qrTokenChanged",
  qr_token_revoked: "qrTokenChanged",
  certificate_issued: "certificateStatusChanged",
  certificate_revoked: "certificateStatusChanged",
  tag_printed: "tagPrintRequested",
  system_announcement: "systemAnnouncement",
};

const defaultPriorityByType: Record<string, NotificationPriority> = {
  registration_request: "action",
  registration_rejected: "warning",
  blind_phase_approval: "action",
  workflow_gate_blocked: "warning",
  workflow_approval_required: "action",
  safety_hold_placed: "critical",
  qr_token_revoked: "warning",
  certificate_revoked: "critical",
};

function resolveNotificationPriority(
  type: NotificationType,
  priority?: NotificationPriority
): NotificationPriority {
  return priority ?? defaultPriorityByType[type] ?? "info";
}

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
    priority: resolveNotificationPriority(input.type, input.priority),
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
    recipients.map(openId => ({
      recipientOpenId: openId,
      actorOpenId: input.actorOpenId ?? null,
      actorName: input.actorName ?? null,
      type: input.type,
      priority: resolveNotificationPriority(input.type, input.priority),
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
  options: NotificationListOptions = {}
): Promise<NotificationRow[]> {
  const db = await requireDb();
  const {
    scope = "active",
    unreadOnly = false,
    type,
    priority,
    limit = 50,
  } = options;
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 200);

  const conditions = [eq(notifications.recipientOpenId, recipientOpenId)];
  if (scope === "active") {
    conditions.push(eq(notifications.isArchived, 0));
  } else if (scope === "archived") {
    conditions.push(eq(notifications.isArchived, 1));
  }
  if (unreadOnly) {
    conditions.push(eq(notifications.isRead, 0));
  }
  if (type) {
    conditions.push(eq(notifications.type, type));
  }
  if (priority) {
    conditions.push(eq(notifications.priority, priority));
  }

  return db
    .select()
    .from(notifications)
    .where(and(...conditions))
    .orderBy(desc(notifications.createdAt))
    .limit(safeLimit);
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
        eq(notifications.isRead, 0),
        eq(notifications.isArchived, 0)
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
        eq(notifications.isRead, 0),
        eq(notifications.isArchived, 0)
      )
    );
}

/**
 * Move an owned notification out of the active inbox.
 * Archiving also acknowledges unread work so the bell remains actionable.
 */
export async function archiveNotification(
  id: number,
  recipientOpenId: string
): Promise<void> {
  const db = await requireDb();
  const now = new Date();
  await db
    .update(notifications)
    .set({ isArchived: 1, archivedAt: now, isRead: 1, readAt: now })
    .where(
      and(
        eq(notifications.id, id),
        eq(notifications.recipientOpenId, recipientOpenId)
      )
    );
}

/** Restore an owned notification to the active inbox. */
export async function restoreNotification(
  id: number,
  recipientOpenId: string
): Promise<void> {
  const db = await requireDb();
  await db
    .update(notifications)
    .set({ isArchived: 0, archivedAt: null })
    .where(
      and(
        eq(notifications.id, id),
        eq(notifications.recipientOpenId, recipientOpenId)
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
