/**
 * server/routers.ts
 * ─────────────────
 * Backward-compatibility barrel.
 * All router logic has been split into server/routers/*.ts
 *
 * Import from here as before:
 *   import { appRouter, AppRouter } from "./routers";
 */

export { appRouter } from "./routers/index";
export type { AppRouter } from "./routers/index";
