import { describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({
  blindPhaseOrder: ["Broken / Preparation", "Assembly", "Tight & Torque", "Final Tight", "Inspection Ready"],
  blindPriorityOrder: ["Low", "Normal", "High", "Critical"],
  getAccessControlModel: vi.fn(async () => ({
    permissionGroups: [
      {
        group: "Workflow & Sign-off",
        permissions: [
          { key: "workflow.approve", label: "Approve task", description: "Apply approval on assigned phases", group: "Workflow & Sign-off" },
        ],
      },
    ],
    roles: [
      {
        key: "technician",
        name: "Technician",
        subtitle: "Field execution and blind status updates",
        members: 18,
        color: "#f59e0b",
        permissionKeys: ["workflow.approve"],
        menuKeys: ["dashboard", "blinds"],
        phaseKeys: ["assembly"],
      },
    ],
  })),
  getAllWorkflows: vi.fn(async () => []),
  getWorkflowById: vi.fn(async () => undefined),
  upsertWorkflow: vi.fn(async (input) => input),
  deleteWorkflow: vi.fn(async () => undefined),
  getAreas: vi.fn(async () => []),
  getAreaById: vi.fn(async () => undefined),
  createArea: vi.fn(async (input) => input),
  getAllProjects: vi.fn(async () => []),
  getProjectsByArea: vi.fn(async () => []),
  getProjectDetail: vi.fn(async () => undefined),
  createProject: vi.fn(async (input) => input),
  addBlindToProject: vi.fn(async (input) => input),
  bulkAddBlindsToProject: vi.fn(async (_projectId, blinds) => ({ created: blinds, count: blinds.length })),
  canUserEditProjectPhase: vi.fn(async () => true),
  updateBlindInProject: vi.fn(async (input) => input),
  getProjectSettings: vi.fn(async (projectId: string) => ({ projectId, phaseOwners: [] })),
  updateProjectSettings: vi.fn(async (projectId: string, phaseOwners) => ({ projectId, phaseOwners })),
}));

import { appRouter } from "./routers";
import { getAccessControlModel, upsertWorkflow } from "./db";

const createCaller = () =>
  appRouter.createCaller({
    req: {} as never,
    res: { clearCookie: vi.fn() } as never,
    user: {
      openId: "test-user",
      role: "user",
      name: "Workflow Tester",
      email: "tester@example.com",
      avatarUrl: null,
      loginMethod: "test",
    },
  });

const validWorkflow = {
  id: "wf-contract-test",
  name: "Contract Test Workflow",
  description: "Verifies the workflow API accepts DB-backed role and permission references.",
  status: "Draft" as const,
  projectType: "Test",
  version: "1.0",
  phases: [
    {
      id: "phase-contract-test",
      label: "Assembly approval",
      phaseKey: "assembly" as const,
      roleKey: "technician" as const,
      requiredPermissionKey: "workflow.approve",
      gate: "Technician must approve the assembly step.",
      slaHours: 8,
      evidence: ["QR scan"],
      automation: "Notify QC when complete",
      color: "#f59e0b",
      isCritical: false,
    },
  ],
};

describe("workflow and access-control API contracts", () => {
  it("returns the DB-backed access-control model", async () => {
    const caller = createCaller();

    const model = await caller.accessControl.model();

    expect(getAccessControlModel).toHaveBeenCalledTimes(1);
    expect(model.roles[0]?.key).toBe("technician");
    expect(model.permissionGroups[0]?.permissions[0]?.key).toBe("workflow.approve");
  });

  it("saves a workflow with typed role and permission references", async () => {
    const caller = createCaller();

    const saved = await caller.workflow.save(validWorkflow);

    expect(upsertWorkflow).toHaveBeenCalledWith(validWorkflow, "test-user");
    expect(saved.phases[0]?.roleKey).toBe("technician");
  });

  it("persists the exact phase order submitted after a drag-and-drop reorder", async () => {
    const caller = createCaller();
    const reorderedWorkflow = {
      ...validWorkflow,
      phases: [
        {
          ...validWorkflow.phases[0],
          id: "phase-final-review",
          label: "Final review",
          phaseKey: "inspectionReady" as const,
        },
        {
          ...validWorkflow.phases[0],
          id: "phase-field-work",
          label: "Field work",
          phaseKey: "assembly" as const,
        },
        {
          ...validWorkflow.phases[0],
          id: "phase-request-check",
          label: "Request check",
          phaseKey: "broken" as const,
        },
      ],
    };

    const saved = await caller.workflow.save(reorderedWorkflow);

    expect(upsertWorkflow).toHaveBeenCalledWith(reorderedWorkflow, "test-user");
    expect(saved.phases.map((phase) => phase.id)).toEqual(["phase-final-review", "phase-field-work", "phase-request-check"]);
  });

  it("rejects an unknown role key before it reaches the database layer", async () => {
    const caller = createCaller();

    await expect(
      caller.workflow.save({
        ...validWorkflow,
        phases: [{ ...validWorkflow.phases[0], roleKey: "unregistered-role" }],
      } as never),
    ).rejects.toThrow();
  });
});
