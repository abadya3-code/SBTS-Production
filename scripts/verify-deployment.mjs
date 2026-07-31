import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const baseUrl = (process.argv[2] || process.env.SBTS_DEPLOY_URL || "").replace(/\/+$/, "");
const failures = [];

if (!baseUrl) {
  console.error("Usage: pnpm deploy:verify -- https://your-service.up.railway.app");
  process.exit(2);
}

let expectedCommit = process.env.EXPECTED_GIT_COMMIT?.trim() || "";
if (!expectedCommit && fs.existsSync(path.join(root, ".git"))) {
  try {
    expectedCommit = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    // Version verification remains useful for archive-based checks.
  }
}

async function readEndpoint(endpoint) {
  const response = await fetch(`${baseUrl}${endpoint}`, {
    headers: { accept: "application/json", "cache-control": "no-cache" },
    redirect: "follow",
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body) failures.push(`${endpoint} returned HTTP ${response.status}.`);
  return body;
}

try {
  const [health, ready] = await Promise.all([readEndpoint("/health"), readEndpoint("/ready")]);
  for (const [endpoint, payload] of [["/health", health], ["/ready", ready]]) {
    if (payload?.version !== packageJson.version) {
      failures.push(`${endpoint} version is ${payload?.version ?? "missing"}; expected ${packageJson.version}.`);
    }
    if (!payload?.commit || payload.commit === "local") {
      failures.push(`${endpoint} does not expose a deployed Git commit.`);
    } else if (expectedCommit && payload.commit !== expectedCommit) {
      failures.push(`${endpoint} commit ${payload.commit} does not match expected ${expectedCommit}.`);
    }
  }
  if (health?.status !== "ok") failures.push("/health is not healthy.");
  if (ready?.status !== "ready" || ready?.database !== "connected") {
    failures.push("/ready did not confirm the database connection.");
  }
  console.log(JSON.stringify({ baseUrl, expectedVersion: packageJson.version, expectedCommit: expectedCommit || null, health, ready }, null, 2));
} catch (error) {
  failures.push(error instanceof Error ? error.message : String(error));
}

if (failures.length) {
  console.error("DEPLOYMENT_VERIFICATION_FAILED");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("DEPLOYMENT_VERIFICATION_PASSED");
