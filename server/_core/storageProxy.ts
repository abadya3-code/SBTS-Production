import type { Express, Request, Response } from "express";
import { eq, or } from "drizzle-orm";
import { workflowEvidenceAttachments } from "../../drizzle/schema";
import { requireDb } from "../db/core";
import { getWorkflowActorAccess } from "../db/workflowRuntime";
import { storageGetSignedUrl } from "../storage";
import { sdk } from "./sdk";

async function redirectToObject(key: string | undefined, res: Response) {
  if (!key) {
    res.status(400).send("Missing storage key");
    return;
  }
  try {
    const signedUrl = await storageGetSignedUrl(key);
    res.set("Cache-Control", "private, no-store");
    res.redirect(307, signedUrl);
  } catch (error) {
    console.error("[StorageProxy] failed:", error);
    res.status(502).send("Storage backend error");
  }
}

function normalizeStorageKey(key: string | undefined): string | null {
  const normalized = key?.replace(/^\/+/, "").trim();
  if (!normalized || normalized.length > 500 || normalized.includes("\\") || normalized.includes("\0")) return null;
  if (normalized.split("/").some((segment) => !segment || segment === "." || segment === "..")) return null;
  return normalized;
}

async function authorizeStorageKey(
  req: Request,
  res: Response,
  rawKey: string | undefined,
): Promise<string | null> {
  const key = normalizeStorageKey(rawKey);
  if (!key) {
    res.status(400).send("Invalid storage key");
    return null;
  }
  let user: Awaited<ReturnType<typeof sdk.authenticateRequest>>;
  try {
    user = await sdk.authenticateRequest(req);
  } catch {
    res.set("Cache-Control", "private, no-store");
    res.status(401).send("Authentication required");
    return null;
  }

  if (key.startsWith("workflow/")) {
    try {
      const access = await getWorkflowActorAccess(user.openId, user.role);
      const permitted = access.permissionKeys.includes("*")
        || access.permissionKeys.includes("blinds.view")
        || access.permissionKeys.includes("workflow.record.evidence");
      if (!permitted) {
        res.set("Cache-Control", "private, no-store");
        res.status(403).send("Evidence access denied");
        return null;
      }

      const db = await requireDb();
      const encodedStorageUrl = `/storage/${encodeURI(key)}`;
      const encodedLegacyUrl = `/manus-storage/${encodeURI(key)}`;
      const evidence = await db
        .select({ id: workflowEvidenceAttachments.id })
        .from(workflowEvidenceAttachments)
        .where(or(
          eq(workflowEvidenceAttachments.storageKey, key),
          eq(workflowEvidenceAttachments.fileUrl, encodedStorageUrl),
          eq(workflowEvidenceAttachments.fileUrl, encodedLegacyUrl),
        ))
        .limit(1);
      if (!evidence[0]) {
        res.set("Cache-Control", "private, no-store");
        res.status(404).send("Evidence object not found");
        return null;
      }
    } catch (error) {
      console.error("[StorageProxy] evidence authorization failed:", error);
      res.set("Cache-Control", "private, no-store");
      res.status(503).send("Evidence authorization unavailable");
      return null;
    }
  }
  return key;
}

export function registerStorageProxy(app: Express) {
  app.get("/storage/*", async (req, res) => {
    const key = await authorizeStorageKey(req, res, (req.params as Record<string, string | undefined>)[0]);
    if (!key) return;
    await redirectToObject(key, res);
  });
  // Backward-compatible route for evidence uploaded by earlier SBTS releases.
  app.get("/manus-storage/*", async (req, res) => {
    const key = await authorizeStorageKey(req, res, (req.params as Record<string, string | undefined>)[0]);
    if (!key) return;
    await redirectToObject(key, res);
  });
}
