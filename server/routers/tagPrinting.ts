import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { permissionProcedure, router } from "../_core/trpc";
import { prepareBlindTagPrint } from "../db/tagPrinting";

export const tagPrintingRouter = router({
  prepare: permissionProcedure("qr.manage", "reports.export")
    .input(
      z.object({
        projectId: z.string().trim().min(2).max(40),
        blindTags: z.array(z.string().trim().min(2).max(40)).min(1).max(200),
        output: z.enum(["print", "pdf"]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        return await prepareBlindTagPrint({
          ...input,
          actor: {
            openId: ctx.user.openId,
            name: ctx.user.name ?? null,
            email: ctx.user.email ?? null,
            role: ctx.user.role,
          },
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Tag print preparation failed.";
        throw new TRPCError({
          code: message.includes("not part") ? "NOT_FOUND" : "PRECONDITION_FAILED",
          message,
        });
      }
    }),
});
