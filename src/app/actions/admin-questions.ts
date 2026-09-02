"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/domains/auth/admin";
import { getAdminQuestionDetail, QuestionDetailView } from "@/domains/questions/services";
import {
  updateAdminQuestion,
  toggleQuestionActiveStatus,
  deleteAdminQuestion,
  exportQuestionsToCanonicalBatch,
} from "@/domains/questions/management/services";
import {
  UpdateQuestionInput,
  UpdateQuestionResult,
  DeleteQuestionResult,
  ExportQuestionsInput,
  ExportQuestionsResult,
} from "@/domains/questions/management/types";

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

/**
 * Authoritative administrative server action to edit a question.
 * Enforces optimistic concurrency, curriculum validation, and automatic versioning snapshots
 * when historical practice attempts exist.
 */
export async function updateQuestionAction(
  input: Omit<UpdateQuestionInput, "adminEmail">
): Promise<ServerActionResult<UpdateQuestionResult>> {
  try {
    const admin = await requireAdmin();

    const result = await updateAdminQuestion({
      ...input,
      adminEmail: admin.email,
    });

    revalidatePath("/admin/questions");
    revalidatePath("/practice");
    revalidatePath("/tests");

    return { success: true, data: result };
  } catch (error: unknown) {
    console.error("[Update Question Action Error]", error);
    const message = error instanceof Error ? error.message : "Failed to update question.";
    return { success: false, error: message };
  }
}

/**
 * Authoritative administrative server action to toggle active / retired state.
 */
export async function toggleQuestionStatusAction(
  questionId: string,
  isActive: boolean,
  expectedUpdatedAt?: string | Date
): Promise<ServerActionResult<{ isActive: boolean }>> {
  try {
    const admin = await requireAdmin();

    const result = await toggleQuestionActiveStatus({
      questionId,
      isActive,
      adminEmail: admin.email,
      expectedUpdatedAt,
    });

    revalidatePath("/admin/questions");
    revalidatePath("/practice");
    revalidatePath("/tests");

    return { success: true, data: result };
  } catch (error: unknown) {
    console.error("[Toggle Question Status Action Error]", error);
    const message = error instanceof Error ? error.message : "Failed to toggle question status.";
    return { success: false, error: message };
  }
}

/**
 * Authoritative administrative server action to delete a question.
 * Enforces zero-dependency guardrail. Blocks deletion if historical student practice records exist.
 */
export async function deleteQuestionAction(
  questionId: string
): Promise<ServerActionResult<DeleteQuestionResult>> {
  try {
    const admin = await requireAdmin();

    const result = await deleteAdminQuestion({
      questionId,
      adminEmail: admin.email,
    });

    revalidatePath("/admin/questions");
    revalidatePath("/practice");
    revalidatePath("/tests");

    return { success: true, data: result };
  } catch (error: unknown) {
    console.error("[Delete Question Action Error]", error);
    const message = error instanceof Error ? error.message : "Failed to delete question.";
    return { success: false, error: message };
  }
}

/**
 * Authoritative administrative server action to export Question Bank questions into canonical JSON.
 */
export async function exportQuestionsAction(
  filterParams: ExportQuestionsInput
): Promise<ServerActionResult<ExportQuestionsResult>> {
  try {
    await requireAdmin();

    const result = await exportQuestionsToCanonicalBatch(filterParams);
    return { success: true, data: result };
  } catch (error: unknown) {
    console.error("[Export Questions Action Error]", error);
    const message = error instanceof Error ? error.message : "Failed to export questions.";
    return { success: false, error: message };
  }
}
