import { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/domains/auth/admin";
import {
  getImportBatchDetailData,
  getImportedQuestionReviewDetail,
} from "@/domains/questions/import/services";
import { BatchReviewClient } from "./review-client";

export const metadata: Metadata = {
  title: "Question Batch Review Workspace | Admin Console — CA Prep Pro",
  description: "One-by-one human review, editing, curriculum verification, and publishing workspace.",
};

interface BatchReviewPageProps {
  params: Promise<{ batchId: string }>;
  searchParams: Promise<{ qId?: string; index?: string; filter?: string }>;
}

export default async function BatchReviewPage(props: BatchReviewPageProps) {
  await requireAdmin();

  const params = await props.params;
  const searchParams = await props.searchParams;

  const batchId = params.batchId;
  const questionId = searchParams.qId;
  const questionIndex = searchParams.index ? parseInt(searchParams.index, 10) : undefined;
  const filter = searchParams.filter || "ALL";

  // 1. Fetch Batch Summary
  const batchData = await getImportBatchDetailData(batchId);
  if (!batchData) {
    notFound();
  }

  // 2. Fetch Review Detail for the current Question
  const reviewDetail = await getImportedQuestionReviewDetail(batchId, questionId, questionIndex);

  return (
    <BatchReviewClient
      batch={batchData.batch}
      reviewDetail={reviewDetail}
      currentFilter={filter}
    />
  );
}
