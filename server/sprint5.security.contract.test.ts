import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("Sprint 5 security contracts", () => {
  it("protects object-storage redirects with an authenticated session", () => {
    const source = read("server/_core/storageProxy.ts");
    expect(source).toContain("sdk.authenticateRequest(req)");
    expect(source).toContain('status(401).send("Authentication required")');
    expect(source).toContain("workflowEvidenceAttachments.storageKey");
    expect(source).toContain('access.permissionKeys.includes("blinds.view")');
    expect(source).toContain("normalizeStorageKey");
  });

  it("uses permission procedures for high-impact routes", () => {
    expect(read("server/routers/workflows.ts")).toContain('permissionProcedure("workflow.configure")');
    expect(read("server/routers/areas.ts")).toContain('permissionProcedure("projects.create")');
    expect(read("server/routers/projects.ts")).toContain('permissionProcedure("projects.create")');
    expect(read("server/routers/auditLogs.ts")).toContain('permissionProcedure("audit.view")');
  });

  it("enforces independent LOTO, torque, and leak-test decisions", () => {
    const source = read("server/db/workflowRecords.ts");
    expect(source).toContain("The user who applied LOTO cannot independently verify zero energy.");
    expect(source).toContain("The torque technician cannot accept or reject their own torque record.");
    expect(source).toContain("The leak-test performer cannot accept their own test.");
  });

  it("does not let deployment variables override release identity", () => {
    const source = read("server/_core/index.ts");
    expect(source).not.toContain("process.env.APP_VERSION?.trim() ||");
    expect(source).toContain("RELEASE_VERSION");
  });
});
