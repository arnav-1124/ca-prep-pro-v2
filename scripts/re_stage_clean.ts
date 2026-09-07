import { db } from "../src/db";
import { importBatches, importedQuestions } from "../src/db/schema";
import { inArray, eq } from "drizzle-orm";

async function main() {
  const batchNamesToDelete = [
    "CA Foundation Paper 1: Accounting (All 11 Chapters)",
    "CA Foundation Paper 2: Business Laws (All 7 Chapters)",
    "CA Foundation Paper 3: Business Mathematics (Part 1: Ch 1 to 4)",
    "CA Foundation Paper 3: Business Mathematics (Part 2: Ch 5 to 6)",
    "CA Foundation Paper 3: Business Mathematics (Part 3: Ch 7 to 8)",
  ];

  const batches = await db.select().from(importBatches).where(inArray(importBatches.batchName, batchNamesToDelete));
  console.log(`Found ${batches.length} unapproved batches to clear and re-stage:`, batches.map(b => b.batchName));

  for (const b of batches) {
    await db.delete(importedQuestions).where(eq(importedQuestions.batchId, b.id));
    await db.delete(importBatches).where(eq(importBatches.id, b.id));
    console.log(`Cleared batch ${b.id}`);
  }

  console.log("Cleanup complete!");
}

main().catch(console.error);
