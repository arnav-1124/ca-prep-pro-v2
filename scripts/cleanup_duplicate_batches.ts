import { db } from "../src/db";
import {
  importBatches,
  importedQuestions,
  questions,
  questionVersions,
  questionOptions,
  questionSources,
  caseStudies,
  importAuditEvents,
} from "../src/db/schema";
import { eq, and, isNull, inArray } from "drizzle-orm";
import { withRetry } from "../src/domains/questions/import/services";

const BATCH_IDS_TO_REMOVE = [
  "375f809c-1688-4027-a9e1-bd35fd29cc7e", // Old Paper 1 duplicate
  "0a50507c-4bc0-4517-ae78-f241a30da031", // Old Paper 2 duplicate
];

async function cleanupBatch(batchId: string) {
  const [batch] = await withRetry(() =>
    db.select().from(importBatches).where(eq(importBatches.id, batchId)).limit(1)
  );

  if (!batch) {
    console.log(`Batch ${batchId} not found, skipping.`);
    return;
  }

  console.log(`Cleaning duplicate batch: ${batch.batchName} (${batch.id})`);

  const staged = await withRetry(() =>
    db
      .select({ pubId: importedQuestions.publishedQuestionId })
      .from(importedQuestions)
      .where(eq(importedQuestions.batchId, batchId))
  );

  const publishedQIds = staged.map((s) => s.pubId).filter(Boolean) as string[];

  // 1. Unlink publishedQuestionId from importedQuestions
  await withRetry(() =>
    db
      .update(importedQuestions)
      .set({ publishedQuestionId: null, publishedQuestionVersionId: null })
      .where(eq(importedQuestions.batchId, batchId))
  );

  // 2. Find all question sources for this batch
  const batchSources = await withRetry(() =>
    db
      .select({ id: questionSources.id })
      .from(questionSources)
      .where(eq(questionSources.importBatchId, batchId))
  );
  const sourceIds = batchSources.map((s) => s.id);

  // Find any question versions linked to these sources
  let sourceQuestionIds: string[] = [];
  if (sourceIds.length > 0) {
    const vFromSources = await withRetry(() =>
      db
        .select({ questionId: questionVersions.questionId })
        .from(questionVersions)
        .where(inArray(questionVersions.sourceId, sourceIds))
    );
    sourceQuestionIds = vFromSources.map((v) => v.questionId);

    // Unlink sourceId on question_versions before deleting question_sources
    await withRetry(() =>
      db
        .update(questionVersions)
        .set({ sourceId: null })
        .where(inArray(questionVersions.sourceId, sourceIds))
    );
  }

  const allQIdsToDelete = Array.from(new Set([...publishedQIds, ...sourceQuestionIds]));

  // 3. Batch delete questions
  if (allQIdsToDelete.length > 0) {
    console.log(`  Deleting ${allQIdsToDelete.length} duplicate live questions in chunks...`);
    for (let c = 0; c < allQIdsToDelete.length; c += 50) {
      const qChunk = allQIdsToDelete.slice(c, c + 50);
      const vRows = await withRetry(() =>
        db
          .select({ id: questionVersions.id })
          .from(questionVersions)
          .where(inArray(questionVersions.questionId, qChunk))
      );
      const vIds = vRows.map((vr) => vr.id);
      if (vIds.length > 0) {
        // Unlink duplicate candidate references in importedQuestions
        await withRetry(() =>
          db
            .update(importedQuestions)
            .set({ duplicateCandidateVersionId: null })
            .where(inArray(importedQuestions.duplicateCandidateVersionId, vIds))
        );
        await withRetry(() =>
          db
            .update(importedQuestions)
            .set({ duplicateCandidateQuestionId: null })
            .where(inArray(importedQuestions.duplicateCandidateQuestionId, qChunk))
        );

        for (let vc = 0; vc < vIds.length; vc += 50) {
          const vChunk = vIds.slice(vc, vc + 50);
          await withRetry(() =>
            db.delete(questionOptions).where(inArray(questionOptions.questionVersionId, vChunk))
          );
        }
        await withRetry(() =>
          db.delete(questionVersions).where(inArray(questionVersions.id, vIds))
        );
      }
      await withRetry(() => db.delete(questions).where(inArray(questions.id, qChunk)));
    }
  }

  // 4. Clean up staging, sources, audits, batch record
  await withRetry(() => db.delete(importAuditEvents).where(eq(importAuditEvents.batchId, batchId)));
  await withRetry(() => db.delete(importedQuestions).where(eq(importedQuestions.batchId, batchId)));
  await withRetry(() => db.delete(questionSources).where(eq(questionSources.importBatchId, batchId)));
  await withRetry(() => db.delete(importBatches).where(eq(importBatches.id, batchId)));

  console.log(`  ✓ Batch ${batchId} deleted successfully.`);
}

async function main() {
  console.log("=== REMOVING OLD DUPLICATE INTERMEDIATE BATCHES ===");
  for (const bId of BATCH_IDS_TO_REMOVE) {
    await cleanupBatch(bId);
  }
  console.log("✓ Duplicate batches cleaned successfully!\n");
}

main().catch(console.error).finally(() => process.exit(0));
