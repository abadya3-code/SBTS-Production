import "dotenv/config";
import bcrypt from "bcryptjs";
import mysql from "mysql2/promise";
import { getDatabaseUrl } from "../server/_core/databaseUrl";
import { ENV } from "../server/_core/env";
import { sdk } from "../server/_core/sdk";

const requiredTables = [
  "users",
  "access_permissions",
  "access_roles",
  "access_role_permissions",
  "workflow_templates",
  "workflow_phases",
  "project_workflow_assignments",
  "blind_workflow_runtime",
  "certificate_records",
  "areas",
  "projects",
  "blinds",
  "feature_toggles",
  "sbts_domain_migrations",
  "sbts_domain_migration_steps",
];

function bool(value: string | undefined) {
  return ["1", "true", "yes", "on"].includes((value ?? "").trim().toLowerCase());
}

async function scalarCount(
  connection: mysql.Connection,
  statement: string,
  params: unknown[] = [],
): Promise<number> {
  const [rows] = await connection.execute<mysql.RowDataPacket[]>(statement, params);
  return Number(rows[0]?.rowCount ?? rows[0]?.count ?? 0);
}

async function main() {
  const databaseUrl = getDatabaseUrl(process.env.DATABASE_URL, {
    required: true,
    production: process.env.NODE_ENV === "production",
  })!;
  if (ENV.cookieSecret.length < 32) {
    throw new Error("JWT_SECRET must contain at least 32 characters.");
  }
  if (!ENV.appId) throw new Error("VITE_APP_ID/appId must not be empty.");

  const connection = await mysql.createConnection(databaseUrl);
  try {
    await connection.query("SELECT 1 AS healthy");

    const [tableRows] = await connection.query<mysql.RowDataPacket[]>(
      `SELECT table_name AS tableName
         FROM information_schema.tables
        WHERE table_schema = DATABASE()`,
    );
    const present = new Set(tableRows.map((row) => String(row.tableName)));
    const missing = requiredTables.filter((table) => !present.has(table));
    if (missing.length) {
      throw new Error(`Database is missing required tables: ${missing.join(", ")}`);
    }

    const [migrationRows] = await connection.execute<mysql.RowDataPacket[]>(
      "SELECT migrationName FROM sbts_domain_migrations WHERE migrationName = ? LIMIT 1",
      ["0018_sprint6_schema_alignment.sql"],
    );
    if (!migrationRows.length) {
      throw new Error("Schema-alignment migration 0018 is not recorded as applied.");
    }

    const requiredBlindColumns = [
      "material", "flangeType", "gasketType", "boltSize", "torqueValue", "thickness",
      "tempRating", "pidRef", "isoDrawing", "lineNumber2", "installDate", "expiryDate",
    ];
    const [blindColumnRows] = await connection.query<mysql.RowDataPacket[]>(
      `SELECT column_name AS columnName
         FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 'blinds'`,
    );
    const blindColumns = new Set(blindColumnRows.map((row) => String(row.columnName)));
    const missingBlindColumns = requiredBlindColumns.filter((column) => !blindColumns.has(column));
    if (missingBlindColumns.length) {
      throw new Error(`blinds is missing required columns: ${missingBlindColumns.join(", ")}`);
    }

    const permissionCount = await scalarCount(
      connection,
      "SELECT COUNT(*) AS rowCount FROM access_permissions",
    );
    const roleCount = await scalarCount(
      connection,
      "SELECT COUNT(*) AS rowCount FROM access_roles",
    );
    const workflowCount = await scalarCount(
      connection,
      "SELECT COUNT(*) AS rowCount FROM workflow_templates WHERE id = ?",
      ["wf-sbts-standard-v2"],
    );
    const featureToggleCount = await scalarCount(
      connection,
      "SELECT COUNT(*) AS rowCount FROM feature_toggles WHERE id = 1",
    );
    if (permissionCount === 0 || roleCount === 0 || workflowCount === 0 || featureToggleCount === 0) {
      throw new Error(
        "System reference data is incomplete. Run pnpm system:seed before starting SBTS.",
      );
    }

    const orphanProjectCount = await scalarCount(
      connection,
      `SELECT COUNT(*) AS rowCount
         FROM projects p
         LEFT JOIN areas a ON a.id = p.areaId
        WHERE a.id IS NULL`,
    );
    const orphanBlindCount = await scalarCount(
      connection,
      `SELECT COUNT(*) AS rowCount
         FROM blinds b
         LEFT JOIN projects p ON p.id = b.projectId
        WHERE p.id IS NULL`,
    );
    if (orphanProjectCount || orphanBlindCount) {
      throw new Error(
        `Referential integrity failed: orphanProjects=${orphanProjectCount}, orphanBlinds=${orphanBlindCount}.`,
      );
    }

    const missingRuntimeCount = await scalarCount(
      connection,
      `SELECT COUNT(*) AS rowCount
         FROM blinds b
         LEFT JOIN blind_workflow_runtime r ON r.blindTag = b.tag
        WHERE r.blindTag IS NULL`,
    );
    if (missingRuntimeCount > 0) {
      throw new Error(
        `${missingRuntimeCount} blind record(s) have no canonical workflow runtime. Run pnpm workflow:backfill.`,
      );
    }

    const bootstrapEnabled = bool(process.env.BOOTSTRAP_ADMIN_ON_DEPLOY);
    const configuredEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const configuredPassword = process.env.ADMIN_PASSWORD ?? "";

    let adminOpenId: string;
    if (bootstrapEnabled) {
      if (!configuredEmail || !configuredPassword) {
        throw new Error("Admin bootstrap is enabled but ADMIN_EMAIL/ADMIN_PASSWORD are missing.");
      }
      const [rows] = await connection.execute<mysql.RowDataPacket[]>(
        `SELECT openId, email, role, userStatus, loginMethod, passwordHash, lockedUntil
           FROM users
          WHERE LOWER(TRIM(email)) = ?
          LIMIT 1`,
        [configuredEmail],
      );
      const admin = rows[0];
      if (!admin) {
        throw new Error(`Configured administrator ${configuredEmail} was not found after bootstrap.`);
      }
      if (admin.role !== "admin" || admin.userStatus !== "active") {
        throw new Error(`Configured administrator ${configuredEmail} is not an active admin.`);
      }
      if (
        !admin.passwordHash
        || !(await bcrypt.compare(configuredPassword, String(admin.passwordHash)))
      ) {
        throw new Error(
          `Configured administrator ${configuredEmail} password verification failed after bootstrap.`,
        );
      }
      if (admin.lockedUntil && new Date(admin.lockedUntil).getTime() > Date.now()) {
        throw new Error(`Configured administrator ${configuredEmail} is still locked.`);
      }
      adminOpenId = String(admin.openId);
    } else {
      const [rows] = await connection.query<mysql.RowDataPacket[]>(
        `SELECT openId
           FROM users
          WHERE role = 'admin'
            AND userStatus = 'active'
            AND passwordHash IS NOT NULL
          ORDER BY id ASC
          LIMIT 1`,
      );
      if (!rows.length) {
        throw new Error(
          "No active password-enabled administrator exists. Temporarily enable BOOTSTRAP_ADMIN_ON_DEPLOY.",
        );
      }
      adminOpenId = String(rows[0].openId);
    }

    const token = await sdk.createSessionToken(adminOpenId, {
      name: "SBTS Deployment Doctor",
      expiresInMs: 60_000,
    });
    const session = await sdk.verifySession(token);
    if (
      !session
      || session.openId !== adminOpenId
      || session.appId !== ENV.appId
    ) {
      throw new Error("Session signing/verification round-trip failed.");
    }

    console.log(JSON.stringify({
      status: "passed",
      database: "connected",
      migrations: "current",
      schemaAlignment: true,
      systemReferenceData: true,
      orphanProjects: orphanProjectCount,
      orphanBlinds: orphanBlindCount,
      missingWorkflowRuntime: missingRuntimeCount,
      activeAdmin: true,
      sessionRoundTrip: true,
      appId: ENV.appId,
      commit: process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT_SHA ?? "local",
    }, null, 2));
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(
    "SBTS_PRODUCTION_DOCTOR_FAILED:",
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
