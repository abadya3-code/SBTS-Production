import "dotenv/config";
import { defineConfig } from "drizzle-kit";
import { getDatabaseUrl } from "./server/_core/databaseUrl";

const connectionString = getDatabaseUrl(process.env.DATABASE_URL, {
  required: true,
  production: process.env.NODE_ENV === "production",
});

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials: {
    url: connectionString!,
  },
});
