"use server";

import { currentUser } from "@clerk/nextjs/server";
import { getOrCreateStudentProfile } from "@/domains/auth/services";
import {
  startPracticeSession,
  getPracticeSessionState,
  submitAnswer,
  getAvailableQuestionsCount
} from "@/domains/practice/services";
import { getOrGenerateExplanation, checkExplanationQuota } from "@/domains/ai/services";
import { getCurriculumNodes } from "@/domains/academics/services";

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
 * Action to start a new practice session.
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
    const session = await startPracticeSession(
      profile.id,
      subjectId,
      curriculumNodeId,
      practiceMode,
      difficulty,
      questionType,
      questionCount
    );
    return { success: true, sessionId: session.id };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to start practice session.";
    return { success: false, error: msg };
  }
}

/**
 * Action to retrieve the current state of a practice session.
 */
export async function getPracticeStateAction(sessionId: string) {
  try {
    const profile = await getAuthProfile();
    const state = await getPracticeSessionState(sessionId, profile.id);
    return { success: true, state };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load practice session.";
    return { success: false, error: msg };
  }
}

/**
 * Action to submit an answer.
 */
export async function submitAnswerAction(
  sessionId: string,
  questionVersionId: string,
  selectedAnswer: string
) {
  try {
    const profile = await getAuthProfile();
    const result = await submitAnswer(profile.id, sessionId, questionVersionId, selectedAnswer);
    return { success: true, result };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to submit answer.";
    return { success: false, error: msg };
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
      success: true,
      explanation: result.explanation,
      keyPoint: result.keyPoint,
      fromCache: result.fromCache
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
        name: profile.email.split("@")[0]
      };
    } catch {}

    return {
      success: false,
      error: msg,
      isQuotaExceeded: isQuota,
      limitDetails
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
    return { success: true, quota };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load AI usage quota.";
    return { success: false, error: msg };
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
    return { success: true, count };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to get questions count.";
    return { success: false, error: msg, count: 0 };
  }
}

/**
 * Action to fetch curriculum nodes for a subject.
 */
export async function getCurriculumNodesAction(subjectId: string, versionId: string) {
  try {
    await getAuthProfile();
    const nodes = await getCurriculumNodes(subjectId, versionId);
    return { success: true, nodes };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load curriculum nodes.";
    return { success: false, error: msg, nodes: [] };
  }
}

