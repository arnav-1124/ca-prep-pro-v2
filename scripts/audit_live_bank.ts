import { db } from "../src/db";
import {
  questions,
  questionVersions,
  questionOptions,
  subjects,
  academicLevels,
  curriculumNodes,
  questionSources,
  importBatches,
} from "../src/db/schema";
import { eq, sql, isNull } from "drizzle-orm";

async function main() {
  console.log("=== COMPREHENSIVE LIVE QUESTION BANK AUDIT ===");

  // 1. Overall Totals
  const [totalQuestionsResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(questions);

  const [totalVersionsResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(questionVersions);

  const [totalOptionsResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(questionOptions);

  console.log(`\n1. Global Database Inventory:`);
  console.log(`- Total Live Questions: ${totalQuestionsResult.count}`);
  console.log(`- Total Live Question Versions: ${totalVersionsResult.count}`);
  console.log(`- Total Live Question Options: ${totalOptionsResult.count}`);

  // 2. Breakdown by Subject
  const subjectBreakdown = await db
    .select({
      subjectCode: subjects.code,
      subjectName: subjects.name,
      questionCount: sql<number>`count(${questions.id})::int`,
    })
    .from(questions)
    .innerJoin(subjects, eq(questions.subjectId, subjects.id))
    .groupBy(subjects.code, subjects.name)
    .orderBy(subjects.code);

  console.log(`\n2. Question Count by Subject:`);
  for (const s of subjectBreakdown) {
    console.log(`- [${s.subjectCode}] ${s.subjectName}: ${s.questionCount} live questions`);
  }

  // 3. Breakdown by Source Type
  const sourceBreakdown = await db
    .select({
      sourceType: sql<string>`coalesce(${questionSources.sourceType}, 'UNLINKED_SOURCE')`,
      sourceTitle: sql<string>`coalesce(${questionSources.sourceTitle}, 'N/A')`,
      questionCount: sql<number>`count(${questions.id})::int`,
    })
    .from(questions)
    .innerJoin(questionVersions, eq(questions.id, questionVersions.questionId))
    .leftJoin(questionSources, eq(questionVersions.sourceId, questionSources.id))
    .groupBy(questionSources.sourceType, questionSources.sourceTitle)
    .orderBy(sql`count(${questions.id}) desc`);

  console.log(`\n3. Breakdown by Source Collection:`);
  for (const src of sourceBreakdown) {
    console.log(`- [${src.sourceType}] ${src.sourceTitle}: ${src.questionCount} questions`);
  }

  // 4. Integrity Checks
  console.log(`\n4. Data Integrity & Verification Checks:`);

  // 4a. Check for questions without versions
  const orphanQuestions = await db
    .select({ id: questions.id })
    .from(questions)
    .leftJoin(questionVersions, eq(questions.id, questionVersions.questionId))
    .where(isNull(questionVersions.id));
  console.log(`- Questions without versions: ${orphanQuestions.length} (Expected: 0)`);

  // 4b. Check for question versions without options
  const orphanVersions = await db
    .select({ id: questionVersions.id })
    .from(questionVersions)
    .leftJoin(questionOptions, eq(questionVersions.id, questionOptions.questionVersionId))
    .where(isNull(questionOptions.id));
  console.log(`- Question versions without options: ${orphanVersions.length} (Expected: 0)`);

  // 4c. Check for answer key mismatches (where correct_answer is not among option_letter)
  const invalidAnswers = await db.execute(sql`
    SELECT qv.id, qv.correct_answer, string_agg(qo.option_letter, ',') as available_options
    FROM question_versions qv
    JOIN question_options qo ON qv.id = qo.question_version_id
    GROUP BY qv.id, qv.correct_answer
    HAVING NOT (qv.correct_answer = ANY(array_agg(qo.option_letter)))
  `);
  console.log(`- Questions with answer key mismatch: ${invalidAnswers.rows.length} (Expected: 0)`);

  // 4d. Check for unmapped curriculum nodes
  const unmappedQuestions = await db
    .select({ id: questions.id })
    .from(questions)
    .leftJoin(curriculumNodes, eq(questions.curriculumNodeId, curriculumNodes.id))
    .where(isNull(curriculumNodes.id));
  console.log(`- Questions with missing syllabus node: ${unmappedQuestions.length} (Expected: 0)`);

  // 5. MTP Specific Batch Summary
  const mtpBatches = await db
    .select({
      id: importBatches.id,
      name: importBatches.batchName,
      status: importBatches.status,
      total: importBatches.totalQuestions,
      approved: importBatches.approvedCount,
      rejected: importBatches.rejectedCount,
      published: importBatches.publishedCount,
    })
    .from(importBatches)
    .where(sql`${importBatches.batchName} ILIKE '%Official Model Test Papers 2025%'`);

  console.log(`\n5. Official 2025 MTP Staging Batch Lifecycle Status:`);
  for (const b of mtpBatches) {
    console.log(`- [${b.status}] ${b.name}: Total ${b.total}, Approved ${b.approved}, Rejected ${b.rejected}, Published ${b.published}`);
  }

  console.log(`\n=== AUDIT COMPLETE ===`);
}

main().catch((err) => {
  console.error("Audit failed:", err);
  process.exit(1);
});
