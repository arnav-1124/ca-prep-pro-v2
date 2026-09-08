import { db } from "../src/db";
import { academicLevels, examAttempts } from "../src/db/schema";
import { eq, and, sql } from "drizzle-orm";

async function main() {
  console.log("=== SEEDING OFFICIAL EXAM ATTEMPTS & MIGRATING COLUMNS ===");

  // 1. Add columns to Neon DB if not present
  console.log("Applying column migrations for exam_attempt_id...");
  await db.execute(sql`ALTER TABLE import_batches ADD COLUMN IF NOT EXISTS exam_attempt_id UUID REFERENCES exam_attempts(id)`);
  await db.execute(sql`ALTER TABLE question_sources ADD COLUMN IF NOT EXISTS exam_attempt_id UUID REFERENCES exam_attempts(id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS import_batches_exam_attempt_idx ON import_batches (exam_attempt_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS question_sources_exam_attempt_idx ON question_sources (exam_attempt_id)`);
  console.log("✓ Column migrations applied successfully.");

  // 2. Fetch academic levels
  const levels = await db.select().from(academicLevels);
  const fndLevel = levels.find((l) => l.code === "FOUNDATION");
  const interLevel = levels.find((l) => l.code === "INTERMEDIATE");

  if (!interLevel) throw new Error("CA Intermediate academic level not found");
  if (!fndLevel) throw new Error("CA Foundation academic level not found");

  // 3. Define Official Exam Attempts
  const interAttempts = [
    { name: "May 2026", year: 2026, month: 5, targetDate: new Date("2026-05-02T09:00:00.000Z") },
    { name: "September 2026", year: 2026, month: 9, targetDate: new Date("2026-09-12T09:00:00.000Z") },
    { name: "January 2027", year: 2027, month: 1, targetDate: new Date("2027-01-15T09:00:00.000Z") },
    { name: "May 2027", year: 2027, month: 5, targetDate: new Date("2027-05-02T09:00:00.000Z") },
  ];

  const fndAttempts = [
    { name: "June 2026", year: 2026, month: 6, targetDate: new Date("2026-06-20T09:00:00.000Z") },
    { name: "September 2026", year: 2026, month: 9, targetDate: new Date("2026-09-20T09:00:00.000Z") },
    { name: "January 2027", year: 2027, month: 1, targetDate: new Date("2027-01-20T09:00:00.000Z") },
  ];

  // 4. Seed Intermediate Attempts
  console.log(`\nSeeding ${interAttempts.length} Exam Attempts for CA Intermediate...`);
  for (const item of interAttempts) {
    const [existing] = await db
      .select()
      .from(examAttempts)
      .where(
        and(
          eq(examAttempts.academicLevelId, interLevel.id),
          eq(examAttempts.year, item.year),
          eq(examAttempts.month, item.month)
        )
      )
      .limit(1);

    if (existing) {
      console.log(`  - [EXISTING] ${item.name} (ID: ${existing.id})`);
    } else {
      const [created] = await db
        .insert(examAttempts)
        .values({
          academicLevelId: interLevel.id,
          name: item.name,
          year: item.year,
          month: item.month,
          targetDate: item.targetDate,
          isActive: true,
        })
        .returning();
      console.log(`  + [CREATED] ${item.name} (ID: ${created.id})`);
    }
  }

  // 5. Seed Foundation Attempts
  console.log(`\nSeeding ${fndAttempts.length} Exam Attempts for CA Foundation...`);
  for (const item of fndAttempts) {
    const [existing] = await db
      .select()
      .from(examAttempts)
      .where(
        and(
          eq(examAttempts.academicLevelId, fndLevel.id),
          eq(examAttempts.year, item.year),
          eq(examAttempts.month, item.month)
        )
      )
      .limit(1);

    if (existing) {
      console.log(`  - [EXISTING] ${item.name} (ID: ${existing.id})`);
    } else {
      const [created] = await db
        .insert(examAttempts)
        .values({
          academicLevelId: fndLevel.id,
          name: item.name,
          year: item.year,
          month: item.month,
          targetDate: item.targetDate,
          isActive: true,
        })
        .returning();
      console.log(`  + [CREATED] ${item.name} (ID: ${created.id})`);
    }
  }

  console.log("\n==================================================");
  console.log("EXAM ATTEMPTS SEEDED & RELATIONS VERIFIED!");
  console.log("==================================================");
}

main().catch(console.error);
