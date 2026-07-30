import "dotenv/config";
import { seedSystemReferenceData } from "../server/db/seed";

async function main() {
  await seedSystemReferenceData();
  console.log("SBTS_SYSTEM_REFERENCE_DATA_READY");
}

main().catch((error) => {
  console.error(
    "SBTS_SYSTEM_REFERENCE_DATA_FAILED:",
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
