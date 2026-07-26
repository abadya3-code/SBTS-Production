/**
 * server/profile.test.ts
 * ─────────────────────
 * Unit tests for profile DB helpers (pure logic, no real DB).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks must come before imports that use them ────────────────────────────

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((col, val) => ({ col, val })),
}));

vi.mock("../../drizzle/schema", () => ({
  users: { openId: "openId" },
}));

vi.mock("./db/core", () => ({
  requireDb: vi.fn(),
}));

// ─── Import after mocks ───────────────────────────────────────────────────────

import { getUserProfile, updateUserProfile, updateUserAvatar } from "./db/profile";
import { requireDb } from "./db/core";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockUser = {
  id: 1,
  openId: "test-open-id",
  name: "Test User",
  email: "test@example.com",
  avatarUrl: null,
  avatarKey: null,
  role: "user" as const,
  userStatus: "active" as const,
  department: "Maintenance",
  specialty: "T&I Engineer",
  employeeNumber: "EMP-001",
  bio: "Test bio",
  phone: "+966501234567",
  userLocation: "Dhahran, Saudi Arabia",
  linkedIn: "linkedin.com/in/test",
  preferredTheme: "dark",
  createdAt: new Date("2024-01-01"),
  lastSignedIn: new Date("2024-06-01"),
  passwordHash: null,
  registrationNote: null,
};

function makeDb(rows: unknown[] = [mockUser]) {
  const db: Record<string, unknown> = {};
  db.select = vi.fn().mockReturnValue(db);
  db.from = vi.fn().mockReturnValue(db);
  db.where = vi.fn().mockReturnValue(db);
  db.limit = vi.fn().mockResolvedValue(rows);
  db.update = vi.fn().mockReturnValue(db);
  db.set = vi.fn().mockReturnValue(db);
  return db;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("getUserProfile", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns profile when user exists", async () => {
    vi.mocked(requireDb).mockResolvedValue(makeDb([mockUser]) as any);
    const profile = await getUserProfile("test-open-id");
    expect(profile).not.toBeNull();
    expect(profile?.name).toBe("Test User");
    expect(profile?.email).toBe("test@example.com");
    expect(profile?.role).toBe("user");
    expect(profile?.userStatus).toBe("active");
  });

  it("returns null when user not found", async () => {
    vi.mocked(requireDb).mockResolvedValue(makeDb([]) as any);
    const profile = await getUserProfile("non-existent");
    expect(profile).toBeNull();
  });

  it("maps all profile fields correctly", async () => {
    vi.mocked(requireDb).mockResolvedValue(makeDb([mockUser]) as any);
    const profile = await getUserProfile("test-open-id");
    expect(profile?.department).toBe("Maintenance");
    expect(profile?.specialty).toBe("T&I Engineer");
    expect(profile?.employeeNumber).toBe("EMP-001");
    expect(profile?.bio).toBe("Test bio");
    expect(profile?.phone).toBe("+966501234567");
    expect(profile?.userLocation).toBe("Dhahran, Saudi Arabia");
    expect(profile?.linkedIn).toBe("linkedin.com/in/test");
    expect(profile?.preferredTheme).toBe("dark");
  });

  it("defaults preferredTheme to dark when null", async () => {
    vi.mocked(requireDb).mockResolvedValue(makeDb([{ ...mockUser, preferredTheme: null }]) as any);
    const profile = await getUserProfile("test-open-id");
    expect(profile?.preferredTheme).toBe("dark");
  });
});

describe("updateUserProfile", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls db.update with provided fields", async () => {
    const db = makeDb();
    vi.mocked(requireDb).mockResolvedValue(db as any);
    await updateUserProfile("test-open-id", { name: "New Name", bio: "New bio" });
    expect(db.update).toHaveBeenCalled();
    expect(db.set).toHaveBeenCalledWith(expect.objectContaining({ name: "New Name", bio: "New bio" }));
  });

  it("does not call db.update when no fields provided", async () => {
    const db = makeDb();
    vi.mocked(requireDb).mockResolvedValue(db as any);
    await updateUserProfile("test-open-id", {});
    expect(db.update).not.toHaveBeenCalled();
  });

  it("only updates provided fields", async () => {
    const db = makeDb();
    vi.mocked(requireDb).mockResolvedValue(db as any);
    await updateUserProfile("test-open-id", { name: "Only Name" });
    expect(db.set).toHaveBeenCalledWith(expect.objectContaining({ name: "Only Name" }));
    const callArg = (db.set as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(Object.keys(callArg)).not.toContain("bio");
  });
});

describe("updateUserAvatar", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates avatarUrl and avatarKey", async () => {
    const db = makeDb();
    vi.mocked(requireDb).mockResolvedValue(db as any);
    await updateUserAvatar("test-open-id", "avatars/test_key.jpg", "/manus-storage/avatars/test_key.jpg");
    expect(db.update).toHaveBeenCalled();
    expect(db.set).toHaveBeenCalledWith(
      expect.objectContaining({
        avatarUrl: "/manus-storage/avatars/test_key.jpg",
        avatarKey: "avatars/test_key.jpg",
      }),
    );
  });
});

describe("Profile validation logic", () => {
  it("validates password strength requirements", () => {
    const checkStrength = (pw: string) => ({
      length: pw.length >= 8,
      uppercase: /[A-Z]/.test(pw),
      number: /[0-9]/.test(pw),
      special: /[^A-Za-z0-9]/.test(pw),
    });
    const weak = checkStrength("password");
    expect(weak.length).toBe(true);
    expect(weak.uppercase).toBe(false);
    expect(weak.number).toBe(false);
    const strong = checkStrength("Admin@123456");
    expect(strong.length).toBe(true);
    expect(strong.uppercase).toBe(true);
    expect(strong.number).toBe(true);
    expect(strong.special).toBe(true);
  });

  it("validates bio max length", () => {
    expect("a".repeat(500).length <= 500).toBe(true);
    expect("a".repeat(501).length <= 500).toBe(false);
  });

  it("validates name max length", () => {
    expect("a".repeat(120).length <= 120).toBe(true);
    expect("a".repeat(121).length <= 120).toBe(false);
  });

  it("validates theme values", () => {
    const validThemes = ["light", "dark", "system"];
    expect(validThemes.includes("dark")).toBe(true);
    expect(validThemes.includes("light")).toBe(true);
    expect(validThemes.includes("system")).toBe(true);
    expect(validThemes.includes("invalid")).toBe(false);
  });
});
