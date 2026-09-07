import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { db } from "../src/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Applying is_correct column and index to question_options...");

  await db.execute(sql`
    ALTER TABLE question_options 
    ADD COLUMN IF NOT EXISTS is_correct BOOLEAN NOT NULL DEFAULT FALSE;
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS question_options_is_correct_idx 
    ON question_options(is_correct);
  `);

  console.log("Successfully applied is_correct DDL to question_options!");
}

main().catch((err) => {
  console.error("DDL failed:", err);
  process.exit(1);
});
