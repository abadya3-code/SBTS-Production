import "dotenv/config";
import { closeDb } from "../server/db/core";
import { seedSystemReferenceData } from "../server/db/seed";

async function main() {
  await seedSystemReferenceData();
  console.log("SBTS_SYSTEM_REFERENCE_DATA_READY");
}

async function run() {
  try {
    await main();
  } catch (error) {
    console.error(
      "SBTS_SYSTEM_REFERENCE_DATA_FAILED:",
      error instanceof Error ? error.message : error
    );
    process.exitCode = 1;
  } finally {
    try {
      await closeDb();
    } catch (error) {
      console.error(
        "SBTS_DATABASE_CLOSE_FAILED:",
        error instanceof Error ? error.message : error
      );
      process.exitCode = 1;
    }
  }
}

void run();
