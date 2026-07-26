import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { evaluateQualityReadiness } from "./db/qualityGovernance";

const root = path.resolve(process.cwd());
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("Sprint 4 certificate and quality governance contracts", () => {
  it("blocks incomplete quality records using plant-configurable policy", () => {
    const policy = {
      requireDefectDispositionBeforeClosure: 1,
      requireMandatoryPunchClosureBeforeReadyForClosure: 1,
      requireNdtAcceptanceBeforeReadyForClosure: 1,
    } as any;
    expect(evaluateQualityReadiness({
      defects: [{ status: "repair_required", disposition: "Repair weld", requiresNdt: 1 }],
      punches: [{ status: "open", mandatory: 1 }],
      ndt: [{ status: "planned" }],
      policy,
    }).ready).toBe(false);
    expect(evaluateQualityReadiness({
      defects: [{ status: "closed", disposition: "Repair accepted", requiresNdt: 1 }],
      punches: [{ status: "closed", mandatory: 1 }],
      ndt: [{ status: "passed" }],
      policy,
    }).ready).toBe(true);
  });

  it("keeps certificate verification public but data-minimized", () => {
    const source = read("server/db/certificateGovernance.ts");
    expect(source).toContain("immutable source snapshot remains in the database");
    expect(source).toContain("publicSnapshot");
    expect(source).not.toContain("return {\n    certificateNumber: row.certificateNumber, blindTag");
    expect(read("client/src/App.tsx")).toContain('/certificate/verify/:token');
  });

  it("supports Railway-compatible S3 storage and production health checks", () => {
    const storage = read("server/storage.ts");
    const entry = read("server/_core/index.ts");
    expect(storage).toContain('envValue("S3_BUCKET", "BUCKET")');
    expect(storage).toContain("DeleteObjectCommand");
    expect(entry).toContain('app.get("/health"');
    expect(entry).toContain('app.get("/ready"');
    expect(entry).toContain('process.env.HOST || "0.0.0.0"');
  });

  it("keeps the Sprint 4 migration additive and TiDB-compatible", () => {
    const migration = read("drizzle/0016_sprint4_certificate_quality_governance.sql");
    expect(migration).toContain("certificate_records");
    expect(migration).toContain("defect_notifications");
    expect(migration).toContain("punch_items");
    expect(migration).toContain("ndt_records");
    expect(migration).toContain("storageKey");
    expect(migration).not.toContain("JSON_TABLE(");
  });
});
