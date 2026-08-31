"use server";

import { currentUser } from "@clerk/nextjs/server";
import { getOrCreateStudentProfile } from "@/domains/auth/services";
import {
  importTestJson
} from "@/domains/tests/import-service";
import {
  getAvailableTests,
  startTestAttempt,
  getTestAttemptState,
  saveAnswerState,
  pauseAttempt,
  resumeAttempt,
  submitTestAttempt
} from "@/domains/tests/services";
import { revalidatePath } from "next/cache";

/**
 * Resolves authenticated user profile.
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
 * Verifies that the authenticated user is an authorized administrator.
 */
async function ensureAdminUser() {
  const user = await currentUser();
  if (!user) {
    throw new Error("Access denied. Unauthorized access.");
  }
  const role = user.publicMetadata?.role;
  const isAdmin = user.publicMetadata?.isAdmin;
  const email = user.emailAddresses[0]?.emailAddress || "";

  // Allow admin metadata, isAdmin flag, or official domain emails
  if (role !== "admin" && isAdmin !== true && !email.endsWith("@capreppro.com")) {
    throw new Error("Access denied. Only authorized administrators can import tests.");
  }
  return getOrCreateStudentProfile(user.id, email);
}

/**
 * Import an admin-authored assessment test from JSON.
 * Restricted to administrators only.
 */
export async function importTestJsonAction(json: unknown) {
  try {
    await ensureAdminUser();
    const result = await importTestJson(json);
    revalidatePath("/tests");
    return { success: true, testId: result.testId };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Assessment import failed.",
    };
  }
}

/**
 * Retrieves list of available tests and the student's attempt statuses.
 */
export async function getAvailableTestsAction() {
  try {
    const profile = await getAuthProfile();
    const testsList = await getAvailableTests(profile.id);
    return { success: true, tests: testsList };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to load practice tests catalogue.",
    };
  }
}

/**
 * Starts a new test attempt.
 */
export async function startTestAttemptAction(testId: string) {
  try {
    const profile = await getAuthProfile();
    const attemptId = await startTestAttempt(profile.id, testId);
    revalidatePath("/tests");
    return { success: true, attemptId };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to initiate practice assessment attempt.",
    };
  }
}

/**
 * Fetches the active status, questions, options, and timer state for an attempt.
 */
export async function getTestAttemptStateAction(attemptId: string) {
  try {
    const profile = await getAuthProfile();
    const state = await getTestAttemptState(attemptId, profile.id);
    return {
      success: true,
      attempt: state.attempt,
      test: state.test,
      questions: state.questions,
      timeRemainingSeconds: state.timeRemainingSeconds,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to load assessment runner environment.",
    };
  }
}

/**
 * Saves answer changes inline.
 */
export async function saveAnswerStateAction(
  attemptId: string,
  questionVersionId: string,
  selectedAnswer: string | null,
  markedForReview: boolean,
  timeSpentSeconds: number
) {
  try {
    const profile = await getAuthProfile();
    await saveAnswerState(
      profile.id,
      attemptId,
      questionVersionId,
      selectedAnswer,
      markedForReview,
      timeSpentSeconds
    );
    return { success: true };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Connection issue: Failed to record answer save.",
    };
  }
}

/**
 * Pauses the test.
 */
export async function pauseAttemptAction(attemptId: string) {
  try {
    const profile = await getAuthProfile();
    await pauseAttempt(profile.id, attemptId);
    revalidatePath(`/tests/${attemptId}`);
    return { success: true };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to pause assessment.",
    };
  }
}

/**
 * Resumes the test.
 */
export async function resumeAttemptAction(attemptId: string) {
  try {
    const profile = await getAuthProfile();
    await resumeAttempt(profile.id, attemptId);
    revalidatePath(`/tests/${attemptId}`);
    return { success: true };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to resume assessment.",
    };
  }
}

/**
 * Finalizes and submits the test.
 */
export async function submitTestAttemptAction(attemptId: string) {
  try {
    const profile = await getAuthProfile();
    const result = await submitTestAttempt(profile.id, attemptId);
    revalidatePath("/tests");
    revalidatePath(`/tests/${attemptId}`);
    revalidatePath(`/tests/${attemptId}/results`);
    return { success: true, score: result.score };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to submit assessment.",
    };
  }
}
