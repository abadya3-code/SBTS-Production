/**
 * server/routers/reports.ts
 * ─────────────────────────
 * tRPC procedures for the Reports module.
 * Exposes aggregated data for all report types and export formats.
 */

import { z } from "zod";
import { permissionProcedure, router } from "../_core/trpc";
import {
  getDashboardSnapshot,
  getReportAreaSummaries,
  getReportBlinds,
  getReportGlobalStats,
  getReportProjectSummaries,
} from "../db";

const filtersSchema = z.object({
  areaId: z.number().int().positive().optional(),
  projectId: z.string().min(1).max(40).optional(),
  phase: z.enum([
    "Broken / Preparation",
    "Assembly",
    "Tight & Torque",
    "Final Tight",
    "Inspection Ready",
  ]).optional(),
  priority: z.enum(["Low", "Normal", "High", "Critical"]).optional(),
  status: z.string().optional(),
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
}).optional();

export const reportsRouter = router({
  /** Canonical eight-phase operational dashboard. */
  dashboardSnapshot: permissionProcedure("reports.view", "projects.view").query(async () =>
    getDashboardSnapshot()),

  /**
   * Global executive summary statistics.
   */
  globalStats: permissionProcedure("reports.view").query(async () => {
    return getReportGlobalStats();
  }),

  /**
   * All blinds with project/area context, supports filters.
   */
  blinds: permissionProcedure("reports.view")
    .input(filtersSchema)
    .query(async ({ input }) => {
      return getReportBlinds(input ?? undefined);
    }),

  /**
   * Project-level summaries with computed metrics.
   */
  projectSummaries: permissionProcedure("reports.view")
    .input(filtersSchema)
    .query(async ({ input }) => {
      return getReportProjectSummaries(input ?? undefined);
    }),

  /**
   * Area-level summaries with aggregated metrics.
   */
  areaSummaries: permissionProcedure("reports.view")
    .input(filtersSchema)
    .query(async ({ input }) => {
      return getReportAreaSummaries(input ?? undefined);
    }),
});
