/**
 * server/routers/index.ts
 * ───────────────────────
 * Assembles the root appRouter from all feature routers.
 *
 * Router map:
 *   system          → built-in system procedures (notifications, etc.)
 *   auth            → login state, logout
 *   accessControl   → roles, permissions, user management, registration
 *   areas           → plant areas CRUD
 *   projects        → projects, blinds, phase approvals, settings
 *   workflow        → workflow template CRUD
 *   settings        → system / default-tag / certificate settings
 */

import { systemRouter } from "../_core/systemRouter";
import { router } from "../_core/trpc";
import { accessControlRouter } from "./access-control";
import { areasRouter } from "./areas";
import { authRouter } from "./auth";
import { projectsRouter } from "./projects";
import { settingsRouter } from "./settings";
import { workflowRouter } from "./workflows";
import { notificationsRouter } from "./notifications";
import { reportsRouter } from "./reports";
import { profileRouter } from "./profile";
import { slipBlindsRouter } from "./slipBlinds";
import { featureTogglesRouter } from "./featureToggles";
import { auditLogsRouter } from "./auditLogs";
import { workflowRuntimeRouter } from "./workflowRuntime";
import { certificatesRouter } from "./certificates";

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts
  // all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,

  // Standalone email/password auth (replaces Manus OAuth inline router)
  auth: authRouter,

  accessControl: accessControlRouter,
  areas: areasRouter,
  projects: projectsRouter,
  workflow: workflowRouter,
  settings: settingsRouter,
  notifications: notificationsRouter,
  reports: reportsRouter,
  profile: profileRouter,
  slipBlinds: slipBlindsRouter,
  featureToggles: featureTogglesRouter,
  auditLogs: auditLogsRouter,
  workflowRuntime: workflowRuntimeRouter,
  certificates: certificatesRouter,
});

export type AppRouter = typeof appRouter;
