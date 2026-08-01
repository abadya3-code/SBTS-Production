import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  BlindQrDomainError,
  buildBlindQrPublicPayload,
  buildBlindQrVerificationUrl,
  createBlindQrVerificationToken,
  planBlindQrLifecycle,
} from "./db/blindQr";

const root = path.resolve(process.cwd());
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("Blind QR secure lifecycle", () => {
  it("creates unpredictable URL-safe 256-bit tokens and relative verification URLs", () => {
    const first = createBlindQrVerificationToken();
    const second = createBlindQrVerificationToken();

    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(second).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first).not.toBe(second);
    expect(buildBlindQrVerificationUrl(first)).toBe(`/blind/verify/${first}`);
  });

  it("enforces generate, rotate, and revoke lifecycle rules", () => {
    expect(planBlindQrLifecycle("generate", [])).toEqual({
      active: null,
      version: 1,
      previousTokenId: null,
    });

    const revoked = [{ id: 10, version: 1, status: "revoked" as const }];
    expect(planBlindQrLifecycle("generate", revoked)).toEqual({
      active: null,
      version: 2,
      previousTokenId: 10,
    });

    const active = [{ id: 11, version: 2, status: "active" as const }];
    expect(planBlindQrLifecycle("rotate", active)).toEqual({
      active: active[0],
      version: 3,
      previousTokenId: 11,
    });
    expect(planBlindQrLifecycle("revoke", active)).toEqual({
      active: active[0],
      version: 2,
      previousTokenId: 11,
    });

    expect(() => planBlindQrLifecycle("generate", active)).toThrow(
      BlindQrDomainError
    );
    expect(() => planBlindQrLifecycle("rotate", revoked)).toThrow(
      "No active QR token exists to rotate."
    );
    expect(() => planBlindQrLifecycle("revoke", revoked)).toThrow(
      "No active QR token exists to revoke."
    );
  });

  it.each([
    ["active", true],
    ["superseded", false],
    ["revoked", false],
  ] as const)(
    "reports %s token validity without leaking restricted records",
    (status, valid) => {
      const payload = buildBlindQrPublicPayload(
        {
          version: 3,
          status,
          issuedAt: new Date("2026-08-01T10:00:00.000Z"),
          revokedAt:
            status === "revoked" ? new Date("2026-08-01T11:00:00.000Z") : null,
          project: { id: "PRJ-001", name: "Shutdown", status: "Active" },
          blind: {
            tag: "BLD-001",
            type: "Slip Blind",
            size: "12",
            rate: "150",
            phase: "Broken / Preparation",
            priority: "Normal",
            equipment: "D-102",
            material: "CS",
            flangeType: "RF",
            lineNumber: "12-P-001",
          },
        },
        new Date("2026-08-01T12:00:00.000Z")
      );

      expect(payload.verification).toMatchObject({ status, valid, version: 3 });
      expect(Object.keys(payload)).toEqual([
        "verification",
        "project",
        "blind",
      ]);
      expect(Object.keys(payload.blind)).toEqual([
        "tag",
        "type",
        "size",
        "rating",
        "phase",
        "priority",
        "equipment",
        "material",
        "flangeType",
        "lineNumber",
      ]);
      const serialized = JSON.stringify(payload).toLowerCase();
      for (const restricted of [
        "verificationtoken",
        "issuedbyopenid",
        "revokedbyopenid",
        "permit",
        "loto",
        "evidence",
        "notes",
        "isolationpoint",
      ]) {
        expect(serialized).not.toContain(restricted);
      }
    }
  );
});

describe("Blind QR integration contracts", () => {
  it("protects lifecycle procedures with qr.manage while keeping verification policy-aware", () => {
    const router = read("server/routers/blindQr.ts");
    expect(router.match(/permissionProcedure\("qr\.manage"\)/g)).toHaveLength(
      5
    );
    expect(router).toContain("state:");
    expect(router).toContain("batchState:");
    expect(router).toContain("generate:");
    expect(router).toContain("generateBatch:");
    expect(router).toContain("rotate:");
    expect(router).toContain("revoke:");
    expect(router).toContain("verify: publicProcedure");
    const batchStateProcedure = router.slice(
      router.indexOf("batchState:"),
      router.indexOf("generate:")
    );
    expect(batchStateProcedure).toContain(
      'permissionProcedure("qr.manage", "reports.export")'
    );
    expect(batchStateProcedure).toContain("getBlindQrBatchState");
    expect(batchStateProcedure).not.toContain("generateBlindQrBatch");
    expect(router).toContain(".max(200)");

    const database = read("server/db/blindQr.ts");
    expect(database).toContain('randomBytes(32).toString("base64url")');
    expect(database).toContain("security.qrPublicAccess !== 1");
    expect(database).toContain("security.qrRequireAuth === 1");
    expect(database).toContain('.for("update")');
    expect(
      database.match(/db\.transaction|\.transaction/g)?.length
    ).toBeGreaterThanOrEqual(3);
    expect(database).toContain("blindWorkflowLogs");
  });

  it("registers the API and public mobile route with explicit token states", () => {
    expect(read("server/routers/index.ts")).toContain("blindQr: blindQrRouter");
    expect(read("client/src/App.tsx")).toContain("/blind/verify/:token");
    const page = read("client/src/pages/BlindQrVerification.tsx");
    expect(page).toContain('status === "active"');
    expect(page).toContain('status === "superseded"');
    expect(page).toContain("Revoked blind QR");
    expect(page).toContain("QRCode.toDataURL");
  });
});
