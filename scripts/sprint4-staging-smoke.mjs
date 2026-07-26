import process from "node:process";
const baseUrl = (process.env.SBTS_BASE_URL || process.argv[2] || "").replace(/\/+$/, "");
if (!baseUrl) { console.error("Set SBTS_BASE_URL or pass the base URL as the first argument."); process.exit(1); }
const checks = [];
for (const path of ["/health", "/ready", "/"]) {
  try {
    const response = await fetch(`${baseUrl}${path}`, { redirect: "manual" });
    checks.push({ path, status: response.status, passed: response.status >= 200 && response.status < 400 });
  } catch (error) {
    checks.push({ path, status: 0, passed: false, error: error instanceof Error ? error.message : String(error) });
  }
}
console.log(JSON.stringify({ baseUrl, generatedAt: new Date().toISOString(), checks }, null, 2));
if (checks.some((check) => !check.passed)) process.exit(1);
