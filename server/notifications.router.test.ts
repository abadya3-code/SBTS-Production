import { beforeEach, describe, expect, it, vi } from "vitest";

const notificationDb = vi.hoisted(() => ({
  getNotificationsForUser: vi.fn(),
  countUnreadNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  archiveNotification: vi.fn(),
  restoreNotification: vi.fn(),
  deleteNotificationById: vi.fn(),
}));

vi.mock("./db/notifications", () => notificationDb);
vi.mock("./db/workflowRuntime", () => ({
  getWorkflowActorAccess: vi.fn(),
}));

import { notificationsRouter } from "./routers/notifications";

const ownerContext = {
  req: {} as never,
  res: { clearCookie: vi.fn() } as never,
  user: {
    openId: "notification-owner",
    role: "user",
    name: "Notification Owner",
    email: "owner@example.com",
    avatarUrl: null,
    loginMethod: "test",
  },
  access: { roleKeys: ["operator"], permissionKeys: [] },
};

const createCaller = () => notificationsRouter.createCaller(ownerContext);

describe("notifications API contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    notificationDb.getNotificationsForUser.mockResolvedValue([]);
    notificationDb.countUnreadNotifications.mockResolvedValue(0);
    notificationDb.markNotificationRead.mockResolvedValue(undefined);
    notificationDb.markAllNotificationsRead.mockResolvedValue(undefined);
    notificationDb.archiveNotification.mockResolvedValue(undefined);
    notificationDb.restoreNotification.mockResolvedValue(undefined);
    notificationDb.deleteNotificationById.mockResolvedValue(undefined);
  });

  it("passes active/archive, unread, type, and priority filters with user ownership", async () => {
    notificationDb.getNotificationsForUser.mockResolvedValueOnce([
      {
        id: 41,
        recipientOpenId: "notification-owner",
        actorOpenId: "safety-lead",
        actorName: "Safety Lead",
        type: "qr_token_rotated",
        priority: "warning",
        title: "QR token rotated",
        body: "Replace the controlled field tag.",
        linkUrl: "/projects/PRJ-001/blinds/BLD-001",
        projectId: "PRJ-001",
        blindTag: "BLD-001",
        isRead: 0,
        readAt: null,
        isArchived: 1,
        archivedAt: new Date("2026-08-01T08:00:00Z"),
        createdAt: new Date("2026-08-01T07:00:00Z"),
      },
    ]);

    const result = await createCaller().list({
      scope: "archived",
      unreadOnly: true,
      type: "qr_token_rotated",
      priority: "warning",
      limit: 25,
    });

    expect(notificationDb.getNotificationsForUser).toHaveBeenCalledWith(
      "notification-owner",
      {
        scope: "archived",
        unreadOnly: true,
        type: "qr_token_rotated",
        priority: "warning",
        limit: 25,
      }
    );
    expect(result[0]).toMatchObject({
      id: 41,
      priority: "warning",
      isRead: false,
      isArchived: true,
      projectId: "PRJ-001",
      blindTag: "BLD-001",
    });
  });

  it("never accepts a recipient override for owned mutations", async () => {
    const caller = createCaller();

    await caller.markRead({ id: 11, recipientOpenId: "another-user" } as never);
    await caller.archive({ id: 12, recipientOpenId: "another-user" } as never);
    await caller.restore({ id: 13, recipientOpenId: "another-user" } as never);
    await caller.delete({ id: 14, recipientOpenId: "another-user" } as never);

    expect(notificationDb.markNotificationRead).toHaveBeenCalledWith(
      11,
      "notification-owner"
    );
    expect(notificationDb.archiveNotification).toHaveBeenCalledWith(
      12,
      "notification-owner"
    );
    expect(notificationDb.restoreNotification).toHaveBeenCalledWith(
      13,
      "notification-owner"
    );
    expect(notificationDb.deleteNotificationById).toHaveBeenCalledWith(
      14,
      "notification-owner"
    );
  });

  it("rejects invalid identifiers before a mutation reaches the database", async () => {
    await expect(createCaller().archive({ id: 0 })).rejects.toThrow();
    await expect(createCaller().delete({ id: -1 })).rejects.toThrow();

    expect(notificationDb.archiveNotification).not.toHaveBeenCalled();
    expect(notificationDb.deleteNotificationById).not.toHaveBeenCalled();
  });

  it("uses the current user's active unread count", async () => {
    notificationDb.countUnreadNotifications.mockResolvedValueOnce(6);

    await expect(createCaller().unreadCount()).resolves.toEqual({ count: 6 });
    expect(notificationDb.countUnreadNotifications).toHaveBeenCalledWith(
      "notification-owner"
    );
  });
});
