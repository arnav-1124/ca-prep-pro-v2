import { db } from "../src/db";
import { academicLevels, curriculumVersions, subjects, curriculumNodes, questions, importBatches } from "../src/db/schema";
import { eq, and } from "drizzle-orm";

async function main() {
  console.log("=== INSPECTING CA INTERMEDIATE STATUS ===");

  const [interLevel] = await db
    .select()
    .from(academicLevels)
    .where(eq(academicLevels.code, "INTERMEDIATE"))
    .limit(1);

  if (!interLevel) {
    console.log("❌ CA Intermediate academic level not found!");
    return;
  }
  console.log(`Academic Level: ${interLevel.name} (${interLevel.code}) - ID: ${interLevel.id}`);

  const activeVersions = await db
    .select()
    .from(curriculumVersions)
    .where(eq(curriculumVersions.academicLevelId, interLevel.id));

  console.log(`\nCurriculum Versions (${activeVersions.length}):`);
  for (const v of activeVersions) {
    console.log(`  - ${v.name} (ID: ${v.id}, Active: ${v.isActive})`);
  }

  const interSubjects = await db
    .select()
    .from(subjects)
    .where(eq(subjects.academicLevelId, interLevel.id))
    .orderBy(subjects.sortOrder);

  console.log(`\nSubjects (${interSubjects.length}):`);
  for (const s of interSubjects) {
    const nodeCount = await db.$count(curriculumNodes, eq(curriculumNodes.subjectId, s.id));
    const questionCount = await db.$count(questions, eq(questions.subjectId, s.id));
    console.log(`  - [${s.code}] ${s.name} (ID: ${s.id}, Sort: ${s.sortOrder}, Nodes: ${nodeCount}, Live Questions: ${questionCount})`);
  }

  const batches = await db
    .select()
    .from(importBatches)
    .where(eq(importBatches.academicLevelId, interLevel.id));

  console.log(`\nExisting Staged Batches for Intermediate (${batches.length}):`);
  for (const b of batches) {
    console.log(`  - [${b.id}] ${b.batchName} (Status: ${b.status}, Total: ${b.totalQuestions})`);
  }

  const { examAttempts, studentAttempts } = await import("../src/db/schema");
  const allAttempts = await db.select().from(examAttempts);
  console.log(`\nAll Configured Exam Attempts in DB (${allAttempts.length}):`);
  for (const a of allAttempts) {
    console.log(`  - [${a.name}] Year: ${a.year}, Month: ${a.month}, Level: ${a.academicLevelId}, Active: ${a.isActive}`);
  }

  const allStudentAttempts = await db.select().from(studentAttempts);
  console.log(`\nAll Student Attempts in DB (${allStudentAttempts.length}):`);
  for (const sa of allStudentAttempts) {
    console.log(`  - StudentProfile: ${sa.studentProfileId}, Level: ${sa.academicLevelId}, ExamAttemptId: ${sa.examAttemptId}, Active: ${sa.isActive}`);
  }
}

main().catch(console.error);
