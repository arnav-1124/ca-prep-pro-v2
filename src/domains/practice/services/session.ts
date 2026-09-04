import { db } from "@/db";
import {
  practiceSessions,
  practiceSessionQuestions,
  academicLevels,
  subjects,
  curriculumNodes,
  questions,
  questionVersions,
  questionOptions,
  caseStudies,
} from "@/db/schema";
import { eq, and, desc, asc } from "drizzle-orm";
import { getActiveCurriculumVersion } from "@/domains/academics/services";
import {
  CreatePracticeSessionInput,
  createPracticeSessionSchema,
  StudentPracticeQuestionDto,
  PracticeSessionDetailsDto,
  NextQuestionResult,
  CurrentQuestionResult,
} from "../types";
import {
  countEligibleQuestions,
  selectNextEligibleQuestion,
  QuestionFilterCriteria,
} from "./selector";

/**
 * Creates a new practice session for an authenticated student with deterministic ordering.
 * Immediately delivers Question 1 to establish session integrity.
 */
export async function createPracticeSession(
  studentProfileId: string,
  input: CreatePracticeSessionInput
): Promise<{ sessionId: string; firstQuestion: StudentPracticeQuestionDto }> {
  // 1. Validate input structure
  const validated = createPracticeSessionSchema.parse(input);

  // 2. Resolve & validate active curriculum version for this academic level
  const activeVersion = await getActiveCurriculumVersion(validated.academicLevelId);
  if (!activeVersion) {
    throw new Error("No active curriculum scheme found for this academic level.");
  }

  // 3. Verify subject if provided
  if (validated.subjectId) {
    const [subj] = await db
      .select({ id: subjects.id, isActive: subjects.isActive, academicLevelId: subjects.academicLevelId })
      .from(subjects)
      .where(eq(subjects.id, validated.subjectId))
      .limit(1);

    if (!subj || !subj.isActive || subj.academicLevelId !== validated.academicLevelId) {
      throw new Error("The selected subject is invalid or inactive for this academic level.");
    }
  }

  // 4. Verify curriculum node if provided
  if (validated.curriculumNodeId) {
    const [node] = await db
      .select({
        id: curriculumNodes.id,
        isActive: curriculumNodes.isActive,
        subjectId: curriculumNodes.subjectId,
        curriculumVersionId: curriculumNodes.curriculumVersionId,
      })
      .from(curriculumNodes)
      .where(eq(curriculumNodes.id, validated.curriculumNodeId))
      .limit(1);

    if (!node || !node.isActive || node.curriculumVersionId !== activeVersion.id) {
      throw new Error("The selected syllabus topic is inactive or not part of the active curriculum.");
    }

    if (validated.subjectId && node.subjectId !== validated.subjectId) {
      throw new Error("The selected topic does not belong to the chosen subject.");
    }
  }

  // 5. Pre-flight question availability check
  const filterCriteria: QuestionFilterCriteria = {
    academicLevelId: validated.academicLevelId,
    curriculumVersionId: activeVersion.id,
    subjectId: validated.subjectId,
    curriculumNodeId: validated.curriculumNodeId,
    practiceMode: validated.practiceMode,
    difficulty: validated.difficulty,
    questionType: validated.questionType,
  };

  const availableCount = await countEligibleQuestions(filterCriteria);
  if (availableCount === 0) {
    throw new Error("No matching practice questions are currently available for this selection.");
  }

  // 6. Cap question count to availability and max limit
  const cappedCount = Math.min(validated.requestedQuestionCount, availableCount);

  // 7. Generate server-side cryptographic session seed (32-bit integer)
  const sessionSeed = Math.floor(Math.random() * 2147483647);

  // 8. Insert practice session
  const [session] = await db
    .insert(practiceSessions)
    .values({
      studentProfileId,
      academicLevelId: validated.academicLevelId,
      curriculumVersionId: activeVersion.id,
      subjectId: validated.subjectId || null,
      curriculumNodeId: validated.curriculumNodeId || null,
      status: "ACTIVE",
      practiceMode: validated.practiceMode,
      difficulty: validated.difficulty,
      questionType: validated.questionType,
      questionCount: cappedCount,
      sessionSeed,
    })
    .returning();

  // 9. Deterministically select and deliver Question 1
  const candidate = await selectNextEligibleQuestion(session.id, sessionSeed, filterCriteria);
  if (!candidate) {
    throw new Error("Failed to initialize session: No eligible question could be selected.");
  }

  const [deliveryRecord] = await db
    .insert(practiceSessionQuestions)
    .values({
      practiceSessionId: session.id,
      questionId: candidate.questionId,
      questionVersionId: candidate.questionVersionId,
      sequenceNumber: 1,
    })
    .returning();

  const firstQuestion: StudentPracticeQuestionDto = {
    sessionQuestionId: deliveryRecord.id,
    sessionId: session.id,
    questionId: candidate.questionId,
    questionVersionId: candidate.questionVersionId,
    sequenceNumber: 1,
    totalQuestions: cappedCount,
    questionType: candidate.questionType,
    difficulty: candidate.difficulty,
    questionText: candidate.questionText,
    options: candidate.options,
    caseStudy: candidate.caseStudyId
      ? {
          id: candidate.caseStudyId,
          title: candidate.caseStudyTitle || "Case Scenario",
          scenarioText: candidate.caseStudyScenarioText || "",
        }
      : null,
    curriculumContext: {
      levelName: candidate.levelName,
      subjectName: candidate.subjectName,
      nodeName: candidate.curriculumNodeName,
    },
    deliveredAt: deliveryRecord.deliveredAt.toISOString(),
  };

  return { sessionId: session.id, firstQuestion };
}

/**
 * Delivers the next question in an active practice session.
 * Enforces session limits, duplicate prevention, and concurrency safety.
 */
export async function getNextPracticeQuestion(
  studentProfileId: string,
  sessionId: string
): Promise<NextQuestionResult> {
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

  const totalQuestions = session.questionCount || 10;

  // If already completed or abandoned, return completion state
  if (session.status === "COMPLETED" || session.status === "ABANDONED") {
    return {
      isCompleted: true,
      question: null,
      deliveredCount: totalQuestions,
      totalQuestions,
      message: "This practice session has ended.",
    };
  }

  // 2. Count delivered questions in this session
  const deliveredRows = await db
    .select({
      id: practiceSessionQuestions.id,
      sequenceNumber: practiceSessionQuestions.sequenceNumber,
    })
    .from(practiceSessionQuestions)
    .where(eq(practiceSessionQuestions.practiceSessionId, sessionId))
    .orderBy(desc(practiceSessionQuestions.sequenceNumber));

  const deliveredCount = deliveredRows.length;

  // 3. Check if session limit is reached
  if (deliveredCount >= totalQuestions) {
    await db
      .update(practiceSessions)
      .set({ status: "COMPLETED", completedAt: new Date(), updatedAt: new Date() })
      .where(eq(practiceSessions.id, sessionId));

    return {
      isCompleted: true,
      question: null,
      deliveredCount,
      totalQuestions,
      message: "You have completed all questions in this session!",
    };
  }

  const nextSequence = deliveredCount + 1;

  // 4. Resolve curriculum version (using session snapshot)
  const curriculumVersionId = session.curriculumVersionId;
  if (!curriculumVersionId) {
    throw new Error("Practice session is missing historical curriculum version reference.");
  }

  const criteria: QuestionFilterCriteria = {
    academicLevelId: session.academicLevelId,
    curriculumVersionId,
    subjectId: session.subjectId,
    curriculumNodeId: session.curriculumNodeId,
    practiceMode: session.practiceMode as "QUESTION" | "CASE_STUDY",
    difficulty: session.difficulty,
    questionType: session.questionType,
  };

  // 5. Select next candidate deterministically
  const candidate = await selectNextEligibleQuestion(session.id, session.sessionSeed, criteria);

  if (!candidate) {
    // Question bank exhausted for this context before hitting limit
    await db
      .update(practiceSessions)
      .set({ status: "COMPLETED", completedAt: new Date(), updatedAt: new Date() })
      .where(eq(practiceSessions.id, sessionId));

    return {
      isCompleted: true,
      question: null,
      deliveredCount,
      totalQuestions,
      message: "No further eligible questions remain in the question bank for this session.",
    };
  }

  // 6. Concurrency-safe delivery insertion
  let deliveryRecord;
  try {
    const [record] = await db
      .insert(practiceSessionQuestions)
      .values({
        practiceSessionId: session.id,
        questionId: candidate.questionId,
        questionVersionId: candidate.questionVersionId,
        sequenceNumber: nextSequence,
      })
      .returning();
    deliveryRecord = record;
  } catch (err: unknown) {
    // If a concurrent request delivered nextSequence at the exact same millisecond,
    // catch the unique constraint collision and safely return the already-delivered record
    const existing = await db
      .select()
      .from(practiceSessionQuestions)
      .where(
        and(
          eq(practiceSessionQuestions.practiceSessionId, session.id),
          eq(practiceSessionQuestions.sequenceNumber, nextSequence)
        )
      )
      .limit(1);

    if (existing[0]) {
      deliveryRecord = existing[0];
    } else {
      throw err;
    }
  }

  const questionDto: StudentPracticeQuestionDto = {
    sessionQuestionId: deliveryRecord.id,
    sessionId: session.id,
    questionId: candidate.questionId,
    questionVersionId: candidate.questionVersionId,
    sequenceNumber: nextSequence,
    totalQuestions,
    questionType: candidate.questionType,
    difficulty: candidate.difficulty,
    questionText: candidate.questionText,
    options: candidate.options,
    caseStudy: candidate.caseStudyId
      ? {
          id: candidate.caseStudyId,
          title: candidate.caseStudyTitle || "Case Scenario",
          scenarioText: candidate.caseStudyScenarioText || "",
        }
      : null,
    curriculumContext: {
      levelName: candidate.levelName,
      subjectName: candidate.subjectName,
      nodeName: candidate.curriculumNodeName,
    },
    deliveredAt: deliveryRecord.deliveredAt.toISOString(),
  };

  return {
    isCompleted: false,
    question: questionDto,
    deliveredCount: nextSequence,
    totalQuestions,
  };
}

/**
 * Retrieves the current delivered question and status for an ongoing practice session.
 */
export async function getCurrentPracticeQuestion(
  studentProfileId: string,
  sessionId: string
): Promise<CurrentQuestionResult> {
  // 1. Fetch practice session and check ownership
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

  // Fetch subject name & node name
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

  // 2. Count delivered questions and find latest
  const deliveredRecords = await db
    .select()
    .from(practiceSessionQuestions)
    .where(eq(practiceSessionQuestions.practiceSessionId, sessionId))
    .orderBy(desc(practiceSessionQuestions.sequenceNumber));

  const totalQuestions = session.questionCount || 10;
  const isCompleted = session.status === "COMPLETED" || session.status === "ABANDONED";

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
    deliveredCount: deliveredRecords.length,
    startedAt: session.startedAt.toISOString(),
    completedAt: session.completedAt ? session.completedAt.toISOString() : null,
  };

  if (isCompleted || deliveredRecords.length === 0) {
    return {
      isCompleted: isCompleted || deliveredRecords.length >= totalQuestions,
      question: null,
      session: sessionDetails,
    };
  }

  // 3. Resolve latest delivered question record
  const latestDelivery = deliveredRecords[0];

  const [versionRow] = await db
    .select({
      versionId: questionVersions.id,
      questionId: questionVersions.questionId,
      questionText: questionVersions.questionText,
      questionType: questions.questionType,
      difficulty: questions.difficulty,
      caseStudyId: questions.caseStudyId,
      caseStudyTitle: caseStudies.title,
      caseStudyScenarioText: caseStudies.scenarioText,
    })
    .from(questionVersions)
    .innerJoin(questions, eq(questionVersions.questionId, questions.id))
    .leftJoin(caseStudies, eq(questions.caseStudyId, caseStudies.id))
    .where(eq(questionVersions.id, latestDelivery.questionVersionId))
    .limit(1);

  if (!versionRow) {
    throw new Error("Delivered question version record is missing.");
  }

  // 4. Fetch options
  const options = await db
    .select({
      id: questionOptions.id,
      optionLetter: questionOptions.optionLetter,
      optionText: questionOptions.optionText,
    })
    .from(questionOptions)
    .where(eq(questionOptions.questionVersionId, versionRow.versionId))
    .orderBy(asc(questionOptions.optionLetter));

  const questionDto: StudentPracticeQuestionDto = {
    sessionQuestionId: latestDelivery.id,
    sessionId: session.id,
    questionId: versionRow.questionId,
    questionVersionId: versionRow.versionId,
    sequenceNumber: latestDelivery.sequenceNumber,
    totalQuestions,
    questionType: (versionRow.questionType as "MCQ" | "CASE_STUDY") || "MCQ",
    difficulty: versionRow.difficulty,
    questionText: versionRow.questionText,
    options,
    caseStudy: versionRow.caseStudyId
      ? {
          id: versionRow.caseStudyId,
          title: versionRow.caseStudyTitle || "Case Scenario",
          scenarioText: versionRow.caseStudyScenarioText || "",
        }
      : null,
    curriculumContext: {
      levelName: session.levelName,
      subjectName,
      nodeName: curriculumNodeName,
    },
    deliveredAt: latestDelivery.deliveredAt.toISOString(),
  };

  return {
    isCompleted: false,
    question: questionDto,
    session: sessionDetails,
  };
}

/**
 * Marks a practice session as abandoned.
 */
export async function abandonPracticeSession(
  studentProfileId: string,
  sessionId: string
): Promise<{ success: boolean }> {
  const [session] = await db
    .select({ id: practiceSessions.id, studentProfileId: practiceSessions.studentProfileId })
    .from(practiceSessions)
    .where(eq(practiceSessions.id, sessionId))
    .limit(1);

  if (!session) {
    throw new Error("Practice session not found.");
  }

  if (session.studentProfileId !== studentProfileId) {
    throw new Error("Unauthorized access to practice session.");
  }

  await db
    .update(practiceSessions)
    .set({ status: "ABANDONED", completedAt: new Date(), updatedAt: new Date() })
    .where(eq(practiceSessions.id, sessionId));

  return { success: true };
}
