import "dotenv/config";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import mysql from "mysql2/promise";
import { getDatabaseUrl } from "../server/_core/databaseUrl";

const databaseUrl = getDatabaseUrl(process.env.DATABASE_URL, {
  required: true,
  production: process.env.NODE_ENV === "production",
})!;

const root = process.cwd();
const migrationDirectory = path.join(root, "drizzle");
const domainPattern = /^(\d{4})_sprint.*\.sql$/;
const baselineUpTo = Number.parseInt(process.env.SBTS_DOMAIN_MIGRATION_BASELINE_UP_TO || "0", 10);
const migrationLockName = "sbts_domain_migrations_v2";

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Split migration files without breaking semicolons inside strings, quoted
 * identifiers, or SQL comments. Sprint domain migrations do not use stored
 * procedures, so DELIMITER directives are intentionally unsupported.
 */
export function splitSqlStatements(source: string): string[] {
  const statements: string[] = [];
  let current = "";
  let quote: "'" | '"' | "`" | null = null;
  let lineComment = false;
  let blockComment = false;
  let escaped = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1] ?? "";

    if (lineComment) {
      current += char;
      if (char === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      current += char;
      if (char === "*" && next === "/") {
        current += next;
        index += 1;
        blockComment = false;
      }
      continue;
    }
    if (quote) {
      current += char;
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\" && quote !== "`") {
        escaped = true;
        continue;
      }
      if (char === quote) {
        if (next === quote && quote !== "`") {
          current += next;
          index += 1;
        } else {
          quote = null;
        }
      }
      continue;
    }

    if (char === "-" && next === "-" && /\s/.test(source[index + 2] ?? " ")) {
      current += char + next;
      index += 1;
      lineComment = true;
      continue;
    }
    if (char === "#") {
      current += char;
      lineComment = true;
      continue;
    }
    if (char === "/" && next === "*") {
      current += char + next;
      index += 1;
      blockComment = true;
      continue;
    }
    if (char === "'" || char === '"' || char === "`") {
      quote = char;
      current += char;
      continue;
    }
    if (char === ";") {
      const statement = current.trim();
      if (statement) statements.push(statement);
      current = "";
      continue;
    }
    current += char;
  }

  const tail = current.trim();
  if (tail) statements.push(tail);
  return statements;
}

async function acquireMigrationLock(connection: mysql.Connection) {
  const [rows] = await connection.execute<mysql.RowDataPacket[]>(
    "SELECT GET_LOCK(?, 60) AS acquired",
    [migrationLockName],
  );
  if (Number(rows[0]?.acquired) !== 1) {
    throw new Error("Could not acquire the SBTS migration lock within 60 seconds.");
  }
}

async function releaseMigrationLock(connection: mysql.Connection) {
  await connection.execute("SELECT RELEASE_LOCK(?)", [migrationLockName]).catch(() => undefined);
}

async function recordStep(
  connection: mysql.Connection,
  migrationName: string,
  statementIndex: number,
  signature: string,
  operation: () => Promise<void>,
) {
  const statementChecksum = sha256(signature);
  const [rows] = await connection.execute<mysql.RowDataPacket[]>(
    `SELECT statementChecksum
       FROM sbts_domain_migration_steps
      WHERE migrationName = ? AND statementIndex = ?
      LIMIT 1`,
    [migrationName, statementIndex],
  );
  if (rows[0]) {
    if (String(rows[0].statementChecksum) !== statementChecksum) {
      throw new Error(
        `Recorded recovery step ${statementIndex} in ${migrationName} has a different checksum.`,
      );
    }
    console.log(`  ✓ recovery step ${statementIndex} already applied`);
    return;
  }

  await operation();
  await connection.execute(
    `INSERT INTO sbts_domain_migration_steps
       (migrationName, statementIndex, statementChecksum)
     VALUES (?, ?, ?)`,
    [migrationName, statementIndex, statementChecksum],
  );
  console.log(`  ✓ recovery step ${statementIndex} applied`);
}

const blindAlignmentColumns = [
  ["material", "varchar(80) NULL"],
  ["flangeType", "varchar(80) NULL"],
  ["gasketType", "varchar(80) NULL"],
  ["boltSize", "varchar(40) NULL"],
  ["torqueValue", "varchar(40) NULL"],
  ["thickness", "varchar(40) NULL"],
  ["tempRating", "varchar(40) NULL"],
  ["pidRef", "varchar(80) NULL"],
  ["isoDrawing", "varchar(80) NULL"],
  ["lineNumber2", "varchar(120) NULL"],
  ["installDate", "timestamp NULL"],
  ["expiryDate", "timestamp NULL"],
] as const;

/**
 * Railway currently provisions MySQL builds where ALTER TABLE ... ADD COLUMN
 * IF NOT EXISTS is not portable. Migration 0018 originally used that syntax.
 * This compatibility path keeps the immutable migration file/checksum intact,
 * inspects information_schema, and adds only missing columns one at a time.
 * It is safe after a partially failed deployment.
 */
async function applySchemaAlignment0018(
  connection: mysql.Connection,
  migrationName: string,
  sql: string,
) {
  const [tableRows] = await connection.execute<mysql.RowDataPacket[]>(
    `SELECT table_name AS tableName
       FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_name = 'blinds'
      LIMIT 1`,
  );
  if (!tableRows.length) {
    throw new Error("Migration 0018 requires the blinds table from earlier migrations.");
  }

  for (let index = 0; index < blindAlignmentColumns.length; index += 1) {
    const [columnName, definition] = blindAlignmentColumns[index];
    await recordStep(
      connection,
      migrationName,
      1000 + index,
      `ensure-column:${columnName}:${definition}`,
      async () => {
        const [columnRows] = await connection.execute<mysql.RowDataPacket[]>(
          `SELECT column_name AS columnName
             FROM information_schema.columns
            WHERE table_schema = DATABASE()
              AND table_name = 'blinds'
              AND column_name = ?
            LIMIT 1`,
          [columnName],
        );
        if (!columnRows.length) {
          await connection.query(
            `ALTER TABLE \`blinds\` ADD COLUMN \`${columnName}\` ${definition}`,
          );
        }
      },
    );
  }

  const statements = splitSqlStatements(sql);
  const createFeatureToggles = statements.find((statement) =>
    /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+`?feature_toggles`?/i.test(statement),
  );
  const seedFeatureToggles = statements.find((statement) =>
    /INSERT\s+INTO\s+`?feature_toggles`?/i.test(statement),
  );
  if (!createFeatureToggles || !seedFeatureToggles) {
    throw new Error("Migration 0018 is missing the feature_toggles operations.");
  }

  await recordStep(
    connection,
    migrationName,
    1100,
    createFeatureToggles,
    async () => { await connection.query(createFeatureToggles); },
  );
  await recordStep(
    connection,
    migrationName,
    1101,
    seedFeatureToggles,
    async () => { await connection.query(seedFeatureToggles); },
  );
}

const sprint6AdditiveColumns = new Map<number, readonly [string, string]>([
  [1, ["default_tag_settings", "layoutJson"]],
  [2, ["default_tag_settings", "templateSlotsJson"]],
  [7, ["notifications", "notificationPriority"]],
  [8, ["notifications", "isArchived"]],
  [9, ["notifications", "archivedAt"]],
  [10, ["notification_preferences", "qrTokenChanged"]],
  [11, ["notification_preferences", "certificateStatusChanged"]],
  [12, ["notification_preferences", "tagPrintRequested"]],
]);

/**
 * Migration 0020 is consumed during Railway pre-deploy and can be interrupted
 * between an ALTER TABLE and its recovery-step record. MySQL builds used by
 * Railway do not consistently support ADD COLUMN IF NOT EXISTS, so additive
 * columns are checked through information_schema before each statement. The
 * remaining CREATE/MODIFY/UPDATE statements are idempotent and safe to replay.
 */
async function applyIntegratedRelease0020(
  connection: mysql.Connection,
  migrationName: string,
  sql: string,
) {
  const statements = splitSqlStatements(sql);
  if (statements.length !== 13) {
    throw new Error(
      `Migration ${migrationName} must contain exactly 13 controlled statements.`,
    );
  }

  for (let statementIndex = 0; statementIndex < statements.length; statementIndex += 1) {
    const statement = statements[statementIndex];
    await recordStep(
      connection,
      migrationName,
      statementIndex,
      statement,
      async () => {
        const additiveColumn = sprint6AdditiveColumns.get(statementIndex);
        if (additiveColumn) {
          const [tableName, columnName] = additiveColumn;
          const [columnRows] = await connection.execute<mysql.RowDataPacket[]>(
            `SELECT column_name AS columnName
               FROM information_schema.columns
              WHERE table_schema = DATABASE()
                AND table_name = ?
                AND column_name = ?
              LIMIT 1`,
            [tableName, columnName],
          );
          if (columnRows.length) return;
        }
        await connection.query(statement);
      },
    );
  }
}

async function main() {
  const connection = await mysql.createConnection(databaseUrl);
  let lockAcquired = false;
  try {
    await acquireMigrationLock(connection);
    lockAcquired = true;

    await connection.query(`
      CREATE TABLE IF NOT EXISTS sbts_domain_migrations (
        migrationName varchar(255) NOT NULL,
        migrationChecksum varchar(64) NOT NULL,
        appliedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (migrationName)
      )
    `);
    await connection.query(`
      CREATE TABLE IF NOT EXISTS sbts_domain_migration_steps (
        migrationName varchar(255) NOT NULL,
        statementIndex int NOT NULL,
        statementChecksum varchar(64) NOT NULL,
        appliedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (migrationName, statementIndex)
      )
    `);

    const files = (await fs.readdir(migrationDirectory))
      .filter((name) => domainPattern.test(name))
      .sort((a, b) => a.localeCompare(b));
    if (!files.length) throw new Error("No SBTS domain migrations were found.");

    const [appliedRows] = await connection.query<mysql.RowDataPacket[]>(
      "SELECT migrationName, migrationChecksum FROM sbts_domain_migrations",
    );
    const applied = new Map(
      appliedRows.map((row) => [String(row.migrationName), String(row.migrationChecksum)]),
    );

    for (const file of files) {
      const index = Number.parseInt(file.slice(0, 4), 10);
      const sql = await fs.readFile(path.join(migrationDirectory, file), "utf8");
      const checksum = sha256(sql);
      const previous = applied.get(file);
      if (previous) {
        if (previous !== checksum) {
          throw new Error(
            `Applied migration ${file} has changed. Restore the original migration or create a new one.`,
          );
        }
        console.log(`✓ ${file} already applied`);
        continue;
      }

      if (baselineUpTo >= index) {
        await connection.execute(
          "INSERT INTO sbts_domain_migrations (migrationName, migrationChecksum) VALUES (?, ?)",
          [file, checksum],
        );
        console.log(`↷ ${file} baselined without execution`);
        continue;
      }

      if (file === "0017_sprint5_auth_deployment_hardening.sql") {
        const [duplicateEmails] = await connection.query<mysql.RowDataPacket[]>(
          `SELECT LOWER(TRIM(email)) AS normalizedEmail, COUNT(*) AS duplicateCount
             FROM users
            WHERE email IS NOT NULL AND TRIM(email) <> ''
            GROUP BY LOWER(TRIM(email))
           HAVING COUNT(*) > 1
            LIMIT 10`,
        );
        if (duplicateEmails.length) {
          const values = duplicateEmails
            .map((row) => String(row.normalizedEmail))
            .join(", ");
          throw new Error(
            `Migration ${file} cannot create the unique email index because duplicate accounts exist: ${values}. Resolve duplicates before deployment.`,
          );
        }
      }

      if (file === "0018_sprint6_schema_alignment.sql") {
        console.log(`→ Applying ${file} with portable schema recovery`);
        await applySchemaAlignment0018(connection, file, sql);
        await connection.execute(
          "INSERT INTO sbts_domain_migrations (migrationName, migrationChecksum) VALUES (?, ?)",
          [file, checksum],
        );
        console.log(`✓ Applied ${file}`);
        continue;
      }

      if (file === "0020_sprint6_qr_print_inbox_designer.sql") {
        console.log(`→ Applying ${file} with portable integrated-release recovery`);
        await applyIntegratedRelease0020(connection, file, sql);
        await connection.execute(
          "INSERT INTO sbts_domain_migrations (migrationName, migrationChecksum) VALUES (?, ?)",
          [file, checksum],
        );
        console.log(`✓ Applied ${file}`);
        continue;
      }

      const statements = splitSqlStatements(sql);
      if (!statements.length) throw new Error(`Migration ${file} has no executable statements.`);
      const [stepRows] = await connection.query<mysql.RowDataPacket[]>(
        "SELECT statementIndex, statementChecksum FROM sbts_domain_migration_steps WHERE migrationName = ?",
        [file],
      );
      const appliedSteps = new Map(
        stepRows.map((row) => [Number(row.statementIndex), String(row.statementChecksum)]),
      );

      console.log(`→ Applying ${file} (${statements.length} statements)`);
      for (let statementIndex = 0; statementIndex < statements.length; statementIndex += 1) {
        const statement = statements[statementIndex];
        const statementChecksum = sha256(statement);
        const previousStatementChecksum = appliedSteps.get(statementIndex);
        if (previousStatementChecksum) {
          if (previousStatementChecksum !== statementChecksum) {
            throw new Error(`Applied statement ${statementIndex + 1} in ${file} has changed.`);
          }
          console.log(`  ✓ statement ${statementIndex + 1} already applied`);
          continue;
        }

        try {
          await connection.query(statement);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          throw new Error(`Migration ${file}, statement ${statementIndex + 1} failed: ${message}`);
        }
        await connection.execute(
          `INSERT INTO sbts_domain_migration_steps
             (migrationName, statementIndex, statementChecksum)
           VALUES (?, ?, ?)`,
          [file, statementIndex, statementChecksum],
        );
        console.log(`  ✓ statement ${statementIndex + 1}/${statements.length}`);
      }

      await connection.execute(
        "INSERT INTO sbts_domain_migrations (migrationName, migrationChecksum) VALUES (?, ?)",
        [file, checksum],
      );
      console.log(`✓ Applied ${file}`);
    }
  } finally {
    if (lockAcquired) await releaseMigrationLock(connection);
    await connection.end();
  }
}

main().catch((error) => {
  console.error(
    "SBTS domain migration failed:",
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
