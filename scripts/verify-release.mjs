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
  "VERSION",
  "client/index.html",
  "server/_core/index.ts",
  "server/_core/release.ts",
  "server/_core/authUser.ts",
  "server/_core/databaseUrl.ts",
  "drizzle/schema.ts",
  "drizzle/0017_sprint5_auth_deployment_hardening.sql",
  "drizzle/0018_sprint6_schema_alignment.sql",
  "drizzle/0019_sprint4_foundation_stabilization.sql",
  "scripts/apply-sbts-domain-migrations.ts",
  "scripts/seed-system-data.ts",
  "scripts/backfill-workflow-runtime.ts",
  "scripts/verify-schema-contract.ts",
  "scripts/validate-deployment-env.ts",
  "scripts/verify-deployment.mjs",
  "scripts/verify-publish.mjs",
  "scripts/db-push-disabled.mjs",
  "scripts/production-doctor.ts",
  "scripts/sprint5-sql-validate.mjs",
  "server/foundation.contract.test.ts",
  "SBTS_2.2_FOUNDATION_RELEASE_AR.md",
  "SBTS_2.2_FOUNDATION_VERIFICATION.txt",
  "SBTS_2.2.1_STABILIZATION_REPORT_AR.md",
  "SBTS_2.2.2_SPRINT5_RECOVERY_REPORT_AR.md",
  "SBTS_2.2.2_RC4_SCHEMA_CONTRACT_HOTFIX_AR.md",
  "SBTS_2.2.2_RC5_PREDEPLOY_EXIT_HOTFIX_AR.md",
  "SBTS_2.2.2_RC6_PRODUCTION_STARTUP_HOTFIX_AR.md",
  "SBTS_2.2.2_RC7_DASHBOARD_PHASE_COLUMN_HOTFIX_AR.md",
  "patches/wouter@3.7.1.patch",
];

const failures = [];
for (const file of required) {
  if (!fs.existsSync(path.join(root, file)))
    failures.push(`Missing required file: ${file}`);
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
  if (
    tracked.some(
      file =>
        file === forbidden ||
        file.startsWith(`${forbidden}/`) ||
        file.includes(`/${forbidden}/`)
    )
  ) {
    failures.push(`${forbidden} must not be committed to Git.`);
  }
}

if (fs.existsSync(path.join(root, "client/public/__manus__"))) {
  failures.push(
    "Manus-generated debug files must not be included in the release."
  );
}

const packageJson = JSON.parse(
  fs.readFileSync(path.join(root, "package.json"), "utf8")
);
const versionFile = fs.readFileSync(path.join(root, "VERSION"), "utf8").trim();
const releaseSource = fs.readFileSync(
  path.join(root, "server/_core/release.ts"),
  "utf8"
);
if (versionFile !== packageJson.version) {
  failures.push(
    `VERSION=${versionFile} does not match package.json=${packageJson.version}.`
  );
}
if (!releaseSource.includes(`RELEASE_VERSION = "${packageJson.version}"`)) {
  failures.push(
    "The bundled server release version does not match package.json."
  );
}
if (packageJson.scripts?.["db:push"] !== "node scripts/db-push-disabled.mjs") {
  failures.push(
    "db:push must remain disabled until the Drizzle and domain migration histories are unified."
  );
}
if (packageJson.scripts?.baseline !== "node scripts/sprint0-baseline.mjs") {
  failures.push("baseline must be a read-only verification command.");
}
if (
  packageJson.scripts?.["db:migrate"] !==
  "pnpm db:migrate:drizzle && pnpm db:migrate:domain"
) {
  failures.push(
    "db:migrate must execute both Drizzle and SBTS domain migrations."
  );
}
if (
  !packageJson.scripts?.["railway:predeploy"]?.includes("pnpm deploy:check")
) {
  failures.push(
    "railway:predeploy must validate deployment variables before migrations."
  );
}
if (!packageJson.scripts?.["railway:predeploy"]?.includes("pnpm doctor")) {
  failures.push("railway:predeploy must run the production readiness doctor.");
}
if (
  !packageJson.scripts?.["railway:predeploy"]?.includes("pnpm schema:contract")
) {
  failures.push(
    "railway:predeploy must verify the hosted MySQL schema contract."
  );
}
if (!packageJson.scripts?.["railway:predeploy"]?.includes("pnpm system:seed")) {
  failures.push(
    "railway:predeploy must install system reference data explicitly."
  );
}
if (
  !packageJson.scripts?.["railway:predeploy"]?.includes(
    "RUN_WORKFLOW_BACKFILL_ON_DEPLOY"
  )
) {
  failures.push(
    "railway:predeploy must make the potentially expensive workflow backfill explicit."
  );
}
if (packageJson.scripts?.["railway:predeploy"]?.includes("pnpm data:seed")) {
  failures.push(
    "Demo data must never run automatically during Railway pre-deploy."
  );
}
if (!packageJson.engines?.node?.includes("22")) {
  failures.push("Node.js 22 must be pinned in package.json engines.");
}

const allowedBuildDependencies = new Set(
  packageJson.pnpm?.onlyBuiltDependencies ?? []
);
for (const dependency of ["@tailwindcss/oxide", "esbuild"]) {
  if (!allowedBuildDependencies.has(dependency)) {
    failures.push(`pnpm.onlyBuiltDependencies must include ${dependency}.`);
  }
}

const railway = JSON.parse(
  fs.readFileSync(path.join(root, "railway.json"), "utf8")
);
if (railway.build?.builder !== "DOCKERFILE")
  failures.push("Railway must use the repository Dockerfile.");
if (railway.deploy?.healthcheckPath !== "/ready")
  failures.push(
    "Railway healthcheckPath must verify database readiness at /ready."
  );
if (
  !String(railway.deploy?.preDeployCommand ?? "").includes(
    "pnpm railway:predeploy"
  )
) {
  failures.push(
    "Railway pre-deploy must run the controlled migration/bootstrap script."
  );
}
if (
  !String(railway.deploy?.startCommand ?? "").includes("node dist/index.js")
) {
  failures.push("Railway must start Node directly with dist/index.js.");
}

const dockerfile = fs.readFileSync(path.join(root, "Dockerfile"), "utf8");
if (!dockerfile.includes("pnpm install --frozen-lockfile --prod=false")) {
  failures.push(
    "Dockerfile must install all build/predeploy dependencies with the frozen pnpm lockfile."
  );
}
if (!dockerfile.includes("USER node"))
  failures.push("Dockerfile must run the application as a non-root user.");
if (!dockerfile.includes("/ready"))
  failures.push(
    "Dockerfile healthcheck must verify database readiness at /ready."
  );

const dockerignore = fs.readFileSync(path.join(root, ".dockerignore"), "utf8");
if (/^\s*\.github\/?\s*$/m.test(dockerignore)) {
  failures.push(
    ".github must remain in the Docker build context because release and test contracts inspect the CI workflow."
  );
}

const pushUpdateScript = fs.readFileSync(
  path.join(root, "02_PUSH_UPDATE.ps1"),
  "utf8"
);
const installIndex = pushUpdateScript.indexOf("pnpm install --frozen-lockfile");
const publishIndex = pushUpdateScript.indexOf("pnpm publish:check");
if (installIndex < 0 || publishIndex < 0 || installIndex > publishIndex) {
  failures.push(
    "02_PUSH_UPDATE.ps1 must install locked dependencies before running the publish gate."
  );
}

const gitignore = fs.readFileSync(path.join(root, ".gitignore"), "utf8");
if (!/^\.env$/m.test(gitignore)) failures.push(".gitignore must ignore .env.");
if (!/(?:^|\n)(?:\*\*\/)?node_modules\/?(?:\n|$)/m.test(gitignore))
  failures.push(".gitignore must ignore node_modules.");

for (const removedDependency of [
  "xlsx",
  "streamdown",
  "axios",
  "vite-plugin-manus-runtime",
]) {
  if (
    packageJson.dependencies?.[removedDependency] ||
    packageJson.devDependencies?.[removedDependency]
  ) {
    failures.push(
      `${removedDependency} must not be present in the production dependency graph.`
    );
  }
}
if (!packageJson.dependencies?.fflate)
  failures.push(
    "Excel exports must use the small audited fflate OOXML adapter."
  );
if (
  packageJson.scripts?.["audit:prod"] !== "pnpm audit --prod" ||
  !packageJson.scripts?.["foundation:check"]?.includes("pnpm audit:prod")
) {
  failures.push(
    "The publish gate must fail when the production dependency audit reports a vulnerability."
  );
}
for (const [dependency, version] of Object.entries({
  qs: "6.15.2",
  dompurify: "3.4.12",
  "express>body-parser": "1.20.6",
})) {
  if (packageJson.pnpm?.overrides?.[dependency] !== version) {
    failures.push(
      `Security override ${dependency} must remain pinned to ${version}.`
    );
  }
}

const areasPage = fs.readFileSync(
  path.join(root, "client/src/pages/Areas.tsx"),
  "utf8"
);
const projectsPage = fs.readFileSync(
  path.join(root, "client/src/pages/Projects.tsx"),
  "utf8"
);
if (areasPage.includes("Area creation API is ready")) {
  failures.push("Areas page still contains the placeholder creation toast.");
}
if (projectsPage.includes("Project creation API is ready")) {
  failures.push("Projects page still contains the placeholder creation toast.");
}
if (
  !fs.existsSync(
    path.join(root, "client/src/components/areas/CreateAreaDialog.tsx")
  )
) {
  failures.push("CreateAreaDialog is required.");
}
if (
  !fs.existsSync(
    path.join(root, "client/src/components/projects/CreateProjectDialog.tsx")
  )
) {
  failures.push("CreateProjectDialog is required.");
}

const workflowSpecification = fs.readFileSync(
  path.join(root, "shared/workflowSpecification.ts"),
  "utf8"
);
const blindDetailHub = fs.readFileSync(
  path.join(root, "client/src/pages/BlindDetailHub.tsx"),
  "utf8"
);
if (
  !workflowSpecification.includes(
    "as const satisfies readonly CanonicalWorkflowPhase[]"
  )
) {
  failures.push(
    "Canonical workflow phases must retain literal action-key types."
  );
}
if (blindDetailHub.includes("as WorkflowActionKey")) {
  failures.push(
    "BlindDetailHub still contains the stale WorkflowActionKey cast."
  );
}

const themeContext = fs.readFileSync(
  path.join(root, "client/src/contexts/ThemeContext.tsx"),
  "utf8"
);
const themeToggle = fs.readFileSync(
  path.join(root, "client/src/components/theme/ThemeToggle.tsx"),
  "utf8"
);
if (!themeContext.includes('THEME_STORAGE_KEY = "sbts-theme-v2"')) {
  failures.push("Theme storage contract is missing.");
}
if (!themeToggle.includes("trpc.profile.updateTheme.useMutation")) {
  failures.push(
    "Quick theme changes must persist to the authenticated profile."
  );
}

const authRouter = fs.readFileSync(
  path.join(root, "server/routers/auth.ts"),
  "utf8"
);
if (authRouter.includes("opts.ctx.user ?? null")) {
  failures.push("auth.me must never return the raw database user row.");
}
if (!authRouter.includes("toAuthUser"))
  failures.push("Authentication routes must use the safe AuthUser DTO.");

const dashboard = fs.readFileSync(
  path.join(root, "client/src/pages/Dashboard.tsx"),
  "utf8"
);
if (
  dashboard.includes("@/lib/mockData") ||
  dashboard.includes("Representative registry view")
) {
  failures.push(
    "Dashboard must use the canonical database snapshot, not mock data."
  );
}
if (!dashboard.includes("trpc.reports.dashboardSnapshot")) {
  failures.push(
    "Dashboard is not connected to the canonical runtime snapshot."
  );
}

if (fs.existsSync(path.join(root, "client/src/lib/mockData.ts"))) {
  failures.push(
    "The legacy frontend mock-data catalog must not ship in the recovery release."
  );
}
const accessControlPage = fs.readFileSync(
  path.join(root, "client/src/pages/AccessControl.tsx"),
  "utf8"
);
if (
  !accessControlPage.includes("trpc.accessControl.model.useQuery") ||
  !accessControlPage.includes("trpc.accessControl.updateRoles.useMutation")
) {
  failures.push(
    "Access Control must read and persist the database-backed RBAC model."
  );
}

const storageProxy = fs.readFileSync(
  path.join(root, "server/_core/storageProxy.ts"),
  "utf8"
);
if (!storageProxy.includes("sdk.authenticateRequest(req)")) {
  failures.push("Storage redirects must require an authenticated session.");
}

const readOnlyContracts = [
  {
    file: "server/db/certificateGovernance.ts",
    forbidden:
      "getCertificateReadiness(projectId: string, blindTag: string) {\n  await ensureBlindWorkflowRuntime",
  },
  {
    file: "server/db/inspectionActivities.ts",
    forbidden:
      "getBlindInspectionActivities(input: { projectId: string; blindTag: string }, actor: ActingProjectUser) {\n  await ensureBlindWorkflowRuntime",
  },
  {
    file: "server/db/qualityGovernance.ts",
    forbidden:
      "getQualityRecords(input: { projectId: string; blindTag: string }, actor: ActingProjectUser) {\n  await ensureBlindWorkflowRuntime",
  },
];
for (const contract of readOnlyContracts) {
  const source = fs.readFileSync(path.join(root, contract.file), "utf8");
  if (source.includes(contract.forbidden)) {
    failures.push(
      `${contract.file} still initializes workflow state during a query.`
    );
  }
}
const featureToggleSource = fs.readFileSync(
  path.join(root, "server/db/featureToggles.ts"),
  "utf8"
);
const featureToggleReadBody = featureToggleSource.slice(
  featureToggleSource.indexOf("export async function getFeatureToggles"),
  featureToggleSource.indexOf("export async function updateFeatureToggles")
);
if (featureToggleReadBody.includes("db.insert")) {
  failures.push("getFeatureToggles must not create rows during a query.");
}

const sdkSource = fs.readFileSync(
  path.join(root, "server/_core/sdk.ts"),
  "utf8"
);
for (const binding of [
  ".setIssuer(ENV.appId)",
  ".setAudience(ENV.appId)",
  "issuer: ENV.appId",
  "audience: ENV.appId",
]) {
  if (!sdkSource.includes(binding))
    failures.push(`JWT deployment binding is missing: ${binding}`);
}

const ciWorkflow = fs.readFileSync(
  path.join(root, ".github/workflows/ci.yml"),
  "utf8"
);
const pnpmSetupIndex = ciWorkflow.indexOf("pnpm/action-setup");
const nodeSetupIndex = ciWorkflow.indexOf("actions/setup-node");
if (
  pnpmSetupIndex < 0 ||
  nodeSetupIndex < 0 ||
  pnpmSetupIndex > nodeSetupIndex
) {
  failures.push(
    "GitHub Actions must install pnpm before setup-node enables the pnpm cache."
  );
}
const pnpmSetupBlock = ciWorkflow.slice(
  ciWorkflow.indexOf("- name: Setup pnpm"),
  ciWorkflow.indexOf("- name: Setup Node.js")
);
if (/^\s+version:/m.test(pnpmSetupBlock)) {
  failures.push(
    "GitHub Actions must obtain pnpm from package.json packageManager; declaring a second version causes ERR_PNPM_BAD_PM_VERSION."
  );
}
if (!pnpmSetupBlock.includes("run_install: false")) {
  failures.push(
    "GitHub Actions must keep dependency installation in the explicit frozen-lockfile step."
  );
}

const result = {
  version: packageJson.version,
  filesChecked: required.length,
  status: failures.length ? "failed" : "passed",
  failures,
};
console.log(JSON.stringify(result, null, 2));
if (failures.length) process.exit(1);
