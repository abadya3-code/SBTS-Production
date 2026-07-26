import type { Express } from "express";
import { storageGetSignedUrl } from "../storage";

async function redirectToObject(key: string | undefined, res: any) {
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

export function registerStorageProxy(app: Express) {
  app.get("/storage/*", async (req, res) => {
    await redirectToObject((req.params as Record<string, string | undefined>)[0], res);
  });
  // Backward-compatible route for evidence uploaded by earlier SBTS releases.
  app.get("/manus-storage/*", async (req, res) => {
    await redirectToObject((req.params as Record<string, string | undefined>)[0], res);
  });
}
