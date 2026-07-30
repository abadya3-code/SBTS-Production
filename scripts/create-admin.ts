import "dotenv/config";
import { eq } from "drizzle-orm";
import { users } from "../drizzle/schema";
import {
  createUserWithPassword,
  getUserByEmail,
  updateUserPassword,
} from "../server/db/auth";
import { requireDb } from "../server/db/core";
import { seedSystemReferenceData } from "../server/db/seed";

function requireStrongPassword(password: string) {
  if (password.length < 12) {
    throw new Error("ADMIN_PASSWORD must be at least 12 characters.");
  }
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    throw new Error(
      "ADMIN_PASSWORD must contain uppercase, lowercase, number, and special character.",
    );
  }
}

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "";
  const name = process.env.ADMIN_NAME?.trim() || "SBTS Administrator";
  const employeeNumber =
    process.env.ADMIN_EMPLOYEE_NUMBER?.trim() || "SBTS-ADMIN";

  if (!email || !password) {
    throw new Error(
      "Set ADMIN_EMAIL and ADMIN_PASSWORD before running pnpm admin:create.",
    );
  }
  requireStrongPassword(password);

  await seedSystemReferenceData();

  const existing = await getUserByEmail(email);
  if (existing) {
    const db = await requireDb();

    // Bootstrap is intentionally idempotent: when enabled for a deployment it
    // resets the configured administrator password and clears lockout state.
    await updateUserPassword(existing.openId, password);
    await db
      .update(users)
      .set({
        role: "admin",
        userStatus: "active",
        loginMethod: "email",
        name,
        employeeNumber,
        failedLoginAttempts: 0,
        lockedUntil: null,
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.openId, existing.openId));

    console.log(
      `ADMIN_BOOTSTRAP_RESET_OK email=${email} commit=${process.env.RAILWAY_GIT_COMMIT_SHA ?? "local"}`,
    );
    return;
  }

  await createUserWithPassword({
    name,
    email,
    password,
    role: "admin",
    userStatus: "active",
    department: "System Administration",
    specialty: "Application Administration",
    employeeNumber,
    createdByOpenId: "deployment-bootstrap",
  });

  console.log(
    `ADMIN_BOOTSTRAP_CREATED_OK email=${email} commit=${process.env.RAILWAY_GIT_COMMIT_SHA ?? "local"}`,
  );
}

main().catch((error) => {
  console.error(
    "ADMIN_BOOTSTRAP_FAILED:",
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
