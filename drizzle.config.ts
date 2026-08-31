import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

// Load local environment settings
dotenv.config({ path: ".env.local" });

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./src/db/migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL || "",
  },
});
