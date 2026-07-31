import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";

const PROJECT_ROOT = import.meta.dirname;
const packageJson = JSON.parse(
  fs.readFileSync(path.join(PROJECT_ROOT, "package.json"), "utf8"),
) as { version: string };
const releaseCommit =
  process.env.RAILWAY_GIT_COMMIT_SHA?.trim()
  || process.env.GIT_COMMIT_SHA?.trim()
  || "local";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __SBTS_RELEASE_VERSION__: JSON.stringify(packageJson.version),
    __SBTS_RELEASE_COMMIT__: JSON.stringify(releaseCommit),
  },
  resolve: {
    alias: {
      "@": path.resolve(PROJECT_ROOT, "client", "src"),
      "@shared": path.resolve(PROJECT_ROOT, "shared"),
      "@assets": path.resolve(PROJECT_ROOT, "attached_assets"),
    },
  },
  envDir: PROJECT_ROOT,
  root: path.resolve(PROJECT_ROOT, "client"),
  publicDir: path.resolve(PROJECT_ROOT, "client", "public"),
  build: {
    outDir: path.resolve(PROJECT_ROOT, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    host: true,
    allowedHosts: ["localhost", "127.0.0.1"],
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
