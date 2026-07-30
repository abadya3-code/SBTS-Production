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
  });
});
