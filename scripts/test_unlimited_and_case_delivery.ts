import { db } from "../src/db";
import { academicLevels, curriculumVersions, studentProfiles, practiceSessions, practiceSessionQuestions, practiceAttempts } from "../src/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { createPracticeSession, getNextPracticeQuestion, completePracticeSession, getPracticeSessionState } from "../src/domains/practice/services";
import { submitPracticeAnswer } from "../src/domains/practice/services/attempts";

async function runTests() {
  console.log("=== STARTING UNLIMITED & CASE DELIVERY VERIFICATION ===");

  // 1. Resolve student profile and Foundation active version
  const [profile] = await db.select().from(studentProfiles).limit(1);
  if (!profile) throw new Error("No student profile found in DB.");

  const [fnd] = await db.select().from(academicLevels).where(eq(academicLevels.code, "FOUNDATION"));
  const [ver] = await db.select().from(curriculumVersions).where(and(eq(curriculumVersions.academicLevelId, fnd.id), eq(curriculumVersions.isActive, true)));

  console.log(`Student profile: ${profile.id} (${profile.email})`);
  console.log(`Foundation Level: ${fnd.id}, Version: ${ver.id}`);

  // 2. Test 1: Create 5-Case Study Session
  console.log("\n--- TEST 1: Create 5-Case Study Session ---");
  const caseSession = await createPracticeSession(profile.id, {
    academicLevelId: fnd.id,
    practiceMode: "CASE_STUDY",
    difficulty: "ANY",
    questionType: "CASE_STUDY",
    requestedQuestionCount: 5,
  });

  console.log(`Created Session ID: ${caseSession.sessionId}`);
  console.log(`First Question ID: ${caseSession.firstQuestion.questionId}`);

  // Query delivered questions for this session
  const delivered = await db
    .select({ seq: practiceSessionQuestions.sequenceNumber, qId: practiceSessionQuestions.questionId })
    .from(practiceSessionQuestions)
    .where(eq(practiceSessionQuestions.practiceSessionId, caseSession.sessionId))
    .orderBy(practiceSessionQuestions.sequenceNumber);

  console.log(`Delivered question count for 5-case session: ${delivered.length}`);
  if (delivered.length !== 5) {
    throw new Error(`Expected 5 delivered questions for 5-case session, but found ${delivered.length}`);
  }
  console.log("✅ TEST 1 PASSED: Exactly 5 case study questions delivered upfront!");

  // 3. Test 2: Answer Question 1 of 5-case session and verify it does NOT complete
  console.log("\n--- TEST 2: Answer Question 1 of 5-Case Study Session ---");
  const answerRes = await submitPracticeAnswer(profile.id, {
    sessionId: caseSession.sessionId,
    sessionQuestionId: caseSession.firstQuestion.sessionQuestionId,
    selectedAnswer: "A",
  });

  console.log(`Answer result: isCorrect=${answerRes.isCorrect}, isSessionCompleted=${answerRes.isSessionCompleted}`);
  if (answerRes.isSessionCompleted) {
    throw new Error("❌ BUG: Session prematurely completed after answering only 1 of 5 questions!");
  }

  const [sessionCheck] = await db.select({ status: practiceSessions.status }).from(practiceSessions).where(eq(practiceSessions.id, caseSession.sessionId));
  console.log(`Session status in DB: ${sessionCheck.status}`);
  if (sessionCheck.status !== "ACTIVE") {
    throw new Error(`Expected session status ACTIVE, got ${sessionCheck.status}`);
  }
  console.log("✅ TEST 2 PASSED: 5-Case study session stays ACTIVE after question 1!");

  // 4. Test 3: Create Unlimited (Continuous) MCQ Session
  console.log("\n--- TEST 3: Create Unlimited (Continuous) Practice Session ---");
  const unlimitedSession = await createPracticeSession(profile.id, {
    academicLevelId: fnd.id,
    practiceMode: "QUESTION",
    difficulty: "ANY",
    questionType: "MCQ",
    requestedQuestionCount: 0,
  });

  const [unlimitedDb] = await db.select({ questionCount: practiceSessions.questionCount, status: practiceSessions.status }).from(practiceSessions).where(eq(practiceSessions.id, unlimitedSession.sessionId));
  console.log(`Unlimited session questionCount: ${unlimitedDb.questionCount} (Expected: 0)`);
  if (unlimitedDb.questionCount !== 0) {
    throw new Error(`Expected questionCount 0, got ${unlimitedDb.questionCount}`);
  }

  // Answer question 1
  const unlimAnswer = await submitPracticeAnswer(profile.id, {
    sessionId: unlimitedSession.sessionId,
    sessionQuestionId: unlimitedSession.firstQuestion.sessionQuestionId,
    selectedAnswer: "B",
  });
  console.log(`Continuous question 1 answered: isSessionCompleted=${unlimAnswer.isSessionCompleted}`);
  if (unlimAnswer.isSessionCompleted) {
    throw new Error("❌ BUG: Continuous session completed automatically after question 1!");
  }

  // Deliver next question 2
  const nextQ2 = await getNextPracticeQuestion(profile.id, unlimitedSession.sessionId);
  console.log(`Next question 2 delivered: seq=${nextQ2.deliveredCount}, isCompleted=${nextQ2.isCompleted}`);
  if (nextQ2.isCompleted || !nextQ2.question) {
    throw new Error("Expected question 2 to be delivered, but got completed!");
  }

  // Deliver next question 3
  const nextQ3 = await getNextPracticeQuestion(profile.id, unlimitedSession.sessionId);
  console.log(`Next question 3 delivered: seq=${nextQ3.deliveredCount}, isCompleted=${nextQ3.isCompleted}`);
  if (nextQ3.isCompleted || !nextQ3.question) {
    throw new Error("Expected question 3 to be delivered, but got completed!");
  }

  // Manually complete continuous session
  const finishRes = await completePracticeSession(profile.id, unlimitedSession.sessionId);
  console.log(`Manual complete result: ${JSON.stringify(finishRes)}`);
  const [completedCheck] = await db.select({ status: practiceSessions.status }).from(practiceSessions).where(eq(practiceSessions.id, unlimitedSession.sessionId));
  if (completedCheck.status !== "COMPLETED") {
    throw new Error(`Expected COMPLETED, got ${completedCheck.status}`);
  }
  console.log("✅ TEST 3 PASSED: Continuous practice delivers multiple questions indefinitely and completes cleanly on demand!");

  console.log("\n🎉 ALL VERIFICATION TESTS PASSED SUCCESSFULLY!");
}

runTests().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
