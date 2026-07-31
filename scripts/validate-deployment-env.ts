import "dotenv/config";
import { getDatabaseUrl } from "../server/_core/databaseUrl";
import { RELEASE_VERSION } from "../server/_core/release";

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

const isEnabled = (value: string | undefined) => ["1", "true", "yes", "on"].includes(
  (value ?? "false").trim().toLowerCase(),
);
if (isEnabled(process.env.ENABLE_OAUTH)) {
  errors.push("ENABLE_OAUTH is retired in the standalone SBTS build and must be false or removed.");
}
if (isEnabled(process.env.ENABLE_MANUS_RUNTIME)) {
  errors.push("ENABLE_MANUS_RUNTIME is not allowed in the production SBTS build.");
}

const legacyAppVersion = process.env.APP_VERSION?.trim();
if (legacyAppVersion && legacyAppVersion !== RELEASE_VERSION) {
  errors.push(`APP_VERSION=${legacyAppVersion} is stale. Remove APP_VERSION; release identity is ${RELEASE_VERSION}.`);
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

const storageRequired = production || isEnabled(process.env.STORAGE_REQUIRED);
const storageBackend = process.env.STORAGE_BACKEND?.trim().toLowerCase() ?? "";
if (storageRequired && storageBackend !== "s3" && storageBackend !== "forge") {
  errors.push("Production requires explicit STORAGE_BACKEND=s3 or STORAGE_BACKEND=forge.");
}
if (storageBackend === "s3") {
  const bucket = (process.env.S3_BUCKET || process.env.BUCKET)?.trim();
  const accessKey = (process.env.S3_ACCESS_KEY_ID || process.env.ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID)?.trim();
  const secretKey = (process.env.S3_SECRET_ACCESS_KEY || process.env.SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY)?.trim();
  if (!bucket || !accessKey || !secretKey) {
    errors.push("STORAGE_BACKEND=s3 requires bucket, access-key, and secret-key variables.");
  }
}
if (storageBackend === "forge") {
  if (!process.env.BUILT_IN_FORGE_API_URL?.trim() || !process.env.BUILT_IN_FORGE_API_KEY?.trim()) {
    errors.push("STORAGE_BACKEND=forge requires BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY.");
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
      version: RELEASE_VERSION,
      nodeEnv: process.env.NODE_ENV || "development",
      appId,
      databaseConfigured: true,
      bootstrapAdmin: bootstrapEnabled,
      storageRequired,
      storageBackend: storageBackend || null,
      workflowBackfillOnDeploy: isEnabled(process.env.RUN_WORKFLOW_BACKFILL_ON_DEPLOY),
      commit: process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT_SHA ?? "local",
    },
    null,
    2,
  ),
);
