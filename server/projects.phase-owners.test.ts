import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const dbMock = vi.hoisted(() => ({
  addBlindToProject: vi.fn(),
  bulkAddBlindsToProject: vi.fn(),
  canUserEditProjectPhase: vi.fn(),
  createArea: vi.fn(),
  createProject: vi.fn(),
  deleteWorkflow: vi.fn(),
  getAccessControlModel: vi.fn(),
  getAllProjects: vi.fn(),
  getAllWorkflows: vi.fn(),
  getAreaById: vi.fn(),
  getAreas: vi.fn(),
  getProjectDetail: vi.fn(),
  getProjectSettings: vi.fn(),
  getBlindDetail: vi.fn(),
  getAssignableProjectUsers: vi.fn(),
  getProjectsByArea: vi.fn(),
  setBlindPhaseApproval: vi.fn(),
  getWorkflowById: vi.fn(),
  updateBlindInProject: vi.fn(),
  updateProjectSettings: vi.fn(),
  upsertWorkflow: vi.fn(),
  blindPhaseOrder: ["Broken / Preparation", "Assembly", "Tight & Torque", "Final Tight", "Inspection Ready"],
  blindPriorityOrder: ["Low", "Normal", "High", "Critical"],
  getAllUsers: vi.fn(),
  createNotification: vi.fn(),
  broadcastNotification: vi.fn(),
  countUnreadNotifications: vi.fn(),
  getNotificationsForUser: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  deleteNotificationById: vi.fn(),
}));

vi.mock("./db", () => dbMock);

type RoutersModule = typeof import("./routers");
let appRouter: RoutersModule["appRouter"];

function createUserContext(role: "user" | "admin" = "user"): TrpcContext {
  return {
    user: {
      id: 7,
      openId: "operator-open-id",
      email: "operator@example.com",
      name: "Operator",
      loginMethod: "manus",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

const validBlindInput = {
  projectId: "PRJ-1027",
  tag: "BLD-9001",
  type: "Slip Blind",
  size: "12 in",
  rate: "150#",
  phase: "Broken / Preparation" as const,
  owner: "Technician",
  priority: "Normal" as const,
  equipment: "SGP-04-FG-9001",
  location: "Train header",
  isolationPoint: "Upstream flange",
  notes: "Prepared from test",
};

describe("projects phase-owner procedures", () => {
  beforeAll(async () => {
    ({ appRouter } = await import("./routers"));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.canUserEditProjectPhase.mockResolvedValue(true);
    dbMock.getProjectDetail.mockResolvedValue({
      project: { id: "PRJ-1027" },
      blinds: [{ ...validBlindInput, phase: "Assembly", updatedAt: new Date() }],
      settings: { projectId: "PRJ-1027", slipBlindGateRequired: true, phaseOwners: [] },
      metrics: {},
    });
    dbMock.getProjectSettings.mockResolvedValue({ projectId: "PRJ-1027", slipBlindGateRequired: false, phaseOwners: [] });
    dbMock.getBlindDetail.mockResolvedValue({ blind: { ...validBlindInput, updatedAt: new Date() }, logs: [], phaseTimeline: [], project: { id: "PRJ-1027" }, settings: { projectId: "PRJ-1027", slipBlindGateRequired: true, phaseOwners: [] } });
    dbMock.addBlindToProject.mockResolvedValue({ ...validBlindInput, updatedAt: new Date() });
    dbMock.bulkAddBlindsToProject.mockResolvedValue({ created: [], count: 2 });
    dbMock.updateBlindInProject.mockResolvedValue({ ...validBlindInput, updatedAt: new Date() });
    dbMock.setBlindPhaseApproval.mockResolvedValue({ projectId: "PRJ-1027", tag: "BLD-9001", phase: "Assembly", approved: true, approvedByName: "Operator", approvedAt: Date.now(), note: "Ready for next step" });
    dbMock.getAllUsers.mockResolvedValue([]);
    dbMock.createNotification.mockResolvedValue(undefined);
    dbMock.broadcastNotification.mockResolvedValue(undefined);
    dbMock.countUnreadNotifications.mockResolvedValue(0);
    dbMock.getNotificationsForUser.mockResolvedValue([]);
    dbMock.markNotificationRead.mockResolvedValue(undefined);
    dbMock.markAllNotificationsRead.mockResolvedValue(undefined);
    dbMock.deleteNotificationById.mockResolvedValue(undefined);
  });

  it("blocks single blind creation when the selected phase belongs to another owner", async () => {
    dbMock.canUserEditProjectPhase.mockResolvedValue(false);
    const caller = appRouter.createCaller(createUserContext());

    await expect(caller.projects.addBlind(validBlindInput)).rejects.toThrow("Only the configured phase owner can add or update blinds in this phase.");
    expect(dbMock.addBlindToProject).not.toHaveBeenCalled();
  });

  it("blocks bulk import when any pasted blind phase is not assigned to the acting user", async () => {
    dbMock.canUserEditProjectPhase.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const caller = appRouter.createCaller(createUserContext());

    await expect(caller.projects.bulkAddBlinds({
      projectId: "PRJ-1027",
      blinds: [
        { ...validBlindInput, tag: "BLD-9002", phase: "Broken / Preparation" },
        { ...validBlindInput, tag: "BLD-9003", phase: "Final Tight" },
      ],
    })).rejects.toThrow("Bulk import includes phases assigned to another owner.");
    expect(dbMock.bulkAddBlindsToProject).not.toHaveBeenCalled();
  });

  it("blocks direct phase changes and requires the canonical workflow action", async () => {
    const caller = appRouter.createCaller(createUserContext());

    await expect(caller.projects.updateBlind({
      projectId: "PRJ-1027",
      tag: "BLD-9001",
      phase: "Final Tight",
      owner: "QC Inspector",
    })).rejects.toThrow("Direct phase changes are disabled. Use the canonical workflow action in Blind Detail.");
    expect(dbMock.updateBlindInProject).not.toHaveBeenCalled();
  });

  it("saves multiple phase assignees with SSO display metadata and no editable owner role", async () => {
    dbMock.updateProjectSettings.mockResolvedValue({ projectId: "PRJ-1027", phaseOwners: [] });
    const caller = appRouter.createCaller(createUserContext("admin"));

    await caller.projects.settings.update({
      projectId: "PRJ-1027",
      slipBlindGateRequired: true,
      phaseOwners: [
        {
          phase: "Broken / Preparation",
          phaseColor: "#0e7490",
          owners: [
            { openId: "foreman-open-id", name: "Metal Foreman", email: "foreman@example.com", avatarUrl: "https://example.com/foreman.png" },
            { openId: "qc-open-id", name: "QC Inspector", email: "qc@example.com", avatarUrl: "https://example.com/qc.png" },
          ],
        },
      ],
    });

    expect(dbMock.updateProjectSettings).toHaveBeenCalledWith("PRJ-1027", [
      {
        phase: "Broken / Preparation",
        phaseColor: "#0e7490",
        owners: [
          { openId: "foreman-open-id", name: "Metal Foreman", email: "foreman@example.com", avatarUrl: "https://example.com/foreman.png" },
          { openId: "qc-open-id", name: "QC Inspector", email: "qc@example.com", avatarUrl: "https://example.com/qc.png" },
        ],
      },
    ], "operator-open-id", true);
  });

  it("allows Slip Blind registration and defers conditional approval to the final workflow", async () => {
    dbMock.getProjectSettings.mockResolvedValue({ projectId: "PRJ-1027", slipBlindGateRequired: true, phaseOwners: [] });
    const caller = appRouter.createCaller(createUserContext());

    await caller.projects.addBlind(validBlindInput);

    expect(dbMock.addBlindToProject).toHaveBeenCalledWith(
      validBlindInput,
      expect.objectContaining({ openId: "operator-open-id" }),
    );
  });

  it("returns the dedicated blind detail contract for the Details page", async () => {
    const caller = appRouter.createCaller(createUserContext());

    await caller.projects.blindDetail({ projectId: "PRJ-1027", tag: "BLD-9001" });

    expect(dbMock.getBlindDetail).toHaveBeenCalledWith("PRJ-1027", "BLD-9001");
  });

  it("routes electronic phase approval with acting user metadata and optional note", async () => {
    const caller = appRouter.createCaller(createUserContext());

    await caller.projects.approveBlindPhase({
      projectId: "PRJ-1027",
      tag: "BLD-9001",
      phase: "Assembly",
      approved: true,
      note: "Ready for next step",
    });

    expect(dbMock.setBlindPhaseApproval).toHaveBeenCalledWith({
      projectId: "PRJ-1027",
      tag: "BLD-9001",
      phase: "Assembly",
      approved: true,
      note: "Ready for next step",
    }, expect.objectContaining({ openId: "operator-open-id", name: "Operator" }));
  });

  it("maps electronic approval ownership failures to FORBIDDEN errors", async () => {
    dbMock.setBlindPhaseApproval.mockRejectedValue(new Error("Only the configured phase owner can approve this blind phase."));
    const caller = appRouter.createCaller(createUserContext());

    await expect(caller.projects.approveBlindPhase({
      projectId: "PRJ-1027",
      tag: "BLD-9001",
      phase: "Final Tight",
      approved: false,
      note: null,
    })).rejects.toThrow("Only the configured phase owner can approve this blind phase.");
  });
});
