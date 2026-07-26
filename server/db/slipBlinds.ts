/**
 * server/db/slipBlinds.ts
 * DB helpers for Slip Blind tracking and periodic safety surveys.
 */

import { and, asc, desc, eq } from "drizzle-orm";
import { requireDb } from "./core";
import {
  blinds,
  projects,
  areas,
  slipBlindSurveys,
  slipBlindSurveyItems,
} from "../../drizzle/schema";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SlipBlindStatus = "in_service" | "removed" | "merged" | "unknown";

export interface SlipBlindRow {
  tag: string;
  projectId: string;
  projectName: string;
  areaId: number | null;
  areaName: string | null;
  areaCode: string | null;
  type: string;
  size: string;
  rate: string | null;
  phase: string;
  priority: string;
  owner: string;
  equipment: string | null;
  location: string | null;
  isolationPoint: string | null;
  slipMetalForemanApproved: number;
  slipBlindMerged: number;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  // Derived status
  slipStatus: SlipBlindStatus;
}

export interface SlipBlindsStats {
  total: number;
  inService: number;
  removed: number;
  merged: number;
  foremanApproved: number;
  critical: number;
  inServicePct: number;
  removedPct: number;
  mergedPct: number;
  foremanApprovedPct: number;
  byProject: { projectId: string; projectName: string; count: number; inService: number; merged: number }[];
  byArea: { areaId: number; areaName: string; count: number; inService: number; merged: number }[];
  recentSurveys: { id: number; surveyDate: string; conductedByName: string | null; totalCount: number; status: string }[];
}

export interface SurveyRow {
  id: number;
  surveyDate: string;
  conductedByOpenId: string | null;
  conductedByName: string | null;
  areaId: number | null;
  projectId: string | null;
  totalCount: number;
  inServiceCount: number;
  removedCount: number;
  mergedCount: number;
  foremanApprovedCount: number;
  criticalCount: number;
  notes: string | null;
  status: string;
  approvedByOpenId: string | null;
  approvedAt: Date | null;
  createdAt: Date;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function deriveSlipStatus(row: { slipBlindMerged: number; slipMetalForemanApproved: number }): SlipBlindStatus {
  if (row.slipBlindMerged === 1) return "merged";
  if (row.slipMetalForemanApproved === 1) return "removed";
  return "in_service";
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Fetch all slip blinds with project and area context.
 * Filters: projectId, areaId, slipStatus, priority
 */
export async function getSlipBlindsList(opts: {
  projectId?: string;
  areaId?: number;
  slipStatus?: SlipBlindStatus | "all";
  priority?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ rows: SlipBlindRow[]; total: number }> {
  const { projectId, areaId, priority, search, limit = 100, offset = 0 } = opts;

  const conditions = [];

  if (projectId) conditions.push(eq(blinds.projectId, projectId));
  if (priority) conditions.push(eq(blinds.priority, priority as any));

  const db = await requireDb();
  const rows = await db
    .select({
      tag: blinds.tag,
      projectId: blinds.projectId,
      projectName: projects.name,
      areaId: projects.areaId,
      areaName: areas.name,
      areaCode: areas.code,
      type: blinds.type,
      size: blinds.size,
      rate: blinds.rate,
      phase: blinds.phase,
      priority: blinds.priority,
      owner: blinds.owner,
      equipment: blinds.equipment,
      location: blinds.location,
      isolationPoint: blinds.isolationPoint,
      slipMetalForemanApproved: blinds.slipMetalForemanApproved,
      slipBlindMerged: blinds.slipBlindMerged,
      notes: blinds.notes,
      createdAt: blinds.createdAt,
      updatedAt: blinds.updatedAt,
    })
    .from(blinds)
    .leftJoin(projects, eq(blinds.projectId, projects.id))
    .leftJoin(areas, eq(projects.areaId, areas.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(blinds.updatedAt))
    .limit(limit + 100) // fetch extra for client-side status filter
    .offset(offset);

  // Map to SlipBlindRow with derived status
  let mapped: SlipBlindRow[] = rows.map((r) => ({
    ...r,
    projectName: r.projectName ?? "",
    slipStatus: deriveSlipStatus(r),
  }));

  // Apply area filter (join-based)
  if (areaId) {
    mapped = mapped.filter((r) => r.areaId === areaId);
  }

  // Apply search filter
  if (search) {
    const q = search.toLowerCase();
    mapped = mapped.filter(
      (r) =>
        r.tag.toLowerCase().includes(q) ||
        r.projectName.toLowerCase().includes(q) ||
        (r.areaName ?? "").toLowerCase().includes(q) ||
        (r.location ?? "").toLowerCase().includes(q)
    );
  }

  // Apply slipStatus filter
  if (opts.slipStatus && opts.slipStatus !== "all") {
    mapped = mapped.filter((r) => r.slipStatus === opts.slipStatus);
  }

  const total = mapped.length;
  const paginated = mapped.slice(0, limit);

  return { rows: paginated, total };
}

/**
 * Aggregate statistics for the Slip Blinds dashboard.
 */
export async function getSlipBlindsStats(opts: {
  projectId?: string;
  areaId?: number;
} = {}): Promise<SlipBlindsStats> {
  const { projectId, areaId } = opts;

  const conditions = [];
  if (projectId) conditions.push(eq(blinds.projectId, projectId));

  const db = await requireDb();
  const allBlinds = await db
    .select({
      tag: blinds.tag,
      projectId: blinds.projectId,
      projectName: projects.name,
      areaId: projects.areaId,
      areaName: areas.name,
      priority: blinds.priority,
      slipMetalForemanApproved: blinds.slipMetalForemanApproved,
      slipBlindMerged: blinds.slipBlindMerged,
    })
    .from(blinds)
    .leftJoin(projects, eq(blinds.projectId, projects.id))
    .leftJoin(areas, eq(projects.areaId, areas.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  // Apply area filter
  const filtered = areaId ? allBlinds.filter((b) => b.areaId === areaId) : allBlinds;

  const total = filtered.length;
  const merged = filtered.filter((b) => b.slipBlindMerged === 1).length;
  const removed = filtered.filter((b) => b.slipBlindMerged !== 1 && b.slipMetalForemanApproved === 1).length;
  const inService = total - merged - removed;
  const foremanApproved = filtered.filter((b) => b.slipMetalForemanApproved === 1).length;
  const critical = filtered.filter((b) => b.priority === "Critical").length;

  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  // By project
  const projectMap = new Map<string, { projectId: string; projectName: string; count: number; inService: number; merged: number }>();
  for (const b of filtered) {
    const key = b.projectId;
    if (!projectMap.has(key)) {
      projectMap.set(key, { projectId: key, projectName: b.projectName ?? key, count: 0, inService: 0, merged: 0 });
    }
    const entry = projectMap.get(key)!;
    entry.count++;
    if (b.slipBlindMerged === 1) entry.merged++;
    else entry.inService++;
  }

  // By area
  const areaMap = new Map<number, { areaId: number; areaName: string; count: number; inService: number; merged: number }>();
  for (const b of filtered) {
    if (!b.areaId) continue;
    if (!areaMap.has(b.areaId)) {
      areaMap.set(b.areaId, { areaId: b.areaId, areaName: b.areaName ?? String(b.areaId), count: 0, inService: 0, merged: 0 });
    }
    const entry = areaMap.get(b.areaId)!;
    entry.count++;
    if (b.slipBlindMerged === 1) entry.merged++;
    else entry.inService++;
  }

  // Recent surveys
  const recentSurveys = await requireDb().then(d => d
    .select({
      id: slipBlindSurveys.id,
      surveyDate: slipBlindSurveys.surveyDate,
      conductedByName: slipBlindSurveys.conductedByName,
      totalCount: slipBlindSurveys.totalCount,
      status: slipBlindSurveys.status,
    })
    .from(slipBlindSurveys)
    .orderBy(desc(slipBlindSurveys.createdAt))
    .limit(5));

  return {
    total,
    inService,
    removed,
    merged,
    foremanApproved,
    critical,
    inServicePct: pct(inService),
    removedPct: pct(removed),
    mergedPct: pct(merged),
    foremanApprovedPct: pct(foremanApproved),
    byProject: Array.from(projectMap.values()).sort((a, b_) => b_.count - a.count).slice(0, 10),
    byArea: Array.from(areaMap.values()).sort((a, b_) => b_.count - a.count),
    recentSurveys: recentSurveys.map((sv) => ({
      id: sv.id,
      surveyDate: String(sv.surveyDate),
      conductedByName: sv.conductedByName,
      totalCount: sv.totalCount,
      status: sv.status,
    })),
  };
}

/**
 * Create a new periodic survey snapshot.
 */
export async function createSlipBlindSurvey(input: {
  surveyDate: string;
  conductedByOpenId: string;
  conductedByName: string;
  areaId?: number;
  projectId?: string;
  notes?: string;
  items: {
    blindTag: string;
    projectId: string;
    slipStatus: SlipBlindStatus;
    foremanApproved: boolean;
    physicalCondition: "good" | "fair" | "damaged" | "missing";
    location?: string;
    notes?: string;
  }[];
}): Promise<{ surveyId: number }> {
  const { items, ...header } = input;

  const inServiceCount = items.filter((i) => i.slipStatus === "in_service").length;
  const removedCount = items.filter((i) => i.slipStatus === "removed").length;
  const mergedCount = items.filter((i) => i.slipStatus === "merged").length;
  const foremanApprovedCount = items.filter((i) => i.foremanApproved).length;

  const db = await requireDb();
  const [result] = await db.insert(slipBlindSurveys).values({
    surveyDate: header.surveyDate as any,
    conductedByOpenId: header.conductedByOpenId,
    conductedByName: header.conductedByName,
    areaId: header.areaId,
    projectId: header.projectId,
    totalCount: items.length,
    inServiceCount,
    removedCount,
    mergedCount,
    foremanApprovedCount,
    criticalCount: 0,
    notes: header.notes,
    status: "submitted",
  });

  const surveyId = (result as any).insertId as number;

  if (items.length > 0) {
    await db.insert(slipBlindSurveyItems).values(
      items.map((item) => ({
        surveyId,
        blindTag: item.blindTag,
        projectId: item.projectId,
        slipStatus: item.slipStatus,
        foremanApproved: item.foremanApproved ? 1 : 0,
        physicalCondition: item.physicalCondition,
        location: item.location,
        notes: item.notes,
      }))
    );
  }

  return { surveyId };
}

/**
 * List all surveys with optional filters.
 */
export async function getSlipBlindSurveys(opts: {
  projectId?: string;
  areaId?: number;
  status?: string;
  limit?: number;
}): Promise<SurveyRow[]> {
  const { projectId, status, limit = 50 } = opts;

  const conditions = [];
  if (projectId) conditions.push(eq(slipBlindSurveys.projectId, projectId));
  if (status) conditions.push(eq(slipBlindSurveys.status, status as any));

  const db = await requireDb();
  const rows = await db
    .select()
    .from(slipBlindSurveys)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(slipBlindSurveys.createdAt))
    .limit(limit);

  return rows as unknown as SurveyRow[];
}

/**
 * Get all survey entries for a specific blind tag.
 * Used by the Blind Detail Sheet to show survey history per blind.
 */
export async function getBlindSurveyHistory(blindTag: string): Promise<
  {
    surveyId: number;
    surveyDate: string;
    conductedByName: string | null;
    slipStatus: string;
    foremanApproved: boolean;
    physicalCondition: string;
    location: string | null;
    notes: string | null;
    surveyStatus: string;
    createdAt: Date;
  }[]
> {
  const db = await requireDb();
  const items = await db
    .select({
      surveyId: slipBlindSurveyItems.surveyId,
      slipStatus: slipBlindSurveyItems.slipStatus,
      foremanApproved: slipBlindSurveyItems.foremanApproved,
      physicalCondition: slipBlindSurveyItems.physicalCondition,
      location: slipBlindSurveyItems.location,
      notes: slipBlindSurveyItems.notes,
      createdAt: slipBlindSurveyItems.createdAt,
      surveyDate: slipBlindSurveys.surveyDate,
      conductedByName: slipBlindSurveys.conductedByName,
      surveyStatus: slipBlindSurveys.status,
    })
    .from(slipBlindSurveyItems)
    .leftJoin(slipBlindSurveys, eq(slipBlindSurveyItems.surveyId, slipBlindSurveys.id))
    .where(eq(slipBlindSurveyItems.blindTag, blindTag))
    .orderBy(asc(slipBlindSurveyItems.createdAt));

  return items.map((i) => ({
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

/**
 * Get survey detail with all items.
 */
export async function getSlipBlindSurveyDetail(surveyId: number): Promise<{
  survey: SurveyRow;
  items: typeof slipBlindSurveyItems.$inferSelect[];
} | null> {
  const db = await requireDb();
  const [survey] = await db
    .select()
    .from(slipBlindSurveys)
    .where(eq(slipBlindSurveys.id, surveyId))
    .limit(1);

  if (!survey) return null;

  const items = await db
    .select()
    .from(slipBlindSurveyItems)
    .where(eq(slipBlindSurveyItems.surveyId, surveyId));

  return { survey: survey as unknown as SurveyRow, items };
}
