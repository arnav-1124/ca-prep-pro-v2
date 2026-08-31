import * as React from "react";
import { requireAdmin } from "@/domains/auth/admin";
import { getAdminQuestionBankData, QuestionBankFilterParams } from "@/domains/questions/services";
import { QuestionsExplorerClient } from "./questions-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Question Bank Explorer - Admin Console - CA Prep Pro",
  description: "Explore and audit the CA Prep Pro Question Bank and curriculum mappings.",
};

interface AdminQuestionsPageProps {
  searchParams: Promise<{
    level?: string;
    version?: string;
    subject?: string;
    node?: string;
    type?: string;
    difficulty?: string;
    source?: string;
    status?: string;
    q?: string;
    sortBy?: "content" | "curriculum" | "difficulty" | "type" | "status" | "created";
    sortOrder?: "asc" | "desc";
    sort?: "content" | "curriculum" | "difficulty" | "type" | "status" | "created";
    order?: "asc" | "desc";
    page?: string;
    pageSize?: string;
  }>;
}

export default async function AdminQuestionsPage({ searchParams }: AdminQuestionsPageProps) {
  await requireAdmin();

  const resolvedParams = await searchParams;

  const filterParams: QuestionBankFilterParams = {
    levelCode: resolvedParams.level || "INTERMEDIATE",
    curriculumVersionId: resolvedParams.version,
    subjectId: resolvedParams.subject,
    curriculumNodeId: resolvedParams.node,
    questionType: resolvedParams.type,
    difficulty: resolvedParams.difficulty,
    sourceType: resolvedParams.source,
    status: resolvedParams.status,
    searchQuery: resolvedParams.q,
    sortBy: resolvedParams.sortBy || resolvedParams.sort || "created",
    sortOrder: resolvedParams.sortOrder || resolvedParams.order || "desc",
    page: resolvedParams.page ? parseInt(resolvedParams.page, 10) : 1,
    pageSize: resolvedParams.pageSize ? parseInt(resolvedParams.pageSize, 10) : 20,
  };

  const initialData = await getAdminQuestionBankData(filterParams);

  return <QuestionsExplorerClient initialData={initialData} currentFilters={filterParams} />;
}
