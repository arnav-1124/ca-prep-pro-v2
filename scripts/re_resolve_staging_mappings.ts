import { db } from "../src/db";
import { importedQuestions, importBatches } from "../src/db/schema";
import { eq, ne } from "drizzle-orm";
import { buildVersionCurriculumContext, resolveQuestionCurriculum } from "../src/domains/questions/import/mapping";
import { CanonicalQuestionJson } from "../src/domains/questions/import/types";

async function main() {
  console.log("=== RE-RESOLVING CURRICULUM MAPPINGS FOR STAGED QUESTIONS ===");

  const batches = await db.select().from(importBatches).where(ne(importBatches.status, "COMPLETED"));

  for (const b of batches) {
    console.log(`\nBatch: [${b.id}] ${b.batchName}`);
    const ctx = await buildVersionCurriculumContext(b.academicLevelId, b.curriculumVersionId);
    if (!ctx) {
      console.error(`  Could not build context for batch ${b.id}`);
      continue;
    }

    const questions = await db
      .select()
      .from(importedQuestions)
      .where(eq(importedQuestions.batchId, b.id));

    let remapped = 0;
    for (const q of questions) {
      let rawPayload: unknown = q.rawPayload;
      if (typeof rawPayload === "string") {
        try {
          rawPayload = JSON.parse(rawPayload);
        } catch {
          rawPayload = {};
        }
      }
      if (!rawPayload || typeof rawPayload !== "object") {
        rawPayload = {};
      }

      const res = resolveQuestionCurriculum(rawPayload as CanonicalQuestionJson, ctx, b.subjectId);

      if (res.status !== q.curriculumMappingStatus || res.curriculumNodeId !== q.curriculumNodeId) {
        await db
          .update(importedQuestions)
          .set({
            curriculumMappingStatus: res.status,
            curriculumNodeId: res.curriculumNodeId,
            subjectId: res.subjectId,
            updatedAt: new Date(),
          })
          .where(eq(importedQuestions.id, q.id));
        remapped++;
      }
    }

    console.log(`  Processed ${questions.length} questions, re-mapped ${remapped} questions.`);
  }

  console.log("\nDone re-resolving mappings!");
}

main().catch(console.error);
