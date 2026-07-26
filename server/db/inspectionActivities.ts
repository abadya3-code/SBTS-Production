import { and, asc, eq, inArray } from "drizzle-orm";
import {
  blindPhaseInstances,
  blindWorkflowLogs,
  blindWorkflowRuntime,
  blinds,
  inspectionActivityRecords,
  inspectionActivityTemplates,
  workflowEvidenceAttachments,
} from "../../drizzle/schema";
import { requireDb } from "./core";
import { assertAnyWorkflowPermission, ensureBlindWorkflowRuntime } from "./workflowRuntime";
import type { ActingProjectUser } from "./types";

const terminalInspectionStatuses = new Set(["completed", "approved", "not_applicable"]);

function inspectionActivityIsGateComplete(template: { approvalRequired: number }, status: string | null | undefined) {
  if (!status) return false;
  if (status === "not_applicable") return true;
  return template.approvalRequired === 1 ? status === "approved" : status === "completed" || status === "approved";
}

async function writeInspectionAudit(
  db: Awaited<ReturnType<typeof requireDb>>,
  input: { projectId: string; blindTag: string },
  actor: ActingProjectUser,
  action: string,
  message: string,
) {
  const rows = await db.select({ phase: blinds.phase }).from(blinds).where(and(
    eq(blinds.tag, input.blindTag),
    eq(blinds.projectId, input.projectId),
  )).limit(1);
  if (!rows[0]) return;
  await db.insert(blindWorkflowLogs).values({
    blindTag: input.blindTag,
    projectId: input.projectId,
    phase: rows[0].phase,
    action,
    message,
    actorOpenId: actor.openId,
    actorName: actor.name ?? actor.email ?? actor.openId,
  });
}

export async function listInspectionActivityTemplates(input: { includeInactive?: boolean }, actor: ActingProjectUser) {
  if (input.includeInactive) await assertAnyWorkflowPermission(actor, ["workflow.inspection.configure"]);
  const db = await requireDb();
  return db.select().from(inspectionActivityTemplates)
    .where(input.includeInactive ? undefined : eq(inspectionActivityTemplates.active, 1))
    .orderBy(asc(inspectionActivityTemplates.sortOrder), asc(inspectionActivityTemplates.name));
}

export async function upsertInspectionActivityTemplate(input: {
  id?: number;
  activityKey: string;
  name: string;
  description?: string | null;
  applicableEquipmentTypes: string[];
  mandatory: boolean;
  evidenceRequired: boolean;
  approvalRequired: boolean;
  active: boolean;
  sortOrder: number;
}, actor: ActingProjectUser) {
  await assertAnyWorkflowPermission(actor, ["workflow.inspection.configure"]);
  const db = await requireDb();
  const values = {
    activityKey: input.activityKey,
    name: input.name,
    description: input.description ?? null,
    applicableEquipmentTypesJson: JSON.stringify(input.applicableEquipmentTypes),
    mandatory: input.mandatory ? 1 : 0,
    evidenceRequired: input.evidenceRequired ? 1 : 0,
    approvalRequired: input.approvalRequired ? 1 : 0,
    active: input.active ? 1 : 0,
    sortOrder: input.sortOrder,
    updatedByOpenId: actor.openId,
    updatedAt: new Date(),
  };
  if (input.id) {
    await db.update(inspectionActivityTemplates).set(values).where(eq(inspectionActivityTemplates.id, input.id));
    return { id: input.id };
  }
  const result = await db.insert(inspectionActivityTemplates).values({ ...values, createdByOpenId: actor.openId }).$returningId();
  return { id: result[0]?.id };
}

export async function getBlindInspectionActivities(input: { projectId: string; blindTag: string }, actor: ActingProjectUser) {
  await ensureBlindWorkflowRuntime(input.projectId, input.blindTag);
  const db = await requireDb();
  const templates = await db.select().from(inspectionActivityTemplates)
    .where(eq(inspectionActivityTemplates.active, 1))
    .orderBy(asc(inspectionActivityTemplates.sortOrder), asc(inspectionActivityTemplates.name));
  const records = templates.length
    ? await db.select().from(inspectionActivityRecords).where(and(
      eq(inspectionActivityRecords.blindTag, input.blindTag),
      inArray(inspectionActivityRecords.templateId, templates.map((row) => row.id)),
    ))
    : [];
  return templates.map((template) => {
    const record = records.find((row) => row.templateId === template.id) ?? null;
    return {
      ...template,
      applicableEquipmentTypes: (() => { try { return JSON.parse(template.applicableEquipmentTypesJson || "[]") as string[]; } catch { return []; } })(),
      record,
      complete: record ? inspectionActivityIsGateComplete(template, record.status) : false,
    };
  });
}

export async function upsertBlindInspectionActivity(input: {
  projectId: string;
  blindTag: string;
  templateId: number;
  status: "not_started" | "in_progress" | "completed" | "approved" | "rejected" | "not_applicable";
  result?: string | null;
  notes?: string | null;
}, actor: ActingProjectUser) {
  const reviewDecision = input.status === "approved" || input.status === "rejected";
  await assertAnyWorkflowPermission(actor, [reviewDecision ? "workflow.inspection.approve" : "workflow.record.inspection"]);
  await ensureBlindWorkflowRuntime(input.projectId, input.blindTag);
  const db = await requireDb();
  const [runtimeRows, templateRows] = await Promise.all([
    db.select().from(blindWorkflowRuntime).where(and(eq(blindWorkflowRuntime.blindTag, input.blindTag), eq(blindWorkflowRuntime.projectId, input.projectId))).limit(1),
    db.select().from(inspectionActivityTemplates).where(eq(inspectionActivityTemplates.id, input.templateId)).limit(1),
  ]);
  const runtime = runtimeRows[0];
  const template = templateRows[0];
  if (!runtime) throw new Error("Workflow runtime was not found.");
  if (!template || template.active !== 1) throw new Error("Inspection activity template is inactive or missing.");
  if (runtime.currentPhaseKey !== "internalInspection" && actor.role !== "admin") {
    throw new Error("Inspection activities can only be changed during Internal Inspection & Work Execution.");
  }
  const isTerminal = terminalInspectionStatuses.has(input.status);
  if (isTerminal && !input.result?.trim()) throw new Error("A result is required before an inspection activity can be completed.");
  if (isTerminal && template.evidenceRequired === 1) {
    const evidence = await db.select({ id: workflowEvidenceAttachments.id }).from(workflowEvidenceAttachments).where(and(
      eq(workflowEvidenceAttachments.blindTag, input.blindTag),
      eq(workflowEvidenceAttachments.phaseKey, "internalInspection"),
    )).limit(1);
    if (!evidence[0]) throw new Error(`${template.name} requires inspection evidence before completion.`);
  }
  const existing = await db.select().from(inspectionActivityRecords).where(and(
    eq(inspectionActivityRecords.blindTag, input.blindTag),
    eq(inspectionActivityRecords.templateId, input.templateId),
  )).limit(1);
  if (reviewDecision && template.approvalRequired !== 1) {
    throw new Error(`${template.name} is not configured for a separate approval decision.`);
  }
  if (reviewDecision && !existing[0]) {
    throw new Error(`${template.name} must be completed before an independent approval decision can be recorded.`);
  }
  if (reviewDecision && existing[0]?.status !== "completed") {
    throw new Error(`${template.name} must be in completed status before it can be approved or rejected.`);
  }
  if (reviewDecision && existing[0]?.completedByOpenId === actor.openId) {
    throw new Error("Independent inspection approval must be recorded by a different user than the activity completer.");
  }
  if (!reviewDecision && existing[0]?.status === "approved" && actor.role !== "admin") {
    throw new Error(`${template.name} is approved and locked. Reopen it through a controlled workflow correction before editing.`);
  }
  const now = new Date();
  const values = {
    projectId: input.projectId,
    blindTag: input.blindTag,
    templateId: input.templateId,
    phaseKey: "internalInspection" as const,
    status: input.status,
    result: reviewDecision ? (input.result?.trim() || existing[0]?.result || null) : (input.result?.trim() || null),
    notes: reviewDecision ? (input.notes?.trim() || existing[0]?.notes || null) : (input.notes?.trim() || null),
    completedByOpenId: reviewDecision ? existing[0]?.completedByOpenId ?? null : (isTerminal ? actor.openId : null),
    approvedByOpenId: reviewDecision ? actor.openId : null,
    completedAt: reviewDecision ? existing[0]?.completedAt ?? null : (isTerminal ? now : null),
    approvedAt: reviewDecision ? now : null,
    updatedAt: now,
  };
  let id: number | undefined;
  if (existing[0]) {
    await db.update(inspectionActivityRecords).set(values).where(eq(inspectionActivityRecords.id, existing[0].id));
    id = existing[0].id;
  } else {
    const result = await db.insert(inspectionActivityRecords).values(values).$returningId();
    id = result[0]?.id;
  }
  await writeInspectionAudit(db, input, actor, "Inspection Activity Updated", `${template.name} updated to ${input.status}${input.result ? ` · ${input.result}` : ""}.`);

  const mandatoryTemplates = await db.select({ id: inspectionActivityTemplates.id, approvalRequired: inspectionActivityTemplates.approvalRequired }).from(inspectionActivityTemplates).where(and(
    eq(inspectionActivityTemplates.active, 1),
    eq(inspectionActivityTemplates.mandatory, 1),
  ));
  const mandatoryRecords = mandatoryTemplates.length
    ? await db.select().from(inspectionActivityRecords).where(and(
      eq(inspectionActivityRecords.blindTag, input.blindTag),
      inArray(inspectionActivityRecords.templateId, mandatoryTemplates.map((row) => row.id)),
    ))
    : [];
  const allMandatoryComplete = mandatoryTemplates.every((item) => mandatoryRecords.some((record) => record.templateId === item.id && inspectionActivityIsGateComplete(item, record.status)));
  await db.update(blindPhaseInstances).set({
    updatedAt: now,
    gateSnapshotJson: JSON.stringify({ inspectionActivitiesComplete: allMandatoryComplete, evaluatedAt: now.toISOString() }),
  }).where(and(eq(blindPhaseInstances.blindTag, input.blindTag), eq(blindPhaseInstances.phaseKey, "internalInspection")));
  return { id, allMandatoryComplete };
}

export async function getMandatoryInspectionActivityReadiness(blindTag: string) {
  const db = await requireDb();
  const templates = await db.select({ id: inspectionActivityTemplates.id, name: inspectionActivityTemplates.name, approvalRequired: inspectionActivityTemplates.approvalRequired }).from(inspectionActivityTemplates).where(and(
    eq(inspectionActivityTemplates.active, 1),
    eq(inspectionActivityTemplates.mandatory, 1),
  ));
  if (templates.length === 0) return { ready: true, missing: [] as string[] };
  const records = await db.select().from(inspectionActivityRecords).where(and(
    eq(inspectionActivityRecords.blindTag, blindTag),
    inArray(inspectionActivityRecords.templateId, templates.map((row) => row.id)),
  ));
  const missing = templates.filter((template) => !records.some((record) => record.templateId === template.id && inspectionActivityIsGateComplete(template, record.status))).map((template) => template.name);
  return { ready: missing.length === 0, missing };
}
