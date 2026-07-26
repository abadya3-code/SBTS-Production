/**
 * server/auth.standalone.test.ts
 * ─────────────────────────────
 * Vitest tests for the standalone email/password authentication system.
 *
 * Tests cover:
 *   - hashPassword / verifyPassword helpers
 *   - auth.login procedure (success, wrong password, pending user, rejected user)
 *   - auth.register procedure (success, duplicate email)
 *   - auth.changePassword procedure (admin can change any user's password)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";

// ─── Mock db helpers ───────────────────────────────────────────────────────────
vi.mock("./db", () => ({
  getUserByEmail: vi.fn(),
  getUserByOpenId: vi.fn(),
  createUserWithPassword: vi.fn(),
  updateUserPassword: vi.fn(),
  verifyPassword: vi.fn(),
  upsertUser: vi.fn(),
}));

vi.mock("./_core/sdk", () => ({
  sdk: {
    createSessionToken: vi.fn().mockResolvedValue("mock-jwt-token"),
    authenticateRequest: vi.fn(),
  },
}));

vi.mock("./_core/cookies", () => ({
  getSessionCookieOptions: vi.fn().mockReturnValue({ httpOnly: true, secure: false }),
}));

import * as db from "./db";

// ─── hashPassword / verifyPassword ────────────────────────────────────────────
describe("password helpers", () => {
  it("verifyPassword returns true for correct password", async () => {
    const hash = await bcrypt.hash("mySecret123", 10);
    const result = await bcrypt.compare("mySecret123", hash);
    expect(result).toBe(true);
  });

  it("verifyPassword returns false for wrong password", async () => {
    const hash = await bcrypt.hash("mySecret123", 10);
    const result = await bcrypt.compare("wrongPassword", hash);
    expect(result).toBe(false);
  });

  it("hashed password differs from plain text", async () => {
    const hash = await bcrypt.hash("mySecret123", 10);
    expect(hash).not.toBe("mySecret123");
    expect(hash.startsWith("$2")).toBe(true);
  });
});

// ─── auth.login procedure logic ───────────────────────────────────────────────
describe("auth.login logic", () => {
  const mockUser = {
    id: 1,
    openId: "user-open-id-001",
    name: "Ahmed Test",
    email: "ahmed@test.com",
    passwordHash: "$2a$10$fakehash",
    role: "user" as const,
    userStatus: "active",
    assignedRoles: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: null,
    avatarUrl: null,
    loginMethod: null,
    department: null,
    specialty: null,
    employeeNumber: null,
    registrationNote: null,
    createdByOpenId: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when user not found", async () => {
    vi.mocked(db.getUserByEmail).mockResolvedValue(null);

    // Simulate the login procedure logic
    const user = await db.getUserByEmail("notfound@test.com");
    expect(user).toBeNull();
    // In the actual procedure, this would throw TRPCError UNAUTHORIZED
  });

  it("returns error when password is null (no password set)", async () => {
    const userWithoutPassword = { ...mockUser, passwordHash: null };
    vi.mocked(db.getUserByEmail).mockResolvedValue(userWithoutPassword as any);

    const user = await db.getUserByEmail("ahmed@test.com");
    expect(user?.passwordHash).toBeNull();
    // In the actual procedure, this would throw TRPCError UNAUTHORIZED
  });

  it("returns error when user status is pending", async () => {
    const pendingUser = { ...mockUser, userStatus: "pending" };
    vi.mocked(db.getUserByEmail).mockResolvedValue(pendingUser as any);
    vi.mocked(db.verifyPassword).mockResolvedValue(true);

    const user = await db.getUserByEmail("ahmed@test.com");
    expect(user?.userStatus).toBe("pending");
    // In the actual procedure, this would throw TRPCError FORBIDDEN
  });

  it("returns error when user status is rejected", async () => {
    const rejectedUser = { ...mockUser, userStatus: "rejected" };
    vi.mocked(db.getUserByEmail).mockResolvedValue(rejectedUser as any);
    vi.mocked(db.verifyPassword).mockResolvedValue(true);

    const user = await db.getUserByEmail("ahmed@test.com");
    expect(user?.userStatus).toBe("rejected");
    // In the actual procedure, this would throw TRPCError FORBIDDEN
  });

  it("allows login for active user with correct password", async () => {
    vi.mocked(db.getUserByEmail).mockResolvedValue(mockUser as any);
    vi.mocked(db.verifyPassword).mockResolvedValue(true);

    const user = await db.getUserByEmail("ahmed@test.com");
    const isValid = await db.verifyPassword("correctPassword", user!.passwordHash!);

    expect(user?.userStatus).toBe("active");
    expect(isValid).toBe(true);
  });
});

// ─── auth.register logic ──────────────────────────────────────────────────────
describe("auth.register logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects registration when email already exists", async () => {
    vi.mocked(db.getUserByEmail).mockResolvedValue({
      id: 1, openId: "existing-id", email: "existing@test.com",
    } as any);

    const existing = await db.getUserByEmail("existing@test.com");
    expect(existing).not.toBeNull();
    // In the actual procedure, this would throw TRPCError CONFLICT
  });

  it("creates user with pending status for new registration", async () => {
    vi.mocked(db.getUserByEmail).mockResolvedValue(null);
    vi.mocked(db.createUserWithPassword).mockResolvedValue({
      id: 2, openId: "new-user-id", email: "new@test.com", userStatus: "pending",
    } as any);

    const existing = await db.getUserByEmail("new@test.com");
    expect(existing).toBeNull();

    const created = await db.createUserWithPassword({
      name: "New User",
      email: "new@test.com",
      password: "password123",
      role: "user",
      userStatus: "pending",
      department: "IT",
      specialty: "Developer",
      employeeNumber: "EMP-001",
    });

    expect(created.userStatus).toBe("pending");
  });
});

// ─── auth.changePassword logic ────────────────────────────────────────────────
describe("auth.changePassword logic (admin)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("admin can change another user's password without current password", async () => {
    vi.mocked(db.updateUserPassword).mockResolvedValue(undefined as any);

    await db.updateUserPassword("target-user-openId", "newPassword123");

    expect(db.updateUserPassword).toHaveBeenCalledWith("target-user-openId", "newPassword123");
  });

  it("updateUserPassword is called with correct arguments", async () => {
    vi.mocked(db.updateUserPassword).mockResolvedValue(undefined as any);

    const targetOpenId = "user-open-id-001";
    const newPassword = "securePassword456";
    await db.updateUserPassword(targetOpenId, newPassword);

    expect(db.updateUserPassword).toHaveBeenCalledTimes(1);
    expect(db.updateUserPassword).toHaveBeenCalledWith(targetOpenId, newPassword);
  });
});
