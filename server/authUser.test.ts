import { describe, expect, it } from "vitest";
import type { User } from "../drizzle/schema";
import { toAuthUser } from "./_core/authUser";

const databaseUser = {
  id: 7,
  openId: "user-7",
  name: "Field Engineer",
  email: "field@example.com",
  avatarUrl: null,
  role: "user",
  userStatus: "active",
  department: "Maintenance",
  specialty: "Mechanical",
  employeeNumber: "EMP-7",
  preferredTheme: "standard",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  lastSignedIn: new Date("2026-07-31T00:00:00Z"),
  passwordHash: "$2b$secret-hash",
  failedLoginAttempts: 4,
  lockedUntil: new Date("2026-08-01T00:00:00Z"),
  passwordChangedAt: new Date("2026-07-30T00:00:00Z"),
  registrationNote: "internal note",
  approvedByOpenId: "admin-1",
} as User;

describe("authentication user DTO", () => {
  it("returns an explicit browser-safe shape", () => {
    const safeUser = toAuthUser(databaseUser);
    expect(safeUser).toMatchObject({
      id: 7,
      openId: "user-7",
      email: "field@example.com",
      userStatus: "active",
    });
  });

  it.each([
    "passwordHash",
    "failedLoginAttempts",
    "lockedUntil",
    "passwordChangedAt",
    "registrationNote",
    "approvedByOpenId",
  ])("never exposes %s", (field) => {
    expect(toAuthUser(databaseUser)).not.toHaveProperty(field);
  });
});
