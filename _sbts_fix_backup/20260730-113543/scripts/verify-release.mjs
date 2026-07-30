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
  "drizzle/0018_sprint6_schema_alignment.sql",
  "scripts/apply-sbts-domain-migrations.ts",
  "scripts/seed-system-data.ts",
  "scripts/backfill-workflow-runtime.ts",
  "scripts/verify-schema-contract.ts",
  "scripts/validate-deployment-env.ts",
  "scripts/production-doctor.ts",
  "scripts/sprint5-sql-validate.mjs",
  "server/foundation.contract.test.ts",
  "SBTS_2.2_FOUNDATION_RELEASE_AR.md",
  "SBTS_2.2_FOUNDATION_VERIFICATION.txt",
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
if (!packageJson.scripts?.["railway:predeploy"]?.includes("pnpm schema:contract")) {
  failures.push("railway:predeploy must verify the hosted MySQL schema contract.");
}
if (!packageJson.scripts?.["railway:predeploy"]?.includes("pnpm system:seed")) {
  failures.push("railway:predeploy must install system reference data explicitly.");
}
if (!packageJson.scripts?.["railway:predeploy"]?.includes("pnpm workflow:backfill")) {
  failures.push("railway:predeploy must backfill canonical workflow runtime records.");
}
if (packageJson.scripts?.["railway:predeploy"]?.includes("pnpm data:seed")) {
  failures.push("Demo data must never run automatically during Railway pre-deploy.");
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


const areasPage = fs.readFileSync(path.join(root, "client/src/pages/Areas.tsx"), "utf8");
const projectsPage = fs.readFileSync(path.join(root, "client/src/pages/Projects.tsx"), "utf8");
if (areasPage.includes("Area creation API is ready")) {
  failures.push("Areas page still contains the placeholder creation toast.");
}
if (projectsPage.includes("Project creation API is ready")) {
  failures.push("Projects page still contains the placeholder creation toast.");
}
if (!fs.existsSync(path.join(root, "client/src/components/areas/CreateAreaDialog.tsx"))) {
  failures.push("CreateAreaDialog is required.");
}
if (!fs.existsSync(path.join(root, "client/src/components/projects/CreateProjectDialog.tsx"))) {
  failures.push("CreateProjectDialog is required.");
}


const readOnlyContracts = [
  {
    file: "server/db/certificateGovernance.ts",
    forbidden: "getCertificateReadiness(projectId: string, blindTag: string) {\n  await ensureBlindWorkflowRuntime",
  },
  {
    file: "server/db/inspectionActivities.ts",
    forbidden: "getBlindInspectionActivities(input: { projectId: string; blindTag: string }, actor: ActingProjectUser) {\n  await ensureBlindWorkflowRuntime",
  },
  {
    file: "server/db/qualityGovernance.ts",
    forbidden: "getQualityRecords(input: { projectId: string; blindTag: string }, actor: ActingProjectUser) {\n  await ensureBlindWorkflowRuntime",
  },
];
for (const contract of readOnlyContracts) {
  const source = fs.readFileSync(path.join(root, contract.file), "utf8");
  if (source.includes(contract.forbidden)) {
    failures.push(`${contract.file} still initializes workflow state during a query.`);
  }
}
const featureToggleSource = fs.readFileSync(
  path.join(root, "server/db/featureToggles.ts"),
  "utf8",
);
const featureToggleReadBody = featureToggleSource.slice(
  featureToggleSource.indexOf("export async function getFeatureToggles"),
  featureToggleSource.indexOf("export async function updateFeatureToggles"),
);
if (featureToggleReadBody.includes("db.insert")) {
  failures.push("getFeatureToggles must not create rows during a query.");
}

const sdkSource = fs.readFileSync(path.join(root, "server/_core/sdk.ts"), "utf8");
for (const binding of [".setIssuer(ENV.appId)", ".setAudience(ENV.appId)", "issuer: ENV.appId", "audience: ENV.appId"]) {
  if (!sdkSource.includes(binding)) failures.push(`JWT deployment binding is missing: ${binding}`);
}

const ciWorkflow = fs.readFileSync(path.join(root, ".github/workflows/ci.yml"), "utf8");
const pnpmSetupIndex = ciWorkflow.indexOf("pnpm/action-setup");
const nodeSetupIndex = ciWorkflow.indexOf("actions/setup-node");
if (pnpmSetupIndex < 0 || nodeSetupIndex < 0 || pnpmSetupIndex > nodeSetupIndex) {
  failures.push("GitHub Actions must install pnpm before setup-node enables the pnpm cache.");
}

const result = {
  version: packageJson.version,
  filesChecked: required.length,
  status: failures.length ? "failed" : "passed",
  failures,
};
console.log(JSON.stringify(result, null, 2));
if (failures.length) process.exit(1);
