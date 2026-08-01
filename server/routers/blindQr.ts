import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { permissionProcedure, publicProcedure, router } from "../_core/trpc";
import {
  BlindQrDomainError,
  generateBlindQrBatch,
  generateBlindQrToken,
  getBlindQrBatchState,
  getBlindQrState,
  getPublicBlindQrVerification,
  revokeBlindQrToken,
  rotateBlindQrToken,
} from "../db/blindQr";

const blindScope = z.object({
  projectId: z.string().trim().min(1).max(40),
  blindTag: z.string().trim().min(1).max(40),
});

const blindBatchScope = z.object({
  projectId: z.string().trim().min(1).max(40),
  blindTags: z.array(z.string().trim().min(1).max(40)).min(1).max(200),
});

const verificationToken = z
  .string()
  .trim()
  .min(32)
  .max(96)
  .regex(/^[A-Za-z0-9_-]+$/, "Invalid QR verification token.");

function actor(user: {
  openId: string;
  name?: string | null;
  email?: string | null;
  role: "user" | "admin";
}) {
  return {
    openId: user.openId,
    name: user.name ?? null,
    email: user.email ?? null,
    role: user.role,
  };
}

function fail(error: unknown): never {
  if (error instanceof BlindQrDomainError) {
    throw new TRPCError({ code: error.code, message: error.message });
  }
  throw error;
}

export const blindQrRouter = router({
  state: permissionProcedure("qr.manage")
    .input(blindScope)
    .query(async ({ input, ctx }) => {
      try {
        return await getBlindQrState(input, actor(ctx.user));
      } catch (error) {
        fail(error);
      }
    }),

  batchState: permissionProcedure("qr.manage", "reports.export")
    .input(blindBatchScope)
    .query(async ({ input, ctx }) => {
      try {
        return await getBlindQrBatchState(input, actor(ctx.user));
      } catch (error) {
        fail(error);
      }
    }),

  generate: permissionProcedure("qr.manage")
    .input(blindScope)
    .mutation(async ({ input, ctx }) => {
      try {
        return await generateBlindQrToken(input, actor(ctx.user));
      } catch (error) {
        fail(error);
      }
    }),

  generateBatch: permissionProcedure("qr.manage")
    .input(blindBatchScope)
    .mutation(async ({ input, ctx }) => {
      try {
        return await generateBlindQrBatch(input, actor(ctx.user));
      } catch (error) {
        fail(error);
      }
    }),

  rotate: permissionProcedure("qr.manage")
    .input(blindScope)
    .mutation(async ({ input, ctx }) => {
      try {
        return await rotateBlindQrToken(input, actor(ctx.user));
      } catch (error) {
        fail(error);
      }
    }),

  revoke: permissionProcedure("qr.manage")
    .input(
      blindScope.extend({
        reason: z.string().trim().min(5).max(1000),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        return await revokeBlindQrToken(input, actor(ctx.user));
      } catch (error) {
        fail(error);
      }
    }),

  verify: publicProcedure
    .input(z.object({ token: verificationToken }))
    .query(async ({ input, ctx }) => {
      try {
        return await getPublicBlindQrVerification(input.token, {
          isAuthenticated: Boolean(ctx.user),
        });
      } catch (error) {
        fail(error);
      }
    }),
});
