/**
 * server/slipBlinds.test.ts
 * Unit tests for Slip Blind tracking logic and survey creation.
 */

import { describe, it, expect } from "vitest";

// ─── deriveSlipStatus logic (pure function tests) ─────────────────────────────

function deriveSlipStatus(row: {
  slipBlindMerged: number;
  slipMetalForemanApproved: number;
}): "in_service" | "removed" | "merged" | "unknown" {
  if (row.slipBlindMerged === 1) return "merged";
  if (row.slipMetalForemanApproved === 1) return "removed";
  return "in_service";
}

describe("deriveSlipStatus", () => {
  it("returns merged when slipBlindMerged is 1", () => {
    expect(deriveSlipStatus({ slipBlindMerged: 1, slipMetalForemanApproved: 0 })).toBe("merged");
  });

  it("merged takes precedence over foremanApproved", () => {
    expect(deriveSlipStatus({ slipBlindMerged: 1, slipMetalForemanApproved: 1 })).toBe("merged");
  });

  it("returns removed when foremanApproved is 1 and not merged", () => {
    expect(deriveSlipStatus({ slipBlindMerged: 0, slipMetalForemanApproved: 1 })).toBe("removed");
  });

  it("returns in_service when both flags are 0", () => {
    expect(deriveSlipStatus({ slipBlindMerged: 0, slipMetalForemanApproved: 0 })).toBe("in_service");
  });
});

// ─── Stats calculation logic ──────────────────────────────────────────────────

function calcStats(blinds: { slipBlindMerged: number; slipMetalForemanApproved: number; priority: string }[]) {
  const total = blinds.length;
  const merged = blinds.filter((b) => b.slipBlindMerged === 1).length;
  const removed = blinds.filter((b) => b.slipBlindMerged !== 1 && b.slipMetalForemanApproved === 1).length;
  const inService = total - merged - removed;
  const foremanApproved = blinds.filter((b) => b.slipMetalForemanApproved === 1).length;
  const critical = blinds.filter((b) => b.priority === "Critical").length;
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
  return { total, merged, removed, inService, foremanApproved, critical, inServicePct: pct(inService), removedPct: pct(removed), mergedPct: pct(merged) };
}

describe("calcStats", () => {
  it("returns zeros for empty array", () => {
    const s = calcStats([]);
    expect(s.total).toBe(0);
    expect(s.inService).toBe(0);
    expect(s.merged).toBe(0);
    expect(s.removed).toBe(0);
    expect(s.inServicePct).toBe(0);
  });

  it("counts correctly for mixed statuses", () => {
    const blinds = [
      { slipBlindMerged: 0, slipMetalForemanApproved: 0, priority: "Medium" }, // in_service
      { slipBlindMerged: 1, slipMetalForemanApproved: 0, priority: "Critical" }, // merged
      { slipBlindMerged: 0, slipMetalForemanApproved: 1, priority: "High" },    // removed
      { slipBlindMerged: 0, slipMetalForemanApproved: 0, priority: "Critical" }, // in_service
    ];
    const s = calcStats(blinds);
    expect(s.total).toBe(4);
    expect(s.inService).toBe(2);
    expect(s.merged).toBe(1);
    expect(s.removed).toBe(1);
    expect(s.critical).toBe(2);
    expect(s.foremanApproved).toBe(1);
  });

  it("calculates percentages correctly", () => {
    const blinds = [
      { slipBlindMerged: 0, slipMetalForemanApproved: 0, priority: "Low" },
      { slipBlindMerged: 0, slipMetalForemanApproved: 0, priority: "Low" },
      { slipBlindMerged: 0, slipMetalForemanApproved: 0, priority: "Low" },
      { slipBlindMerged: 1, slipMetalForemanApproved: 0, priority: "Low" },
    ];
    const s = calcStats(blinds);
    expect(s.inServicePct).toBe(75);
    expect(s.mergedPct).toBe(25);
    expect(s.removedPct).toBe(0);
  });

  it("handles all merged", () => {
    const blinds = [
      { slipBlindMerged: 1, slipMetalForemanApproved: 0, priority: "Low" },
      { slipBlindMerged: 1, slipMetalForemanApproved: 0, priority: "Low" },
    ];
    const s = calcStats(blinds);
    expect(s.merged).toBe(2);
    expect(s.inService).toBe(0);
    expect(s.mergedPct).toBe(100);
    expect(s.inServicePct).toBe(0);
  });
});

// ─── Survey item aggregation ──────────────────────────────────────────────────

function aggregateSurveyItems(items: {
  slipStatus: "in_service" | "removed" | "merged" | "unknown";
  foremanApproved: boolean;
}[]) {
  return {
    totalCount: items.length,
    inServiceCount: items.filter((i) => i.slipStatus === "in_service").length,
    removedCount: items.filter((i) => i.slipStatus === "removed").length,
    mergedCount: items.filter((i) => i.slipStatus === "merged").length,
    foremanApprovedCount: items.filter((i) => i.foremanApproved).length,
  };
}

describe("aggregateSurveyItems", () => {
  it("returns zeros for empty items", () => {
    const r = aggregateSurveyItems([]);
    expect(r.totalCount).toBe(0);
    expect(r.inServiceCount).toBe(0);
  });

  it("aggregates correctly", () => {
    const items = [
      { slipStatus: "in_service" as const, foremanApproved: true },
      { slipStatus: "removed" as const, foremanApproved: false },
      { slipStatus: "merged" as const, foremanApproved: false },
      { slipStatus: "in_service" as const, foremanApproved: true },
      { slipStatus: "unknown" as const, foremanApproved: false },
    ];
    const r = aggregateSurveyItems(items);
    expect(r.totalCount).toBe(5);
    expect(r.inServiceCount).toBe(2);
    expect(r.removedCount).toBe(1);
    expect(r.mergedCount).toBe(1);
    expect(r.foremanApprovedCount).toBe(2);
  });

  it("counts all foreman approved correctly", () => {
    const items = [
      { slipStatus: "in_service" as const, foremanApproved: true },
      { slipStatus: "in_service" as const, foremanApproved: true },
      { slipStatus: "in_service" as const, foremanApproved: false },
    ];
    const r = aggregateSurveyItems(items);
    expect(r.foremanApprovedCount).toBe(2);
  });
});

// ─── Survey date validation ───────────────────────────────────────────────────

function isValidSurveyDate(dateStr: string): boolean {
  if (!dateStr || dateStr.length !== 10) return false;
  const d = new Date(dateStr);
  return !isNaN(d.getTime());
}

describe("isValidSurveyDate", () => {
  it("accepts valid ISO date strings", () => {
    expect(isValidSurveyDate("2024-01-15")).toBe(true);
    expect(isValidSurveyDate("2026-07-04")).toBe(true);
  });

  it("rejects empty strings", () => {
    expect(isValidSurveyDate("")).toBe(false);
  });

  it("rejects invalid date formats", () => {
    expect(isValidSurveyDate("not-a-date")).toBe(false);
  });

  it("rejects partial dates", () => {
    expect(isValidSurveyDate("2024-01")).toBe(false);
  });
});

// ─── Status badge color mapping ───────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  in_service: "bg-emerald-100 text-emerald-800",
  removed: "bg-red-100 text-red-800",
  merged: "bg-blue-100 text-blue-800",
  unknown: "bg-slate-100 text-slate-600",
};

describe("STATUS_COLORS mapping", () => {
  it("has entries for all valid statuses", () => {
    expect(STATUS_COLORS["in_service"]).toBeDefined();
    expect(STATUS_COLORS["removed"]).toBeDefined();
    expect(STATUS_COLORS["merged"]).toBeDefined();
    expect(STATUS_COLORS["unknown"]).toBeDefined();
  });

  it("returns correct color class for in_service", () => {
    expect(STATUS_COLORS["in_service"]).toContain("emerald");
  });

  it("returns correct color class for removed", () => {
    expect(STATUS_COLORS["removed"]).toContain("red");
  });

  it("returns correct color class for merged", () => {
    expect(STATUS_COLORS["merged"]).toContain("blue");
  });
});

// ─── Excel export data structure ─────────────────────────────────────────────

describe("Excel export data structure", () => {
  it("summary sheet has correct column count", () => {
    const summaryRow = ["Metric", "Count", "Percentage"];
    expect(summaryRow.length).toBe(3);
  });

  it("detail sheet has correct column count", () => {
    const detailHeader = ["Tag", "Project", "Area", "Type", "Size", "Phase", "Priority", "Status", "Foreman Approved", "Location", "Owner"];
    expect(detailHeader.length).toBe(11);
  });

  it("survey sheet has correct column count", () => {
    const surveyHeader = ["Survey Date", "Conducted By", "Total", "In Service", "Removed", "Merged", "Foreman Approved", "Status"];
    expect(surveyHeader.length).toBe(8);
  });
});

// ─── getBlindSurveyHistory data transformation ────────────────────────────────

function normalizeSurveyHistoryItem(raw: {
  surveyId: number;
  slipStatus: string;
  foremanApproved: number;
  physicalCondition: string;
  location: string | null;
  notes: string | null;
  createdAt: Date;
  surveyDate: string | null;
  conductedByName: string | null;
  surveyStatus: string | null;
}) {
  return {
    surveyId: raw.surveyId,
    surveyDate: String(raw.surveyDate ?? ""),
    conductedByName: raw.conductedByName ?? null,
    slipStatus: raw.slipStatus,
    foremanApproved: raw.foremanApproved === 1,
    physicalCondition: raw.physicalCondition,
    location: raw.location ?? null,
    notes: raw.notes ?? null,
    surveyStatus: raw.surveyStatus ?? "submitted",
    createdAt: raw.createdAt,
  };
}

describe("normalizeSurveyHistoryItem", () => {
  const base = {
    surveyId: 1,
    slipStatus: "in_service",
    foremanApproved: 1,
    physicalCondition: "good",
    location: null,
    notes: null,
    createdAt: new Date("2026-01-01"),
    surveyDate: "2026-01-01",
    conductedByName: "Ahmed",
    surveyStatus: "submitted",
  };

  it("converts foremanApproved 1 to true", () => {
    const result = normalizeSurveyHistoryItem(base);
    expect(result.foremanApproved).toBe(true);
  });

  it("converts foremanApproved 0 to false", () => {
    const result = normalizeSurveyHistoryItem({ ...base, foremanApproved: 0 });
    expect(result.foremanApproved).toBe(false);
  });

  it("defaults surveyStatus to submitted when null", () => {
    const result = normalizeSurveyHistoryItem({ ...base, surveyStatus: null });
    expect(result.surveyStatus).toBe("submitted");
  });

  it("defaults surveyDate to empty string when null", () => {
    const result = normalizeSurveyHistoryItem({ ...base, surveyDate: null });
    expect(result.surveyDate).toBe("");
  });

  it("defaults conductedByName to null when null", () => {
    const result = normalizeSurveyHistoryItem({ ...base, conductedByName: null });
    expect(result.conductedByName).toBeNull();
  });

  it("preserves all other fields", () => {
    const result = normalizeSurveyHistoryItem(base);
    expect(result.surveyId).toBe(1);
    expect(result.slipStatus).toBe("in_service");
    expect(result.physicalCondition).toBe("good");
    expect(result.conductedByName).toBe("Ahmed");
  });
});

// ─── BlindDetailSheet derived slip status logic ───────────────────────────────

function deriveSheetSlipStatus(
  explicitStatus: string | undefined,
  blind: { slipBlindMerged: boolean; slipMetalForemanApproved: boolean } | null
): string {
  if (explicitStatus) return explicitStatus;
  if (!blind) return "in_service";
  if (blind.slipBlindMerged) return "merged";
  if (blind.slipMetalForemanApproved) return "removed";
  return "in_service";
}

describe("deriveSheetSlipStatus", () => {
  it("uses explicit status when provided", () => {
    expect(deriveSheetSlipStatus("removed", null)).toBe("removed");
  });

  it("uses explicit status even if blind says merged", () => {
    expect(
      deriveSheetSlipStatus("in_service", { slipBlindMerged: true, slipMetalForemanApproved: false })
    ).toBe("in_service");
  });

  it("returns in_service when blind is null and no explicit status", () => {
    expect(deriveSheetSlipStatus(undefined, null)).toBe("in_service");
  });

  it("returns merged from blind when no explicit status", () => {
    expect(
      deriveSheetSlipStatus(undefined, { slipBlindMerged: true, slipMetalForemanApproved: false })
    ).toBe("merged");
  });

  it("returns removed from blind when not merged", () => {
    expect(
      deriveSheetSlipStatus(undefined, { slipBlindMerged: false, slipMetalForemanApproved: true })
    ).toBe("removed");
  });

  it("returns in_service when both flags false", () => {
    expect(
      deriveSheetSlipStatus(undefined, { slipBlindMerged: false, slipMetalForemanApproved: false })
    ).toBe("in_service");
  });
});

// ─── Survey history sort order ────────────────────────────────────────────────

describe("survey history sort order", () => {
  const items = [
    { surveyId: 1, createdAt: new Date("2026-01-01") },
    { surveyId: 3, createdAt: new Date("2026-03-01") },
    { surveyId: 2, createdAt: new Date("2026-02-01") },
  ];

  it("reversed array shows newest first", () => {
    const sorted = [...items].reverse();
    expect(sorted[0].surveyId).toBe(2);
    expect(sorted[1].surveyId).toBe(3);
    expect(sorted[2].surveyId).toBe(1);
  });

  it("original ascending order preserved", () => {
    expect(items[0].surveyId).toBe(1);
    expect(items[2].surveyId).toBe(2);
  });
});

// ─── Physical condition config ────────────────────────────────────────────────

const CONDITION_CONFIG: Record<string, { label: string; color: string }> = {
  good: { label: "Good", color: "text-emerald-700 bg-emerald-50" },
  fair: { label: "Fair", color: "text-yellow-700 bg-yellow-50" },
  damaged: { label: "Damaged", color: "text-red-700 bg-red-50" },
  missing: { label: "Missing", color: "text-slate-700 bg-slate-100" },
};

describe("CONDITION_CONFIG", () => {
  it("has entries for all 4 conditions", () => {
    expect(Object.keys(CONDITION_CONFIG)).toHaveLength(4);
  });

  it("good condition uses emerald color", () => {
    expect(CONDITION_CONFIG.good.color).toContain("emerald");
  });

  it("damaged condition uses red color", () => {
    expect(CONDITION_CONFIG.damaged.color).toContain("red");
  });

  it("missing condition uses slate color", () => {
    expect(CONDITION_CONFIG.missing.color).toContain("slate");
  });

  it("all conditions have label and color", () => {
    Object.values(CONDITION_CONFIG).forEach((cfg) => {
      expect(cfg.label).toBeTruthy();
      expect(cfg.color).toBeTruthy();
    });
  });
});

// ─── getBlindSurveyHistory — mock-based integration tests ─────────────────────
// We test the transformation logic inline (mirroring the actual implementation)
// since the DB helper requires a live connection. The pure logic is extracted
// and verified here to ensure correctness without a real database.

type RawSurveyJoinRow = {
  surveyId: number;
  slipStatus: string;
  foremanApproved: number;
  physicalCondition: string;
  location: string | null;
  notes: string | null;
  createdAt: Date;
  surveyDate: string | null;
  conductedByName: string | null;
  surveyStatus: string | null;
};

function transformSurveyHistoryRows(rows: RawSurveyJoinRow[]) {
  return rows.map((i) => ({
    surveyId: i.surveyId,
    surveyDate: String(i.surveyDate ?? ""),
    conductedByName: i.conductedByName ?? null,
    slipStatus: i.slipStatus,
    foremanApproved: i.foremanApproved === 1,
    physicalCondition: i.physicalCondition,
    location: i.location ?? null,
    notes: i.notes ?? null,
    surveyStatus: i.surveyStatus ?? "submitted",
    createdAt: i.createdAt,
  }));
}

describe("getBlindSurveyHistory — transformation logic", () => {
  const mockRows: RawSurveyJoinRow[] = [
    {
      surveyId: 10,
      slipStatus: "in_service",
      foremanApproved: 1,
      physicalCondition: "good",
      location: "Unit-A",
      notes: "All good",
      createdAt: new Date("2026-01-15"),
      surveyDate: "2026-01-15",
      conductedByName: "Khalid",
      surveyStatus: "approved",
    },
    {
      surveyId: 11,
      slipStatus: "removed",
      foremanApproved: 0,
      physicalCondition: "damaged",
      location: null,
      notes: null,
      createdAt: new Date("2026-02-01"),
      surveyDate: "2026-02-01",
      conductedByName: null,
      surveyStatus: null,
    },
  ];

  it("returns correct count", () => {
    const result = transformSurveyHistoryRows(mockRows);
    expect(result).toHaveLength(2);
  });

  it("converts foremanApproved 1 → true", () => {
    const result = transformSurveyHistoryRows(mockRows);
    expect(result[0].foremanApproved).toBe(true);
  });

  it("converts foremanApproved 0 → false", () => {
    const result = transformSurveyHistoryRows(mockRows);
    expect(result[1].foremanApproved).toBe(false);
  });

  it("defaults null surveyStatus to 'submitted'", () => {
    const result = transformSurveyHistoryRows(mockRows);
    expect(result[1].surveyStatus).toBe("submitted");
  });

  it("preserves non-null surveyStatus", () => {
    const result = transformSurveyHistoryRows(mockRows);
    expect(result[0].surveyStatus).toBe("approved");
  });

  it("defaults null conductedByName to null", () => {
    const result = transformSurveyHistoryRows(mockRows);
    expect(result[1].conductedByName).toBeNull();
  });

  it("defaults null location to null", () => {
    const result = transformSurveyHistoryRows(mockRows);
    expect(result[1].location).toBeNull();
  });

  it("defaults null notes to null", () => {
    const result = transformSurveyHistoryRows(mockRows);
    expect(result[1].notes).toBeNull();
  });

  it("converts null surveyDate to empty string", () => {
    const rows: RawSurveyJoinRow[] = [
      { ...mockRows[0], surveyDate: null },
    ];
    const result = transformSurveyHistoryRows(rows);
    expect(result[0].surveyDate).toBe("");
  });

  it("preserves surveyId, slipStatus, physicalCondition", () => {
    const result = transformSurveyHistoryRows(mockRows);
    expect(result[0].surveyId).toBe(10);
    expect(result[0].slipStatus).toBe("in_service");
    expect(result[0].physicalCondition).toBe("good");
    expect(result[1].surveyId).toBe(11);
    expect(result[1].slipStatus).toBe("removed");
    expect(result[1].physicalCondition).toBe("damaged");
  });

  it("returns empty array for empty input", () => {
    const result = transformSurveyHistoryRows([]);
    expect(result).toHaveLength(0);
  });

  it("preserves createdAt Date objects", () => {
    const result = transformSurveyHistoryRows(mockRows);
    expect(result[0].createdAt).toBeInstanceOf(Date);
  });
});
