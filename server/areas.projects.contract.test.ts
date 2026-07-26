import { describe, expect, it, vi } from "vitest";

const sampleAreas = [
  {
    id: 1,
    name: "North Processing Area",
    code: "NPA",
    description: "Primary upstream blind execution area.",
    location: "North field",
    isActive: true,
    projectCount: 2,
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
  },
  {
    id: 2,
    name: "Utilities Area",
    code: "UTA",
    description: "Utilities and supporting systems.",
    location: "Utility corridor",
    isActive: true,
    projectCount: 1,
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
  },
];

const sampleProjects = [
  {
    id: "SBTS-NPA-001",
    name: "NPA Blind Scope",
    areaId: 1,
    areaName: "North Processing Area",
    areaCode: "NPA",
    status: "Active" as const,
    blindsCount: 42,
    progress: 68,
    description: "Execution scope for north processing blinds.",
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
  },
];

const sampleProjectDetail = {
  project: sampleProjects[0],
  blinds: [
    {
      tag: "BLD-9001",
      projectId: "SBTS-NPA-001",
      type: "Spectacle Blind",
      size: "24 in",
      phase: "Tight & Torque" as const,
      owner: "T&I Engineer",
      priority: "Critical" as const,
      equipment: "NPA-24-GS-9001",
      location: "North inlet header",
      isolationPoint: "Upstream flange set NPA-9001-A",
      notes: "Torque sheet required before final tight.",
      updatedAt: 1_700_000_000_000,
    },
    {
      tag: "BLD-9002",
      projectId: "SBTS-NPA-001",
      type: "Spacer",
      size: "10 in",
      phase: "Inspection Ready" as const,
      owner: "QC Inspector",
      priority: "High" as const,
      equipment: "NPA-10-VT-9002",
      location: "Vent header branch",
      isolationPoint: "Branch flange NPA-9002-C",
      notes: "Ready for package review.",
      updatedAt: 1_700_000_000_000,
    },
  ],
  metrics: {
    registeredBlinds: 2,
    plannedBlinds: 42,
    highPriorityBlinds: 2,
    criticalBlinds: 1,
    inspectionReadyBlinds: 1,
    phaseCounts: {
      "Broken / Preparation": 0,
      Assembly: 0,
      "Tight & Torque": 1,
      "Final Tight": 0,
      "Inspection Ready": 1,
    },
    priorityCounts: {
      Low: 0,
      Normal: 0,
      High: 1,
      Critical: 1,
    },
    nextAction: "Close critical torque and inspection-ready items before handover.",
  },
};

vi.mock("./db", () => ({
  blindPhaseOrder: ["Broken / Preparation", "Assembly", "Tight & Torque", "Final Tight", "Inspection Ready"],
  blindPriorityOrder: ["Low", "Normal", "High", "Critical"],
  getAccessControlModel: vi.fn(async () => ({ permissionGroups: [], roles: [] })),
  getAllWorkflows: vi.fn(async () => []),
  getWorkflowById: vi.fn(async () => undefined),
  upsertWorkflow: vi.fn(async (input) => input),
  deleteWorkflow: vi.fn(async () => undefined),
  getAreas: vi.fn(async () => sampleAreas),
  getAreaById: vi.fn(async (id: number) => sampleAreas.find(area => area.id === id)),
  createArea: vi.fn(async (input) => ({ id: 3, projectCount: 0, createdAt: 1_700_000_000_000, updatedAt: 1_700_000_000_000, ...input, isActive: input.isActive ?? true })),
  getAllProjects: vi.fn(async () => sampleProjects),
  getProjectsByArea: vi.fn(async (areaId: number) => sampleProjects.filter(project => project.areaId === areaId)),
  getProjectDetail: vi.fn(async (projectId: string) => (projectId === sampleProjectDetail.project.id ? sampleProjectDetail : undefined)),
  createProject: vi.fn(async (input) => ({ ...sampleProjects[0], ...input, areaName: "North Processing Area", areaCode: "NPA", createdAt: 1_700_000_000_000, updatedAt: 1_700_000_000_000 })),
  addBlindToProject: vi.fn(async (input) => ({ ...input, updatedAt: 1_700_000_000_000 })),
  bulkAddBlindsToProject: vi.fn(async (_projectId, blinds) => ({ created: blinds, count: blinds.length })),
  canUserEditProjectPhase: vi.fn(async () => true),
  updateBlindInProject: vi.fn(async (input) => ({ ...sampleProjectDetail.blinds[0], ...input })),
  getProjectSettings: vi.fn(async (projectId: string) => ({ projectId, phaseOwners: [] })),
  updateProjectSettings: vi.fn(async (projectId: string, phaseOwners) => ({ projectId, phaseOwners })),
  getAllUsers: vi.fn(async () => []),
  createNotification: vi.fn(async () => undefined),
  broadcastNotification: vi.fn(async () => undefined),
  countUnreadNotifications: vi.fn(async () => 0),
  getNotificationsForUser: vi.fn(async () => []),
  markNotificationRead: vi.fn(async () => undefined),
  markAllNotificationsRead: vi.fn(async () => undefined),
  deleteNotificationById: vi.fn(async () => undefined),
}));

import { appRouter } from "./routers";
import { createArea, createProject, getAreaById, getAreas, getProjectDetail, getProjectsByArea } from "./db";

const createCaller = () =>
  appRouter.createCaller({
    req: {} as never,
    res: { clearCookie: vi.fn() } as never,
    user: {
      openId: "area-project-test-user",
      role: "user",
      name: "Area Project Tester",
      email: "area-project@example.com",
      avatarUrl: null,
      loginMethod: "test",
    },
  });

describe("areas and projects API contracts", () => {
  it("returns areas with project counts for the Areas page cards", async () => {
    const caller = createCaller();

    const areas = await caller.areas.list();

    expect(getAreas).toHaveBeenCalledTimes(1);
    expect(areas).toHaveLength(2);
    expect(areas[0]?.projectCount).toBe(2);
    expect(areas[0]?.code).toBe("NPA");
  });

  it("returns a specific area and its linked projects for contextual navigation", async () => {
    const caller = createCaller();

    const area = await caller.areas.getById({ id: 1 });
    const projects = await caller.projects.listByArea({ areaId: 1 });

    expect(getAreaById).toHaveBeenCalledWith(1);
    expect(getProjectsByArea).toHaveBeenCalledWith(1);
    expect(area?.name).toBe("North Processing Area");
    expect(projects).toHaveLength(1);
    expect(projects[0]?.areaCode).toBe("NPA");
  });

  it("rejects invalid area identifiers before hitting database helpers", async () => {
    const caller = createCaller();

    await expect(caller.projects.listByArea({ areaId: 0 })).rejects.toThrow();
    await expect(caller.areas.getById({ id: -4 })).rejects.toThrow();

    expect(getProjectsByArea).not.toHaveBeenCalledWith(0);
    expect(getAreaById).not.toHaveBeenCalledWith(-4);
  });

  it("returns a project detail package with linked blind records and operational metrics", async () => {
    const caller = createCaller();

    const detail = await caller.projects.detail({ id: "SBTS-NPA-001" });

    expect(getProjectDetail).toHaveBeenCalledWith("SBTS-NPA-001");
    expect(detail?.project.id).toBe("SBTS-NPA-001");
    expect(detail?.blinds).toHaveLength(2);
    expect(detail?.blinds[0]?.tag).toBe("BLD-9001");
    expect(detail?.metrics.registeredBlinds).toBe(2);
    expect(detail?.metrics.criticalBlinds).toBe(1);
    expect(detail?.metrics.phaseCounts["Inspection Ready"]).toBe(1);
  });

  it("rejects invalid project detail identifiers before hitting database helpers", async () => {
    const caller = createCaller();

    await expect(caller.projects.detail({ id: "" })).rejects.toThrow();

    expect(getProjectDetail).not.toHaveBeenCalledWith("");
  });

  it("validates create contracts for area and project creation", async () => {
    const caller = createCaller();

    const createdArea = await caller.areas.create({
      name: "Inspection Yard",
      code: "IYA",
      description: "Temporary inspection and staging area.",
      location: "South yard",
      isActive: true,
    });

    const createdProject = await caller.projects.create({
      id: "SBTS-IYA-001",
      name: "Inspection Yard Blind Package",
      areaId: createdArea.id,
      status: "Planning",
      blindsCount: 12,
      progress: 5,
      description: "Initial project package for the new area.",
    });

    expect(createArea).toHaveBeenCalledWith(expect.objectContaining({ code: "IYA" }));
    expect(createProject).toHaveBeenCalledWith(expect.objectContaining({ areaId: createdArea.id, progress: 5 }));
    expect(createdProject.areaName).toBe("North Processing Area");
  });
});
