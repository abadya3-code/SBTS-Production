import {
  canonicalPhaseKeys,
  canonicalWorkflowPhases,
  type CanonicalPhaseKey,
  type WorkflowLifecycleState,
} from "./workflowSpecification";

export type WorkflowActionKey = (typeof canonicalWorkflowPhases)[number]["actionKey"];

export type WorkflowBlockingCode =
  | "WORKFLOW_LOCKED"
  | "SAFETY_HOLD_ACTIVE"
  | "ACTION_PHASE_MISMATCH"
  | "STALE_RECORD_VERSION"
  | "PERMISSION_REQUIRED"
  | "CHECKLIST_INCOMPLETE"
  | "EVIDENCE_INCOMPLETE"
  | "EVIDENCE_REQUIRED"
  | "PTW_NOT_ACTIVE"
  | "LINE_BREAKING_PERMIT_NOT_ACTIVE"
  | "LOTO_NOT_ACTIVE"
  | "LOTO_ZERO_ENERGY_NOT_VERIFIED"
  | "LOTO_NOT_RELEASED"
  | "GAS_TEST_MISSING"
  | "GAS_TEST_EXPIRED"
  | "GAS_TEST_REJECTED"
  | "GAS_TEST_OUT_OF_LIMITS"
  | "TORQUE_RECORD_MISSING"
  | "TORQUE_NOT_ACCEPTED"
  | "CALIBRATION_EXPIRED"
  | "INDEPENDENT_VERIFIER_REQUIRED"
  | "ISOLATION_PACKAGE_REQUIRED"
  | "ENTRY_READINESS_NOT_AUTHORIZED"
  | "LEAK_TEST_NOT_PASSED"
  | "FINAL_APPROVALS_INCOMPLETE"
  | "INSPECTION_ACTIVITIES_INCOMPLETE"
  | "DEFECT_DISPOSITION_INCOMPLETE"
  | "MANDATORY_PUNCH_ITEMS_OPEN"
  | "NDT_ACCEPTANCE_INCOMPLETE";

export type WorkflowBlockingReason = {
  code: WorkflowBlockingCode;
  message: string;
  source: "workflow" | "checklist" | "permit" | "loto" | "gasTest" | "torque" | "package" | "hold" | "approval" | "leakTest" | "inspection";
};

export const workflowPhaseIndex = Object.fromEntries(
  canonicalPhaseKeys.map((key, index) => [key, index]),
) as Record<CanonicalPhaseKey, number>;

export const workflowActionToPhase = Object.fromEntries(
  canonicalWorkflowPhases.map((phase) => [phase.actionKey, phase.key]),
) as Record<WorkflowActionKey, CanonicalPhaseKey>;

export const lifecycleAfterPhaseCompletion: Record<CanonicalPhaseKey, WorkflowLifecycleState> = {
  operationsInitialIsolation: "READY_FOR_BLIND_INSTALLATION",
  blindInstallation: "MECHANICAL_VERIFICATION_PENDING",
  mechanicalVerification: "ACTIVE_ISOLATION",
  internalInspection: "READY_FOR_CLOSURE",
  reinstatementPreparation: "READY_FOR_BLIND_REMOVAL",
  blindRemovalReinstatement: "LEAK_TEST_PENDING",
  reinstatementVerification: "READY_FOR_SERVICE",
  finalApprovalReturnToService: "CLOSED",
};

export const lifecycleWhilePhaseCurrent: Record<CanonicalPhaseKey, WorkflowLifecycleState> = {
  operationsInitialIsolation: "INITIAL_ISOLATION",
  blindInstallation: "READY_FOR_BLIND_INSTALLATION",
  mechanicalVerification: "MECHANICAL_VERIFICATION_PENDING",
  internalInspection: "ACTIVE_ISOLATION",
  reinstatementPreparation: "READY_FOR_CLOSURE",
  blindRemovalReinstatement: "READY_FOR_BLIND_REMOVAL",
  reinstatementVerification: "LEAK_TEST_PENDING",
  finalApprovalReturnToService: "READY_FOR_SERVICE",
};

export function getCanonicalPhase(key: CanonicalPhaseKey) {
  const phase = canonicalWorkflowPhases.find((candidate) => candidate.key === key);
  if (!phase) throw new Error(`Unknown canonical workflow phase: ${key}`);
  return phase;
}

export function getNextCanonicalPhase(key: CanonicalPhaseKey): CanonicalPhaseKey | null {
  const next = canonicalPhaseKeys[workflowPhaseIndex[key] + 1];
  return next ?? null;
}

export function normalizeChecklistItemKey(label: string, index: number): string {
  const normalized = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  return `${String(index + 1).padStart(2, "0")}-${normalized || "item"}`;
}

export function isSlipBlindType(type: string): boolean {
  const normalized = type.toLowerCase().replace(/[^a-z0-9]/g, "");
  return normalized.includes("slipblind") || normalized.includes("spade");
}

export function isRecordValidAt(
  status: string | null | undefined,
  validUntil: Date | string | null | undefined,
  at = new Date(),
): boolean {
  if (status !== "active" && status !== "valid") return false;
  if (!validUntil) return true;
  const expiry = validUntil instanceof Date ? validUntil : new Date(validUntil);
  return Number.isFinite(expiry.getTime()) && expiry.getTime() > at.getTime();
}

export function allRequiredChecklistItemsComplete(
  rows: readonly { required: boolean; completed: boolean }[],
): boolean {
  return rows.filter((row) => row.required).every((row) => row.completed);
}
