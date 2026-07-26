import fs from "node:fs";

const file = "drizzle/0017_sprint5_auth_deployment_hardening.sql";
const sql = fs.readFileSync(file, "utf8");
const errors = [];
const required = [
  "failedLoginAttempts",
  "lockedUntil",
  "passwordChangedAt",
  "users_email_unique",
  "minPasswordLength",
];
for (const token of required) {
  if (!sql.includes(token)) errors.push(`Missing ${token}`);
}
if (/JSON_TABLE/i.test(sql)) errors.push("JSON_TABLE is not allowed for TiDB/MySQL portability.");
let balance = 0;
for (const char of sql) {
  if (char === "(") balance += 1;
  if (char === ")") balance -= 1;
  if (balance < 0) break;
}
if (balance !== 0) errors.push("Unbalanced parentheses.");
const statements = sql.split(";").map((value) => value.trim()).filter(Boolean).length;
const result = { file, statements, balancedParentheses: balance === 0, passed: errors.length === 0, errors };
console.log(JSON.stringify(result, null, 2));
if (errors.length) process.exit(1);
