import { describe, expect, it } from "vitest";
import {
  canonicalPhaseKeys,
  canonicalWorkflowPhases,
  finalReinstatementGate,
  vesselEntryReadinessGate,
  workflowLifecycleStates,
} from "../shared/workflowSpecification";

describe("SBTS canonical workflow specification", () => {
  it("defines exactly eight ordered user-facing phases", () => {
    expect(canonicalWorkflowPhases).toHaveLength(8);
    expect(canonicalWorkflowPhases.map((phase) => phase.key)).toEqual([...canonicalPhaseKeys]);
  });

  it("keeps action keys, phase keys, and labels unique", () => {
    expect(new Set(canonicalWorkflowPhases.map((phase) => phase.key)).size).toBe(8);
    expect(new Set(canonicalWorkflowPhases.map((phase) => phase.actionKey)).size).toBe(8);
    expect(new Set(canonicalWorkflowPhases.map((phase) => phase.label)).size).toBe(8);
  });

  it("requires a gate, evidence and checklist for every phase", () => {
    for (const phase of canonicalWorkflowPhases) {
      expect(phase.gate.length).toBeGreaterThan(20);
      expect(phase.checklist.length).toBeGreaterThanOrEqual(8);
      expect(phase.evidence.length).toBeGreaterThan(0);
      expect(phase.requiredPermissionKey).toMatch(/^workflow\./);
    }
  });

  it("defines the two mandatory internal gates and safety lifecycle state", () => {
    expect(vesselEntryReadinessGate.requirements.length).toBeGreaterThanOrEqual(8);
    expect(finalReinstatementGate.requirements.length).toBeGreaterThanOrEqual(7);
    expect(workflowLifecycleStates).toContain("SAFETY_HOLD");
    expect(workflowLifecycleStates.at(-1)).toBe("SAFETY_HOLD");
  });
});
