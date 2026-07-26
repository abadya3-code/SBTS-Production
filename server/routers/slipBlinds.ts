/**
 * server/routers/slipBlinds.ts
 * tRPC procedures for Slip Blind tracking and periodic safety surveys.
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  createSlipBlindSurvey,
  getBlindSurveyHistory,
  getSlipBlindSurveyDetail,
  getSlipBlindSurveys,
  getSlipBlindsList,
  getSlipBlindsStats,
} from "../db/slipBlinds";
import { getBlindDetail } from "../db/blinds";

export const slipBlindsRouter = router({
  /**
   * Aggregate statistics for the Slip Blinds dashboard.
   */
  stats: protectedProcedure
    .input(
      z.object({
        projectId: z.string().optional(),
        areaId: z.number().optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      return getSlipBlindsStats(input ?? {});
    }),

  /**
   * Paginated list of all slip blinds with filters.
   */
  list: protectedProcedure
    .input(
      z.object({
        projectId: z.string().optional(),
        areaId: z.number().optional(),
        slipStatus: z.enum(["all", "in_service", "removed", "merged", "unknown"]).optional(),
        priority: z.string().optional(),
        search: z.string().optional(),
        limit: z.number().min(1).max(500).optional(),
        offset: z.number().min(0).optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      return getSlipBlindsList(input ?? {});
    }),

  /**
   * List all surveys with optional filters.
   */
  surveys: protectedProcedure
    .input(
      z.object({
        projectId: z.string().optional(),
        areaId: z.number().optional(),
        status: z.enum(["draft", "submitted", "approved"]).optional(),
        limit: z.number().min(1).max(100).optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      return getSlipBlindSurveys(input ?? {});
    }),

  /**
   * Get a single survey with all its items.
   */
  surveyDetail: protectedProcedure
    .input(z.object({ surveyId: z.number() }))
    .query(async ({ input }) => {
      return getSlipBlindSurveyDetail(input.surveyId);
    }),

  /**
   * Get full detail for a single slip blind:
   * - Blind metadata (type, size, phase, priority, location…)
   * - Workflow logs (phase change history)
   * - Phase approvals timeline
   * - Survey history for this specific blind
   */
  blindDetail: protectedProcedure
    .input(z.object({ projectId: z.string(), tag: z.string() }))
    .query(async ({ input }) => {
      const [detail, surveyHistory] = await Promise.all([
        getBlindDetail(input.projectId, input.tag),
        getBlindSurveyHistory(input.tag),
      ]);
      if (!detail) return null;
      return {
        blind: detail.blind,
        project: { id: detail.project.id, name: detail.project.name },
        phaseTimeline: detail.phaseTimeline,
        logs: detail.logs,
        surveyHistory,
      };
    }),

  /**
   * Export all slip blind data for safety reporting.
   * Returns a structured payload with stats, blinds list, and survey history.
   */
  exportData: protectedProcedure
    .input(
      z.object({
        projectId: z.string().optional(),
        areaId: z.number().optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      const [stats, listResult, surveys] = await Promise.all([
        getSlipBlindsStats(input ?? {}),
        getSlipBlindsList({ ...input, limit: 1000 }),
        getSlipBlindSurveys({ ...input, limit: 100 }),
      ]);
      return {
        exportedAt: new Date().toISOString(),
        stats,
        blinds: listResult.rows,
        surveys,
      };
    }),

  /**
   * Create a new periodic safety survey.
   */
  createSurvey: protectedProcedure
    .input(
      z.object({
        surveyDate: z.string(),
        areaId: z.number().optional(),
        projectId: z.string().optional(),
        notes: z.string().optional(),
        items: z.array(
          z.object({
            blindTag: z.string(),
            projectId: z.string(),
            slipStatus: z.enum(["in_service", "removed", "merged", "unknown"]),
            foremanApproved: z.boolean(),
            physicalCondition: z.enum(["good", "fair", "damaged", "missing"]),
            location: z.string().optional(),
            notes: z.string().optional(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return createSlipBlindSurvey({
        ...input,
        conductedByOpenId: ctx.user.openId,
        conductedByName: ctx.user.name ?? "Unknown",
      });
    }),
});
