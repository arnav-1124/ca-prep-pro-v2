import { db } from "../src/db";
import { sql } from "drizzle-orm";

async function applyStep22DDL() {
  console.log("Applying Step 22 practice schema updates to Neon database...");

  // 1. Alter practice_sessions table
  await db.execute(sql`
    ALTER TABLE practice_sessions 
      ADD COLUMN IF NOT EXISTS curriculum_version_id uuid REFERENCES curriculum_versions(id),
      ADD COLUMN IF NOT EXISTS session_seed integer DEFAULT 12345 NOT NULL,
      ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT now() NOT NULL,
      ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now() NOT NULL;
  `);
  console.log("✓ Updated practice_sessions columns");

  // 2. Add indexes on practice_sessions one by one
  await db.execute(sql`CREATE INDEX IF NOT EXISTS practice_sessions_student_idx ON practice_sessions (student_profile_id);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS practice_sessions_level_idx ON practice_sessions (academic_level_id);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS practice_sessions_version_idx ON practice_sessions (curriculum_version_id);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS practice_sessions_subject_idx ON practice_sessions (subject_id);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS practice_sessions_node_idx ON practice_sessions (curriculum_node_id);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS practice_sessions_status_idx ON practice_sessions (status);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS practice_sessions_created_at_idx ON practice_sessions (created_at);`);
  console.log("✓ Created practice_sessions indexes");

  // 3. Create practice_session_questions table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS practice_session_questions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      practice_session_id uuid NOT NULL REFERENCES practice_sessions(id) ON DELETE CASCADE,
      question_id uuid NOT NULL REFERENCES questions(id),
      question_version_id uuid NOT NULL REFERENCES question_versions(id),
      sequence_number integer NOT NULL,
      delivered_at timestamp DEFAULT now() NOT NULL
    );
  `);
  console.log("✓ Created practice_session_questions table");

  // 4. Create unique and lookup indexes on practice_session_questions
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS practice_session_questions_session_question_unique_idx 
      ON practice_session_questions (practice_session_id, question_id);
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS practice_session_questions_session_seq_unique_idx 
      ON practice_session_questions (practice_session_id, sequence_number);
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS practice_session_questions_session_idx 
      ON practice_session_questions (practice_session_id);
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS practice_session_questions_version_idx 
      ON practice_session_questions (question_version_id);
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS practice_session_questions_question_idx 
      ON practice_session_questions (question_id);
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS practice_session_questions_delivered_at_idx 
      ON practice_session_questions (delivered_at);
  `);
  console.log("✓ Created practice_session_questions indexes");

  console.log("✓ Successfully applied Step 22 practice DDL to database.");
  process.exit(0);
}

applyStep22DDL().catch((err) => {
  console.error("Failed to apply Step 22 DDL:", err);
  process.exit(1);
});
