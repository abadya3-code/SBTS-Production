import { describe, expect, it } from "vitest";
import { canActingUserEditAssignedPhase, type ActingProjectUser, type ProjectPhaseOwnerModel } from "./db";

const assignedPhase: ProjectPhaseOwnerModel = {
  projectId: "PRJ-1027",
  phase: "Assembly",
  owners: [
    {
      openId: "metal-foreman-open-id",
      name: "Metal Foreman",
      email: "foreman@example.com",
      avatarUrl: "https://example.com/foreman.png",
    },
    {
      openId: "qc-open-id",
      name: "QC Inspector",
      email: "qc@example.com",
      avatarUrl: "https://example.com/qc.png",
    },
  ],
  ownerName: "Metal Foreman, QC Inspector",
  ownerRole: "phase-assignee",
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

const actingUser = (overrides: Partial<ActingProjectUser>): ActingProjectUser => ({
  openId: "operator-open-id",
  name: "Operator",
  email: "operator@example.com",
  role: "user",
  ...overrides,
});

describe("project phase owner assignment matching", () => {
  it("allows any configured assignee to update the phase by openId", () => {
    expect(canActingUserEditAssignedPhase(assignedPhase, actingUser({ openId: "metal-foreman-open-id" }))).toBe(true);
    expect(canActingUserEditAssignedPhase(assignedPhase, actingUser({ openId: "qc-open-id" }))).toBe(true);
  });

  it("allows a configured assignee matched by SSO email when openId differs", () => {
    expect(canActingUserEditAssignedPhase(assignedPhase, actingUser({ openId: "new-sso-id", email: "qc@example.com" }))).toBe(true);
  });

  it("blocks users who are not among the configured phase assignees", () => {
    expect(canActingUserEditAssignedPhase(assignedPhase, actingUser({ openId: "unassigned-open-id", email: "other@example.com" }))).toBe(false);
  });

  it("keeps avatarUrl as assignee display metadata and ignores ownerRole for matching", () => {
    expect(assignedPhase.owners.map((owner) => owner.avatarUrl)).toEqual([
      "https://example.com/foreman.png",
      "https://example.com/qc.png",
    ]);
    expect(canActingUserEditAssignedPhase({ ...assignedPhase, ownerRole: "unexpected-role" }, actingUser({ openId: "qc-open-id" }))).toBe(true);
  });
});
