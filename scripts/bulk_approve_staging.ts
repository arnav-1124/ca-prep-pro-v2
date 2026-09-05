import { db } from "../src/db";
import { importBatches, importedQuestions, importAuditEvents } from "../src/db/schema";
import { eq, and, ne } from "drizzle-orm";

async function main() {
  const batches = await db.select().from(importBatches);
  console.log(`Found ${batches.length} batches to bulk approve.`);

  for (const b of batches) {
    console.log(`\nProcessing Batch: [${b.id}] ${b.batchName}`);

    // Update all PENDING_REVIEW questions that are valid and mapped
    await db
      .update(importedQuestions)
      .set({
        status: "APPROVED",
        rejectionReason: null,
        rejectionNotes: null,
        reviewedBy: "admin@caprep.pro",
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(importedQuestions.batchId, b.id),
          eq(importedQuestions.status, "PENDING_REVIEW"),
          ne(importedQuestions.validationStatus, "INVALID"),
          ne(importedQuestions.curriculumMappingStatus, "UNMAPPED")
        )
      );

    // Recalculate batch counts
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
    const pendingReviewCount = allQuestions.filter(
      (q) => q.status === "PENDING_REVIEW" || q.status === "VALIDATION_FAILED"
    ).length;

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

    // Audit event
    await db.insert(importAuditEvents).values({
      batchId: b.id,
      action: "BATCH_BULK_APPROVED",
      performedBy: "admin@caprep.pro",
      details: {
        totalQuestions: total,
        approvedCount,
        pendingReviewCount,
      },
    });

    console.log(`  ✓ Approved: ${approvedCount} / ${total} questions (Pending: ${pendingReviewCount})`);
  }

  console.log("\nAll batches successfully bulk approved!");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Bulk approval failed:", err);
    process.exit(1);
  });
