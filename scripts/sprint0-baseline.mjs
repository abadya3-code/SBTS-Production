import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const ignored = new Set(["node_modules", ".git", "dist", ".vite"]);
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".mjs", ".sql"]);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const files = walk(root);
const sourceFiles = files.filter((file) => sourceExtensions.has(path.extname(file)));
const tests = sourceFiles.filter((file) => /\.(test|spec)\.[cm]?[jt]sx?$/.test(file));
const clientPages = files.filter((file) => file.includes(`${path.sep}client${path.sep}src${path.sep}pages${path.sep}`) && file.endsWith(".tsx"));
const routers = files.filter((file) => file.includes(`${path.sep}server${path.sep}routers${path.sep}`) && file.endsWith(".ts"));
const migrations = files.filter((file) => file.includes(`${path.sep}drizzle${path.sep}`) && file.endsWith(".sql"));

const patterns = [
  ["Legacy phase references", /Broken \/ Preparation|Tight & Torque|Final Tight|Inspection Ready/g],
  ["Mock-data imports", /from ["']@\/lib\/mockData["']/g],
  ["TODO/FIXME markers", /\b(?:TODO|FIXME)\b/g],
  ["Potential placeholder actions", /Coming Soon|placeholder|not implemented/gi],
];

const findings = patterns.map(([label, pattern]) => {
  let count = 0;
  const examples = [];
  for (const file of sourceFiles) {
    if (file.endsWith(path.join("scripts", "sprint0-baseline.mjs"))) continue;
    const text = fs.readFileSync(file, "utf8");
    const matches = text.match(pattern);
    if (!matches) continue;
    count += matches.length;
    if (examples.length < 8) examples.push(path.relative(root, file));
  }
  return { label, count, examples: [...new Set(examples)] };
});

const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const report = `# Sprint 0 Baseline Report\n\nGenerated: ${new Date().toISOString()}\n\n## Application inventory\n\n- Package: ${packageJson.name} ${packageJson.version}\n- Source files: ${sourceFiles.length}\n- Client pages: ${clientPages.length}\n- Server routers: ${routers.length}\n- Automated tests: ${tests.length}\n- SQL migrations: ${migrations.length}\n\n## Baseline findings\n\n${findings.map((item) => `### ${item.label}\n\n- Count: ${item.count}\n- Example files: ${item.examples.length ? item.examples.map((f) => `\`${f}\``).join(", ") : "None"}\n`).join("\n")}\n## Sprint 0 controls\n\n- Canonical workflow specification: \`shared/workflowSpecification.ts\`\n- Workflow policy settings: database-backed singleton\n- Foundation migration: \`drizzle/0013_sprint0_sprint1_foundation.sql\`\n- Runtime domain migration: \`drizzle/0014_sprint2_workflow_runtime.sql\`\n- Verification command: \`pnpm verify\`\n\n## Known boundary\n\nThe canonical eight-phase runtime is authoritative after Migration 0014. The five legacy phase values remain as a synchronized compatibility projection for older reports and components until their removal in a later controlled migration; direct legacy phase changes are blocked.\n`;

if (process.argv.includes("--write")) {
  const docsDir = path.join(root, "docs");
  fs.mkdirSync(docsDir, { recursive: true });
  fs.writeFileSync(path.join(docsDir, "SPRINT0_BASELINE_REPORT.md"), report);
}
console.log(report);
