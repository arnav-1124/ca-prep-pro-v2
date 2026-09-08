import { db } from "../src/db";
import {
  academicLevels,
  curriculumVersions,
  curriculumNodes,
  subjects,
  questions,
  questionVersions,
  questionSources,
  importBatches,
  examAttempts,
} from "../src/db/schema";
import { eq, and, sql, isNull } from "drizzle-orm";

async function verify() {
  console.log("================================================================================");
  console.log("CA INTERMEDIATE STUDY MATERIAL INGESTION & EXAM ATTEMPT AUDIT");
  console.log("================================================================================\n");

  const [interLevel] = await db
    .select()
    .from(academicLevels)
    .where(eq(academicLevels.code, "INTERMEDIATE"))
    .limit(1);

  if (!interLevel) {
    throw new Error("CA Intermediate academic level not found");
  }

  const may2026AttemptId = "fdfe2067-83bc-4c5f-87b0-58d1cc02abe9";
  const [attempt] = await db
    .select()
    .from(examAttempts)
    .where(eq(examAttempts.id, may2026AttemptId))
    .limit(1);

  console.log(`Target Exam Attempt in DB: [${attempt.name}] Year: ${attempt.year}, Month: ${attempt.month} (ID: ${attempt.id})\n`);

  // 1. Audit Batches
  const batches = await db
    .select({
      batchId: importBatches.id,
      batchName: importBatches.batchName,
      subjectId: importBatches.subjectId,
      status: importBatches.status,
      totalQuestions: importBatches.totalQuestions,
      validQuestions: importBatches.validQuestionsCount,
      examAttemptId: importBatches.examAttemptId,
      sourceType: importBatches.sourceType,
      sourceYear: importBatches.sourceYear,
      sourceMonth: importBatches.sourceMonth,
    })
    .from(importBatches)
    .where(eq(importBatches.academicLevelId, interLevel.id))
    .orderBy(importBatches.createdAt);

  console.log("--- 1. BATCH AUDIT (Intermediate) ---");
  console.table(batches);

  // 2. Audit Questions by Subject
  const subjectSummary = await db
    .select({
      subjectCode: subjects.code,
      subjectName: subjects.name,
      totalLiveQuestions: sql<number>`count(distinct ${questions.id})::int`,
      activeVersions: sql<number>`count(distinct ${questionVersions.id}) filter (where ${questionVersions.isActive} = true)::int`,
      standaloneMcqs: sql<number>`count(distinct ${questions.id}) filter (where ${questions.caseStudyId} is null)::int`,
      caseStudyQuestions: sql<number>`count(distinct ${questions.id}) filter (where ${questions.caseStudyId} is not null)::int`,
      linkedToMay2026Source: sql<number>`count(distinct ${questions.id}) filter (where ${questionSources.examAttemptId} = ${may2026AttemptId})::int`,
    })
    .from(subjects)
    .innerJoin(questions, eq(questions.subjectId, subjects.id))
    .innerJoin(questionVersions, eq(questionVersions.questionId, questions.id))
    .leftJoin(questionSources, eq(questionVersions.sourceId, questionSources.id))
    .where(eq(subjects.academicLevelId, interLevel.id))
    .groupBy(subjects.code, subjects.name)
    .orderBy(subjects.code);

  console.log("\n--- 2. QUESTION & EXAM ATTEMPT LINKING SUMMARY BY SUBJECT ---");
  console.table(subjectSummary);

  // 3. Audit Version Metadata Sample
  const sampleVersions = await db
    .select({
      subjectCode: subjects.code,
      questionText: sql<string>`left(${questionVersions.questionText}, 60)`,
      examAttemptMeta: sql<string>`${questionVersions.sourceMetadata}->>'examAttempt'`,
      examAttemptIdMeta: sql<string>`${questionVersions.sourceMetadata}->>'examAttemptId'`,
      statutoryNote: sql<string>`left(${questionVersions.sourceMetadata}->>'statutoryNote', 50)`,
      sourceYear: sql<string>`${questionVersions.sourceMetadata}->>'sourceYear'`,
    })
    .from(questionVersions)
    .innerJoin(questions, eq(questionVersions.questionId, questions.id))
    .innerJoin(subjects, eq(questions.subjectId, subjects.id))
    .where(eq(questions.academicLevelId, interLevel.id))
    .limit(6);

  console.log("\n--- 3. SAMPLE QUESTION VERSION METADATA AUDIT ---");
  console.table(sampleVersions);

  // 4. Invariant Checks
  const [unlinkedQuestions] = await db
    .select({
      count: sql<number>`count(*)::int`,
    })
    .from(questions)
    .innerJoin(questionVersions, eq(questionVersions.questionId, questions.id))
    .leftJoin(questionSources, eq(questionVersions.sourceId, questionSources.id))
    .where(
      and(
        eq(questions.academicLevelId, interLevel.id),
        sql`(${questionSources.examAttemptId} != ${may2026AttemptId} or ${questionSources.examAttemptId} is null)`
      )
    );

  console.log("\n--- 4. INVARIANT INTEGRITY CHECKS ---");
  console.log(`Intermediate questions NOT linked to May 2026 Exam Attempt: ${unlinkedQuestions.count}`);
  if (unlinkedQuestions.count === 0) {
    console.log("✓ INVARIANT VERIFIED: 100% of Intermediate questions are strictly linked to May 2026 attempt!");
  } else {
    console.error("❌ INVARIANT VIOLATION: Some questions are missing May 2026 attempt link!");
  }

  const [unmappedNodes] = await db
    .select({
      count: sql<number>`count(*)::int`,
    })
    .from(questions)
    .leftJoin(curriculumNodes, eq(questions.curriculumNodeId, curriculumNodes.id))
    .where(
      and(
        eq(questions.academicLevelId, interLevel.id),
        isNull(curriculumNodes.id)
      )
    );

  console.log(`Intermediate questions with invalid/missing curriculum nodes: ${unmappedNodes.count}`);
  if (unmappedNodes.count === 0) {
    console.log("✓ INVARIANT VERIFIED: 100% of Intermediate questions are mapped to valid curriculum nodes!");
  }
}

verify().catch(console.error).finally(() => process.exit(0));
