import * as React from "react";
import { requireAdmin } from "@/domains/auth/admin";
import { getQuestionReviewQueueData } from "@/domains/questions/review/services";
import { ReviewQueueFilterParams } from "@/domains/questions/review/types";
import { QuestionReviewClient } from "./review-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Question Bank Review Queue - Admin Console - CA Prep Pro",
  description: "Operational review queue and deterministic intelligence for CA Prep Pro Question Bank.",
};

interface AdminReviewPageProps {
  searchParams: Promise<{
    level?: string;
    reason?: string;
    severity?: string;
    subject?: string;
    version?: string;
    reviewStatus?: string;
    usage?: string;
    q?: string;
    sortBy?: "severity" | "created" | "usage" | "version" | "subject";
    sortOrder?: "asc" | "desc";
    sort?: "severity" | "created" | "usage" | "version" | "subject";
    order?: "asc" | "desc";
    page?: string;
    pageSize?: string;
  }>;
}

export default async function AdminReviewPage({ searchParams }: AdminReviewPageProps) {
  await requireAdmin();

  const resolvedParams = await searchParams;

  const filterParams: ReviewQueueFilterParams = {
    levelCode: resolvedParams.level || "INTERMEDIATE",
    attentionReason: resolvedParams.reason,
    severity: resolvedParams.severity,
    subjectId: resolvedParams.subject,
    curriculumVersionId: resolvedParams.version,
    reviewStatus: resolvedParams.reviewStatus,
    usageState: resolvedParams.usage,
    searchQuery: resolvedParams.q,
    sortBy: resolvedParams.sortBy || resolvedParams.sort || "severity",
    sortOrder: resolvedParams.sortOrder || resolvedParams.order || "desc",
    page: resolvedParams.page ? parseInt(resolvedParams.page, 10) : 1,
    pageSize: resolvedParams.pageSize ? parseInt(resolvedParams.pageSize, 10) : 20,
  };

  const initialData = await getQuestionReviewQueueData(filterParams);

  return <QuestionReviewClient initialData={initialData} currentFilters={filterParams} />;
}
