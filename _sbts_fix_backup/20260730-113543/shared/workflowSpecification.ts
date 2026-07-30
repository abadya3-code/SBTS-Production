/**
 * SBTS canonical workflow specification.
 *
 * Sprint 1 establishes this file as the single product truth for workflow labels,
 * ownership, gates, evidence, colors, and lifecycle states. Runtime transition
 * enforcement is implemented by the workflow engine in the following sprint.
 */

export const canonicalPhaseKeys = [
  "operationsInitialIsolation",
  "blindInstallation",
  "mechanicalVerification",
  "internalInspection",
  "reinstatementPreparation",
  "blindRemovalReinstatement",
  "reinstatementVerification",
  "finalApprovalReturnToService",
] as const;

export type CanonicalPhaseKey = (typeof canonicalPhaseKeys)[number];

export const legacyPhaseKeys = ["broken", "assembly", "tightTorque", "finalTight", "inspectionReady"] as const;
export type LegacyPhaseKey = (typeof legacyPhaseKeys)[number];
export type WorkflowPhaseKey = CanonicalPhaseKey | LegacyPhaseKey;

export const workflowRoleKeys = [
  "admin",
  "coordinator",
  "operations",
  "operationsForeman",
  "gasTester",
  "technician",
  "mechanicalVerifier",
  "qc",
  "safety",
  "inspection",
  "entrySupervisor",
  "tiEngineer",
  "metalForeman",
] as const;

export type WorkflowRoleKey = (typeof workflowRoleKeys)[number];

export type CanonicalWorkflowPhase = {
  key: CanonicalPhaseKey;
  label: string;
  shortLabel: string;
  ownerRoleKey: WorkflowRoleKey;
  requiredPermissionKey: string;
  color: string;
  iconKey: string;
  slaHours: number;
  critical: boolean;
  purpose: string;
  gate: string;
  checklist: readonly string[];
  evidence: readonly string[];
  actionKey: string;
  actionLabel: string;
};

export const canonicalWorkflowPhases: readonly CanonicalWorkflowPhase[] = [
  {
    key: "operationsInitialIsolation",
    label: "Operations Initial Isolation",
    shortLabel: "Initial Isolation",
    ownerRoleKey: "operations",
    requiredPermissionKey: "workflow.phase.operations.complete",
    color: "#0f766e",
    iconKey: "shield-lock",
    slaHours: 8,
    critical: true,
    purpose: "Shut down the equipment, establish the initial process and energy isolation, and authorize controlled line breaking.",
    gate: "PTW and LOTO are active, pressure is verified zero, drain/vent/purge requirements are complete, and Operations authorizes blind installation.",
    checklist: [
      "Equipment shutdown confirmed",
      "Required isolation valves secured",
      "LOTO applied and verified",
      "Pressure verified zero",
      "Drain and vent completed",
      "Purge or flush completed where required",
      "Initial gas test valid where required",
      "Line-breaking authorization issued",
    ],
    evidence: ["PTW", "LOTO certificate", "Isolation plan", "Gas test record", "Operations handover"],
    actionKey: "completeInitialIsolation",
    actionLabel: "Complete Initial Isolation",
  },
  {
    key: "blindInstallation",
    label: "Blind Installation & Controlled Tightening",
    shortLabel: "Blind Installation",
    ownerRoleKey: "technician",
    requiredPermissionKey: "workflow.phase.installation.submit",
    color: "#2563eb",
    iconKey: "wrench",
    slaHours: 12,
    critical: true,
    purpose: "Install or reposition the specified positive isolation and complete the approved bolted-joint tightening procedure.",
    gate: "Correct blind, gasket, bolting and position are verified; torque passes and calibrated tool details are recorded; required evidence is attached.",
    checklist: [
      "Permit and Operations handover verified",
      "Zero pressure reconfirmed",
      "Correct blind specification verified",
      "Flange faces and alignment accepted",
      "Approved new gasket installed",
      "Bolting specification verified",
      "Controlled tightening completed",
      "Blind tag, QR and evidence attached",
    ],
    evidence: ["Before photo", "Installed blind photo", "Torque record", "Calibration certificate", "Blind tag / QR"],
    actionKey: "submitInstallationRecord",
    actionLabel: "Submit Installation & Torque Record",
  },
  {
    key: "mechanicalVerification",
    label: "Independent Mechanical Verification",
    shortLabel: "Mechanical Verification",
    ownerRoleKey: "mechanicalVerifier",
    requiredPermissionKey: "workflow.phase.mechanical.verify",
    color: "#0891b2",
    iconKey: "search-check",
    slaHours: 8,
    critical: true,
    purpose: "Independently verify the installed positive isolation and joint integrity before vessel opening or intrusive work.",
    gate: "Independent verifier accepts blind position, gasket, bolting, torque, calibration, identification and isolation integrity.",
    checklist: [
      "Correct isolation point and blind verified",
      "Blind size, class, material and thickness verified",
      "Gasket and flange alignment accepted",
      "Bolt engagement and stud projection accepted",
      "Torque record and final pass reviewed",
      "Tool calibration valid",
      "No visible leakage or pressure build-up",
      "Independent sign-off completed",
    ],
    evidence: ["Mechanical verification checklist", "Verifier signature", "Installation photos", "Torque record"],
    actionKey: "approveMechanicalVerification",
    actionLabel: "Approve Positive Isolation",
  },
  {
    key: "internalInspection",
    label: "Internal Inspection & Work Execution",
    shortLabel: "Inspection & Work",
    ownerRoleKey: "inspection",
    requiredPermissionKey: "workflow.phase.inspection.manage",
    color: "#7c3aed",
    iconKey: "clipboard-search",
    slaHours: 24,
    critical: false,
    purpose: "Manage vessel entry readiness, internal inspection activities, defects, repair evidence and readiness for closure.",
    gate: "Entry readiness is authorized when applicable, required inspection activities are completed, and all mandatory punch items are closed or formally transferred.",
    checklist: [
      "Vessel entry readiness gate passed where applicable",
      "Manway condition recorded",
      "Configured inspection activities completed",
      "Defects and notifications recorded",
      "Required repairs or NDT completed",
      "Internal cleanliness accepted",
      "Personnel and tools accounted for",
      "Ready-for-closure authorization completed",
    ],
    evidence: ["Entry readiness record", "Inspection reports", "Defect notifications", "Internal photos", "Ready-for-closure sign-off"],
    actionKey: "declareReadyForClosure",
    actionLabel: "Declare Ready for Closure",
  },
  {
    key: "reinstatementPreparation",
    label: "Reinstatement Preparation & Authorization",
    shortLabel: "Reinstatement Preparation",
    ownerRoleKey: "operations",
    requiredPermissionKey: "workflow.phase.removal.authorize",
    color: "#d97706",
    iconKey: "clipboard-check",
    slaHours: 8,
    critical: true,
    purpose: "Confirm the worksite and equipment are ready for controlled removal of the positive isolation.",
    gate: "Inspection clearance is received, all personnel and tools are accounted for, permits are reconciled, no work group relies on the isolation, and Operations authorizes removal.",
    checklist: [
      "Inspection clearance received",
      "All work complete and personnel accounted for",
      "Tools and temporary materials removed",
      "Manway and internal closure accepted",
      "Related and conflicting permits reconciled",
      "No work group relies on this isolation",
      "No pressure build-up behind blind",
      "Blind removal authorization issued",
    ],
    evidence: ["Inspection clearance", "Personnel/tool clearance", "Permit reconciliation", "Operations removal authorization"],
    actionKey: "authorizeBlindRemoval",
    actionLabel: "Authorize Blind Removal",
  },
  {
    key: "blindRemovalReinstatement",
    label: "Blind Removal & Reinstatement",
    shortLabel: "Blind Removal",
    ownerRoleKey: "technician",
    requiredPermissionKey: "workflow.phase.reinstatement.submit",
    color: "#ea580c",
    iconKey: "rotate-ccw",
    slaHours: 12,
    critical: true,
    purpose: "Remove or reposition the positive isolation, restore the service configuration, and re-tighten all disturbed joints.",
    gate: "Removal authorization is valid, trapped pressure is excluded, correct spacer/service position is restored, and reinstatement torque and evidence are complete.",
    checklist: [
      "Removal authorization and permit verified",
      "LOTO and initial isolation remain controlled",
      "Vent/drain checked immediately before opening",
      "Blind removed or moved to service position",
      "Blind identity and condition recorded",
      "Approved new gasket installed",
      "Controlled tightening completed",
      "Register and evidence updated",
    ],
    evidence: ["Removal photo", "Blind condition record", "Reinstatement photo", "Reinstatement torque record", "Storage/custody record"],
    actionKey: "submitReinstatementRecord",
    actionLabel: "Submit Reinstatement & Torque Record",
  },
  {
    key: "reinstatementVerification",
    label: "Independent Reinstatement Verification & Leak Test",
    shortLabel: "Final Verification",
    ownerRoleKey: "mechanicalVerifier",
    requiredPermissionKey: "workflow.phase.reinstatement.verify",
    color: "#16a34a",
    iconKey: "badge-check",
    slaHours: 8,
    critical: true,
    purpose: "Independently verify restored configuration, joint integrity, blind reconciliation and leak/service test acceptance.",
    gate: "No unintended blind remains, disturbed joints are accepted, reinstatement torque is valid, controlled pressurization succeeds and no leakage is detected.",
    checklist: [
      "Correct blind removed or service position restored",
      "No unintended blind remains installed",
      "Gasket, bolting and flange alignment accepted",
      "Reinstatement torque and calibration reviewed",
      "Drains and vents restored",
      "Blind register reconciled",
      "Controlled pressurization completed",
      "Leak/service test passed",
    ],
    evidence: ["Final mechanical checklist", "Leak test record", "Final photos", "Register reconciliation"],
    actionKey: "approveReinstatement",
    actionLabel: "Approve Reinstatement",
  },
  {
    key: "finalApprovalReturnToService",
    label: "Final Approval & Return to Service",
    shortLabel: "Final Approval",
    ownerRoleKey: "operationsForeman",
    requiredPermissionKey: "workflow.phase.returnToService.authorize",
    color: "#15803d",
    iconKey: "certificate",
    slaHours: 8,
    critical: true,
    purpose: "Complete the sequential approval chain, authorize return to service, lock the record and issue the final certificate.",
    gate: "Inspection, T&I coordination, conditional mechanical/metal foreman and final Operations approvals are complete; no safety hold or open mandatory action remains.",
    checklist: [
      "Inspection approval complete",
      "T&I Coordinator approval complete",
      "Mechanical/Metal Foreman approval complete when applicable",
      "Operations Foreman final approval complete",
      "LOTO removal controlled and recorded",
      "Final operating line-up verified",
      "Certificate readiness checks passed",
      "Package closed and certificate locked",
    ],
    evidence: ["Approval chain", "Final line-up", "LOTO closeout", "Locked certificate"],
    actionKey: "authorizeReturnToService",
    actionLabel: "Authorize Return to Service",
  },
] as const;

export const vesselEntryReadinessGate = {
  key: "vesselEntryReadiness",
  label: "Vessel Entry Readiness Gate",
  requirements: [
    "All required linked blinds are in active isolation",
    "All independent mechanical verifications passed",
    "LOTO is active",
    "Pressure is verified zero",
    "Vessel is drained and purged",
    "Gas test is acceptable and valid",
    "Confined-space permit is valid where applicable",
    "Operations and Entry Supervisor approvals are complete",
  ],
} as const;

export const finalReinstatementGate = {
  key: "finalReinstatement",
  label: "Final Reinstatement & Leak Test Gate",
  requirements: [
    "All personnel and tools are accounted for",
    "All blinds are reconciled",
    "All disturbed joints have valid torque records",
    "Leak/service test passed",
    "Final operating line-up is verified",
    "No safety hold is active",
    "No conflicting permit or mandatory punch item remains open",
  ],
} as const;

export const workflowLifecycleStates = [
  "PLANNED",
  "INITIAL_ISOLATION",
  "READY_FOR_BLIND_INSTALLATION",
  "BLIND_INSTALLED",
  "MECHANICAL_VERIFICATION_PENDING",
  "ACTIVE_ISOLATION",
  "ENTRY_AUTHORIZED",
  "WORK_IN_PROGRESS",
  "READY_FOR_CLOSURE",
  "READY_FOR_BLIND_REMOVAL",
  "REINSTATED",
  "LEAK_TEST_PENDING",
  "READY_FOR_SERVICE",
  "CLOSED",
  "SAFETY_HOLD",
] as const;

export type WorkflowLifecycleState = (typeof workflowLifecycleStates)[number];

/**
 * Temporary migration reference only. It deliberately avoids pretending that
 * the five legacy phases are semantically identical to the new workflow.
 */
export const legacyPhaseMigrationHints: Record<LegacyPhaseKey, CanonicalPhaseKey> = {
  broken: "operationsInitialIsolation",
  assembly: "blindInstallation",
  tightTorque: "blindInstallation",
  finalTight: "mechanicalVerification",
  inspectionReady: "internalInspection",
};
