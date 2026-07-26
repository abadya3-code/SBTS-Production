import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let ts;
try {
  const imported = await import("typescript");
  ts = imported.default ?? imported;
} catch {
  const fallback = process.env.TYPESCRIPT_PATH ?? "/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript/lib/typescript.js";
  ts = require(fallback);
}

const roots = ["client", "server", "shared", "drizzle"];
const files = [];
for (const root of roots) {
  const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".d.ts")) files.push(file);
    }
  };
  walk(path.join(process.cwd(), root));
}

const errors = [];
for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  const result = ts.transpileModule(source, {
    fileName: file,
    reportDiagnostics: true,
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
    },
  });
  for (const diagnostic of result.diagnostics ?? []) {
    if (diagnostic.category !== ts.DiagnosticCategory.Error) continue;
    errors.push(`${path.relative(process.cwd(), file)}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")}`);
  }
}

const report = { files: files.length, errors: errors.length, sample: errors.slice(0, 20) };
console.log(JSON.stringify(report, null, 2));
if (errors.length > 0) process.exit(1);
