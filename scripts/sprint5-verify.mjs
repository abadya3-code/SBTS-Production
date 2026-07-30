import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
const failures = [];
const check = (name, condition, message) => {
  if (!condition) failures.push({ name, message });
};

const env = read("server/_core/env.ts");
const sdk = read("server/_core/sdk.ts");
const cookies = read("server/_core/cookies.ts");
const auth = read("server/routers/auth.ts");
const admin = read("scripts/create-admin.ts");
const migration = read("drizzle/0017_sprint5_auth_deployment_hardening.sql");
const dockerfile = read("Dockerfile");
const railway = JSON.parse(read("railway.json"));
const pkg = JSON.parse(read("package.json"));
const doctor = read("scripts/production-doctor.ts");
const login = read("client/src/pages/Login.tsx");

check("Standalone app id fallback", env.includes('"sbts-standalone"'), "A non-empty appId fallback is required.");
check(
  "Deployment-bound session validation",
  sdk.includes("issuer: ENV.appId")
    && sdk.includes("audience: ENV.appId")
    && sdk.includes("appId !== ENV.appId"),
  "Session verification must reject tokens issued for another SBTS deployment.",
);
check("Secure session secret", sdk.includes("JWT_SECRET must contain at least 32 characters"), "Session signing must reject weak secrets.");
check("Same-origin cookie policy", cookies.includes('sameSite: "lax"'), "Standalone auth should use SameSite=Lax.");
check("Admin password reset", admin.includes("updateUserPassword(existing.openId, password)"), "Bootstrap must reset an existing admin password.");
check("Admin bootstrap marker", admin.includes("ADMIN_BOOTSTRAP_RESET_OK"), "Bootstrap logs must identify successful reset.");
check("Database URL guard", fs.existsSync("server/_core/databaseUrl.ts"), "Database URL validation helper is required.");
check("Account lockout", auth.includes("recordFailedLogin") && auth.includes("TOO_MANY_REQUESTS"), "Login must enforce configured lockout policy.");
check("Auth migration", migration.includes("failedLoginAttempts") && migration.includes("users_email_unique"), "Auth hardening migration is incomplete.");
check("Docker portability", dockerfile.includes("FROM node:22.16.0") && dockerfile.includes("USER node"), "Portable non-root Docker image is required.");
check("Railway Docker builder", railway.build?.builder === "DOCKERFILE", "Railway must use Dockerfile builder.");
check("Predeploy validation", pkg.scripts?.["railway:predeploy"]?.includes("pnpm deploy:check"), "Predeploy must validate environment variables.");
check("Predeploy doctor", pkg.scripts?.["railway:predeploy"]?.includes("pnpm doctor"), "Predeploy must verify database, admin and session readiness.");
check("Admin password verification", doctor.includes("bcrypt.compare") && doctor.includes("password verification failed"), "Doctor must verify the configured password hash.");
check("Session round-trip verification", doctor.includes("createSessionToken") && doctor.includes("verifySession"), "Doctor must verify session signing and validation.");
check("Login cache refresh", login.includes("utils.auth.me.setData") && login.includes("utils.auth.me.invalidate"), "Login must refresh the auth.me cache before navigation.");

const result = {
  generatedAt: new Date().toISOString(),
  checks: 16,
  passed: 16 - failures.length,
  failed: failures.length,
  failures,
};
console.log(JSON.stringify(result, null, 2));
if (failures.length) process.exit(1);
