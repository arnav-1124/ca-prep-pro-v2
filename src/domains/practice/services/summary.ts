import { db } from "@/db";
import {
  practiceSessions,
  practiceSessionQuestions,
  practiceAttempts,
  academicLevels,
  subjects,
  curriculumNodes,
  questionVersions,
  questionOptions,
  questions,
} from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import {
  PracticeSessionSummaryDto,
  PracticeSessionDetailsDto,
  PracticeQuestionReviewItemDto,
  StudentPracticeOptionDto,
} from "../types";
import { calculateSessionProgress } from "./attempts";

/**
 * Retrieves the complete authoritative summary of a practice session,
 * including aggregate performance metrics and question-by-question review items.
 */
export async function getPracticeSessionSummary(
  studentProfileId: string,
  sessionId: string
): Promise<PracticeSessionSummaryDto> {
  // 1. Fetch practice session with level details
  const [session] = await db
    .select({
      id: practiceSessions.id,
      studentProfileId: practiceSessions.studentProfileId,
      academicLevelId: practiceSessions.academicLevelId,
      curriculumVersionId: practiceSessions.curriculumVersionId,
      subjectId: practiceSessions.subjectId,
      curriculumNodeId: practiceSessions.curriculumNodeId,
      status: practiceSessions.status,
      practiceMode: practiceSessions.practiceMode,
      difficulty: practiceSessions.difficulty,
      questionType: practiceSessions.questionType,
      questionCount: practiceSessions.questionCount,
      startedAt: practiceSessions.startedAt,
      completedAt: practiceSessions.completedAt,
      levelName: academicLevels.name,
    })
    .from(practiceSessions)
    .innerJoin(academicLevels, eq(practiceSessions.academicLevelId, academicLevels.id))
    .where(eq(practiceSessions.id, sessionId))
    .limit(1);

  if (!session) {
    throw new Error("Practice session not found.");
  }

  if (session.studentProfileId !== studentProfileId) {
    throw new Error("Unauthorized access to practice session.");
  }

  // Fetch subject and node names
  let subjectName: string | null = null;
  if (session.subjectId) {
    const [sub] = await db
      .select({ name: subjects.name })
      .from(subjects)
      .where(eq(subjects.id, session.subjectId))
      .limit(1);
    subjectName = sub?.name || null;
  }

  let curriculumNodeName: string | null = null;
  if (session.curriculumNodeId) {
    const [node] = await db
      .select({ name: curriculumNodes.name })
      .from(curriculumNodes)
      .where(eq(curriculumNodes.id, session.curriculumNodeId))
      .limit(1);
    curriculumNodeName = node?.name || null;
  }

  const totalQuestions = session.questionCount || 10;

  // 2. Fetch all delivered questions
  const deliveredQuestions = await db
    .select({
      sessionQuestionId: practiceSessionQuestions.id,
      sequenceNumber: practiceSessionQuestions.sequenceNumber,
      questionId: practiceSessionQuestions.questionId,
      questionVersionId: practiceSessionQuestions.questionVersionId,
      deliveredAt: practiceSessionQuestions.deliveredAt,
      questionText: questionVersions.questionText,
      correctAnswer: questionVersions.correctAnswer,
      explanation: questionVersions.explanation,
      difficulty: questions.difficulty,
      questionType: questions.questionType,
    })
    .from(practiceSessionQuestions)
    .innerJoin(questionVersions, eq(practiceSessionQuestions.questionVersionId, questionVersions.id))
    .innerJoin(questions, eq(practiceSessionQuestions.questionId, questions.id))
    .where(eq(practiceSessionQuestions.practiceSessionId, sessionId))
    .orderBy(asc(practiceSessionQuestions.sequenceNumber));

  // 3. Fetch all attempts in this session
  const attempts = await db
    .select({
      practiceSessionQuestionId: practiceAttempts.practiceSessionQuestionId,
      selectedAnswer: practiceAttempts.selectedAnswer,
      isCorrect: practiceAttempts.isCorrect,
      marksAwarded: practiceAttempts.marksAwarded,
      timeSpentSeconds: practiceAttempts.timeSpentSeconds,
    })
    .from(practiceAttempts)
    .where(eq(practiceAttempts.practiceSessionId, sessionId));

  const attemptsByQuestionId = new Map(
    attempts
      .filter((a) => a.practiceSessionQuestionId !== null)
      .map((a) => [a.practiceSessionQuestionId as string, a])
  );

  // 4. Fetch options for delivered question versions
  const versionIds = [...new Set(deliveredQuestions.map((q) => q.questionVersionId))];
  const optionsMap = new Map<string, StudentPracticeOptionDto[]>();

  for (const vId of versionIds) {
    const opts = await db
      .select({
        id: questionOptions.id,
        optionLetter: questionOptions.optionLetter,
        optionText: questionOptions.optionText,
      })
      .from(questionOptions)
      .where(eq(questionOptions.questionVersionId, vId))
      .orderBy(asc(questionOptions.optionLetter));
    optionsMap.set(vId, opts);
  }

  // 5. Construct review items
  const reviewItems: PracticeQuestionReviewItemDto[] = deliveredQuestions.map((q) => {
    const attempt = attemptsByQuestionId.get(q.sessionQuestionId);
    return {
      sessionQuestionId: q.sessionQuestionId,
      sequenceNumber: q.sequenceNumber,
      questionText: q.questionText,
      questionType: (q.questionType as "MCQ" | "CASE_STUDY") || "MCQ",
      difficulty: q.difficulty,
      options: optionsMap.get(q.questionVersionId) || [],
      selectedAnswer: attempt ? attempt.selectedAnswer : null,
      correctAnswer: q.correctAnswer,
      isCorrect: attempt ? attempt.isCorrect : null,
      explanation: q.explanation,
      marksAwarded: attempt ? attempt.marksAwarded : 0,
      timeSpentSeconds: attempt ? attempt.timeSpentSeconds || 0 : 0,
    };
  });

  // 6. Calculate progress metrics
  const progress = await calculateSessionProgress(session.id, totalQuestions);

  const sessionDetails: PracticeSessionDetailsDto = {
    id: session.id,
    studentProfileId: session.studentProfileId,
    academicLevelId: session.academicLevelId,
    levelName: session.levelName,
    curriculumVersionId: session.curriculumVersionId,
    subjectId: session.subjectId,
    subjectName,
    curriculumNodeId: session.curriculumNodeId,
    curriculumNodeName,
    status: session.status as "ACTIVE" | "COMPLETED" | "ABANDONED",
    practiceMode: session.practiceMode as "QUESTION" | "CASE_STUDY",
    difficulty: session.difficulty || "ANY",
    questionType: session.questionType || "MCQ",
    questionCount: totalQuestions,
    deliveredCount: deliveredQuestions.length,
    startedAt: session.startedAt.toISOString(),
    completedAt: session.completedAt ? session.completedAt.toISOString() : null,
  };

  return {
    session: sessionDetails,
    progress,
    reviewItems,
  };
}
