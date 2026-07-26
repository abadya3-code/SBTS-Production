/**
 * server/db/auth.ts
 * ─────────────────
 * Standalone email/password authentication helpers.
 * Replaces Manus OAuth for user identity management.
 *
 * Functions:
 *   hashPassword        → bcrypt hash a plain-text password
 *   verifyPassword      → compare plain-text against a stored hash
 *   getUserByEmail      → look up a user by email address
 *   createUserWithPassword → insert a new user with a hashed password
 *   updateUserPassword  → change a user's password (admin or self)
 */

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { users } from "../../drizzle/schema";
import { requireDb } from "./core";

const BCRYPT_ROUNDS = 12;

// ─── Password Utilities ────────────────────────────────────────────────────

/** Hash a plain-text password using bcrypt. */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/** Compare a plain-text password against a stored bcrypt hash. */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ─── User Lookup ───────────────────────────────────────────────────────────

/** Return the user row matching the given email, or null if not found. */
export async function getUserByEmail(email: string) {
  const db = await requireDb();
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase().trim()))
    .limit(1);
  return rows.length > 0 ? rows[0] : null;
}

// ─── User Creation ─────────────────────────────────────────────────────────

export interface CreateUserInput {
  /** Display name */
  name: string;
  /** Email address — used as login identifier */
  email: string;
  /** Plain-text password (will be hashed before storage) */
  password: string;
  /** System role: 'admin' or 'user' (default: 'user') */
  role?: "admin" | "user";
  /** Registration status (default: 'active' for admin-created accounts) */
  userStatus?: "pending" | "active" | "rejected";
  department?: string;
  specialty?: string;
  employeeNumber?: string;
  registrationNote?: string;
  /** openId for the admin who created this account */
  createdByOpenId?: string;
}

/**
 * Create a new user with a hashed password.
 * Generates a deterministic openId from the email so the rest of the system
 * (which uses openId as the primary identity key) keeps working unchanged.
 */
export async function createUserWithPassword(input: CreateUserInput) {
  const db = await requireDb();
  const passwordHash = await hashPassword(input.password);
  const normalizedEmail = input.email.toLowerCase().trim();

  // Derive a stable openId from the email so it never clashes with OAuth openIds
  // (which are UUIDs from Manus). We prefix with "local_" to make the source obvious.
  const openId = `local_${Buffer.from(normalizedEmail).toString("base64url").slice(0, 40)}`;

  const now = new Date();
  await db.insert(users).values({
    openId,
    name: input.name,
    email: normalizedEmail,
    avatarUrl: null,
    loginMethod: "email",
    role: input.role ?? "user",
    userStatus: input.userStatus ?? "active",
    department: input.department ?? null,
    specialty: input.specialty ?? null,
    employeeNumber: input.employeeNumber ?? null,
    registrationNote: input.registrationNote ?? null,
    approvedByOpenId: input.createdByOpenId ?? null,
    approvedAt: input.userStatus === "active" ? now : null,
    passwordHash,
    failedLoginAttempts: 0,
    lockedUntil: null,
    passwordChangedAt: now,
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
  });

  const rows = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);
  return rows[0];
}

// ─── Password Update ───────────────────────────────────────────────────────

/** Update the stored password hash for a user identified by openId. */
export async function updateUserPassword(
  openId: string,
  newPassword: string
): Promise<void> {
  const db = await requireDb();
  const passwordHash = await hashPassword(newPassword);
  await db
    .update(users)
    .set({
      passwordHash,
      failedLoginAttempts: 0,
      lockedUntil: null,
      passwordChangedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(users.openId, openId));
}


/** Record a failed password attempt and lock the account when the policy limit is reached. */
export async function recordFailedLogin(
  openId: string,
  currentAttempts: number,
  maxAttempts: number,
  lockoutDurationMinutes: number,
): Promise<{ lockedUntil: Date | null; attempts: number }> {
  const db = await requireDb();
  const attempts = Math.max(0, currentAttempts) + 1;
  const shouldLock = attempts >= Math.max(1, maxAttempts);
  const lockedUntil = shouldLock
    ? new Date(Date.now() + Math.max(1, lockoutDurationMinutes) * 60_000)
    : null;
  await db
    .update(users)
    .set({
      failedLoginAttempts: shouldLock ? 0 : attempts,
      lockedUntil,
      updatedAt: new Date(),
    })
    .where(eq(users.openId, openId));
  return { lockedUntil, attempts };
}

/** Clear lockout counters after a successful login or administrator reset. */
export async function clearFailedLogin(openId: string): Promise<void> {
  const db = await requireDb();
  await db
    .update(users)
    .set({ failedLoginAttempts: 0, lockedUntil: null, updatedAt: new Date() })
    .where(eq(users.openId, openId));
}
