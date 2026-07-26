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
        // SQL escapes a quote by doubling it.
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

async function main() {
  const connection = await mysql.createConnection(databaseUrl);
  try {
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
    const applied = new Map(appliedRows.map((row) => [String(row.migrationName), String(row.migrationChecksum)]));

    for (const file of files) {
      const index = Number.parseInt(file.slice(0, 4), 10);
      const sql = await fs.readFile(path.join(migrationDirectory, file), "utf8");
      const checksum = sha256(sql);
      const previous = applied.get(file);
      if (previous) {
        if (previous !== checksum) throw new Error(`Applied migration ${file} has changed. Restore the original migration or create a new one.`);
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
          const values = duplicateEmails.map((row) => String(row.normalizedEmail)).join(", ");
          throw new Error(
            `Migration ${file} cannot create the unique email index because duplicate accounts exist: ${values}. Resolve duplicates before deployment.`,
          );
        }
      }

      const statements = splitSqlStatements(sql);
      if (!statements.length) throw new Error(`Migration ${file} has no executable statements.`);
      const [stepRows] = await connection.query<mysql.RowDataPacket[]>(
        "SELECT statementIndex, statementChecksum FROM sbts_domain_migration_steps WHERE migrationName = ?",
        [file],
      );
      const appliedSteps = new Map(stepRows.map((row) => [Number(row.statementIndex), String(row.statementChecksum)]));

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
          "INSERT INTO sbts_domain_migration_steps (migrationName, statementIndex, statementChecksum) VALUES (?, ?, ?)",
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
    await connection.end();
  }
}

main().catch((error) => {
  console.error("SBTS domain migration failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
