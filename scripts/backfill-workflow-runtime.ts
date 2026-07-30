import "dotenv/config";
import { asc } from "drizzle-orm";
import { blinds } from "../drizzle/schema";
import { requireDb } from "../server/db/core";
import { ensureBlindWorkflowRuntime } from "../server/db/workflowRuntime";

async function main() {
  const db = await requireDb();
  const rows = await db
    .select({ projectId: blinds.projectId, tag: blinds.tag })
    .from(blinds)
    .orderBy(asc(blinds.projectId), asc(blinds.tag));

  let completed = 0;
  for (const row of rows) {
    await ensureBlindWorkflowRuntime(row.projectId, row.tag);
    completed += 1;
    if (completed % 100 === 0) {
      console.log(`SBTS_WORKFLOW_BACKFILL_PROGRESS completed=${completed} total=${rows.length}`);
    }
  }

  console.log(`SBTS_WORKFLOW_BACKFILL_COMPLETED completed=${completed}`);
}

main().catch((error) => {
  console.error(
    "SBTS_WORKFLOW_BACKFILL_FAILED:",
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
