export const electronicApprovalPhaseOrder = ["Broken / Preparation", "Assembly", "Tight & Torque", "Final Tight", "Inspection Ready"] as const;

export type ElectronicApprovalPhase = (typeof electronicApprovalPhaseOrder)[number];

export type ElectronicApprovalAuditInput = {
  phase: ElectronicApprovalPhase;
  approved: boolean;
  actorName: string;
  note?: string | null;
};

export type ElectronicApprovalAudit = {
  action: "Electronic phase approved" | "Electronic phase approval revoked";
  message: string;
};

export function isPhaseReachableForApproval(currentPhase: ElectronicApprovalPhase, targetPhase: ElectronicApprovalPhase): boolean {
  const currentIndex = electronicApprovalPhaseOrder.indexOf(currentPhase);
  const targetIndex = electronicApprovalPhaseOrder.indexOf(targetPhase);
  return targetIndex >= 0 && currentIndex >= 0 && targetIndex <= currentIndex;
}

export function buildElectronicApprovalAudit(input: ElectronicApprovalAuditInput): ElectronicApprovalAudit {
  const cleanNote = input.note?.trim();
  return input.approved
    ? {
        action: "Electronic phase approved",
        message: `${input.phase} was electronically approved by ${input.actorName}${cleanNote ? ` — ${cleanNote}` : ""}.`,
      }
    : {
        action: "Electronic phase approval revoked",
        message: `${input.phase} electronic approval was revoked by ${input.actorName}${cleanNote ? ` — ${cleanNote}` : ""}.`,
      };
}
