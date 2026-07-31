import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const args = new Set(process.argv.slice(2));
const expectedRepository = "github.com/abadya3-code/SBTS-Production.git";
const failures = [];

function git(...command) {
  return execFileSync("git", command, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

if (!fs.existsSync(path.join(root, ".git"))) {
  failures.push(".git is missing. Work in the real SBTS-Production clone; an extracted ZIP cannot publish.");
} else {
  let branch = "";
  let origin = "";
  let head = "";
  try {
    branch = git("branch", "--show-current");
    origin = git("remote", "get-url", "origin");
    head = git("rev-parse", "HEAD");
  } catch (error) {
    failures.push(`Git inspection failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (branch && branch !== "main") failures.push(`Current branch is ${branch}; expected main.`);
  const normalizedOrigin = origin.replace(/^git@github\.com:/, "github.com/").replace(/^https?:\/\//, "");
  if (origin && normalizedOrigin !== expectedRepository) {
    failures.push(`origin points to ${origin}; expected https://github.com/abadya3-code/SBTS-Production.git.`);
  }
  if (args.has("--require-clean")) {
    const status = git("status", "--porcelain");
    if (status) failures.push("The working tree is not clean after publishing.");
  }
  if (args.has("--compare-origin") && head) {
    try {
      const remoteLine = git("ls-remote", "origin", "refs/heads/main");
      const remoteHead = remoteLine.split(/\s+/)[0] || "";
      if (!remoteHead) failures.push("origin/main could not be resolved.");
      else if (remoteHead !== head) failures.push(`Local HEAD ${head} does not match origin/main ${remoteHead}.`);
    } catch (error) {
      failures.push(`Could not compare origin/main: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log(JSON.stringify({ branch, origin, head, status: failures.length ? "failed" : "passed" }, null, 2));
}

if (failures.length) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
