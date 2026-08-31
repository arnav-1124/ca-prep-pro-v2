import { db } from "@/db";
import {
  tests,
  testQuestions,
  testAttempts,
  testAnswers,
  questions,
  questionVersions,
  questionOptions,
  subjects,
  curriculumNodes,
  curriculumVersions,
  studentAttempts,
  caseStudies
} from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { checkTestAttemptAllowance } from "../billing/entitlements";

export interface TestMetadata {
  id: string;
  code: string;
  title: string;
  description: string | null;
  durationMinutes: number;
  totalMarks: number;
  subjectName: string | null;
  chapterName: string | null;
  questionsCount: number;
  attemptsCount: number;
  bestScore: number | null;
  status: "START" | "CONTINUE" | "RETAKE";
  activeAttemptId: string | null;
}

export interface RunnerQuestion {
  id: string;
  questionVersionId: string;
  questionText: string;
  options: { optionLetter: string; optionText: string }[];
  caseStudyId: string | null;
  caseStudyTitle: string | null;
  caseStudyScenarioText: string | null;
  selectedAnswer: string | null;
  markedForReview: boolean;
  isCorrect?: boolean | null;
  correctAnswer?: string;
  explanation?: string | null;
  sortOrder: number;
}

function shuffle<T>(array: T[]): T[] {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Checks the dynamic free test attempt limit for a test.
 * A free plan student gets up to 2 attempts per curriculum chapter (or per test for mixed).
 */
export async function canStudentAttemptTest(
  studentProfileId: string,
  testId: string
): Promise<{ allowed: boolean; reason?: string }> {
  const result = await checkTestAttemptAllowance(studentProfileId, testId);
  return {
    allowed: result.allowed,
    reason: result.reason,
  };
}

/**
 * Resolves available tests mapped to the student's active level and curriculum version.
 */
export async function getAvailableTests(studentProfileId: string): Promise<TestMetadata[]> {
  // 1. Resolve student's active level
  const [activeAttempt] = await db
    .select({ academicLevelId: studentAttempts.academicLevelId, examAttemptId: studentAttempts.examAttemptId })
    .from(studentAttempts)
    .where(and(eq(studentAttempts.studentProfileId, studentProfileId), eq(studentAttempts.isActive, true)))
    .limit(1);

  if (!activeAttempt) return [];

  // Resolve active curriculum version
  const [curriculumVer] = await db
    .select({ id: curriculumVersions.id })
    .from(curriculumVersions)
    .where(and(eq(curriculumVersions.academicLevelId, activeAttempt.academicLevelId), eq(curriculumVersions.isActive, true)))
    .limit(1);

  if (!curriculumVer) return [];

  // 2. Fetch all active tests for level/version
  const dbTests = await db
    .select({
      id: tests.id,
      code: tests.code,
      title: tests.title,
      description: tests.description,
      durationMinutes: tests.durationMinutes,
      totalMarks: tests.totalMarks,
      subjectId: tests.subjectId,
      curriculumNodeId: tests.curriculumNodeId,
    })
    .from(tests)
    .where(and(eq(tests.academicLevelId, activeAttempt.academicLevelId), eq(tests.isActive, true)));

  // Resolve subjects & nodes for name mappings
  const dbSubjects = await db.select({ id: subjects.id, name: subjects.name }).from(subjects);
  const dbNodes = await db.select({ id: curriculumNodes.id, name: curriculumNodes.name }).from(curriculumNodes);

  // Fetch student attempts on these tests
  const studentAttemptsList = await db
    .select({
      id: testAttempts.id,
      testId: testAttempts.testId,
      status: testAttempts.status,
      score: testAttempts.score,
    })
    .from(testAttempts)
    .where(eq(testAttempts.studentProfileId, studentProfileId));

  // Resolve questions count per test
  const questionLinks = await db
    .select({ testId: testQuestions.testId })
    .from(testQuestions);

  const testsList: TestMetadata[] = [];

  for (const t of dbTests) {
    const sub = dbSubjects.find((s) => s.id === t.subjectId);
    const node = dbNodes.find((n) => n.id === t.curriculumNodeId);
    const qCount = questionLinks.filter((l) => l.testId === t.id).length;

    const attempts = studentAttemptsList.filter((a) => a.testId === t.id);
    const bestScore = attempts.reduce<number | null>((best, a) => {
      if (a.score === null) return best;
      return best === null ? a.score : Math.max(best, a.score);
    }, null);

    // Determine current status
    const activeAttempt = attempts.find((a) => a.status === "STARTED" || a.status === "PAUSED");
    let status: "START" | "CONTINUE" | "RETAKE" = "START";
    let activeAttemptId: string | null = null;

    if (activeAttempt) {
      status = "CONTINUE";
      activeAttemptId = activeAttempt.id;
    } else if (attempts.length > 0) {
      status = "RETAKE";
    }

    testsList.push({
      id: t.id,
      code: t.code,
      title: t.title,
      description: t.description,
      durationMinutes: t.durationMinutes,
      totalMarks: t.totalMarks,
      subjectName: sub?.name || null,
      chapterName: node?.name || null,
      questionsCount: qCount,
      attemptsCount: attempts.length,
      bestScore,
      status,
      activeAttemptId,
    });
  }

  return testsList;
}

/**
 * Starts a new test attempt, randomizing presentation arrays and saving state.
 */
export async function startTestAttempt(studentProfileId: string, testId: string): Promise<string> {
  // 1. Verify attempt limit
  const limitCheck = await canStudentAttemptTest(studentProfileId, testId);
  if (!limitCheck.allowed) {
    throw new Error(limitCheck.reason || "Attempt limit reached.");
  }

  // 2. Fetch test definition
  const [test] = await db
    .select({ id: tests.id, examAttemptId: tests.examAttemptId })
    .from(tests)
    .where(eq(tests.id, testId))
    .limit(1);

  if (!test) throw new Error("Test does not exist.");

  // 3. Resolve questions in test
  const qLinks = await db
    .select({ questionId: testQuestions.questionId })
    .from(testQuestions)
    .where(eq(testQuestions.testId, testId))
    .orderBy(testQuestions.sortOrder);

  if (qLinks.length === 0) {
    throw new Error("This assessment contains no questions.");
  }

  const questionIds = qLinks.map((l) => l.questionId);

  // Retrieve active question versions and options
  const questionRecords = await db
    .select({
      id: questions.id,
      versionId: questionVersions.id,
    })
    .from(questions)
    .innerJoin(questionVersions, eq(questions.id, questionVersions.questionId))
    .where(and(inArray(questions.id, questionIds), eq(questionVersions.isActive, true)));

  // Fetch options for option ordering randomization
  const versionIds = questionRecords.map((r) => r.versionId);
  const optionsList = await db
    .select({
      questionVersionId: questionOptions.questionVersionId,
      optionLetter: questionOptions.optionLetter,
    })
    .from(questionOptions)
    .where(inArray(questionOptions.questionVersionId, versionIds));

  // 4. Perform presentation randomizations
  // Randomize question presentation order
  const randomizedQuestionOrder = shuffle(questionIds);

  // Randomize option letters layout map
  const randomizedOptionOrdering: Record<string, string[]> = {};
  for (const qvId of versionIds) {
    const qOptions = optionsList.filter((o) => o.questionVersionId === qvId);
    const letters = qOptions.map((o) => o.optionLetter);
    randomizedOptionOrdering[qvId] = shuffle(letters);
  }

  // 5. Insert attempt context row
  const [attempt] = await db
    .insert(testAttempts)
    .values({
      testId,
      studentProfileId,
      examAttemptId: test.examAttemptId || null,
      status: "STARTED",
      startedAt: new Date(),
      randomizedQuestionOrder,
      randomizedOptionOrdering,
    })
    .returning();

  // Idempotently create blank answers placeholders
  const answersToCreate = questionRecords.map((r) => ({
    testAttemptId: attempt.id,
    questionVersionId: r.versionId,
    selectedAnswer: null,
    isCorrect: null,
    markedForReview: false,
    timeSpentSeconds: 0,
  }));

  await db.insert(testAnswers).values(answersToCreate);

  return attempt.id;
}

/**
 * Retreives active running state or completed results for a test attempt.
 * Evaluates active timers and triggers automatic finalization if expired.
 */
export async function getTestAttemptState(
  attemptId: string,
  studentProfileId: string
): Promise<{
  attempt: typeof testAttempts.$inferSelect;
  test: typeof tests.$inferSelect;
  questions: RunnerQuestion[];
  timeRemainingSeconds: number;
}> {
  // 1. Fetch attempt and test metadata
  const [attempt] = await db
    .select()
    .from(testAttempts)
    .where(and(eq(testAttempts.id, attemptId), eq(testAttempts.studentProfileId, studentProfileId)))
    .limit(1);

  if (!attempt) throw new Error("Attempt context not found.");

  const [test] = await db
    .select()
    .from(tests)
    .where(eq(tests.id, attempt.testId))
    .limit(1);

  if (!test) throw new Error("Assessment definition not found.");

  // 2. Evaluate timer and handle automatic finalizations
  let status = attempt.status;
  let activeTimeElapsedMs = 0;

  if (status === "STARTED") {
    activeTimeElapsedMs = Date.now() - attempt.startedAt.getTime() - attempt.totalPausedTimeSeconds * 1000;
  } else if (status === "PAUSED") {
    activeTimeElapsedMs = (attempt.pausedAt ? attempt.pausedAt.getTime() : Date.now()) - attempt.startedAt.getTime() - attempt.totalPausedTimeSeconds * 1000;
  } else {
    // Completed
    activeTimeElapsedMs = (attempt.completedAt ? attempt.completedAt.getTime() : Date.now()) - attempt.startedAt.getTime() - attempt.totalPausedTimeSeconds * 1000;
  }

  const durationMs = test.durationMinutes * 60 * 1000;
  if ((status === "STARTED" || status === "PAUSED") && activeTimeElapsedMs >= durationMs) {
    // Auto submit expired attempts
    const exactExpirationTime = new Date(attempt.startedAt.getTime() + durationMs + attempt.totalPausedTimeSeconds * 1000);
    await autoSubmitExpiredAttempt(attemptId, test.totalMarks, exactExpirationTime);
    attempt.status = "COMPLETED";
    attempt.completedAt = exactExpirationTime;
    status = "COMPLETED";
    activeTimeElapsedMs = durationMs;
  }

  const timeRemainingSeconds = status === "COMPLETED"
    ? 0
    : Math.max(0, Math.ceil((durationMs - activeTimeElapsedMs) / 1000));

  // 3. Fetch questions and student's answers
  const answers = await db
    .select()
    .from(testAnswers)
    .where(eq(testAnswers.testAttemptId, attemptId));

  const versionIds = answers.map((a) => a.questionVersionId);

  const dbQuestions = await db
    .select({
      id: questions.id,
      versionId: questionVersions.id,
      questionText: questionVersions.questionText,
      correctAnswer: questionVersions.correctAnswer,
      explanation: questionVersions.explanation,
      caseStudyId: questions.caseStudyId,
      caseStudyTitle: caseStudies.title,
      caseStudyScenarioText: caseStudies.scenarioText,
    })
    .from(questionVersions)
    .innerJoin(questions, eq(questionVersions.questionId, questions.id))
    .leftJoin(caseStudies, eq(questions.caseStudyId, caseStudies.id))
    .where(inArray(questionVersions.id, versionIds));

  // Fetch all options
  const dbOptions = await db
    .select({
      questionVersionId: questionOptions.questionVersionId,
      optionLetter: questionOptions.optionLetter,
      optionText: questionOptions.optionText,
    })
    .from(questionOptions)
    .where(inArray(questionOptions.questionVersionId, versionIds));

  // 4. Map questions to saved randomized order
  const randQOrder = attempt.randomizedQuestionOrder as string[];
  const randOptOrdering = attempt.randomizedOptionOrdering as Record<string, string[]>;

  const mappedQuestions: RunnerQuestion[] = dbQuestions.map((q) => {
    const ans = answers.find((a) => a.questionVersionId === q.versionId)!;
    const qOptions = dbOptions.filter((o) => o.questionVersionId === q.versionId);

    // Apply saved option ordering layout
    const savedOrder = randOptOrdering[q.versionId] || [];
    if (savedOrder.length > 0) {
      qOptions.sort((a, b) => savedOrder.indexOf(a.optionLetter) - savedOrder.indexOf(b.optionLetter));
    }

    const item: RunnerQuestion = {
      id: q.id,
      questionVersionId: q.versionId,
      questionText: q.questionText,
      options: qOptions.map((o) => ({ optionLetter: o.optionLetter, optionText: o.optionText })),
      caseStudyId: q.caseStudyId,
      caseStudyTitle: q.caseStudyTitle,
      caseStudyScenarioText: q.caseStudyScenarioText,
      selectedAnswer: ans.selectedAnswer,
      markedForReview: ans.markedForReview,
      sortOrder: randQOrder.indexOf(q.id) + 1,
    };

    // Client score shielding: only expose correctness, workings, and explanations if attempt is completed
    if (status === "COMPLETED") {
      item.isCorrect = ans.isCorrect;
      item.correctAnswer = q.correctAnswer;
      item.explanation = q.explanation;
    }

    return item;
  });

  // Sort based on randomized order
  mappedQuestions.sort((a, b) => a.sortOrder - b.sortOrder);

  return {
    attempt,
    test,
    questions: mappedQuestions,
    timeRemainingSeconds,
  };
}

/**
 * Saves answer updates (selected option, review status, and elapsed duration).
 */
export async function saveAnswerState(
  studentProfileId: string,
  attemptId: string,
  questionVersionId: string,
  selectedAnswer: string | null,
  markedForReview: boolean,
  timeSpentSeconds: number
) {
  // 1. Verify owner and active status
  const [attempt] = await db
    .select({ id: testAttempts.id, status: testAttempts.status, testId: testAttempts.testId, startedAt: testAttempts.startedAt, totalPausedTimeSeconds: testAttempts.totalPausedTimeSeconds })
    .from(testAttempts)
    .where(and(eq(testAttempts.id, attemptId), eq(testAttempts.studentProfileId, studentProfileId)))
    .limit(1);

  if (!attempt) throw new Error("Attempt not found.");
  
  const [test] = await db
    .select({ durationMinutes: tests.durationMinutes, totalMarks: tests.totalMarks })
    .from(tests)
    .where(eq(tests.id, attempt.testId))
    .limit(1);

  // Check expiration
  const durationMs = test.durationMinutes * 60 * 1000;
  const activeTimeElapsed = Date.now() - attempt.startedAt.getTime() - attempt.totalPausedTimeSeconds * 1000;
  if (activeTimeElapsed >= durationMs) {
    const exactExpirationTime = new Date(attempt.startedAt.getTime() + durationMs + attempt.totalPausedTimeSeconds * 1000);
    await autoSubmitExpiredAttempt(attemptId, test.totalMarks, exactExpirationTime);
    throw new Error("Time expired. Assessment automatically submitted.");
  }

  if (attempt.status !== "STARTED") {
    throw new Error("Answers can only be modified in active started attempts.");
  }

  // 2. Save state (without calculating correctness)
  await db
    .update(testAnswers)
    .set({
      selectedAnswer,
      markedForReview,
      timeSpentSeconds,
    })
    .where(and(eq(testAnswers.testAttemptId, attemptId), eq(testAnswers.questionVersionId, questionVersionId)));

  return { success: true };
}

/**
 * Pauses an active assessment.
 */
export async function pauseAttempt(studentProfileId: string, attemptId: string) {
  const [attempt] = await db
    .select({ status: testAttempts.status })
    .from(testAttempts)
    .where(and(eq(testAttempts.id, attemptId), eq(testAttempts.studentProfileId, studentProfileId)))
    .limit(1);

  if (!attempt || attempt.status !== "STARTED") {
    throw new Error("Only active started attempts can be paused.");
  }

  await db
    .update(testAttempts)
    .set({
      status: "PAUSED",
      pausedAt: new Date(),
    })
    .where(eq(testAttempts.id, attemptId));

  return { success: true };
}

/**
 * Resumes a paused assessment, calculating paused time.
 */
export async function resumeAttempt(studentProfileId: string, attemptId: string) {
  const [attempt] = await db
    .select({ status: testAttempts.status, pausedAt: testAttempts.pausedAt, totalPausedTimeSeconds: testAttempts.totalPausedTimeSeconds })
    .from(testAttempts)
    .where(and(eq(testAttempts.id, attemptId), eq(testAttempts.studentProfileId, studentProfileId)))
    .limit(1);

  if (!attempt || attempt.status !== "PAUSED") {
    throw new Error("Only paused attempts can be resumed.");
  }

  const pauseDurationMs = Date.now() - (attempt.pausedAt ? attempt.pausedAt.getTime() : Date.now());
  const extraPauseSeconds = Math.max(0, Math.floor(pauseDurationMs / 1000));

  await db
    .update(testAttempts)
    .set({
      status: "STARTED",
      pausedAt: null,
      totalPausedTimeSeconds: attempt.totalPausedTimeSeconds + extraPauseSeconds,
    })
    .where(eq(testAttempts.id, attemptId));

  return { success: true };
}

/**
 * Manually submits the assessment, running final scoring and correctness checks.
 */
export async function submitTestAttempt(studentProfileId: string, attemptId: string) {
  // 1. Verify owner
  const [attempt] = await db
    .select({ id: testAttempts.id, status: testAttempts.status, testId: testAttempts.testId })
    .from(testAttempts)
    .where(and(eq(testAttempts.id, attemptId), eq(testAttempts.studentProfileId, studentProfileId)))
    .limit(1);

  if (!attempt) throw new Error("Attempt context not found.");
  if (attempt.status === "COMPLETED") throw new Error("This attempt is already submitted.");

  const [test] = await db
    .select({ totalMarks: tests.totalMarks })
    .from(tests)
    .where(eq(tests.id, attempt.testId))
    .limit(1);

  // 2. Resolve questions correctness and calculate score
  const answers = await db
    .select({
      id: testAnswers.id,
      selectedAnswer: testAnswers.selectedAnswer,
      questionVersionId: testAnswers.questionVersionId,
    })
    .from(testAnswers)
    .where(eq(testAnswers.testAttemptId, attemptId));

  const versionIds = answers.map((a) => a.questionVersionId);
  const qVersions = await db
    .select({ id: questionVersions.id, correctAnswer: questionVersions.correctAnswer })
    .from(questionVersions)
    .where(inArray(questionVersions.id, versionIds));

  let correctCount = 0;
  for (const ans of answers) {
    const qv = qVersions.find((v) => v.id === ans.questionVersionId);
    const isCorrect = qv ? ans.selectedAnswer === qv.correctAnswer : false;
    if (isCorrect) {
      correctCount++;
    }

    // Update individual correctness in DB
    await db
      .update(testAnswers)
      .set({ isCorrect })
      .where(eq(testAnswers.id, ans.id));
  }

  // Score = correctCount * (totalMarks / totalQuestions)
  const score = qVersions.length > 0 ? Math.round(correctCount * (test.totalMarks / qVersions.length)) : 0;

  // 3. Finalize attempt status
  await db
    .update(testAttempts)
    .set({
      status: "COMPLETED",
      completedAt: new Date(),
      score,
    })
    .where(eq(testAttempts.id, attemptId));

  return { success: true, score };
}

/**
 * Core automatic submit helper that runs on expired attempts.
 */
async function autoSubmitExpiredAttempt(attemptId: string, totalMarks: number, completedAtDate?: Date) {
  const answers = await db
    .select({ id: testAnswers.id, selectedAnswer: testAnswers.selectedAnswer, questionVersionId: testAnswers.questionVersionId })
    .from(testAnswers)
    .where(eq(testAnswers.testAttemptId, attemptId));

  const finalCompletedAt = completedAtDate || new Date();

  if (answers.length === 0) {
    await db
      .update(testAttempts)
      .set({ status: "COMPLETED", completedAt: finalCompletedAt, score: 0 })
      .where(eq(testAttempts.id, attemptId));
    return;
  }

  const versionIds = answers.map((a) => a.questionVersionId);
  const qVersions = await db
    .select({ id: questionVersions.id, correctAnswer: questionVersions.correctAnswer })
    .from(questionVersions)
    .where(inArray(questionVersions.id, versionIds));

  let correctCount = 0;
  for (const ans of answers) {
    const qv = qVersions.find((v) => v.id === ans.questionVersionId);
    const isCorrect = qv && ans.selectedAnswer ? ans.selectedAnswer === qv.correctAnswer : false;
    if (isCorrect) {
      correctCount++;
    }

    await db
      .update(testAnswers)
      .set({ isCorrect })
      .where(eq(testAnswers.id, ans.id));
  }

  const score = qVersions.length > 0 ? Math.round(correctCount * (totalMarks / qVersions.length)) : 0;

  await db
    .update(testAttempts)
    .set({
      status: "COMPLETED",
      completedAt: finalCompletedAt,
      score,
    })
    .where(eq(testAttempts.id, attemptId));
}
