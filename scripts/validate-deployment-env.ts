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
const weakSecretPatterns = [
  /^replace[-_ ]?with/i,
  /^change[-_ ]?me/i,
  /^secret$/i,
  /^password$/i,
  /^your[-_ ]?secret/i,
];
if (jwtSecret.length < 32) {
  errors.push("JWT_SECRET must contain at least 32 random characters.");
} else if (weakSecretPatterns.some((pattern) => pattern.test(jwtSecret))) {
  errors.push("JWT_SECRET still contains a placeholder or weak default value.");
}

const appId = process.env.VITE_APP_ID?.trim() ?? "";
if (!appId) {
  errors.push("VITE_APP_ID is required.");
} else if (!/^[A-Za-z0-9][A-Za-z0-9_-]{2,63}$/.test(appId)) {
  errors.push("VITE_APP_ID must use 3–64 letters, numbers, hyphens, or underscores.");
}

const oauthEnabled = ["1", "true", "yes", "on"].includes(
  (process.env.ENABLE_OAUTH ?? "false").trim().toLowerCase(),
);
if (oauthEnabled && !process.env.OAUTH_SERVER_URL?.trim()) {
  errors.push("ENABLE_OAUTH=true requires OAUTH_SERVER_URL.");
}

const bootstrapEnabled = ["1", "true", "yes", "on"].includes(
  (process.env.BOOTSTRAP_ADMIN_ON_DEPLOY ?? "false").trim().toLowerCase(),
);
if (bootstrapEnabled) {
  if (!process.env.ADMIN_EMAIL?.trim()) {
    errors.push("ADMIN_EMAIL is required while administrator bootstrap is enabled.");
  }
  const password = process.env.ADMIN_PASSWORD ?? "";
  if (password.length < 12) {
    errors.push("ADMIN_PASSWORD must be at least 12 characters while bootstrap is enabled.");
  }
  if (
    password
    && (!/[A-Z]/.test(password)
      || !/[a-z]/.test(password)
      || !/[0-9]/.test(password)
      || !/[^A-Za-z0-9]/.test(password))
  ) {
    errors.push("ADMIN_PASSWORD must contain uppercase, lowercase, number, and special character.");
  }
}

const storageRequired = ["1", "true", "yes", "on"].includes(
  (process.env.STORAGE_REQUIRED ?? "false").trim().toLowerCase(),
);
if (storageRequired) {
  const storageConfigured = Boolean(
    (process.env.S3_ENDPOINT || process.env.BUILT_IN_FORGE_API_URL)?.trim(),
  );
  if (!storageConfigured) {
    errors.push("STORAGE_REQUIRED=true requires an S3-compatible or Forge storage backend.");
  }
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
      storageRequired,
      oauthEnabled,
      commit: process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT_SHA ?? "local",
    },
    null,
    2,
  ),
);
