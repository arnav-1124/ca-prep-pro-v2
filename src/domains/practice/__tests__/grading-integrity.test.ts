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
} from "../services/session";
import {
  submitPracticeAnswer,
} from "../services/attempts";
import {
  getPracticeSessionSummary,
} from "../services/summary";
import { gradeAnswer } from "../services/grading";

async function runGradingIntegrityTests() {
  console.log("==================================================");
  console.log("RUNNING STEP 23 ANSWER SUBMISSION & GRADING INTEGRITY TEST SUITE");
  console.log("==================================================");

  const nonce = Date.now();

  // 1. Fetch Existing Academic Context
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

  // Tracking for cleanup
  const createdProfileIds: string[] = [];
  const createdQuestionIds: string[] = [];
  const createdNodeIds: string[] = [];

  try {
    // 2. Create Test Student Profiles
    const [studentA] = await db
      .insert(studentProfiles)
      .values({
        clerkUserId: `test_grader_a_${nonce}`,
        email: `grader_a_${nonce}@test.com`,
        plan: "FREE",
      })
      .returning();
    createdProfileIds.push(studentA.id);

    const [studentB] = await db
      .insert(studentProfiles)
      .values({
        clerkUserId: `test_grader_b_${nonce}`,
        email: `grader_b_${nonce}@test.com`,
        plan: "FREE",
      })
      .returning();
    createdProfileIds.push(studentB.id);

    // 3. Create Isolated Test Curriculum Node
    const [testNode] = await db
      .insert(curriculumNodes)
      .values({
        curriculumVersionId: activeVersion.id,
        subjectId: subject.id,
        type: "CHAPTER",
        name: `Grading Test Chapter [${nonce}]`,
        code: `GRADING_TEST_${nonce}`,
        sortOrder: 999,
        isActive: true,
      })
      .returning();
    createdNodeIds.push(testNode.id);

    console.log(`Context: Level=${level.code}, Subject=${subject.name}, IsolatedNode=${testNode.name}\n`);

    // 4. Create Controlled Test Questions inside Isolated Node:
    // Question 1: Answer B
    const [q1] = await db
      .insert(questions)
      .values({
        academicLevelId: level.id,
        subjectId: subject.id,
        curriculumNodeId: testNode.id,
        difficulty: "MEDIUM",
        questionType: "MCQ",
      })
      .returning();
    createdQuestionIds.push(q1.id);

    const [v1_1] = await db
      .insert(questionVersions)
      .values({
        questionId: q1.id,
        versionNumber: 1,
        questionText: `What is the standard cost formula? (Test ${nonce})`,
        correctAnswer: "B",
        explanation: "Standard Cost = Standard Quantity * Standard Price according to ICAI module.",
        isActive: true,
      })
      .returning();

    await db.insert(questionOptions).values([
      { questionVersionId: v1_1.id, optionLetter: "A", optionText: "Actual Q * Actual P" },
      { questionVersionId: v1_1.id, optionLetter: "B", optionText: "Standard Q * Standard P" },
      { questionVersionId: v1_1.id, optionLetter: "C", optionText: "Standard Q * Actual P" },
      { questionVersionId: v1_1.id, optionLetter: "D", optionText: "Actual Q * Standard P" },
    ]);

    // Question 2: Answer C
    const [q2] = await db
      .insert(questions)
      .values({
        academicLevelId: level.id,
        subjectId: subject.id,
        curriculumNodeId: testNode.id,
        difficulty: "HARD",
        questionType: "MCQ",
      })
      .returning();
    createdQuestionIds.push(q2.id);

    const [v2_1] = await db
      .insert(questionVersions)
      .values({
        questionId: q2.id,
        versionNumber: 1,
        questionText: `Which method evaluates joint products at split-off? (Test ${nonce})`,
        correctAnswer: "C",
        explanation: "NRV at split-off is standard ICAI treatment for joint products.",
        isActive: true,
      })
      .returning();

    await db.insert(questionOptions).values([
      { questionVersionId: v2_1.id, optionLetter: "A", optionText: "Physical units only" },
      { questionVersionId: v2_1.id, optionLetter: "B", optionText: "Sales value at split-off" },
      { questionVersionId: v2_1.id, optionLetter: "C", optionText: "Net realizable value at split-off" },
      { questionVersionId: v2_1.id, optionLetter: "D", optionText: "Constant gross margin" },
    ]);

    // ----------------------------------------------------
    // TEST 1: Pure Deterministic Domain Grading Engine
    // ----------------------------------------------------
    console.log("[1/8] Testing Pure Deterministic Grading Engine...");

    const gradeCorrect = gradeAnswer({
      questionVersion: { id: v1_1.id, correctAnswer: "B", explanation: v1_1.explanation },
      selectedAnswer: "B",
      validOptions: ["A", "B", "C", "D"],
    });
    assert.strictEqual(gradeCorrect.isCorrect, true, "Option B must be graded as correct");
    assert.strictEqual(gradeCorrect.marksAwarded, 1, "Correct answer must award 1 mark");
    assert.strictEqual(gradeCorrect.correctAnswer, "B");
    assert.strictEqual(gradeCorrect.explanation, v1_1.explanation);

    const gradeIncorrect = gradeAnswer({
      questionVersion: { id: v1_1.id, correctAnswer: "B", explanation: v1_1.explanation },
      selectedAnswer: "A",
      validOptions: ["A", "B", "C", "D"],
    });
    assert.strictEqual(gradeIncorrect.isCorrect, false, "Option A must be graded as incorrect");
    assert.strictEqual(gradeIncorrect.marksAwarded, 0, "Incorrect answer must award 0 marks");

    // Case-insensitivity check ('b' vs 'B')
    const gradeCaseInsensitive = gradeAnswer({
      questionVersion: { id: v1_1.id, correctAnswer: "B", explanation: v1_1.explanation },
      selectedAnswer: "b",
      validOptions: ["A", "B", "C", "D"],
    });
    assert.strictEqual(gradeCaseInsensitive.isCorrect, true, "Grading must be case-insensitive");

    // Invalid option rejection check
    assert.throws(
      () => {
        gradeAnswer({
          questionVersion: { id: v1_1.id, correctAnswer: "B" },
          selectedAnswer: "Z",
          validOptions: ["A", "B", "C", "D"],
        });
      },
      /Invalid option selection/i,
      "Invalid option letter outside valid options must be rejected"
    );

    console.log("  ✓ PASS: Deterministic grading engine evaluates correctness, marks, and option bounds cleanly\n");

    // ----------------------------------------------------
    // TEST 2: Session Setup & Zero-Answer Delivery DTO Verification
    // ----------------------------------------------------
    console.log("[2/8] Testing Session Delivery & Answer Key Protection...");

    const sessionInit = await createPracticeSession(studentA.id, {
      academicLevelId: level.id,
      subjectId: subject.id,
      curriculumNodeId: testNode.id,
      requestedQuestionCount: 2,
    });

    const sessionId = sessionInit.sessionId;
    const deliveredQ1 = sessionInit.firstQuestion;

    // Verify answer key is strictly NOT exposed in delivered DTO
    assert.strictEqual((deliveredQ1 as unknown as Record<string, unknown>).correctAnswer, undefined, "Delivery DTO must NEVER contain correctAnswer");
    assert.strictEqual((deliveredQ1 as unknown as Record<string, unknown>).explanation, undefined, "Delivery DTO must NEVER contain explanation");
    for (const opt of deliveredQ1.options) {
      assert.strictEqual((opt as unknown as Record<string, unknown>).isCorrect, undefined, "Option DTO must NEVER contain isCorrect flag");
    }

    console.log("  ✓ PASS: Question delivery DTO completely hides answer key and explanations before submission\n");

    // ----------------------------------------------------
    // TEST 3: Authentication & Ownership Verification
    // ----------------------------------------------------
    console.log("[3/8] Testing Authentication & Cross-Student Ownership...");

    // Student B attempts to submit answer to Student A's session
    await assert.rejects(
      async () => {
        await submitPracticeAnswer(studentB.id, {
          sessionId,
          sessionQuestionId: deliveredQ1.sessionQuestionId,
          selectedAnswer: "B",
        });
      },
      /unauthorized/i,
      "Submitting an answer to another student's session must be blocked"
    );

    // Cross-session question hijacking: using non-existent or foreign session question
    await assert.rejects(
      async () => {
        await submitPracticeAnswer(studentA.id, {
          sessionId,
          sessionQuestionId: "00000000-0000-0000-0000-000000000000",
          selectedAnswer: "B",
        });
      },
      /Delivered practice question not found/i,
      "Submitting against an unlinked session question ID must be blocked"
    );

    console.log("  ✓ PASS: Session ownership strictly enforced; foreign and fake question submissions blocked\n");

    // ----------------------------------------------------
    // TEST 4: Successful Submission & Student-Safe Answer Reveal
    // ----------------------------------------------------
    console.log("[4/8] Testing Answer Submission, Persistence & Reveal...");

    // Determine correct answer for delivered Q1
    const isFirstQuestionQ1 = deliveredQ1.questionId === q1.id;
    const q1CorrectAnswer = isFirstQuestionQ1 ? "B" : "C";
    const q1ExpectedVersion = isFirstQuestionQ1 ? v1_1 : v2_1;

    const submitResult = await submitPracticeAnswer(studentA.id, {
      sessionId,
      sessionQuestionId: deliveredQ1.sessionQuestionId,
      selectedAnswer: q1CorrectAnswer,
      timeSpentSeconds: 25,
    });

    assert.strictEqual(submitResult.sessionId, sessionId);
    assert.strictEqual(submitResult.sessionQuestionId, deliveredQ1.sessionQuestionId);
    assert.strictEqual(submitResult.selectedAnswer, q1CorrectAnswer);
    assert.strictEqual(submitResult.isCorrect, true);
    assert.strictEqual(submitResult.marksAwarded, 1);
    assert.strictEqual(submitResult.correctAnswer, q1CorrectAnswer, "Correct answer revealed after submission");
    assert.strictEqual(submitResult.explanation, q1ExpectedVersion.explanation, "Explanation revealed after submission");
    assert.strictEqual(submitResult.sessionProgress.answeredCount, 1);
    assert.strictEqual(submitResult.sessionProgress.correctCount, 1);

    // Verify row persisted in database
    const [persistedAttempt] = await db
      .select()
      .from(practiceAttempts)
      .where(eq(practiceAttempts.id, submitResult.attemptId))
      .limit(1);

    assert(persistedAttempt, "Attempt record must be persisted in database");
    assert.strictEqual(persistedAttempt.practiceSessionId, sessionId);
    assert.strictEqual(persistedAttempt.practiceSessionQuestionId, deliveredQ1.sessionQuestionId);
    assert.strictEqual(persistedAttempt.questionVersionId, deliveredQ1.questionVersionId);
    assert.strictEqual(persistedAttempt.selectedAnswer, q1CorrectAnswer);
    assert.strictEqual(persistedAttempt.isCorrect, true);
    assert.strictEqual(persistedAttempt.marksAwarded, 1);
    assert.strictEqual(persistedAttempt.timeSpentSeconds, 25);

    console.log("  ✓ PASS: Attempt persisted with exact version reference, correctness, and marks\n");

    // ----------------------------------------------------
    // TEST 5: Idempotency & Duplicate Submission Prevention
    // ----------------------------------------------------
    console.log("[5/8] Testing Idempotency & Concurrency Guardrails...");

    // Double-click simulation: Re-submitting the exact same question
    const secondSubmitResult = await submitPracticeAnswer(studentA.id, {
      sessionId,
      sessionQuestionId: deliveredQ1.sessionQuestionId,
      selectedAnswer: q1CorrectAnswer,
    });

    assert.strictEqual(secondSubmitResult.attemptId, submitResult.attemptId, "Repeated submission must return existing attempt ID");
    assert.strictEqual(secondSubmitResult.sessionProgress.answeredCount, 1, "Answered count must NOT double increment");
    assert.strictEqual(secondSubmitResult.sessionProgress.correctCount, 1, "Correct count must NOT double increment");

    // Direct database check: Verify only 1 row exists for this delivered question
    const attemptsCount = await db
      .select()
      .from(practiceAttempts)
      .where(eq(practiceAttempts.practiceSessionQuestionId, deliveredQ1.sessionQuestionId));

    assert.strictEqual(attemptsCount.length, 1, "Database must contain exactly ONE attempt for the delivered question");

    // Direct database constraint verification: Attempting a manual insert with duplicate sessionQuestionId
    await assert.rejects(
      async () => {
        await db.insert(practiceAttempts).values({
          practiceSessionId: sessionId,
          practiceSessionQuestionId: deliveredQ1.sessionQuestionId,
          studentProfileId: studentA.id,
          questionVersionId: deliveredQ1.questionVersionId,
          selectedAnswer: "D",
          isCorrect: false,
          marksAwarded: 0,
        });
      },
      (err: unknown) => {
        const e = err as { message?: string; cause?: { message?: string } };
        const fullErr = `${e?.message || ""} ${e?.cause?.message || ""}`.toLowerCase();
        return fullErr.includes("unique") || fullErr.includes("duplicate");
      },
      "Database unique constraint must block duplicate attempt rows for the same delivered question"
    );

    console.log("  ✓ PASS: Duplicate submissions resolve idempotently; database unique index blocks duplicate attempts\n");

    // ----------------------------------------------------
    // TEST 6: The Golden Invariant — Historical Immutability
    // ----------------------------------------------------
    console.log("[6/8] Testing The Golden Invariant: Immutable Version Grading...");

    // Administrator amends the delivered question by publishing Version 2 with a DIFFERENT correct answer
    // and deactivating Version 1.
    const deliveredQTarget = isFirstQuestionQ1 ? q1 : q2;
    const deliveredVTarget = isFirstQuestionQ1 ? v1_1 : v2_1;
    const newAmendedAnswer = q1CorrectAnswer === "B" ? "D" : "A";

    const [vAmended] = await db
      .insert(questionVersions)
      .values({
        questionId: deliveredQTarget.id,
        versionNumber: 2,
        questionText: "What is the revised standard cost formula? (Amended by ICAI)",
        correctAnswer: newAmendedAnswer, // Different answer!
        explanation: "Amended by ICAI standard revision.",
        isActive: true,
      })
      .returning();

    assert(vAmended.id, "Version 2 amendment must be created successfully");

    // Deactivate V1
    await db
      .update(questionVersions)
      .set({ isActive: false })
      .where(eq(questionVersions.id, deliveredVTarget.id));

    // Verify existing student attempt:
    // The attempt MUST remain correct and permanently tied to V1!
    const [historicalAttempt] = await db
      .select()
      .from(practiceAttempts)
      .where(eq(practiceAttempts.id, submitResult.attemptId))
      .limit(1);

    assert(historicalAttempt);
    assert.strictEqual(historicalAttempt.questionVersionId, deliveredVTarget.id, "Attempt must permanently reference delivered V1");
    assert.strictEqual(historicalAttempt.isCorrect, true, "Attempt must remain correct under V1 rules");
    assert.strictEqual(historicalAttempt.marksAwarded, 1, "Marks must remain 1 under V1 rules");

    // Verify idempotent re-check: Re-calling submitPracticeAnswer for this question must still return V1 data
    const historicalRecheck = await submitPracticeAnswer(studentA.id, {
      sessionId,
      sessionQuestionId: deliveredQ1.sessionQuestionId,
      selectedAnswer: q1CorrectAnswer,
    });
    assert.strictEqual(historicalRecheck.questionVersionId, deliveredVTarget.id);
    assert.strictEqual(historicalRecheck.isCorrect, true);
    assert.strictEqual(
      historicalRecheck.correctAnswer,
      q1CorrectAnswer,
      `Revealed answer must remain V1 answer ('${q1CorrectAnswer}'), NOT amended V2 answer ('${newAmendedAnswer}')`
    );

    console.log("  ✓ PASS: Question amendments and new versions have zero effect on historical grading\n");

    // ----------------------------------------------------
    // TEST 7: Session Completion & Real-Time Progress
    // ----------------------------------------------------
    console.log("[7/8] Testing Session Progression & Completion Lifecycle...");

    // Fetch Question 2 for student A
    const nextResult = await getNextPracticeQuestion(studentA.id, sessionId);
    assert(nextResult.question, "Question 2 must be delivered");

    // Answer Question 2 intentionally incorrectly
    const q2Delivered = nextResult.question;
    const q2IsQ1 = q2Delivered.questionId === q1.id;
    const q2CorrectAnswer = q2IsQ1 ? "B" : "C";
    const q2WrongAnswer = q2CorrectAnswer === "B" ? "A" : "A";

    const q2Result = await submitPracticeAnswer(studentA.id, {
      sessionId,
      sessionQuestionId: q2Delivered.sessionQuestionId,
      selectedAnswer: q2WrongAnswer, // Incorrect answer
    });

    assert.strictEqual(q2Result.isCorrect, false);
    assert.strictEqual(q2Result.marksAwarded, 0);
    assert.strictEqual(q2Result.sessionProgress.answeredCount, 2);
    assert.strictEqual(q2Result.sessionProgress.correctCount, 1);
    assert.strictEqual(q2Result.sessionProgress.incorrectCount, 1);
    assert.strictEqual(q2Result.sessionProgress.accuracyPercentage, 50);
    assert.strictEqual(q2Result.isSessionCompleted, true, "Session must be marked completed upon answering total questions");

    // Verify session row status in database
    const [finalSession] = await db
      .select()
      .from(practiceSessions)
      .where(eq(practiceSessions.id, sessionId))
      .limit(1);

    assert.strictEqual(finalSession.status, "COMPLETED", "Session status must be COMPLETED");
    assert(finalSession.completedAt, "completedAt timestamp must be set");

    console.log("  ✓ PASS: Session transitions to COMPLETED upon answering all questions; progression stats accurate\n");

    // ----------------------------------------------------
    // TEST 8: Authoritative Session Summary Screen
    // ----------------------------------------------------
    console.log("[8/8] Testing Authoritative Session Summary & Item Reviews...");

    const summary = await getPracticeSessionSummary(studentA.id, sessionId);

    assert.strictEqual(summary.session.id, sessionId);
    assert.strictEqual(summary.session.status, "COMPLETED");
    assert.strictEqual(summary.progress.totalQuestions, 2);
    assert.strictEqual(summary.progress.answeredCount, 2);
    assert.strictEqual(summary.progress.correctCount, 1);
    assert.strictEqual(summary.progress.incorrectCount, 1);
    assert.strictEqual(summary.progress.accuracyPercentage, 50);
    assert.strictEqual(summary.progress.currentScore, 1);
    assert.strictEqual(summary.progress.maxPossibleScore, 2);

    // Verify review items
    assert.strictEqual(summary.reviewItems.length, 2);
    const item1 = summary.reviewItems[0];
    assert.strictEqual(item1.sequenceNumber, 1);
    assert.strictEqual(item1.selectedAnswer, q1CorrectAnswer);
    assert.strictEqual(item1.correctAnswer, q1CorrectAnswer);
    assert.strictEqual(item1.isCorrect, true);
    assert.strictEqual(item1.marksAwarded, 1);
    assert(item1.explanation);

    const item2 = summary.reviewItems[1];
    assert.strictEqual(item2.sequenceNumber, 2);
    assert.strictEqual(item2.selectedAnswer, q2WrongAnswer);
    assert.strictEqual(item2.isCorrect, false);
    assert.strictEqual(item2.marksAwarded, 0);

    console.log("  ✓ PASS: Complete session summary accurately reflects all answers, marks, and review items\n");

    console.log("==================================================");
    console.log("ALL STEP 23 GRADING INTEGRITY TESTS PASSED (8/8)");
    console.log("==================================================");
  } finally {
    // Cleanup created test records
    console.log("Cleaning up test artifacts...");
    for (const pid of createdProfileIds) {
      await db.delete(practiceAttempts).where(eq(practiceAttempts.studentProfileId, pid));
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
        await db.delete(practiceAttempts).where(inArray(practiceAttempts.questionVersionId, vIds));
        await db.delete(practiceSessionQuestions).where(inArray(practiceSessionQuestions.questionVersionId, vIds));
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

runGradingIntegrityTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test execution failed:", err);
    process.exit(1);
  });
