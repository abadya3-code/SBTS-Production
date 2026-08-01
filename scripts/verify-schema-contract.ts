import "dotenv/config";
import mysql from "mysql2/promise";
import { getDatabaseUrl } from "../server/_core/databaseUrl";

const requiredColumns: Record<string, string[]> = {
  areas: [
    "id",
    "name",
    "code",
    "description",
    "location",
    "isActive",
    "createdAt",
    "updatedAt",
  ],
  projects: [
    "id",
    "name",
    "areaId",
    "projectStatus",
    "blindsCount",
    "progress",
    "description",
    "createdAt",
    "updatedAt",
  ],
  blinds: [
    "tag",
    "projectId",
    "type",
    "size",
    "rate",
    "blindPhase",
    "owner",
    "blindPriority",
    "lineNumber",
    "location",
    "isolationPoint",
    "slipMetalForemanApproved",
    "slipBlindMerged",
    "notes",
    "material",
    "flangeType",
    "gasketType",
    "boltSize",
    "torqueValue",
    "thickness",
    "tempRating",
    "pidRef",
    "isoDrawing",
    "lineNumber2",
    "installDate",
    "expiryDate",
    "createdAt",
    "updatedAt",
  ],
  users: [
    "id",
    "openId",
    "name",
    "email",
    "loginMethod",
    "role",
    "userStatus",
    "passwordHash",
    "failedLoginAttempts",
    "lockedUntil",
    "preferredTheme",
    "createdAt",
    "updatedAt",
  ],
  feature_toggles: [
    "id",
    "enableWorkflowTab",
    "enableComplianceTab",
    "enableFieldActionsTab",
    "enableQrMobileTab",
    "enableHistoryTab",
    "enableSafetyChecklists",
    "enableTorqueRecords",
    "enableInspectionRecords",
    "enablePhotoEvidence",
    "enablePtw",
    "enableLoto",
    "enableRiskAssessment",
    "enableFieldNotes",
    "enableQrGeneration",
    "enableMobileVerification",
    "enableOfflineAccess",
    "enableSlipBlindSurveys",
    "enableCertificates",
    "enableExpiryTracking",
    "enableProgressRing",
    "enableQuickActions",
    "enableBreadcrumb",
    "updatedByOpenId",
    "updatedAt",
  ],
  workflow_transition_events: [
    "id",
    "blindTag",
    "projectId",
    "fromPhaseKey",
    "toPhaseKey",
    "actionKey",
    "transitionEventStatus",
    "blockingReasonsJson",
    "gateSnapshotJson",
    "reason",
    "actorOpenId",
    "actorName",
    "recordVersionBefore",
    "recordVersionAfter",
    "createdAt",
  ],
  blind_qr_tokens: [
    "id",
    "projectId",
    "blindTag",
    "verificationToken",
    "version",
    "blindQrTokenStatus",
    "issuedByOpenId",
    "issuedAt",
    "previousTokenId",
    "revokedByOpenId",
    "revokedAt",
    "revocationReason",
    "lastScannedAt",
    "scanCount",
    "createdAt",
    "updatedAt",
  ],
  default_tag_settings: [
    "tagWidth",
    "tagHeight",
    "layoutJson",
    "templateSlotsJson",
  ],
  notifications: [
    "notificationType",
    "notificationPriority",
    "isRead",
    "readAt",
    "isArchived",
    "archivedAt",
  ],
  notification_preferences: [
    "qrTokenChanged",
    "certificateStatusChanged",
    "tagPrintRequested",
  ],
};

async function main() {
  const databaseUrl = getDatabaseUrl(process.env.DATABASE_URL, {
    required: true,
    production: process.env.NODE_ENV === "production",
  })!;
  const connection = await mysql.createConnection(databaseUrl);
  try {
    const [columnRows] = await connection.query<mysql.RowDataPacket[]>(
      `SELECT table_name AS tableName, column_name AS columnName
         FROM information_schema.columns
        WHERE table_schema = DATABASE()`
    );
    const columnsByTable = new Map<string, Set<string>>();
    for (const row of columnRows) {
      const tableName = String(row.tableName);
      const columnName = String(row.columnName);
      const columns = columnsByTable.get(tableName) ?? new Set<string>();
      columns.add(columnName);
      columnsByTable.set(tableName, columns);
    }

    const failures: string[] = [];
    for (const [tableName, expectedColumns] of Object.entries(
      requiredColumns
    )) {
      const actual = columnsByTable.get(tableName);
      if (!actual) {
        failures.push(`Missing table: ${tableName}`);
        continue;
      }
      const missing = expectedColumns.filter(column => !actual.has(column));
      if (missing.length)
        failures.push(`${tableName} missing columns: ${missing.join(", ")}`);
    }

    const requiredMigrations = [
      "0018_sprint6_schema_alignment.sql",
      "0019_sprint4_foundation_stabilization.sql",
      "0020_sprint6_qr_print_inbox_designer.sql",
    ];
    const migrationPlaceholders = requiredMigrations.map(() => "?").join(", ");
    const [migrationRows] = await connection.query<mysql.RowDataPacket[]>(
      `SELECT migrationName
         FROM sbts_domain_migrations
        WHERE migrationName IN (${migrationPlaceholders})`,
      requiredMigrations
    );
    const appliedMigrations = new Set(
      migrationRows.map(row => String(row.migrationName))
    );
    for (const migration of requiredMigrations) {
      if (!appliedMigrations.has(migration)) {
        failures.push(`Migration ${migration} is not recorded.`);
      }
    }

    const [emailIndexRows] = await connection.query<mysql.RowDataPacket[]>(
      `SELECT index_name AS indexName, non_unique AS nonUnique
         FROM information_schema.statistics
        WHERE table_schema = DATABASE()
          AND table_name = 'users'
          AND column_name = 'email'`
    );
    if (!emailIndexRows.some(row => Number(row.nonUnique) === 0)) {
      failures.push("users.email does not have a unique index.");
    }

    if (failures.length) {
      throw new Error(failures.join("\n"));
    }

    console.log(
      JSON.stringify(
        {
          status: "ok",
          database: "schema-contract-aligned",
          tablesChecked: Object.keys(requiredColumns).length,
          migrations: requiredMigrations,
        },
        null,
        2
      )
    );
  } finally {
    await connection.end();
  }
}

main().catch(error => {
  console.error(
    "SBTS_SCHEMA_CONTRACT_FAILED:",
    error instanceof Error ? error.message : error
  );
  process.exit(1);
});
