import { db } from "@/db";
import {
  practiceSessions,
  practiceAttempts,
  questions,
  questionVersions,
  questionOptions,
  subjects,
  academicLevels,
  curriculumNodes,
  caseStudies
} from "@/db/schema";
import { eq, and, asc, inArray, isNull, isNotNull, sql, SQL } from "drizzle-orm";
import { getActiveStudentAttempt, getDescendantNodeIds } from "@/domains/academics/services";

export interface PracticeQuestion {
  id: string; // question ID
  questionVersionId: string;
  questionText: string;
  difficulty: string;
  questionType: string;
  correctAnswer: string;
  explanation: string | null;
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
  status: string; // 'IN_PROGRESS' | 'COMPLETED'
  practiceMode: string; // 'QUESTION' | 'CASE_STUDY'
  levelName: string;
  subjectName: string | null;
  curriculumNodeName: string | null;
  currentNumber: number; // 1-indexed (used for progress indicator)
  totalQuestions: number;
  currentQuestion: PracticeQuestion | null;
  questions: PracticeQuestion[]; // Loaded stable session questions
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
 */
export async function getAvailableQuestionsCount(
  levelId: string,
  subjectId?: string | null,
  curriculumNodeId?: string | null,
  practiceMode: string = "QUESTION",
  difficulty: string | null = "ANY",
  questionType: string | null = "MCQ"
): Promise<number> {
  const queryConditions: SQL[] = [eq(questions.academicLevelId, levelId)];

  if (subjectId) {
    queryConditions.push(eq(questions.subjectId, subjectId));
  }

  if (curriculumNodeId) {
    const descendantIds = await getDescendantNodeIds(curriculumNodeId);
    if (descendantIds.length > 0) {
      queryConditions.push(inArray(questions.curriculumNodeId, descendantIds));
    }
  }

  if (difficulty && difficulty !== "ANY") {
    queryConditions.push(eq(questions.difficulty, difficulty));
  }

  if (practiceMode === "CASE_STUDY") {
    // Return the count of distinct case studies available
    queryConditions.push(isNotNull(questions.caseStudyId));
    
    const dbQuestions = await db
      .select({ caseStudyId: questions.caseStudyId })
      .from(questions)
      .innerJoin(questionVersions, and(eq(questions.id, questionVersions.questionId), eq(questionVersions.isActive, true)))
      .where(and(...queryConditions));

    const distinctCaseIds = new Set(dbQuestions.map((q) => q.caseStudyId).filter(Boolean));
    return distinctCaseIds.size;
  } else {
    // Return count of standalone questions
    queryConditions.push(isNull(questions.caseStudyId));
    if (questionType) {
      queryConditions.push(eq(questions.questionType, questionType));
    }

    const dbQuestions = await db
      .select({ id: questions.id })
      .from(questions)
      .innerJoin(questionVersions, and(eq(questions.id, questionVersions.questionId), eq(questionVersions.isActive, true)))
      .where(and(...queryConditions));

    return dbQuestions.length;
  }
}

/**
 * Starts a new practice session for a student based on active attempt and config filters.
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

  // 2. Validate and adjust question count against availability
  const available = await getAvailableQuestionsCount(
    activeAttempt.levelId,
    subjectId,
    curriculumNodeId,
    practiceMode,
    difficulty,
    questionType
  );

  if (available === 0) {
    throw new Error("No matching questions found in the syllabus library for this selection.");
  }

  const cappedCount = Math.min(questionCount, available);

  // 3. Insert practice session config snapshot
  const [session] = await db
    .insert(practiceSessions)
    .values({
      studentProfileId,
      academicLevelId: activeAttempt.levelId,
      subjectId: subjectId || null,
      curriculumNodeId: curriculumNodeId || null,
      examAttemptId: activeAttempt.examAttemptId || null,
      status: "IN_PROGRESS",
      practiceMode,
      difficulty: difficulty || "ANY",
      questionType: questionType || "MCQ",
      questionCount: cappedCount,
    })
    .returning();

  return session;
}

/**
 * Resolves the full current state of a practice session dynamically from attempts logs.
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

  // 2. Query questions matching the persistent configuration
  const queryConditions: SQL[] = [eq(questions.academicLevelId, session.academicLevelId)];
  if (session.subjectId) {
    queryConditions.push(eq(questions.subjectId, session.subjectId));
  }
  if (session.curriculumNodeId) {
    const descendantIds = await getDescendantNodeIds(session.curriculumNodeId);
    if (descendantIds.length > 0) {
      queryConditions.push(inArray(questions.curriculumNodeId, descendantIds));
    }
  }
  if (session.difficulty && session.difficulty !== "ANY") {
    queryConditions.push(eq(questions.difficulty, session.difficulty));
  }

  interface DbQuestionRow {
    id: string;
    difficulty: string;
    questionType: string;
    versionId: string;
    questionText: string;
    correctAnswer: string;
    explanation: string | null;
    subjectName: string;
    curriculumNodeName: string;
    caseStudyId: string | null;
    caseStudyTitle: string | null;
    caseStudyScenarioText: string | null;
  }

  let dbQuestions: DbQuestionRow[] = [];

  if (session.practiceMode === "CASE_STUDY") {
    queryConditions.push(isNotNull(questions.caseStudyId));
    
    // Resolve case studies first, ordered deterministically
    const allCases = await db
      .selectDistinct({ id: caseStudies.id, createdAt: caseStudies.createdAt })
      .from(caseStudies)
      .innerJoin(questions, eq(questions.caseStudyId, caseStudies.id))
      .innerJoin(questionVersions, and(eq(questions.id, questionVersions.questionId), eq(questionVersions.isActive, true)))
      .where(and(...queryConditions))
      .orderBy(asc(caseStudies.createdAt), asc(caseStudies.id));

    const selectedCases = allCases.slice(0, session.questionCount || 1);
    const selectedCaseIds = selectedCases.map((c) => c.id);

    if (selectedCaseIds.length > 0) {
      dbQuestions = await db
        .select({
          id: questions.id,
          difficulty: questions.difficulty,
          questionType: questions.questionType,
          versionId: questionVersions.id,
          questionText: questionVersions.questionText,
          correctAnswer: questionVersions.correctAnswer,
          explanation: questionVersions.explanation,
          subjectName: subjects.name,
          curriculumNodeName: curriculumNodes.name,
          caseStudyId: questions.caseStudyId,
          caseStudyTitle: caseStudies.title,
          caseStudyScenarioText: caseStudies.scenarioText,
        })
        .from(questions)
        .innerJoin(questionVersions, and(eq(questions.id, questionVersions.questionId), eq(questionVersions.isActive, true)))
        .innerJoin(caseStudies, eq(questions.caseStudyId, caseStudies.id))
        .innerJoin(subjects, eq(questions.subjectId, subjects.id))
        .innerJoin(curriculumNodes, eq(questions.curriculumNodeId, curriculumNodes.id))
        .where(inArray(questions.caseStudyId, selectedCaseIds))
        .orderBy(asc(questions.caseStudyId), asc(questions.createdAt), asc(questions.id));
    }
  } else {
    // Normal Question mode
    queryConditions.push(isNull(questions.caseStudyId));
    if (session.questionType) {
      queryConditions.push(eq(questions.questionType, session.questionType));
    }

    dbQuestions = await db
      .select({
        id: questions.id,
        difficulty: questions.difficulty,
        questionType: questions.questionType,
        versionId: questionVersions.id,
        questionText: questionVersions.questionText,
        correctAnswer: questionVersions.correctAnswer,
        explanation: questionVersions.explanation,
        subjectName: subjects.name,
        curriculumNodeName: curriculumNodes.name,
        caseStudyId: sql<string | null>`NULL`,
        caseStudyTitle: sql<string | null>`NULL`,
        caseStudyScenarioText: sql<string | null>`NULL`,
      })
      .from(questions)
      .innerJoin(questionVersions, and(eq(questions.id, questionVersions.questionId), eq(questionVersions.isActive, true)))
      .innerJoin(subjects, eq(questions.subjectId, subjects.id))
      .innerJoin(curriculumNodes, eq(questions.curriculumNodeId, curriculumNodes.id))
      .where(and(...queryConditions))
      .orderBy(asc(questions.createdAt), asc(questions.id))
      .limit(session.questionCount || 10);
  }

  // 3. Query options in parallel
  const questionVersionIds = dbQuestions.map((q) => q.versionId);
  const optionsMap = new Map<string, { id: string; optionLetter: string; optionText: string }[]>();

  if (questionVersionIds.length > 0) {
    const allOptions = await db
      .select()
      .from(questionOptions)
      .where(inArray(questionOptions.questionVersionId, questionVersionIds))
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

  // Map database flat rows to typed PracticeQuestions
  const sessionQuestions: PracticeQuestion[] = dbQuestions.map((q) => ({
    id: q.id,
    questionVersionId: q.versionId,
    questionText: q.questionText,
    difficulty: q.difficulty,
    questionType: q.questionType,
    correctAnswer: q.correctAnswer,
    explanation: q.explanation,
    subjectName: q.subjectName,
    curriculumNodeName: q.curriculumNodeName,
    caseStudyId: q.caseStudyId,
    caseStudyTitle: q.caseStudyTitle,
    caseStudyScenarioText: q.caseStudyScenarioText,
    options: optionsMap.get(q.versionId) || [],
  }));

  const totalQuestions = sessionQuestions.length;

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

  // Determine current progression state
  const attemptsCount = attemptsList.length;
  const isCompleted = attemptsCount >= totalQuestions || session.status === "COMPLETED";

  // If session is complete but status wasn't updated, update it in DB
  if (isCompleted && session.status !== "COMPLETED") {
    await db
      .update(practiceSessions)
      .set({
        status: "COMPLETED",
        completedAt: new Date(),
      })
      .where(eq(practiceSessions.id, sessionId));
  }

  // Current question is the first unanswered question in the stable list
  const answeredVersionIds = new Set(attemptsList.map((a) => a.questionVersionId));
  const currentQuestion = !isCompleted
    ? sessionQuestions.find((q) => !answeredVersionIds.has(q.questionVersionId)) || null
    : null;

  // Calculate current 1-indexed number for progression UI
  const currentNumber = isCompleted ? totalQuestions : attemptsCount + 1;

  // Calculate summary metrics
  const correctCount = attemptsList.filter((a) => a.isCorrect).length;
  const incorrectCount = attemptsCount - correctCount;
  const accuracy = attemptsCount > 0 ? Math.round((correctCount / attemptsCount) * 100) : 0;

  return {
    sessionId: session.id,
    status: isCompleted ? "COMPLETED" : "IN_PROGRESS",
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

  if (session.status === "COMPLETED") {
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

  // Compare selected answer to correct answer
  const isCorrect = version.correctAnswer.toUpperCase() === selectedAnswer.toUpperCase();

  // 3. Record attempt in database
  const [attempt] = await db
    .insert(practiceAttempts)
    .values({
      practiceSessionId: sessionId,
      questionVersionId,
      selectedAnswer: selectedAnswer.toUpperCase(),
      isCorrect,
      timeSpentSeconds: 0, // Placeholder
    })
    .returning();

  // 4. Update session status if we hit the limit
  const state = await getPracticeSessionState(sessionId, studentProfileId);

  return {
    attemptId: attempt.id,
    isCorrect,
    correctAnswer: version.correctAnswer,
    explanation: version.explanation,
    isSessionCompleted: state.status === "COMPLETED",
  };
}
