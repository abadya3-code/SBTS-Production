import fs from "node:fs";
import path from "node:path";
import process from "node:process";
const file = path.join(process.cwd(), "drizzle/0015_sprint3_vertical_integration.sql");
const sql = fs.readFileSync(file, "utf8");
const errors = [];
let state = "normal"; let depth = 0; let statements = 0; let lastSignificant = "";
for (let i=0;i<sql.length;i+=1) { const c=sql[i], n=sql[i+1];
  if (state==="line-comment") { if (c==="\n") state="normal"; continue; }
  if (state==="block-comment") { if (c==="*"&&n==="/") { state="normal"; i+=1; } continue; }
  if (state==="single-quote") { if (c==="\\") { i+=1; continue; } if (c==="'"&&n==="'") { i+=1; continue; } if (c==="'") state="normal"; continue; }
  if (state==="backtick") { if (c==="`"&&n==="`") { i+=1; continue; } if (c==="`") state="normal"; continue; }
  if (c==="-"&&n==="-") { state="line-comment"; i+=1; continue; }
  if (c==="/"&&n==="*") { state="block-comment"; i+=1; continue; }
  if (c==="'") { state="single-quote"; lastSignificant=c; continue; }
  if (c==="`") { state="backtick"; lastSignificant=c; continue; }
  if (c==="(") depth+=1; if (c===")") { depth-=1; if (depth<0) errors.push(`Unexpected closing parenthesis at ${i}`); }
  if (c===";") statements+=1; if (!/\s/.test(c)) lastSignificant=c;
}
if (state!=="normal"&&state!=="line-comment") errors.push(`Unterminated SQL state ${state}`);
if (depth!==0) errors.push(`Unbalanced parentheses depth=${depth}`);
if (lastSignificant!==";") errors.push("Migration must end with semicolon.");
if (statements<8) errors.push(`Unexpectedly low statement count ${statements}`);
if (sql.includes("JSON_TABLE(")) errors.push("TiDB does not support JSON_TABLE.");
for (const required of ["inspection_activity_templates","inspection_activity_records","workflow.record.evidence","workflow.record.inspection","workflow.inspection.configure","evidenceAllowedMimeTypesJson"]) if (!sql.includes(required)) errors.push(`Missing ${required}`);
const report={file:path.relative(process.cwd(),file),statements,balancedParentheses:depth===0,lexicalState:state,passed:errors.length===0,errors};
console.log(JSON.stringify(report,null,2)); if(errors.length) process.exit(1);
