/**
 * server/db/projects.ts
 * ─────────────────────
 * Areas, Projects, and Project Settings CRUD helpers.
 */

import { asc, eq } from "drizzle-orm";
import {
  InsertProject, InsertProjectPhaseOwner, InsertProjectSettings,
  areas, blindWorkflowRuntime, blinds, projectPhaseOwners, projectSettings, projects, projectWorkflowAssignments, users, workflowTemplates,
} from "../../drizzle/schema";
import { requireDb } from "./core";
import {
  AreaInput, AreaModel, AssignableProjectUser, BlindPhase, BlindModel,
  BlindPriority, ProjectDetailModel, ProjectInput, ProjectModel,
  ProjectPhaseOwnerInput, ProjectSettingsModel,
} from "./types";
import {
  blindPhaseOrder, defaultPhaseColors, defaultPhaseOwners,
  sanitizePhaseColor, serializePhaseAssignees,
} from "./seed";
import { normalizeBlindRows, canActingUserEditAssignedPhase } from "./blinds";
import type { ActingProjectUser } from "./types";
import { getCanonicalPhase } from "../../shared/workflowRuntime";
import type { CanonicalPhaseKey, WorkflowLifecycleState } from "../../shared/workflowSpecification";

// ─── Normalize Helpers ─────────────────────────────────────────────────────

function normalizeAreaRows(
  areaRows: (typeof areas.$inferSelect)[],
  projectRows: Pick<typeof projects.$inferSelect, "areaId">[],
): AreaModel[] {
  const projectCounts = projectRows.reduce<Map<number, number>>((counts, project) => {
    counts.set(project.areaId, (counts.get(project.areaId) ?? 0) + 1);
    return counts;
  }, new Map());
  return areaRows.map((area) => ({
    id: area.id,
    name: area.name,
    code: area.code,
    description: area.description,
    location: area.location,
    isActive: area.isActive === 1,
    projectCount: projectCounts.get(area.id) ?? 0,
    createdAt: area.createdAt,
    updatedAt: area.updatedAt,
  }));
}

export function normalizeProjectRows(
  projectRows: (typeof projects.$inferSelect)[],
  areaRows: (typeof areas.$inferSelect)[],
): ProjectModel[] {
  const areaById = new Map(areaRows.map((area) => [area.id, area]));
  return projectRows.map((project) => {
    const area = areaById.get(project.areaId);
    return {
      id: project.id,
      name: project.name,
      areaId: project.areaId,
      areaCode: area?.code ?? "UNKNOWN",
      areaName: area?.name ?? "Unassigned area",
      status: project.status as ProjectModel["status"],
      blindsCount: project.blindsCount,
      progress: project.progress,
      description: project.description,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };
  });
}

function normalizePhaseAssignees(
  value: string | null | undefined,
  fallbackName?: string | null,
): ProjectSettingsModel["phaseOwners"][number]["owners"] {
  if (value) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => ({
            openId: typeof item?.openId === "string" ? item.openId.trim() : "",
            name: typeof item?.name === "string" ? item.name.trim() : "",
            email: typeof item?.email === "string" && item.email.trim() ? item.email.trim() : null,
            avatarUrl: typeof item?.avatarUrl === "string" && item.avatarUrl.trim() ? item.avatarUrl.trim() : null,
          }))
          .filter((item) => item.openId && item.name);
      }
    } catch {
      return [];
    }
  }
  const legacyName = fallbackName?.trim();
  if (!legacyName || legacyName === "Unassigned") return [];
  return [{ openId: legacyName, name: legacyName, email: null, avatarUrl: null }];
}

export function normalizeProjectSettingsRows(
  projectId: string,
  rows: (typeof projectPhaseOwners.$inferSelect)[],
  settingsRow?: (typeof projectSettings.$inferSelect) | null,
): ProjectSettingsModel {
  const rowByPhase = new Map(rows.map((row) => [row.phase as BlindPhase, row]));
  const defaultsByPhase = new Map(defaultPhaseOwners.map((owner) => [owner.phase, owner]));
  return {
    projectId,
    slipBlindGateRequired: settingsRow?.slipBlindGateRequired !== 0,
    phaseOwners: blindPhaseOrder.map((phase) => {
      const saved = rowByPhase.get(phase);
      const fallback = defaultsByPhase.get(phase) ?? {
        phase,
        ownerName: "Unassigned",
        ownerRole: "unassigned",
        phaseColor: defaultPhaseColors[phase],
      };
      const owners = normalizePhaseAssignees(saved?.ownersJson, saved?.ownerName ?? fallback.ownerName);
      return {
        projectId,
        phase,
        owners,
        ownerName: owners.length > 0
          ? owners.map((owner) => owner.name).join(", ")
          : (saved?.ownerName ?? fallback.ownerName ?? "Unassigned"),
        ownerRole: saved?.ownerRole ?? fallback.ownerRole ?? "unassigned",
        phaseColor: sanitizePhaseColor(saved?.phaseColor ?? fallback.phaseColor, phase),
        updatedAt: saved?.updatedAt ?? null,
      };
    }),
  };
}

function summarizeProjectBlinds(
  project: ProjectModel,
  blindRows: BlindModel[],
): ProjectDetailModel["metrics"] {
  const phaseCounts: Record<BlindPhase, number> = {
    "Broken / Preparation": 0,
    Assembly: 0,
    "Tight & Torque": 0,
    "Final Tight": 0,
    "Inspection Ready": 0,
  };
  const priorityCounts: Record<BlindPriority, number> = { Low: 0, Normal: 0, High: 0, Critical: 0 };
  for (const blind of blindRows) {
    phaseCounts[blind.phase] += 1;
    priorityCounts[blind.priority] += 1;
  }
  const criticalBlinds = priorityCounts.Critical;
  const highPriorityBlinds = priorityCounts.High + priorityCounts.Critical;
  const inspectionReadyBlinds = phaseCounts["Inspection Ready"];
  const nextAction = criticalBlinds > 0
    ? "Review critical blinds and clear safety hold points before the next execution gate."
    : highPriorityBlinds > 0
      ? "Prioritize high-priority blinds and confirm owner updates before closeout."
      : inspectionReadyBlinds === blindRows.length && blindRows.length > 0
        ? "Prepare inspection package and closeout certificates for this project."
        : "Continue progressing blind records through assembly, torque, and inspection gates.";
  return {
    registeredBlinds: blindRows.length,
    plannedBlinds: project.blindsCount,
    highPriorityBlinds,
    criticalBlinds,
    inspectionReadyBlinds,
    phaseCounts,
    priorityCounts,
    nextAction,
  };
}

// ─── Area Queries ──────────────────────────────────────────────────────────

export async function getAreas(): Promise<AreaModel[]> {
  const db = await requireDb();
  const [areaRows, projectRows] = await Promise.all([
    db.select().from(areas).orderBy(asc(areas.name)),
    db.select({ areaId: projects.areaId }).from(projects),
  ]);
  return normalizeAreaRows(areaRows, projectRows);
}

export async function getAreaById(id: number): Promise<AreaModel | undefined> {
  const db = await requireDb();
  const areaRows = await db.select().from(areas).where(eq(areas.id, id)).limit(1);
  if (!areaRows[0]) return undefined;
  const projectRows = await db.select({ areaId: projects.areaId }).from(projects).where(eq(projects.areaId, id));
  return normalizeAreaRows(areaRows, projectRows)[0];
}

export async function createArea(input: AreaInput): Promise<AreaModel> {
  const db = await requireDb();
  const code = input.code.trim().toUpperCase();
  const existing = await db.select({ id: areas.id }).from(areas).where(eq(areas.code, code)).limit(1);
  if (existing[0]) throw new Error(`Area code ${code} already exists.`);

  await db.insert(areas).values({
    name: input.name.trim(),
    code,
    description: input.description?.trim() || null,
    location: input.location?.trim() || null,
    isActive: input.isActive === false ? 0 : 1,
  });
  const areaRows = await db.select().from(areas).where(eq(areas.code, code)).limit(1);
  if (!areaRows[0]) throw new Error("Area could not be read after creation.");
  return normalizeAreaRows(areaRows, [])[0];
}

// ─── Project Queries ───────────────────────────────────────────────────────

export async function getAllProjects(): Promise<ProjectModel[]> {
  const db = await requireDb();
  const [projectRows, areaRows] = await Promise.all([
    db.select().from(projects).orderBy(asc(projects.name)),
    db.select().from(areas),
  ]);
  return normalizeProjectRows(projectRows, areaRows);
}

export async function getProjectsByArea(areaId: number): Promise<ProjectModel[]> {
  const db = await requireDb();
  const [projectRows, areaRows] = await Promise.all([
    db.select().from(projects).where(eq(projects.areaId, areaId)).orderBy(asc(projects.name)),
    db.select().from(areas),
  ]);
  return normalizeProjectRows(projectRows, areaRows);
}

export async function createProject(input: ProjectInput): Promise<ProjectModel> {
  const db = await requireDb();
  const workflowRows = await db
    .select({ id: workflowTemplates.id })
    .from(workflowTemplates)
    .where(eq(workflowTemplates.id, "wf-sbts-standard-v2"))
    .limit(1);
  if (!workflowRows[0]) {
    throw new Error(
      "System workflow reference data is missing. Run pnpm system:seed before creating projects.",
    );
  }
  const projectId = input.id.trim().toUpperCase();
  const existingProject = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (existingProject[0]) throw new Error(`Project ID ${projectId} already exists.`);

  const targetArea = await getAreaById(input.areaId);
  if (!targetArea) throw new Error(`Cannot create project for unknown areaId: ${input.areaId}`);
  if (!targetArea.isActive) throw new Error(`Area ${targetArea.code} is inactive.`);

  await db.transaction(async (tx) => {
    await tx.insert(projects).values({
      id: projectId,
      name: input.name.trim(),
      areaId: input.areaId,
      status: input.status,
      blindsCount: input.blindsCount ?? 0,
      progress: input.progress ?? 0,
      description: input.description ?? null,
    });
    await tx.insert(projectWorkflowAssignments).values({
      projectId,
      workflowTemplateId: "wf-sbts-standard-v2",
      workflowVersion: "2.0",
      status: "active",
      migrationVersion: 2,
      assignedByOpenId: "project-create",
    });
  });
  const saved = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!saved[0]) throw new Error("Project could not be read after creation.");
  const areaRows = await db.select().from(areas);
  return normalizeProjectRows(saved, areaRows)[0];
}

export async function getProjectDetail(projectId: string): Promise<ProjectDetailModel | undefined> {
  const db = await requireDb();
  const projectRows = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!projectRows[0]) return undefined;
  const [areaRows, blindRows, runtimeRows, ownerRows, settingsRows] = await Promise.all([
    db.select().from(areas),
    db.select().from(blinds).where(eq(blinds.projectId, projectId)).orderBy(asc(blinds.tag)),
    db.select().from(blindWorkflowRuntime).where(eq(blindWorkflowRuntime.projectId, projectId)),
    db.select().from(projectPhaseOwners).where(eq(projectPhaseOwners.projectId, projectId)).orderBy(asc(projectPhaseOwners.phase)),
    db.select().from(projectSettings).where(eq(projectSettings.projectId, projectId)).limit(1),
  ]);
  const project = normalizeProjectRows(projectRows, areaRows)[0];
  const runtimeByTag = new Map(runtimeRows.map((row) => [row.blindTag, row]));
  const normalizedBlinds = normalizeBlindRows(blindRows).map((blind) => {
    const runtime = runtimeByTag.get(blind.tag);
    if (!runtime) return blind;
    const phaseKey = runtime.currentPhaseKey as CanonicalPhaseKey;
    return {
      ...blind,
      workflowPhaseKey: phaseKey,
      workflowPhaseLabel: getCanonicalPhase(phaseKey).label,
      workflowLifecycleStatus: runtime.lifecycleStatus as WorkflowLifecycleState,
      workflowRecordVersion: runtime.recordVersion,
      workflowLocked: runtime.isLocked === 1,
    };
  });
  return {
    project,
    blinds: normalizedBlinds,
    settings: normalizeProjectSettingsRows(projectId, ownerRows, settingsRows[0]),
    metrics: summarizeProjectBlinds(project, normalizedBlinds),
  };
}

export async function getProjectSettings(projectId: string): Promise<ProjectSettingsModel | undefined> {
  const db = await requireDb();
  const projectRows = await db.select({ id: projects.id }).from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!projectRows[0]) return undefined;
  const [ownerRows, settingsRows] = await Promise.all([
    db.select().from(projectPhaseOwners).where(eq(projectPhaseOwners.projectId, projectId)).orderBy(asc(projectPhaseOwners.phase)),
    db.select().from(projectSettings).where(eq(projectSettings.projectId, projectId)).limit(1),
  ]);
  return normalizeProjectSettingsRows(projectId, ownerRows, settingsRows[0]);
}

export async function getAssignableProjectUsers(): Promise<AssignableProjectUser[]> {
  const db = await requireDb();
  const rows = await db.select().from(users).orderBy(asc(users.name));
  return rows.map((user) => ({
    openId: user.openId,
    name: user.name?.trim() || user.email || user.openId,
    email: user.email ?? null,
    avatarUrl: user.avatarUrl ?? null,
    role: user.role as "user" | "admin",
  }));
}

export async function updateProjectSettings(
  projectId: string,
  phaseOwners: ProjectPhaseOwnerInput[],
  userOpenId?: string,
  slipBlindGateRequired = true,
): Promise<ProjectSettingsModel> {
  const db = await requireDb();
  const projectRows = await db.select({ id: projects.id }).from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!projectRows[0]) throw new Error(`Cannot update settings for unknown projectId: ${projectId}`);
  const now = new Date();
  const rows: InsertProjectPhaseOwner[] = blindPhaseOrder.map((phase) => {
    const inputOwner = phaseOwners.find((owner) => owner.phase === phase)
      ?? defaultPhaseOwners.find((owner) => owner.phase === phase);
    return {
      projectId,
      phase,
      ownerName: inputOwner?.owners?.length
        ? inputOwner.owners.map((owner) => owner.name.trim()).filter(Boolean).join(", ")
        : "Unassigned",
      ownerRole: "phase-assignee",
      phaseColor: sanitizePhaseColor(inputOwner?.phaseColor, phase),
      ownersJson: serializePhaseAssignees(inputOwner?.owners ?? []),
      createdByOpenId: userOpenId,
      updatedByOpenId: userOpenId,
      createdAt: now,
      updatedAt: now,
    };
  });
  const settingsRow: InsertProjectSettings = {
    projectId,
    slipBlindGateRequired: slipBlindGateRequired ? 1 : 0,
    updatedByOpenId: userOpenId,
    createdAt: now,
    updatedAt: now,
  };
  await db.transaction(async (tx) => {
    await tx.delete(projectPhaseOwners).where(eq(projectPhaseOwners.projectId, projectId));
    await tx.insert(projectPhaseOwners).values(rows);
    await tx.insert(projectSettings).values(settingsRow).onDuplicateKeyUpdate({
      set: {
        slipBlindGateRequired: settingsRow.slipBlindGateRequired,
        updatedByOpenId: userOpenId,
        updatedAt: now,
      },
    });
  });
  const saved = await getProjectSettings(projectId);
  if (!saved) throw new Error("Project settings could not be read after update.");
  return saved;
}

export async function canUserEditProjectPhase(
  projectId: string,
  phase: BlindPhase,
  user: ActingProjectUser,
): Promise<boolean> {
  if (user.role === "admin") return true;
  const settings = await getProjectSettings(projectId);
  if (!settings) return false;
  const owner = settings.phaseOwners.find((item) => item.phase === phase);
  return canActingUserEditAssignedPhase(owner, user);
}
