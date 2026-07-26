/**
 * server/db.ts
 * ────────────
 * Backward-compatible re-export barrel.
 *
 * All database logic has been split into server/db/ modules:
 *   server/db/core.ts      → connection helpers, upsertUser, getUserByOpenId
 *   server/db/types.ts     → all TypeScript types and interfaces
 *   server/db/seed.ts      → seed data constants and seed functions
 *   server/db/blinds.ts    → blind CRUD, phase approvals, workflow logs
 *   server/db/projects.ts  → areas, projects, project settings
 *   server/db/workflows.ts → workflow template CRUD
 *   server/db/settings.ts  → system/tag/certificate settings
 *   server/db/users.ts     → user management, roles, registration/approval
 *
 * This file exists so that existing imports from "./db" continue to work
 * without any changes to routers.ts or other consumers.
 *
 * New code should import directly from "./db/index" or specific sub-modules.
 */

export * from "./db/index";
