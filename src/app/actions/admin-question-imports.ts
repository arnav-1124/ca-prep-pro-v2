"use server";

import { requireAdmin } from "@/domains/auth/admin";
import {
  createImportBatch,
  approveImportedQuestion,
  rejectImportedQuestion,
  editImportedQuestion,
  publishApprovedQuestions,
  bulkApproveBatchQuestions,
} from "@/domains/questions/import/services";
import {
  QuestionSourceType,
  RejectionReason,
  EditQuestionPayload,
} from "@/domains/questions/import/types";
import { revalidatePath } from "next/cache";

export interface ServerActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

function revalidateImportPaths(batchId?: string) {
  revalidatePath("/admin/questions");
  revalidatePath("/admin/questions/imports");
  if (batchId) {
    revalidatePath(`/admin/questions/imports/${batchId}`);
  }
  revalidatePath("/practice");
  revalidatePath("/tests");
}

/**
 * Server Action to upload and process a new raw question import batch.
 */
export async function createImportBatchAction(params: {
  rawJsonString: string;
  batchName?: string;
  academicLevelId: string;
  curriculumVersionId: string;
  subjectId?: string;
  sourceType?: QuestionSourceType;
  sourceTitle?: string;
  sourceYear?: number;
  sourceMonth?: number;
}): Promise<ServerActionResult<{ batchId: string; totalQuestions: number; validCount: number; duplicateCandidatesCount: number }>> {
  try {
    const admin = await requireAdmin();

    const result = await createImportBatch({
      ...params,
      adminEmail: admin.email,
    });

    revalidateImportPaths(result.batchId);

    return {
      success: true,
      data: result,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to process question import batch.";
    return {
      success: false,
      error: errorMsg,
    };
  }
}

/**
 * Server Action to approve a single imported question.
 */
export async function approveImportedQuestionAction(params: {
  batchId: string;
  importedQuestionId: string;
  expectedUpdatedAt?: string | Date;
}): Promise<ServerActionResult> {
  try {
    const admin = await requireAdmin();

    await approveImportedQuestion(params.importedQuestionId, admin.email, params.expectedUpdatedAt);

    revalidateImportPaths(params.batchId);

    return { success: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to approve question.";
    return {
      success: false,
      error: errorMsg,
    };
  }
}

/**
 * Server Action to reject an imported question.
 */
export async function rejectImportedQuestionAction(params: {
  batchId: string;
  importedQuestionId: string;
  rejectionReason: RejectionReason;
  rejectionNotes?: string;
  expectedUpdatedAt?: string | Date;
}): Promise<ServerActionResult> {
  try {
    const admin = await requireAdmin();

    await rejectImportedQuestion(
      params.importedQuestionId,
      params.rejectionReason,
      params.rejectionNotes,
      admin.email,
      params.expectedUpdatedAt
    );

    revalidateImportPaths(params.batchId);

    return { success: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to reject question.";
    return {
      success: false,
      error: errorMsg,
    };
  }
}

/**
 * Server Action to save human edits to an imported question.
 */
export async function editImportedQuestionAction(params: {
  batchId: string;
  importedQuestionId: string;
  editData: EditQuestionPayload;
  expectedUpdatedAt?: string | Date;
}): Promise<ServerActionResult> {
  try {
    const admin = await requireAdmin();

    await editImportedQuestion(params.importedQuestionId, params.editData, admin.email, params.expectedUpdatedAt);

    revalidateImportPaths(params.batchId);

    return { success: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to save question edits.";
    return {
      success: false,
      error: errorMsg,
    };
  }
}

/**
 * Server Action to publish all approved questions in a batch.
 */
export async function publishApprovedQuestionsAction(params: {
  batchId: string;
}): Promise<ServerActionResult<{ publishedCount: number }>> {
  try {
    const admin = await requireAdmin();

    const result = await publishApprovedQuestions(params.batchId, admin.email);

    revalidateImportPaths(params.batchId);

    return {
      success: true,
      data: result,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to publish approved questions.";
    return {
      success: false,
      error: errorMsg,
    };
  }
}

/**
 * Server Action to bulk approve all valid questions in a batch.
 */
export async function bulkApproveBatchAction(params: {
  batchId: string;
}): Promise<ServerActionResult<{ approvedCount: number; newlyApprovedCount: number }>> {
  try {
    const admin = await requireAdmin();

    const result = await bulkApproveBatchQuestions(params.batchId, admin.email);

    revalidateImportPaths(params.batchId);

    return {
      success: true,
      data: result,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to bulk approve batch questions.";
    return {
      success: false,
      error: errorMsg,
    };
  }
}

