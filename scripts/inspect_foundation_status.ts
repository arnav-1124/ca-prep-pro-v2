import { db } from "../src/db";
import { academicLevels, subjects, questions, questionVersions, importBatches, caseStudies, importedQuestions } from "../src/db/schema";
import { eq, sql } from "drizzle-orm";

async function check() {
  const [fnd] = await db.select().from(academicLevels).where(eq(academicLevels.code, "FOUNDATION"));
  if (!fnd) {
    console.log("No Foundation level found.");
    return;
  }
  console.log("=== CA FOUNDATION PUBLISHED QUESTIONS AUDIT ===");

  // 1. By Subject
  const qCountBySub = await db.select({
    subjectCode: subjects.code,
    subjectName: subjects.name,
    totalQuestions: sql<number>`count(distinct ${questions.id})::int`,
    activeVersions: sql<number>`count(distinct ${questionVersions.id}) filter (where ${questionVersions.isActive} = true)::int`,
    standaloneMcqs: sql<number>`count(distinct ${questions.id}) filter (where ${questions.caseStudyId} is null)::int`,
    caseStudyQuestions: sql<number>`count(distinct ${questions.id}) filter (where ${questions.caseStudyId} is not null)::int`,
  })
  .from(subjects)
  .leftJoin(questions, eq(questions.subjectId, subjects.id))
  .leftJoin(questionVersions, eq(questionVersions.questionId, questions.id))
  .where(eq(subjects.academicLevelId, fnd.id))
  .groupBy(subjects.code, subjects.name)
  .orderBy(subjects.code);

  console.log("\n--- SUMMARY BY SUBJECT ---");
  console.table(qCountBySub);

  // 2. By Source Type (STUDY_MATERIAL, MTP, RTP) and Subject
  const bySource = await db.select({
    subjectCode: subjects.code,
    sourceType: importBatches.sourceType,
    batchCount: sql<number>`count(distinct ${importBatches.id})::int`,
    batchDeclaredQuestions: sql<number>`sum(${importBatches.totalQuestions})::int`,
  })
  .from(importBatches)
  .innerJoin(subjects, eq(importBatches.subjectId, subjects.id))
  .where(eq(importBatches.academicLevelId, fnd.id))
  .groupBy(subjects.code, importBatches.sourceType)
  .orderBy(subjects.code, importBatches.sourceType);

  console.log("\n--- BATCHES BY SUBJECT & SOURCE TYPE ---");
  console.table(bySource);

  // 3. Total live questions in Foundation
  const [totals] = await db.select({
    totalLiveQuestions: sql<number>`count(distinct ${questions.id})::int`,
    activeVersions: sql<number>`count(distinct ${questionVersions.id}) filter (where ${questionVersions.isActive} = true)::int`,
  })
  .from(questions)
  .innerJoin(questionVersions, eq(questionVersions.questionId, questions.id))
  .where(eq(questions.academicLevelId, fnd.id));

  console.log(`\nGrand Total Live Questions in Foundation: ${totals?.totalLiveQuestions}`);
  console.log(`Grand Total Active Question Versions: ${totals?.activeVersions}`);

  const [caseCount] = await db.select({ count: sql<number>`count(*)::int` }).from(caseStudies);
  console.log(`Total Case Study Passages/Scenarios in Database: ${caseCount?.count}`);

  const [staging] = await db.select({
    pending: sql<number>`count(*) filter (where status = 'PENDING_REVIEW')::int`,
    published: sql<number>`count(*) filter (where status = 'PUBLISHED')::int`,
    total: sql<number>`count(*)::int`
  }).from(importedQuestions);

  console.log("\n--- STAGING QUEUE (imported_questions) ---");
  console.log(`Pending Review: ${staging?.pending}`);
  console.log(`Published to Live Bank: ${staging?.published}`);
  console.log(`Total Staged Historical Records: ${staging?.total}`);
}

check().catch(console.error).finally(() => process.exit(0));
