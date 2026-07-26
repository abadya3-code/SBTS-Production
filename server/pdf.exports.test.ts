import { describe, expect, it } from "vitest";
import { buildCertificatePdfTableSpec, buildTagsPdfSpec } from "@shared/pdfExports";

const project = {
  id: "PRJ-1027",
  name: "North Train Shutdown",
  areaCode: "AREA-04",
  areaName: "Utilities North",
  status: "Active",
  description: "Execution package",
  progress: 62,
};

const metrics = {
  registeredBlinds: 1,
  plannedBlinds: 3,
  highPriorityBlinds: 1,
  criticalBlinds: 0,
  inspectionReadyBlinds: 0,
};

const blinds = [
  {
    tag: "BLD-1042",
    type: "Slip Blind",
    size: "8in",
    rate: "150#",
    phase: "Broken / Preparation" as const,
    owner: "Ali Technician",
    priority: "High" as const,
    equipment: "P-104A",
    location: "Pipe rack L2",
    isolationPoint: "IP-44",
    slipMetalForemanApproved: false,
    slipBlindMerged: true,
    notes: "Hold until flange verification.",
  },
];

describe("PDF export specs", () => {
  it("builds a certificate PDF contract with PDF filename, rate, area, and Slip Blind gate text", () => {
    const spec = buildCertificatePdfTableSpec(project, blinds, metrics, "2026-05-06 10:00");

    expect(spec.filename).toBe("prj-1027-certificates.pdf");
    expect(spec.title).toBe("SBTS Unified Certificate Package");
    expect(spec.summaryBody[0]).toContain("62%");
    expect(spec.footerText).toBe("Area: AREA-04 · Utilities North");
    expect(spec.blindRows[0][1]).toContain("BLD-1042");
    expect(spec.blindRows[0][2]).toContain("Rate 150#");
    expect(spec.blindRows[0][7]).toBe("Foreman pending / Merged");
  });

  it("builds a printable tag PDF contract with one PDF page per blind", () => {
    const spec = buildTagsPdfSpec(project, blinds, "2026-05-06 10:00");

    expect(spec.filename).toBe("prj-1027-blind-tags.pdf");
    expect(spec.pages).toHaveLength(1);
    expect(spec.pages[0].tag).toBe("BLD-1042");
    expect(spec.pages[0].rows).toContainEqual(["Type / Size", "Slip Blind · 8in · Rate 150#"]);
    expect(spec.pages[0].rows).toContainEqual(["Location", "Pipe rack L2"]);
    expect(spec.pages[0].footerText).toBe("AREA-04 · Generated 2026-05-06 10:00");
  });
});
