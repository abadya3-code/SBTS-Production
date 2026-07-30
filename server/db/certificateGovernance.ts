import { createHash, randomBytes } from "crypto";
import { and, desc, eq } from "drizzle-orm";
import {
  blindChecklistResponses,
  blindPhaseInstances,
  blindWorkflowLogs,
  blindWorkflowRuntime,
  blinds,
  certificateRecords,
  defectNotifications,
  gasTestRecords,
  isolationPackageBlinds,
  isolationPackages,
  leakTestRecords,
  lotoRecords,
  ndtRecords,
  permitRecords,
  projects,
  punchItems,
  torqueRecords,
  workflowApprovalSteps,
  workflowEvidenceAttachments,
  workflowTransitionEvents,
} from "../../drizzle/schema";
import { requireDb } from "./core";
import { getCertificateSettings, getSystemSettings, getWorkflowPolicySettings } from "./settings";
import { assertAnyWorkflowPermission, ensureBlindWorkflowRuntime } from "./workflowRuntime";
import { getQualityGateReadiness } from "./qualityGovernance";
import type { ActingProjectUser } from "./types";

function stable(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, stable(item)]));
  return value;
}

function snapshotHash(snapshot: unknown) {
  return createHash("sha256").update(JSON.stringify(stable(snapshot))).digest("hex");
}

function certificateNumber(prefix: string, blindTag: string, version: number) {
  const clean = blindTag.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").toUpperCase();
  return `${prefix}-${clean}-V${String(version).padStart(2, "0")}`;
}

async function appendCertificateAudit(input: { projectId: string; blindTag: string }, actor: ActingProjectUser, action: string, message: string) {
  const db = await requireDb();
  await db.insert(blindWorkflowLogs).values({
    projectId: input.projectId,
    blindTag: input.blindTag,
    phase: "Inspection Ready",
    action,
    message,
    actorOpenId: actor.openId,
    actorName: actor.name ?? actor.email ?? actor.openId,
  });
}

async function buildCertificateSnapshot(projectId: string, blindTag: string) {
  const db = await requireDb();
  const [projectRows, blindRows, runtimeRows, phases, checklist, transitions, permits, loto, gasTests, torque, leak, approvals, evidence, defects, punches, ndt, memberships, certSettings, systemSettings] = await Promise.all([
    db.select().from(projects).where(eq(projects.id, projectId)).limit(1),
    db.select().from(blinds).where(and(eq(blinds.projectId, projectId), eq(blinds.tag, blindTag))).limit(1),
    db.select().from(blindWorkflowRuntime).where(eq(blindWorkflowRuntime.blindTag, blindTag)).limit(1),
    db.select().from(blindPhaseInstances).where(eq(blindPhaseInstances.blindTag, blindTag)).orderBy(blindPhaseInstances.sortOrder),
    db.select().from(blindChecklistResponses).where(eq(blindChecklistResponses.blindTag, blindTag)).orderBy(blindChecklistResponses.phaseKey, blindChecklistResponses.id),
    db.select().from(workflowTransitionEvents).where(eq(workflowTransitionEvents.blindTag, blindTag)).orderBy(workflowTransitionEvents.id),
    db.select().from(permitRecords).where(eq(permitRecords.blindTag, blindTag)).orderBy(permitRecords.id),
    db.select().from(lotoRecords).where(eq(lotoRecords.blindTag, blindTag)).orderBy(lotoRecords.id),
    db.select().from(gasTestRecords).where(eq(gasTestRecords.blindTag, blindTag)).orderBy(gasTestRecords.id),
    db.select().from(torqueRecords).where(eq(torqueRecords.blindTag, blindTag)).orderBy(torqueRecords.id),
    db.select().from(leakTestRecords).where(eq(leakTestRecords.blindTag, blindTag)).limit(1),
    db.select().from(workflowApprovalSteps).where(eq(workflowApprovalSteps.blindTag, blindTag)).orderBy(workflowApprovalSteps.sequence),
    db.select().from(workflowEvidenceAttachments).where(eq(workflowEvidenceAttachments.blindTag, blindTag)).orderBy(workflowEvidenceAttachments.id),
    db.select().from(defectNotifications).where(eq(defectNotifications.blindTag, blindTag)).orderBy(defectNotifications.id),
    db.select().from(punchItems).where(eq(punchItems.blindTag, blindTag)).orderBy(punchItems.id),
    db.select().from(ndtRecords).where(eq(ndtRecords.blindTag, blindTag)).orderBy(ndtRecords.id),
    db.select({ packageId: isolationPackageBlinds.packageId, status: isolationPackages.status, equipment: isolationPackages.equipment }).from(isolationPackageBlinds).innerJoin(isolationPackages, eq(isolationPackages.id, isolationPackageBlinds.packageId)).where(eq(isolationPackageBlinds.blindTag, blindTag)),
    getCertificateSettings(),
    getSystemSettings(),
  ]);
  if (!projectRows[0] || !blindRows[0] || !runtimeRows[0]) throw new Error("Certificate source data is incomplete.");
  return {
    schemaVersion: "SBTS-CERT-1",
    generatedAt: new Date().toISOString(),
    system: { appName: systemSettings.appName, companyName: systemSettings.companyName, plantName: systemSettings.plantName, versionName: systemSettings.versionName },
    certificateSettings: certSettings,
    project: projectRows[0], blind: blindRows[0], runtime: runtimeRows[0], phases, checklist, transitions,
    compliance: { permits, loto, gasTests }, mechanical: { torque, leakTest: leak[0] ?? null }, approvals, evidence,
    quality: { defects, punches, ndt }, isolationPackages: memberships,
  };
}

export async function getCertificateReadiness(projectId: string, blindTag: string) {
  const db = await requireDb();
  const policy = await getWorkflowPolicySettings();
  const runtime = (await db.select().from(blindWorkflowRuntime).where(and(eq(blindWorkflowRuntime.projectId, projectId), eq(blindWorkflowRuntime.blindTag, blindTag))).limit(1))[0];
  if (!runtime) throw new Error("Workflow runtime not found.");
  const blockingReasons: string[] = [];
  if (policy.certificateRequireClosedWorkflow === 1 && (runtime.lifecycleStatus !== "CLOSED" || runtime.isLocked !== 1)) blockingReasons.push("Canonical workflow must be closed and locked.");
  const leak = (await db.select().from(leakTestRecords).where(eq(leakTestRecords.blindTag, blindTag)).limit(1))[0];
  if (policy.certificateRequiresLeakTest === 1 && (!leak || leak.status !== "passed" || leak.noLeakObserved !== 1)) blockingReasons.push("Passed leak/service test is required.");
  const approvals = await db.select().from(workflowApprovalSteps).where(eq(workflowApprovalSteps.blindTag, blindTag));
  const pending = approvals.filter((row) => row.status !== "approved" && row.status !== "not_required");
  if (pending.length) blockingReasons.push(`Final approval chain is incomplete: ${pending.map((row) => row.approvalRoleKey).join(", ")}.`);
  const quality = await getQualityGateReadiness(projectId, blindTag);
  blockingReasons.push(...quality.blockingReasons);
  return { ready: blockingReasons.length === 0, blockingReasons, runtime };
}

export async function listBlindCertificates(projectId: string, blindTag: string, actor: ActingProjectUser) {
  await assertAnyWorkflowPermission(actor, ["workflow.view", "workflow.certificate.issue", "workflow.certificate.reissue", "workflow.certificate.revoke"]);
  const db = await requireDb();
  return db.select().from(certificateRecords).where(and(eq(certificateRecords.projectId, projectId), eq(certificateRecords.blindTag, blindTag))).orderBy(desc(certificateRecords.version));
}

export async function issueCertificate(input: { projectId: string; blindTag: string; reason?: string | null; reissue?: boolean }, actor: ActingProjectUser) {
  await assertAnyWorkflowPermission(actor, [input.reissue ? "workflow.certificate.reissue" : "workflow.certificate.issue"]);
  const policy = await getWorkflowPolicySettings();
  const readiness = await getCertificateReadiness(input.projectId, input.blindTag);
  if (!readiness.ready) throw new Error(`Certificate cannot be issued: ${readiness.blockingReasons.join(" ")}`);
  const db = await requireDb();
  const existing = await db.select().from(certificateRecords).where(and(eq(certificateRecords.projectId, input.projectId), eq(certificateRecords.blindTag, input.blindTag))).orderBy(desc(certificateRecords.version));
  if (!input.reissue && existing.some((row) => row.status === "issued")) throw new Error("An issued certificate already exists. Use controlled reissue.");
  if (input.reissue && policy.certificateReissueRequiresReason === 1 && !input.reason?.trim()) throw new Error("A reissue reason is required.");
  const version = (existing[0]?.version ?? 0) + 1;
  const snapshot = await buildCertificateSnapshot(input.projectId, input.blindTag);
  const hash = snapshotHash(snapshot);
  const number = certificateNumber(policy.certificateNumberPrefix || "CERT", input.blindTag, version);
  const verificationToken = randomBytes(32).toString("base64url");
  const now = new Date();
  let id: number | undefined;
  await db.transaction(async (tx) => {
    if (existing[0]?.status === "issued") await tx.update(certificateRecords).set({ status: "superseded", supersededAt: now, updatedAt: now }).where(eq(certificateRecords.id, existing[0].id));
    const result = await tx.insert(certificateRecords).values({
      certificateNumber: number, verificationToken, projectId: input.projectId, blindTag: input.blindTag,
      version, status: "issued", snapshotJson: JSON.stringify(snapshot), snapshotHash: hash,
      previousCertificateId: existing[0]?.id ?? null, issuanceReason: input.reason ?? (input.reissue ? "Controlled reissue" : "Initial issue"),
      issuedByOpenId: actor.openId, issuedByName: actor.name ?? actor.email ?? actor.openId,
    }).$returningId();
    id = result[0]?.id;
  });
  await appendCertificateAudit(input, actor, input.reissue ? "Certificate Reissued" : "Certificate Issued", `${number} · version ${version} · SHA-256 ${hash}.`);
  return { id, certificateNumber: number, verificationToken, version, snapshotHash: hash };
}

export async function revokeCertificate(input: { certificateId: number; reason: string }, actor: ActingProjectUser) {
  await assertAnyWorkflowPermission(actor, ["workflow.certificate.revoke"]);
  const policy = await getWorkflowPolicySettings();
  if (policy.certificateAllowRevocation !== 1) throw new Error("Certificate revocation is disabled in settings.");
  const db = await requireDb();
  const row = (await db.select().from(certificateRecords).where(eq(certificateRecords.id, input.certificateId)).limit(1))[0];
  if (!row) throw new Error("Certificate not found.");
  if (row.status !== "issued") throw new Error("Only the current issued certificate can be revoked.");
  await db.update(certificateRecords).set({ status: "revoked", revokedByOpenId: actor.openId, revokedAt: new Date(), revocationReason: input.reason, updatedAt: new Date() }).where(eq(certificateRecords.id, row.id));
  await appendCertificateAudit({ projectId: row.projectId, blindTag: row.blindTag }, actor, "Certificate Revoked", `${row.certificateNumber} revoked. Reason: ${input.reason}`);
  return { success: true };
}

export async function getPublicCertificateVerification(token: string) {
  const db = await requireDb();
  const policy = await getWorkflowPolicySettings();
  if (policy.certificateVerificationEnabled !== 1) throw new Error("Public certificate verification is disabled.");
  const row = (await db.select().from(certificateRecords).where(eq(certificateRecords.verificationToken, token)).limit(1))[0];
  if (!row) throw new Error("Certificate verification token was not found.");
  const snapshot = JSON.parse(row.snapshotJson) as Record<string, any>;
  const computedHash = snapshotHash(snapshot);
  const defects = Array.isArray(snapshot.quality?.defects) ? snapshot.quality.defects : [];
  const punches = Array.isArray(snapshot.quality?.punches) ? snapshot.quality.punches : [];
  const ndt = Array.isArray(snapshot.quality?.ndt) ? snapshot.quality.ndt : [];
  const approvals = Array.isArray(snapshot.approvals) ? snapshot.approvals : [];
  const packages = Array.isArray(snapshot.isolationPackages) ? snapshot.isolationPackages : [];
  const leakTest = snapshot.mechanical?.leakTest ?? null;

  // Only return fields needed to verify the final controlled certificate. The
  // immutable source snapshot remains in the database and is never exposed to
  // unauthenticated users (no permits, LOTO details, gas readings, user IDs or files).
  return {
    certificateNumber: row.certificateNumber,
    blindTag: row.blindTag,
    projectId: row.projectId,
    version: row.version,
    status: row.status,
    issuedAt: row.issuedAt,
    issuedByName: row.issuedByName,
    snapshotHash: row.snapshotHash,
    hashValid: computedHash === row.snapshotHash,
    revocationReason: row.revocationReason,
    publicSnapshot: {
      schemaVersion: snapshot.schemaVersion,
      generatedAt: snapshot.generatedAt,
      system: {
        appName: snapshot.system?.appName ?? "SBTS",
        companyName: snapshot.system?.companyName ?? null,
        plantName: snapshot.system?.plantName ?? null,
        versionName: snapshot.system?.versionName ?? null,
      },
      project: {
        id: snapshot.project?.id ?? row.projectId,
        name: snapshot.project?.name ?? null,
        status: snapshot.project?.status ?? null,
      },
      blind: {
        tag: snapshot.blind?.tag ?? row.blindTag,
        type: snapshot.blind?.type ?? null,
        size: snapshot.blind?.size ?? null,
        rating: snapshot.blind?.rate ?? null,
        equipment: snapshot.blind?.equipment ?? null,
        lineNumber: snapshot.blind?.lineNumber ?? null,
        location: snapshot.blind?.location ?? null,
        material: snapshot.blind?.material ?? null,
        pidReference: snapshot.blind?.pidRef ?? null,
      },
      workflow: {
        lifecycleStatus: snapshot.runtime?.lifecycleStatus ?? null,
        currentPhaseKey: snapshot.runtime?.currentPhaseKey ?? null,
        locked: snapshot.runtime?.isLocked === 1,
        lockedAt: snapshot.runtime?.lockedAt ?? null,
      },
      finalApprovals: approvals.map((approval: any) => ({
        role: approval.approvalRoleKey,
        status: approval.status,
        approvedByName: approval.approvedByName ?? null,
        approvedAt: approval.approvedAt ?? null,
      })),
      leakTest: leakTest ? {
        status: leakTest.status,
        testType: leakTest.testType,
        noLeakObserved: leakTest.noLeakObserved === 1,
        completedAt: leakTest.completedAt ?? leakTest.updatedAt ?? null,
      } : null,
      qualitySummary: {
        defects: defects.length,
        defectsClosedOrTransferred: defects.filter((item: any) => ["accepted_as_is", "closed", "transferred", "cancelled"].includes(item.status)).length,
        punchItems: punches.length,
        mandatoryPunchItemsOpen: punches.filter((item: any) => item.mandatory === 1 && !["closed", "transferred", "cancelled"].includes(item.status)).length,
        ndtRecords: ndt.length,
        ndtAccepted: ndt.filter((item: any) => ["passed", "cancelled"].includes(item.status)).length,
      },
      isolationPackages: packages.map((item: any) => ({
        packageId: item.packageId,
        equipment: item.equipment,
        status: item.status,
      })),
    },
  };
}
