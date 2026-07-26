import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

/**
 * Build tRPC context for every request.
 *
 * Authentication flow (standalone email/password):
 *   1. sdk.authenticateRequest reads the JWT session cookie
 *   2. Verifies the JWT and looks up the user in the database by openId
 *   3. Returns null for public procedures if no valid session exists
 *
 * The SDK's authenticateRequest no longer calls the Manus OAuth server —
 * it only verifies the local JWT and fetches the user from the DB.
 * The OAuth sync block inside sdk.ts is bypassed because local users
 * always exist in the DB after login.
 */
export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch {
    // Authentication is optional for public procedures.
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
