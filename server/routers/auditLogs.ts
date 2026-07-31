/**
 * server/routers/auditLogs.ts
 * ───────────────────────────
 * tRPC router for the Audit Logs page.
 * Provides unified audit trail from workflow logs, approvals, and notifications.
 */
import { z } from "zod";
import { permissionProcedure, router } from "../_core/trpc";
import { getAuditLogs, getAuditLogStats } from "../db/auditLogs";

export const auditLogsRouter = router({
  /**
   * Get paginated audit logs with filters
   */
  list: permissionProcedure("audit.view")
    .input(
      z.object({
        source: z.enum(["workflow", "approval", "notification", "all"]).optional(),
        search: z.string().optional(),
        blindTag: z.string().optional(),
        projectId: z.string().optional(),
        actorName: z.string().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        limit: z.number().min(1).max(200).optional(),
        offset: z.number().min(0).optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      return getAuditLogs(input ?? {});
    }),

  /**
   * Get audit log statistics
   */
  stats: permissionProcedure("audit.view").query(async () => {
    return getAuditLogStats();
  }),
});
