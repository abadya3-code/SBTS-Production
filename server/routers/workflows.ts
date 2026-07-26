/**
 * server/routers/workflows.ts
 * ───────────────────────────
 * Procedures for workflow template management.
 */

import { z } from "zod";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
import { deleteWorkflow, getAllWorkflows, getWorkflowById, upsertWorkflow } from "../db";
import { workflowTemplateSchema } from "./shared";

export const workflowRouter = router({
  list: protectedProcedure.query(async () => getAllWorkflows()),

  get: protectedProcedure
    .input(z.object({ id: z.string().min(1).max(96) }))
    .query(async ({ input }) => getWorkflowById(input.id)),

  save: protectedProcedure
    .input(workflowTemplateSchema)
    .mutation(async ({ input, ctx }) => upsertWorkflow(input, ctx.user.openId)),

  delete: adminProcedure
    .input(z.object({ id: z.string().min(1).max(96) }))
    .mutation(async ({ input }) => {
      await deleteWorkflow(input.id);
      return { success: true } as const;
    }),
});
