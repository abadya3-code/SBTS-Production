/**
 * Vitest tests for Registration & Approval procedures
 * Tests: completeRegistration, pendingUsers, approveUser, rejectUser
 */
import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getPendingUsers: vi.fn().mockResolvedValue([]),
  };
});

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createUserContext(overrides?: Partial<AuthenticatedUser>): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-001",
    email: "user@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };
  return {
    user,
    req: { cookies: {} } as any,
    res: { cookie: () => {}, clearCookie: () => {} } as any,
  };
}

function createAdminContext(): TrpcContext {
  return createUserContext({
    id: 99,
    openId: "admin-user-001",
    email: "admin@example.com",
    name: "Admin User",
    role: "admin",
  });
}

describe("Registration Procedures", () => {
  describe("completeRegistration input validation", () => {
    it("should reject empty employeeNumber", async () => {
      const caller = appRouter.createCaller(createUserContext());
      await expect(
        caller.accessControl.completeRegistration({
          department: "الهندسة الميكانيكية",
          specialty: "مهندس T&I (Turnaround & Inspection)",
          employeeNumber: "",
        })
      ).rejects.toThrow();
    });

    it("should reject missing department", async () => {
      const caller = appRouter.createCaller(createUserContext());
      await expect(
        caller.accessControl.completeRegistration({
          department: "",
          specialty: "مهندس T&I (Turnaround & Inspection)",
          employeeNumber: "EMP-001",
        })
      ).rejects.toThrow();
    });

    it("should reject missing specialty", async () => {
      const caller = appRouter.createCaller(createUserContext());
      await expect(
        caller.accessControl.completeRegistration({
          department: "الهندسة الميكانيكية",
          specialty: "",
          employeeNumber: "EMP-001",
        })
      ).rejects.toThrow();
    });
  });

  describe("pendingUsers - admin only", () => {
    it("should reject non-admin users", async () => {
      const caller = appRouter.createCaller(createUserContext());
      await expect(
        caller.accessControl.pendingUsers()
      ).rejects.toThrow();
    });

    it("should allow admin users to query pending users", async () => {
      const caller = appRouter.createCaller(createAdminContext());
      // This will succeed (returns array, possibly empty in test env)
      const result = await caller.accessControl.pendingUsers();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("approveUser - admin only", () => {
    it("should reject non-admin users from approving", async () => {
      const caller = appRouter.createCaller(createUserContext());
      await expect(
        caller.accessControl.approveUser({ userId: 1 })
      ).rejects.toThrow();
    });
  });

  describe("rejectUser - admin only", () => {
    it("should reject non-admin users from rejecting", async () => {
      const caller = appRouter.createCaller(createUserContext());
      await expect(
        caller.accessControl.rejectUser({ userId: 1 })
      ).rejects.toThrow();
    });
  });
});
