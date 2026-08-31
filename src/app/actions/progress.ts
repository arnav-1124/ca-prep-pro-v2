"use server";

import { currentUser } from "@clerk/nextjs/server";
import { getOrCreateStudentProfile } from "@/domains/auth/services";
import { getOverallProgress, getSubjectDrillDown } from "@/domains/progress/services";
import { db } from "@/db";
import { studentAttempts, examAttempts } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

/**
 * Helper to resolve authenticated user profile.
 */
async function getAuthProfile() {
  const user = await currentUser();
  if (!user) {
    throw new Error("You must be signed in to access progress reports.");
  }
  const email = user.emailAddresses[0]?.emailAddress || "";
  return getOrCreateStudentProfile(user.id, email);
}

/**
 * Fetches overall preparation statistics and recent attempts history.
 */
export async function getProgressDashboardAction() {
  try {
    const profile = await getAuthProfile();
    const stats = await getOverallProgress(profile.id);
    if (!stats) {
      return { success: true, stats: null, availableExamAttempts: [] };
    }

    // Resolve student's active attempt context to fetch related available exam windows
    const [activeAttempt] = await db
      .select({ academicLevelId: studentAttempts.academicLevelId })
      .from(studentAttempts)
      .where(and(eq(studentAttempts.studentProfileId, profile.id), eq(studentAttempts.isActive, true)))
      .limit(1);

    const availableExamAttempts = activeAttempt
      ? await db
          .select({
            id: examAttempts.id,
            name: examAttempts.name,
            targetDate: examAttempts.targetDate,
          })
          .from(examAttempts)
          .where(and(eq(examAttempts.academicLevelId, activeAttempt.academicLevelId), eq(examAttempts.isActive, true)))
      : [];

    return { success: true, stats, availableExamAttempts };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "We couldn't load your progress right now. Please try again.",
    };
  }
}

/**
 * Fetches the recursive syllabus drilldown metrics for a specific subject/paper.
 */
export async function getSubjectDrillDownAction(subjectId: string) {
  try {
    const profile = await getAuthProfile();
    const tree = await getSubjectDrillDown(profile.id, subjectId);
    return { success: true, tree };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "We couldn't load the syllabus drilldown right now. Please try again.",
    };
  }
}

/**
 * Updates the student's configured target exam attempt and date context.
 */
export async function updateTargetDateAction(
  targetDateStr: string | null,
  examAttemptId: string | null
) {
  try {
    const profile = await getAuthProfile();
    const targetDate = targetDateStr ? new Date(targetDateStr) : null;

    await db
      .update(studentAttempts)
      .set({
        targetDate,
        examAttemptId: examAttemptId || null,
        updatedAt: new Date(),
      })
      .where(and(eq(studentAttempts.studentProfileId, profile.id), eq(studentAttempts.isActive, true)));

    revalidatePath("/progress");
    return { success: true };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to save target exam target context.",
    };
  }
}
