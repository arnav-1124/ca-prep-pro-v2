"use server";

import { requireAdmin } from "@/domains/auth/admin";
import {
  createCurriculumVersion,
  updateCurriculumVersion,
  activateCurriculumVersion,
  deactivateCurriculumVersion,
  createCurriculumNode,
  updateCurriculumNode,
  moveCurriculumNode,
  reorderCurriculumNode,
  checkNodeDependencies,
  deleteCurriculumNode,
  createSubject,
  updateSubject,
  reorderSubject,
  deleteSubject,
} from "@/domains/academics/services";
import { revalidatePath } from "next/cache";

export interface ServerActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

function revalidateCurriculumPaths() {
  revalidatePath("/admin/curriculum");
  revalidatePath("/admin/curriculum/versions");
  revalidatePath("/practice");
  revalidatePath("/tests");
  revalidatePath("/progress");
}

/* =========================================================================
   CURRICULUM VERSION ACTIONS
========================================================================= */

export async function createCurriculumVersionAction(params: {
  academicLevelId: string;
  name: string;
  applicableFrom: string; // ISO date string
  applicableTo?: string | null;
  isActive?: boolean;
}): Promise<ServerActionResult> {
  try {
    await requireAdmin();

    if (!params.academicLevelId) {
      return { success: false, error: "Academic level is required." };
    }

    if (!params.name || !params.name.trim()) {
      return { success: false, error: "Curriculum version name is required." };
    }

    const fromDate = new Date(params.applicableFrom);
    if (isNaN(fromDate.getTime())) {
      return { success: false, error: "Invalid applicable-from date." };
    }

    let toDate: Date | null = null;
    if (params.applicableTo) {
      toDate = new Date(params.applicableTo);
      if (isNaN(toDate.getTime())) {
        return { success: false, error: "Invalid applicable-to date." };
      }
      if (toDate < fromDate) {
        return { success: false, error: "Applicable-to date cannot be earlier than applicable-from date." };
      }
    }

    const newVersion = await createCurriculumVersion({
      academicLevelId: params.academicLevelId,
      name: params.name,
      applicableFrom: fromDate,
      applicableTo: toDate,
      isActive: params.isActive,
    });

    revalidateCurriculumPaths();

    return { success: true, data: newVersion };
  } catch (error: unknown) {
    console.error("[Create Curriculum Version Action Error]", error);
    const message = error instanceof Error ? error.message : "Failed to create curriculum version.";
    return { success: false, error: message };
  }
}

export async function updateCurriculumVersionAction(params: {
  id: string;
  name: string;
  applicableFrom: string; // ISO date string
  applicableTo?: string | null;
}): Promise<ServerActionResult> {
  try {
    await requireAdmin();

    if (!params.id) {
      return { success: false, error: "Version ID is required." };
    }

    if (!params.name || !params.name.trim()) {
      return { success: false, error: "Curriculum version name is required." };
    }

    const fromDate = new Date(params.applicableFrom);
    if (isNaN(fromDate.getTime())) {
      return { success: false, error: "Invalid applicable-from date." };
    }

    let toDate: Date | null = null;
    if (params.applicableTo) {
      toDate = new Date(params.applicableTo);
      if (isNaN(toDate.getTime())) {
        return { success: false, error: "Invalid applicable-to date." };
      }
      if (toDate < fromDate) {
        return { success: false, error: "Applicable-to date cannot be earlier than applicable-from date." };
      }
    }

    const updated = await updateCurriculumVersion({
      id: params.id,
      name: params.name,
      applicableFrom: fromDate,
      applicableTo: toDate,
    });

    revalidateCurriculumPaths();

    return { success: true, data: updated };
  } catch (error: unknown) {
    console.error("[Update Curriculum Version Action Error]", error);
    const message = error instanceof Error ? error.message : "Failed to update curriculum version.";
    return { success: false, error: message };
  }
}

export async function activateCurriculumVersionAction(versionId: string): Promise<ServerActionResult> {
  try {
    await requireAdmin();

    if (!versionId) {
      return { success: false, error: "Version ID is required." };
    }

    const result = await activateCurriculumVersion(versionId);
    revalidateCurriculumPaths();

    return { success: true, data: result };
  } catch (error: unknown) {
    console.error("[Activate Curriculum Version Action Error]", error);
    const message = error instanceof Error ? error.message : "Failed to activate curriculum version.";
    return { success: false, error: message };
  }
}

export async function deactivateCurriculumVersionAction(versionId: string): Promise<ServerActionResult> {
  try {
    await requireAdmin();

    if (!versionId) {
      return { success: false, error: "Version ID is required." };
    }

    const result = await deactivateCurriculumVersion(versionId);
    revalidateCurriculumPaths();

    return { success: true, data: result };
  } catch (error: unknown) {
    console.error("[Deactivate Curriculum Version Action Error]", error);
    const message = error instanceof Error ? error.message : "Failed to deactivate curriculum version.";
    return { success: false, error: message };
  }
}

/* =========================================================================
   CURRICULUM NODE ACTIONS
========================================================================= */

export async function createCurriculumNodeAction(params: {
  curriculumVersionId: string;
  subjectId: string;
  parentId?: string | null;
  type: string;
  name: string;
  code: string;
  sortOrder?: number;
  isActive?: boolean;
}): Promise<ServerActionResult> {
  try {
    await requireAdmin();

    if (!params.curriculumVersionId || !params.subjectId) {
      return { success: false, error: "Curriculum version and subject IDs are required." };
    }

    const newNode = await createCurriculumNode(params);
    revalidateCurriculumPaths();

    return { success: true, data: newNode };
  } catch (error: unknown) {
    console.error("[Create Node Action Error]", error);
    const message = error instanceof Error ? error.message : "Failed to create curriculum node.";
    return { success: false, error: message };
  }
}

export async function updateCurriculumNodeAction(params: {
  id: string;
  name: string;
  code: string;
  type: string;
  sortOrder: number;
  isActive: boolean;
}): Promise<ServerActionResult> {
  try {
    await requireAdmin();

    if (!params.id) {
      return { success: false, error: "Node ID is required." };
    }

    const updated = await updateCurriculumNode(params);
    revalidateCurriculumPaths();

    return { success: true, data: updated };
  } catch (error: unknown) {
    console.error("[Update Node Action Error]", error);
    const message = error instanceof Error ? error.message : "Failed to update curriculum node.";
    return { success: false, error: message };
  }
}

export async function moveCurriculumNodeAction(params: {
  nodeId: string;
  targetParentId: string | null;
}): Promise<ServerActionResult> {
  try {
    await requireAdmin();

    if (!params.nodeId) {
      return { success: false, error: "Node ID is required." };
    }

    const result = await moveCurriculumNode(params.nodeId, params.targetParentId);
    revalidateCurriculumPaths();

    return { success: true, data: result.node };
  } catch (error: unknown) {
    console.error("[Move Node Action Error]", error);
    const message = error instanceof Error ? error.message : "Failed to move curriculum node.";
    return { success: false, error: message };
  }
}

export async function reorderCurriculumNodeAction(params: {
  nodeId: string;
  direction: "UP" | "DOWN";
}): Promise<ServerActionResult> {
  try {
    await requireAdmin();

    if (!params.nodeId) {
      return { success: false, error: "Node ID is required." };
    }

    const result = await reorderCurriculumNode(params.nodeId, params.direction);
    revalidateCurriculumPaths();

    return { success: true, data: result };
  } catch (error: unknown) {
    console.error("[Reorder Node Action Error]", error);
    const message = error instanceof Error ? error.message : "Failed to reorder curriculum node.";
    return { success: false, error: message };
  }
}

export async function checkNodeDependenciesAction(nodeId: string): Promise<ServerActionResult> {
  try {
    await requireAdmin();

    if (!nodeId) {
      return { success: false, error: "Node ID is required." };
    }

    const result = await checkNodeDependencies(nodeId);
    return { success: true, data: result };
  } catch (error: unknown) {
    console.error("[Check Dependencies Action Error]", error);
    const message = error instanceof Error ? error.message : "Failed to check node dependencies.";
    return { success: false, error: message };
  }
}

export async function deleteCurriculumNodeAction(nodeId: string): Promise<ServerActionResult> {
  try {
    await requireAdmin();

    if (!nodeId) {
      return { success: false, error: "Node ID is required." };
    }

    const result = await deleteCurriculumNode(nodeId);
    revalidateCurriculumPaths();

    return { success: true, data: result };
  } catch (error: unknown) {
    console.error("[Delete Node Action Error]", error);
    const message = error instanceof Error ? error.message : "Failed to delete curriculum node.";
    return { success: false, error: message };
  }
}

/* =========================================================================
   SUBJECT ACTIONS
========================================================================= */

export async function createSubjectAction(params: {
  academicLevelId: string;
  code: string;
  name: string;
  sortOrder?: number;
  isActive?: boolean;
}): Promise<ServerActionResult> {
  try {
    await requireAdmin();

    if (!params.academicLevelId) {
      return { success: false, error: "Academic level ID is required." };
    }

    const newSubject = await createSubject(params);
    revalidateCurriculumPaths();

    return { success: true, data: newSubject };
  } catch (error: unknown) {
    console.error("[Create Subject Action Error]", error);
    const message = error instanceof Error ? error.message : "Failed to create subject.";
    return { success: false, error: message };
  }
}

export async function updateSubjectAction(params: {
  id: string;
  name: string;
  code: string;
  sortOrder: number;
  isActive: boolean;
}): Promise<ServerActionResult> {
  try {
    await requireAdmin();

    if (!params.id) {
      return { success: false, error: "Subject ID is required." };
    }

    const updated = await updateSubject(params);
    revalidateCurriculumPaths();

    return { success: true, data: updated };
  } catch (error: unknown) {
    console.error("[Update Subject Action Error]", error);
    const message = error instanceof Error ? error.message : "Failed to update subject.";
    return { success: false, error: message };
  }
}

export async function reorderSubjectAction(params: {
  subjectId: string;
  direction: "UP" | "DOWN";
}): Promise<ServerActionResult> {
  try {
    await requireAdmin();

    if (!params.subjectId) {
      return { success: false, error: "Subject ID is required." };
    }

    const result = await reorderSubject(params.subjectId, params.direction);
    revalidateCurriculumPaths();

    return { success: true, data: result };
  } catch (error: unknown) {
    console.error("[Reorder Subject Action Error]", error);
    const message = error instanceof Error ? error.message : "Failed to reorder subject.";
    return { success: false, error: message };
  }
}

export async function deleteSubjectAction(subjectId: string): Promise<ServerActionResult> {
  try {
    await requireAdmin();

    if (!subjectId) {
      return { success: false, error: "Subject ID is required." };
    }

    const result = await deleteSubject(subjectId);
    revalidateCurriculumPaths();

    return { success: true, data: result };
  } catch (error: unknown) {
    console.error("[Delete Subject Action Error]", error);
    const message = error instanceof Error ? error.message : "Failed to delete subject.";
    return { success: false, error: message };
  }
}
