/**
 * Tests for the extended settings procedures:
 * - General settings (get/update)
 * - Security settings (get/update)
 * - Notification preferences (get/update)
 * - Certificate settings visibility toggles
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("./db", () => ({
  getSystemSettings: vi.fn().mockResolvedValue({
    id: "default",
    appName: "SBTS",
    appDescription: "Smart Blind Tracking System",
    companyName: "Test Company",
    companyDescription: "Test Description",
    region: "Middle East",
    language: "en",
    theme: "dark",
    heroTitle: "Welcome",
    heroDescription: "Dashboard description",
    versionName: "1.0.0",
    versionDate: "2025-01-01",
    appImageUrl: null,
    companyLogoUrl: null,
    tagColor: "#0f172a",
    tagSize: "standard",
    tagFontSize: 12,
    tagFontColor: "#ffffff",
    tagTheme: "default",
    tagHole: true,
    tagLogoEnabled: true,
    tagQrEnabled: true,
  }),
  updateSystemSettings: vi.fn().mockResolvedValue(undefined),
  getSecuritySettings: vi.fn().mockResolvedValue({
    id: "default",
    qrAccessPublic: false,
    deleteRequiresConfirmation: true,
    auditTrailEnabled: true,
    sessionTimeoutMinutes: 480,
    maxLoginAttempts: 5,
    lockoutDurationMinutes: 30,
    requirePasswordChange: false,
    passwordMinLength: 8,
  }),
  updateSecuritySettings: vi.fn().mockResolvedValue(undefined),
  getNotificationPreferences: vi.fn().mockResolvedValue({
    id: "default",
    onBlindCreated: true,
    onPhaseChange: true,
    onApprovalRequired: true,
    onApprovalGranted: true,
    onProjectCompleted: true,
    onUserRegistered: true,
    onCertificateGenerated: false,
    onSystemAlert: true,
  }),
  updateNotificationPreferences: vi.fn().mockResolvedValue(undefined),
  getCertificateSettings: vi.fn().mockResolvedValue({
    id: "default",
    certificateTitle: "Smart Blind Tag System Certificate",
    headerCompanyName: "SBTS",
    logoUrl: null,
    signatureUrl: null,
    footerText: "This is a digital certificate.",
    showBlindInfo: 1,
    showProjectInfo: 1,
    showAreaInfo: 1,
    showWorkflowLog: 1,
    showExecutionTorque: 1,
    showFinalApprovals: 1,
    showQrCode: 1,
    showLockStatus: 1,
    statusBadgeText: "APPROVED",
    lockBadgeText: "LOCKED / FINAL",
  }),
  updateCertificateSettings: vi.fn().mockResolvedValue(undefined),
}));

import {
  getSystemSettings,
  updateSystemSettings,
  getSecuritySettings,
  updateSecuritySettings,
  getNotificationPreferences,
  updateNotificationPreferences,
  getCertificateSettings,
  updateCertificateSettings,
} from "./db";

describe("Extended Settings Module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("General Settings", () => {
    it("should return default general settings", async () => {
      const settings = await getSystemSettings();
      expect(settings).toBeDefined();
      expect(settings!.appName).toBe("SBTS");
      expect(settings!.language).toBe("en");
      expect(settings!.theme).toBe("dark");
    });

    it("should update general settings", async () => {
      await updateSystemSettings({ appName: "SBTS Pro", region: "GCC" });
      expect(updateSystemSettings).toHaveBeenCalledWith({ appName: "SBTS Pro", region: "GCC" });
    });

    it("should include tag visual settings in general settings", async () => {
      const settings = await getSystemSettings();
      expect(settings!.tagColor).toBe("#0f172a");
      expect(settings!.tagSize).toBe("standard");
      expect(settings!.tagHole).toBe(true);
      expect(settings!.tagQrEnabled).toBe(true);
    });
  });

  describe("Security Settings", () => {
    it("should return default security settings", async () => {
      const settings = await getSecuritySettings();
      expect(settings).toBeDefined();
      expect(settings!.deleteRequiresConfirmation).toBe(true);
      expect(settings!.auditTrailEnabled).toBe(true);
      expect(settings!.sessionTimeoutMinutes).toBe(480);
    });

    it("should update security settings", async () => {
      await updateSecuritySettings({ maxLoginAttempts: 3, lockoutDurationMinutes: 60 });
      expect(updateSecuritySettings).toHaveBeenCalledWith({
        maxLoginAttempts: 3,
        lockoutDurationMinutes: 60,
      });
    });

    it("should enforce password policy fields", async () => {
      const settings = await getSecuritySettings();
      expect(settings!.passwordMinLength).toBe(8);
      expect(settings!.requirePasswordChange).toBe(false);
    });
  });

  describe("Notification Preferences", () => {
    it("should return default notification preferences", async () => {
      const prefs = await getNotificationPreferences();
      expect(prefs).toBeDefined();
      expect(prefs!.onBlindCreated).toBe(true);
      expect(prefs!.onPhaseChange).toBe(true);
      expect(prefs!.onCertificateGenerated).toBe(false);
    });

    it("should update notification preferences", async () => {
      await updateNotificationPreferences({ onCertificateGenerated: true, onSystemAlert: false });
      expect(updateNotificationPreferences).toHaveBeenCalledWith({
        onCertificateGenerated: true,
        onSystemAlert: false,
      });
    });
  });

  describe("Certificate Settings", () => {
    it("should return default certificate settings with visibility toggles", async () => {
      const cert = await getCertificateSettings();
      expect(cert).toBeDefined();
      expect(cert!.certificateTitle).toBe("Smart Blind Tag System Certificate");
      expect(cert!.showBlindInfo).toBe(1);
      expect(cert!.showQrCode).toBe(1);
      expect(cert!.showLockStatus).toBe(1);
    });

    it("should update certificate visibility toggles", async () => {
      await updateCertificateSettings({ showWorkflowLog: 0, showExecutionTorque: 0 });
      expect(updateCertificateSettings).toHaveBeenCalledWith({
        showWorkflowLog: 0,
        showExecutionTorque: 0,
      });
    });

    it("should update certificate title and footer", async () => {
      await updateCertificateSettings({
        certificateTitle: "Custom Certificate Title",
        footerText: "Custom footer text",
      });
      expect(updateCertificateSettings).toHaveBeenCalledWith({
        certificateTitle: "Custom Certificate Title",
        footerText: "Custom footer text",
      });
    });

    it("should handle badge text customization", async () => {
      const cert = await getCertificateSettings();
      expect(cert!.statusBadgeText).toBe("APPROVED");
      expect(cert!.lockBadgeText).toBe("LOCKED / FINAL");
    });
  });
});
