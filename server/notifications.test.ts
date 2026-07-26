/**
 * server/notifications.test.ts
 * ─────────────────────────────
 * Unit tests for the in-app notification system helpers.
 * Uses vi.hoisted() to avoid top-level variable hoisting issues.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Hoisted mocks ─────────────────────────────────────────────────────────────
const mockDb = vi.hoisted(() => {
  const mockWhere = vi.fn();
  const mockOrderBy = vi.fn();
  const mockLimit = vi.fn();
  const mockSet = vi.fn();
  const mockValues = vi.fn();
  const mockFrom = vi.fn();

  // Default chain resolutions
  mockLimit.mockResolvedValue([]);
  mockWhere.mockReturnValue({ orderBy: mockOrderBy, limit: mockLimit, where: mockWhere });
  mockOrderBy.mockReturnValue({ limit: mockLimit });
  mockSet.mockReturnValue({ where: mockWhere });
  mockFrom.mockReturnValue({ where: mockWhere, limit: mockLimit });
  mockValues.mockResolvedValue(undefined);

  return {
    insert: vi.fn().mockReturnValue({ values: mockValues }),
    select: vi.fn().mockReturnValue({ from: mockFrom }),
    update: vi.fn().mockReturnValue({ set: mockSet }),
    delete: vi.fn().mockReturnValue({ where: mockWhere }),
    // expose internals for assertions
    _mockValues: mockValues,
    _mockWhere: mockWhere,
    _mockLimit: mockLimit,
    _mockSet: mockSet,
  };
});

vi.mock("./db/core", () => ({
  requireDb: vi.fn().mockResolvedValue(mockDb),
}));

vi.mock("../../drizzle/schema", () => ({
  notifications: {
    id: "id",
    recipientOpenId: "recipientOpenId",
    actorOpenId: "actorOpenId",
    actorName: "actorName",
    type: "type",
    title: "title",
    body: "body",
    linkUrl: "linkUrl",
    projectId: "projectId",
    blindTag: "blindTag",
    isRead: "isRead",
    readAt: "readAt",
    createdAt: "createdAt",
  },
  notificationPreferences: {
    id: "id",
  },
}));

vi.mock("drizzle-orm", () => ({
  and: (...args: unknown[]) => ({ and: args }),
  desc: (col: unknown) => ({ desc: col }),
  eq: (col: unknown, val: unknown) => ({ eq: [col, val] }),
  sql: Object.assign(
    (strings: TemplateStringsArray, ...vals: unknown[]) => ({ sql: strings, vals }),
    { raw: (s: string) => s }
  ),
}));

// ─── Import after mocks ────────────────────────────────────────────────────────
import {
  createNotification,
  broadcastNotification,
  getNotificationsForUser,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotificationById,
} from "./db/notifications";

// ─── Tests ─────────────────────────────────────────────────────────────────────
describe("createNotification", () => {
  beforeEach(() => vi.clearAllMocks());

  it("inserts a notification row with correct required fields", async () => {
    await createNotification({
      recipientOpenId: "user-1",
      actorName: "Admin",
      type: "registration_request",
      title: "New Registration",
      body: "A new user has registered.",
    });
    expect(mockDb.insert).toHaveBeenCalledOnce();
    expect(mockDb._mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientOpenId: "user-1",
        actorName: "Admin",
        type: "registration_request",
        title: "New Registration",
        isRead: 0,
      })
    );
  });

  it("sets optional fields to null when not provided", async () => {
    await createNotification({
      recipientOpenId: "user-2",
      type: "system_announcement",
      title: "Announcement",
      body: "System maintenance tonight.",
    });
    expect(mockDb._mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        actorOpenId: null,
        actorName: null,
        linkUrl: null,
        projectId: null,
        blindTag: null,
      })
    );
  });

  it("passes optional fields when provided", async () => {
    await createNotification({
      recipientOpenId: "user-3",
      actorOpenId: "admin-1",
      actorName: "Admin User",
      type: "phase_changed",
      title: "Phase Updated",
      body: "Blind BLD-001 moved to Assembly.",
      linkUrl: "/projects/PRJ-001",
      projectId: "PRJ-001",
      blindTag: "BLD-001",
    });
    expect(mockDb._mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        actorOpenId: "admin-1",
        linkUrl: "/projects/PRJ-001",
        projectId: "PRJ-001",
        blindTag: "BLD-001",
      })
    );
  });
});

describe("broadcastNotification", () => {
  beforeEach(() => vi.clearAllMocks());

  it("inserts one row per recipient", async () => {
    await broadcastNotification(["user-a", "user-b", "user-c"], {
      type: "project_created",
      title: "New Project",
      body: "A new project was created.",
    });
    expect(mockDb._mockValues).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ recipientOpenId: "user-a" }),
        expect.objectContaining({ recipientOpenId: "user-b" }),
        expect.objectContaining({ recipientOpenId: "user-c" }),
      ])
    );
  });

  it("does nothing when recipients array is empty", async () => {
    await broadcastNotification([], {
      type: "project_created",
      title: "Empty Broadcast",
      body: "No recipients.",
    });
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("sets isRead to 0 for all broadcast recipients", async () => {
    await broadcastNotification(["user-x", "user-y"], {
      type: "system_announcement",
      title: "Maintenance",
      body: "Scheduled downtime tonight.",
    });
    const callArg = mockDb._mockValues.mock.calls[0][0] as Array<{ isRead: number }>;
    expect(callArg.every((row) => row.isRead === 0)).toBe(true);
  });
});

describe("getNotificationsForUser", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns empty array when no notifications exist", async () => {
    mockDb._mockLimit.mockResolvedValueOnce([]);
    const result = await getNotificationsForUser("user-empty");
    expect(result).toEqual([]);
  });

  it("returns notifications for the given user", async () => {
    const mockNotifs = [
      { id: 1, recipientOpenId: "user-1", isRead: 0, title: "Test", body: "Body", type: "system_announcement", createdAt: new Date() },
      { id: 2, recipientOpenId: "user-1", isRead: 1, title: "Test 2", body: "Body 2", type: "phase_changed", createdAt: new Date() },
    ];
    mockDb._mockLimit.mockResolvedValueOnce(mockNotifs);
    const result = await getNotificationsForUser("user-1");
    expect(result).toHaveLength(2);
    expect(result[0]?.title).toBe("Test");
  });
});

describe("markNotificationRead", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls update with isRead=1 and readAt timestamp", async () => {
    await markNotificationRead(42, "user-1");
    expect(mockDb.update).toHaveBeenCalledOnce();
    expect(mockDb._mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ isRead: 1 })
    );
  });
});

describe("markAllNotificationsRead", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls update for all unread notifications of the user", async () => {
    await markAllNotificationsRead("user-1");
    expect(mockDb.update).toHaveBeenCalledOnce();
    expect(mockDb._mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ isRead: 1 })
    );
  });
});

describe("deleteNotificationById", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls delete with the correct id and recipientOpenId guard", async () => {
    await deleteNotificationById(99, "user-1");
    expect(mockDb.delete).toHaveBeenCalledOnce();
  });
});
