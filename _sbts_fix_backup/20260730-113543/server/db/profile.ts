/**
 * server/db/profile.ts
 * ─────────────────────
 * Profile read/write helpers for the User Profile page.
 * Keeps personal info, avatar, and theme preference separate from auth logic.
 */

import { eq } from "drizzle-orm";
import { users } from "../../drizzle/schema";
import { requireDb } from "./core";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface UserProfile {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  avatarKey: string | null;
  role: "user" | "admin";
  userStatus: "pending" | "active" | "rejected";
  department: string | null;
  specialty: string | null;
  employeeNumber: string | null;
  bio: string | null;
  phone: string | null;
  userLocation: string | null;
  linkedIn: string | null;
  preferredTheme: string | null;
  createdAt: Date;
  lastSignedIn: Date;
}

export interface UpdateProfileInput {
  name?: string;
  bio?: string;
  phone?: string;
  userLocation?: string;
  linkedIn?: string;
  department?: string;
  specialty?: string;
  employeeNumber?: string;
  preferredTheme?: string;
}

// ─── Queries ───────────────────────────────────────────────────────────────

export async function getUserProfile(openId: string): Promise<UserProfile | null> {
  const db = await requireDb();
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);
  if (rows.length === 0) return null;
  const u = rows[0];
  return {
    id: u.id,
    openId: u.openId,
    name: u.name ?? null,
    email: u.email ?? null,
    avatarUrl: u.avatarUrl ?? null,
    avatarKey: (u as any).avatarKey ?? null,
    role: u.role,
    userStatus: u.userStatus,
    department: u.department ?? null,
    specialty: u.specialty ?? null,
    employeeNumber: u.employeeNumber ?? null,
    bio: (u as any).bio ?? null,
    phone: (u as any).phone ?? null,
    userLocation: (u as any).userLocation ?? null,
    linkedIn: (u as any).linkedIn ?? null,
    preferredTheme: (u as any).preferredTheme ?? "dark",
    createdAt: u.createdAt,
    lastSignedIn: u.lastSignedIn,
  };
}

export async function updateUserProfile(
  openId: string,
  data: UpdateProfileInput,
): Promise<void> {
  const db = await requireDb();
  const updates: Record<string, unknown> = {};
  if (data.name !== undefined) updates.name = data.name;
  if (data.bio !== undefined) updates.bio = data.bio;
  if (data.phone !== undefined) updates.phone = data.phone;
  if (data.userLocation !== undefined) updates.userLocation = data.userLocation;
  if (data.linkedIn !== undefined) updates.linkedIn = data.linkedIn;
  if (data.department !== undefined) updates.department = data.department;
  if (data.specialty !== undefined) updates.specialty = data.specialty;
  if (data.employeeNumber !== undefined) updates.employeeNumber = data.employeeNumber;
  if (data.preferredTheme !== undefined) updates.preferredTheme = data.preferredTheme;
  if (Object.keys(updates).length === 0) return;
  await db.update(users).set(updates as any).where(eq(users.openId, openId));
}

export async function updateUserAvatar(
  openId: string,
  avatarKey: string,
  avatarUrl: string,
): Promise<void> {
  const db = await requireDb();
  await db.update(users).set({
    avatarUrl,
    avatarKey,
  } as any).where(eq(users.openId, openId));
}
