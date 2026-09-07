import { db } from "../src/db";
import { importBatches, importedQuestions, importAuditEvents } from "../src/db/schema";
import { eq, and, ne, like } from "drizzle-orm";
import { publishAllApprovedBatches } from "../src/domains/questions/import/services";

async function main() {
  console.log("=== APPROVING & PUBLISHING 2025 MTP BATCHES ===");

  // 1. Fetch only MTP batches
  const batches = await db
    .select()
    .from(importBatches)
    .where(like(importBatches.batchName, "%Official Model Test Papers 2025%"));

  console.log(`Found ${batches.length} MTP batches:`);
  for (const b of batches) {
    console.log(`- [${b.id}] ${b.batchName} (${b.totalQuestions} questions)`);
  }

  // 2. Bulk approve all valid, mapped questions in each MTP batch
  for (const b of batches) {
    // Only approve non-exact duplicates (i.e. NO_DUPLICATE or POTENTIAL_DUPLICATE if reviewed)
    // For MTP questions, if it's an EXACT_DUPLICATE of an existing study material question,
    // we should reject or keep staged so we don't pollute live question bank with duplicates!
    
    // Auto-approve NO_DUPLICATE & POTENTIAL_DUPLICATE (< 95%) that are valid and mapped
    await db
      .update(importedQuestions)
      .set({
        status: "APPROVED",
        reviewedBy: "admin@caprep.pro",
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(importedQuestions.batchId, b.id),
          eq(importedQuestions.status, "PENDING_REVIEW"),
          ne(importedQuestions.validationStatus, "INVALID"),
          ne(importedQuestions.curriculumMappingStatus, "UNMAPPED"),
          ne(importedQuestions.duplicateStatus, "EXACT_DUPLICATE")
        )
      );

    // If any questions are EXACT_DUPLICATE, reject them with reason DUPLICATE_QUESTION
    await db
      .update(importedQuestions)
      .set({
        status: "REJECTED",
        rejectionReason: "DUPLICATE_QUESTION",
        rejectionNotes: "Exact question text and options match existing Study Material question in Question Bank.",
        reviewedBy: "admin@caprep.pro",
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(importedQuestions.batchId, b.id),
          eq(importedQuestions.status, "PENDING_REVIEW"),
          eq(importedQuestions.duplicateStatus, "EXACT_DUPLICATE")
        )
      );

    // Recalculate batch statistics
    const allQuestions = await db
      .select({
        status: importedQuestions.status,
        validationStatus: importedQuestions.validationStatus,
        duplicateStatus: importedQuestions.duplicateStatus,
      })
      .from(importedQuestions)
      .where(eq(importedQuestions.batchId, b.id));

    const total = allQuestions.length;
    const validCount = allQuestions.filter((q) => q.validationStatus !== "INVALID").length;
    const invalidCount = allQuestions.filter((q) => q.validationStatus === "INVALID").length;
    const duplicateCount = allQuestions.filter((q) => q.duplicateStatus !== "NO_DUPLICATE").length;
    const approvedCount = allQuestions.filter((q) => q.status === "APPROVED").length;
    const rejectedCount = allQuestions.filter((q) => q.status === "REJECTED").length;
    const publishedCount = allQuestions.filter((q) => q.status === "PUBLISHED").length;
    const pendingReviewCount = allQuestions.filter((q) => q.status === "PENDING_REVIEW").length;

    let batchStatus = "PENDING_REVIEW";
    if (publishedCount > 0 && publishedCount === total) {
      batchStatus = "COMPLETED";
    } else if (publishedCount > 0 || approvedCount > 0) {
      batchStatus = "PARTIALLY_APPROVED";
    }

    await db
      .update(importBatches)
      .set({
        totalQuestions: total,
        validQuestionsCount: validCount,
        invalidQuestionsCount: invalidCount,
        duplicateCandidatesCount: duplicateCount,
        approvedCount,
        rejectedCount,
        publishedCount,
        pendingReviewCount,
        status: batchStatus,
        updatedAt: new Date(),
      })
      .where(eq(importBatches.id, b.id));

    console.log(`  Batch [${b.batchName}] -> Approved: ${approvedCount}, Rejected: ${rejectedCount}, Total: ${total}`);
  }

  // 3. Publish all approved questions to live Question Bank
  console.log("\nPublishing all approved questions into live Question Bank...");
  const pubResult = await publishAllApprovedBatches("admin@caprep.pro");
  console.log("\n✓ Publish Result:", pubResult);
}

main().catch((err) => {
  console.error("Failed to approve and publish MTP batches:", err);
  process.exit(1);
});
