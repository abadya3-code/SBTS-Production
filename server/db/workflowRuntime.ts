/**
 * Canonical eight-phase workflow runtime.
 * The runtime is authoritative; blinds.phase is updated only as a temporary
 * compatibility projection for legacy reports and pages.
 */
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  accessRolePermissions,
  blindChecklistResponses,
  blindPhaseInstances,
  blindWorkflowLogs,
  blindWorkflowRuntime,
  blinds,
  entryReadinessRecords,
  defectNotifications,
  gasTestRecords,
  isolationPackageBlinds,
  isolationPackages,
  inspectionActivityRecords,
  inspectionActivityTemplates,
  leakTestRecords,
  lotoRecords,
  ndtRecords,
  permitRecords,
  punchItems,
  projectWorkflowAssignments,
  safetyHolds,
  torqueRecords,
  userRoleAssignments,
  users,
  workflowApprovalSteps,
  workflowEvidenceAttachments,
  workflowTransitionEvents,
} from "../../drizzle/schema";
import {
  canonicalPhaseKeys,
  canonicalWorkflowPhases,
  legacyPhaseMigrationHints,
  workflowLifecycleStates,
  type CanonicalPhaseKey,
  type WorkflowLifecycleState,
} from "../../shared/workflowSpecification";
import {
  allRequiredChecklistItemsComplete,
  getCanonicalPhase,
  getNextCanonicalPhase,
  isRecordValidAt,
  isSlipBlindType,
  lifecycleAfterPhaseCompletion,
  lifecycleWhilePhaseCurrent,
  normalizeChecklistItemKey,
  workflowActionToPhase,
  workflowPhaseIndex,
  type WorkflowActionKey,
  type WorkflowBlockingReason,
} from "../../shared/workflowRuntime";
import { getWorkflowPolicySettings } from "./settings";
import { evaluateGasTestAcceptance } from "./gasTestPolicy";
import { broadcastNotification, createNotification } from "./notifications";
import { seedWorkflows } from "./seed";
import { requireDb } from "./core";
import type { ActingProjectUser, BlindPhase } from "./types";

const WORKFLOW_TEMPLATE_ID = "wf-sbts-standard-v2";
const WORKFLOW_VERSION = "2.0";

const legacyPhaseKeyByLabel: Record<BlindPhase, keyof typeof legacyPhaseMigrationHints> = {
  "Broken / Preparation": "broken",
  Assembly: "assembly",
  "Tight & Torque": "tightTorque",
  "Final Tight": "finalTight",
  "Inspection Ready": "inspectionReady",
};

const legacyCompatibilityPhase: Record<CanonicalPhaseKey, BlindPhase> = {
  operationsInitialIsolation: "Broken / Preparation",
  blindInstallation: "Assembly",
  mechanicalVerification: "Final Tight",
  internalInspection: "Inspection Ready",
  reinstatementPreparation: "Inspection Ready",
  blindRemovalReinstatement: "Inspection Ready",
  reinstatementVerification: "Inspection Ready",
  finalApprovalReturnToService: "Inspection Ready",
};

const legacyLifecycleByPhase: Record<BlindPhase, WorkflowLifecycleState> = {
  "Broken / Preparation": "INITIAL_ISOLATION",
  Assembly: "READY_FOR_BLIND_INSTALLATION",
  "Tight & Torque": "BLIND_INSTALLED",
  "Final Tight": "MECHANICAL_VERIFICATION_PENDING",
  "Inspection Ready": "WORK_IN_PROGRESS",
};

export type RuntimeActor = ActingProjectUser;
export type RuntimePhaseStatus = "pending" | "current" | "completed" | "blocked" | "rework" | "skipped";

export type WorkflowRuntimeView = {
  runtime: {
    blindTag: string;
    projectId: string;
    workflowTemplateId: string;
    workflowVersion: string;
    currentPhaseKey: CanonicalPhaseKey;
    lifecycleStatus: WorkflowLifecycleState;
    recordVersion: number;
    isLocked: boolean;
    legacyPhase: BlindPhase;
    migrationSourcePhase: string | null;
    lastTransitionAt: Date | null;
  };
  currentPhase: ReturnType<typeof getCanonicalPhase>;
  phases: Array<{
    key: CanonicalPhaseKey;
    label: string;
    shortLabel: string;
    color: string;
    iconKey: string;
    status: RuntimePhaseStatus;
    sortOrder: number;
    assignedRoleKey: string;
    checklistComplete: boolean;
    evidenceComplete: boolean;
    startedAt: Date | null;
    completedAt: Date | null;
  }>;
  checklist: Array<{
    id: number;
    itemKey: string;
    itemLabel: string;
    required: boolean;
    completed: boolean;
    completedByOpenId: string | null;
    completedAt: Date | null;
  }>;
  evidence: Array<{
    id: number;
    category: string;
    fileName: string;
    fileUrl: string;
    mimeType: string | null;
    createdAt: Date;
  }>;
  approvals: Array<{
    id: number;
    roleKey: string;
    sequence: number;
    conditional: boolean;
    status: string;
    approvedByName: string | null;
    approvedAt: Date | null;
  }>;
  records: {
    permits: Array<{ id: number; type: string; number: string; status: string; validFrom: Date | null; validUntil: Date | null; notes: string | null }>;
    loto: null | { id: number; certificateNumber: string; status: string; lockNumbers: string[]; zeroEnergyVerified: boolean; appliedAt: Date | null; releasedAt: Date | null; notes: string | null };
    gasTests: Array<{
      id: number; purpose: string; status: string; testedAt: Date | null; validUntil: Date | null;
      instrumentId: string | null; calibrationExpiry: Date | null; testerName: string | null;
      oxygenPercent: string | null; lelPercent: string | null; h2sPpm: string | null; coPpm: string | null; notes: string | null;
    }>;
    torque: Array<{
      id: number; stage: string; status: string; procedureReference: string | null; toolType: string;
      toolSerialNumber: string | null; calibrationCertificateNumber: string | null; calibrationExpiry: Date | null;
      targetTorque: string | null; actualTorque: string | null; torqueUnit: string; pumpPressure: string | null;
      pumpPressureUnit: string | null; passes: unknown[]; witnessOpenId: string | null; notes: string | null;
    }>;
    leakTest: null | { id: number; status: string; testType: string | null; testMedium: string | null; testPressure: string | null; pressureUnit: string | null; durationMinutes: number | null; noLeakObserved: boolean; testedAt: Date | null; acceptedAt: Date | null; notes: string | null };
    isolationPackages: Array<{ id: string; equipment: string; description: string | null; status: string; recordVersion: number }>;
    entryReadiness: Array<{ id: number; packageId: string; status: string; allRequiredBlindsActive: boolean; lotoActive: boolean; pressureZero: boolean; drainedAndPurged: boolean; gasTestAcceptable: boolean; confinedSpacePermitValid: boolean; operationsApproved: boolean; entrySupervisorApproved: boolean; validUntil: Date | null; approvedAt: Date | null }>;
  };
  gateReadiness: {
    ready: boolean;
    blockingReasons: WorkflowBlockingReason[];
  };
  activeHold: null | {
    id: number;
    reasonCode: string;
    description: string;
    correctiveAction: string | null;
    status: string;
    previousLifecycleStatus: string | null;
    releaseRequestedByOpenId: string | null;
    releaseRequestedAt: Date | null;
    placedAt: Date;
  };
  permissions: {
    canExecuteCurrentAction: boolean;
    canPlaceHold: boolean;
    canReleaseHold: boolean;
    canOverride: boolean;
    canManagePermit: boolean;
    canManageLoto: boolean;
    canRecordGasTest: boolean;
    canManageTorque: boolean;
    canSubmitInstallationTorque: boolean;
    canSubmitReinstatementTorque: boolean;
    canVerifyInstallationTorque: boolean;
    canVerifyReinstatementTorque: boolean;
    canManageLeakTest: boolean;
    canManagePackage: boolean;
    canPrepareEntry: boolean;
    canAuthorizeEntry: boolean;
    canRecordApproval: boolean;
    canManageEvidence: boolean;
    canManageInspection: boolean;
    canApproveInspection: boolean;
    canRecordDefect: boolean;
    canReviewDefect: boolean;
    canManagePunch: boolean;
    canVerifyPunch: boolean;
    canRecordNdt: boolean;
    canReviewNdt: boolean;
    canIssueCertificate: boolean;
    canReissueCertificate: boolean;
    canRevokeCertificate: boolean;
  };
};

function parseCanonicalPhase(value: string): CanonicalPhaseKey {
  if (canonicalPhaseKeys.includes(value as CanonicalPhaseKey)) return value as CanonicalPhaseKey;
  throw new Error(`Runtime contains a non-canonical phase key: ${value}`);
}

function mapLegacyPhase(phase: BlindPhase): CanonicalPhaseKey {
  return legacyPhaseMigrationHints[legacyPhaseKeyByLabel[phase]];
}

export type WorkflowActorAccess = { roleKeys: string[]; permissionKeys: string[] };

export async function getWorkflowActorAccess(openId: string, systemRole: "user" | "admin"): Promise<WorkflowActorAccess> {
  if (systemRole === "admin") {
    return { roleKeys: ["admin"], permissionKeys: ["*"] };
  }
  const db = await requireDb();
  const userRows = await db.select({ id: users.id }).from(users).where(eq(users.openId, openId)).limit(1);
  if (!userRows[0]) return { roleKeys: [], permissionKeys: [] };
  const assignments = await db
    .select({ roleKey: userRoleAssignments.roleKey })
    .from(userRoleAssignments)
    .where(eq(userRoleAssignments.userId, userRows[0].id));
  const roleKeys = assignments.map((row) => String(row.roleKey));
  if (roleKeys.length === 0) return { roleKeys, permissionKeys: [] };
  const permissions = await db
    .select({ permissionKey: accessRolePermissions.permissionKey })
    .from(accessRolePermissions)
    .where(inArray(accessRolePermissions.roleKey, roleKeys));
  return { roleKeys, permissionKeys: Array.from(new Set(permissions.map((row) => String(row.permissionKey)))) };
}

function hasPermission(permissionKeys: string[], key: string): boolean {
  return permissionKeys.includes("*") || permissionKeys.includes(key);
}

export async function assertAnyWorkflowPermission(
  actor: RuntimeActor,
  permissionKeys: string[],
): Promise<void> {
  const access = await getWorkflowActorAccess(actor.openId, actor.role);
  if (!permissionKeys.some((key) => hasPermission(access.permissionKeys, key))) {
    throw new Error(`One of the following permissions is required: ${permissionKeys.join(", ")}.`);
  }
}

function isDateExpired(value: Date | null | undefined, now = new Date()) {
  return Boolean(value && value.getTime() <= now.getTime());
}

async function ensureFinalApprovalSteps(blindTag: string, projectId: string, blindType: string) {
  const db = await requireDb();
  const policy = await getWorkflowPolicySettings();
  const isSlip = isSlipBlindType(blindType);
  const metalRequired = isSlip && policy.metalForemanRequiredForSlipBlind === 1;
  const operationsRequired = policy.operationsForemanFinalApprover === 1;
  const desired = [
    { roleKey: "inspection", sequence: 1, conditional: 0, required: true },
    { roleKey: "coordinator", sequence: 2, conditional: 0, required: true },
    { roleKey: "mechanicalVerifier", sequence: 3, conditional: 1, required: !metalRequired },
    { roleKey: "metalForeman", sequence: 3, conditional: 1, required: metalRequired },
    { roleKey: "operationsForeman", sequence: 4, conditional: operationsRequired ? 0 : 1, required: operationsRequired },
  ];
  const existing = await db.select().from(workflowApprovalSteps).where(and(
    eq(workflowApprovalSteps.blindTag, blindTag),
    eq(workflowApprovalSteps.phaseKey, "finalApprovalReturnToService"),
  ));
  const existingByRole = new Map<string, typeof workflowApprovalSteps.$inferSelect>(
    existing.map((row) => [String(row.approvalRoleKey), row]),
  );
  for (const step of desired) {
    const row = existingByRole.get(step.roleKey);
    const targetStatus = step.required ? "pending" as const : "not_required" as const;
    if (!row) {
      await db.insert(workflowApprovalSteps).values({
        blindTag, projectId, phaseKey: "finalApprovalReturnToService",
        approvalRoleKey: step.roleKey, sequence: step.sequence, conditional: step.conditional, status: targetStatus,
      });
      continue;
    }
    const nextStatus = row.status === "approved" || row.status === "rejected" || row.status === "revoked"
      ? row.status
      : targetStatus;
    await db.update(workflowApprovalSteps).set({
      sequence: step.sequence, conditional: step.conditional, status: nextStatus, updatedAt: new Date(),
    }).where(eq(workflowApprovalSteps.id, row.id));
  }
}

async function getRoleRecipients(roleKeys: string[]): Promise<string[]> {
  if (roleKeys.length === 0) return [];
  const db = await requireDb();
  const rows = await db
    .select({ openId: users.openId })
    .from(userRoleAssignments)
    .innerJoin(users, eq(users.id, userRoleAssignments.userId))
    .where(inArray(userRoleAssignments.roleKey, roleKeys));
  return Array.from(new Set(rows.map((row) => String(row.openId)).filter(Boolean)));
}

async function notifyWorkflowRoles(
  roleKeys: string[],
  input: {
    type: "workflow_transition" | "workflow_approval_required" | "safety_hold_placed" | "safety_hold_released";
    title: string;
    body: string;
    projectId: string;
    blindTag: string;
    actor: RuntimeActor;
  },
): Promise<void> {
  const recipients = (await getRoleRecipients(roleKeys)).filter((openId) => openId !== input.actor.openId);
  await broadcastNotification(recipients, {
    actorOpenId: input.actor.openId,
    actorName: input.actor.name ?? input.actor.email ?? undefined,
    type: input.type,
    title: input.title,
    body: input.body,
    linkUrl: `/projects/${encodeURIComponent(input.projectId)}/blinds/${encodeURIComponent(input.blindTag)}`,
    projectId: input.projectId,
    blindTag: input.blindTag,
  });
}

export async function ensureBlindWorkflowRuntime(projectId: string, blindTag: string): Promise<void> {
  await seedWorkflows();
  const db = await requireDb();
  const blindRows = await db.select().from(blinds).where(and(eq(blinds.projectId, projectId), eq(blinds.tag, blindTag))).limit(1);
  const blind = blindRows[0];
  if (!blind) throw new Error("Blind was not found in this project.");

  await db.insert(projectWorkflowAssignments).values({
    projectId,
    workflowTemplateId: WORKFLOW_TEMPLATE_ID,
    workflowVersion: WORKFLOW_VERSION,
    status: "active",
    migrationVersion: 2,
    assignedByOpenId: "runtime-initializer",
  }).onDuplicateKeyUpdate({ set: { updatedAt: new Date() } });

  const existing = await db.select().from(blindWorkflowRuntime).where(eq(blindWorkflowRuntime.blindTag, blindTag)).limit(1);
  if (!existing[0]) {
    const currentPhaseKey = mapLegacyPhase(blind.phase as BlindPhase);
    await db.insert(blindWorkflowRuntime).values({
      blindTag,
      projectId,
      workflowTemplateId: WORKFLOW_TEMPLATE_ID,
      workflowVersion: WORKFLOW_VERSION,
      currentPhaseKey,
      lifecycleStatus: legacyLifecycleByPhase[blind.phase as BlindPhase],
      recordVersion: 1,
      isLocked: 0,
      migrationSourcePhase: blind.phase,
      migrationVersion: 2,
    });
  }

  const runtimeRows = await db.select().from(blindWorkflowRuntime).where(eq(blindWorkflowRuntime.blindTag, blindTag)).limit(1);
  const currentPhaseKey = parseCanonicalPhase(runtimeRows[0].currentPhaseKey);
  const currentIndex = workflowPhaseIndex[currentPhaseKey];
  const now = new Date();

  await db.insert(blindPhaseInstances).values(canonicalWorkflowPhases.map((phase, index) => ({
    blindTag,
    projectId,
    workflowTemplateId: WORKFLOW_TEMPLATE_ID,
    phaseKey: phase.key,
    sortOrder: index + 1,
    status: index < currentIndex ? "completed" as const : index === currentIndex ? "current" as const : "pending" as const,
    assignedRoleKey: phase.ownerRoleKey,
    startedAt: index <= currentIndex ? now : null,
    completedAt: index < currentIndex ? now : null,
    checklistComplete: 0,
    evidenceComplete: 0,
    recordVersion: 1,
  }))).onDuplicateKeyUpdate({ set: { updatedAt: now } });

  const checklistRows = canonicalWorkflowPhases.flatMap((phase) => phase.checklist.map((label, index) => ({
    blindTag,
    projectId,
    phaseKey: phase.key,
    itemKey: normalizeChecklistItemKey(label, index),
    itemLabel: label,
    required: 1,
    completed: 0,
  })));
  await db.insert(blindChecklistResponses).values(checklistRows).onDuplicateKeyUpdate({
    set: { itemLabel: sql`VALUES(itemLabel)`, required: sql`VALUES(required)`, updatedAt: now },
  });

  await ensureFinalApprovalSteps(blindTag, projectId, blind.type);
}

async function loadGateContext(projectId: string, blindTag: string) {
  const db = await requireDb();
  const [
    runtimeRows, blindRows, checklistRows, evidenceRows, permitRows, lotoRows,
    gasRows, torqueRows, leakRows, holdRows, approvalRows, membershipRows,
  ] = await Promise.all([
    db.select().from(blindWorkflowRuntime).where(eq(blindWorkflowRuntime.blindTag, blindTag)).limit(1),
    db.select().from(blinds).where(and(eq(blinds.projectId, projectId), eq(blinds.tag, blindTag))).limit(1),
    db.select().from(blindChecklistResponses).where(eq(blindChecklistResponses.blindTag, blindTag)),
    db.select().from(workflowEvidenceAttachments).where(eq(workflowEvidenceAttachments.blindTag, blindTag)),
    db.select().from(permitRecords).where(eq(permitRecords.blindTag, blindTag)).orderBy(desc(permitRecords.createdAt)),
    db.select().from(lotoRecords).where(eq(lotoRecords.blindTag, blindTag)).orderBy(desc(lotoRecords.createdAt)),
    db.select().from(gasTestRecords).where(eq(gasTestRecords.blindTag, blindTag)).orderBy(desc(gasTestRecords.testedAt)),
    db.select().from(torqueRecords).where(eq(torqueRecords.blindTag, blindTag)),
    db.select().from(leakTestRecords).where(eq(leakTestRecords.blindTag, blindTag)).limit(1),
    db.select().from(safetyHolds).where(and(eq(safetyHolds.blindTag, blindTag), inArray(safetyHolds.status, ["active", "release_pending"]))).orderBy(desc(safetyHolds.placedAt)),
    db.select().from(workflowApprovalSteps).where(eq(workflowApprovalSteps.blindTag, blindTag)).orderBy(workflowApprovalSteps.sequence),
    db.select().from(isolationPackageBlinds).where(eq(isolationPackageBlinds.blindTag, blindTag)),
  ]);
  if (!runtimeRows[0] || !blindRows[0]) throw new Error("Workflow runtime could not be loaded.");
  let packageRows: (typeof isolationPackages.$inferSelect)[] = [];
  let readinessRows: (typeof entryReadinessRecords.$inferSelect)[] = [];
  if (membershipRows.length > 0) {
    const packageIds = membershipRows.map((row) => row.packageId);
    packageRows = await db.select().from(isolationPackages).where(inArray(isolationPackages.id, packageIds));
    readinessRows = await db.select().from(entryReadinessRecords).where(inArray(entryReadinessRecords.packageId, packageIds)).orderBy(desc(entryReadinessRecords.createdAt));
  }
  return {
    runtime: runtimeRows[0], blind: blindRows[0], checklistRows, evidenceRows, permitRows,
    lotoRows, gasRows, torqueRows, leak: leakRows[0] ?? null, activeHold: holdRows[0] ?? null,
    approvalRows, membershipRows, packageRows, readinessRows,
  };
}

/**
 * Keep package-level status synchronized with every required Blind runtime.
 * The package is a derived operational view; Blind runtime records remain the
 * authoritative source for phase and lifecycle state.
 */
export async function reconcileIsolationPackagesForBlind(blindTag: string): Promise<void> {
  const db = await requireDb();
  const memberships = await db.select().from(isolationPackageBlinds).where(eq(isolationPackageBlinds.blindTag, blindTag));
  const now = new Date();
  for (const membership of memberships) {
    const linked = await db.select().from(isolationPackageBlinds).where(eq(isolationPackageBlinds.packageId, membership.packageId));
    const requiredTags = linked.filter((row) => row.required === 1).map((row) => row.blindTag);
    if (requiredTags.length === 0) continue;
    const [runtimeRows, activeHolds, readinessRows] = await Promise.all([
      db.select().from(blindWorkflowRuntime).where(inArray(blindWorkflowRuntime.blindTag, requiredTags)),
      db.select({ blindTag: safetyHolds.blindTag }).from(safetyHolds).where(and(
        inArray(safetyHolds.blindTag, requiredTags),
        inArray(safetyHolds.status, ["active", "release_pending"]),
      )),
      db.select().from(entryReadinessRecords).where(eq(entryReadinessRecords.packageId, membership.packageId)).orderBy(desc(entryReadinessRecords.createdAt)),
    ]);
    const lifecycleByTag = new Map<string, string>(
      runtimeRows.map((row) => [String(row.blindTag), String(row.lifecycleStatus)]),
    );
    const everyLifecycleIn = (allowed: string[]) => requiredTags.every((tag) => {
      const value = lifecycleByTag.get(tag);
      return Boolean(value && allowed.includes(value));
    });
    const anyLifecycleIn = (allowed: string[]) => requiredTags.some((tag) => {
      const value = lifecycleByTag.get(tag);
      return Boolean(value && allowed.includes(value));
    });
    const authorizedEntry = readinessRows.some((row) => row.status === "authorized" && (!row.validUntil || row.validUntil > now));

    let status: typeof isolationPackages.$inferInsert.status = "active";
    if (activeHolds.length > 0) status = "on_hold";
    else if (everyLifecycleIn(["CLOSED"])) status = "closed";
    else if (everyLifecycleIn(["READY_FOR_SERVICE", "CLOSED"])) status = "ready_for_service";
    else if (everyLifecycleIn(["REINSTATED", "LEAK_TEST_PENDING", "READY_FOR_SERVICE", "CLOSED"])) status = "reinstated";
    else if (everyLifecycleIn(["READY_FOR_BLIND_REMOVAL", "REINSTATED", "LEAK_TEST_PENDING", "READY_FOR_SERVICE", "CLOSED"])) status = "ready_for_removal";
    else if (anyLifecycleIn(["ENTRY_AUTHORIZED", "WORK_IN_PROGRESS", "READY_FOR_CLOSURE"])) status = "work_in_progress";
    else if (authorizedEntry) status = "entry_authorized";

    await db.update(isolationPackages).set({
      status,
      recordVersion: sql`${isolationPackages.recordVersion} + 1`,
      updatedAt: now,
    }).where(eq(isolationPackages.id, membership.packageId));
  }
}

function latestPermit(rows: Awaited<ReturnType<typeof loadGateContext>>["permitRows"], type: string) {
  return rows.find((row) => row.permitType.toLowerCase() === type.toLowerCase());
}

function latestGas(rows: Awaited<ReturnType<typeof loadGateContext>>["gasRows"], purpose: string) {
  return rows.find((row) => row.testPurpose.toLowerCase() === purpose.toLowerCase());
}

export async function evaluateWorkflowGate(
  projectId: string,
  blindTag: string,
  actor?: RuntimeActor,
): Promise<{ ready: boolean; blockingReasons: WorkflowBlockingReason[] }> {
  await ensureBlindWorkflowRuntime(projectId, blindTag);
  const context = await loadGateContext(projectId, blindTag);
  const policy = await getWorkflowPolicySettings();
  const phaseKey = parseCanonicalPhase(context.runtime.currentPhaseKey);
  const reasons: WorkflowBlockingReason[] = [];
  const now = new Date();

  if (context.runtime.isLocked === 1) {
    reasons.push({ code: "WORKFLOW_LOCKED", message: "This workflow record is locked and cannot be advanced.", source: "workflow" });
  }
  if (context.activeHold) {
    reasons.push({ code: "SAFETY_HOLD_ACTIVE", message: `Safety Hold is active: ${context.activeHold.description}`, source: "hold" });
  }

  if (actor) {
    const access = await getWorkflowActorAccess(actor.openId, actor.role);
    const permission = getCanonicalPhase(phaseKey).requiredPermissionKey;
    if (!hasPermission(access.permissionKeys, permission)) {
      reasons.push({ code: "PERMISSION_REQUIRED", message: `Permission ${permission} is required for this action.`, source: "workflow" });
    }
  }

  const phaseChecklist = context.checklistRows
    .filter((row) => row.phaseKey === phaseKey)
    .map((row) => ({ required: row.required === 1, completed: row.completed === 1 }));
  if (policy.enforceServerGates === 1 && !allRequiredChecklistItemsComplete(phaseChecklist)) {
    reasons.push({ code: "CHECKLIST_INCOMPLETE", message: "All mandatory checklist items for the current phase must be completed.", source: "checklist" });
  }
  if (policy.requireEvidenceBeforePhaseSubmit === 1) {
    const phaseEvidence = context.evidenceRows.filter((row) => row.phaseKey === phaseKey);
    if (phaseEvidence.length === 0) {
      reasons.push({ code: "EVIDENCE_REQUIRED", message: "At least one controlled evidence attachment is required for the current phase.", source: "workflow" });
    }
  }

  const ptw = latestPermit(context.permitRows, "PTW");
  const lineBreaking = latestPermit(context.permitRows, "Line Breaking");
  const loto = context.lotoRows[0];
  const permitStatusUsable = (row: typeof ptw) => Boolean(row && (row.status === "active" || row.status === "valid"));
  const activePtw = ptw && permitStatusUsable(ptw) && (policy.blockTransitionWhenPermitExpired !== 1 || !ptw.validUntil || ptw.validUntil > now);
  const activeLineBreaking = lineBreaking && permitStatusUsable(lineBreaking) && (policy.blockTransitionWhenPermitExpired !== 1 || !lineBreaking.validUntil || lineBreaking.validUntil > now);
  const activeLoto = loto && (loto.status === "active" || loto.status === "valid");

  const requireActivePtw = phaseKey !== "finalApprovalReturnToService";
  if (policy.requirePtwActive === 1 && requireActivePtw && !activePtw) {
    reasons.push({ code: "PTW_NOT_ACTIVE", message: "A valid active PTW is required.", source: "permit" });
  }
  if (policy.requireLineBreakingPermit === 1 && ["operationsInitialIsolation", "blindInstallation", "blindRemovalReinstatement"].includes(phaseKey) && !activeLineBreaking) {
    reasons.push({ code: "LINE_BREAKING_PERMIT_NOT_ACTIVE", message: "A valid Line Breaking Permit is required.", source: "permit" });
  }
  if (policy.requireLotoActive === 1 && phaseKey !== "finalApprovalReturnToService") {
    if (!activeLoto) reasons.push({ code: "LOTO_NOT_ACTIVE", message: "LOTO must remain active for this phase.", source: "loto" });
    if (!loto || loto.zeroEnergyVerified !== 1) reasons.push({ code: "LOTO_ZERO_ENERGY_NOT_VERIFIED", message: "Zero-energy verification is required.", source: "loto" });
  }

  const checkGas = (purpose: string, required: boolean) => {
    if (!required) return;
    const gas = latestGas(context.gasRows, purpose);
    if (!gas) {
      reasons.push({ code: "GAS_TEST_MISSING", message: `A ${purpose} gas test is required.`, source: "gasTest" });
      return;
    }
    if (gas.status === "rejected" || gas.status === "cancelled") {
      reasons.push({ code: "GAS_TEST_REJECTED", message: `The ${purpose} gas test is not acceptable.`, source: "gasTest" });
    } else if (
      !isRecordValidAt(gas.status, gas.validUntil, now)
      || (policy.gasTestRequiresInstrumentCalibration === 1 && (!gas.instrumentId || !gas.calibrationExpiry || isDateExpired(gas.calibrationExpiry, now)))
    ) {
      reasons.push({ code: "GAS_TEST_EXPIRED", message: `The ${purpose} gas test or instrument calibration has expired.`, source: "gasTest" });
    } else {
      const acceptance = evaluateGasTestAcceptance(gas, policy);
      if (!acceptance.acceptable) {
        reasons.push({ code: "GAS_TEST_OUT_OF_LIMITS", message: `${purpose} gas test is outside the configured plant limits: ${acceptance.reasons.join(" ")}`, source: "gasTest" });
      }
    }
  };
  if (["operationsInitialIsolation", "blindInstallation"].includes(phaseKey)) checkGas("lineBreaking", policy.requireGasTestForLineBreaking === 1);
  if (phaseKey === "internalInspection") checkGas("entry", policy.requireGasTestForEntry === 1);
  if (["reinstatementPreparation", "blindRemovalReinstatement"].includes(phaseKey)) checkGas("deblinding", policy.requireGasTestForDeBlinding === 1);

  const checkTorque = (stage: "installation" | "reinstatement", required: boolean, acceptedRequired: boolean) => {
    if (!required) return;
    const torque = context.torqueRows.find((row) => row.stage === stage);
    if (!torque) {
      reasons.push({ code: "TORQUE_RECORD_MISSING", message: `A ${stage} torque record is required.`, source: "torque" });
      return;
    }
    if (acceptedRequired ? torque.status !== "accepted" : !["submitted", "accepted"].includes(torque.status)) {
      reasons.push({ code: "TORQUE_NOT_ACCEPTED", message: acceptedRequired
        ? `The ${stage} torque record must be independently accepted.`
        : `The ${stage} torque record must be submitted before progression.`, source: "torque" });
    }
    if (policy.requireTorqueCalibration === 1 && (!torque.calibrationExpiry || isDateExpired(torque.calibrationExpiry, now))) {
      reasons.push({ code: "CALIBRATION_EXPIRED", message: `Valid torque-tool calibration is required for ${stage}.`, source: "torque" });
    }
  };
  if (phaseKey === "blindInstallation") checkTorque("installation", policy.requireInstallationTorque === 1, false);
  if (phaseKey === "mechanicalVerification") checkTorque("installation", policy.requireInstallationTorque === 1, true);
  if (phaseKey === "blindRemovalReinstatement") checkTorque("reinstatement", policy.requireReinstatementTorque === 1, false);
  if (phaseKey === "reinstatementVerification") checkTorque("reinstatement", policy.requireReinstatementTorque === 1, true);

  if (phaseKey === "mechanicalVerification" && policy.requireIndependentVerifier === 1 && actor) {
    const db = await requireDb();
    const previous = await db.select().from(blindPhaseInstances).where(and(
      eq(blindPhaseInstances.blindTag, blindTag),
      eq(blindPhaseInstances.phaseKey, "blindInstallation"),
    )).limit(1);
    if (previous[0]?.completedByOpenId && previous[0].completedByOpenId === actor.openId) {
      reasons.push({ code: "INDEPENDENT_VERIFIER_REQUIRED", message: "The installation executor cannot perform the independent mechanical verification.", source: "workflow" });
    }
  }

  if (phaseKey === "internalInspection" && policy.requireIsolationPackageForEntry === 1) {
    if (context.membershipRows.length === 0) {
      reasons.push({ code: "ISOLATION_PACKAGE_REQUIRED", message: "The blind must be linked to an Isolation Package before vessel entry readiness can be authorized.", source: "package" });
    } else {
      const authorized = context.readinessRows.some((row) => row.status === "authorized" && (!row.validUntil || row.validUntil > now));
      if (!authorized) reasons.push({ code: "ENTRY_READINESS_NOT_AUTHORIZED", message: "Vessel Entry Readiness is not authorized or has expired.", source: "package" });
    }
  }

  if (phaseKey === "internalInspection") {
    const db = await requireDb();
    const mandatoryTemplates = await db.select({ id: inspectionActivityTemplates.id, name: inspectionActivityTemplates.name }).from(inspectionActivityTemplates).where(and(
      eq(inspectionActivityTemplates.active, 1),
      eq(inspectionActivityTemplates.mandatory, 1),
    ));
    if (mandatoryTemplates.length > 0) {
      const activityRows = await db.select().from(inspectionActivityRecords).where(and(
        eq(inspectionActivityRecords.blindTag, blindTag),
        inArray(inspectionActivityRecords.templateId, mandatoryTemplates.map((row) => row.id)),
      ));
      const completedStatuses = new Set(["completed", "approved", "not_applicable"]);
      const missing = mandatoryTemplates.filter((template) => !activityRows.some((row) => row.templateId === template.id && completedStatuses.has(row.status)));
      if (missing.length > 0) {
        reasons.push({ code: "INSPECTION_ACTIVITIES_INCOMPLETE", message: `Mandatory inspection activities are incomplete: ${missing.map((row) => row.name).join(", ")}.`, source: "inspection" });
      }
    }
  }

  if (phaseKey === "internalInspection") {
    const db = await requireDb();
    const [defects, punches, ndt] = await Promise.all([
      db.select().from(defectNotifications).where(and(eq(defectNotifications.projectId, projectId), eq(defectNotifications.blindTag, blindTag))),
      db.select().from(punchItems).where(and(eq(punchItems.projectId, projectId), eq(punchItems.blindTag, blindTag))),
      db.select().from(ndtRecords).where(and(eq(ndtRecords.projectId, projectId), eq(ndtRecords.blindTag, blindTag))),
    ]);
    if (policy.requireDefectDispositionBeforeClosure === 1) {
      const openDefects = defects.filter((row) => !["accepted_as_is", "closed", "transferred", "cancelled"].includes(row.status) || !row.disposition?.trim());
      if (openDefects.length) reasons.push({ code: "DEFECT_DISPOSITION_INCOMPLETE", message: `${openDefects.length} defect notification(s) require controlled disposition.`, source: "inspection" });
    }
    if (policy.requireMandatoryPunchClosureBeforeReadyForClosure === 1) {
      const openPunches = punches.filter((row) => row.mandatory === 1 && !["closed", "transferred", "cancelled"].includes(row.status));
      if (openPunches.length) reasons.push({ code: "MANDATORY_PUNCH_ITEMS_OPEN", message: `${openPunches.length} mandatory punch item(s) remain open.`, source: "inspection" });
    }
    if (policy.requireNdtAcceptanceBeforeReadyForClosure === 1) {
      const requiredNdt = defects.filter((row) => row.requiresNdt === 1).length;
      const passedNdt = ndt.filter((row) => ["passed", "cancelled"].includes(row.status)).length;
      const unresolvedNdt = ndt.filter((row) => ["planned", "in_progress", "failed", "retest_required"].includes(row.status));
      if (unresolvedNdt.length || passedNdt < requiredNdt) reasons.push({ code: "NDT_ACCEPTANCE_INCOMPLETE", message: "Required NDT records are missing, incomplete, failed, or awaiting retest.", source: "inspection" });
    }
  }

  if (phaseKey === "reinstatementVerification") {
    if (policy.certificateRequiresLeakTest === 1 && (!context.leak || context.leak.status !== "passed" || context.leak.noLeakObserved !== 1)) {
      reasons.push({ code: "LEAK_TEST_NOT_PASSED", message: "A passed leak/service test with no leakage observed is required.", source: "leakTest" });
    }
    if (policy.requireIndependentVerifier === 1 && actor) {
      const db = await requireDb();
      const previous = await db.select().from(blindPhaseInstances).where(and(
        eq(blindPhaseInstances.blindTag, blindTag),
        eq(blindPhaseInstances.phaseKey, "blindRemovalReinstatement"),
      )).limit(1);
      if (previous[0]?.completedByOpenId && previous[0].completedByOpenId === actor.openId) {
        reasons.push({ code: "INDEPENDENT_VERIFIER_REQUIRED", message: "The reinstatement executor cannot perform the independent final verification.", source: "workflow" });
      }
    }
  }

  if (phaseKey === "finalApprovalReturnToService") {
    const pending = context.approvalRows.filter((row) => row.status !== "approved" && row.status !== "not_required");
    if (pending.length > 0) reasons.push({ code: "FINAL_APPROVALS_INCOMPLETE", message: `Final approval chain is incomplete (${pending.map((row) => row.approvalRoleKey).join(", ")}).`, source: "approval" });
    if (policy.requireLotoReleasedForCloseout === 1 && (!loto || loto.status !== "closed" || !loto.releasedAt)) {
      reasons.push({ code: "LOTO_NOT_RELEASED", message: "LOTO closeout and controlled release must be recorded before final closure.", source: "loto" });
    }
  }

  return { ready: reasons.length === 0, blockingReasons: reasons };
}

export async function getBlindWorkflowRuntimeView(
  projectId: string,
  blindTag: string,
  actor: RuntimeActor,
): Promise<WorkflowRuntimeView> {
  await ensureBlindWorkflowRuntime(projectId, blindTag);
  const db = await requireDb();
  const context = await loadGateContext(projectId, blindTag);
  const phaseKey = parseCanonicalPhase(context.runtime.currentPhaseKey);
  const [phaseRows, checklistRows, evidenceRows] = await Promise.all([
    db.select().from(blindPhaseInstances).where(eq(blindPhaseInstances.blindTag, blindTag)).orderBy(blindPhaseInstances.sortOrder),
    db.select().from(blindChecklistResponses).where(and(eq(blindChecklistResponses.blindTag, blindTag), eq(blindChecklistResponses.phaseKey, phaseKey))).orderBy(blindChecklistResponses.id),
    db.select().from(workflowEvidenceAttachments).where(and(eq(workflowEvidenceAttachments.blindTag, blindTag), eq(workflowEvidenceAttachments.phaseKey, phaseKey))).orderBy(desc(workflowEvidenceAttachments.createdAt)),
  ]);
  const gateReadiness = await evaluateWorkflowGate(projectId, blindTag, actor);
  const access = await getWorkflowActorAccess(actor.openId, actor.role);
  const policy = await getWorkflowPolicySettings();
  const phase = getCanonicalPhase(phaseKey);
  return {
    runtime: {
      blindTag: context.runtime.blindTag,
      projectId: context.runtime.projectId,
      workflowTemplateId: context.runtime.workflowTemplateId,
      workflowVersion: context.runtime.workflowVersion,
      currentPhaseKey: phaseKey,
      lifecycleStatus: context.runtime.lifecycleStatus as WorkflowLifecycleState,
      recordVersion: context.runtime.recordVersion,
      isLocked: context.runtime.isLocked === 1,
      legacyPhase: context.blind.phase as BlindPhase,
      migrationSourcePhase: context.runtime.migrationSourcePhase ?? null,
      lastTransitionAt: context.runtime.lastTransitionAt ?? null,
    },
    currentPhase: phase,
    phases: phaseRows.map((row) => ({
      key: parseCanonicalPhase(row.phaseKey),
      label: getCanonicalPhase(parseCanonicalPhase(row.phaseKey)).label,
      shortLabel: getCanonicalPhase(parseCanonicalPhase(row.phaseKey)).shortLabel,
      color: getCanonicalPhase(parseCanonicalPhase(row.phaseKey)).color,
      iconKey: getCanonicalPhase(parseCanonicalPhase(row.phaseKey)).iconKey,
      status: row.status as RuntimePhaseStatus,
      sortOrder: row.sortOrder,
      assignedRoleKey: row.assignedRoleKey,
      checklistComplete: row.checklistComplete === 1,
      evidenceComplete: row.evidenceComplete === 1,
      startedAt: row.startedAt ?? null,
      completedAt: row.completedAt ?? null,
    })),
    checklist: checklistRows.map((row) => ({
      id: row.id,
      itemKey: row.itemKey,
      itemLabel: row.itemLabel,
      required: row.required === 1,
      completed: row.completed === 1,
      completedByOpenId: row.completedByOpenId ?? null,
      completedAt: row.completedAt ?? null,
    })),
    evidence: evidenceRows.map((row) => ({
      id: row.id,
      category: row.category,
      fileName: row.fileName,
      fileUrl: row.fileUrl,
      mimeType: row.mimeType ?? null,
      createdAt: row.createdAt,
    })),
    approvals: context.approvalRows.map((row) => ({
      id: row.id,
      roleKey: row.approvalRoleKey,
      sequence: row.sequence,
      conditional: row.conditional === 1,
      status: row.status,
      approvedByName: row.approvedByName ?? null,
      approvedAt: row.approvedAt ?? null,
    })),
    records: {
      permits: context.permitRows.map((row) => ({ id: row.id, type: row.permitType, number: row.permitNumber, status: row.status, validFrom: row.validFrom ?? null, validUntil: row.validUntil ?? null, notes: row.notes ?? null })),
      loto: context.lotoRows[0] ? {
        id: context.lotoRows[0].id,
        certificateNumber: context.lotoRows[0].certificateNumber,
        status: context.lotoRows[0].status,
        lockNumbers: (() => { try { return JSON.parse(context.lotoRows[0].lockNumbersJson || "[]") as string[]; } catch { return []; } })(),
        zeroEnergyVerified: context.lotoRows[0].zeroEnergyVerified === 1,
        appliedAt: context.lotoRows[0].appliedAt ?? null,
        releasedAt: context.lotoRows[0].releasedAt ?? null,
        notes: context.lotoRows[0].notes ?? null,
      } : null,
      gasTests: context.gasRows.map((row) => ({
        id: row.id, purpose: row.testPurpose, status: row.status, testedAt: row.testedAt ?? null,
        validUntil: row.validUntil ?? null, instrumentId: row.instrumentId ?? null,
        calibrationExpiry: row.calibrationExpiry ?? null, testerName: row.testerName ?? null,
        oxygenPercent: row.oxygenPercent ?? null, lelPercent: row.lelPercent ?? null,
        h2sPpm: row.h2sPpm ?? null, coPpm: row.coPpm ?? null, notes: row.notes ?? null,
      })),
      torque: context.torqueRows.map((row) => ({
        id: row.id, stage: row.stage, status: row.status, procedureReference: row.procedureReference ?? null,
        toolType: row.toolType, toolSerialNumber: row.toolSerialNumber ?? null,
        calibrationCertificateNumber: row.calibrationCertificateNumber ?? null,
        calibrationExpiry: row.calibrationExpiry ?? null, targetTorque: row.targetTorque ?? null,
        actualTorque: row.actualTorque ?? null, torqueUnit: row.torqueUnit,
        pumpPressure: row.pumpPressure ?? null, pumpPressureUnit: row.pumpPressureUnit ?? null,
        passes: (() => { try { return JSON.parse(row.passesJson || "[]") as unknown[]; } catch { return []; } })(),
        witnessOpenId: row.witnessOpenId ?? null, notes: row.notes ?? null,
      })),
      leakTest: context.leak ? {
        id: context.leak.id, status: context.leak.status, testType: context.leak.testType ?? null,
        testMedium: context.leak.testMedium ?? null, testPressure: context.leak.testPressure ?? null,
        pressureUnit: context.leak.pressureUnit ?? null, durationMinutes: context.leak.durationMinutes ?? null,
        noLeakObserved: context.leak.noLeakObserved === 1, testedAt: context.leak.testedAt ?? null,
        acceptedAt: context.leak.acceptedAt ?? null, notes: context.leak.notes ?? null,
      } : null,
      isolationPackages: context.packageRows.map((row) => ({ id: row.id, equipment: row.equipment, description: row.description ?? null, status: row.status, recordVersion: row.recordVersion })),
      entryReadiness: context.readinessRows.map((row) => ({
        id: row.id, packageId: row.packageId, status: row.status,
        allRequiredBlindsActive: row.allRequiredBlindsActive === 1, lotoActive: row.lotoActive === 1,
        pressureZero: row.pressureZero === 1, drainedAndPurged: row.drainedAndPurged === 1,
        gasTestAcceptable: row.gasTestAcceptable === 1, confinedSpacePermitValid: row.confinedSpacePermitValid === 1,
        operationsApproved: row.operationsApproved === 1, entrySupervisorApproved: row.entrySupervisorApproved === 1,
        validUntil: row.validUntil ?? null, approvedAt: row.approvedAt ?? null,
      })),
    },
    gateReadiness,
    activeHold: context.activeHold ? {
      id: context.activeHold.id,
      reasonCode: context.activeHold.reasonCode,
      description: context.activeHold.description,
      correctiveAction: context.activeHold.correctiveAction ?? null,
      status: context.activeHold.status,
      previousLifecycleStatus: context.activeHold.previousLifecycleStatus ?? null,
      releaseRequestedByOpenId: context.activeHold.releaseRequestedByOpenId ?? null,
      releaseRequestedAt: context.activeHold.releaseRequestedAt ?? null,
      placedAt: context.activeHold.placedAt,
    } : null,
    permissions: {
      canExecuteCurrentAction: hasPermission(access.permissionKeys, phase.requiredPermissionKey),
      canPlaceHold: policy.safetyHoldEnabled === 1 && hasPermission(access.permissionKeys, "workflow.safety.hold"),
      canReleaseHold: hasPermission(access.permissionKeys, "workflow.safety.release"),
      canOverride: actor.role === "admin" && policy.allowAdminWorkflowOverride === 1,
      canManagePermit: hasPermission(access.permissionKeys, "workflow.record.permit"),
      canManageLoto: hasPermission(access.permissionKeys, "workflow.record.loto"),
      canRecordGasTest: hasPermission(access.permissionKeys, "workflow.record.gasTest"),
      canManageTorque: hasPermission(access.permissionKeys, "workflow.phase.installation.submit") || hasPermission(access.permissionKeys, "workflow.phase.reinstatement.submit") || hasPermission(access.permissionKeys, "workflow.phase.mechanical.verify") || hasPermission(access.permissionKeys, "workflow.phase.reinstatement.verify"),
      canSubmitInstallationTorque: hasPermission(access.permissionKeys, "workflow.phase.installation.submit"),
      canSubmitReinstatementTorque: hasPermission(access.permissionKeys, "workflow.phase.reinstatement.submit"),
      canVerifyInstallationTorque: hasPermission(access.permissionKeys, "workflow.phase.mechanical.verify"),
      canVerifyReinstatementTorque: hasPermission(access.permissionKeys, "workflow.phase.reinstatement.verify"),
      canManageLeakTest: hasPermission(access.permissionKeys, "workflow.record.leakTest"),
      canManagePackage: hasPermission(access.permissionKeys, "workflow.package.manage"),
      canPrepareEntry: hasPermission(access.permissionKeys, "workflow.entry.prepare"),
      canAuthorizeEntry: hasPermission(access.permissionKeys, "workflow.entry.authorize"),
      canRecordApproval: hasPermission(access.permissionKeys, "workflow.phase.final.approve") || hasPermission(access.permissionKeys, "workflow.phase.returnToService.authorize"),
      canManageEvidence: hasPermission(access.permissionKeys, "workflow.record.evidence"),
      canManageInspection: hasPermission(access.permissionKeys, "workflow.record.inspection"),
      canApproveInspection: hasPermission(access.permissionKeys, "workflow.inspection.approve"),
      canRecordDefect: hasPermission(access.permissionKeys, "workflow.quality.defect.record"),
      canReviewDefect: hasPermission(access.permissionKeys, "workflow.quality.defect.review"),
      canManagePunch: hasPermission(access.permissionKeys, "workflow.quality.punch.manage"),
      canVerifyPunch: hasPermission(access.permissionKeys, "workflow.quality.punch.verify"),
      canRecordNdt: hasPermission(access.permissionKeys, "workflow.quality.ndt.record"),
      canReviewNdt: hasPermission(access.permissionKeys, "workflow.quality.ndt.review"),
      canIssueCertificate: hasPermission(access.permissionKeys, "workflow.certificate.issue"),
      canReissueCertificate: hasPermission(access.permissionKeys, "workflow.certificate.reissue"),
      canRevokeCertificate: hasPermission(access.permissionKeys, "workflow.certificate.revoke"),
    },
  };
}

export async function updateWorkflowChecklistItem(input: {
  projectId: string;
  blindTag: string;
  phaseKey: CanonicalPhaseKey;
  itemKey: string;
  completed: boolean;
  response?: unknown;
}, actor: RuntimeActor) {
  await ensureBlindWorkflowRuntime(input.projectId, input.blindTag);
  const db = await requireDb();
  const runtimeRows = await db.select().from(blindWorkflowRuntime).where(eq(blindWorkflowRuntime.blindTag, input.blindTag)).limit(1);
  if (!runtimeRows[0] || runtimeRows[0].currentPhaseKey !== input.phaseKey) throw new Error("Checklist item does not belong to the current phase.");
  const phase = getCanonicalPhase(input.phaseKey);
  const access = await getWorkflowActorAccess(actor.openId, actor.role);
  if (!hasPermission(access.permissionKeys, phase.requiredPermissionKey)) throw new Error(`Permission ${phase.requiredPermissionKey} is required.`);
  if (input.phaseKey === "internalInspection") {
    const context = await loadGateContext(input.projectId, input.blindTag);
    const policy = await getWorkflowPolicySettings();
    if (policy.requireIsolationPackageForEntry === 1) {
      const now = new Date();
      const authorized = context.readinessRows.some((row) => row.status === "authorized" && (!row.validUntil || row.validUntil > now));
      if (!authorized) throw new Error("Vessel Entry Readiness must be authorized before inspection work can be recorded.");
    }
  }
  await db.update(blindChecklistResponses).set({
    completed: input.completed ? 1 : 0,
    responseJson: input.response === undefined ? null : JSON.stringify(input.response),
    completedByOpenId: input.completed ? actor.openId : null,
    completedAt: input.completed ? new Date() : null,
    updatedAt: new Date(),
  }).where(and(
    eq(blindChecklistResponses.blindTag, input.blindTag),
    eq(blindChecklistResponses.phaseKey, input.phaseKey),
    eq(blindChecklistResponses.itemKey, input.itemKey),
  ));
  const rows = await db.select().from(blindChecklistResponses).where(and(eq(blindChecklistResponses.blindTag, input.blindTag), eq(blindChecklistResponses.phaseKey, input.phaseKey)));
  const complete = allRequiredChecklistItemsComplete(rows.map((row) => ({ required: row.required === 1, completed: row.completed === 1 })));
  await db.update(blindPhaseInstances).set({ checklistComplete: complete ? 1 : 0, updatedAt: new Date() }).where(and(
    eq(blindPhaseInstances.blindTag, input.blindTag), eq(blindPhaseInstances.phaseKey, input.phaseKey),
  ));
  if (input.phaseKey === "internalInspection" && input.completed) {
    await db.update(blindWorkflowRuntime).set({ lifecycleStatus: "WORK_IN_PROGRESS", updatedAt: new Date() }).where(eq(blindWorkflowRuntime.blindTag, input.blindTag));
    await reconcileIsolationPackagesForBlind(input.blindTag);
  }
  return { success: true, checklistComplete: complete };
}

export async function transitionBlindWorkflow(input: {
  projectId: string;
  blindTag: string;
  actionKey: WorkflowActionKey;
  expectedRecordVersion: number;
  reason?: string | null;
  override?: boolean;
}, actor: RuntimeActor) {
  await ensureBlindWorkflowRuntime(input.projectId, input.blindTag);
  const db = await requireDb();
  const context = await loadGateContext(input.projectId, input.blindTag);
  const currentPhaseKey = parseCanonicalPhase(context.runtime.currentPhaseKey);
  const expectedPhase = workflowActionToPhase[input.actionKey];
  const policy = await getWorkflowPolicySettings();
  const reasons: WorkflowBlockingReason[] = [];
  if (expectedPhase !== currentPhaseKey) reasons.push({ code: "ACTION_PHASE_MISMATCH", message: `Action ${input.actionKey} is not valid for ${currentPhaseKey}.`, source: "workflow" });
  if (context.runtime.recordVersion !== input.expectedRecordVersion) reasons.push({ code: "STALE_RECORD_VERSION", message: "This record was updated by another user. Refresh before continuing.", source: "workflow" });
  const evaluated = await evaluateWorkflowGate(input.projectId, input.blindTag, actor);
  reasons.push(...evaluated.blockingReasons);

  const canOverride = input.override === true && actor.role === "admin" && policy.allowAdminWorkflowOverride === 1 && Boolean(input.reason?.trim());
  const nextPhaseKey = getNextCanonicalPhase(currentPhaseKey);
  const targetPhaseKey = nextPhaseKey ?? currentPhaseKey;
  const beforeVersion = context.runtime.recordVersion;

  if (reasons.length > 0 && !canOverride) {
    await db.insert(workflowTransitionEvents).values({
      blindTag: input.blindTag,
      projectId: input.projectId,
      fromPhaseKey: currentPhaseKey,
      toPhaseKey: targetPhaseKey,
      actionKey: input.actionKey,
      status: "rejected",
      blockingReasonsJson: JSON.stringify(reasons),
      gateSnapshotJson: JSON.stringify({ evaluatedAt: new Date().toISOString() }),
      reason: input.reason ?? null,
      actorOpenId: actor.openId,
      actorName: actor.name ?? actor.email ?? null,
      recordVersionBefore: beforeVersion,
      recordVersionAfter: beforeVersion,
    });
    await createNotification({
      recipientOpenId: actor.openId,
      actorOpenId: actor.openId,
      actorName: actor.name ?? actor.email ?? undefined,
      type: "workflow_gate_blocked",
      title: `Workflow action blocked · ${input.blindTag}`,
      body: reasons.map((reason) => reason.message).join("\n"),
      linkUrl: `/projects/${encodeURIComponent(input.projectId)}/blinds/${encodeURIComponent(input.blindTag)}`,
      projectId: input.projectId,
      blindTag: input.blindTag,
    }).catch(() => undefined);
    return { success: false as const, blockingReasons: reasons, recordVersion: beforeVersion };
  }

  const afterVersion = beforeVersion + 1;
  const completedLifecycle = lifecycleAfterPhaseCompletion[currentPhaseKey];
  const final = nextPhaseKey === null;
  const newLifecycle = final ? "CLOSED" : lifecycleWhilePhaseCurrent[nextPhaseKey];
  const compatibilityPhase = legacyCompatibilityPhase[nextPhaseKey ?? currentPhaseKey];
  const now = new Date();

  await db.transaction(async (tx) => {
    await tx.update(blindPhaseInstances).set({
      status: "completed",
      completedAt: now,
      completedByOpenId: actor.openId,
      approvedByOpenId: actor.openId,
      gateSnapshotJson: JSON.stringify({ ready: reasons.length === 0, override: canOverride, lifecycleAfterCompletion: completedLifecycle }),
      recordVersion: sql`${blindPhaseInstances.recordVersion} + 1`,
      updatedAt: now,
    }).where(and(eq(blindPhaseInstances.blindTag, input.blindTag), eq(blindPhaseInstances.phaseKey, currentPhaseKey)));

    if (nextPhaseKey) {
      await tx.update(blindPhaseInstances).set({
        status: "current",
        startedAt: now,
        recordVersion: sql`${blindPhaseInstances.recordVersion} + 1`,
        updatedAt: now,
      }).where(and(eq(blindPhaseInstances.blindTag, input.blindTag), eq(blindPhaseInstances.phaseKey, nextPhaseKey)));
    }

    const runtimeUpdateResult = await tx.update(blindWorkflowRuntime).set({
      currentPhaseKey: nextPhaseKey ?? currentPhaseKey,
      lifecycleStatus: newLifecycle,
      recordVersion: afterVersion,
      isLocked: final ? 1 : 0,
      lockedAt: final ? now : null,
      lockedByOpenId: final ? actor.openId : null,
      lastTransitionAt: now,
      updatedAt: now,
    }).where(and(eq(blindWorkflowRuntime.blindTag, input.blindTag), eq(blindWorkflowRuntime.recordVersion, beforeVersion)));
    const updateMeta = Array.isArray(runtimeUpdateResult) ? runtimeUpdateResult[0] : runtimeUpdateResult;
    if (typeof (updateMeta as { affectedRows?: number })?.affectedRows === "number" && (updateMeta as { affectedRows: number }).affectedRows === 0) {
      throw new Error("STALE_RECORD_VERSION: Workflow was updated by another user.");
    }

    await tx.update(blinds).set({ phase: compatibilityPhase, updatedAt: now }).where(eq(blinds.tag, input.blindTag));

    await tx.insert(workflowTransitionEvents).values({
      blindTag: input.blindTag,
      projectId: input.projectId,
      fromPhaseKey: currentPhaseKey,
      toPhaseKey: targetPhaseKey,
      actionKey: input.actionKey,
      status: canOverride ? "override" : "accepted",
      blockingReasonsJson: reasons.length ? JSON.stringify(reasons) : null,
      gateSnapshotJson: JSON.stringify({ evaluatedAt: now.toISOString(), completedLifecycle, newLifecycle }),
      reason: input.reason ?? null,
      actorOpenId: actor.openId,
      actorName: actor.name ?? actor.email ?? null,
      recordVersionBefore: beforeVersion,
      recordVersionAfter: afterVersion,
    });

    await tx.insert(blindWorkflowLogs).values({
      blindTag: input.blindTag,
      projectId: input.projectId,
      phase: compatibilityPhase,
      action: getCanonicalPhase(currentPhaseKey).actionLabel,
      message: final
        ? `Canonical workflow completed and locked by ${actor.name ?? actor.email ?? actor.openId}.`
        : `Canonical workflow advanced from ${getCanonicalPhase(currentPhaseKey).label} to ${getCanonicalPhase(nextPhaseKey!).label}.`,
      actorOpenId: actor.openId,
      actorName: actor.name ?? actor.email ?? null,
      createdAt: now,
    });
  });

  await reconcileIsolationPackagesForBlind(input.blindTag);

  const notificationRoles = nextPhaseKey ? [getCanonicalPhase(nextPhaseKey).ownerRoleKey] : ["coordinator", "operationsForeman"];
  await notifyWorkflowRoles(notificationRoles, {
    type: "workflow_transition",
    title: final ? `Workflow completed · ${input.blindTag}` : `Action required · ${getCanonicalPhase(nextPhaseKey!).shortLabel}`,
    body: final
      ? `${input.blindTag} completed the canonical workflow and the runtime record is locked.`
      : `${input.blindTag} advanced to ${getCanonicalPhase(nextPhaseKey!).label}.`,
    projectId: input.projectId,
    blindTag: input.blindTag,
    actor,
  }).catch(() => undefined);

  return { success: true as const, currentPhaseKey: nextPhaseKey ?? currentPhaseKey, lifecycleStatus: newLifecycle, recordVersion: afterVersion, overridden: canOverride };
}

export async function placeWorkflowSafetyHold(input: {
  projectId: string;
  blindTag: string;
  reasonCode: string;
  description: string;
}, actor: RuntimeActor) {
  await ensureBlindWorkflowRuntime(input.projectId, input.blindTag);
  const db = await requireDb();
  const policy = await getWorkflowPolicySettings();
  if (policy.safetyHoldEnabled !== 1) throw new Error("Safety Hold is disabled by system policy.");
  const access = await getWorkflowActorAccess(actor.openId, actor.role);
  if (!hasPermission(access.permissionKeys, "workflow.safety.hold")) throw new Error("Permission workflow.safety.hold is required.");
  const runtimeRows = await db.select().from(blindWorkflowRuntime).where(eq(blindWorkflowRuntime.blindTag, input.blindTag)).limit(1);
  if (!runtimeRows[0]) throw new Error("Workflow runtime was not found.");
  if (runtimeRows[0].isLocked === 1) throw new Error("A locked/closed workflow cannot be placed on Safety Hold. Start a new controlled work record instead.");
  const phaseKey = parseCanonicalPhase(runtimeRows[0].currentPhaseKey);
  const existing = await db.select().from(safetyHolds).where(and(eq(safetyHolds.blindTag, input.blindTag), inArray(safetyHolds.status, ["active", "release_pending"]))).limit(1);
  if (existing[0]) return existing[0];
  const now = new Date();
  let insertedId: number | undefined;
  await db.transaction(async (tx) => {
    const inserted = await tx.insert(safetyHolds).values({
      blindTag: input.blindTag,
      projectId: input.projectId,
      phaseKey,
      status: "active",
      reasonCode: input.reasonCode,
      description: input.description,
      previousLifecycleStatus: runtimeRows[0].lifecycleStatus,
      placedByOpenId: actor.openId,
    }).$returningId();
    insertedId = inserted[0]?.id;
    await tx.update(blindWorkflowRuntime).set({
      lifecycleStatus: "SAFETY_HOLD",
      recordVersion: sql`${blindWorkflowRuntime.recordVersion} + 1`,
      lastTransitionAt: now,
      updatedAt: now,
    }).where(eq(blindWorkflowRuntime.blindTag, input.blindTag));
    await tx.insert(blindWorkflowLogs).values({
      blindTag: input.blindTag,
      projectId: input.projectId,
      phase: legacyCompatibilityPhase[phaseKey],
      action: "Safety Hold / Stop Work",
      message: `${input.reasonCode}: ${input.description}`,
      actorOpenId: actor.openId,
      actorName: actor.name ?? actor.email ?? null,
      createdAt: now,
    });
  });
  await reconcileIsolationPackagesForBlind(input.blindTag);
  await notifyWorkflowRoles(["operations", "safety", "coordinator", getCanonicalPhase(phaseKey).ownerRoleKey], {
    type: "safety_hold_placed",
    title: `SAFETY HOLD · ${input.blindTag}`,
    body: `${input.reasonCode}: ${input.description}`,
    projectId: input.projectId,
    blindTag: input.blindTag,
    actor,
  }).catch(() => undefined);
  return { id: insertedId, status: "active" as const };
}

export async function releaseWorkflowSafetyHold(input: {
  projectId: string;
  blindTag: string;
  holdId: number;
  correctiveAction: string;
}, actor: RuntimeActor) {
  const db = await requireDb();
  const policy = await getWorkflowPolicySettings();
  const access = await getWorkflowActorAccess(actor.openId, actor.role);
  if (!hasPermission(access.permissionKeys, "workflow.safety.release")) throw new Error("Permission workflow.safety.release is required.");
  const holds = await db.select().from(safetyHolds).where(and(eq(safetyHolds.id, input.holdId), eq(safetyHolds.blindTag, input.blindTag))).limit(1);
  const hold = holds[0];
  if (!hold || !["active", "release_pending"].includes(hold.status)) throw new Error("Active Safety Hold was not found.");

  const now = new Date();
  const requiresIndependentApproval = policy.holdReleaseRequiresIndependentApproval === 1;
  if (requiresIndependentApproval && hold.status === "active") {
    await db.update(safetyHolds).set({
      status: "release_pending",
      correctiveAction: input.correctiveAction,
      releaseRequestedByOpenId: actor.openId,
      releaseRequestedAt: now,
      releasedByOpenId: actor.openId,
      updatedAt: now,
    }).where(eq(safetyHolds.id, input.holdId));
    await notifyWorkflowRoles(["safety", "mechanicalVerifier", "operations"], {
      type: "workflow_approval_required",
      title: `Safety Hold release approval · ${input.blindTag}`,
      body: `Corrective action has been submitted and requires an independent release approval.`,
      projectId: input.projectId,
      blindTag: input.blindTag,
      actor,
    }).catch(() => undefined);
    return { success: false as const, pendingIndependentApproval: true };
  }

  if (requiresIndependentApproval && hold.status === "release_pending") {
    const requesterOpenId = hold.releaseRequestedByOpenId ?? hold.releasedByOpenId;
    if (hold.placedByOpenId === actor.openId || requesterOpenId === actor.openId) {
      throw new Error("Independent Safety Hold release approval must be completed by a different authorized person.");
    }
  }

  const runtimeRows = await db.select().from(blindWorkflowRuntime).where(eq(blindWorkflowRuntime.blindTag, input.blindTag)).limit(1);
  if (!runtimeRows[0]) throw new Error("Workflow runtime was not found.");
  const phaseKey = parseCanonicalPhase(runtimeRows[0].currentPhaseKey);
  const previousLifecycle = hold.previousLifecycleStatus
    && workflowLifecycleStates.includes(hold.previousLifecycleStatus as WorkflowLifecycleState)
    && hold.previousLifecycleStatus !== "SAFETY_HOLD"
    ? hold.previousLifecycleStatus as WorkflowLifecycleState
    : lifecycleWhilePhaseCurrent[phaseKey];
  await db.transaction(async (tx) => {
    await tx.update(safetyHolds).set({
      status: "released",
      correctiveAction: hold.correctiveAction ?? input.correctiveAction,
      releasedByOpenId: hold.releaseRequestedByOpenId ?? hold.releasedByOpenId ?? actor.openId,
      releaseApprovedByOpenId: actor.openId,
      releasedAt: now,
      updatedAt: now,
    }).where(eq(safetyHolds.id, input.holdId));
    await tx.update(blindWorkflowRuntime).set({
      lifecycleStatus: previousLifecycle,
      recordVersion: sql`${blindWorkflowRuntime.recordVersion} + 1`,
      lastTransitionAt: now,
      updatedAt: now,
    }).where(eq(blindWorkflowRuntime.blindTag, input.blindTag));
    await tx.insert(blindWorkflowLogs).values({
      blindTag: input.blindTag,
      projectId: input.projectId,
      phase: legacyCompatibilityPhase[phaseKey],
      action: "Safety Hold Released",
      message: input.correctiveAction,
      actorOpenId: actor.openId,
      actorName: actor.name ?? actor.email ?? null,
      createdAt: now,
    });
  });
  await reconcileIsolationPackagesForBlind(input.blindTag);
  await notifyWorkflowRoles(["operations", "safety", "coordinator", getCanonicalPhase(phaseKey).ownerRoleKey], {
    type: "safety_hold_released",
    title: `Safety Hold released · ${input.blindTag}`,
    body: input.correctiveAction,
    projectId: input.projectId,
    blindTag: input.blindTag,
    actor,
  }).catch(() => undefined);
  return { success: true as const, pendingIndependentApproval: false };
}

export async function recordWorkflowApproval(input: {
  projectId: string;
  blindTag: string;
  roleKey: string;
  approved: boolean;
  note?: string | null;
}, actor: RuntimeActor) {
  await ensureBlindWorkflowRuntime(input.projectId, input.blindTag);
  const db = await requireDb();
  const policy = await getWorkflowPolicySettings();
  const runtimeRows = await db.select().from(blindWorkflowRuntime).where(eq(blindWorkflowRuntime.blindTag, input.blindTag)).limit(1);
  if (!runtimeRows[0] || runtimeRows[0].currentPhaseKey !== "finalApprovalReturnToService") {
    throw new Error("Final approvals can only be recorded during the Final Approval & Return to Service phase.");
  }
  const access = await getWorkflowActorAccess(actor.openId, actor.role);
  if (actor.role !== "admin" && !access.roleKeys.includes(input.roleKey)) throw new Error(`Actor must hold role ${input.roleKey} to complete this approval.`);
  const rows = await db.select().from(workflowApprovalSteps).where(and(eq(workflowApprovalSteps.blindTag, input.blindTag), eq(workflowApprovalSteps.approvalRoleKey, input.roleKey))).limit(1);
  const step = rows[0];
  if (!step) throw new Error("Approval step was not found.");
  if (policy.requireSequentialFinalApprovals === 1) {
    const prior = await db.select().from(workflowApprovalSteps).where(and(eq(workflowApprovalSteps.blindTag, input.blindTag), sql`${workflowApprovalSteps.sequence} < ${step.sequence}`));
    if (prior.some((row) => row.status !== "approved" && row.status !== "not_required")) throw new Error("Previous approval steps must be completed first.");
  }
  await db.update(workflowApprovalSteps).set({
    status: input.approved ? "approved" : "rejected",
    approvedByOpenId: actor.openId,
    approvedByName: actor.name ?? actor.email ?? actor.openId,
    note: input.note ?? null,
    approvedAt: input.approved ? new Date() : null,
    revokedAt: null,
    updatedAt: new Date(),
  }).where(eq(workflowApprovalSteps.id, step.id));
  if (input.approved) {
    const nextSteps = await db.select().from(workflowApprovalSteps).where(eq(workflowApprovalSteps.blindTag, input.blindTag)).orderBy(workflowApprovalSteps.sequence);
    const next = nextSteps.find((row) => row.status === "pending");
    if (next) {
      await notifyWorkflowRoles([next.approvalRoleKey], {
        type: "workflow_approval_required",
        title: `Final approval required · ${input.blindTag}`,
        body: `The ${next.approvalRoleKey} approval step is ready for action.`,
        projectId: input.projectId,
        blindTag: input.blindTag,
        actor,
      }).catch(() => undefined);
    }
  }
  return { success: true };
}
