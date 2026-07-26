import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const file = path.join(process.cwd(), "drizzle/0014_sprint2_workflow_runtime.sql");
const sql = fs.readFileSync(file, "utf8");
const errors = [];
let state = "normal";
let depth = 0;
let statements = 0;
let lastSignificant = "";

for (let i = 0; i < sql.length; i += 1) {
  const char = sql[i];
  const next = sql[i + 1];

  if (state === "line-comment") {
    if (char === "\n") state = "normal";
    continue;
  }
  if (state === "block-comment") {
    if (char === "*" && next === "/") { state = "normal"; i += 1; }
    continue;
  }
  if (state === "single-quote") {
    if (char === "\\") { i += 1; continue; }
    if (char === "'" && next === "'") { i += 1; continue; }
    if (char === "'") state = "normal";
    continue;
  }
  if (state === "backtick") {
    if (char === "`" && next === "`") { i += 1; continue; }
    if (char === "`") state = "normal";
    continue;
  }

  if (char === "-" && next === "-") { state = "line-comment"; i += 1; continue; }
  if (char === "/" && next === "*") { state = "block-comment"; i += 1; continue; }
  if (char === "'") { state = "single-quote"; lastSignificant = char; continue; }
  if (char === "`") { state = "backtick"; lastSignificant = char; continue; }
  if (char === "(") depth += 1;
  if (char === ")") {
    depth -= 1;
    if (depth < 0) errors.push(`Unexpected closing parenthesis near character ${i}.`);
  }
  if (char === ";") statements += 1;
  if (!/\s/.test(char)) lastSignificant = char;
}

if (state !== "normal" && state !== "line-comment") errors.push(`Unterminated SQL lexical state: ${state}.`);
if (depth !== 0) errors.push(`Unbalanced SQL parentheses: depth=${depth}.`);
if (lastSignificant !== ";") errors.push("Migration must end with a semicolon.");
if (statements < 20) errors.push(`Unexpectedly low SQL statement count: ${statements}.`);
if (sql.includes("b.`blindType`")) errors.push("Migration references non-existent blinds.blindType; the physical column is blinds.type.");
if (!sql.includes("b.`type`")) errors.push("Slip-blind migration rule must use the physical blinds.type column.");
if (sql.includes("JSON_TABLE(")) errors.push("TiDB-compatible migration must not use unsupported JSON_TABLE.");
if (!sql.includes("CROSS JOIN (") || !sql.includes("01-equipment-shutdown-confirmed")) errors.push("Portable canonical checklist materialization is missing.");
if (!sql.includes("workflow.phase.returnToService.authorize")) errors.push("Final return-to-service permission is missing from the canonical phase seed.");
if (!sql.includes("gasTestLimitsConfigured")) errors.push("Plant gas-test acceptance-limit controls are missing.");
if (!sql.includes("previousLifecycleStatus")) errors.push("Safety Hold lifecycle restoration metadata is missing.");

const report = {
  file: path.relative(process.cwd(), file),
  statements,
  balancedParentheses: depth === 0,
  lexicalState: state,
  passed: errors.length === 0,
  errors,
};
console.log(JSON.stringify(report, null, 2));
if (errors.length > 0) process.exit(1);
