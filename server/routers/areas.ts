/**
 * server/routers/areas.ts
 * ───────────────────────
 * Procedures for plant areas management.
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { permissionProcedure, router } from "../_core/trpc";
import { createArea, getAreaById, getAreas } from "../db";
import { areaCreateSchema } from "./shared";

export const areasRouter = router({
  list: permissionProcedure("projects.view").query(async () => getAreas()),

  getById: permissionProcedure("projects.view")
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => getAreaById(input.id)),

  create: permissionProcedure("projects.create")
    .input(areaCreateSchema)
    .mutation(async ({ input }) => {
      try {
        return await createArea(input);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Area creation failed.";
        if (/already exists/i.test(message)) {
          throw new TRPCError({ code: "CONFLICT", message });
        }
        throw error;
      }
    }),
});
