/**
 * server/db/reports.ts
 * ─────────────────────
 * Database helpers for the Reports module.
 * Aggregates data across projects, blinds, areas, and workflow logs
 * to support all report types and export formats.
 */

import { asc, eq, gte, lte, and, inArray } from "drizzle-orm";
import {
  areas, blinds, blindPhaseApprovals, blindWorkflowLogs,
  projectPhaseOwners, projects,
} from "../../drizzle/schema";
import { requireDb } from "./core";
import { blindPhaseOrder } from "./seed";
import type { BlindPhase, BlindPriority } from "./types";

// ─── Report Types ──────────────────────────────────────────────────────────

export interface ReportBlindRow {
  tag: string;
  projectId: string;
  projectName: string;
  areaCode: string;
  areaName: string;
  type: string;
  size: string;
  rate: string | null;
  phase: BlindPhase;
  priority: BlindPriority;
  owner: string;
  equipment: string | null;
  location: string | null;
  isolationPoint: string | null;
  notes: string | null;
  slipMetalForemanApproved: boolean;
  slipBlindMerged: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReportProjectSummary {
  id: string;
  name: string;
  areaId: number;
  areaCode: string;
  areaName: string;
  status: string;
  blindsCount: number;
  progress: number;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  // Computed metrics
  registeredBlinds: number;
  completedBlinds: number;
  inProgressBlinds: number;
  criticalBlinds: number;
  highPriorityBlinds: number;
  phaseCounts: Record<BlindPhase, number>;
  priorityCounts: Record<BlindPriority, number>;
  completionRate: number;
  phaseOwners: { phase: BlindPhase; ownerName: string; ownerRole: string; phaseColor: string }[];
}

export interface ReportAreaSummary {
  id: number;
  name: string;
  code: string;
  description: string | null;
  location: string | null;
  isActive: boolean;
  projectCount: number;
  totalBlinds: number;
  completedBlinds: number;
  criticalBlinds: number;
  completionRate: number;
  projects: ReportProjectSummary[];
}

export interface ReportFilters {
  areaId?: number;
  projectId?: string;
  phase?: BlindPhase;
  priority?: BlindPriority;
  status?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function computeBlindStatus(phase: BlindPhase): string {
  if (phase === "Inspection Ready") return "Completed";
  if (phase === "Broken / Preparation") return "Not Started";
  return "In Progress";
}

function emptyPhaseCounts(): Record<BlindPhase, number> {
  return {
    "Broken / Preparation": 0,
    "Assembly": 0,
    "Tight & Torque": 0,
    "Final Tight": 0,
    "Inspection Ready": 0,
  };
}

function emptyPriorityCounts(): Record<BlindPriority, number> {
  return { Low: 0, Normal: 0, High: 0, Critical: 0 };
}

// ─── Queries ───────────────────────────────────────────────────────────────

/**
 * Get all blinds with full project/area context for reporting.
 * Supports optional filters.
 */
export async function getReportBlinds(filters?: ReportFilters): Promise<ReportBlindRow[]> {
  const db = await requireDb();

  const [blindRows, projectRows, areaRows] = await Promise.all([
    db.select().from(blinds).orderBy(asc(blinds.tag)),
    db.select().from(projects),
    db.select().from(areas),
  ]);

  const projectById = new Map(projectRows.map((p) => [p.id, p]));
  const areaById = new Map(areaRows.map((a) => [a.id, a]));

  let rows: ReportBlindRow[] = blindRows.map((blind) => {
    const project = projectById.get(blind.projectId);
    const area = project ? areaById.get(project.areaId) : undefined;
    return {
      tag: blind.tag,
      projectId: blind.projectId,
      projectName: project?.name ?? "Unknown Project",
      areaCode: area?.code ?? "UNKNOWN",
      areaName: area?.name ?? "Unknown Area",
      type: blind.type,
      size: blind.size,
      rate: blind.rate ?? null,
      phase: blind.phase as BlindPhase,
      priority: blind.priority as BlindPriority,
      owner: blind.owner,
      equipment: blind.equipment ?? null,
      location: blind.location ?? null,
      isolationPoint: blind.isolationPoint ?? null,
      notes: blind.notes ?? null,
      slipMetalForemanApproved: blind.slipMetalForemanApproved === 1,
      slipBlindMerged: blind.slipBlindMerged === 1,
      createdAt: blind.createdAt,
      updatedAt: blind.updatedAt,
    };
  });

  // Apply filters
  if (filters?.areaId) {
    const areaProjects = projectRows
      .filter((p) => p.areaId === filters.areaId)
      .map((p) => p.id);
    rows = rows.filter((r) => areaProjects.includes(r.projectId));
  }
  if (filters?.projectId) {
    rows = rows.filter((r) => r.projectId === filters.projectId);
  }
  if (filters?.phase) {
    rows = rows.filter((r) => r.phase === filters.phase);
  }
  if (filters?.priority) {
    rows = rows.filter((r) => r.priority === filters.priority);
  }
  if (filters?.dateFrom) {
    rows = rows.filter((r) => r.updatedAt >= filters.dateFrom!);
  }
  if (filters?.dateTo) {
    rows = rows.filter((r) => r.updatedAt <= filters.dateTo!);
  }

  return rows;
}

/**
 * Get full project summaries with computed metrics for reporting.
 */
export async function getReportProjectSummaries(filters?: ReportFilters): Promise<ReportProjectSummary[]> {
  const db = await requireDb();

  const [projectRows, areaRows, blindRows, ownerRows] = await Promise.all([
    db.select().from(projects).orderBy(asc(projects.name)),
    db.select().from(areas),
    db.select().from(blinds),
    db.select().from(projectPhaseOwners),
  ]);

  const areaById = new Map(areaRows.map((a) => [a.id, a]));
  const blindsByProject = new Map<string, typeof blindRows>();
  for (const blind of blindRows) {
    const existing = blindsByProject.get(blind.projectId) ?? [];
    existing.push(blind);
    blindsByProject.set(blind.projectId, existing);
  }
  const ownersByProject = new Map<string, typeof ownerRows>();
  for (const owner of ownerRows) {
    const existing = ownersByProject.get(owner.projectId) ?? [];
    existing.push(owner);
    ownersByProject.set(owner.projectId, existing);
  }

  let summaries: ReportProjectSummary[] = projectRows.map((project) => {
    const area = areaById.get(project.areaId);
    const projectBlinds = blindsByProject.get(project.id) ?? [];
    const projectOwners = ownersByProject.get(project.id) ?? [];

    const phaseCounts = emptyPhaseCounts();
    const priorityCounts = emptyPriorityCounts();
    for (const blind of projectBlinds) {
      phaseCounts[blind.phase as BlindPhase] += 1;
      priorityCounts[blind.priority as BlindPriority] += 1;
    }

    const completedBlinds = phaseCounts["Inspection Ready"];
    const inProgressBlinds = projectBlinds.length - phaseCounts["Broken / Preparation"] - completedBlinds;
    const criticalBlinds = priorityCounts.Critical;
    const highPriorityBlinds = priorityCounts.High + priorityCounts.Critical;
    const completionRate = projectBlinds.length > 0
      ? Math.round((completedBlinds / projectBlinds.length) * 100)
      : 0;

    const phaseOwners = blindPhaseOrder.map((phase) => {
      const ownerRow = projectOwners.find((o) => o.phase === phase);
      return {
        phase,
        ownerName: ownerRow?.ownerName ?? "Unassigned",
        ownerRole: ownerRow?.ownerRole ?? "unassigned",
        phaseColor: ownerRow?.phaseColor ?? "#f59e0b",
      };
    });

    return {
      id: project.id,
      name: project.name,
      areaId: project.areaId,
      areaCode: area?.code ?? "UNKNOWN",
      areaName: area?.name ?? "Unknown Area",
      status: project.status,
      blindsCount: project.blindsCount,
      progress: project.progress,
      description: project.description ?? null,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      registeredBlinds: projectBlinds.length,
      completedBlinds,
      inProgressBlinds: Math.max(0, inProgressBlinds),
      criticalBlinds,
      highPriorityBlinds,
      phaseCounts,
      priorityCounts,
      completionRate,
      phaseOwners,
    };
  });

  // Apply filters
  if (filters?.areaId) {
    summaries = summaries.filter((s) => s.areaId === filters.areaId);
  }
  if (filters?.projectId) {
    summaries = summaries.filter((s) => s.id === filters.projectId);
  }
  if (filters?.status) {
    summaries = summaries.filter((s) => s.status === filters.status);
  }

  return summaries;
}

/**
 * Get area-level summaries with aggregated metrics.
 */
export async function getReportAreaSummaries(filters?: ReportFilters): Promise<ReportAreaSummary[]> {
  const db = await requireDb();
  const [areaRows] = await Promise.all([
    db.select().from(areas).orderBy(asc(areas.name)),
  ]);

  const projectSummaries = await getReportProjectSummaries(filters);

  return areaRows.map((area) => {
    const areaProjects = projectSummaries.filter((p) => p.areaId === area.id);
    const totalBlinds = areaProjects.reduce((sum, p) => sum + p.registeredBlinds, 0);
    const completedBlinds = areaProjects.reduce((sum, p) => sum + p.completedBlinds, 0);
    const criticalBlinds = areaProjects.reduce((sum, p) => sum + p.criticalBlinds, 0);
    const completionRate = totalBlinds > 0
      ? Math.round((completedBlinds / totalBlinds) * 100)
      : 0;

    return {
      id: area.id,
      name: area.name,
      code: area.code,
      description: area.description ?? null,
      location: area.location ?? null,
      isActive: area.isActive === 1,
      projectCount: areaProjects.length,
      totalBlinds,
      completedBlinds,
      criticalBlinds,
      completionRate,
      projects: areaProjects,
    };
  });
}

/**
 * Get global statistics for the executive summary report.
 */
export async function getReportGlobalStats(): Promise<{
  totalAreas: number;
  totalProjects: number;
  totalBlinds: number;
  completedBlinds: number;
  inProgressBlinds: number;
  criticalBlinds: number;
  completionRate: number;
  phaseCounts: Record<BlindPhase, number>;
  priorityCounts: Record<BlindPriority, number>;
  projectsByStatus: Record<string, number>;
  recentActivity: { date: Date; action: string; actor: string; blindTag: string; projectId: string }[];
}> {
  const db = await requireDb();

  const [areaRows, projectRows, blindRows, recentLogs] = await Promise.all([
    db.select().from(areas),
    db.select().from(projects),
    db.select().from(blinds),
    db.select().from(blindWorkflowLogs).orderBy(asc(blindWorkflowLogs.createdAt)).limit(20),
  ]);

  const phaseCounts = emptyPhaseCounts();
  const priorityCounts = emptyPriorityCounts();
  for (const blind of blindRows) {
    phaseCounts[blind.phase as BlindPhase] += 1;
    priorityCounts[blind.priority as BlindPriority] += 1;
  }

  const completedBlinds = phaseCounts["Inspection Ready"];
  const inProgressBlinds = blindRows.length - phaseCounts["Broken / Preparation"] - completedBlinds;
  const completionRate = blindRows.length > 0
    ? Math.round((completedBlinds / blindRows.length) * 100)
    : 0;

  const projectsByStatus: Record<string, number> = {};
  for (const project of projectRows) {
    projectsByStatus[project.status] = (projectsByStatus[project.status] ?? 0) + 1;
  }

  const recentActivity = recentLogs.map((log) => ({
    date: log.createdAt,
    action: log.action,
    actor: log.actorName ?? log.actorOpenId ?? "System",
    blindTag: log.blindTag,
    projectId: log.projectId,
  }));

  return {
    totalAreas: areaRows.length,
    totalProjects: projectRows.length,
    totalBlinds: blindRows.length,
    completedBlinds,
    inProgressBlinds: Math.max(0, inProgressBlinds),
    criticalBlinds: priorityCounts.Critical,
    completionRate,
    phaseCounts,
    priorityCounts,
    projectsByStatus,
    recentActivity,
  };
}
