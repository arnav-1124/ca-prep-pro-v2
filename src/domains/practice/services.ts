import { db } from "@/db";
import {
  practiceSessions,
  practiceSessionQuestions,
  practiceAttempts,
  questions,
  questionVersions,
  questionOptions,
  subjects,
  academicLevels,
  curriculumNodes,
  caseStudies,
} from "@/db/schema";
import { eq, and, asc, inArray } from "drizzle-orm";
import { getActiveStudentAttempt, getActiveCurriculumVersion } from "@/domains/academics/services";

export * from "./types";
export * from "./services/selector";
export * from "./services/session";

import { countEligibleQuestions } from "./services/selector";
import { createPracticeSession } from "./services/session";

export interface PracticeQuestion {
  id: string; // question ID
  questionVersionId: string;
  questionText: string;
  difficulty: string;
  questionType: string;
  correctAnswer?: string;
  explanation?: string | null;
  subjectName: string;
  curriculumNodeName: string;
  caseStudyId: string | null;
  caseStudyTitle: string | null;
  caseStudyScenarioText: string | null;
  options: {
    id: string;
    optionLetter: string;
    optionText: string;
  }[];
}

export interface PracticeSessionState {
  sessionId: string;
  status: string; // 'ACTIVE' | 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED'
  practiceMode: string; // 'QUESTION' | 'CASE_STUDY'
  levelName: string;
  subjectName: string | null;
  curriculumNodeName: string | null;
  currentNumber: number; // 1-indexed (used for progress indicator)
  totalQuestions: number;
  currentQuestion: PracticeQuestion | null;
  questions: PracticeQuestion[];
  attempts: {
    id: string;
    questionVersionId: string;
    selectedAnswer: string;
    isCorrect: boolean;
    questionText: string;
    correctAnswer: string;
    explanation: string | null;
  }[];
  summary?: {
    correctCount: number;
    incorrectCount: number;
    accuracy: number;
    startedAt: Date;
    completedAt: Date | null;
  };
}

/**
 * Returns the count of available questions matching the specified configuration.
 * Resolves active curriculum version dynamically.
 */
export async function getAvailableQuestionsCount(
  levelId: string,
  subjectId?: string | null,
  curriculumNodeId?: string | null,
  practiceMode: string = "QUESTION",
  difficulty: string | null = "ANY",
  questionType: string | null = "MCQ"
): Promise<number> {
  const activeVersion = await getActiveCurriculumVersion(levelId);
  if (!activeVersion) return 0;

  return countEligibleQuestions({
    academicLevelId: levelId,
    curriculumVersionId: activeVersion.id,
    subjectId,
    curriculumNodeId,
    practiceMode: practiceMode as "QUESTION" | "CASE_STUDY",
    difficulty,
    questionType,
  });
}

/**
 * Starts a new practice session for a student based on active attempt and config filters.
 * Bridges to the deterministic creation service.
 */
export async function startPracticeSession(
  studentProfileId: string,
  subjectId?: string | null,
  curriculumNodeId?: string | null,
  practiceMode: string = "QUESTION",
  difficulty: string | null = "ANY",
  questionType: string | null = "MCQ",
  questionCount: number = 10
) {
  // 1. Resolve active target attempt context
  const activeAttempt = await getActiveStudentAttempt(studentProfileId);
  if (!activeAttempt) {
    throw new Error("No active preparation context found. Please complete onboarding first.");
  }

  const { sessionId } = await createPracticeSession(studentProfileId, {
    academicLevelId: activeAttempt.levelId,
    subjectId: subjectId || null,
    curriculumNodeId: curriculumNodeId || null,
    practiceMode: practiceMode === "CASE_STUDY" ? "CASE_STUDY" : "QUESTION",
    difficulty: difficulty === "EASY" || difficulty === "MEDIUM" || difficulty === "HARD" ? difficulty : "ANY",
    questionType: questionType === "CASE_STUDY" ? "CASE_STUDY" : "MCQ",
    requestedQuestionCount: questionCount,
  });

  const [session] = await db
    .select()
    .from(practiceSessions)
    .where(eq(practiceSessions.id, sessionId))
    .limit(1);

  return session;
}

/**
 * Resolves session state from delivered questions and attempts.
 */
export async function getPracticeSessionState(
  sessionId: string,
  studentProfileId: string
): Promise<PracticeSessionState> {
  // 1. Fetch practice session config
  const [session] = await db
    .select({
      id: practiceSessions.id,
      studentProfileId: practiceSessions.studentProfileId,
      academicLevelId: practiceSessions.academicLevelId,
      curriculumVersionId: practiceSessions.curriculumVersionId,
      subjectId: practiceSessions.subjectId,
      curriculumNodeId: practiceSessions.curriculumNodeId,
      status: practiceSessions.status,
      startedAt: practiceSessions.startedAt,
      completedAt: practiceSessions.completedAt,
      practiceMode: practiceSessions.practiceMode,
      difficulty: practiceSessions.difficulty,
      questionType: practiceSessions.questionType,
      questionCount: practiceSessions.questionCount,
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

  // Fetch optional subject and node metadata names
  let subjectName: string | null = null;
  if (session.subjectId) {
    const [sub] = await db.select({ name: subjects.name }).from(subjects).where(eq(subjects.id, session.subjectId)).limit(1);
    subjectName = sub?.name || null;
  }

  let curriculumNodeName: string | null = null;
  if (session.curriculumNodeId) {
    const [node] = await db.select({ name: curriculumNodes.name }).from(curriculumNodes).where(eq(curriculumNodes.id, session.curriculumNodeId)).limit(1);
    curriculumNodeName = node?.name || null;
  }

  // 2. Query delivered questions for this session
  const delivered = await db
    .select({
      id: practiceSessionQuestions.id,
      sequenceNumber: practiceSessionQuestions.sequenceNumber,
      questionId: practiceSessionQuestions.questionId,
      questionVersionId: practiceSessionQuestions.questionVersionId,
      questionText: questionVersions.questionText,
      difficulty: questions.difficulty,
      questionType: questions.questionType,
      caseStudyId: questions.caseStudyId,
      caseStudyTitle: caseStudies.title,
      caseStudyScenarioText: caseStudies.scenarioText,
      nodeName: curriculumNodes.name,
    })
    .from(practiceSessionQuestions)
    .innerJoin(questionVersions, eq(practiceSessionQuestions.questionVersionId, questionVersions.id))
    .innerJoin(questions, eq(practiceSessionQuestions.questionId, questions.id))
    .leftJoin(caseStudies, eq(questions.caseStudyId, caseStudies.id))
    .leftJoin(curriculumNodes, eq(questions.curriculumNodeId, curriculumNodes.id))
    .where(eq(practiceSessionQuestions.practiceSessionId, sessionId))
    .orderBy(asc(practiceSessionQuestions.sequenceNumber));

  // 3. Query options for delivered versions
  const versionIds = delivered.map((d) => d.questionVersionId);
  const optionsMap = new Map<string, { id: string; optionLetter: string; optionText: string }[]>();

  if (versionIds.length > 0) {
    const allOptions = await db
      .select()
      .from(questionOptions)
      .where(inArray(questionOptions.questionVersionId, versionIds))
      .orderBy(asc(questionOptions.optionLetter));

    for (const opt of allOptions) {
      const list = optionsMap.get(opt.questionVersionId) || [];
      list.push({
        id: opt.id,
        optionLetter: opt.optionLetter,
        optionText: opt.optionText,
      });
      optionsMap.set(opt.questionVersionId, list);
    }
  }

  // Assemble delivered questions (sanitized - no correct answer)
  const sessionQuestions: PracticeQuestion[] = delivered.map((q) => ({
    id: q.questionId,
    questionVersionId: q.questionVersionId,
    questionText: q.questionText,
    difficulty: q.difficulty,
    questionType: q.questionType,
    subjectName: subjectName || "",
    curriculumNodeName: q.nodeName || curriculumNodeName || "",
    caseStudyId: q.caseStudyId,
    caseStudyTitle: q.caseStudyTitle,
    caseStudyScenarioText: q.caseStudyScenarioText,
    options: optionsMap.get(q.questionVersionId) || [],
  }));

  // 4. Fetch all attempts made in this session
  const attemptsList = await db
    .select({
      id: practiceAttempts.id,
      questionVersionId: practiceAttempts.questionVersionId,
      selectedAnswer: practiceAttempts.selectedAnswer,
      isCorrect: practiceAttempts.isCorrect,
      questionText: questionVersions.questionText,
      correctAnswer: questionVersions.correctAnswer,
      explanation: questionVersions.explanation,
    })
    .from(practiceAttempts)
    .innerJoin(questionVersions, eq(practiceAttempts.questionVersionId, questionVersions.id))
    .where(eq(practiceAttempts.practiceSessionId, sessionId))
    .orderBy(asc(practiceAttempts.createdAt));

  const totalQuestions = session.questionCount || 10;
  const attemptsCount = attemptsList.length;
  const isCompleted = session.status === "COMPLETED" || session.status === "ABANDONED";

  // Current question is the latest delivered question if unattempted, or next
  const answeredVersionIds = new Set(attemptsList.map((a) => a.questionVersionId));
  const currentQuestion = !isCompleted
    ? sessionQuestions.find((q) => !answeredVersionIds.has(q.questionVersionId)) || sessionQuestions[sessionQuestions.length - 1] || null
    : null;

  const currentNumber = isCompleted ? totalQuestions : (sessionQuestions.length || 1);

  const correctCount = attemptsList.filter((a) => a.isCorrect).length;
  const incorrectCount = attemptsCount - correctCount;
  const accuracy = attemptsCount > 0 ? Math.round((correctCount / attemptsCount) * 100) : 0;

  return {
    sessionId: session.id,
    status: isCompleted ? "COMPLETED" : "ACTIVE",
    practiceMode: session.practiceMode,
    levelName: session.levelName,
    subjectName,
    curriculumNodeName,
    currentNumber,
    totalQuestions,
    currentQuestion,
    questions: sessionQuestions,
    attempts: attemptsList,
    summary: {
      correctCount,
      incorrectCount,
      accuracy,
      startedAt: session.startedAt,
      completedAt: isCompleted ? (session.completedAt || new Date()) : null,
    },
  };
}

/**
 * Submits a student's answer choice for the current question in a practice session.
 */
export async function submitAnswer(
  studentProfileId: string,
  sessionId: string,
  questionVersionId: string,
  selectedAnswer: string
) {
  // 1. Fetch practice session and check ownership
  const [session] = await db
    .select()
    .from(practiceSessions)
    .where(eq(practiceSessions.id, sessionId))
    .limit(1);

  if (!session) {
    throw new Error("Practice session not found.");
  }

  if (session.studentProfileId !== studentProfileId) {
    throw new Error("Unauthorized access to practice session.");
  }

  if (session.status === "COMPLETED" || session.status === "ABANDONED") {
    throw new Error("Practice session is already completed.");
  }

  // 2. Fetch the question version to verify correctness
  const [version] = await db
    .select()
    .from(questionVersions)
    .where(eq(questionVersions.id, questionVersionId))
    .limit(1);

  if (!version) {
    throw new Error("Question details not found.");
  }

  // Check if this question was already answered in the session
  const [existingAttempt] = await db
    .select()
    .from(practiceAttempts)
    .where(
      and(
        eq(practiceAttempts.practiceSessionId, sessionId),
        eq(practiceAttempts.questionVersionId, questionVersionId)
      )
    )
    .limit(1);

  if (existingAttempt) {
    throw new Error("This question has already been answered.");
  }

  const isCorrect = version.correctAnswer.toUpperCase() === selectedAnswer.toUpperCase();

  // 3. Record attempt in database
  const [attempt] = await db
    .insert(practiceAttempts)
    .values({
      practiceSessionId: sessionId,
      questionVersionId,
      selectedAnswer: selectedAnswer.toUpperCase(),
      isCorrect,
      timeSpentSeconds: 0,
    })
    .returning();

  return {
    attemptId: attempt.id,
    isCorrect,
    correctAnswer: version.correctAnswer,
    explanation: version.explanation,
    isSessionCompleted: false,
  };
}
