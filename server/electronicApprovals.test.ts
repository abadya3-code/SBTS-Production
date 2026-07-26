import { describe, expect, it } from "vitest";
import { buildElectronicApprovalAudit, isPhaseReachableForApproval } from "../shared/electronicApprovals";

describe("electronic phase approval helpers", () => {
  it("allows sign-off only for reached or completed phases", () => {
    expect(isPhaseReachableForApproval("Assembly", "Broken / Preparation")).toBe(true);
    expect(isPhaseReachableForApproval("Assembly", "Assembly")).toBe(true);
    expect(isPhaseReachableForApproval("Assembly", "Final Tight")).toBe(false);
  });

  it("builds the production audit log message for approvals with notes", () => {
    expect(buildElectronicApprovalAudit({
      phase: "Assembly",
      approved: true,
      actorName: "Foreman Metal",
      note: "Checked torque sheet",
    })).toEqual({
      action: "Electronic phase approved",
      message: "Assembly was electronically approved by Foreman Metal — Checked torque sheet.",
    });
  });

  it("builds the production audit log message for revocations and trims empty notes", () => {
    expect(buildElectronicApprovalAudit({
      phase: "Final Tight",
      approved: false,
      actorName: "QC Inspector",
      note: "   ",
    })).toEqual({
      action: "Electronic phase approval revoked",
      message: "Final Tight electronic approval was revoked by QC Inspector.",
    });
  });
});
