import { describe, expect, it } from "vitest";
import { normalizeBlindRows } from "./db";

describe("Blind equipment mapper", () => {
  it("exposes the legacy stored lineNumber column as the equipment field", () => {
    const updatedAt = new Date("2026-05-05T12:00:00.000Z");

    const [blind] = normalizeBlindRows([
      {
        tag: "BLD-LEGACY-1",
        projectId: "PRJ-1027",
        type: "Slip Blind",
        size: "12 in",
        rate: "300#",
        phase: "Broken / Preparation",
        owner: "Project Phase Owner",
        priority: "Normal",
        equipment: "SGP-04-FG-2401",
        location: "Train header",
        isolationPoint: "Upstream flange",
        slipMetalForemanApproved: 1,
        slipBlindMerged: 1,
        notes: "Legacy lineNumber column should be surfaced as equipment.",
        createdAt: updatedAt,
        updatedAt,
      } as any,
    ]);

    expect(blind).toMatchObject({
      tag: "BLD-LEGACY-1",
      equipment: "SGP-04-FG-2401",
      slipMetalForemanApproved: true,
      slipBlindMerged: true,
    });
  });
});
