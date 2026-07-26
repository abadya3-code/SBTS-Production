import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Sprint 3 vertical integration contracts", () => {
  const root = path.resolve(process.cwd());
  const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");
  it("keeps field records connected to tRPC and the canonical runtime", () => {
    const router = read("server/routers/workflowRuntime.ts");
    const panel = read("client/src/components/workflow/WorkflowOperationsPanel.tsx");
    for (const segment of ["permit", "loto", "gasTest", "torque", "leakTest", "evidence", "isolationPackage", "inspection"]) {
      expect(router).toContain(`${segment}: router`);
    }
    expect(panel).toContain("workflowRuntime.permit.save");
    expect(panel).toContain("workflowRuntime.evidence.upload");
  });
  it("uses plant-configurable inspection activities as a transition gate", () => {
    const runtime = read("server/db/workflowRuntime.ts");
    const inspection = read("server/db/inspectionActivities.ts");
    expect(runtime).toContain("INSPECTION_ACTIVITIES_INCOMPLETE");
    expect(inspection).toContain("workflow.record.inspection");
    expect(inspection).toContain("workflow.inspection.approve");
    expect(inspection).toContain("different user than the activity completer");
    expect(inspection).toContain("inspectionActivityIsGateComplete");
    expect(inspection).toContain("evidenceRequired");
  });
  it("keeps Sprint 3 migration portable for TiDB", () => {
    const migration = read("drizzle/0015_sprint3_vertical_integration.sql");
    expect(migration).not.toContain("JSON_TABLE(");
    expect(migration).toContain("inspection_activity_templates");
    expect(migration).toContain("workflow.record.evidence");
  });
});
