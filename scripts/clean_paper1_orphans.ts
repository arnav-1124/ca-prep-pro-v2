import { db } from "../src/db";
import { questions, questionVersions, questionOptions, importedQuestions, questionSources } from "../src/db/schema";
import { eq, and, notInArray, inArray } from "drizzle-orm";
import { withRetry } from "../src/domains/questions/import/services";

async function main() {
  const paper1SubjectId = "1811547c-0dec-4215-bc4d-1888e232a23f";
  const activeBatchId = "9f4255ad-9b08-470a-9a06-314154b17783";

  // 1. Get valid published question IDs from the active Paper 1 batch
  const validStaged = await withRetry(() =>
    db
      .select({ pubId: importedQuestions.publishedQuestionId })
      .from(importedQuestions)
      .where(eq(importedQuestions.batchId, activeBatchId))
  );

  const validPubIds = validStaged.map((s) => s.pubId).filter(Boolean) as string[];
  console.log(`Valid published questions in active batch: ${validPubIds.length}`);

  // 2. Query all live questions for Paper 1
  const allPaper1Questions = await withRetry(() =>
    db
      .select({ id: questions.id })
      .from(questions)
      .where(eq(questions.subjectId, paper1SubjectId))
  );
  console.log(`Total live questions in Paper 1: ${allPaper1Questions.length}`);

  const orphanQuestionIds = allPaper1Questions
    .map((q) => q.id)
    .filter((id) => !validPubIds.includes(id));

  console.log(`Found ${orphanQuestionIds.length} orphaned questions to clean up.`);

  if (orphanQuestionIds.length === 0) {
    console.log("No orphaned questions found. Exiting.");
    return;
  }

  // 3. Delete orphans in chunks of 50
  for (let c = 0; c < orphanQuestionIds.length; c += 50) {
    const qChunk = orphanQuestionIds.slice(c, c + 50);

    const vRows = await withRetry(() =>
      db
        .select({ id: questionVersions.id })
        .from(questionVersions)
        .where(inArray(questionVersions.questionId, qChunk))
    );
    const vIds = vRows.map((vr) => vr.id);

    if (vIds.length > 0) {
      // Unlink duplicate candidate references in importedQuestions if any
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

  const finalCount = await db.$count(questions, eq(questions.subjectId, paper1SubjectId));
  console.log(`✓ Cleanup complete! Final live questions for Paper 1: ${finalCount}`);
}

main().catch(console.error).finally(() => process.exit(0));
