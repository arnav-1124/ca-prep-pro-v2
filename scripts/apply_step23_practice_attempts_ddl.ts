import { db } from "../src/db";
import { sql } from "drizzle-orm";

async function applyStep23DDL() {
  console.log("Applying Step 23 practice_attempts schema updates to Neon database...");

  // 1. Alter practice_attempts table to add new columns
  await db.execute(sql`
    ALTER TABLE practice_attempts 
      ADD COLUMN IF NOT EXISTS practice_session_question_id uuid REFERENCES practice_session_questions(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS student_profile_id uuid REFERENCES student_profiles(id),
      ADD COLUMN IF NOT EXISTS marks_awarded integer DEFAULT 0 NOT NULL;
  `);
  console.log("✓ Added practice_session_question_id, student_profile_id, and marks_awarded to practice_attempts");

  // 2. Create unique index on practice_session_question_id (allows multiple NULLs for legacy records)
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS practice_attempts_session_question_unique_idx 
      ON practice_attempts (practice_session_question_id);
  `);
  console.log("✓ Created unique index on practice_attempts(practice_session_question_id)");

  // 3. Create foreign key and lookup indexes
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS practice_attempts_session_idx 
      ON practice_attempts (practice_session_id);
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS practice_attempts_student_idx 
      ON practice_attempts (student_profile_id);
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS practice_attempts_version_idx 
      ON practice_attempts (question_version_id);
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS practice_attempts_created_at_idx 
      ON practice_attempts (created_at);
  `);
  console.log("✓ Created lookup indexes on practice_attempts");

  console.log("✓ Successfully applied Step 23 practice_attempts DDL to database.");
  process.exit(0);
}

applyStep23DDL().catch((err) => {
  console.error("Failed to apply Step 23 DDL:", err);
  process.exit(1);
});
