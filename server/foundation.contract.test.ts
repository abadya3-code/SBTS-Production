import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (relativePath: string) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

describe("SBTS 2.2 foundational contracts", () => {
  it("keeps demo seeding out of Railway pre-deploy and database read modules", () => {
    const packageJson = JSON.parse(read("package.json"));
    const predeploy = String(packageJson.scripts["railway:predeploy"]);
    expect(predeploy).toContain("pnpm system:seed");
    expect(predeploy).toContain("pnpm workflow:backfill");
    expect(predeploy).not.toContain("pnpm data:seed");

    for (const file of [
      "server/db/projects.ts",
      "server/db/blinds.ts",
      "server/db/users.ts",
      "server/db/workflows.ts",
      "server/db/workflowRuntime.ts",
    ]) {
      expect(read(file)).not.toContain("seedAreasAndProjects");
    }
  });


  it("keeps database query paths read-only", () => {
    const certificate = read("server/db/certificateGovernance.ts");
    const inspection = read("server/db/inspectionActivities.ts");
    const quality = read("server/db/qualityGovernance.ts");
    const toggles = read("server/db/featureToggles.ts");

    expect(certificate).not.toContain(
      "getCertificateReadiness(projectId: string, blindTag: string) {\n  await ensureBlindWorkflowRuntime",
    );
    expect(inspection).not.toContain(
      "getBlindInspectionActivities(input: { projectId: string; blindTag: string }, actor: ActingProjectUser) {\n  await ensureBlindWorkflowRuntime",
    );
    expect(quality).not.toContain(
      "getQualityRecords(input: { projectId: string; blindTag: string }, actor: ActingProjectUser) {\n  await ensureBlindWorkflowRuntime",
    );

    const toggleReadBody = toggles.slice(
      toggles.indexOf("export async function getFeatureToggles"),
      toggles.indexOf("export async function updateFeatureToggles"),
    );
    expect(toggleReadBody).not.toContain("db.insert");
  });

  it("contains a portable recovery path for migration 0018", () => {
    const migrationRunner = read("scripts/apply-sbts-domain-migrations.ts");
    expect(migrationRunner).toContain("applySchemaAlignment0018");
    expect(migrationRunner).toContain("information_schema.columns");
    expect(migrationRunner).toContain("GET_LOCK");
    expect(migrationRunner).toContain("ALTER TABLE \\`blinds\\` ADD COLUMN");
  });

  it("validates the physical projects.projectStatus column", () => {
    const schema = read("drizzle/schema.ts");
    const initialProjectMigration = read("drizzle/0003_silly_vengeance.sql");
    const schemaContract = read("scripts/verify-schema-contract.ts");

    const projectsSchema = schema.slice(
      schema.indexOf('export const projects = mysqlTable("projects"'),
      schema.indexOf("export const blinds = mysqlTable"),
    );
    const projectsContract = schemaContract.slice(
      schemaContract.indexOf("  projects: ["),
      schemaContract.indexOf("  blinds: ["),
    );

    expect(projectsSchema).toContain("status: projectStatusEnum");
    expect(initialProjectMigration).toContain("`projectStatus`");
    expect(projectsContract).toContain('"projectStatus"');
    expect(projectsContract).not.toContain('"status"');
  });

  it("provides real Area and Project creation forms", () => {
    const areasPage = read("client/src/pages/Areas.tsx");
    const projectsPage = read("client/src/pages/Projects.tsx");
    const areaDialog = read("client/src/components/areas/CreateAreaDialog.tsx");
    const projectDialog = read("client/src/components/projects/CreateProjectDialog.tsx");

    expect(areasPage).toContain("CreateAreaDialog");
    expect(projectsPage).toContain("CreateProjectDialog");
    expect(areaDialog).toContain("trpc.areas.create.useMutation");
    expect(projectDialog).toContain("trpc.projects.create.useMutation");
    expect(areasPage).not.toContain("Area creation API is ready");
    expect(projectsPage).not.toContain("Project creation API is ready");
  });

  it("binds JWT sessions to the configured SBTS app ID", () => {
    const sdk = read("server/_core/sdk.ts");
    expect(sdk).toContain(".setIssuer(ENV.appId)");
    expect(sdk).toContain(".setAudience(ENV.appId)");
    expect(sdk).toContain("issuer: ENV.appId");
    expect(sdk).toContain("audience: ENV.appId");
    expect(sdk).toContain('user.userStatus !== "active"');
  });

  it("redacts internal tRPC errors in production", () => {
    const trpcCore = read("server/_core/trpc.ts");
    const server = read("server/_core/index.ts");
    expect(trpcCore).toContain('error.code === "INTERNAL_SERVER_ERROR"');
    expect(trpcCore).toContain("An internal server error occurred");
    expect(server).toContain('message: internal ? "Internal server error"');
  });

  it("installs pnpm before setup-node enables the pnpm cache", () => {
    const workflow = read(".github/workflows/ci.yml");
    expect(workflow.indexOf("pnpm/action-setup")).toBeGreaterThanOrEqual(0);
    expect(workflow.indexOf("pnpm/action-setup")).toBeLessThan(
      workflow.indexOf("actions/setup-node"),
    );
    const pnpmSetupBlock = workflow.slice(
      workflow.indexOf("- name: Setup pnpm"),
      workflow.indexOf("- name: Setup Node.js"),
    );
    expect(pnpmSetupBlock).toContain("run_install: false");
    expect(pnpmSetupBlock).not.toMatch(/^\s+version:/m);
  });

  it("keeps workflow action keys literal across UI, runtime and tRPC", () => {
    const specification = read("shared/workflowSpecification.ts");
    const blindDetail = read("client/src/pages/BlindDetailHub.tsx");
    expect(specification).toContain(
      "as const satisfies readonly CanonicalWorkflowPhase[]",
    );
    expect(blindDetail).not.toContain("as WorkflowActionKey");
    expect(blindDetail).toContain("actionKey: runtime.currentPhase.actionKey");
  });

  it("persists theme changes locally and in the authenticated user profile", () => {
    const themeContext = read("client/src/contexts/ThemeContext.tsx");
    const themeToggle = read("client/src/components/theme/ThemeToggle.tsx");
    const appShell = read("client/src/components/layout/AppShell.tsx");
    const migration = read("drizzle/0019_sprint4_foundation_stabilization.sql");

    expect(themeContext).toContain('THEME_STORAGE_KEY = "sbts-theme-v2"');
    expect(themeToggle).toContain("trpc.profile.updateTheme.useMutation");
    expect(appShell).toContain("never overwrite a");
    expect(migration).toContain("DEFAULT 'standard'");
  });

  it("keeps Area reads side-effect free and Area creation explicit", () => {
    const projectsDb = read("server/db/projects.ts");
    const getAreasBody = projectsDb.slice(
      projectsDb.indexOf("export async function getAreas"),
      projectsDb.indexOf("export async function getAreaById"),
    );
    const createAreaBody = projectsDb.slice(
      projectsDb.indexOf("export async function createArea"),
      projectsDb.indexOf("// ─── Project Queries"),
    );
    expect(getAreasBody).toContain("db.select().from(areas)");
    expect(getAreasBody).not.toContain("db.insert");
    expect(getAreasBody).not.toContain("seedAreasAndProjects");
    expect(createAreaBody).toContain("db.insert(areas)");
  });

});
