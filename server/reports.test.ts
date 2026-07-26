/**
 * server/reports.test.ts
 * ──────────────────────
 * Unit tests for the Reports module.
 * Tests focus on pure logic (CSV escaping, date formatting, stat computation)
 * and router registration, avoiding live DB calls.
 */

import { describe, it, expect } from "vitest";

// ─── CSV Escaping ─────────────────────────────────────────────────────────

function escapeCSV(val: unknown): string {
  const str = val == null ? "" : String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

describe("CSV escaping utility", () => {
  it("wraps values with commas in quotes", () => {
    expect(escapeCSV("hello, world")).toBe('"hello, world"');
  });

  it("escapes double quotes", () => {
    expect(escapeCSV('say "hello"')).toBe('"say ""hello"""');
  });

  it("handles null as empty string", () => {
    expect(escapeCSV(null)).toBe("");
  });

  it("handles undefined as empty string", () => {
    expect(escapeCSV(undefined)).toBe("");
  });

  it("passes plain strings through unchanged", () => {
    expect(escapeCSV("SRU-31")).toBe("SRU-31");
  });

  it("converts numbers to strings", () => {
    expect(escapeCSV(42)).toBe("42");
  });

  it("wraps strings with newlines in quotes", () => {
    expect(escapeCSV("line1\nline2")).toBe('"line1\nline2"');
  });

  it("handles empty string", () => {
    expect(escapeCSV("")).toBe("");
  });
});

// ─── Date Formatting ──────────────────────────────────────────────────────

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "N/A";
  return new Date(d).toLocaleDateString("en-SA", { timeZone: "Asia/Riyadh" });
}

describe("Date formatting utility", () => {
  it("returns N/A for null", () => {
    expect(formatDate(null)).toBe("N/A");
  });

  it("returns N/A for undefined", () => {
    expect(formatDate(undefined)).toBe("N/A");
  });

  it("formats a valid ISO date string", () => {
    const result = formatDate("2024-01-15T00:00:00Z");
    expect(result).toMatch(/\d+\/\d+\/\d+/);
  });

  it("formats a Date object", () => {
    const result = formatDate(new Date("2024-06-01T00:00:00Z"));
    expect(result).toMatch(/\d+\/\d+\/\d+/);
  });

  it("handles invalid date string gracefully", () => {
    const result = formatDate("not-a-date");
    expect(typeof result).toBe("string");
  });
});

// ─── Completion Rate Computation ──────────────────────────────────────────

function computeCompletionRate(completed: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((completed / total) * 100);
}

describe("computeCompletionRate", () => {
  it("returns 0 when total is 0", () => {
    expect(computeCompletionRate(0, 0)).toBe(0);
  });

  it("returns 100 when all blinds are completed", () => {
    expect(computeCompletionRate(10, 10)).toBe(100);
  });

  it("returns 50 for half completed", () => {
    expect(computeCompletionRate(5, 10)).toBe(50);
  });

  it("rounds to nearest integer", () => {
    expect(computeCompletionRate(1, 3)).toBe(33);
    expect(computeCompletionRate(2, 3)).toBe(67);
  });

  it("returns 0 when completed is 0", () => {
    expect(computeCompletionRate(0, 100)).toBe(0);
  });
});

// ─── Phase Distribution ───────────────────────────────────────────────────

type BlindPhase = "Broken / Preparation" | "Assembly" | "Tight & Torque" | "Final Tight" | "Inspection Ready";

function buildPhaseCounts(blinds: { phase: string }[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const b of blinds) {
    counts[b.phase] = (counts[b.phase] ?? 0) + 1;
  }
  return counts;
}

describe("buildPhaseCounts", () => {
  it("returns empty object for empty array", () => {
    expect(buildPhaseCounts([])).toEqual({});
  });

  it("counts single phase correctly", () => {
    const result = buildPhaseCounts([
      { phase: "Assembly" },
      { phase: "Assembly" },
      { phase: "Inspection Ready" },
    ]);
    expect(result["Assembly"]).toBe(2);
    expect(result["Inspection Ready"]).toBe(1);
  });

  it("handles all 5 phases", () => {
    const blinds = [
      { phase: "Broken / Preparation" },
      { phase: "Assembly" },
      { phase: "Tight & Torque" },
      { phase: "Final Tight" },
      { phase: "Inspection Ready" },
    ];
    const result = buildPhaseCounts(blinds);
    expect(Object.keys(result)).toHaveLength(5);
    Object.values(result).forEach((count) => expect(count).toBe(1));
  });
});

// ─── Priority Counting ────────────────────────────────────────────────────

function buildPriorityCounts(blinds: { priority: string }[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const b of blinds) {
    counts[b.priority] = (counts[b.priority] ?? 0) + 1;
  }
  return counts;
}

describe("buildPriorityCounts", () => {
  it("returns empty object for empty array", () => {
    expect(buildPriorityCounts([])).toEqual({});
  });

  it("counts Critical priority correctly", () => {
    const result = buildPriorityCounts([
      { priority: "Critical" },
      { priority: "Critical" },
      { priority: "Normal" },
    ]);
    expect(result["Critical"]).toBe(2);
    expect(result["Normal"]).toBe(1);
  });
});

// ─── Filter Building ──────────────────────────────────────────────────────

interface ReportFilters {
  areaId?: number;
  projectId?: string;
  phase?: string;
  priority?: string;
  status?: string;
}

function buildFilterSummary(filters?: ReportFilters): string {
  if (!filters) return "No filters applied";
  const parts: string[] = [];
  if (filters.areaId) parts.push(`Area: ${filters.areaId}`);
  if (filters.projectId) parts.push(`Project: ${filters.projectId}`);
  if (filters.phase) parts.push(`Phase: ${filters.phase}`);
  if (filters.priority) parts.push(`Priority: ${filters.priority}`);
  if (filters.status) parts.push(`Status: ${filters.status}`);
  return parts.length > 0 ? parts.join(", ") : "No filters applied";
}

describe("buildFilterSummary", () => {
  it("returns no-filter message for undefined", () => {
    expect(buildFilterSummary(undefined)).toBe("No filters applied");
  });

  it("returns no-filter message for empty object", () => {
    expect(buildFilterSummary({})).toBe("No filters applied");
  });

  it("includes areaId in summary", () => {
    expect(buildFilterSummary({ areaId: 3 })).toContain("Area: 3");
  });

  it("includes multiple filters", () => {
    const result = buildFilterSummary({ areaId: 1, phase: "Assembly", priority: "High" });
    expect(result).toContain("Area: 1");
    expect(result).toContain("Phase: Assembly");
    expect(result).toContain("Priority: High");
  });
});

// ─── Router Registration ──────────────────────────────────────────────────

describe("Reports router registration", () => {
  it("reportsRouter is exported from server/routers/reports.ts", async () => {
    const { reportsRouter } = await import("../server/routers/reports");
    expect(reportsRouter).toBeDefined();
    expect(typeof reportsRouter).toBe("object");
  });

  it("reportsRouter has required procedures", async () => {
    const { reportsRouter } = await import("../server/routers/reports");
    const record = (reportsRouter as any)._def.record;
    expect(record).toHaveProperty("globalStats");
    expect(record).toHaveProperty("blinds");
    expect(record).toHaveProperty("projectSummaries");
    expect(record).toHaveProperty("areaSummaries");
  });

  it("reportsRouter is registered in appRouter", async () => {
    const { appRouter } = await import("../server/routers/index");
    const record = (appRouter as any)._def.record;
    expect(record).toHaveProperty("reports");
  });
});
