import { and, desc, eq } from "drizzle-orm";
import {
  blindWorkflowLogs,
  defectNotifications,
  ndtRecords,
  punchItems,
} from "../../drizzle/schema";
import { requireDb } from "./core";
import { getWorkflowPolicySettings } from "./settings";
import { assertAnyWorkflowPermission, ensureBlindWorkflowRuntime } from "./workflowRuntime";
import type { ActingProjectUser } from "./types";

const closedDefectStatuses = new Set(["accepted_as_is", "closed", "transferred", "cancelled"]);
const closedPunchStatuses = new Set(["closed", "transferred", "cancelled"]);
const acceptedNdtStatuses = new Set(["passed", "cancelled"]);


function affectedRows(result: unknown): number {
  const value = result as { rowsAffected?: number; affectedRows?: number } | undefined;
  return Number(value?.rowsAffected ?? value?.affectedRows ?? 1);
}

function controlledNumber(prefix: string, blindTag: string) {
  const cleanTag = blindTag.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(-18).toUpperCase();
  return `${prefix}-${cleanTag}-${Date.now().toString(36).toUpperCase()}`;
}

async function appendQualityAudit(input: { projectId: string; blindTag: string }, actor: ActingProjectUser, action: string, message: string) {
  const db = await requireDb();
  await db.insert(blindWorkflowLogs).values({
    blindTag: input.blindTag,
    projectId: input.projectId,
    phase: "Inspection Ready",
    action,
    message,
    actorOpenId: actor.openId,
    actorName: actor.name ?? actor.email ?? actor.openId,
  });
}

export async function getQualityRecords(input: { projectId: string; blindTag: string }, actor: ActingProjectUser) {
  await assertAnyWorkflowPermission(actor, [
    "workflow.quality.defect.record", "workflow.quality.defect.review",
    "workflow.quality.punch.manage", "workflow.quality.punch.verify",
    "workflow.quality.ndt.record", "workflow.quality.ndt.review",
    "workflow.view",
  ]);
  const db = await requireDb();
  const [defects, punches, ndt] = await Promise.all([
    db.select().from(defectNotifications).where(and(eq(defectNotifications.projectId, input.projectId), eq(defectNotifications.blindTag, input.blindTag))).orderBy(desc(defectNotifications.createdAt)),
    db.select().from(punchItems).where(and(eq(punchItems.projectId, input.projectId), eq(punchItems.blindTag, input.blindTag))).orderBy(desc(punchItems.createdAt)),
    db.select().from(ndtRecords).where(and(eq(ndtRecords.projectId, input.projectId), eq(ndtRecords.blindTag, input.blindTag))).orderBy(desc(ndtRecords.createdAt)),
  ]);
  const policy = await getWorkflowPolicySettings();
  return {
    defects,
    punches,
    ndt,
    readiness: evaluateQualityReadiness({ defects, punches, ndt, policy }),
  };
}

export function evaluateQualityReadiness(input: {
  defects: Array<{ id?: number; status: string; disposition?: string | null; requiresNdt?: number }>;
  punches: Array<{ status: string; mandatory: number }>;
  ndt: Array<{ defectId?: number | null; status: string }>;
  policy: Awaited<ReturnType<typeof getWorkflowPolicySettings>>;
}) {
  const blockingReasons: string[] = [];
  if (input.policy.requireDefectDispositionBeforeClosure === 1) {
    const open = input.defects.filter((row) => !closedDefectStatuses.has(row.status) || !row.disposition?.trim());
    if (open.length) blockingReasons.push(`${open.length} defect notification(s) require a controlled disposition.`);
  }
  if (input.policy.requireMandatoryPunchClosureBeforeReadyForClosure === 1) {
    const open = input.punches.filter((row) => row.mandatory === 1 && !closedPunchStatuses.has(row.status));
    if (open.length) blockingReasons.push(`${open.length} mandatory punch item(s) remain open.`);
  }
  if (input.policy.requireNdtAcceptanceBeforeReadyForClosure === 1) {
    const requiredDefects = input.defects.filter((row) => row.requiresNdt === 1);
    const missing = requiredDefects.filter((defect) => {
      if (defect.id === undefined) return input.ndt.filter((row) => acceptedNdtStatuses.has(row.status)).length < requiredDefects.length;
      return !input.ndt.some((row) => row.defectId === defect.id && acceptedNdtStatuses.has(row.status));
    });
    const failed = input.ndt.filter((row) => ["failed", "retest_required", "planned", "in_progress"].includes(row.status));
    if (failed.length || missing.length) blockingReasons.push("Required NDT records are missing, incomplete, failed, or awaiting retest.");
  }
  return { ready: blockingReasons.length === 0, blockingReasons };
}

export async function upsertDefectNotification(input: {
  id?: number;
  projectId: string;
  blindTag: string;
  expectedRecordVersion?: number;
  title: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  status: "open" | "under_review" | "accepted_as_is" | "repair_required" | "closed" | "transferred" | "cancelled";
  disposition?: string | null;
  requiresRepair: boolean;
  requiresNdt: boolean;
  assignedToOpenId?: string | null;
  dueAt?: Date | null;
}, actor: ActingProjectUser) {
  const review = ["accepted_as_is", "repair_required", "closed", "transferred", "cancelled"].includes(input.status);
  await assertAnyWorkflowPermission(actor, [review ? "workflow.quality.defect.review" : "workflow.quality.defect.record"]);
  await ensureBlindWorkflowRuntime(input.projectId, input.blindTag);
  const db = await requireDb();
  const policy = await getWorkflowPolicySettings();
  const existing = input.id ? (await db.select().from(defectNotifications).where(eq(defectNotifications.id, input.id)).limit(1))[0] : null;
  if (existing && (existing.projectId !== input.projectId || existing.blindTag !== input.blindTag)) throw new Error("Defect does not belong to this blind and project.");
  if (review && !existing) throw new Error("Record the defect notification before submitting an independent disposition.");
  if (review && existing?.reportedByOpenId === actor.openId) throw new Error("Defect disposition must be reviewed by a different authorized user than the reporter.");
  if (existing && input.expectedRecordVersion && existing.recordVersion !== input.expectedRecordVersion) throw new Error("This defect was updated by another user. Refresh before saving.");
  if (review && !input.disposition?.trim() && policy.requireDefectDispositionBeforeClosure === 1) throw new Error("A controlled defect disposition is required for this status.");
  const now = new Date();
  const values = {
    projectId: input.projectId,
    blindTag: input.blindTag,
    phaseKey: "internalInspection" as const,
    title: input.title,
    description: input.description,
    severity: input.severity,
    status: input.status,
    disposition: input.disposition ?? null,
    requiresRepair: input.requiresRepair ? 1 : 0,
    requiresNdt: input.requiresNdt ? 1 : 0,
    assignedToOpenId: input.assignedToOpenId ?? null,
    reviewedByOpenId: review ? actor.openId : existing?.reviewedByOpenId ?? null,
    closedByOpenId: input.status === "closed" ? actor.openId : null,
    dueAt: input.dueAt ?? null,
    closedAt: input.status === "closed" ? now : null,
    recordVersion: (existing?.recordVersion ?? 0) + 1,
    updatedAt: now,
  };
  let id: number | undefined;
  if (existing) {
    const updateResult = await db.update(defectNotifications).set(values).where(and(eq(defectNotifications.id, existing.id), eq(defectNotifications.recordVersion, existing.recordVersion)));
    if (affectedRows(updateResult) === 0) throw new Error("This defect was updated by another user. Refresh before saving.");
    id = existing.id;
  } else {
    const result = await db.insert(defectNotifications).values({
      ...values,
      defectNumber: controlledNumber(policy.defectNumberPrefix || "DEF", input.blindTag),
      reportedByOpenId: actor.openId,
    }).$returningId();
    id = result[0]?.id;
  }
  await appendQualityAudit(input, actor, "Defect Notification Updated", `${input.title} · ${input.status} · ${input.severity}.`);
  return { id, recordVersion: values.recordVersion };
}

export async function upsertPunchItem(input: {
  id?: number;
  projectId: string;
  blindTag: string;
  defectId?: number | null;
  expectedRecordVersion?: number;
  title: string;
  description?: string | null;
  category?: string | null;
  severity: "low" | "medium" | "high" | "critical";
  mandatory: boolean;
  status: "open" | "in_progress" | "ready_for_verification" | "closed" | "transferred" | "cancelled";
  ownerOpenId?: string | null;
  targetDate?: Date | null;
  verificationNotes?: string | null;
  transferReference?: string | null;
}, actor: ActingProjectUser) {
  const verifying = ["closed", "transferred", "cancelled"].includes(input.status);
  await assertAnyWorkflowPermission(actor, [verifying ? "workflow.quality.punch.verify" : "workflow.quality.punch.manage"]);
  await ensureBlindWorkflowRuntime(input.projectId, input.blindTag);
  const db = await requireDb();
  const policy = await getWorkflowPolicySettings();
  const existing = input.id ? (await db.select().from(punchItems).where(eq(punchItems.id, input.id)).limit(1))[0] : null;
  if (existing && (existing.projectId !== input.projectId || existing.blindTag !== input.blindTag)) throw new Error("Punch item does not belong to this blind and project.");
  if (existing && input.expectedRecordVersion && existing.recordVersion !== input.expectedRecordVersion) throw new Error("This punch item was updated by another user. Refresh before saving.");
  if (verifying && !existing) throw new Error("Create and progress the punch item before independent verification.");
  if (verifying && existing?.createdByOpenId === actor.openId) throw new Error("Punch verification must be completed by a different authorized user than the creator.");
  if (input.status === "transferred" && policy.allowPunchTransfer !== 1) throw new Error("Punch transfer is disabled in Workflow & Safety Settings.");
  if (input.status === "transferred" && !input.transferReference?.trim()) throw new Error("A transfer reference is required.");
  if (verifying && !input.verificationNotes?.trim()) throw new Error("Verification notes are required for punch closeout or transfer.");
  const now = new Date();
  const values = {
    projectId: input.projectId, blindTag: input.blindTag, defectId: input.defectId ?? null,
    title: input.title, description: input.description ?? null, category: input.category ?? null,
    severity: input.severity, mandatory: input.mandatory ? 1 : 0, status: input.status,
    ownerOpenId: input.ownerOpenId ?? null, targetDate: input.targetDate ?? null,
    verificationNotes: input.verificationNotes ?? null, transferReference: input.transferReference ?? null,
    verifiedByOpenId: verifying ? actor.openId : null, closedAt: verifying ? now : null,
    recordVersion: (existing?.recordVersion ?? 0) + 1, updatedAt: now,
  };
  let id: number | undefined;
  if (existing) {
    const updateResult = await db.update(punchItems).set(values).where(and(eq(punchItems.id, existing.id), eq(punchItems.recordVersion, existing.recordVersion)));
    if (affectedRows(updateResult) === 0) throw new Error("This punch item was updated by another user. Refresh before saving.");
    id = existing.id;
  } else {
    const result = await db.insert(punchItems).values({ ...values, punchNumber: controlledNumber(policy.punchNumberPrefix || "PCH", input.blindTag), createdByOpenId: actor.openId }).$returningId();
    id = result[0]?.id;
  }
  await appendQualityAudit(input, actor, "Punch Item Updated", `${input.title} · ${input.status}${input.mandatory ? " · mandatory" : ""}.`);
  return { id, recordVersion: values.recordVersion };
}

export async function upsertNdtRecord(input: {
  id?: number;
  projectId: string;
  blindTag: string;
  defectId?: number | null;
  expectedRecordVersion?: number;
  method: string;
  procedureReference?: string | null;
  acceptanceCriteria?: string | null;
  status: "planned" | "in_progress" | "passed" | "failed" | "retest_required" | "cancelled";
  result?: string | null;
  reportNumber?: string | null;
  performedAt?: Date | null;
}, actor: ActingProjectUser) {
  const reviewing = ["passed", "failed", "retest_required", "cancelled"].includes(input.status);
  await assertAnyWorkflowPermission(actor, [reviewing ? "workflow.quality.ndt.review" : "workflow.quality.ndt.record"]);
  await ensureBlindWorkflowRuntime(input.projectId, input.blindTag);
  const db = await requireDb();
  const existing = input.id ? (await db.select().from(ndtRecords).where(eq(ndtRecords.id, input.id)).limit(1))[0] : null;
  if (existing && (existing.projectId !== input.projectId || existing.blindTag !== input.blindTag)) throw new Error("NDT record does not belong to this blind and project.");
  if (existing && input.expectedRecordVersion && existing.recordVersion !== input.expectedRecordVersion) throw new Error("This NDT record was updated by another user. Refresh before saving.");
  if (reviewing && !existing) throw new Error("Record the NDT performance before submitting an independent review result.");
  if (reviewing && !input.result?.trim()) throw new Error("An NDT result is required for review status.");
  if (reviewing && existing?.performedByOpenId === actor.openId) throw new Error("NDT review must be recorded by a different authorized user than the performer.");
  const now = new Date();
  const policy = await getWorkflowPolicySettings();
  const ndtNumber = existing?.ndtNumber ?? controlledNumber(policy.ndtNumberPrefix || "NDT", input.blindTag);
  const values: typeof ndtRecords.$inferInsert = {
    ndtNumber,
    projectId: input.projectId, blindTag: input.blindTag, defectId: input.defectId ?? null,
    method: input.method, procedureReference: input.procedureReference ?? null,
    acceptanceCriteria: input.acceptanceCriteria ?? null, status: input.status,
    result: input.result ?? null, reportNumber: input.reportNumber ?? null,
    performedByOpenId: reviewing ? existing?.performedByOpenId ?? null : actor.openId,
    reviewedByOpenId: reviewing ? actor.openId : null,
    performedAt: reviewing ? existing?.performedAt ?? input.performedAt ?? null : input.performedAt ?? now,
    reviewedAt: reviewing ? now : null,
    recordVersion: (existing?.recordVersion ?? 0) + 1, updatedAt: now,
  };
  let id: number | undefined;
  if (existing) {
    const updateResult = await db.update(ndtRecords).set(values).where(and(eq(ndtRecords.id, existing.id), eq(ndtRecords.recordVersion, existing.recordVersion)));
    if (affectedRows(updateResult) === 0) throw new Error("This NDT record was updated by another user. Refresh before saving.");
    id = existing.id;
  } else {
    const result = await db.insert(ndtRecords).values(values).$returningId();
    id = result[0]?.id;
  }
  await appendQualityAudit(input, actor, "NDT Record Updated", `${input.method} · ${input.status}.`);
  return { id, recordVersion: values.recordVersion };
}

export async function getQualityGateReadiness(projectId: string, blindTag: string) {
  const db = await requireDb();
  const policy = await getWorkflowPolicySettings();
  const [defects, punches, ndt] = await Promise.all([
    db.select({ id: defectNotifications.id, status: defectNotifications.status, disposition: defectNotifications.disposition, requiresNdt: defectNotifications.requiresNdt }).from(defectNotifications).where(and(eq(defectNotifications.projectId, projectId), eq(defectNotifications.blindTag, blindTag))),
    db.select({ status: punchItems.status, mandatory: punchItems.mandatory }).from(punchItems).where(and(eq(punchItems.projectId, projectId), eq(punchItems.blindTag, blindTag))),
    db.select({ defectId: ndtRecords.defectId, status: ndtRecords.status }).from(ndtRecords).where(and(eq(ndtRecords.projectId, projectId), eq(ndtRecords.blindTag, blindTag))),
  ]);
  return evaluateQualityReadiness({ defects, punches, ndt, policy });
}
