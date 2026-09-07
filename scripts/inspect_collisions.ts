import { db } from "../src/db";
import { importedQuestions, questionVersions } from "../src/db/schema";
import { eq } from "drizzle-orm";
import { withRetry } from "../src/domains/questions/import/services";
import { CanonicalQuestionJson } from "../src/domains/questions/import/types";

async function main() {
  console.log("=== INSPECTING COLLIDING / PENDING_REVIEW QUESTIONS ===");
  const pending = await withRetry(() =>
    db.select().from(importedQuestions).where(eq(importedQuestions.status, "PENDING_REVIEW"))
  );

  console.log(`Found ${pending.length} pending review questions.`);

  for (const q of pending) {
    console.log(`\n--------------------------------------------------`);
    console.log(`Staged Question ID: ${q.id}`);
    console.log(`Batch ID: ${q.batchId}`);
    console.log(`Question Index: #${q.questionIndex}`);
    console.log(`Duplicate Match Reason: ${q.duplicateMatchReason}`);
    console.log(`Duplicate Candidate Question ID: ${q.duplicateCandidateQuestionId}`);
    console.log(`Duplicate Candidate Version ID: ${q.duplicateCandidateVersionId}`);
    const payload = (q.rawPayload as unknown as CanonicalQuestionJson) || {};
    console.log(`Question Text: ${payload.questionText}`);
    console.log(`Options:`, payload.options);
    console.log(`Correct Answer: ${payload.correctAnswer}`);

    if (q.duplicateCandidateVersionId) {
      const [candidateVer] = await withRetry(() =>
        db
          .select()
          .from(questionVersions)
          .where(eq(questionVersions.id, q.duplicateCandidateVersionId!))
      );
      if (candidateVer) {
        console.log(`\n[Live Colliding Question Version]:`);
        console.log(`Live Version Text: ${candidateVer.questionText}`);
        console.log(`Live Correct Answer: ${candidateVer.correctAnswer}`);
      }
    }
  }
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
