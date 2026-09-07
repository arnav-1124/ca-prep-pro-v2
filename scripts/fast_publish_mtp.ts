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
  curriculumNodes,
} from "../src/db/schema";
import { eq, and, isNull, like, asc } from "drizzle-orm";
import { recalculateBatchCounts } from "../src/domains/questions/import/services";

interface CanonicalQuestionPayload {
  questionType: string;
  questionText: string;
  difficulty: string;
  options: Array<{ letter: string; text: string }>;
  correctAnswer: string;
  explanation?: string;
  caseStudyRef?: string;
  caseStudy?: {
    title: string;
    scenarioText: string;
  };
  externalId?: string;
  pageNumber?: number;
  sourceReference?: string;
  source?: {
    sourceAttempt?: string;
    applicability?: string;
    pageNumber?: number;
    sourceReference?: string;
  };
}

async function fastPublishBatch(batchId: string, adminEmail: string, chunkSize = 25) {
  const [batch] = await db
    .select()
    .from(importBatches)
    .where(eq(importBatches.id, batchId))
    .limit(1);

  if (!batch) {
    throw new Error(`Batch ${batchId} not found.`);
  }

  console.log(`\n========================================`);
  console.log(`Processing Batch: ${batch.batchName}`);
  console.log(`========================================`);

  // 1. Fetch active curriculum nodes for validation & subject resolution
  const activeNodes = await db
    .select({
      id: curriculumNodes.id,
      code: curriculumNodes.code,
      subjectId: curriculumNodes.subjectId,
      isActive: curriculumNodes.isActive,
    })
    .from(curriculumNodes)
    .where(
      and(
        eq(curriculumNodes.curriculumVersionId, batch.curriculumVersionId),
        eq(curriculumNodes.isActive, true)
      )
    );

  const activeNodeMap = new Map(activeNodes.map((n) => [n.id, n]));
  const caseStudyCache = new Map<string, string>();

  // 2. Fetch or create question source
  let batchSourceId: string | null = null;
  const [existingSource] = await db
    .select({ id: questionSources.id })
    .from(questionSources)
    .where(eq(questionSources.importBatchId, batch.id))
    .limit(1);

  if (existingSource) {
    batchSourceId = existingSource.id;
  } else if (batch.sourceTitle || batch.sourceType) {
    const [newSource] = await db
      .insert(questionSources)
      .values({
        sourceType: batch.sourceType,
        sourceTitle: batch.sourceTitle || `${batch.sourceType} Reference`,
        sourceYear: batch.sourceYear,
        sourceMonth: batch.sourceMonth,
        importBatchId: batch.id,
      })
      .returning();
    batchSourceId = newSource?.id || null;
  }

  // 3. Fetch all APPROVED questions that are NOT yet published
  const approvedItems = await db
    .select()
    .from(importedQuestions)
    .where(
      and(
        eq(importedQuestions.batchId, batch.id),
        eq(importedQuestions.status, "APPROVED"),
        isNull(importedQuestions.publishedQuestionId)
      )
    )
    .orderBy(asc(importedQuestions.questionIndex));

  console.log(`Remaining approved questions to publish: ${approvedItems.length}`);
  if (approvedItems.length === 0) {
    await recalculateBatchCounts(batch.id);
    console.log(`Batch is already fully published.`);
    return 0;
  }

  // 4. Pre-Publication validation in memory
  for (const item of approvedItems) {
    if (!item.curriculumNodeId || !activeNodeMap.has(item.curriculumNodeId)) {
      throw new Error(
        `Question #${item.questionIndex} references an invalid or inactive curriculum node (${item.curriculumNodeId}).`
      );
    }
  }

  let publishedInBatch = 0;
  const totalChunks = Math.ceil(approvedItems.length / chunkSize);

  for (let c = 0; c < totalChunks; c++) {
    const chunk = approvedItems.slice(c * chunkSize, (c + 1) * chunkSize);
    const startTime = Date.now();

    // Resolve case studies first for any case study questions in this chunk
    for (const item of chunk) {
      if (item.questionType === "CASE_STUDY") {
        const payload = (item.editedPayload || item.rawPayload) as CanonicalQuestionPayload;
        if (payload.caseStudy && payload.caseStudy.scenarioText) {
          const csKey = (payload.caseStudyRef || payload.caseStudy.title || "").trim();
          if (csKey && !caseStudyCache.has(csKey)) {
            const node = activeNodeMap.get(item.curriculumNodeId!)!;
            const [cs] = await db
              .insert(caseStudies)
              .values({
                academicLevelId: item.academicLevelId,
                subjectId: node.subjectId,
                title: payload.caseStudy.title || "Case Study Scenario",
                scenarioText: payload.caseStudy.scenarioText,
              })
              .returning({ id: caseStudies.id });
            caseStudyCache.set(csKey, cs.id);
          }
        }
      }
    }

    // Prepare questions insert
    const questionsToInsert = chunk.map((item) => {
      const node = activeNodeMap.get(item.curriculumNodeId!)!;
      const payload = (item.editedPayload || item.rawPayload) as CanonicalQuestionPayload;
      let caseStudyId: string | null = null;
      if (item.questionType === "CASE_STUDY" && payload.caseStudy) {
        const csKey = (payload.caseStudyRef || payload.caseStudy.title || "").trim();
        caseStudyId = caseStudyCache.get(csKey) || null;
      }

      return {
        academicLevelId: item.academicLevelId,
        subjectId: node.subjectId,
        curriculumNodeId: node.id,
        caseStudyId: caseStudyId,
        difficulty: item.difficulty,
        questionType: item.questionType,
        isAiGenerated: false,
      };
    });

    const insertedQuestions = await db
      .insert(questions)
      .values(questionsToInsert)
      .returning({ id: questions.id });

    // Prepare versions insert
    const versionsToInsert = chunk.map((item, idx) => {
      const qId = insertedQuestions[idx].id;
      const payload = (item.editedPayload || item.rawPayload) as CanonicalQuestionPayload;
      const sourceMeta: Record<string, unknown> = {};
      if (payload.externalId) sourceMeta.externalId = payload.externalId;
      if (payload.source?.sourceAttempt) sourceMeta.sourceAttempt = payload.source.sourceAttempt;
      if (payload.source?.applicability) sourceMeta.applicability = payload.source.applicability;
      if (payload.source?.pageNumber || payload.pageNumber) {
        sourceMeta.pageNumber = payload.source?.pageNumber || payload.pageNumber;
      }
      if (payload.source?.sourceReference || payload.sourceReference) {
        sourceMeta.sourceReference = payload.source?.sourceReference || payload.sourceReference;
      }

      return {
        questionId: qId,
        versionNumber: 1,
        questionText: payload.questionText,
        correctAnswer: payload.correctAnswer,
        explanation: payload.explanation || null,
        sourceId: batchSourceId,
        sourceMetadata: Object.keys(sourceMeta).length > 0 ? sourceMeta : null,
        isActive: true,
      };
    });

    const insertedVersions = await db
      .insert(questionVersions)
      .values(versionsToInsert)
      .returning({ id: questionVersions.id });

    // Prepare options insert
    const optionsToInsert: Array<{
      questionVersionId: string;
      optionLetter: string;
      optionText: string;
    }> = [];

    chunk.forEach((item, idx) => {
      const vId = insertedVersions[idx].id;
      const payload = (item.editedPayload || item.rawPayload) as CanonicalQuestionPayload;
      if (Array.isArray(payload.options)) {
        for (const opt of payload.options) {
          optionsToInsert.push({
            questionVersionId: vId,
            optionLetter: opt.letter.toUpperCase(),
            optionText: opt.text,
          });
        }
      }
    });

    if (optionsToInsert.length > 0) {
      await db.insert(questionOptions).values(optionsToInsert);
    }

    // Update staged questions to PUBLISHED
    // In chunks of 5 parallel updates to optimize HTTP latency
    const updatePromises = chunk.map((item, idx) =>
      db
        .update(importedQuestions)
        .set({
          status: "PUBLISHED",
          publishedQuestionId: insertedQuestions[idx].id,
          publishedQuestionVersionId: insertedVersions[idx].id,
          updatedAt: new Date(),
        })
        .where(eq(importedQuestions.id, item.id))
    );

    for (let p = 0; p < updatePromises.length; p += 5) {
      await Promise.all(updatePromises.slice(p, p + 5));
    }

    publishedInBatch += chunk.length;
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(
      `  [Chunk ${c + 1}/${totalChunks}] Published ${chunk.length} questions (${publishedInBatch}/${approvedItems.length}) in ${elapsed}s`
    );
  }

  // Sync batch counts
  await recalculateBatchCounts(batch.id);

  // Record publication audit
  await db.insert(importAuditEvents).values({
    batchId: batch.id,
    action: "BATCH_PUBLISHED",
    performedBy: adminEmail,
    details: {
      publishedQuestionsCount: publishedInBatch,
    },
  });

  console.log(`✓ Batch completed: Published ${publishedInBatch} questions.`);
  return publishedInBatch;
}

async function main() {
  console.log("=== HIGH-PERFORMANCE MTP PUBLISHER ===");
  const adminEmail = "admin@caprep.pro";

  // Fetch only 2025 MTP batches
  const batches = await db
    .select()
    .from(importBatches)
    .where(like(importBatches.batchName, "%Official Model Test Papers 2025%"))
    .orderBy(asc(importBatches.createdAt));

  console.log(`Found ${batches.length} MTP batches to publish.`);

  let totalPublished = 0;
  for (const b of batches) {
    const pubCount = await fastPublishBatch(b.id, adminEmail, 30);
    totalPublished += pubCount;
  }

  console.log(`\n========================================`);
  console.log(`ALL 2025 MTP BATCHES PUBLISHED SUCCESSFULLY!`);
  console.log(`Total questions published this run: ${totalPublished}`);
  console.log(`========================================`);
}

main().catch((err) => {
  console.error("Fast publish failed:", err);
  process.exit(1);
});
