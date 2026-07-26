/**
 * server/db/blinds.ts
 * ───────────────────
 * Blind registry CRUD, phase approvals, and workflow logs.
 */

import { asc, eq, inArray } from "drizzle-orm";
import {
  InsertBlind, InsertBlindPhaseApproval, InsertBlindWorkflowLog,
  blindPhaseApprovals, blindWorkflowLogs, blinds, projectPhaseOwners, projectSettings, projects,
} from "../../drizzle/schema";
import { buildElectronicApprovalAudit, isPhaseReachableForApproval } from "../../shared/electronicApprovals";
import { requireDb } from "./core";
import {
  ActingProjectUser, BlindDetailModel, BlindInput, BlindModel, BlindPhase,
  BlindPhaseApprovalInput, BlindPhaseApprovalModel, BlindPhaseDetailModel,
  BlindPriority, BlindUpdateInput, BlindWorkflowLogModel, ProjectPhaseOwnerModel,
} from "./types";
import { blindPhaseOrder, defaultPhaseColors } from "./seed";

// ─── Normalize Helpers ─────────────────────────────────────────────────────

export function normalizeBlindRows(blindRows: (typeof blinds.$inferSelect)[]): BlindModel[] {
  return blindRows.map((blind) => ({
    tag: blind.tag,
    projectId: blind.projectId,
    type: blind.type,
    size: blind.size,
    rate: blind.rate ?? null,
    phase: blind.phase as BlindPhase,
    owner: blind.owner,
    priority: blind.priority as BlindPriority,
    equipment: blind.equipment,
    location: blind.location,
    isolationPoint: blind.isolationPoint,
    slipMetalForemanApproved: blind.slipMetalForemanApproved === 1,
    slipBlindMerged: blind.slipBlindMerged === 1,
    notes: blind.notes,
    material: blind.material ?? null,
    flangeType: blind.flangeType ?? null,
    gasketType: blind.gasketType ?? null,
    boltSize: blind.boltSize ?? null,
    torqueValue: blind.torqueValue ?? null,
    thickness: blind.thickness ?? null,
    tempRating: blind.tempRating ?? null,
    pidRef: blind.pidRef ?? null,
    isoDrawing: blind.isoDrawing ?? null,
    lineNumber: blind.lineNumber ?? null,
    installDate: blind.installDate ?? null,
    expiryDate: blind.expiryDate ?? null,
    updatedAt: blind.updatedAt,
  }));
}

export function canActingUserEditAssignedPhase(
  owner: ProjectPhaseOwnerModel | undefined,
  user: ActingProjectUser,
): boolean {
  if (!owner || owner.owners.length === 0) return true;
  const principalTokens = [user.openId, user.name, user.email]
    .map((value) => value?.trim().toLowerCase())
    .filter((value): value is string => Boolean(value));
  return owner.owners.some((assignee) => {
    const ownerTokens = [assignee.openId, assignee.name, assignee.email]
      .map((value) => value?.trim().toLowerCase())
      .filter((value): value is string => Boolean(value));
    return ownerTokens.some((token) => principalTokens.includes(token));
  });
}

function toNullableText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeBlindInput(input: BlindInput): InsertBlind {
  return {
    projectId: input.projectId,
    tag: input.tag.trim(),
    type: input.type.trim(),
    size: input.size.trim(),
    rate: toNullableText(input.rate),
    phase: input.phase ?? "Broken / Preparation",
    owner: input.owner?.trim() || "Project Phase Owner",
    priority: input.priority,
    equipment: toNullableText(input.equipment),
    location: toNullableText(input.location),
    isolationPoint: toNullableText(input.isolationPoint),
    slipMetalForemanApproved: input.slipMetalForemanApproved ? 1 : 0,
    slipBlindMerged: input.slipBlindMerged ? 1 : 0,
    notes: toNullableText(input.notes),
  };
}

function createBlindLog(input: {
  blindTag: string;
  projectId: string;
  phase: BlindPhase;
  action: string;
  message: string;
  actor?: ActingProjectUser | null;
  createdAt?: Date;
}): InsertBlindWorkflowLog {
  return {
    blindTag: input.blindTag,
    projectId: input.projectId,
    phase: input.phase,
    action: input.action,
    message: input.message,
    actorOpenId: input.actor?.openId ?? null,
    actorName: input.actor?.name ?? input.actor?.email ?? null,
    createdAt: input.createdAt ?? new Date(),
  };
}

async function appendBlindLog(log: InsertBlindWorkflowLog): Promise<void> {
  const db = await requireDb();
  await db.insert(blindWorkflowLogs).values(log);
}

async function updateProjectBlindCount(projectId: string): Promise<void> {
  const db = await requireDb();
  const [projectRow, blindRows] = await Promise.all([
    db.select().from(projects).where(eq(projects.id, projectId)).limit(1),
    db.select({ tag: blinds.tag }).from(blinds).where(eq(blinds.projectId, projectId)),
  ]);
  if (!projectRow[0]) return;
  const registeredCount = blindRows.length;
  if (projectRow[0].blindsCount < registeredCount) {
    await db.update(projects).set({ blindsCount: registeredCount, updatedAt: new Date() }).where(eq(projects.id, projectId));
  }
}

/**
 * Slip-blind final approval is enforced by the canonical workflow runtime.
 * Registration and metadata updates must never require a future closeout approval.
 */

function buildSyntheticBlindLogs(blind: BlindModel, projectName: string): BlindWorkflowLogModel[] {
  return [
    {
      id: `synthetic-${blind.tag}-created`,
      blindTag: blind.tag,
      projectId: blind.projectId,
      phase: "Broken / Preparation",
      action: "Blind registered",
      message: `Blind ${blind.tag} belongs to ${projectName} and is currently tracked in ${blind.phase}.`,
      actorName: "System baseline",
      createdAt: blind.updatedAt,
    },
  ];
}

function normalizeBlindLogRows(rows: InsertBlindWorkflowLog[]): BlindWorkflowLogModel[] {
  return rows.map((row) => ({
    id: row.id ?? `${row.blindTag}-${row.createdAt?.getTime?.() ?? Date.now()}`,
    blindTag: row.blindTag,
    projectId: row.projectId,
    phase: row.phase as BlindPhase,
    action: row.action,
    message: row.message,
    actorName: row.actorName ?? null,
    createdAt: row.createdAt ?? new Date(),
  }));
}

function createDefaultPhaseApproval(blind: BlindModel, phase: BlindPhase): BlindPhaseApprovalModel {
  return {
    id: `pending-${blind.tag}-${phase}`,
    blindTag: blind.tag,
    projectId: blind.projectId,
    phase,
    approved: false,
    approvedByName: null,
    approvedAt: null,
    revokedAt: null,
    note: null,
  };
}

function normalizeBlindApprovalRows(
  rows: InsertBlindPhaseApproval[],
  blind: BlindModel,
): Record<BlindPhase, BlindPhaseApprovalModel> {
  const defaults = Object.fromEntries(
    blindPhaseOrder.map((phase) => [phase, createDefaultPhaseApproval(blind, phase)])
  ) as Record<BlindPhase, BlindPhaseApprovalModel>;
  for (const row of rows) {
    const phase = row.phase as BlindPhase;
    defaults[phase] = {
      id: row.id ?? `${row.blindTag}-${phase}`,
      blindTag: row.blindTag,
      projectId: row.projectId,
      phase,
      approved: row.approved !== 0,
      approvedByName: row.approvedByName ?? null,
      approvedAt: row.approvedAt ?? null,
      revokedAt: row.revokedAt ?? null,
      note: row.note ?? null,
    };
  }
  return defaults;
}

// ─── Blind CRUD ────────────────────────────────────────────────────────────

export async function addBlindToProject(
  input: BlindInput,
  actor?: ActingProjectUser,
): Promise<BlindModel> {
  const db = await requireDb();
  const projectRows = await db.select({ id: projects.id }).from(projects).where(eq(projects.id, input.projectId)).limit(1);
  if (!projectRows[0]) throw new Error(`Cannot add blind for unknown projectId: ${input.projectId}`);
  const normalized = normalizeBlindInput(input);
  await db.insert(blinds).values(normalized);
  await updateProjectBlindCount(input.projectId);
  const saved = await db.select().from(blinds).where(eq(blinds.tag, normalized.tag)).limit(1);
  if (!saved[0]) throw new Error("Blind could not be read after creation.");
  const created = normalizeBlindRows(saved)[0];
  await appendBlindLog(createBlindLog({
    blindTag: created.tag,
    projectId: created.projectId,
    phase: created.phase,
    action: "Blind registered",
    message: `Blind ${created.tag} was registered in ${created.phase}.`,
    actor,
  }));
  const { ensureBlindWorkflowRuntime } = await import("./workflowRuntime");
  await ensureBlindWorkflowRuntime(created.projectId, created.tag);
  return created;
}

export async function bulkAddBlindsToProject(
  projectId: string,
  inputs: Omit<BlindInput, "projectId">[],
): Promise<{ created: BlindModel[]; count: number }> {
  const db = await requireDb();
  const projectRows = await db.select({ id: projects.id }).from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!projectRows[0]) throw new Error(`Cannot add blinds for unknown projectId: ${projectId}`);
  const normalized = inputs.map((input) => normalizeBlindInput({ ...input, projectId }));
  const tags = normalized.map((blind) => blind.tag);
  const duplicateTags = tags.filter((tag, index) => tags.indexOf(tag) !== index);
  if (duplicateTags.length > 0) {
    throw new Error(`Bulk import contains duplicate blind tags: ${Array.from(new Set(duplicateTags)).join(", ")}`);
  }
  const existing = tags.length > 0
    ? await db.select({ tag: blinds.tag }).from(blinds).where(inArray(blinds.tag, tags))
    : [];
  if (existing.length > 0) {
    throw new Error(`Blind tags already exist: ${existing.map((blind) => blind.tag).join(", ")}`);
  }
  if (normalized.length > 0) {
    await db.insert(blinds).values(normalized);
    await updateProjectBlindCount(projectId);
  }
  const saved = normalized.length > 0
    ? await db.select().from(blinds).where(inArray(blinds.tag, tags)).orderBy(asc(blinds.tag))
    : [];
  const created = normalizeBlindRows(saved);
  if (created.length > 0) {
    await db.insert(blindWorkflowLogs).values(
      created.map((blind) => createBlindLog({
        blindTag: blind.tag,
        projectId,
        phase: blind.phase,
        action: "Bulk blind registered",
        message: `Blind ${blind.tag} was created through bulk import.`,
      }))
    );
    const { ensureBlindWorkflowRuntime } = await import("./workflowRuntime");
    for (const blind of created) {
      await ensureBlindWorkflowRuntime(projectId, blind.tag);
    }
  }
  return { created, count: created.length };
}

export async function updateBlindInProject(
  input: BlindUpdateInput,
  actor?: ActingProjectUser,
): Promise<BlindModel> {
  const db = await requireDb();
  const existingRows = await db.select().from(blinds).where(eq(blinds.tag, input.tag)).limit(1);
  const existing = existingRows[0];
  if (!existing || existing.projectId !== input.projectId) {
    throw new Error(`Blind ${input.tag} was not found in project ${input.projectId}.`);
  }
  if (input.phase !== undefined && input.phase !== existing.phase) {
    throw new Error("Direct legacy phase changes are disabled. Use the canonical workflow action endpoint.");
  }
  const updateSet: Partial<InsertBlind> = {};
  if (input.type !== undefined) updateSet.type = input.type.trim();
  if (input.size !== undefined) updateSet.size = input.size.trim();
  if (input.rate !== undefined) updateSet.rate = toNullableText(input.rate);
  if (input.phase !== undefined) updateSet.phase = input.phase;
  if (input.owner !== undefined) updateSet.owner = input.owner?.trim() || "Project Phase Owner";
  if (input.priority !== undefined) updateSet.priority = input.priority;
  if (input.equipment !== undefined) updateSet.equipment = toNullableText(input.equipment);
  if (input.location !== undefined) updateSet.location = toNullableText(input.location);
  if (input.isolationPoint !== undefined) updateSet.isolationPoint = toNullableText(input.isolationPoint);
  if (input.slipMetalForemanApproved !== undefined) updateSet.slipMetalForemanApproved = input.slipMetalForemanApproved ? 1 : 0;
  if (input.slipBlindMerged !== undefined) updateSet.slipBlindMerged = input.slipBlindMerged ? 1 : 0;
  if (input.notes !== undefined) updateSet.notes = toNullableText(input.notes);
  await db.update(blinds).set({ ...updateSet, updatedAt: new Date() }).where(eq(blinds.tag, input.tag));
  const saved = await db.select().from(blinds).where(eq(blinds.tag, input.tag)).limit(1);
  if (!saved[0]) throw new Error("Blind could not be read after update.");
  const updated = normalizeBlindRows(saved)[0];
  const phaseChanged = existing.phase !== updated.phase;
  await appendBlindLog(createBlindLog({
    blindTag: updated.tag,
    projectId: updated.projectId,
    phase: updated.phase,
    action: phaseChanged ? "Workflow phase changed" : "Blind updated",
    message: phaseChanged
      ? `Phase moved from ${existing.phase} to ${updated.phase}.`
      : `Blind ${updated.tag} details were updated.`,
    actor,
  }));
  return updated;
}

export async function getBlindDetail(
  projectId: string,
  tag: string,
): Promise<BlindDetailModel | undefined> {
  // Lazy import to avoid circular dependency with projects.ts
  const { getProjectDetail } = await import("./projects");
  const detail = await getProjectDetail(projectId);
  if (!detail) return undefined;
  const blind = detail.blinds.find((item) => item.tag === tag);
  if (!blind) return undefined;
  const db = await requireDb();
  const [logRows, approvalRows] = await Promise.all([
    db.select().from(blindWorkflowLogs).where(eq(blindWorkflowLogs.blindTag, tag)).orderBy(asc(blindWorkflowLogs.createdAt)),
    db.select().from(blindPhaseApprovals).where(eq(blindPhaseApprovals.blindTag, tag)),
  ]);
  const approvalByPhase = normalizeBlindApprovalRows(approvalRows, blind);
  const currentIndex = blindPhaseOrder.indexOf(blind.phase);
  const phaseTimeline: BlindPhaseDetailModel[] = blindPhaseOrder.map((phase, index) => {
    const owner = detail.settings.phaseOwners.find((item) => item.phase === phase);
    return {
      phase,
      color: owner?.phaseColor ?? defaultPhaseColors[phase],
      count: detail.metrics.phaseCounts[phase],
      status: index < currentIndex ? "completed" : index === currentIndex ? "current" : "waiting",
      owners: owner?.owners ?? [],
      approval: approvalByPhase[phase],
      canApprove: isPhaseReachableForApproval(blind.phase, phase),
    };
  });
  const logs = normalizeBlindLogRows(logRows);
  return {
    project: detail.project,
    blind,
    settings: detail.settings,
    phaseTimeline,
    logs: logs.length ? logs : buildSyntheticBlindLogs(blind, detail.project.name),
  };
}

export async function setBlindPhaseApproval(
  input: BlindPhaseApprovalInput,
  actor: ActingProjectUser,
): Promise<BlindDetailModel> {
  const { getProjectDetail } = await import("./projects");
  const detail = await getProjectDetail(input.projectId);
  const blind = detail?.blinds.find((item) => item.tag === input.tag);
  if (!detail || !blind) throw new Error(`Blind ${input.tag} was not found in project ${input.projectId}.`);
  if (!isPhaseReachableForApproval(blind.phase, input.phase)) {
    throw new Error(`Phase ${input.phase} cannot be approved before the blind reaches that workflow phase.`);
  }
  const owner = detail.settings.phaseOwners.find((item) => item.phase === input.phase);
  if (!canActingUserEditAssignedPhase(owner, actor)) {
    throw new Error("Only the configured phase owner can approve or revoke this phase sign-off.");
  }
  const db = await requireDb();
  const now = new Date();
  const actorName = actor.name ?? actor.email ?? actor.openId;
  const note = input.note?.trim() || null;
  const approvalRow: InsertBlindPhaseApproval = {
    blindTag: blind.tag,
    projectId: blind.projectId,
    phase: input.phase,
    approved: input.approved ? 1 : 0,
    approvedByOpenId: input.approved ? actor.openId : null,
    approvedByName: input.approved ? actorName : null,
    note,
    approvedAt: input.approved ? now : null,
    revokedAt: input.approved ? null : now,
    createdAt: now,
    updatedAt: now,
  };
  await db.transaction(async (tx) => {
    await tx.insert(blindPhaseApprovals).values(approvalRow).onDuplicateKeyUpdate({
      set: {
        approved: approvalRow.approved,
        approvedByOpenId: approvalRow.approvedByOpenId,
        approvedByName: approvalRow.approvedByName,
        note: approvalRow.note,
        approvedAt: approvalRow.approvedAt,
        revokedAt: approvalRow.revokedAt,
        updatedAt: now,
      },
    });
    const audit = buildElectronicApprovalAudit({ phase: input.phase, approved: input.approved, actorName, note });
    await tx.insert(blindWorkflowLogs).values(createBlindLog({
      blindTag: blind.tag,
      projectId: blind.projectId,
      phase: input.phase,
      action: audit.action,
      message: audit.message,
      actor,
      createdAt: now,
    }));
  });
  const updatedDetail = await getBlindDetail(input.projectId, input.tag);
  if (!updatedDetail) throw new Error("Blind detail could not be read after approval update.");
  return updatedDetail;
}
