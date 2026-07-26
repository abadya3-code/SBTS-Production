const LOCAL_DATABASE_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export type DatabaseUrlOptions = {
  required?: boolean;
  production?: boolean;
};

/**
 * Validate and normalize a MySQL/TiDB connection URL.
 *
 * A common Railway setup error is pasting `DATABASE_URL=mysql://...` into the
 * value field of a variable that is already named DATABASE_URL. This helper
 * rejects that shape with an actionable message instead of silently falling
 * back to localhost.
 */
export function getDatabaseUrl(
  rawValue: string | undefined = process.env.DATABASE_URL,
  options: DatabaseUrlOptions = {},
): string | null {
  const required = options.required ?? false;
  const value = rawValue?.trim();

  if (!value) {
    if (required) {
      throw new Error(
        "DATABASE_URL is required. On Railway, set the value to the MySQL reference variable `${{MySQL.MYSQL_URL}}`.",
      );
    }
    return null;
  }

  if (/^DATABASE_URL\s*=/i.test(value)) {
    throw new Error(
      "DATABASE_URL value is malformed. Enter only `mysql://...` or the Railway reference `${{MySQL.MYSQL_URL}}`; do not prefix the value with `DATABASE_URL=`.",
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(
      "DATABASE_URL is not a valid URL. Use a percent-encoded MySQL URL or the Railway MySQL reference variable.",
    );
  }

  if (!new Set(["mysql:", "mysql2:"]).has(parsed.protocol)) {
    throw new Error("DATABASE_URL must use the mysql:// protocol.");
  }
  if (!parsed.hostname) throw new Error("DATABASE_URL is missing a database hostname.");
  if (!parsed.pathname || parsed.pathname === "/") {
    throw new Error("DATABASE_URL is missing a database name.");
  }

  const production = options.production ?? process.env.NODE_ENV === "production";
  if (production && LOCAL_DATABASE_HOSTS.has(parsed.hostname.toLowerCase())) {
    throw new Error(
      "Production DATABASE_URL points to localhost. Configure the hosted MySQL service reference before deploying.",
    );
  }

  return value;
}
