import "dotenv/config";
import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "../server/routers";

interface Result { name: string; passed: boolean; detail: string }
const results: Result[] = [];
function record(name: string, passed: boolean, detail: string) {
  results.push({ name, passed, detail });
  console.log(`${passed ? "✓" : "✗"} ${name}: ${detail}`);
}
function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for staging:e2e.`);
  return value;
}

const baseUrl = required("SBTS_E2E_BASE_URL").replace(/\/+$/, "");
const email = required("SBTS_E2E_EMAIL");
const password = required("SBTS_E2E_PASSWORD");
const projectId = required("SBTS_E2E_PROJECT_ID");
const blindTag = required("SBTS_E2E_BLIND_TAG");
const certificateToken = process.env.SBTS_E2E_CERTIFICATE_TOKEN?.trim();
const expectClosed = process.env.SBTS_E2E_EXPECT_CLOSED === "true";
let cookie = "";

const trpc = createTRPCProxyClient<AppRouter>({
  links: [httpBatchLink({
    url: `${baseUrl}/api/trpc`,
    transformer: superjson,
    async fetch(url, init) {
      const headers = new Headers(init?.headers);
      if (cookie) headers.set("cookie", cookie);
      const response = await fetch(url, { ...init, headers });
      const setCookie = response.headers.get("set-cookie");
      if (setCookie) cookie = setCookie.split(";")[0];
      return response;
    },
  })],
});

async function httpCheck(path: string, expected: number) {
  const response = await fetch(`${baseUrl}${path}`, { redirect: "manual" });
  record(`HTTP ${path}`, response.status === expected, `status ${response.status}`);
  if (response.status !== expected) throw new Error(`${path} returned ${response.status}`);
  return response;
}

async function main() {
  await httpCheck("/health", 200);
  await httpCheck("/ready", 200);
  const root = await fetch(baseUrl);
  record("Frontend root", root.ok, `status ${root.status}`);

  const login = await trpc.auth.login.mutate({ email, password });
  record("Authentication", login.success === true, `logged in as ${login.user.email}`);
  const me = await trpc.auth.me.query();
  record("Session cookie", Boolean(me?.openId), me?.openId || "missing user");

  const project = await trpc.projects.detail.query({ id: projectId });
  record("Project linkage", Boolean(project?.project?.id), project?.project?.name || projectId);
  const blind = await trpc.projects.blindDetail.query({ projectId, tag: blindTag });
  record("Blind linkage", blind?.blind?.tag === blindTag, blind?.blind?.tag || "not found");

  const runtime = await trpc.workflowRuntime.state.query({ projectId, blindTag });
  record("Canonical runtime", Boolean(runtime.runtime?.currentPhaseKey), `${runtime.runtime?.currentPhaseKey} / ${runtime.runtime?.lifecycleStatus}`);
  record("Eight phase instances", runtime.phases.length === 8, `${runtime.phases.length} phases`);
  record("RBAC runtime permissions", typeof runtime.permissions.canIssueCertificate === "boolean", "permission projection available");

  const quality = await trpc.workflowRuntime.quality.forBlind.query({ projectId, blindTag });
  record("Quality governance API", Array.isArray(quality.defects) && Array.isArray(quality.punches) && Array.isArray(quality.ndt), `${quality.defects.length} defects, ${quality.punches.length} punches, ${quality.ndt.length} NDT`);

  const readiness = await trpc.certificates.readiness.query({ projectId, blindTag });
  record("Certificate readiness API", Array.isArray(readiness.blockingReasons), readiness.ready ? "ready" : `${readiness.blockingReasons.length} blockers`);
  const certificates = await trpc.certificates.list.query({ projectId, blindTag });
  record("Certificate history API", Array.isArray(certificates), `${certificates.length} versions`);

  if (expectClosed) {
    record("Closed workflow expectation", runtime.runtime.lifecycleStatus === "CLOSED" && runtime.runtime.isLocked === 1, `${runtime.runtime.lifecycleStatus}; locked=${runtime.runtime.isLocked}`);
    record("Issued certificate expectation", certificates.some((item) => item.status === "issued"), certificates.map((item) => `${item.certificateNumber}:${item.status}`).join(", ") || "none");
  }

  if (certificateToken) {
    const verification = await trpc.certificates.verify.query({ token: certificateToken });
    record("Public certificate hash", verification.hashValid === true, `${verification.certificateNumber}; ${verification.status}`);
    record("Public data minimization", !("compliance" in (verification.publicSnapshot as any)), "sensitive compliance snapshot not returned");
    const page = await fetch(`${baseUrl}/certificate/verify/${encodeURIComponent(certificateToken)}`);
    record("Public verification page", page.ok, `status ${page.status}`);
  }

  await trpc.auth.logout.mutate();
  const failures = results.filter((item) => !item.passed);
  console.log(JSON.stringify({ generatedAt: new Date().toISOString(), baseUrl, checks: results.length, passed: results.length - failures.length, failed: failures.length, results }, null, 2));
  if (failures.length) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
