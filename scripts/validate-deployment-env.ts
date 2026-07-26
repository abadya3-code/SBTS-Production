import "dotenv/config";
import { getDatabaseUrl } from "../server/_core/databaseUrl";

const errors: string[] = [];
const production = process.env.NODE_ENV === "production";

try {
  getDatabaseUrl(process.env.DATABASE_URL, { required: true, production });
} catch (error) {
  errors.push(error instanceof Error ? error.message : String(error));
}

const jwtSecret = process.env.JWT_SECRET?.trim() ?? "";
if (jwtSecret.length < 32) {
  errors.push("JWT_SECRET must contain at least 32 characters.");
}

const appId = process.env.VITE_APP_ID?.trim() || "sbts-standalone";
if (!appId) errors.push("VITE_APP_ID must not be empty.");

const oauthEnabled = ["1", "true", "yes", "on"].includes(
  (process.env.ENABLE_OAUTH ?? "false").trim().toLowerCase(),
);
if (oauthEnabled && !process.env.OAUTH_SERVER_URL?.trim()) {
  errors.push("ENABLE_OAUTH=true requires OAUTH_SERVER_URL.");
}

const bootstrapEnabled =
  (process.env.BOOTSTRAP_ADMIN_ON_DEPLOY ?? "false").trim().toLowerCase() ===
  "true";
if (bootstrapEnabled) {
  if (!process.env.ADMIN_EMAIL?.trim()) errors.push("ADMIN_EMAIL is required while administrator bootstrap is enabled.");
  const password = process.env.ADMIN_PASSWORD ?? "";
  if (password.length < 12) errors.push("ADMIN_PASSWORD must be at least 12 characters while bootstrap is enabled.");
}

if (errors.length) {
  console.error("DEPLOYMENT_ENV_INVALID");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      status: "ok",
      nodeEnv: process.env.NODE_ENV || "development",
      appId,
      databaseConfigured: true,
      bootstrapAdmin: bootstrapEnabled,
      storageRequired: process.env.STORAGE_REQUIRED === "true",
      oauthEnabled,
    },
    null,
    2,
  ),
);
