import "dotenv/config";
import { seedAreasAndProjects } from "../server/db/seed";

function enabled(value: string | undefined) {
  return ["1", "true", "yes", "on"].includes((value ?? "").trim().toLowerCase());
}

async function main() {
  const production = process.env.NODE_ENV === "production";
  if (production && !enabled(process.env.ALLOW_DEMO_DATA_IN_PRODUCTION)) {
    throw new Error(
      "Demo data is blocked in production. Use real Areas/Projects, or explicitly set ALLOW_DEMO_DATA_IN_PRODUCTION=true for a disposable UAT environment.",
    );
  }
  if (!enabled(process.env.SEED_DEMO_DATA)) {
    throw new Error(
      "Demo seeding requires SEED_DEMO_DATA=true and must be run manually with pnpm data:seed.",
    );
  }

  await seedAreasAndProjects();
  console.log("SBTS_DEMO_DATA_SEED_COMPLETED");
}

main().catch((error) => {
  console.error(
    "SBTS_DEMO_DATA_SEED_FAILED:",
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
