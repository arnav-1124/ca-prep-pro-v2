"use server";

import { revalidatePath } from "next/cache";
import { createStudentAttempt, getAvailableExamAttempts } from "./services";

/**
 * Server action to submit onboarding CA level and custom target date.
 */
export async function submitOnboardingAction(
  studentProfileId: string,
  academicLevelId: string,
  targetDate: Date | null
) {
  if (!studentProfileId || !academicLevelId) {
    throw new Error("Missing studentProfileId or academicLevelId");
  }
  await createStudentAttempt(studentProfileId, academicLevelId, targetDate);
  revalidatePath("/dashboard");
}

/**
 * Server action to fetch available attempts mapped to a selected level.
 */
export async function fetchAttemptsForLevelAction(academicLevelId: string) {
  if (!academicLevelId) return [];
  return getAvailableExamAttempts(academicLevelId);
}
