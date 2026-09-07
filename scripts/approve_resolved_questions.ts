import { db } from "../src/db";
import { importedQuestions, importBatches } from "../src/db/schema";
import { eq } from "drizzle-orm";
import { recalculateBatchCounts, withRetry } from "../src/domains/questions/import/services";

async function main() {
  console.log("=== APPROVING RESOLVED STAGED QUESTIONS ===");

  const questionIds = [
    "1c9af3ab-fbad-45e9-adfd-51d1aec51bc2", // Econ Part 2 #58
    "243bd62a-8c99-41e2-b8a7-187ab9f2473a", // Math Part 1 #67
  ];

  for (const qId of questionIds) {
    const [q] = await withRetry(() =>
      db.select().from(importedQuestions).where(eq(importedQuestions.id, qId))
    );
    if (!q) {
      console.log(`Question ${qId} not found.`);
      continue;
    }

    console.log(`Updating Question #${q.questionIndex} in batch ${q.batchId}...`);
    await withRetry(() =>
      db
        .update(importedQuestions)
        .set({
          status: "APPROVED",
          duplicateStatus: "NO_DUPLICATE",
          duplicateCandidateQuestionId: null,
          duplicateCandidateVersionId: null,
          duplicateSimilarityScore: 0,
          duplicateMatchReason: null,
          updatedAt: new Date(),
        })
        .where(eq(importedQuestions.id, qId))
    );

    await recalculateBatchCounts(q.batchId);
    console.log(`Batch ${q.batchId} recalculated successfully.`);
  }

  // Verify batches status
  const batchIds = [
    "d2a7651c-af1f-4e18-bb07-9efff7b651fa",
    "fd9ddb26-d120-42f2-bd43-edecf6e58a4b",
  ];

  for (const bId of batchIds) {
    const [b] = await withRetry(() =>
      db.select().from(importBatches).where(eq(importBatches.id, bId))
    );
    console.log(`\nBatch: ${b.batchName}`);
    console.log(`Status: ${b.status}`);
    console.log(`Total: ${b.totalQuestions}, Approved: ${b.approvedCount}, Pending: ${b.pendingReviewCount}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
