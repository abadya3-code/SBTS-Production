import { describe, expect, it } from "vitest";
import {
  allRequiredChecklistItemsComplete,
  calculateCanonicalWorkflowProgress,
  getCanonicalPhase,
  getNextCanonicalPhase,
  isRecordValidAt,
  isSlipBlindType,
  lifecycleAfterPhaseCompletion,
  lifecycleWhilePhaseCurrent,
  normalizeChecklistItemKey,
  workflowActionToPhase,
} from "../shared/workflowRuntime";
import {
  canonicalPhaseKeys,
  canonicalWorkflowPhases,
} from "../shared/workflowSpecification";
import { evaluateGasTestAcceptance } from "./db/gasTestPolicy";

describe("Sprint 2 canonical workflow runtime", () => {
  it("keeps exactly eight ordered canonical phases", () => {
    expect(canonicalPhaseKeys).toHaveLength(8);
    expect(canonicalWorkflowPhases.map(phase => phase.key)).toEqual(
      canonicalPhaseKeys
    );
    expect(getNextCanonicalPhase("operationsInitialIsolation")).toBe(
      "blindInstallation"
    );
    expect(getNextCanonicalPhase("finalApprovalReturnToService")).toBeNull();
  });

  it("maps every action command to one authoritative phase", () => {
    for (const phase of canonicalWorkflowPhases) {
      expect(workflowActionToPhase[phase.actionKey]).toBe(phase.key);
      expect(getCanonicalPhase(phase.key).requiredPermissionKey).toBeTruthy();
    }
    expect(getCanonicalPhase("finalApprovalReturnToService").ownerRoleKey).toBe(
      "operationsForeman"
    );
    expect(
      getCanonicalPhase("finalApprovalReturnToService").requiredPermissionKey
    ).toBe("workflow.phase.returnToService.authorize");
  });

  it("uses safe lifecycle projections across installation, entry and reinstatement", () => {
    expect(lifecycleAfterPhaseCompletion.operationsInitialIsolation).toBe(
      "READY_FOR_BLIND_INSTALLATION"
    );
    expect(lifecycleAfterPhaseCompletion.mechanicalVerification).toBe(
      "ACTIVE_ISOLATION"
    );
    expect(lifecycleWhilePhaseCurrent.internalInspection).toBe(
      "ACTIVE_ISOLATION"
    );
    expect(lifecycleAfterPhaseCompletion.reinstatementVerification).toBe(
      "READY_FOR_SERVICE"
    );
    expect(lifecycleAfterPhaseCompletion.finalApprovalReturnToService).toBe(
      "CLOSED"
    );
  });

  it("detects slip blind and spade variants for conditional approval", () => {
    expect(isSlipBlindType("Slip Blind")).toBe(true);
    expect(isSlipBlindType("spade / spacer")).toBe(true);
    expect(isSlipBlindType("Spectacle Blind")).toBe(false);
  });

  it("does not allow an incomplete mandatory checklist to pass", () => {
    expect(allRequiredChecklistItemsComplete([])).toBe(false);
    expect(
      allRequiredChecklistItemsComplete([
        { required: true, completed: true },
        { required: true, completed: false },
        { required: false, completed: false },
      ])
    ).toBe(false);
    expect(
      allRequiredChecklistItemsComplete([
        { required: true, completed: true },
        { required: false, completed: false },
      ])
    ).toBe(true);
    expect(
      allRequiredChecklistItemsComplete(
        [{ required: true, completed: true }],
        2
      )
    ).toBe(false);
  });

  it("derives project progress from completed canonical phases", () => {
    expect(calculateCanonicalWorkflowProgress([], [])).toBe(0);
    expect(
      calculateCanonicalWorkflowProgress(
        ["BLD-001"],
        [
          {
            blindTag: "BLD-001",
            currentPhaseKey: "operationsInitialIsolation",
            lifecycleStatus: "INITIAL_ISOLATION",
          },
        ]
      )
    ).toBe(0);
    expect(
      calculateCanonicalWorkflowProgress(
        ["BLD-001"],
        [
          {
            blindTag: "BLD-001",
            currentPhaseKey: "blindInstallation",
            lifecycleStatus: "READY_FOR_BLIND_INSTALLATION",
          },
        ]
      )
    ).toBe(13);
    expect(
      calculateCanonicalWorkflowProgress(
        ["BLD-001"],
        [
          {
            blindTag: "BLD-001",
            currentPhaseKey: "finalApprovalReturnToService",
            lifecycleStatus: "CLOSED",
          },
        ]
      )
    ).toBe(100);
  });

  it("generates stable checklist keys and validates expiry", () => {
    expect(normalizeChecklistItemKey("Pressure verified zero", 3)).toBe(
      "04-pressure-verified-zero"
    );
    const now = new Date("2026-07-24T12:00:00.000Z");
    expect(
      isRecordValidAt("valid", new Date("2026-07-24T12:30:00.000Z"), now)
    ).toBe(true);
    expect(
      isRecordValidAt("valid", new Date("2026-07-24T11:59:59.000Z"), now)
    ).toBe(false);
    expect(
      isRecordValidAt("draft", new Date("2026-07-24T12:30:00.000Z"), now)
    ).toBe(false);
  });

  it("blocks valid gas tests until plant limits are configured and enforces them afterwards", () => {
    const unconfigured = evaluateGasTestAcceptance(
      { oxygenPercent: 20.9, lelPercent: 0, h2sPpm: 0, coPpm: 0 },
      {
        gasTestLimitsConfigured: 0,
      } as any
    );
    expect(unconfigured.acceptable).toBe(false);

    const policy = {
      gasTestLimitsConfigured: 1,
      gasTestOxygenMinPercent: "19.50",
      gasTestOxygenMaxPercent: "23.50",
      gasTestMaxLelPercent: "10.00",
      gasTestMaxH2sPpm: "10.00",
      gasTestMaxCoPpm: "35.00",
    } as any;
    expect(
      evaluateGasTestAcceptance(
        { oxygenPercent: 20.9, lelPercent: 0, h2sPpm: 0, coPpm: 0 },
        policy
      ).acceptable
    ).toBe(true);
    expect(
      evaluateGasTestAcceptance(
        { oxygenPercent: 18.5, lelPercent: 0, h2sPpm: 0, coPpm: 0 },
        policy
      ).acceptable
    ).toBe(false);
  });
});
