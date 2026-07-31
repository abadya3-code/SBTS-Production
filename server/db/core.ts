/**
 * server/db/core.ts
 * ─────────────────
 * Database connection bootstrapping and core user helpers.
 * All other db/* modules import `getDb` / `requireDb` from here.
 */

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { ENV } from "../_core/env";
import { getDatabaseUrl } from "../_core/databaseUrl";
import { InsertUser, users } from "../../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;

/** Lazily create the drizzle instance so local tooling can run without a DB. */
export async function getDb() {
  if (_db) return _db;
  const databaseUrl = getDatabaseUrl(process.env.DATABASE_URL, {
    required: false,
    production: process.env.NODE_ENV === "production",
  });
  if (!databaseUrl) return null;
  try {
    _db = drizzle(databaseUrl);
  } catch (error) {
    console.error("[Database] Failed to initialize connection:", error);
    _db = null;
  }
  return _db;
}

export async function requireDb() {
  const db = await getDb();
  if (!db) {
    throw new Error(
      "Database is not available. Verify DATABASE_URL before using workflow persistence."
    );
  }
  return db;
}

/**
 * Close the lazily-created Drizzle/MySQL pool used by standalone CLI tasks.
 *
 * The long-running application server intentionally leaves this pool open.
 * Pre-deploy scripts must call this function in `finally`, otherwise Node keeps
 * the MySQL sockets alive after the task has printed its success message and
 * Railway waits until the pre-deploy command times out.
 */
export async function closeDb(): Promise<void> {
  const db = _db;
  _db = null;
  if (!db) return;

  await new Promise<void>((resolve, reject) => {
    db.$client.end(error => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "avatarUrl", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }
    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }
    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }
    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }
  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}
