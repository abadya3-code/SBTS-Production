/**
 * server/routers/workflows.ts
 * ───────────────────────────
 * Procedures for workflow template management.
 */

import { z } from "zod";
import { adminProcedure, permissionProcedure, router } from "../_core/trpc";
import { deleteWorkflow, getAllWorkflows, getWorkflowById, upsertWorkflow } from "../db";
import { workflowTemplateSchema } from "./shared";

export const workflowRouter = router({
  list: permissionProcedure("workflow.view").query(async () => getAllWorkflows()),

  get: permissionProcedure("workflow.view")
    .input(z.object({ id: z.string().min(1).max(96) }))
    .query(async ({ input }) => getWorkflowById(input.id)),

  save: permissionProcedure("workflow.configure")
    .input(workflowTemplateSchema)
    .mutation(async ({ input, ctx }) => upsertWorkflow(input, ctx.user.openId)),

  delete: adminProcedure
    .input(z.object({ id: z.string().min(1).max(96) }))
    .mutation(async ({ input }) => {
      await deleteWorkflow(input.id);
      return { success: true } as const;
    }),
});
