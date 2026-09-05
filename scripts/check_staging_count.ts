import { db } from "../src/db";
import { importBatches, importedQuestions } from "../src/db/schema";
import { sql } from "drizzle-orm";

async function main() {
  const batches = await db.select().from(importBatches);
  console.log(`Total Batches in DB: ${batches.length}`);
  for (const b of batches) {
    console.log(`  Batch: ${b.id} | ${b.batchName} | Total: ${b.totalQuestions} | Valid: ${b.validQuestionsCount} | Pending: ${b.pendingReviewCount}`);
  }

  const [qCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(importedQuestions);
  console.log(`Total Staged Questions in DB: ${qCount.count}`);

  const breakdown = await db
    .select({
      status: importedQuestions.status,
      validationStatus: importedQuestions.validationStatus,
      mappingStatus: importedQuestions.curriculumMappingStatus,
      count: sql<number>`count(*)`,
    })
    .from(importedQuestions)
    .groupBy(
      importedQuestions.status,
      importedQuestions.validationStatus,
      importedQuestions.curriculumMappingStatus
    );

  console.log("\nStaged Questions Breakdown:");
  for (const row of breakdown) {
    console.log(
      `  Status: ${row.status} | Validation: ${row.validationStatus} | Mapping: ${row.mappingStatus} -> Count: ${row.count}`
    );
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
