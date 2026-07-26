import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const required = [
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "Dockerfile",
  "railway.json",
  ".env.example",
  "README.md",
  "client/index.html",
  "server/_core/index.ts",
  "server/_core/databaseUrl.ts",
  "drizzle/schema.ts",
  "drizzle/0017_sprint5_auth_deployment_hardening.sql",
  "scripts/apply-sbts-domain-migrations.ts",
  "scripts/validate-deployment-env.ts",
  "scripts/production-doctor.ts",
  "scripts/sprint5-sql-validate.mjs",
  "patches/wouter@3.7.1.patch",
];

const failures = [];
for (const file of required) {
  if (!fs.existsSync(path.join(root, file))) failures.push(`Missing required file: ${file}`);
}

function gitTrackedFiles() {
  if (!fs.existsSync(path.join(root, ".git"))) return [];
  try {
    return execFileSync("git", ["ls-files", "-z"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
      .split("\0")
      .filter(Boolean);
  } catch {
    return [];
  }
}

const tracked = gitTrackedFiles();
for (const forbidden of [".env", "node_modules", "dist"]) {
  if (tracked.some((file) => file === forbidden || file.startsWith(`${forbidden}/`) || file.includes(`/${forbidden}/`))) {
    failures.push(`${forbidden} must not be committed to Git.`);
  }
}

if (fs.existsSync(path.join(root, "client/public/__manus__"))) {
  failures.push("Manus-generated debug files must not be included in the release.");
}

const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
if (packageJson.scripts?.["db:migrate"] !== "pnpm db:migrate:drizzle && pnpm db:migrate:domain") {
  failures.push("db:migrate must execute both Drizzle and SBTS domain migrations.");
}
if (!packageJson.scripts?.["railway:predeploy"]?.includes("pnpm deploy:check")) {
  failures.push("railway:predeploy must validate deployment variables before migrations.");
}
if (!packageJson.scripts?.["railway:predeploy"]?.includes("pnpm doctor")) {
  failures.push("railway:predeploy must run the production readiness doctor.");
}
if (!packageJson.engines?.node?.includes("22")) {
  failures.push("Node.js 22 must be pinned in package.json engines.");
}

const allowedBuildDependencies = new Set(packageJson.pnpm?.onlyBuiltDependencies ?? []);
for (const dependency of ["@tailwindcss/oxide", "esbuild"]) {
  if (!allowedBuildDependencies.has(dependency)) {
    failures.push(`pnpm.onlyBuiltDependencies must include ${dependency}.`);
  }
}

const railway = JSON.parse(fs.readFileSync(path.join(root, "railway.json"), "utf8"));
if (railway.build?.builder !== "DOCKERFILE") failures.push("Railway must use the repository Dockerfile.");
if (railway.deploy?.healthcheckPath !== "/health") failures.push("Railway healthcheckPath must be /health.");
if (!String(railway.deploy?.preDeployCommand ?? "").includes("pnpm railway:predeploy")) {
  failures.push("Railway pre-deploy must run the controlled migration/bootstrap script.");
}
if (!String(railway.deploy?.startCommand ?? "").includes("node dist/index.js")) {
  failures.push("Railway must start Node directly with dist/index.js.");
}

const dockerfile = fs.readFileSync(path.join(root, "Dockerfile"), "utf8");
if (!dockerfile.includes("pnpm install --frozen-lockfile --prod=false")) {
  failures.push("Dockerfile must install all build/predeploy dependencies with the frozen pnpm lockfile.");
}
if (!dockerfile.includes("USER node")) failures.push("Dockerfile must run the application as a non-root user.");

const gitignore = fs.readFileSync(path.join(root, ".gitignore"), "utf8");
if (!/^\.env$/m.test(gitignore)) failures.push(".gitignore must ignore .env.");
if (!/(?:^|\n)(?:\*\*\/)?node_modules\/?(?:\n|$)/m.test(gitignore)) failures.push(".gitignore must ignore node_modules.");

const result = {
  version: packageJson.version,
  filesChecked: required.length,
  status: failures.length ? "failed" : "passed",
  failures,
};
console.log(JSON.stringify(result, null, 2));
if (failures.length) process.exit(1);
