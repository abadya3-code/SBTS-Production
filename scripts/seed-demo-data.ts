import "dotenv/config";
import { seedAreasAndProjects } from "../server/db/seed";

async function main() {
  await seedAreasAndProjects();
  console.log("SBTS_DEMO_DATA_SEED_COMPLETED");
}

main().catch((error) => {
  console.error("SBTS_DEMO_DATA_SEED_FAILED:", error instanceof Error ? error.message : error);
  process.exit(1);
});
