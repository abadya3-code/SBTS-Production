import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getCertificateReadiness, getPublicCertificateVerification, issueCertificate, listBlindCertificates, revokeCertificate } from "../db";

const actor = (user: { openId: string; name?: string | null; email?: string | null; role: "user" | "admin" }) => ({ openId: user.openId, name: user.name ?? null, email: user.email ?? null, role: user.role });
function fail(error: unknown): never { const message = error instanceof Error ? error.message : "Certificate operation failed."; throw new TRPCError({ code: message.includes("Permission") ? "FORBIDDEN" : message.includes("not found") ? "NOT_FOUND" : "BAD_REQUEST", message }); }

export const certificatesRouter = router({
  readiness: protectedProcedure.input(z.object({ projectId: z.string().min(2).max(40), blindTag: z.string().min(2).max(40) })).query(async ({ input }) => { try { return await getCertificateReadiness(input.projectId, input.blindTag); } catch (error) { fail(error); } }),
  list: protectedProcedure.input(z.object({ projectId: z.string().min(2).max(40), blindTag: z.string().min(2).max(40) })).query(async ({ input, ctx }) => { try { return await listBlindCertificates(input.projectId, input.blindTag, actor(ctx.user)); } catch (error) { fail(error); } }),
  issue: protectedProcedure.input(z.object({ projectId: z.string().min(2).max(40), blindTag: z.string().min(2).max(40), reason: z.string().trim().max(2000).nullable().optional(), reissue: z.boolean().optional() })).mutation(async ({ input, ctx }) => { try { return await issueCertificate(input, actor(ctx.user)); } catch (error) { fail(error); } }),
  revoke: protectedProcedure.input(z.object({ certificateId: z.number().int().positive(), reason: z.string().trim().min(5).max(2000) })).mutation(async ({ input, ctx }) => { try { return await revokeCertificate(input, actor(ctx.user)); } catch (error) { fail(error); } }),
  verify: publicProcedure.input(z.object({ token: z.string().trim().min(20).max(120) })).query(async ({ input }) => { try { return await getPublicCertificateVerification(input.token); } catch (error) { fail(error); } }),
});
