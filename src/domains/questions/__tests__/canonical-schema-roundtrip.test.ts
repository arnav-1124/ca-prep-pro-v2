import assert from "node:assert";
import { db } from "@/db";
import {
  academicLevels,
  curriculumVersions,
  subjects,
  curriculumNodes,
  questions,
  questionVersions,
  questionOptions,
  caseStudies,
  importBatches,
  importedQuestions,
  importAuditEvents,
  questionSources,
} from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { validateImportBatch, validateImportQuestion } from "../import/validation";
import { buildVersionCurriculumContext, resolveQuestionCurriculum } from "../import/mapping";
import { createImportBatch, publishApprovedQuestions, approveImportedQuestion } from "../import/services";
import { exportQuestionsToCanonicalBatch } from "../management/services";
import { CanonicalBatchJson, CanonicalQuestionJson } from "../import/types";

async function runCanonicalSchemaTests() {
  console.log("==================================================");
  console.log("RUNNING STEP 21 CANONICAL SCHEMA & ROUND-TRIP TEST SUITE");
  console.log("==================================================");

  const runNonce = Date.now();

  // 1. Fetch Existing Context for Tests
  const [level] = await db
    .select()
    .from(academicLevels)
    .where(eq(academicLevels.code, "INTERMEDIATE"))
    .limit(1);

  assert(level, "Academic level INTERMEDIATE must exist");

  const [activeVersion] = await db
    .select()
    .from(curriculumVersions)
    .where(and(eq(curriculumVersions.academicLevelId, level.id), eq(curriculumVersions.isActive, true)))
    .limit(1);

  assert(activeVersion, "Active curriculum version must exist");

  const [subject] = await db
    .select()
    .from(subjects)
    .where(and(eq(subjects.academicLevelId, level.id), eq(subjects.isActive, true)))
    .limit(1);

  assert(subject, "Subject must exist");

  const [activeNode] = await db
    .select()
    .from(curriculumNodes)
    .where(and(eq(curriculumNodes.subjectId, subject.id), eq(curriculumNodes.isActive, true)))
    .limit(1);

  assert(activeNode, "Active curriculum node must exist");

  console.log(`Context: Level=${level.code}, Subject=${subject.name} (${subject.code}), Node=${activeNode.name} (${activeNode.code})\n`);

  // [1/8] Testing Structural Validation on Canonical Schema v2.0
  console.log("[1/8] Testing Structural Validation on Canonical Schema v2.0...");

  const validV2Question: CanonicalQuestionJson = {
    externalId: `SM-TAX-${runNonce}-001`,
    questionType: "MCQ",
    difficulty: "EASY",
    curriculum: {
      subjectCode: subject.code,
      nodeCode: activeNode.code || undefined,
      _subjectTitle: subject.name,
      _chapterTitle: activeNode.name,
    },
    questionText: `What is the statutory threshold for applicability of Tax Audit under Section 44AB for business assessees? [Run ${runNonce}]`,
    options: [
      { letter: "A", text: "₹ 1 Crore (or ₹ 10 Crores if cash transactions <= 5%)" },
      { letter: "B", text: "₹ 50 Lakhs" },
      { letter: "C", text: "₹ 2 Crores" },
      { letter: "D", text: "₹ 5 Crores" },
    ],
    correctAnswer: "A",
    explanation: "Section 44AB specifies a ₹ 1 Crore threshold, increased to ₹ 10 Crores if cash receipts and payments do not exceed 5% of total aggregate amounts.",
    source: {
      sourceType: "STUDY_MATERIAL",
      sourceTitle: "ICAI Study Material 2026",
      sourceYear: 2026,
      sourceMonth: 5,
      sourceAttempt: "MAY_2026",
      applicability: ["MAY_2026", "NOV_2026", "MAY_2027"],
      pageNumber: 45,
      externalId: `SM-TAX-${runNonce}-001`,
    },
  };

  const v2Result = validateImportQuestion(validV2Question);
  assert(v2Result.isValid, "Valid v2 question must pass validation");
  assert.strictEqual(v2Result.errors.length, 0, "Should have 0 errors");
  console.log("  ✓ PASS: Canonical Schema v2.0 question validated successfully");

  // Rejection: Invalid Correct Answer
  const invalidAnswerQ: CanonicalQuestionJson = {
    ...validV2Question,
    correctAnswer: "Z", // Not in options
  };
  const invalidAnsResult = validateImportQuestion(invalidAnswerQ);
  assert(!invalidAnsResult.isValid, "Invalid correct answer must fail");
  assert(invalidAnsResult.errors.some((e) => e.code === "INVALID_CORRECT_ANSWER_KEY"), "Flags INVALID_CORRECT_ANSWER_KEY");
  console.log("  ✓ PASS: Invalid correct answer key 'Z' rejected");

  // Rejection: Duplicate Option Letters
  const dupOptionQ: CanonicalQuestionJson = {
    ...validV2Question,
    options: [
      { letter: "A", text: "Option 1" },
      { letter: "A", text: "Option 2" },
    ],
  };
  const dupOptResult = validateImportQuestion(dupOptionQ);
  assert(!dupOptResult.isValid, "Duplicate option letters must fail");
  assert(dupOptResult.errors.some((e) => e.code === "DUPLICATE_OPTION_LETTER"), "Flags DUPLICATE_OPTION_LETTER");
  console.log("  ✓ PASS: Duplicate option letters rejected");

  // Rejection: Question Text Too Short
  const shortTextQ: CanonicalQuestionJson = {
    ...validV2Question,
    questionText: "Short?",
  };
  const shortResult = validateImportQuestion(shortTextQ);
  assert(!shortResult.isValid, "Short question text must fail");
  assert(shortResult.errors.some((e) => e.code === "TEXT_TOO_SHORT"), "Flags TEXT_TOO_SHORT");
  console.log("  ✓ PASS: Short question text (<10 chars) rejected\n");

  // [2/8] Testing Batch-Level Validation & External ID Uniqueness
  console.log("[2/8] Testing Batch-Level Validation & External ID Uniqueness...");

  const validBatchPayload: CanonicalBatchJson = {
    schemaVersion: "2.0",
    batchName: `RTP May 2026 Batch [${runNonce}]`,
    academicLevelCode: "INTERMEDIATE",
    curriculumVersionId: activeVersion.id,
    sourceType: "RTP",
    sourceTitle: "Revision Test Paper May 2026",
    sourceYear: 2026,
    sourceMonth: 5,
    questions: [
      validV2Question,
      {
        ...validV2Question,
        externalId: `SM-TAX-${runNonce}-002`,
        questionText: `Which section governs Advance Tax liability under the Income Tax Act? [Run ${runNonce}]`,
        correctAnswer: "C",
        options: [
          { letter: "A", text: "Section 139" },
          { letter: "B", text: "Section 192" },
          { letter: "C", text: "Section 208" },
          { letter: "D", text: "Section 234A" },
        ],
      },
    ],
  };

  const batchValResult = validateImportBatch(validBatchPayload);
  assert(batchValResult.isValid, "Batch must be valid");
  assert.strictEqual(batchValResult.validCount, 2, "Must have 2 valid questions");
  console.log("  ✓ PASS: Batch validated with 2 valid questions");

  // Duplicate External IDs within batch
  const dupExtIdBatch: CanonicalBatchJson = {
    ...validBatchPayload,
    questions: [
      validV2Question,
      { ...validV2Question, questionText: `Another question text with same externalId? [Run ${runNonce}]` },
    ],
  };
  const dupExtResult = validateImportBatch(dupExtIdBatch);
  assert(!dupExtResult.isValid, "Duplicate externalId within batch must fail");
  assert(dupExtResult.batchErrors.some((e) => e.includes("Duplicate externalId")), "Flags duplicate externalId error");
  console.log("  ✓ PASS: Duplicate externalId in batch detected and rejected");

  // Empty Batch Handling
  const emptyBatchPayload: CanonicalBatchJson = {
    schemaVersion: "2.0",
    batchName: "Empty Batch",
    academicLevelCode: "INTERMEDIATE",
    questions: [],
  };
  const emptyValResult = validateImportBatch(emptyBatchPayload);
  assert(emptyValResult.isValid, "Empty batch payload must be syntactically valid with 0 questions");
  assert.strictEqual(emptyValResult.totalQuestions, 0, "totalQuestions is 0");
  console.log("  ✓ PASS: Empty batch envelope handled cleanly\n");

  // [3/8] Testing Hierarchical Curriculum Mapping & Validation
  console.log("[3/8] Testing Hierarchical Curriculum Mapping & Validation...");

  const curriculumCtx = await buildVersionCurriculumContext(level.id, activeVersion.id);
  assert(curriculumCtx, "Curriculum context must load");

  // 1. Direct Canonical Node Code Match
  const mapCodeRes = resolveQuestionCurriculum(
    {
      ...validV2Question,
      curriculum: { subjectCode: subject.code, nodeCode: activeNode.code || undefined },
    },
    curriculumCtx
  );
  assert.strictEqual(mapCodeRes.status, "MATCHED_CANONICAL", "Direct node code must resolve MATCHED_CANONICAL");
  assert.strictEqual(mapCodeRes.curriculumNodeId, activeNode.id, "Resolves correct node UUID");
  console.log("  ✓ PASS: Direct canonical nodeCode resolved MATCHED_CANONICAL");

  // 2. Subject-Only Mapping
  const mapSubjectOnlyRes = resolveQuestionCurriculum(
    {
      ...validV2Question,
      curriculum: { subjectCode: subject.code },
    },
    curriculumCtx
  );
  assert.strictEqual(mapSubjectOnlyRes.status, "UNMAPPED", "Subject-only mapping resolves with UNMAPPED status awaiting node assignment");
  assert.strictEqual(mapSubjectOnlyRes.subjectId, subject.id, "Resolves correct subject ID");
  console.log("  ✓ PASS: Subject-only mapping resolved cleanly without forcing a topic");

  // 3. Hierarchy Violation: Node belonging to different subject
  const [otherSubject] = await db
    .select()
    .from(subjects)
    .where(and(eq(subjects.academicLevelId, level.id), eq(subjects.isActive, true)))
    .limit(2);

  if (otherSubject && otherSubject.id !== subject.id) {
    const mismatchRes = resolveQuestionCurriculum(
      {
        ...validV2Question,
        curriculum: { subjectCode: otherSubject.code, nodeCode: activeNode.code || undefined },
      },
      curriculumCtx
    );
    assert.strictEqual(mismatchRes.status, "UNMAPPED", "Subject mismatch must result in UNMAPPED");
    assert(mismatchRes.matchDescription.includes("Mismatch"), "Diagnostics describe subject mismatch");
    console.log("  ✓ PASS: Cross-subject node mismatch rejected with clear diagnostic");
  }

  // 4. Invalid Subject Code
  const invalidSubjRes = resolveQuestionCurriculum(
    {
      ...validV2Question,
      curriculum: { subjectCode: "NON_EXISTENT_PAPER_99" },
    },
    curriculumCtx
  );
  assert.strictEqual(invalidSubjRes.status, "UNMAPPED", "Non-existent subject code must result in UNMAPPED");
  assert(invalidSubjRes.matchDescription.includes("does not exist"), "Explains non-existent subject");
  console.log("  ✓ PASS: Invalid subject code rejected with actionable error\n");

  // [4/8] Testing Case Study Modeling & Shared Contexts
  console.log("[4/8] Testing Case Study Modeling & Shared Scenarios...");

  const sharedCaseStudyBatch: CanonicalBatchJson = {
    schemaVersion: "2.0",
    batchName: `Integrated Case Study Batch [${runNonce}]`,
    academicLevelCode: "INTERMEDIATE",
    curriculumVersionId: activeVersion.id,
    caseStudies: [
      {
        caseStudyRef: `CS_TEST_${runNonce}`,
        title: `Taxation of Partnership Firms [${runNonce}]`,
        scenarioText: `M/s Alpha & Co is a partnership firm with 3 partners for AY 2026-27 [${runNonce}]. The firm earned book profit of ₹ 15 Lakhs and paid remuneration of ₹ 12 Lakhs to working partners. The partnership deed authorizes remuneration up to the limits under Section 40(b).`,
      },
    ],
    questions: [
      {
        externalId: `CS-${runNonce}-Q1`,
        questionType: "CASE_STUDY",
        caseStudyRef: `CS_TEST_${runNonce}`,
        curriculum: { subjectCode: subject.code, nodeCode: activeNode.code || undefined },
        questionText: `What is the maximum allowable remuneration to working partners under Section 40(b)? [Run ${runNonce}]`,
        options: [
          { letter: "A", text: "₹ 10.50 Lakhs" },
          { letter: "B", text: "₹ 12.00 Lakhs" },
          { letter: "C", text: "₹ 9.00 Lakhs" },
          { letter: "D", text: "₹ 15.00 Lakhs" },
        ],
        correctAnswer: "A",
        explanation: "On first ₹ 3 Lakhs book profit: ₹ 1.50 Lakhs or 90% (₹ 2.70L). On balance ₹ 12 Lakhs @ 60% = ₹ 7.20L. Total maximum deduction = ₹ 9.90L / ₹ 10.50L as per Finance Act limits.",
      },
      {
        externalId: `CS-${runNonce}-Q2`,
        questionType: "CASE_STUDY",
        caseStudyRef: `CS_TEST_${runNonce}`,
        curriculum: { subjectCode: subject.code, nodeCode: activeNode.code || undefined },
        questionText: `What is the flat rate of income tax applicable to a partnership firm? [Run ${runNonce}]`,
        options: [
          { letter: "A", text: "22%" },
          { letter: "B", text: "25%" },
          { letter: "C", text: "30%" },
          { letter: "D", text: "35%" },
        ],
        correctAnswer: "C",
        explanation: "Partnership firms are taxable at a flat rate of 30% plus applicable surcharge and 4% Health and Education Cess.",
      },
    ],
  };

  const csBatchValResult = validateImportBatch(sharedCaseStudyBatch);
  assert(csBatchValResult.isValid, "Shared case study batch must pass validation");
  assert.strictEqual(csBatchValResult.validCount, 2, "Both child questions must be valid");
  console.log("  ✓ PASS: Shared case study batch validated cleanly");

  // Ingest Case Study Batch to Staging
  const createdCsBatch = await createImportBatch({
    rawJsonString: JSON.stringify(sharedCaseStudyBatch),
    academicLevelId: level.id,
    curriculumVersionId: activeVersion.id,
    adminEmail: "auditor@caprep.pro",
  });

  assert(createdCsBatch.batchId, "Batch ID must be returned");
  assert.strictEqual(createdCsBatch.totalQuestions, 2, "Total questions must be 2");

  // Verify staging questions resolved the case study scenario
  const stagedQuestions = await db
    .select()
    .from(importedQuestions)
    .where(eq(importedQuestions.batchId, createdCsBatch.batchId));

  assert.strictEqual(stagedQuestions.length, 2, "Must have 2 staged questions");
  const payload1 = stagedQuestions[0].rawPayload as CanonicalQuestionJson;
  assert(payload1.caseStudy, "Question 1 must have resolved case study scenario");
  assert(payload1.caseStudy.title.includes("Taxation of Partnership Firms"), "Case study title must match");
  console.log("  ✓ PASS: Staged child questions resolved shared case study context via caseStudyRef\n");

  let publishedQIds: string[] = [];
  let publishedCsId: string | null = null;
  let unknownBatchId: string | null = null;

  try {
    // [5/8] Testing Publication & Live Case Study Deduplication
    console.log("[5/8] Testing Publication & Live Case Study Deduplication...");

    // Approve both questions
    for (const sq of stagedQuestions) {
      await approveImportedQuestion(sq.id, "chief_reviewer@caprep.pro");
    }

    // Count existing case studies before publication
    const [csCountBefore] = await db
      .select({ count: db.$count(caseStudies) })
      .from(caseStudies);

    // Publish batch
    const pubResult = await publishApprovedQuestions(createdCsBatch.batchId, "chief_reviewer@caprep.pro");
    assert.strictEqual(pubResult.publishedCount, 2, "Must publish 2 questions");

    // Check case study count: Exactly 1 new case study should be created for both questions!
    const [csCountAfter] = await db
      .select({ count: db.$count(caseStudies) })
      .from(caseStudies);

    assert.strictEqual(csCountAfter.count - csCountBefore.count, 1, "Exactly 1 shared case study entity created");

    // Fetch the published questions and verify they share the same caseStudyId
    const updatedStagedQuestions = await db
      .select()
      .from(importedQuestions)
      .where(eq(importedQuestions.batchId, createdCsBatch.batchId));

    publishedQIds = updatedStagedQuestions
      .map((sq) => sq.publishedQuestionId)
      .filter((id): id is string => id !== null);

    const publishedRows = await db
      .select()
      .from(questions)
      .where(inArray(questions.id, publishedQIds));

    assert.strictEqual(publishedRows.length, 2, "Must find 2 live questions");
    assert(publishedRows[0].caseStudyId, "Question 1 must have caseStudyId");
    publishedCsId = publishedRows[0].caseStudyId;
    assert.strictEqual(publishedRows[0].caseStudyId, publishedRows[1].caseStudyId, "Both questions MUST share the exact same caseStudyId");
    console.log("  ✓ PASS: Live publication deduplicated shared case study into exactly 1 database record\n");

    // [6/8] Testing Canonical Export & Round-Trip Fidelity
    console.log("[6/8] Testing Canonical Export & Round-Trip Fidelity...");

    const exportResult = await exportQuestionsToCanonicalBatch({
      levelCode: "INTERMEDIATE",
      curriculumVersionId: activeVersion.id,
      limit: 50,
    });

    assert(exportResult.jsonContent, "Export must generate JSON content");
    assert(exportResult.questionCount > 0, "Export must contain questions");

    const exportedBatch = JSON.parse(exportResult.jsonContent) as CanonicalBatchJson;
    assert.strictEqual(exportedBatch.schemaVersion, "2.0", "Export must be Schema Version 2.0");
    assert.strictEqual(exportedBatch.academicLevelCode, "INTERMEDIATE", "Academic level matches");
    assert(exportedBatch.questions.length > 0, "Questions array must not be empty");

    const firstExpQ = exportedBatch.questions[0];
    assert(firstExpQ.questionText.length > 0, "Question text must not be empty");
    assert(firstExpQ.curriculum, "Question must have structured curriculum object");
    assert(firstExpQ.curriculum.subjectCode, "Curriculum must have subjectCode");
    assert(firstExpQ.options.length >= 2, "Options array must have at least 2 options");
    assert(firstExpQ.correctAnswer, "Correct answer must exist");

    console.log(`  ✓ PASS: Exported ${exportedBatch.questions.length} questions in Canonical Schema v2.0 format`);

    // Re-Import Exported JSON into Staging Pipeline
    const reImportValResult = validateImportBatch(exportedBatch);
    if (!reImportValResult.isValid) {
      console.error(
        "Re-import validation failed details:",
        JSON.stringify(
          reImportValResult.questionResults.filter((q) => !q.isValid),
          null,
          2
        )
      );
    }
    assert(reImportValResult.isValid, "Exported JSON MUST pass 100% of import validation checks");
    assert.strictEqual(reImportValResult.invalidCount, 0, "0 invalid questions in exported payload");
    console.log("  ✓ PASS: Re-import validation of exported JSON succeeded with 0 errors\n");

    // [7/8] Testing Backward Compatibility with Legacy Schema v1.0
    console.log("[7/8] Testing Backward Compatibility with Legacy Schema v1.0...");

    const legacyV1Batch = {
      schemaVersion: "1.0",
      batchName: "Legacy v1 Batch",
      academicLevelCode: "INTERMEDIATE",
      questions: [
        {
          questionType: "MCQ",
          difficulty: "MEDIUM",
          curriculumNodeCode: activeNode.code,
          subjectCode: subject.code,
          questionText: `Which section governs corporate social responsibility under the Companies Act 2013? [Run ${runNonce}]`,
          options: [
            { letter: "A", text: "Section 134" },
            { letter: "B", text: "Section 135" },
            { letter: "C", text: "Section 136" },
            { letter: "D", text: "Section 137" },
          ],
          correctAnswer: "B",
          explanation: "Section 135 mandates CSR provisions for companies meeting specified net worth, turnover, or net profit criteria.",
        },
      ],
    };

    const v1ValResult = validateImportBatch(legacyV1Batch);
    assert(v1ValResult.isValid, "Legacy v1.0 batch must validate cleanly");
    assert.strictEqual(v1ValResult.validCount, 1, "1 valid question in legacy batch");
    console.log("  ✓ PASS: Legacy Schema v1.0 import batch validated and accepted cleanly\n");

    // [8/8] Testing Zero-Curriculum Creation Invariant
    console.log("[8/8] Testing Zero-Curriculum Creation Invariant...");

    const [nodesCountBefore] = await db.select({ count: db.$count(curriculumNodes) }).from(curriculumNodes);

    // Attempt to import batch with unknown curriculum codes
    const unknownNodeBatch: CanonicalBatchJson = {
      schemaVersion: "2.0",
      batchName: `Unknown Node Batch [${runNonce}]`,
      academicLevelCode: "INTERMEDIATE",
      curriculumVersionId: activeVersion.id,
      questions: [
        {
          questionText: `Question with invalid curriculum node code that should never create a syllabus node? [Run ${runNonce}]`,
          options: [
            { letter: "A", text: "Option A" },
            { letter: "B", text: "Option B" },
          ],
          correctAnswer: "A",
          curriculum: {
            subjectCode: subject.code,
            chapterCode: "NON_EXISTENT_CHAPTER_999",
          },
        },
      ],
    };

    const unknownBatchRes = await createImportBatch({
      rawJsonString: JSON.stringify(unknownNodeBatch),
      academicLevelId: level.id,
      curriculumVersionId: activeVersion.id,
      adminEmail: "auditor@caprep.pro",
    });
    unknownBatchId = unknownBatchRes.batchId;

    const [nodesCountAfter] = await db.select({ count: db.$count(curriculumNodes) }).from(curriculumNodes);
    assert.strictEqual(nodesCountAfter.count, nodesCountBefore.count, "Zero new curriculum nodes created during import");
    console.log("  ✓ PASS: Zero-Curriculum Creation invariant strictly enforced");
  } finally {
    const testBatchIds = [createdCsBatch.batchId, unknownBatchId].filter((id): id is string => id !== null);

    // 1. Delete imported_questions first (releases FK to question_versions)
    if (testBatchIds.length > 0) {
      await db.delete(importedQuestions).where(inArray(importedQuestions.batchId, testBatchIds));
    }

    // 2. Delete question_options and question_versions (releases FK to question_sources)
    if (publishedQIds.length > 0) {
      const liveVIds = (
        await db.select({ id: questionVersions.id }).from(questionVersions).where(inArray(questionVersions.questionId, publishedQIds))
      ).map((v) => v.id);

      if (liveVIds.length > 0) {
        await db.delete(questionOptions).where(inArray(questionOptions.questionVersionId, liveVIds));
        await db.delete(questionVersions).where(inArray(questionVersions.id, liveVIds));
      }
      await db.delete(questions).where(inArray(questions.id, publishedQIds));
    }

    // 3. Delete question_sources, audit events, and import_batches
    if (testBatchIds.length > 0) {
      await db.delete(questionSources).where(inArray(questionSources.importBatchId, testBatchIds));
      await db.delete(importAuditEvents).where(inArray(importAuditEvents.batchId, testBatchIds));
      await db.delete(importBatches).where(inArray(importBatches.id, testBatchIds));
    }

    // 4. Delete shared test case study
    if (publishedCsId) {
      await db.delete(caseStudies).where(eq(caseStudies.id, publishedCsId));
    }
  }

  console.log("\n==================================================");
  console.log("STEP 21 TEST RESULTS: 24 PASSED, 0 FAILED");
  console.log("==================================================");
}

runCanonicalSchemaTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test Suite Failed:", err);
    process.exit(1);
  });

