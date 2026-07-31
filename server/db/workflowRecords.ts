import { and, desc, eq, inArray } from "drizzle-orm";
import {
  blindPhaseInstances,
  blindWorkflowLogs,
  blindWorkflowRuntime,
  blinds,
  entryReadinessRecords,
  gasTestRecords,
  isolationPackageBlinds,
  isolationPackages,
  leakTestRecords,
  lotoRecords,
  permitRecords,
  torqueRecords,
  workflowEvidenceAttachments,
} from "../../drizzle/schema";
import { getWorkflowPolicySettings } from "./settings";
import { requireDb } from "./core";
import {
  assertAnyWorkflowPermission,
  ensureBlindWorkflowRuntime,
  getWorkflowActorAccess,
} from "./workflowRuntime";
import type { ActingProjectUser } from "./types";
import { storageDelete, storageKeyFromUrl } from "../storage";
import { evaluateGasTestAcceptance } from "./gasTestPolicy";


async function appendWorkflowRecordAudit(
  db: Awaited<ReturnType<typeof requireDb>>,
  input: { projectId: string; blindTag: string },
  actor: ActingProjectUser,
  action: string,
  message: string,
) {
  const blindRows = await db.select({ phase: blinds.phase }).from(blinds).where(and(
    eq(blinds.tag, input.blindTag),
    eq(blinds.projectId, input.projectId),
  )).limit(1);
  if (!blindRows[0]) return;
  await db.insert(blindWorkflowLogs).values({
    blindTag: input.blindTag,
    projectId: input.projectId,
    phase: blindRows[0].phase,
    action,
    message,
    actorOpenId: actor.openId,
    actorName: actor.name ?? actor.email ?? actor.openId,
  });
}

export async function createOrUpdatePermitRecord(input: {
  id?: number;
  projectId: string;
  blindTag: string;
  permitType: string;
  permitNumber: string;
  status: "draft" | "active" | "valid" | "expired" | "closed" | "cancelled" | "rejected";
  validFrom?: Date | null;
  validUntil?: Date | null;
  notes?: string | null;
}, actor: ActingProjectUser) {
  await assertAnyWorkflowPermission(actor, ["workflow.record.permit"]);
  await ensureBlindWorkflowRuntime(input.projectId, input.blindTag);
  const db = await requireDb();
  const values = {
    blindTag: input.blindTag,
    projectId: input.projectId,
    permitType: input.permitType,
    permitNumber: input.permitNumber,
    status: input.status,
    validFrom: input.validFrom ?? null,
    validUntil: input.validUntil ?? null,
    issuedByOpenId: actor.openId,
    notes: input.notes ?? null,
    updatedAt: new Date(),
  };
  if (input.id) {
    await db.update(permitRecords).set(values).where(and(eq(permitRecords.id, input.id), eq(permitRecords.blindTag, input.blindTag)));
    await appendWorkflowRecordAudit(db, input, actor, "Permit Record Updated", `${input.permitType} ${input.permitNumber} updated with status ${input.status}.`);
    return { id: input.id };
  }
  const result = await db.insert(permitRecords).values(values).$returningId();
  await appendWorkflowRecordAudit(db, input, actor, "Permit Record Created", `${input.permitType} ${input.permitNumber} recorded with status ${input.status}.`);
  return { id: result[0]?.id };
}

export async function createOrUpdateLotoRecord(input: {
  id?: number;
  projectId: string;
  blindTag: string;
  certificateNumber: string;
  status: "draft" | "active" | "valid" | "expired" | "closed" | "cancelled" | "rejected";
  lockNumbers: string[];
  zeroEnergyVerified: boolean;
  releasedAt?: Date | null;
  notes?: string | null;
}, actor: ActingProjectUser) {
  await assertAnyWorkflowPermission(actor, ["workflow.record.loto"]);
  await ensureBlindWorkflowRuntime(input.projectId, input.blindTag);
  const db = await requireDb();
  const existingRows = input.id
    ? await db.select().from(lotoRecords).where(and(
        eq(lotoRecords.id, input.id),
        eq(lotoRecords.blindTag, input.blindTag),
        eq(lotoRecords.projectId, input.projectId),
      )).limit(1)
    : [];
  const existing = existingRows[0];
  if (input.id && !existing) throw new Error("LOTO record was not found in this project.");
  if (input.zeroEnergyVerified && !existing) {
    throw new Error("Create the LOTO application first; zero-energy verification requires a second user.");
  }
  if (input.zeroEnergyVerified && existing?.appliedByOpenId === actor.openId) {
    throw new Error("The user who applied LOTO cannot independently verify zero energy.");
  }
  const values = {
    blindTag: input.blindTag,
    projectId: input.projectId,
    certificateNumber: input.certificateNumber,
    status: input.status,
    lockNumbersJson: JSON.stringify(input.lockNumbers),
    zeroEnergyVerified: input.zeroEnergyVerified ? 1 : 0,
    appliedByOpenId: existing?.appliedByOpenId ?? actor.openId,
    verifiedByOpenId: input.zeroEnergyVerified ? actor.openId : null,
    appliedAt: input.status === "active" || input.status === "valid"
      ? (existing?.appliedAt ?? new Date())
      : existing?.appliedAt ?? null,
    releasedAt: input.releasedAt ?? (input.status === "closed" ? new Date() : null),
    notes: input.notes ?? null,
    updatedAt: new Date(),
  };
  if (input.id) {
    await db.update(lotoRecords).set(values).where(and(
      eq(lotoRecords.id, input.id),
      eq(lotoRecords.blindTag, input.blindTag),
      eq(lotoRecords.projectId, input.projectId),
    ));
    await appendWorkflowRecordAudit(db, input, actor, "LOTO Record Updated", `LOTO ${input.certificateNumber} updated with status ${input.status}; zero-energy verified: ${input.zeroEnergyVerified ? "yes" : "no"}.`);
    return { id: input.id };
  }
  const result = await db.insert(lotoRecords).values(values).$returningId();
  await appendWorkflowRecordAudit(db, input, actor, "LOTO Record Created", `LOTO ${input.certificateNumber} recorded with status ${input.status}; zero-energy verified: ${input.zeroEnergyVerified ? "yes" : "no"}.`);
  return { id: result[0]?.id };
}

export async function createGasTestRecord(input: {
  projectId: string;
  blindTag: string;
  testPurpose: "lineBreaking" | "entry" | "deblinding" | "other";
  status: "draft" | "active" | "valid" | "expired" | "closed" | "cancelled" | "rejected";
  oxygenPercent?: number | null;
  lelPercent?: number | null;
  h2sPpm?: number | null;
  coPpm?: number | null;
  instrumentId?: string | null;
  calibrationExpiry?: Date | null;
  testedAt?: Date | null;
  validUntil?: Date | null;
  notes?: string | null;
}, actor: ActingProjectUser) {
  await ensureBlindWorkflowRuntime(input.projectId, input.blindTag);
  const policy = await getWorkflowPolicySettings();
  await assertAnyWorkflowPermission(actor, ["workflow.record.gasTest"]);
  const access = await getWorkflowActorAccess(actor.openId, actor.role);
  if (actor.role !== "admin" && !access.roleKeys.includes(policy.authorizedGasTesterRoleKey)) {
    throw new Error(`The configured Authorized Gas Tester role (${policy.authorizedGasTesterRoleKey}) is required.`);
  }

  const testedAt = input.testedAt ?? new Date();
  const validUntil = input.validUntil ?? new Date(testedAt.getTime() + policy.defaultGasTestValidityMinutes * 60_000);
  const isValidRecord = input.status === "active" || input.status === "valid";
  if (validUntil.getTime() <= testedAt.getTime()) {
    throw new Error("Gas-test validity must end after the test time.");
  }
  if (isValidRecord && (input.oxygenPercent == null || input.lelPercent == null)) {
    throw new Error("Oxygen and LEL readings are required before a gas test can be marked active or valid.");
  }
  if (policy.gasTestRequiresInstrumentCalibration === 1 && isValidRecord) {
    if (!input.instrumentId?.trim()) throw new Error("A gas-test instrument ID is required.");
    if (!input.calibrationExpiry || input.calibrationExpiry.getTime() <= testedAt.getTime()) {
      throw new Error("A valid, non-expired gas-test instrument calibration is required.");
    }
  }
  if (isValidRecord) {
    const acceptance = evaluateGasTestAcceptance({
      oxygenPercent: input.oxygenPercent,
      lelPercent: input.lelPercent,
      h2sPpm: input.h2sPpm,
      coPpm: input.coPpm,
    }, policy);
    if (!acceptance.acceptable) {
      throw new Error(`Gas test cannot be marked active or valid: ${acceptance.reasons.join(" ")}`);
    }
  }

  const db = await requireDb();
  const result = await db.insert(gasTestRecords).values({
    blindTag: input.blindTag,
    projectId: input.projectId,
    testPurpose: input.testPurpose,
    status: input.status,
    oxygenPercent: input.oxygenPercent == null ? null : String(input.oxygenPercent),
    lelPercent: input.lelPercent == null ? null : String(input.lelPercent),
    h2sPpm: input.h2sPpm == null ? null : String(input.h2sPpm),
    coPpm: input.coPpm == null ? null : String(input.coPpm),
    testerOpenId: actor.openId,
    testerName: actor.name ?? actor.email ?? actor.openId,
    instrumentId: input.instrumentId ?? null,
    calibrationExpiry: input.calibrationExpiry ?? null,
    testedAt,
    validUntil,
    notes: input.notes ?? null,
  }).$returningId();
  await appendWorkflowRecordAudit(db, input, actor, "Gas Test Recorded", `${input.testPurpose} gas test recorded with status ${input.status}; valid until ${validUntil.toISOString()}.`);
  return { id: result[0]?.id, validUntil };
}

export async function createOrUpdateTorqueRecord(input: {
  id?: number;
  projectId: string;
  blindTag: string;
  stage: "installation" | "reinstatement";
  status: "draft" | "submitted" | "accepted" | "rejected";
  procedureReference?: string | null;
  toolType: string;
  toolSerialNumber?: string | null;
  calibrationCertificateNumber?: string | null;
  calibrationExpiry?: Date | null;
  targetTorque?: number | null;
  actualTorque?: number | null;
  torqueUnit: string;
  pumpPressure?: number | null;
  pumpPressureUnit?: string | null;
  passes?: unknown[];
  witnessOpenId?: string | null;
  notes?: string | null;
}, actor: ActingProjectUser) {
  await ensureBlindWorkflowRuntime(input.projectId, input.blindTag);
  const executionPermission = input.stage === "installation"
    ? "workflow.phase.installation.submit"
    : "workflow.phase.reinstatement.submit";
  const verificationPermission = input.stage === "installation"
    ? "workflow.phase.mechanical.verify"
    : "workflow.phase.reinstatement.verify";
  const isVerificationDecision = input.status === "accepted" || input.status === "rejected";
  await assertAnyWorkflowPermission(actor, [isVerificationDecision ? verificationPermission : executionPermission]);
  const db = await requireDb();
  const existingRows = input.id
    ? await db.select().from(torqueRecords).where(and(eq(torqueRecords.id, input.id), eq(torqueRecords.blindTag, input.blindTag))).limit(1)
    : await db.select().from(torqueRecords).where(and(eq(torqueRecords.blindTag, input.blindTag), eq(torqueRecords.stage, input.stage))).limit(1);
  const existing = existingRows[0];
  if (isVerificationDecision && !existing) {
    throw new Error("Torque verification requires an existing submitted torque record.");
  }
  if (isVerificationDecision && existing && existing.status === "draft") {
    throw new Error("A draft torque record must be submitted before it can be accepted or rejected.");
  }
  if (existing && existing.stage !== input.stage) {
    throw new Error("Torque stage cannot be changed after the record is created.");
  }
  if (isVerificationDecision && existing?.technicianOpenId === actor.openId) {
    throw new Error("The torque technician cannot accept or reject their own torque record.");
  }
  const executionValues: typeof torqueRecords.$inferInsert = {
    blindTag: input.blindTag,
    projectId: input.projectId,
    stage: input.stage,
    status: input.status,
    procedureReference: input.procedureReference ?? null,
    toolType: input.toolType,
    toolSerialNumber: input.toolSerialNumber ?? null,
    calibrationCertificateNumber: input.calibrationCertificateNumber ?? null,
    calibrationExpiry: input.calibrationExpiry ?? null,
    targetTorque: input.targetTorque == null ? null : String(input.targetTorque),
    actualTorque: input.actualTorque == null ? null : String(input.actualTorque),
    torqueUnit: input.torqueUnit,
    pumpPressure: input.pumpPressure == null ? null : String(input.pumpPressure),
    pumpPressureUnit: input.pumpPressureUnit ?? null,
    passesJson: JSON.stringify(input.passes ?? []),
    technicianOpenId: existing?.technicianOpenId ?? actor.openId,
    witnessOpenId: input.witnessOpenId ?? existing?.witnessOpenId ?? null,
    completedAt: input.status === "submitted" ? (existing?.completedAt ?? new Date()) : existing?.completedAt ?? null,
    notes: input.notes ?? null,
    updatedAt: new Date(),
  };
  const verificationValues: Partial<typeof torqueRecords.$inferInsert> = {
    status: input.status,
    acceptedByOpenId: actor.openId,
    acceptedAt: input.status === "accepted" ? new Date() : null,
    notes: input.notes ?? existing?.notes ?? null,
    updatedAt: new Date(),
  };
  const values = isVerificationDecision ? verificationValues : executionValues;
  if (existing) {
    await db.update(torqueRecords).set(values).where(eq(torqueRecords.id, existing.id));
    await appendWorkflowRecordAudit(db, input, actor, isVerificationDecision ? "Torque Verification Recorded" : "Torque Record Updated", `${input.stage} torque record updated with status ${input.status}.`);
    return { id: existing.id };
  }
  const result = await db.insert(torqueRecords).values(executionValues).$returningId();
  await appendWorkflowRecordAudit(db, input, actor, "Torque Record Created", `${input.stage} torque record created with status ${input.status}.`);
  return { id: result[0]?.id };
}

export async function createOrUpdateLeakTestRecord(input: {
  projectId: string;
  blindTag: string;
  status: "draft" | "in_progress" | "passed" | "failed" | "cancelled";
  testType?: string | null;
  testMedium?: string | null;
  testPressure?: number | null;
  pressureUnit?: string | null;
  durationMinutes?: number | null;
  noLeakObserved: boolean;
  notes?: string | null;
}, actor: ActingProjectUser) {
  await assertAnyWorkflowPermission(actor, ["workflow.record.leakTest"]);
  await ensureBlindWorkflowRuntime(input.projectId, input.blindTag);
  const db = await requireDb();
  const existingRows = await db
    .select()
    .from(leakTestRecords)
    .where(and(
      eq(leakTestRecords.blindTag, input.blindTag),
      eq(leakTestRecords.projectId, input.projectId),
    ))
    .limit(1);
  const existing = existingRows[0];
  if (input.status === "passed" && !existing) {
    throw new Error("Record the leak test first; acceptance requires a second user.");
  }
  if (input.status === "passed" && existing?.performedByOpenId === actor.openId) {
    throw new Error("The leak-test performer cannot accept their own test.");
  }
  if (input.status === "passed" && !input.noLeakObserved) {
    throw new Error("A leak test cannot pass while leakage is recorded.");
  }
  const values = {
    blindTag: input.blindTag,
    projectId: input.projectId,
    status: input.status,
    testType: input.testType ?? null,
    testMedium: input.testMedium ?? null,
    testPressure: input.testPressure == null ? null : String(input.testPressure),
    pressureUnit: input.pressureUnit ?? null,
    durationMinutes: input.durationMinutes ?? null,
    noLeakObserved: input.noLeakObserved ? 1 : 0,
    performedByOpenId: existing?.performedByOpenId ?? actor.openId,
    acceptedByOpenId: input.status === "passed" ? actor.openId : null,
    testedAt: existing?.testedAt ?? new Date(),
    acceptedAt: input.status === "passed" ? new Date() : null,
    notes: input.notes ?? null,
    updatedAt: new Date(),
  };
  if (existing) {
    await db.update(leakTestRecords).set(values).where(eq(leakTestRecords.id, existing.id));
    await appendWorkflowRecordAudit(db, input, actor, "Leak Test Updated", `Leak/service test updated with status ${input.status}; no leak observed: ${input.noLeakObserved ? "yes" : "no"}.`);
    return { id: existing.id };
  }
  const result = await db.insert(leakTestRecords).values(values).$returningId();
  await appendWorkflowRecordAudit(db, input, actor, "Leak Test Created", `Leak/service test recorded with status ${input.status}; no leak observed: ${input.noLeakObserved ? "yes" : "no"}.`);
  return { id: result[0]?.id };
}

export async function createIsolationPackage(input: {
  id?: string | null;
  projectId: string;
  equipment: string;
  description?: string | null;
  blindTags: string[];
}, actor: ActingProjectUser) {
  await assertAnyWorkflowPermission(actor, ["workflow.package.manage"]);
  const db = await requireDb();
  const policy = await getWorkflowPolicySettings();
  const configuredPrefix = policy.isolationPackageIdPrefix.trim().toUpperCase();
  const packageId = input.id?.trim() || `${configuredPrefix || "VIP"}-${input.projectId}-${Date.now().toString(36).toUpperCase()}`;
  if (configuredPrefix && !packageId.toUpperCase().startsWith(`${configuredPrefix}-`)) {
    throw new Error(`Isolation Package ID must start with ${configuredPrefix}-.`);
  }
  const uniqueTags = Array.from(new Set(input.blindTags));
  if (uniqueTags.length === 0) throw new Error("Isolation Package requires at least one blind.");
  const blindRows = await db.select({ tag: blinds.tag, projectId: blinds.projectId }).from(blinds).where(inArray(blinds.tag, uniqueTags));
  if (blindRows.length !== uniqueTags.length || blindRows.some((row) => row.projectId !== input.projectId)) {
    throw new Error("Every linked blind must exist in the selected project.");
  }
  for (const blindTag of uniqueTags) await ensureBlindWorkflowRuntime(input.projectId, blindTag);
  const existingMemberships = await db
    .select({ blindTag: isolationPackageBlinds.blindTag, packageId: isolationPackageBlinds.packageId, packageStatus: isolationPackages.status })
    .from(isolationPackageBlinds)
    .innerJoin(isolationPackages, eq(isolationPackages.id, isolationPackageBlinds.packageId))
    .where(inArray(isolationPackageBlinds.blindTag, uniqueTags));
  if (policy.preventBlindInMultipleActivePackages === 1) {
    const activeConflict = existingMemberships.find((row) => !["closed"].includes(row.packageStatus));
    if (activeConflict) throw new Error(`Blind ${activeConflict.blindTag} is already linked to active package ${activeConflict.packageId}.`);
  }
  await db.transaction(async (tx) => {
    await tx.insert(isolationPackages).values({
      id: packageId,
      projectId: input.projectId,
      equipment: input.equipment,
      description: input.description ?? null,
      status: "active",
      createdByOpenId: actor.openId,
    });
    await tx.insert(isolationPackageBlinds).values(uniqueTags.map((blindTag) => ({ packageId, blindTag, required: 1 })));
  });
  for (const blindTag of uniqueTags) {
    await appendWorkflowRecordAudit(db, { projectId: input.projectId, blindTag }, actor, "Isolation Package Linked", `Blind linked to Isolation Package ${packageId} for ${input.equipment}.`);
  }
  return { id: packageId };
}

export async function upsertEntryReadinessRecord(input: {
  packageId: string;
  status: "draft" | "ready" | "authorized" | "rejected" | "expired";
  pressureZero: boolean;
  drainedAndPurged: boolean;
  confinedSpacePermitValid: boolean;
  operationsApproved: boolean;
  entrySupervisorApproved: boolean;
  validUntil?: Date | null;
}, actor: ActingProjectUser) {
  const db = await requireDb();
  const policy = await getWorkflowPolicySettings();
  const access = await getWorkflowActorAccess(actor.openId, actor.role);
  const isAdmin = actor.role === "admin";
  const canPrepare = isAdmin || access.permissionKeys.includes("workflow.entry.prepare");
  const canAuthorize = isAdmin || access.permissionKeys.includes("workflow.entry.authorize");
  if (!canPrepare && !canAuthorize) {
    throw new Error("Permission workflow.entry.prepare or workflow.entry.authorize is required.");
  }
  const packageRows = await db.select().from(isolationPackages).where(eq(isolationPackages.id, input.packageId)).limit(1);
  const packageRow = packageRows[0];
  if (!packageRow) throw new Error("Isolation Package was not found.");
  const memberships = await db.select().from(isolationPackageBlinds).where(eq(isolationPackageBlinds.packageId, input.packageId));
  if (memberships.length === 0) throw new Error("Isolation Package has no linked blinds.");
  const requiredTags = memberships.filter((row) => row.required === 1).map((row) => row.blindTag);
  const runtimes = await db.select().from(blindWorkflowRuntime).where(inArray(blindWorkflowRuntime.blindTag, requiredTags));
  const activeLifecycle = new Set(["ACTIVE_ISOLATION", "ENTRY_AUTHORIZED", "WORK_IN_PROGRESS", "READY_FOR_CLOSURE"]);
  const allRequiredBlindsActive = requiredTags.length > 0 && requiredTags.every((tag) => {
    const runtime = runtimes.find((row) => row.blindTag === tag);
    return Boolean(runtime && activeLifecycle.has(runtime.lifecycleStatus));
  });
  const lotoRows = await db.select().from(lotoRecords).where(inArray(lotoRecords.blindTag, requiredTags)).orderBy(desc(lotoRecords.createdAt));
  const lotoActive = requiredTags.every((tag) => lotoRows.some((row) => row.blindTag === tag && ["active", "valid"].includes(row.status) && row.zeroEnergyVerified === 1));
  const gasRows = await db.select().from(gasTestRecords).where(and(inArray(gasTestRecords.blindTag, requiredTags), eq(gasTestRecords.testPurpose, "entry"))).orderBy(desc(gasTestRecords.testedAt));
  const now = new Date();
  const gasTestAcceptable = policy.requireGasTestForEntry !== 1 || requiredTags.every((tag) => gasRows.some((row) => {
    const acceptance = evaluateGasTestAcceptance(row, policy);
    return row.blindTag === tag
      && ["active", "valid"].includes(row.status)
      && Boolean(row.validUntil && row.validUntil > now)
      && (policy.gasTestRequiresInstrumentCalibration !== 1 || Boolean(row.instrumentId && row.calibrationExpiry && row.calibrationExpiry > now))
      && acceptance.acceptable;
  }));
  const derived = { allRequiredBlindsActive, lotoActive, gasTestAcceptable };
  const requestedAuthorization = input.status === "authorized";
  if (requestedAuthorization && !canAuthorize) {
    throw new Error("Only an authorized Entry Supervisor can authorize Vessel Entry Readiness.");
  }
  const existingReadiness = await db.select().from(entryReadinessRecords).where(eq(entryReadinessRecords.packageId, input.packageId)).orderBy(desc(entryReadinessRecords.createdAt)).limit(1);
  const previous = existingReadiness[0];
  const pressureZero = canPrepare ? input.pressureZero : previous?.pressureZero === 1;
  const drainedAndPurged = canPrepare ? input.drainedAndPurged : previous?.drainedAndPurged === 1;
  const confinedSpacePermitValid = canPrepare ? input.confinedSpacePermitValid : previous?.confinedSpacePermitValid === 1;
  const operationsApproved = canPrepare ? input.operationsApproved : previous?.operationsApproved === 1;
  const entrySupervisorApproved = canAuthorize ? input.entrySupervisorApproved : previous?.entrySupervisorApproved === 1;
  if (requestedAuthorization && !Object.values({
    ...derived,
    pressureZero,
    drainedAndPurged,
    confinedSpacePermitValid,
    operationsApproved,
    entrySupervisorApproved,
  }).every(Boolean)) {
    throw new Error("Entry Readiness cannot be authorized until every derived and declared safety condition is satisfied.");
  }
  const latest = previous ? [{ id: previous.id }] : [];
  const resolvedValidUntil = requestedAuthorization
    ? (input.validUntil ?? new Date(now.getTime() + policy.entryReadinessValidityMinutes * 60_000))
    : (input.validUntil ?? null);
  if (requestedAuthorization && resolvedValidUntil && resolvedValidUntil.getTime() <= now.getTime()) {
    throw new Error("Entry Readiness validity must end after the authorization time.");
  }
  const values = {
    packageId: input.packageId,
    status: input.status,
    allRequiredBlindsActive: allRequiredBlindsActive ? 1 : 0,
    lotoActive: lotoActive ? 1 : 0,
    pressureZero: pressureZero ? 1 : 0,
    drainedAndPurged: drainedAndPurged ? 1 : 0,
    gasTestAcceptable: gasTestAcceptable ? 1 : 0,
    confinedSpacePermitValid: confinedSpacePermitValid ? 1 : 0,
    operationsApproved: operationsApproved ? 1 : 0,
    entrySupervisorApproved: entrySupervisorApproved ? 1 : 0,
    validUntil: resolvedValidUntil,
    approvedByOpenId: requestedAuthorization ? actor.openId : null,
    approvedAt: requestedAuthorization ? now : null,
    updatedAt: now,
  };
  let id: number | undefined;
  await db.transaction(async (tx) => {
    if (latest[0]) {
      await tx.update(entryReadinessRecords).set(values).where(eq(entryReadinessRecords.id, latest[0].id));
      id = latest[0].id;
    } else {
      const result = await tx.insert(entryReadinessRecords).values(values).$returningId();
      id = result[0]?.id;
    }
    const packageUpdateResult = await tx.update(isolationPackages).set({
      status: requestedAuthorization ? "entry_authorized" : input.status === "rejected" ? "on_hold" : "active",
      recordVersion: packageRow.recordVersion + 1,
      updatedAt: now,
    }).where(and(eq(isolationPackages.id, input.packageId), eq(isolationPackages.recordVersion, packageRow.recordVersion)));
    const affectedRows = Number((packageUpdateResult as { rowsAffected?: number; affectedRows?: number })?.rowsAffected
      ?? (packageUpdateResult as { affectedRows?: number })?.affectedRows
      ?? 1);
    if (affectedRows === 0) throw new Error("Isolation Package was updated by another user. Refresh and try again.");
    if (requestedAuthorization) {
      await tx.update(blindWorkflowRuntime).set({ lifecycleStatus: "ENTRY_AUTHORIZED", updatedAt: now }).where(and(
        inArray(blindWorkflowRuntime.blindTag, requiredTags),
        eq(blindWorkflowRuntime.currentPhaseKey, "internalInspection"),
      ));
    }
  });
  for (const blindTag of requiredTags) {
    await appendWorkflowRecordAudit(db, { projectId: packageRow.projectId, blindTag }, actor, "Entry Readiness Updated", `Isolation Package ${input.packageId} entry readiness updated to ${input.status}.`);
  }
  return { id, derived };
}

export async function createWorkflowEvidenceRecord(input: {
  projectId: string;
  blindTag: string;
  phaseKey: string;
  category: string;
  fileName: string;
  fileUrl: string;
  storageKey?: string | null;
  mimeType?: string | null;
  fileSizeBytes?: number | null;
}, actor: ActingProjectUser) {
  await assertAnyWorkflowPermission(actor, ["workflow.record.evidence"]);
  await ensureBlindWorkflowRuntime(input.projectId, input.blindTag);
  const db = await requireDb();
  const runtimeRows = await db.select().from(blindWorkflowRuntime).where(and(
    eq(blindWorkflowRuntime.blindTag, input.blindTag),
    eq(blindWorkflowRuntime.projectId, input.projectId),
  )).limit(1);
  const runtime = runtimeRows[0];
  if (!runtime) throw new Error("Workflow runtime was not found.");
  if (runtime.currentPhaseKey !== input.phaseKey && actor.role !== "admin") {
    throw new Error("Evidence can only be uploaded to the current workflow phase.");
  }
  const result = await db.insert(workflowEvidenceAttachments).values({
    blindTag: input.blindTag,
    projectId: input.projectId,
    phaseKey: input.phaseKey as any,
    category: input.category,
    fileName: input.fileName,
    fileUrl: input.fileUrl,
    storageKey: input.storageKey ?? null,
    mimeType: input.mimeType ?? null,
    fileSizeBytes: input.fileSizeBytes ?? null,
    uploadedByOpenId: actor.openId,
  }).$returningId();
  await db.update(blindPhaseInstances).set({ evidenceComplete: 1, updatedAt: new Date() }).where(and(
    eq(blindPhaseInstances.blindTag, input.blindTag),
    eq(blindPhaseInstances.phaseKey, input.phaseKey as any),
  ));
  await appendWorkflowRecordAudit(db, input, actor, "Workflow Evidence Uploaded", `${input.fileName} uploaded to ${input.phaseKey} as ${input.category}.`);
  return { id: result[0]?.id, fileUrl: input.fileUrl };
}

export async function deleteWorkflowEvidenceRecord(input: {
  projectId: string;
  blindTag: string;
  evidenceId: number;
}, actor: ActingProjectUser) {
  await assertAnyWorkflowPermission(actor, ["workflow.record.evidence"]);
  const db = await requireDb();
  const rows = await db.select().from(workflowEvidenceAttachments).where(and(
    eq(workflowEvidenceAttachments.id, input.evidenceId),
    eq(workflowEvidenceAttachments.projectId, input.projectId),
    eq(workflowEvidenceAttachments.blindTag, input.blindTag),
  )).limit(1);
  if (!rows[0]) throw new Error("Evidence attachment was not found.");
  const storageKey = rows[0].storageKey ?? storageKeyFromUrl(rows[0].fileUrl);
  let objectDeleted: boolean | null = null;
  if (storageKey) {
    try {
      objectDeleted = await storageDelete(storageKey);
    } catch (error) {
      // Do not remove the database record when an S3 delete failed; this avoids
      // a hidden orphan and lets the user retry after storage is restored.
      throw new Error(`Evidence object could not be deleted: ${error instanceof Error ? error.message : "storage error"}`);
    }
  }
  await db.delete(workflowEvidenceAttachments).where(eq(workflowEvidenceAttachments.id, input.evidenceId));
  const remaining = await db.select({ id: workflowEvidenceAttachments.id }).from(workflowEvidenceAttachments).where(and(
    eq(workflowEvidenceAttachments.blindTag, input.blindTag),
    eq(workflowEvidenceAttachments.phaseKey, rows[0].phaseKey),
  )).limit(1);
  await db.update(blindPhaseInstances).set({ evidenceComplete: remaining.length ? 1 : 0, updatedAt: new Date() }).where(and(
    eq(blindPhaseInstances.blindTag, input.blindTag),
    eq(blindPhaseInstances.phaseKey, rows[0].phaseKey),
  ));
  await appendWorkflowRecordAudit(db, input, actor, "Workflow Evidence Removed", `${rows[0].fileName} removed from ${rows[0].phaseKey}.${objectDeleted === false ? " Legacy Forge object retained for storage cleanup." : ""}`);
  return { success: true };
}

export async function getIsolationPackages(input?: { projectId?: string | null }) {
  const db = await requireDb();
  const packageRows = input?.projectId
    ? await db.select().from(isolationPackages).where(eq(isolationPackages.projectId, input.projectId)).orderBy(desc(isolationPackages.updatedAt))
    : await db.select().from(isolationPackages).orderBy(desc(isolationPackages.updatedAt));
  if (packageRows.length === 0) return [];
  const packageIds = packageRows.map((row) => row.id);
  const [memberships, readiness] = await Promise.all([
    db.select().from(isolationPackageBlinds).where(inArray(isolationPackageBlinds.packageId, packageIds)),
    db.select().from(entryReadinessRecords).where(inArray(entryReadinessRecords.packageId, packageIds)).orderBy(desc(entryReadinessRecords.createdAt)),
  ]);
  const linkedTags = Array.from(new Set(memberships.map((row) => row.blindTag)));
  const runtimeRows = linkedTags.length
    ? await db.select().from(blindWorkflowRuntime).where(inArray(blindWorkflowRuntime.blindTag, linkedTags))
    : [];
  return packageRows.map((pkg) => {
    const linked = memberships.filter((row) => row.packageId === pkg.id);
    const required = linked.filter((row) => row.required === 1);
    const linkedRuntime = runtimeRows.filter((runtime) => linked.some((row) => row.blindTag === runtime.blindTag));
    const latestReadiness = readiness.find((row) => row.packageId === pkg.id) ?? null;
    return {
      ...pkg,
      linkedBlindCount: linked.length,
      requiredBlindCount: required.length,
      activeIsolationCount: linkedRuntime.filter((runtime) => ["ACTIVE_ISOLATION", "ENTRY_AUTHORIZED", "WORK_IN_PROGRESS", "READY_FOR_CLOSURE"].includes(runtime.lifecycleStatus)).length,
      closedBlindCount: linkedRuntime.filter((runtime) => runtime.lifecycleStatus === "CLOSED").length,
      latestEntryReadiness: latestReadiness ? {
        id: latestReadiness.id,
        status: latestReadiness.status,
        validUntil: latestReadiness.validUntil,
        approvedAt: latestReadiness.approvedAt,
      } : null,
    };
  });
}

export async function getIsolationPackageDetail(packageId: string) {
  const db = await requireDb();
  const packageRows = await db.select().from(isolationPackages).where(eq(isolationPackages.id, packageId)).limit(1);
  const pkg = packageRows[0];
  if (!pkg) throw new Error("Isolation Package was not found.");
  const memberships = await db.select().from(isolationPackageBlinds).where(eq(isolationPackageBlinds.packageId, packageId));
  const tags = memberships.map((row) => row.blindTag);
  const [blindRows, runtimeRows, readinessRows] = await Promise.all([
    tags.length ? db.select().from(blinds).where(inArray(blinds.tag, tags)) : Promise.resolve([]),
    tags.length ? db.select().from(blindWorkflowRuntime).where(inArray(blindWorkflowRuntime.blindTag, tags)) : Promise.resolve([]),
    db.select().from(entryReadinessRecords).where(eq(entryReadinessRecords.packageId, packageId)).orderBy(desc(entryReadinessRecords.createdAt)),
  ]);
  return {
    package: pkg,
    linkedBlinds: memberships.map((membership) => {
      const blind = blindRows.find((row) => row.tag === membership.blindTag);
      const runtime = runtimeRows.find((row) => row.blindTag === membership.blindTag);
      return {
        blindTag: membership.blindTag,
        required: membership.required === 1,
        equipment: blind?.equipment ?? null,
        size: blind?.size ?? null,
        type: blind?.type ?? null,
        legacyPhase: blind?.phase ?? null,
        currentPhaseKey: runtime?.currentPhaseKey ?? null,
        lifecycleStatus: runtime?.lifecycleStatus ?? null,
        recordVersion: runtime?.recordVersion ?? null,
      };
    }),
    readinessHistory: readinessRows,
    latestEntryReadiness: readinessRows[0] ?? null,
  };
}
