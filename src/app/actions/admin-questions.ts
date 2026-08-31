"use server";

import { requireAdmin } from "@/domains/auth/admin";
import { getAdminQuestionDetail, QuestionDetailView } from "@/domains/questions/services";

export interface ServerActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Authoritative administrative server action to fetch complete question details,
 * options, version history, scenario text, and reference diagnostics.
 */
export async function fetchQuestionDetailAction(
  questionId: string
): Promise<ServerActionResult<QuestionDetailView>> {
  try {
    await requireAdmin();

    if (!questionId) {
      return { success: false, error: "Question ID is required." };
    }

    const detail = await getAdminQuestionDetail(questionId);
    if (!detail) {
      return { success: false, error: "Question not found." };
    }

    return { success: true, data: detail };
  } catch (error: unknown) {
    console.error("[Fetch Question Detail Action Error]", error);
    const message = error instanceof Error ? error.message : "Failed to load question details.";
    return { success: false, error: message };
  }
}
