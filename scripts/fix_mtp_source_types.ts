import { db } from "../src/db";
import { importBatches, questionSources, questions, questionVersions, subjects } from "../src/db/schema";
import { eq, sql, like, or } from "drizzle-orm";

async function main() {
  console.log("=== CHECKING IMPORT BATCHES ===");
  const batches = await db
    .select({
      id: importBatches.id,
      batchName: importBatches.batchName,
      sourceType: importBatches.sourceType,
      sourceTitle: importBatches.sourceTitle,
      totalQuestions: importBatches.totalQuestions,
    })
    .from(importBatches);

  console.table(batches);

  console.log("\n=== UPDATING MTP BATCHES AND QUESTION SOURCES ===");
  
  // Find batches that are MTP based on name or title
  const mtpBatchIds: string[] = [];
  for (const b of batches) {
    const nameLower = (b.batchName || "").toLowerCase();
    const titleLower = (b.sourceTitle || "").toLowerCase();
    if (nameLower.includes("mtp") || titleLower.includes("mtp") || titleLower.includes("model test")) {
      mtpBatchIds.push(b.id);
      console.log(`Identified MTP batch: ${b.batchName} (${b.id}) - current sourceType: ${b.sourceType}`);
    }
  }

  if (mtpBatchIds.length > 0) {
    for (const bId of mtpBatchIds) {
      await db
        .update(importBatches)
        .set({ sourceType: "MTP" })
        .where(eq(importBatches.id, bId));

      await db
        .update(questionSources)
        .set({ sourceType: "MTP" })
        .where(eq(questionSources.importBatchId, bId));
    }
    console.log(`Successfully updated ${mtpBatchIds.length} batches to sourceType = 'MTP'`);
  }

  console.log("\n=== RE-CHECKING SUBJECT AND SOURCE TYPE BREAKDOWN ===");
  const rows = await db
    .select({
      subjectCode: subjects.code,
      subjectName: subjects.name,
      sourceType: questionSources.sourceType,
      count: sql<number>`count(*)`,
    })
    .from(questions)
    .innerJoin(questionVersions, eq(questions.id, questionVersions.questionId))
    .leftJoin(questionSources, eq(questionVersions.sourceId, questionSources.id))
    .innerJoin(subjects, eq(questions.subjectId, subjects.id))
    .groupBy(subjects.code, subjects.name, questionSources.sourceType)
    .orderBy(subjects.code, questionSources.sourceType);

  console.table(rows);
}

main().catch(console.error);
