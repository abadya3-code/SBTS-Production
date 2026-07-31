import "dotenv/config";
import { randomUUID } from "node:crypto";
import express from "express";
import { createServer } from "http";
import { sql } from "drizzle-orm";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { getDb } from "../db/core";
import { getStorageBackend } from "../storage";
import { getDatabaseUrl } from "./databaseUrl";
import { ENV } from "./env";
import { RELEASE_VERSION, releaseIdentity, shortReleaseCommit } from "./release";

function validateEnvironment() {
  getDatabaseUrl(process.env.DATABASE_URL, {
    required: true,
    production: process.env.NODE_ENV === "production",
  });
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error("JWT_SECRET must contain at least 32 characters.");
  }
  if (!ENV.appId) throw new Error("VITE_APP_ID must not be empty.");
  const legacyAppVersion = process.env.APP_VERSION?.trim();
  if (legacyAppVersion && legacyAppVersion !== RELEASE_VERSION) {
    throw new Error(
      `APP_VERSION=${legacyAppVersion} is stale; remove APP_VERSION from Railway. The build version is ${RELEASE_VERSION}.`,
    );
  }
  const storageRequired = process.env.STORAGE_REQUIRED === "true";
  if (process.env.NODE_ENV === "production" || storageRequired) getStorageBackend();
}

function applySecurityHeaders(app: express.Express) {
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    if (ENV.isProduction) {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
    next();
  });
}

async function startServer() {
  validateEnvironment();
  const app = express();
  const server = createServer(app);
  const startedAt = new Date();

  // Railway and most reverse proxies terminate TLS before forwarding requests.
  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  applySecurityHeaders(app);

  app.use((req, res, next) => {
    const requestId = String(req.headers["x-request-id"] || randomUUID());
    res.setHeader("X-Request-Id", requestId);
    (req as express.Request & { requestId?: string }).requestId = requestId;
    next();
  });

  app.use(express.json({ limit: process.env.REQUEST_BODY_LIMIT || "50mb" }));
  app.use(
    express.urlencoded({
      limit: process.env.REQUEST_BODY_LIMIT || "50mb",
      extended: true,
    }),
  );

  // Liveness: Railway uses this endpoint to switch traffic to a new revision.
  app.get("/health", (_req, res) => {
    res.status(200).json({
      status: "ok",
      service: "sbts-professional",
      ...releaseIdentity(),
      startedAt: startedAt.toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    });
  });

  // Readiness: operational checks and smoke tests can verify database access.
  app.get("/ready", async (_req, res) => {
    try {
      const db = await getDb();
      if (!db) {
        res.status(503).json({ status: "not_ready", database: "unavailable" });
        return;
      }
      await db.execute(sql`select 1 as ready`);
      res.status(200).json({
        status: "ready",
        database: "connected",
        ...releaseIdentity(),
      });
    } catch (error) {
      console.error("[Readiness] database check failed:", error);
      res.status(503).json({ status: "not_ready", database: "error", ...releaseIdentity() });
    }
  });

  registerStorageProxy(app);

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
      onError({ error, path, ctx }) {
        const requestId = (ctx?.req as express.Request & { requestId?: string })
          ?.requestId;
        const internal = error.code === "INTERNAL_SERVER_ERROR";
        const causeName =
          error.cause && typeof error.cause === "object" && "name" in error.cause
            ? String(error.cause.name)
            : undefined;
        console.error(
          JSON.stringify({
            event: "trpc_error",
            requestId: requestId ?? "unknown",
            path: path ?? "unknown",
            code: error.code,
            message: internal ? "Internal server error" : error.message.slice(0, 300),
            cause: internal ? causeName ?? "Error" : undefined,
          }),
        );
        if (!ENV.isProduction && internal) {
          console.error(error);
        }
      },
    }),
  );

  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = Number.parseInt(process.env.PORT || "3000", 10);
  if (!Number.isFinite(port) || port <= 0) {
    throw new Error("PORT must be a valid positive integer.");
  }
  const host = process.env.HOST || "0.0.0.0";

  server.listen(port, host, () => {
    console.log(
      `SBTS ${RELEASE_VERSION}+${shortReleaseCommit()} listening on http://${host}:${port} (appId=${ENV.appId}, storage=${process.env.STORAGE_BACKEND?.trim() || "not-configured"})`,
    );
  });

  const shutdown = (signal: string) => {
    console.log(`[Shutdown] ${signal} received.`);
    server.close((error) => {
      if (error) {
        console.error("[Shutdown] server close failed:", error);
        process.exit(1);
      }
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 15_000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

startServer().catch((error) => {
  console.error("[Startup] fatal error:", error);
  process.exit(1);
});
