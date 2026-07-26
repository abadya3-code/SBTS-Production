/**
 * server/db/auditLogs.ts
 * ──────────────────────
 * DB helpers for the Audit Logs page.
 * Aggregates data from blind_workflow_logs, blind_phase_approvals, and notifications
 * into a unified audit trail.
 */
import { desc, eq, and, like, sql, gte, lte, or } from "drizzle-orm";
import { requireDb } from "./core";
import { blindWorkflowLogs, blindPhaseApprovals, notifications } from "../../drizzle/schema";

export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  source: "workflow" | "approval" | "notification";
  action: string;
  message: string;
  actorName: string | null;
  actorOpenId: string | null;
  blindTag: string | null;
  projectId: string | null;
  phase: string | null;
  severity: "info" | "warning" | "critical";
}

export interface AuditLogFilters {
  source?: "workflow" | "approval" | "notification" | "all";
  search?: string;
  blindTag?: string;
  projectId?: string;
  actorName?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

/**
 * Get unified audit logs from all sources with filtering and pagination.
 */
export async function getAuditLogs(filters: AuditLogFilters = {}): Promise<{
  logs: AuditLogEntry[];
  total: number;
}> {
  const db = await requireDb();
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;

  // Build results from each source
  const results: AuditLogEntry[] = [];

  // 1. Workflow Logs
  if (!filters.source || filters.source === "all" || filters.source === "workflow") {
    const conditions: any[] = [];
    if (filters.blindTag) conditions.push(eq(blindWorkflowLogs.blindTag, filters.blindTag));
    if (filters.projectId) conditions.push(eq(blindWorkflowLogs.projectId, filters.projectId));
    if (filters.actorName) conditions.push(like(blindWorkflowLogs.actorName, `%${filters.actorName}%`));
    if (filters.search) conditions.push(or(
      like(blindWorkflowLogs.action, `%${filters.search}%`),
      like(blindWorkflowLogs.message, `%${filters.search}%`),
    ));
    if (filters.dateFrom) conditions.push(gte(blindWorkflowLogs.createdAt, new Date(filters.dateFrom)));
    if (filters.dateTo) conditions.push(lte(blindWorkflowLogs.createdAt, new Date(filters.dateTo)));

    const wfLogs = await db
      .select()
      .from(blindWorkflowLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(blindWorkflowLogs.createdAt))
      .limit(500);

    for (const log of wfLogs) {
      results.push({
        id: `wf-${log.id}`,
        timestamp: log.createdAt,
        source: "workflow",
        action: log.action,
        message: log.message,
        actorName: log.actorName,
        actorOpenId: log.actorOpenId,
        blindTag: log.blindTag,
        projectId: log.projectId,
        phase: log.phase,
        severity: log.action.toLowerCase().includes("reject") || log.action.toLowerCase().includes("revok")
          ? "critical"
          : log.action.toLowerCase().includes("advance") || log.action.toLowerCase().includes("approv")
          ? "info"
          : "info",
      });
    }
  }

  // 2. Phase Approvals
  if (!filters.source || filters.source === "all" || filters.source === "approval") {
    const conditions: any[] = [];
    if (filters.blindTag) conditions.push(eq(blindPhaseApprovals.blindTag, filters.blindTag));
    if (filters.projectId) conditions.push(eq(blindPhaseApprovals.projectId, filters.projectId));
    if (filters.actorName) conditions.push(like(blindPhaseApprovals.approvedByName, `%${filters.actorName}%`));
    if (filters.search) conditions.push(like(blindPhaseApprovals.note, `%${filters.search}%`));
    if (filters.dateFrom) conditions.push(gte(blindPhaseApprovals.createdAt, new Date(filters.dateFrom)));
    if (filters.dateTo) conditions.push(lte(blindPhaseApprovals.createdAt, new Date(filters.dateTo)));

    const approvals = await db
      .select()
      .from(blindPhaseApprovals)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(blindPhaseApprovals.createdAt))
      .limit(500);

    for (const a of approvals) {
      const isRevoked = a.revokedAt !== null;
      results.push({
        id: `ap-${a.id}`,
        timestamp: a.createdAt,
        source: "approval",
        action: isRevoked ? "Phase Approval Revoked" : a.approved ? "Phase Approved" : "Phase Rejected",
        message: a.note || `Phase ${a.phase} ${isRevoked ? "revoked" : a.approved ? "approved" : "rejected"}`,
        actorName: a.approvedByName,
        actorOpenId: a.approvedByOpenId,
        blindTag: a.blindTag,
        projectId: a.projectId,
        phase: a.phase,
        severity: isRevoked || !a.approved ? "critical" : "info",
      });
    }
  }

  // 3. Notifications (system events)
  if (!filters.source || filters.source === "all" || filters.source === "notification") {
    const conditions: any[] = [];
    if (filters.blindTag) conditions.push(eq(notifications.blindTag, filters.blindTag));
    if (filters.search) conditions.push(or(
      like(notifications.title, `%${filters.search}%`),
      like(notifications.body, `%${filters.search}%`),
    ));
    if (filters.dateFrom) conditions.push(gte(notifications.createdAt, new Date(filters.dateFrom)));
    if (filters.dateTo) conditions.push(lte(notifications.createdAt, new Date(filters.dateTo)));

    const notifs = await db
      .select()
      .from(notifications)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(notifications.createdAt))
      .limit(500);

    for (const n of notifs) {
      results.push({
        id: `nt-${n.id}`,
        timestamp: n.createdAt,
        source: "notification",
        action: n.title,
        message: n.body,
        actorName: n.actorName,
        actorOpenId: n.actorOpenId,
        blindTag: n.blindTag,
        projectId: n.projectId ? String(n.projectId) : null,
        phase: null,
        severity: (n.type as string).includes("reject") ? "critical" : "info",
      });
    }
  }

  // Sort all results by timestamp descending
  results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  const total = results.length;
  const paginated = results.slice(offset, offset + limit);

  return { logs: paginated, total };
}

/**
 * Get audit log statistics
 */
export async function getAuditLogStats() {
  const db = await requireDb();

  const [wfCount] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(blindWorkflowLogs);

  const [apCount] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(blindPhaseApprovals);

  const [ntCount] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(notifications);

  // Recent activity (last 24 hours)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [recentWf] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(blindWorkflowLogs)
    .where(gte(blindWorkflowLogs.createdAt, oneDayAgo));

  const [recentAp] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(blindPhaseApprovals)
    .where(gte(blindPhaseApprovals.createdAt, oneDayAgo));

  return {
    totalWorkflowLogs: wfCount?.count ?? 0,
    totalApprovals: apCount?.count ?? 0,
    totalNotifications: ntCount?.count ?? 0,
    totalAll: (wfCount?.count ?? 0) + (apCount?.count ?? 0) + (ntCount?.count ?? 0),
    recentActivity: (recentWf?.count ?? 0) + (recentAp?.count ?? 0),
  };
}
