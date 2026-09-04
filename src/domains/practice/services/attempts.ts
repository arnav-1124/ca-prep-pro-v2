import { db } from "@/db";
import {
  practiceSessions,
  practiceSessionQuestions,
  practiceAttempts,
  questionVersions,
  questionOptions,
} from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import {
  SubmitAnswerInput,
  submitAnswerSchema,
  SubmitAnswerResultDto,
  PracticeSessionProgressDto,
} from "../types";
import { gradeAnswer } from "./grading";

/**
 * Calculates authoritative, server-derived session progress from persisted attempts.
 */
export async function calculateSessionProgress(
  sessionId: string,
  totalQuestions: number
): Promise<PracticeSessionProgressDto> {
  // Count delivered questions
  const [deliveredRes] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(practiceSessionQuestions)
    .where(eq(practiceSessionQuestions.practiceSessionId, sessionId));

  const deliveredCount = deliveredRes?.count || 0;

  // Aggregate attempts
  const [attemptsRes] = await db
    .select({
      totalAnswered: sql<number>`count(*)::int`,
      correctCount: sql<number>`count(*) filter (where ${practiceAttempts.isCorrect} = true)::int`,
      totalScore: sql<number>`coalesce(sum(${practiceAttempts.marksAwarded}), 0)::int`,
    })
    .from(practiceAttempts)
    .where(eq(practiceAttempts.practiceSessionId, sessionId));

  const answeredCount = attemptsRes?.totalAnswered || 0;
  const correctCount = attemptsRes?.correctCount || 0;
  const incorrectCount = answeredCount - correctCount;
  const unansweredCount = Math.max(0, totalQuestions - answeredCount);
  const accuracyPercentage =
    answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0;
  const currentScore = attemptsRes?.totalScore || 0;
  const maxPossibleScore = totalQuestions;

  return {
    totalQuestions,
    deliveredCount,
    answeredCount,
    correctCount,
    incorrectCount,
    unansweredCount,
    accuracyPercentage,
    currentScore,
    maxPossibleScore,
  };
}

/**
 * Submits a student's answer choice for a delivered practice question.
 *
 * CORE INVARIANTS:
 * 1. Grading is evaluated strictly against the immutable question_version_id
 *    recorded on the practice_session_questions row at delivery time.
 * 2. Exactly one attempt per delivered question is enforced via database unique constraints.
 * 3. Idempotent: repeated submissions return the existing attempt and do not alter scores.
 * 4. Zero answer key leakage: Correct answer and explanation are revealed strictly after grading.
 */
export async function submitPracticeAnswer(
  studentProfileId: string,
  input: SubmitAnswerInput
): Promise<SubmitAnswerResultDto> {
  // 1. Validate input structure
  const validated = submitAnswerSchema.parse(input);

  // 2. Fetch session and verify ownership
  const [session] = await db
    .select()
    .from(practiceSessions)
    .where(eq(practiceSessions.id, validated.sessionId))
    .limit(1);

  if (!session) {
    throw new Error("Practice session not found.");
  }

  if (session.studentProfileId !== studentProfileId) {
    throw new Error("Unauthorized access to practice session.");
  }

  const totalQuestions = session.questionCount || 10;

  // 3. Verify delivered session question exists in this session
  const [sessionQuestion] = await db
    .select()
    .from(practiceSessionQuestions)
    .where(
      and(
        eq(practiceSessionQuestions.id, validated.sessionQuestionId),
        eq(practiceSessionQuestions.practiceSessionId, validated.sessionId)
      )
    )
    .limit(1);

  if (!sessionQuestion) {
    throw new Error("Delivered practice question not found in this session.");
  }

  // 4. Idempotency Check: Return existing attempt if already answered
  const [existingAttempt] = await db
    .select()
    .from(practiceAttempts)
    .where(eq(practiceAttempts.practiceSessionQuestionId, validated.sessionQuestionId))
    .limit(1);

  if (existingAttempt) {
    const [version] = await db
      .select({
        correctAnswer: questionVersions.correctAnswer,
        explanation: questionVersions.explanation,
      })
      .from(questionVersions)
      .where(eq(questionVersions.id, existingAttempt.questionVersionId))
      .limit(1);

    const progress = await calculateSessionProgress(session.id, totalQuestions);

    return {
      attemptId: existingAttempt.id,
      sessionId: session.id,
      sessionQuestionId: validated.sessionQuestionId,
      questionVersionId: existingAttempt.questionVersionId,
      selectedAnswer: existingAttempt.selectedAnswer,
      isCorrect: existingAttempt.isCorrect,
      correctAnswer: version?.correctAnswer || "",
      explanation: version?.explanation || null,
      marksAwarded: existingAttempt.marksAwarded,
      sessionProgress: progress,
      isSessionCompleted: session.status === "COMPLETED",
    };
  }

  // If not already answered, verify session is still active
  if (session.status === "COMPLETED" || session.status === "ABANDONED") {
    throw new Error("This practice session has already ended.");
  }

  // 5. Authoritative Immutable Chain: Resolve delivered question version
  const [version] = await db
    .select({
      id: questionVersions.id,
      correctAnswer: questionVersions.correctAnswer,
      explanation: questionVersions.explanation,
    })
    .from(questionVersions)
    .where(eq(questionVersions.id, sessionQuestion.questionVersionId))
    .limit(1);

  if (!version) {
    throw new Error("Authoritative delivered question version record not found.");
  }

  // 6. Validate option choice against options belonging to this version
  const options = await db
    .select({ optionLetter: questionOptions.optionLetter })
    .from(questionOptions)
    .where(eq(questionOptions.questionVersionId, version.id));

  const validOptions = options.map((o) => o.optionLetter);
  if (validOptions.length === 0) {
    throw new Error("Question options could not be loaded for evaluation.");
  }

  // 7. Deterministic grading
  const gradingResult = gradeAnswer({
    questionVersion: version,
    selectedAnswer: validated.selectedAnswer,
    validOptions,
  });

  // 8. Concurrency-safe attempt insertion
  let attemptRecord;
  try {
    const [inserted] = await db
      .insert(practiceAttempts)
      .values({
        practiceSessionId: session.id,
        practiceSessionQuestionId: sessionQuestion.id,
        studentProfileId,
        questionVersionId: version.id,
        selectedAnswer: gradingResult.normalizedSelectedAnswer,
        isCorrect: gradingResult.isCorrect,
        marksAwarded: gradingResult.marksAwarded,
        timeSpentSeconds: validated.timeSpentSeconds || 0,
      })
      .returning();
    attemptRecord = inserted;
  } catch (err: unknown) {
    // Catch unique constraint collision if another request inserted concurrently
    const [concurrent] = await db
      .select()
      .from(practiceAttempts)
      .where(eq(practiceAttempts.practiceSessionQuestionId, sessionQuestion.id))
      .limit(1);

    if (concurrent) {
      attemptRecord = concurrent;
    } else {
      throw err;
    }
  }

  // 9. Calculate updated progress and check session completion
  const progress = await calculateSessionProgress(session.id, totalQuestions);

  let isSessionCompleted = false;
  if (progress.answeredCount >= totalQuestions) {
    await db
      .update(practiceSessions)
      .set({ status: "COMPLETED", completedAt: new Date(), updatedAt: new Date() })
      .where(eq(practiceSessions.id, session.id));
    isSessionCompleted = true;
  }

  // 10. Return student-safe reveal result
  return {
    attemptId: attemptRecord.id,
    sessionId: session.id,
    sessionQuestionId: sessionQuestion.id,
    questionVersionId: version.id,
    selectedAnswer: gradingResult.normalizedSelectedAnswer,
    isCorrect: gradingResult.isCorrect,
    correctAnswer: gradingResult.correctAnswer,
    explanation: gradingResult.explanation,
    marksAwarded: gradingResult.marksAwarded,
    sessionProgress: progress,
    isSessionCompleted,
  };
}
