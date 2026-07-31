/**
 * server/routers/auth.ts
 * ──────────────────────
 * Standalone email/password authentication procedures.
 * Respects Security Settings for password policy and session duration.
 *
 * Procedures:
 *   me             → return current authenticated user (or null)
 *   login          → verify email + password, set session cookie
 *   logout         → clear session cookie
 *   changePassword → change password for the authenticated user (or admin for any user)
 *   register       → self-registration: create account with pending status
 *   adminCreateUser → admin creates a new user
 */

import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "../_core/cookies";
import { toAuthUser } from "../_core/authUser";
import { ENV } from "../_core/env";
import { sdk } from "../_core/sdk";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "../_core/trpc";
import {
  clearFailedLogin,
  createUserWithPassword,
  getSecuritySettings,
  getUserByEmail,
  recordFailedLogin,
  updateUserPassword,
  verifyPassword,
} from "../db";
import { getUserByOpenId, upsertUser } from "../db/core";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Validate password against security settings policy.
 * Throws TRPCError if password doesn't meet requirements.
 */
async function validatePasswordPolicy(password: string): Promise<void> {
  const security = await getSecuritySettings();
  const minLength = security.minPasswordLength || 12;
  if (password.length < minLength) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Password must be at least ${minLength} characters`,
    });
  }
  if (security.requireStrongPassword) {
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);
    if (!hasUpper || !hasLower || !hasNumber || !hasSpecial) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Password must contain uppercase, lowercase, number, and special character",
      });
    }
  }
}

/**
 * Get session duration from security settings (in milliseconds).
 */
async function getSessionDurationMs(): Promise<number> {
  const security = await getSecuritySettings();
  const timeoutMinutes = security.sessionTimeoutMinutes || 480; // default 8 hours
  return timeoutMinutes * 60 * 1000;
}

// ─── Router ──────────────────────────────────────────────────────────────────

export const authRouter = router({
  /** Return the currently authenticated user, or null if not logged in. */
  me: publicProcedure.query((opts) => opts.ctx.user ? toAuthUser(opts.ctx.user) : null),

  /**
   * Login with email + password.
   * On success: creates a JWT session cookie and returns the user.
   * Respects session timeout from Security Settings.
   */
  login: publicProcedure
    .input(
      z.object({
        email: z.string().email("Invalid email address"),
        password: z.string().min(1, "Password is required"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const user = await getUserByEmail(input.email);

      if (!user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid email or password",
        });
      }

      if (!user.passwordHash) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "This account does not have a password set. Please contact an administrator.",
        });
      }

      const security = await getSecuritySettings();
      const now = new Date();
      if (user.lockedUntil && new Date(user.lockedUntil).getTime() > now.getTime()) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "This account is temporarily locked after repeated failed login attempts. Try again later or contact an administrator.",
        });
      }

      const isValid = await verifyPassword(input.password, user.passwordHash);
      if (!isValid) {
        const failure = await recordFailedLogin(
          user.openId,
          user.failedLoginAttempts ?? 0,
          security.maxLoginAttempts || 5,
          security.lockoutDurationMinutes || 15,
        );
        throw new TRPCError({
          code: failure.lockedUntil ? "TOO_MANY_REQUESTS" : "UNAUTHORIZED",
          message: failure.lockedUntil
            ? "This account has been temporarily locked after repeated failed login attempts."
            : "Invalid email or password",
        });
      }

      if (user.userStatus === "pending") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Your account is pending approval. Please wait for an administrator to approve your registration.",
        });
      }

      if (user.userStatus === "rejected") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Your account registration has been rejected. Please contact an administrator.",
        });
      }

      // Reset lockout counters and update last sign-in timestamp.
      await clearFailedLogin(user.openId);
      await upsertUser({ openId: user.openId, lastSignedIn: new Date() });

      // Get session duration from Security Settings
      const sessionDurationMs = await getSessionDurationMs();

      // Create JWT session token
      const sessionToken = await sdk.createSessionToken(user.openId, {
        name: user.name ?? "",
        expiresInMs: sessionDurationMs,
      });

      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, {
        ...cookieOptions,
        maxAge: sessionDurationMs,
      });

      return { success: true, user: toAuthUser(user) };
    }),

  /** Clear the session cookie. */
  logout: publicProcedure.mutation(({ ctx }) => {
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    return { success: true } as const;
  }),

  /**
   * Change password for the authenticated user.
   * Admins can change any user's password by providing targetOpenId.
   * Validates against Security Settings password policy.
   */
  changePassword: protectedProcedure
    .input(
      z.object({
        currentPassword: z.string().optional(),
        newPassword: z.string().min(1, "Password is required"),
        targetOpenId: z.string().optional(), // Admin-only: change another user's password
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Validate new password against security policy
      await validatePasswordPolicy(input.newPassword);

      const isAdmin = ctx.user.role === "admin";
      const targetOpenId = input.targetOpenId ?? ctx.user.openId;

      // Non-admins can only change their own password
      if (!isAdmin && targetOpenId !== ctx.user.openId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only change your own password",
        });
      }

      const targetUser = await getUserByOpenId(targetOpenId);
      if (!targetUser) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      // Non-admins must verify their current password
      if (!isAdmin || targetOpenId === ctx.user.openId) {
        if (!input.currentPassword) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Current password is required",
          });
        }
        if (targetUser.passwordHash) {
          const isValid = await verifyPassword(input.currentPassword, targetUser.passwordHash);
          if (!isValid) {
            throw new TRPCError({
              code: "UNAUTHORIZED",
              message: "Current password is incorrect",
            });
          }
        }
      }

      await updateUserPassword(targetOpenId, input.newPassword);
      return { success: true } as const;
    }),

  /**
   * Self-registration: create an account with pending status.
   * Admin must approve before the user can log in.
   * Validates against Security Settings password policy.
   */
  register: publicProcedure
    .input(
      z.object({
        name: z.string().min(2, "Name must be at least 2 characters"),
        email: z.string().email("Invalid email address"),
        password: z.string().min(1, "Password is required"),
        department: z.string().min(1, "Department is required"),
        specialty: z.string().min(1, "Specialty is required"),
        employeeNumber: z.string().min(1, "Employee number is required"),
        registrationNote: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      // Validate password against security policy
      await validatePasswordPolicy(input.password);

      // Check if email already exists
      const existing = await getUserByEmail(input.email);
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "An account with this email already exists",
        });
      }

      await createUserWithPassword({
        name: input.name,
        email: input.email,
        password: input.password,
        role: "user",
        userStatus: "pending",
        department: input.department,
        specialty: input.specialty,
        employeeNumber: input.employeeNumber,
        registrationNote: input.registrationNote,
      });

      return { success: true } as const;
    }),

  /**
   * Admin: create a new user account with active status.
   * The admin sets the initial password and the user can change it later.
   * Validates against Security Settings password policy.
   */
  adminCreateUser: adminProcedure
    .input(
      z.object({
        name: z.string().min(2, "Name must be at least 2 characters"),
        email: z.string().email("Invalid email address"),
        password: z.string().min(1, "Password is required"),
        role: z.enum(["admin", "user"]).default("user"),
        department: z.string().optional(),
        specialty: z.string().optional(),
        employeeNumber: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Validate password against security policy
      await validatePasswordPolicy(input.password);

      // Check if email already exists
      const existing = await getUserByEmail(input.email);
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "An account with this email already exists",
        });
      }

      const user = await createUserWithPassword({
        name: input.name,
        email: input.email,
        password: input.password,
        role: input.role,
        userStatus: "active",
        department: input.department,
        specialty: input.specialty,
        employeeNumber: input.employeeNumber,
        createdByOpenId: ctx.user.openId,
      });

      return { success: true, userId: user.id } as const;
    }),
});
