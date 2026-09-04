"use server";

import { currentUser } from "@clerk/nextjs/server";
import { getOrCreateStudentProfile } from "@/domains/auth/services";
import {
  createPracticeSession,
  getNextPracticeQuestion,
  getCurrentPracticeQuestion,
  abandonPracticeSession,
  getPracticeSessionState,
  submitAnswer,
  getAvailableQuestionsCount,
  CreatePracticeSessionInput,
} from "@/domains/practice/services";
import { getOrGenerateExplanation, checkExplanationQuota } from "@/domains/ai/services";
import { getCurriculumNodes, getActiveStudentAttempt } from "@/domains/academics/services";

/**
 * Helper to resolve authenticated user profile or throw an error.
 */
async function getAuthProfile() {
  const user = await currentUser();
  if (!user) {
    throw new Error("You must be signed in to perform this action.");
  }
  const email = user.emailAddresses[0]?.emailAddress || "";
  return getOrCreateStudentProfile(user.id, email);
}

/**
 * Action to create a new deterministic practice session and deliver Question 1.
 */
export async function createPracticeSessionAction(input: CreatePracticeSessionInput) {
  try {
    const profile = await getAuthProfile();
    const result = await createPracticeSession(profile.id, input);
    return {
      success: true as const,
      sessionId: result.sessionId,
      firstQuestion: result.firstQuestion,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to create practice session.";
    return { success: false as const, error: msg };
  }
}

/**
 * Legacy/convenience wrapper action to start a new practice session based on active attempt.
 */
export async function startSessionAction(
  subjectId?: string | null,
  curriculumNodeId?: string | null,
  practiceMode: string = "QUESTION",
  difficulty: string | null = "ANY",
  questionType: string | null = "MCQ",
  questionCount: number = 10
) {
  try {
    const profile = await getAuthProfile();
    const activeAttempt = await getActiveStudentAttempt(profile.id);
    if (!activeAttempt) {
      return { success: false as const, error: "No active preparation level selected." };
    }

    const result = await createPracticeSession(profile.id, {
      academicLevelId: activeAttempt.levelId,
      subjectId: subjectId || null,
      curriculumNodeId: curriculumNodeId || null,
      practiceMode: practiceMode === "CASE_STUDY" ? "CASE_STUDY" : "QUESTION",
      difficulty: difficulty === "EASY" || difficulty === "MEDIUM" || difficulty === "HARD" ? difficulty : "ANY",
      questionType: questionType === "CASE_STUDY" ? "CASE_STUDY" : "MCQ",
      requestedQuestionCount: questionCount,
    });

    return {
      success: true as const,
      sessionId: result.sessionId,
      firstQuestion: result.firstQuestion,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to start practice session.";
    return { success: false as const, error: msg };
  }
}

/**
 * Action to deliver the next practice question deterministically.
 */
export async function getNextQuestionAction(sessionId: string) {
  try {
    const profile = await getAuthProfile();
    const result = await getNextPracticeQuestion(profile.id, sessionId);
    return { success: true as const, ...result };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to deliver next practice question.";
    return { success: false as const, error: msg };
  }
}

/**
 * Action to retrieve the current delivered question and session details.
 */
export async function getCurrentQuestionAction(sessionId: string) {
  try {
    const profile = await getAuthProfile();
    const result = await getCurrentPracticeQuestion(profile.id, sessionId);
    return { success: true as const, ...result };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to retrieve practice question.";
    return { success: false as const, error: msg };
  }
}

/**
 * Action to abandon a practice session.
 */
export async function abandonSessionAction(sessionId: string) {
  try {
    const profile = await getAuthProfile();
    await abandonPracticeSession(profile.id, sessionId);
    return { success: true as const };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to abandon practice session.";
    return { success: false as const, error: msg };
  }
}

/**
 * Action to retrieve the current state of a practice session (backward-compatible).
 */
export async function getPracticeStateAction(sessionId: string) {
  try {
    const profile = await getAuthProfile();
    const state = await getPracticeSessionState(sessionId, profile.id);
    return { success: true as const, state };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load practice session.";
    return { success: false as const, error: msg };
  }
}

/**
 * Action to submit an answer choice.
 */
export async function submitAnswerAction(
  sessionId: string,
  questionVersionId: string,
  selectedAnswer: string
) {
  try {
    const profile = await getAuthProfile();
    const result = await submitAnswer(profile.id, sessionId, questionVersionId, selectedAnswer);
    return { success: true as const, result };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to submit answer.";
    return { success: false as const, error: msg };
  }
}

/**
 * Action to resolve an AI explanation for a practice question version.
 */
export async function getExplanationAction(sessionId: string, questionVersionId: string) {
  try {
    const profile = await getAuthProfile();
    const result = await getOrGenerateExplanation(profile.id, sessionId, questionVersionId);
    return {
      success: true as const,
      explanation: result.explanation,
      keyPoint: result.keyPoint,
      fromCache: result.fromCache,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to generate explanation.";
    const isQuota = msg.includes("limit") || msg.includes("quota");
    let limitDetails = null;

    try {
      const profile = await getAuthProfile();
      const quota = await checkExplanationQuota(profile.id);
      limitDetails = {
        limit: quota.limit,
        used: quota.used,
        plan: profile.plan,
        name: profile.email.split("@")[0],
      };
    } catch {}

    return {
      success: false as const,
      error: msg,
      isQuotaExceeded: isQuota,
      limitDetails,
    };
  }
}

/**
 * Action to check the student's daily explanation quota.
 */
export async function checkQuotaAction() {
  try {
    const profile = await getAuthProfile();
    const quota = await checkExplanationQuota(profile.id);
    return { success: true as const, quota };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load AI usage quota.";
    return { success: false as const, error: msg };
  }
}

/**
 * Action to fetch the available matching questions count dynamically.
 */
export async function getAvailableQuestionsCountAction(
  levelId: string,
  subjectId?: string | null,
  curriculumNodeId?: string | null,
  practiceMode: string = "QUESTION",
  difficulty: string | null = "ANY",
  questionType: string | null = "MCQ"
) {
  try {
    const count = await getAvailableQuestionsCount(
      levelId,
      subjectId,
      curriculumNodeId,
      practiceMode,
      difficulty,
      questionType
    );
    return { success: true as const, count };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to get questions count.";
    return { success: false as const, error: msg, count: 0 };
  }
}

/**
 * Action to fetch curriculum nodes for a subject.
 */
export async function getCurriculumNodesAction(subjectId: string, versionId: string) {
  try {
    await getAuthProfile();
    const nodes = await getCurriculumNodes(subjectId, versionId);
    return { success: true as const, nodes };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load curriculum nodes.";
    return { success: false as const, error: msg, nodes: [] };
  }
}
