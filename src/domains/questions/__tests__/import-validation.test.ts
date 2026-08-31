import { validateImportQuestion, validateImportBatch } from "../import/validation";
import { normalizeQuestionText, computeTokenSimilarity, checkQuestionDuplicate } from "../import/duplicates";
import { resolveQuestionCurriculum, VersionCurriculumContext } from "../import/mapping";
import {
  createImportBatch,
  approveImportedQuestion,
  rejectImportedQuestion,
  editImportedQuestion,
  publishApprovedQuestions,
  getBatchQuestionsList,
} from "../import/services";
import { db } from "@/db";
import {
  academicLevels,
  curriculumVersions,
  importBatches,
  importedQuestions,
  importAuditEvents,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import fs from "fs";
import path from "path";

async function runTests() {
  console.log("==================================================");
  console.log("RUNNING HARDENED STEP 18 IMPORT & REVIEW TEST SUITE");
  console.log("==================================================");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${testName}`);
      failed++;
    }
  }

  // =========================================================================
  // 1. VALIDATION TESTS
  // =========================================================================
  console.log("\n[1/7] Testing Server-Side Validation Pipeline...");

  // Valid MCQ
  const validMcq = validateImportQuestion({
    questionText: "What is the primary objective of financial accounting?",
    options: [
      { letter: "A", text: "To record and report transactions." },
      { letter: "B", text: "To compute voluntary market parameters." },
      { letter: "C", text: "To bypass statutory filing." },
      { letter: "D", text: "To delegate internal audit duties." },
    ],
    correctAnswer: "A",
    explanation: "Financial accounting provides structured information on financial performance.",
  });
  assert(validMcq.isValid === true, "Valid MCQ passes validation with 0 errors");
  assert(validMcq.errors.length === 0, "No errors on valid MCQ");

  // Invalid Answer Key
  const invalidKey = validateImportQuestion({
    questionText: "What is the primary objective of financial accounting?",
    options: [
      { letter: "A", text: "Option A" },
      { letter: "B", text: "Option B" },
    ],
    correctAnswer: "E", // Doesn't exist
  });
  assert(invalidKey.isValid === false, "Invalid answer key 'E' fails validation");
  assert(invalidKey.errors.some((e) => e.code === "INVALID_CORRECT_ANSWER_KEY"), "Flags INVALID_CORRECT_ANSWER_KEY error");

  // Duplicate Option Letters
  const dupOptionLetters = validateImportQuestion({
    questionText: "What is the primary objective of financial accounting?",
    options: [
      { letter: "A", text: "Option A" },
      { letter: "A", text: "Duplicate Option A" },
      { letter: "B", text: "Option B" },
    ],
    correctAnswer: "A",
  });
  assert(dupOptionLetters.isValid === false, "Duplicate option letters fail validation");
  assert(dupOptionLetters.errors.some((e) => e.code === "DUPLICATE_OPTION_LETTER"), "Flags DUPLICATE_OPTION_LETTER");

  // Valid Case Study
  const validCs = validateImportQuestion({
    questionType: "CASE_STUDY",
    questionText: "Based on the scenario above, what is the maximum number of directors permitted?",
    caseStudy: {
      title: "Apex Dynamics Expansion",
      scenarioText: "Apex Dynamics Limited is an unlisted public company planning to expand its board from 12 to 16 directors.",
    },
    options: [
      { letter: "A", text: "15 directors." },
      { letter: "B", text: "20 directors." },
    ],
    correctAnswer: "A",
  });
  assert(validCs.isValid === true, "Valid CASE_STUDY question passes validation");

  // Batch Validation with Malformed Root
  const malformedBatch = validateImportBatch({ invalidKey: "foo" });
  assert(malformedBatch.isValid === false, "Missing questions array in batch fails");

  // =========================================================================
  // 2. DUPLICATE DETECTION TESTS
  // =========================================================================
  console.log("\n[2/7] Testing Duplicate Detection Engine...");

  const textA = "Which account is debited upon settlement of trade payables?";
  const textB = "Which account is debited upon settlement of trade payables ?";
  const textC = "Under the Companies Act, what is the quorum required for a public meeting?";

  assert(normalizeQuestionText(textA) === normalizeQuestionText(textB), "Punctuation/whitespace normalization produces identical string");
  assert(computeTokenSimilarity(textA, textB) === 1.0, "Identical normalized strings have 1.0 similarity");
  assert(computeTokenSimilarity(textA, textC) < 0.3, "Distinct questions have low similarity (< 0.3)");

  const mockCandidate = {
    questionId: "mock-q-1",
    versionId: "mock-v-1",
    questionText: textA,
    normalizedText: normalizeQuestionText(textA),
    difficulty: "EASY",
    questionType: "MCQ",
  };

  const exactDupResult = checkQuestionDuplicate(
    { questionText: textB, options: [], correctAnswer: "A" },
    [mockCandidate]
  );
  assert(exactDupResult.status === "EXACT_DUPLICATE", "Exact normalized duplicate flagged as EXACT_DUPLICATE (100%)");

  // =========================================================================
  // 3. CURRICULUM MAPPING RESOLVER TESTS
  // =========================================================================
  console.log("\n[3/7] Testing Curriculum Mapping Resolver...");

  const mockCtx: VersionCurriculumContext = {
    academicLevel: { id: "lvl-1", code: "INTERMEDIATE", name: "CA Intermediate" },
    curriculumVersion: { id: "ver-1", name: "Syllabus 2026-2027", isActive: true },
    subjects: [{ id: "sub-1", code: "PAPER_1", name: "Advanced Accounting" }],
    nodes: [
      { id: "node-1", code: "INT_P1_CH1_T1", name: "Process of AS Formulation", type: "TOPIC", subjectId: "sub-1", parentId: null },
    ],
    codeToNode: new Map([
      ["INT_P1_CH1_T1", { id: "node-1", code: "INT_P1_CH1_T1", name: "Process of AS Formulation", type: "TOPIC", subjectId: "sub-1", parentId: null }],
    ]),
    idToNode: new Map([
      ["node-1", { id: "node-1", code: "INT_P1_CH1_T1", name: "Process of AS Formulation", type: "TOPIC", subjectId: "sub-1", parentId: null }],
    ]),
    subjectCodeToSubject: new Map([
      ["PAPER_1", { id: "sub-1", code: "PAPER_1", name: "Advanced Accounting" }],
    ]),
    nameToNodes: new Map([
      ["process of as formulation", [{ id: "node-1", code: "INT_P1_CH1_T1", name: "Process of AS Formulation", type: "TOPIC", subjectId: "sub-1", parentId: null }]],
    ]),
  };

  const mapCanonical = resolveQuestionCurriculum(
    { questionText: "Test Question", curriculumNodeCode: "INT_P1_CH1_T1", options: [], correctAnswer: "A" },
    mockCtx
  );
  assert(mapCanonical.status === "MATCHED_CANONICAL", "Canonical node code matches MATCHED_CANONICAL");
  assert(mapCanonical.curriculumNodeId === "node-1", "Resolves correct node UUID");

  const mapUnmapped = resolveQuestionCurriculum(
    { questionText: "Test Question", options: [], correctAnswer: "A" },
    mockCtx
  );
  assert(mapUnmapped.status === "UNMAPPED", "Unknown hints resolve to UNMAPPED");

  // =========================================================================
  // 4. DATABASE INTEGRATION, LIFECYCLE & STATE MACHINE TESTS
  // =========================================================================
  console.log("\n[4/7] Testing Staging Lifecycle & State Machine Guards...");

  const [intermediateLevel] = await db
    .select()
    .from(academicLevels)
    .where(eq(academicLevels.code, "INTERMEDIATE"))
    .limit(1);

  const [activeVer] = await db
    .select()
    .from(curriculumVersions)
    .where(eq(curriculumVersions.isActive, true))
    .limit(1);

  if (intermediateLevel && activeVer) {
    const fixturePath = path.join(__dirname, "../fixtures/sample_import_batch.json");
    const rawFixtureJson = fs.readFileSync(fixturePath, "utf-8");
    const runId = Math.random().toString(36).substring(2, 9);

    const parsedFixture = JSON.parse(rawFixtureJson);
    parsedFixture.questions = parsedFixture.questions.map(
      (q: { questionText: string; [key: string]: unknown }, idx: number) => ({
        ...q,
        questionText: `Test-Run-${runId}-Item-${idx + 1}: ${q.questionText}`,
      })
    );
    const uniqueFixtureJson = JSON.stringify(parsedFixture);

    // 1. Create Import Batch
    const batchResult = await createImportBatch({
      rawJsonString: uniqueFixtureJson,
      academicLevelId: intermediateLevel.id,
      curriculumVersionId: activeVer.id,
      adminEmail: "admin@caprep.pro",
    });

    assert(batchResult.totalQuestions === 4, "Import batch created with 4 questions");
    assert(batchResult.validCount === 4, "All 4 questions in fixture are structurally valid");

    // 2. Fetch Staged Questions for Batch
    const stagedBatch = await db
      .select()
      .from(importBatches)
      .where(eq(importBatches.id, batchResult.batchId));
    assert(stagedBatch.length === 1, "Batch header saved in database");

    const questionsInBatch = await getBatchQuestionsList({ batchId: batchResult.batchId });
    assert(questionsInBatch.length === 4, "4 staging questions loaded from database");

    const q1 = questionsInBatch[0];
    const q2 = questionsInBatch[1];
    const q3 = questionsInBatch[2];
    const q4 = questionsInBatch[3]; // Unmapped question in fixture

    // State Machine Guard: Attempting to approve UNMAPPED question #4 must throw
    let unmappedThrew = false;
    try {
      await approveImportedQuestion(q4.id, "admin@caprep.pro");
    } catch (e: unknown) {
      unmappedThrew = true;
      assert((e as Error).message.includes("unmapped"), "Cannot approve an unmapped question");
    }
    assert(unmappedThrew, "State machine strictly blocks approving UNMAPPED questions");

    // 3. Approve Question #1
    const approveRes = await approveImportedQuestion(q1.id, "admin@caprep.pro");
    assert(approveRes.success === true, "Question #1 approved successfully");

    // State Machine Guard: Idempotent re-approval
    const reApproveRes = await approveImportedQuestion(q1.id, "admin@caprep.pro");
    assert(reApproveRes.alreadyApproved === true, "Re-approving an approved question is idempotent");

    // 4. Reject Question #2 with reason
    const rejectRes = await rejectImportedQuestion(
      q2.id,
      "DUPLICATE",
      "Identical to existing revision notes",
      "admin@caprep.pro"
    );
    assert(rejectRes.success === true, "Question #2 rejected with reason DUPLICATE");

    // 5. Edit Question #3
    const editRes = await editImportedQuestion(
      q3.id,
      {
        questionText: `Test-Run-${runId}-Item-3: Updated Case Question Text for Section 149(1) Directors Limit?`,
        difficulty: "HARD",
        questionType: "CASE_STUDY",
        options: [
          { letter: "A", text: "15 directors." },
          { letter: "B", text: "20 directors." },
        ],
        correctAnswer: "A",
        explanation: "Updated explanation text.",
        curriculumNodeId: q1.curriculumNodeId || undefined,
      },
      "admin@caprep.pro"
    );
    assert(editRes.success === true, "Question #3 edited successfully");

    // Approve Question #3 after edit
    await approveImportedQuestion(q3.id, "admin@caprep.pro");

    // =========================================================================
    // 5. OPTIMISTIC CONCURRENCY TESTS
    // =========================================================================
    console.log("\n[5/7] Testing Optimistic Concurrency Control...");

    const [freshQ3] = await db
      .select()
      .from(importedQuestions)
      .where(eq(importedQuestions.id, q3.id));

    // Stale timestamp (1 hour ago)
    const staleTimestamp = new Date(Date.now() - 3600000);
    let staleThrew = false;
    try {
      await editImportedQuestion(
        q3.id,
        {
          questionText: "Conflicting edit from second admin?",
          difficulty: "EASY",
          questionType: "MCQ",
          options: [{ letter: "A", text: "Opt" }, { letter: "B", text: "Opt 2" }],
          correctAnswer: "A",
        },
        "admin2@caprep.pro",
        staleTimestamp
      );
    } catch (e: unknown) {
      staleThrew = true;
      assert((e as Error).message.includes("modified by another administrator"), "Stale mutation rejected with concurrency error");
    }
    assert(staleThrew, "Optimistic concurrency blocks stale concurrent edits");

    // Matching timestamp succeeds
    const concurrentApprove = await approveImportedQuestion(
      q3.id,
      "admin@caprep.pro",
      freshQ3.updatedAt
    );
    assert(concurrentApprove.success === true, "Mutation with matching updatedAt succeeds");

    // =========================================================================
    // 6. PUBLICATION, IDEMPOTENCY & AUDIT LEDGER TESTS
    // =========================================================================
    console.log("\n[6/7] Testing Publication, Idempotency & Audit Trails...");

    // 1. Publish Approved Questions
    const publishRes = await publishApprovedQuestions(batchResult.batchId, "admin@caprep.pro");
    assert(publishRes.publishedCount === 2, "2 approved questions published to live Question Bank");

    // 2. Publication Idempotency Test: Calling publish again on the same batch must NOT duplicate questions
    const rePublishRes = await publishApprovedQuestions(batchResult.batchId, "admin@caprep.pro");
    assert(rePublishRes.publishedCount === 0, "Re-publishing same batch creates 0 duplicate live questions");

    // 3. State Machine Guard: Cannot edit or reject an already published question
    let publishedEditThrew = false;
    try {
      await editImportedQuestion(
        q1.id,
        {
          questionText: "Attempting to edit published question?",
          difficulty: "EASY",
          questionType: "MCQ",
          options: [{ letter: "A", text: "Opt" }, { letter: "B", text: "Opt 2" }],
          correctAnswer: "A",
        },
        "admin@caprep.pro"
      );
    } catch (e: unknown) {
      publishedEditThrew = true;
      assert((e as Error).message.includes("already been published"), "Editing published question blocked");
    }
    assert(publishedEditThrew, "Published questions are immutable in staging");

    // 4. Audit Log Integrity
    const auditLogs = await db
      .select()
      .from(importAuditEvents)
      .where(eq(importAuditEvents.batchId, batchResult.batchId));
    
    assert(auditLogs.length >= 4, "Audit events recorded for batch creation, approval, rejection, edit, and publish");
    assert(auditLogs.some((a) => a.action === "BATCH_PUBLISHED"), "BATCH_PUBLISHED audit event recorded");
    assert(auditLogs.some((a) => a.action === "QUESTION_APPROVED"), "QUESTION_APPROVED audit event recorded");
    assert(auditLogs.some((a) => a.action === "QUESTION_REJECTED"), "QUESTION_REJECTED audit event recorded");

    // =========================================================================
    // 7. INTERIM DUPLICATE COLLISION TEST AT PUBLICATION TIME
    // =========================================================================
    console.log("\n[7/7] Testing Interim Duplicate Collision at Publication Time...");

    // Create a 2nd batch containing a question identical to the just-published Q1
    const duplicateCollisionPayload = JSON.stringify({
      batchName: "Interim Duplicate Test Batch",
      questions: [
        {
          questionText: `Test-Run-${runId}-Item-1: ${parsedFixture.questions[0].questionText.replace(`Test-Run-${runId}-Item-1: `, "")}`,
          curriculumNodeCode: "INT_P1_CH1_T1",
          options: [
            { letter: "A", text: "Option A" },
            { letter: "B", text: "Option B" },
          ],
          correctAnswer: "A",
        },
      ],
    });

    const dupBatchResult = await createImportBatch({
      rawJsonString: duplicateCollisionPayload,
      academicLevelId: intermediateLevel.id,
      curriculumVersionId: activeVer.id,
      adminEmail: "admin@caprep.pro",
    });

    const [dupQuestion] = await getBatchQuestionsList({ batchId: dupBatchResult.batchId });
    // Manually force status to APPROVED to test publication collision gate
    await db
      .update(importedQuestions)
      .set({ status: "APPROVED" })
      .where(eq(importedQuestions.id, dupQuestion.id));

    let publishCollisionThrew = false;
    try {
      await publishApprovedQuestions(dupBatchResult.batchId, "admin@caprep.pro");
    } catch (e: unknown) {
      publishCollisionThrew = true;
      assert((e as Error).message.includes("collides with a live question version"), "Publication blocks interim live duplicate collision");
    }
    assert(publishCollisionThrew, "Pre-publication duplicate gate protected live Question Bank");

    // Verify the collided question was reverted to PENDING_REVIEW
    const [revertedQ] = await db
      .select()
      .from(importedQuestions)
      .where(eq(importedQuestions.id, dupQuestion.id));
    assert(revertedQ.status === "PENDING_REVIEW", "Collided question automatically reverted to PENDING_REVIEW");
    assert(revertedQ.duplicateStatus === "EXACT_DUPLICATE", "Collided question tagged with EXACT_DUPLICATE status");
  } else {
    console.log("  ⚠️ Database seed levels not found, skipped live DB lifecycle test.");
  }

  console.log("\n==================================================");
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test runner error:", err);
  process.exit(1);
});
