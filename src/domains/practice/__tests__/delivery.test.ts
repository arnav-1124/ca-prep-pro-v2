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
  studentProfiles,
  practiceSessions,
  practiceSessionQuestions,
  practiceAttempts,
} from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import {
  createPracticeSession,
  getNextPracticeQuestion,
  getCurrentPracticeQuestion,
  abandonPracticeSession,
} from "../services/session";
import {
  selectNextEligibleQuestion,
  countEligibleQuestions,
} from "../services/selector";
import { deleteAdminQuestion } from "@/domains/questions/management/services";

async function runStep22DeliveryTests() {
  console.log("==================================================");
  console.log("RUNNING STEP 22 STUDENT PRACTICE DELIVERY TEST SUITE");
  console.log("==================================================");

  const nonce = Date.now();

  // 1. Fetch Existing Curriculum Context
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

  const [activeNode] = await db
    .select()
    .from(curriculumNodes)
    .where(
      and(
        eq(curriculumNodes.curriculumVersionId, activeVersion.id),
        eq(curriculumNodes.isActive, true)
      )
    )
    .limit(1);

  assert(activeNode, "Active curriculum node must exist");

  const [subject] = await db
    .select()
    .from(subjects)
    .where(eq(subjects.id, activeNode.subjectId))
    .limit(1);

  assert(subject, "Subject must exist");

  console.log(`Context: Level=${level.code}, Subject=${subject.name}, Node=${activeNode.name}\n`);

  // Track created entities for cleanup
  const createdProfileIds: string[] = [];
  const createdQuestionIds: string[] = [];
  const createdNodeIds: string[] = [];

  try {
    // 2. Create Test Student Profiles
    const [studentA] = await db
      .insert(studentProfiles)
      .values({
        clerkUserId: `test_user_a_${nonce}`,
        email: `student_a_${nonce}@test.com`,
        plan: "FREE",
      })
      .returning();
    createdProfileIds.push(studentA.id);

    const [studentB] = await db
      .insert(studentProfiles)
      .values({
        clerkUserId: `test_user_b_${nonce}`,
        email: `student_b_${nonce}@test.com`,
        plan: "FREE",
      })
      .returning();
    createdProfileIds.push(studentB.id);

    // 3. Create Isolated Active and Inactive Test Nodes
    const [testActiveNode] = await db
      .insert(curriculumNodes)
      .values({
        curriculumVersionId: activeVersion.id,
        subjectId: subject.id,
        type: "CHAPTER",
        name: `Active Test Chapter [${nonce}]`,
        code: `TEST_ACTIVE_${nonce}`,
        sortOrder: 998,
        isActive: true,
      })
      .returning();
    createdNodeIds.push(testActiveNode.id);

    const [inactiveNode] = await db
      .insert(curriculumNodes)
      .values({
        curriculumVersionId: activeVersion.id,
        subjectId: subject.id,
        type: "CHAPTER",
        name: `Inactive Test Chapter [${nonce}]`,
        code: `TEST_INACTIVE_${nonce}`,
        sortOrder: 999,
        isActive: false, // Inactive!
      })
      .returning();
    createdNodeIds.push(inactiveNode.id);

    // 4. Create Controlled Test Questions:
    // Q1: Standard active question in active node
    const [q1] = await db
      .insert(questions)
      .values({
        academicLevelId: level.id,
        subjectId: subject.id,
        curriculumNodeId: testActiveNode.id,
        difficulty: "EASY",
        questionType: "MCQ",
      })
      .returning();
    createdQuestionIds.push(q1.id);

    const [q1v1] = await db
      .insert(questionVersions)
      .values({
        questionId: q1.id,
        versionNumber: 1,
        questionText: `Eligible Practice Question 1 for Step 22 [${nonce}]`,
        correctAnswer: "A",
        explanation: "Secret answer explanation for Q1 that must never leak.",
        isActive: true,
      })
      .returning();

    await db.insert(questionOptions).values([
      { questionVersionId: q1v1.id, optionLetter: "A", optionText: "First correct option" },
      { questionVersionId: q1v1.id, optionLetter: "B", optionText: "Second option" },
      { questionVersionId: q1v1.id, optionLetter: "C", optionText: "Third option" },
      { questionVersionId: q1v1.id, optionLetter: "D", optionText: "Fourth option" },
    ]);

    // Q2: Multi-versioned question (v1 superseded, v2 active)
    const [q2] = await db
      .insert(questions)
      .values({
        academicLevelId: level.id,
        subjectId: subject.id,
        curriculumNodeId: testActiveNode.id,
        difficulty: "MEDIUM",
        questionType: "MCQ",
      })
      .returning();
    createdQuestionIds.push(q2.id);

    await db.insert(questionVersions).values({
      questionId: q2.id,
      versionNumber: 1,
      questionText: `Superseded v1 Text [${nonce}]`,
      correctAnswer: "B",
      explanation: "Old law explanation",
      isActive: false, // Inactive/superseded
    });

    const [q2v2] = await db
      .insert(questionVersions)
      .values({
        questionId: q2.id,
        versionNumber: 2,
        questionText: `Active v2 Text for Question 2 [${nonce}]`,
        correctAnswer: "C",
        explanation: "New amended law explanation",
        isActive: true, // Active version!
      })
      .returning();

    await db.insert(questionOptions).values([
      { questionVersionId: q2v2.id, optionLetter: "A", optionText: "Option A for v2" },
      { questionVersionId: q2v2.id, optionLetter: "B", optionText: "Option B for v2" },
      { questionVersionId: q2v2.id, optionLetter: "C", optionText: "Option C for v2" },
      { questionVersionId: q2v2.id, optionLetter: "D", optionText: "Option D for v2" },
    ]);

    // Q3: Retired question (isActive = false)
    const [q3] = await db
      .insert(questions)
      .values({
        academicLevelId: level.id,
        subjectId: subject.id,
        curriculumNodeId: testActiveNode.id,
        difficulty: "HARD",
        questionType: "MCQ",
      })
      .returning();
    createdQuestionIds.push(q3.id);

    const [q3v1] = await db
      .insert(questionVersions)
      .values({
        questionId: q3.id,
        versionNumber: 1,
        questionText: `Retired Question [${nonce}]`,
        correctAnswer: "D",
        explanation: "Retired question explanation",
        isActive: false, // Retired!
      })
      .returning();

    await db.insert(questionOptions).values([
      { questionVersionId: q3v1.id, optionLetter: "A", optionText: "Retired option" },
      { questionVersionId: q3v1.id, optionLetter: "B", optionText: "Retired option" },
    ]);

    // Q4: Question mapped to inactive node
    const [q4] = await db
      .insert(questions)
      .values({
        academicLevelId: level.id,
        subjectId: subject.id,
        curriculumNodeId: inactiveNode.id, // Inactive node!
        difficulty: "EASY",
        questionType: "MCQ",
      })
      .returning();
    createdQuestionIds.push(q4.id);

    const [q4v1] = await db
      .insert(questionVersions)
      .values({
        questionId: q4.id,
        versionNumber: 1,
        questionText: `Inactive Node Question [${nonce}]`,
        correctAnswer: "A",
        explanation: "Inactive node question",
        isActive: true,
      })
      .returning();

    await db.insert(questionOptions).values([
      { questionVersionId: q4v1.id, optionLetter: "A", optionText: "Opt A" },
      { questionVersionId: q4v1.id, optionLetter: "B", optionText: "Opt B" },
    ]);

    // ==================================================
    // [1/7] Authentication & Ownership Controls
    // ==================================================
    console.log("[1/7] Testing Authentication & Ownership Controls...");

    const { sessionId, firstQuestion } = await createPracticeSession(studentA.id, {
      academicLevelId: level.id,
      subjectId: subject.id,
      curriculumNodeId: testActiveNode.id,
      practiceMode: "QUESTION",
      difficulty: "ANY",
      questionType: "MCQ",
      requestedQuestionCount: 2,
    });

    assert(sessionId, "Session must be created successfully");
    assert.strictEqual(firstQuestion.sequenceNumber, 1, "First question must be delivered at sequence 1");

    // Student B attempts to query Student A's session -> must be rejected
    await assert.rejects(
      async () => {
        await getCurrentPracticeQuestion(studentB.id, sessionId);
      },
      /unauthorized/i,
      "Student B must not be able to read Student A's session"
    );

    // Student B attempts to advance Student A's session -> must be rejected
    await assert.rejects(
      async () => {
        await getNextPracticeQuestion(studentB.id, sessionId);
      },
      /unauthorized/i,
      "Student B must not be able to advance Student A's session"
    );

    // Student B attempts to abandon Student A's session -> must be rejected
    await assert.rejects(
      async () => {
        await abandonPracticeSession(studentB.id, sessionId);
      },
      /unauthorized/i,
      "Student B must not be able to abandon Student A's session"
    );

    console.log("  ✓ PASS: Student ownership strictly enforced against cross-user access\n");

    // ==================================================
    // [2/7] Curriculum Eligibility & Guardrails
    // ==================================================
    console.log("[2/7] Testing Curriculum Eligibility & Inactive Node Rejection...");

    // Inactive node must be rejected at session creation
    await assert.rejects(
      async () => {
        await createPracticeSession(studentA.id, {
          academicLevelId: level.id,
          subjectId: subject.id,
          curriculumNodeId: inactiveNode.id,
          practiceMode: "QUESTION",
          difficulty: "ANY",
          questionType: "MCQ",
          requestedQuestionCount: 5,
        });
      },
      /inactive or not part of the active curriculum/i,
      "Inactive curriculum node must be rejected"
    );

    // Nonexistent academic level must be rejected
    await assert.rejects(
      async () => {
        await createPracticeSession(studentA.id, {
          academicLevelId: "00000000-0000-0000-0000-000000000000",
          subjectId: subject.id,
          practiceMode: "QUESTION",
          difficulty: "ANY",
          questionType: "MCQ",
          requestedQuestionCount: 5,
        });
      },
      /no active curriculum scheme found/i,
      "Nonexistent academic level must be rejected"
    );

    console.log("  ✓ PASS: Inactive curriculum nodes and invalid contexts rejected\n");

    // ==================================================
    // [3/7] Question Lifecycle & Version Eligibility
    // ==================================================
    console.log("[3/7] Testing Question Lifecycle & Version Eligibility...");

    // Fetch questions eligible under testActiveNode
    const eligibleCount = await countEligibleQuestions({
      academicLevelId: level.id,
      curriculumVersionId: activeVersion.id,
      subjectId: subject.id,
      curriculumNodeId: testActiveNode.id,
      practiceMode: "QUESTION",
    });

    assert.strictEqual(eligibleCount, 2, "Eligible count in testActiveNode must be exactly 2 (q1 and q2)");

    // Q3 is retired -> must never be selected
    const candRetired = await selectNextEligibleQuestion("00000000-0000-0000-0000-000000000000", 12345, {
      academicLevelId: level.id,
      curriculumVersionId: activeVersion.id,
      subjectId: subject.id,
      curriculumNodeId: testActiveNode.id,
      difficulty: "HARD", // Q3 was HARD
    });

    assert.strictEqual(candRetired, null, "Retired question Q3 must yield null candidate");

    // Q4 is under inactive node -> must never be counted or selected
    const inactiveNodeCount = await countEligibleQuestions({
      academicLevelId: level.id,
      curriculumVersionId: activeVersion.id,
      subjectId: subject.id,
      curriculumNodeId: inactiveNode.id,
    });
    assert.strictEqual(inactiveNodeCount, 0, "Inactive node must yield 0 eligible questions");

    console.log("  ✓ PASS: Retired questions and inactive node questions strictly excluded\n");

    // ==================================================
    // [4/7] Multi-Version Snapshot & Version Selection
    // ==================================================
    console.log("[4/7] Testing Multi-Version Selection (Latest Active Version)...");

    const candQ2 = await selectNextEligibleQuestion("00000000-0000-0000-0000-000000000000", 12345, {
      academicLevelId: level.id,
      curriculumVersionId: activeVersion.id,
      subjectId: subject.id,
      curriculumNodeId: testActiveNode.id,
      difficulty: "MEDIUM", // Q2 is MEDIUM
    });

    assert(candQ2, "Question Q2 candidate must be selected");
    assert.strictEqual(candQ2.questionId, q2.id, "Candidate must be Q2");
    assert.strictEqual(candQ2.questionVersionId, q2v2.id, "Must select active version v2");
    assert.strictEqual(candQ2.versionNumber, 2, "Must select versionNumber 2");
    assert(candQ2.questionText.includes("Active v2 Text"), "Must deliver active v2 question text");

    console.log("  ✓ PASS: Latest active version snapshot selected; superseded v1 excluded\n");

    // ==================================================
    // [5/7] Deterministic Selection & Duplicate Prevention
    // ==================================================
    console.log("[5/7] Testing Deterministic Selection & Duplicate Prevention...");

    const fixedSeed = 998877;
    const dummySessionId = "00000000-0000-0000-0000-000000000001";

    const run1 = await selectNextEligibleQuestion(dummySessionId, fixedSeed, {
      academicLevelId: level.id,
      curriculumVersionId: activeVersion.id,
      subjectId: subject.id,
      curriculumNodeId: testActiveNode.id,
    });

    const run2 = await selectNextEligibleQuestion(dummySessionId, fixedSeed, {
      academicLevelId: level.id,
      curriculumVersionId: activeVersion.id,
      subjectId: subject.id,
      curriculumNodeId: testActiveNode.id,
    });

    assert(run1 && run2, "Both runs must return a question");
    assert.strictEqual(run1.questionId, run2.questionId, "Same seed must deterministically produce same first question");

    console.log("  ✓ PASS: Deterministic selection reproducible across evaluations\n");

    // ==================================================
    // [6/7] Security & DTO Sanitization (Zero Answer Leakage)
    // ==================================================
    console.log("[6/7] Testing Security & Delivery DTO Sanitization...");

    const currentDtoResult = await getCurrentPracticeQuestion(studentA.id, sessionId);
    assert(currentDtoResult.question, "Current question must exist in active session");

    const deliveredDto = currentDtoResult.question;
    const rawDelivered = deliveredDto as unknown as Record<string, unknown>;

    // Verify critical fields are NEVER present in DTO
    assert.strictEqual(rawDelivered.correctAnswer, undefined, "correctAnswer must NOT be exposed in DTO");
    assert.strictEqual(rawDelivered.explanation, undefined, "explanation must NOT be exposed in DTO");
    assert.strictEqual(rawDelivered.aiMetadata, undefined, "aiMetadata must NOT be exposed in DTO");
    assert.strictEqual(rawDelivered.duplicateSimilarityScore, undefined, "internal scores must NOT be exposed in DTO");
    assert.strictEqual(rawDelivered.reviewedBy, undefined, "admin review metadata must NOT be exposed in DTO");

    // Verify option sanitization
    assert(deliveredDto.options.length >= 2, "Options must be delivered");
    for (const opt of deliveredDto.options) {
      const rawOpt = opt as unknown as Record<string, unknown>;
      assert.strictEqual(rawOpt.isCorrect, undefined, "Option must not expose isCorrect flag");
      assert(opt.optionLetter, "Option must have letter");
      assert(opt.optionText, "Option must have text");
    }

    console.log("  ✓ PASS: Zero answer or admin metadata leakage in Student Practice DTO\n");

    // ==================================================
    // [7/7] Progression, Session Limit & Historical Immutability
    // ==================================================
    console.log("[7/7] Testing Progression, Session Limit & Historical Immutability...");

    // Deliver question 2 in session (requested count = 2)
    const nextResult = await getNextPracticeQuestion(studentA.id, sessionId);
    assert.strictEqual(nextResult.isCompleted, false, "Question 2 should be delivered");
    assert(nextResult.question, "Delivered question 2 must exist");
    assert.strictEqual(nextResult.deliveredCount, 2, "Delivered count must be 2");

    // Next call should detect requested limit reached and mark session COMPLETED
    const limitResult = await getNextPracticeQuestion(studentA.id, sessionId);
    assert.strictEqual(limitResult.isCompleted, true, "Session must complete upon reaching limit");
    assert.strictEqual(limitResult.question, null, "No further question returned when completed");

    // Verify session status in DB is COMPLETED
    const [dbSession] = await db
      .select()
      .from(practiceSessions)
      .where(eq(practiceSessions.id, sessionId))
      .limit(1);

    assert.strictEqual(dbSession.status, "COMPLETED", "Session status must be COMPLETED in database");
    assert(dbSession.completedAt, "completedAt timestamp must be recorded");

    // Verify duplicate delivery constraint: attempt to insert duplicate question in practiceSessionQuestions
    const deliveredRecords = await db
      .select()
      .from(practiceSessionQuestions)
      .where(eq(practiceSessionQuestions.practiceSessionId, sessionId));

    assert.strictEqual(deliveredRecords.length, 2, "Exactly 2 questions delivered");
    const firstDelivered = deliveredRecords[0];

    await assert.rejects(
      async () => {
        await db.insert(practiceSessionQuestions).values({
          practiceSessionId: sessionId,
          questionId: firstDelivered.questionId, // Duplicate question!
          questionVersionId: firstDelivered.questionVersionId,
          sequenceNumber: 99,
        });
      },
      (err: unknown) => {
        const e = err as { message?: string; cause?: { message?: string } };
        const fullErr = `${e?.message || ""} ${e?.cause?.message || ""}`.toLowerCase();
        return fullErr.includes("unique") || fullErr.includes("duplicate");
      },
      "Database constraint must block duplicate question delivery within session"
    );

    // Verify Historical Immutability:
    // Attempting to hard delete a question with delivery records must be BLOCKED
    await assert.rejects(
      async () => {
        await deleteAdminQuestion({ questionId: firstDelivered.questionId, adminEmail: "admin@test.com" });
      },
      /session delivery records/i,
      "Admin hard delete must be blocked by system guardrail when delivery records exist"
    );

    console.log("  ✓ PASS: Progression limits enforced, duplicates blocked, historical records protected\n");

    console.log("==================================================");
    console.log("ALL STEP 22 PRACTICE DELIVERY TESTS PASSED (7/7)");
    console.log("==================================================");
  } finally {
    // Cleanup created test records
    console.log("Cleaning up test artifacts...");
    for (const pid of createdProfileIds) {
      // Sessions cascade delete session questions
      await db.delete(practiceSessions).where(eq(practiceSessions.studentProfileId, pid));
      await db.delete(studentProfiles).where(eq(studentProfiles.id, pid));
    }

    if (createdQuestionIds.length > 0) {
      const versions = await db
        .select({ id: questionVersions.id })
        .from(questionVersions)
        .where(inArray(questionVersions.questionId, createdQuestionIds));
      const vIds = versions.map((v) => v.id);
      if (vIds.length > 0) {
        await db.delete(questionOptions).where(inArray(questionOptions.questionVersionId, vIds));
        await db.delete(practiceSessionQuestions).where(inArray(practiceSessionQuestions.questionVersionId, vIds));
        await db.delete(practiceAttempts).where(inArray(practiceAttempts.questionVersionId, vIds));
        await db.delete(questionVersions).where(inArray(questionVersions.id, vIds));
      }
      await db.delete(questions).where(inArray(questions.id, createdQuestionIds));
    }

    if (createdNodeIds.length > 0) {
      await db.delete(curriculumNodes).where(inArray(curriculumNodes.id, createdNodeIds));
    }
    console.log("✓ Cleanup completed cleanly.");
  }
}

runStep22DeliveryTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test execution failed:", err);
    process.exit(1);
  });
