/**
 * Unified object-storage adapter.
 *
 * Supported backends:
 * 1) Manus Forge presigned storage (legacy/current hosted environment)
 * 2) Any S3-compatible service, including Railway Storage Buckets
 *
 * Application URLs stay backend-neutral: /storage/{key}. The Express storage
 * proxy resolves those URLs to short-lived signed object URLs.
 */
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ENV } from "./_core/env";

type StorageBackend = "forge" | "s3";

interface S3Config {
  bucket: string;
  endpoint?: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
}

function normalizeKey(relKey: string): string {
  const normalized = relKey.replace(/^\/+/, "").replace(/\.\.(?:\/|\\)/g, "");
  if (!normalized) throw new Error("Storage key cannot be empty.");
  return normalized;
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

function getForgeConfig() {
  if (!ENV.forgeApiUrl || !ENV.forgeApiKey) return null;
  return {
    forgeUrl: ENV.forgeApiUrl.replace(/\/+$/, ""),
    forgeKey: ENV.forgeApiKey,
  };
}

function envValue(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return "";
}

function getS3Config(): S3Config | null {
  // Railway Storage Buckets expose BUCKET, ENDPOINT, ACCESS_KEY_ID,
  // SECRET_ACCESS_KEY and REGION. S3_* aliases keep local/self-hosted use clear.
  const bucket = envValue("S3_BUCKET", "BUCKET");
  const endpoint = envValue("S3_ENDPOINT", "ENDPOINT");
  const accessKeyId = envValue("S3_ACCESS_KEY_ID", "ACCESS_KEY_ID", "AWS_ACCESS_KEY_ID");
  const secretAccessKey = envValue("S3_SECRET_ACCESS_KEY", "SECRET_ACCESS_KEY", "AWS_SECRET_ACCESS_KEY");
  const region = envValue("S3_REGION", "REGION", "AWS_REGION") || "auto";
  if (!bucket || !accessKeyId || !secretAccessKey) return null;
  return {
    bucket,
    endpoint: endpoint || undefined,
    region,
    accessKeyId,
    secretAccessKey,
    forcePathStyle: envValue("S3_FORCE_PATH_STYLE") !== "false",
  };
}

let s3Client: S3Client | null = null;
function getS3Client(config: S3Config) {
  if (!s3Client) {
    s3Client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }
  return s3Client;
}

export function getStorageBackend(): StorageBackend {
  if (getForgeConfig()) return "forge";
  if (getS3Config()) return "s3";
  throw new Error(
    "Storage is not configured. Provide Manus Forge variables or an S3-compatible bucket configuration.",
  );
}

async function forgeSignedUrl(key: string, method: "put" | "get") {
  const config = getForgeConfig();
  if (!config) throw new Error("Manus Forge storage is not configured.");
  const url = new URL(`v1/storage/presign/${method}`, config.forgeUrl + "/");
  url.searchParams.set("path", key);
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${config.forgeKey}` },
  });
  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(`Storage presign failed (${response.status}): ${message}`);
  }
  const payload = (await response.json()) as { url?: string };
  if (!payload.url) throw new Error("Storage backend returned an empty signed URL.");
  return payload.url;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const key = appendHashSuffix(normalizeKey(relKey));
  const backend = getStorageBackend();

  if (backend === "forge") {
    const signedUrl = await forgeSignedUrl(key, "put");
    const body = typeof data === "string" ? Buffer.from(data) : Buffer.from(data);
    const response = await fetch(signedUrl, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body,
    });
    if (!response.ok) throw new Error(`Storage upload failed (${response.status}).`);
  } else {
    const config = getS3Config();
    if (!config) throw new Error("S3 storage is not configured.");
    await getS3Client(config).send(new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: typeof data === "string" ? Buffer.from(data) : Buffer.from(data),
      ContentType: contentType,
    }));
  }

  return { key, url: `/storage/${encodeURI(key)}` };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  return { key, url: `/storage/${encodeURI(key)}` };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  const key = normalizeKey(relKey);
  const backend = getStorageBackend();
  if (backend === "forge") return forgeSignedUrl(key, "get");
  const config = getS3Config();
  if (!config) throw new Error("S3 storage is not configured.");
  return getSignedUrl(
    getS3Client(config),
    new GetObjectCommand({ Bucket: config.bucket, Key: key }),
    { expiresIn: 300 },
  );
}

export async function storageDelete(relKey: string): Promise<boolean> {
  const key = normalizeKey(relKey);
  const backend = getStorageBackend();
  if (backend === "forge") {
    // Forge currently exposes presigned PUT/GET only. Railway/S3 objects are
    // deleted physically; legacy Forge objects remain for retention cleanup.
    console.warn(`[Storage] deletion is unavailable for Forge object ${key}`);
    return false;
  }
  const config = getS3Config();
  if (!config) throw new Error("S3 storage is not configured.");
  await getS3Client(config).send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
  return true;
}

export function storageKeyFromUrl(fileUrl: string): string | null {
  const prefixes = ["/storage/", "/manus-storage/"];
  const prefix = prefixes.find((value) => fileUrl.startsWith(value));
  if (!prefix) return null;
  try {
    return decodeURI(fileUrl.slice(prefix.length));
  } catch {
    return fileUrl.slice(prefix.length);
  }
}
