import fs from "fs";
import path from "path";
import { db } from "../src/db";
import {
  academicLevels,
  curriculumVersions,
  subjects,
  importBatches,
  importedQuestions,
  questions,
  questionVersions,
  questionOptions,
  questionSources,
  caseStudies,
  curriculumNodes,
} from "../src/db/schema";
import { eq, and, isNull, asc } from "drizzle-orm";
import { createImportBatch, recalculateBatchCounts } from "../src/domains/questions/import/services";

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
  console.log(`Publishing Batch: ${batch.batchName}`);
  console.log(`========================================`);

  const activeNodes = await db
    .select({
      id: curriculumNodes.id,
      code: curriculumNodes.code,
      subjectId: curriculumNodes.subjectId,
      isActive: curriculumNodes.isActive,
    })
    .from(curriculumNodes)
    .where(eq(curriculumNodes.curriculumVersionId, batch.curriculumVersionId));

  const activeNodeMap = new Map<string, { id: string; subjectId: string; isActive: boolean }>();
  for (const n of activeNodes) {
    activeNodeMap.set(n.id, n);
    if (n.code) {
      activeNodeMap.set(n.code.toUpperCase(), n);
    }
  }

  // Create question source container for this batch
  const [sourceRecord] = await db
    .insert(questionSources)
    .values({
      sourceType: batch.sourceType,
      sourceTitle: batch.sourceTitle || batch.batchName,
      sourceYear: batch.sourceYear || 2025,
      sourceMonth: batch.sourceMonth || 1,
      paperNumber: batch.paperNumber || null,
      importBatchId: batch.id,
    })
    .returning({ id: questionSources.id });

  const batchSourceId = sourceRecord.id;

  // Fetch approved, unpublished questions
  const approvedQuestions = await db
    .select()
    .from(importedQuestions)
    .where(
      and(
        eq(importedQuestions.batchId, batchId),
        eq(importedQuestions.status, "APPROVED"),
        isNull(importedQuestions.publishedQuestionId)
      )
    )
    .orderBy(asc(importedQuestions.questionIndex));

  console.log(`Approved questions to publish: ${approvedQuestions.length}`);
  if (approvedQuestions.length === 0) {
    console.log("Zero approved questions pending publication in this batch.");
    return;
  }

  const caseStudyCache = new Map<string, string>();
  let totalPublished = 0;

  for (let i = 0; i < approvedQuestions.length; i += chunkSize) {
    const chunk = approvedQuestions.slice(i, i + chunkSize);

    // 1. Resolve Case Studies
    for (const item of chunk) {
      if (item.questionType === "CASE_STUDY") {
        const payload = (item.editedPayload || item.rawPayload) as any;
        if (payload.caseStudy && payload.caseStudy.scenarioText) {
          const csKey = (payload.caseStudyRef || payload.caseStudy.title || "").trim();
          if (csKey && !caseStudyCache.has(csKey)) {
            const node = activeNodeMap.get(item.curriculumNodeId!)!;
            const [cs] = await db
              .insert(caseStudies)
              .values({
                academicLevelId: item.academicLevelId,
                subjectId: item.subjectId || node.subjectId,
                title: payload.caseStudy.title || "Case Study Scenario",
                scenarioText: payload.caseStudy.scenarioText,
              })
              .returning({ id: caseStudies.id });
            caseStudyCache.set(csKey, cs.id);
          }
        }
      }
    }

    // 2. Insert Questions
    const questionsToInsert = chunk.map((item) => {
      const node = activeNodeMap.get(item.curriculumNodeId!)!;
      const payload = (item.editedPayload || item.rawPayload) as any;
      let caseStudyId: string | null = null;
      if (item.questionType === "CASE_STUDY" && payload.caseStudy) {
        const csKey = (payload.caseStudyRef || payload.caseStudy.title || "").trim();
        caseStudyId = caseStudyCache.get(csKey) || null;
      }

      return {
        academicLevelId: item.academicLevelId,
        subjectId: item.subjectId || node.subjectId,
        curriculumNodeId: node.id,
        caseStudyId,
        difficulty: item.difficulty || "MEDIUM",
        questionType: item.questionType,
        isAiGenerated: false,
      };
    });

    const insertedQuestions = await db
      .insert(questions)
      .values(questionsToInsert)
      .returning({ id: questions.id });

    // 3. Insert Question Versions
    const versionsToInsert = chunk.map((item, idx) => {
      const qId = insertedQuestions[idx].id;
      const payload = (item.editedPayload || item.rawPayload) as any;
      const sourceMeta: Record<string, unknown> = {};
      if (payload.externalId) sourceMeta.externalId = payload.externalId;
      if (payload.source?.sourceAttempt) sourceMeta.sourceAttempt = payload.source.sourceAttempt;
      if (payload.source?.sourceReference) sourceMeta.sourceReference = payload.source.sourceReference;

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

    // 4. Insert Question Options
    const optionsToInsert: Array<{
      questionVersionId: string;
      optionLetter: string;
      optionText: string;
    }> = [];

    chunk.forEach((item, idx) => {
      const vId = insertedVersions[idx].id;
      const payload = (item.editedPayload || item.rawPayload) as any;
      if (Array.isArray(payload.options)) {
        payload.options.forEach((opt: any) => {
          optionsToInsert.push({
            questionVersionId: vId,
            optionLetter: opt.letter.toUpperCase(),
            optionText: opt.text,
          });
        });
      }
    });

    if (optionsToInsert.length > 0) {
      await db.insert(questionOptions).values(optionsToInsert);
    }

    // 5. Update Staging Rows
    for (let idx = 0; idx < chunk.length; idx++) {
      const item = chunk[idx];
      const qId = insertedQuestions[idx].id;
      const vId = insertedVersions[idx].id;

      await db
        .update(importedQuestions)
        .set({
          status: "PUBLISHED",
          publishedQuestionId: qId,
          publishedQuestionVersionId: vId,
          reviewedBy: adminEmail,
          reviewedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(importedQuestions.id, item.id));
    }

    totalPublished += chunk.length;
  }

  // Recalculate batch counts & update status
  await recalculateBatchCounts(batchId);

  console.log(`✓ Published: ${totalPublished} questions.`);
}

async function main() {
  console.log("=== STAGING AND PUBLISHING ALL ICAI 2025 REVISION TEST PAPERS (RTPS) ===");

  const [fndLevel] = await db
    .select()
    .from(academicLevels)
    .where(eq(academicLevels.code, "FOUNDATION"))
    .limit(1);

  if (!fndLevel) throw new Error("CA Foundation level not found.");

  const [activeVersion] = await db
    .select()
    .from(curriculumVersions)
    .where(
      and(
        eq(curriculumVersions.academicLevelId, fndLevel.id),
        eq(curriculumVersions.isActive, true)
      )
    )
    .limit(1);

  if (!activeVersion) throw new Error("Active Foundation version not found.");

  const allSubs = await db
    .select()
    .from(subjects)
    .where(eq(subjects.academicLevelId, fndLevel.id));

  const subMap: Record<string, string> = {};
  for (const s of allSubs) {
    subMap[s.code] = s.id;
  }

  const rtpFiles = [
    // Paper 3 (Quantitative Aptitude) - Standalone MCQs
    { file: "p3_jan2025.json", name: "CA Foundation Quantitative Aptitude (Paper 3) - Official RTP January 2025", subCode: "PAPER_3", month: 1 },
    { file: "p3_may2025.json", name: "CA Foundation Quantitative Aptitude (Paper 3) - Official RTP May 2025", subCode: "PAPER_3", month: 5 },
    { file: "p3_sep2025.json", name: "CA Foundation Quantitative Aptitude (Paper 3) - Official RTP September 2025", subCode: "PAPER_3", month: 9 },

    // Paper 4 (Business Economics) - Standalone MCQs
    { file: "p4_jan2025.json", name: "CA Foundation Business Economics (Paper 4) - Official RTP January 2025", subCode: "PAPER_4", month: 1 },
    { file: "p4_may2025.json", name: "CA Foundation Business Economics (Paper 4) - Official RTP May 2025", subCode: "PAPER_4", month: 5 },
    { file: "p4_sep2025.json", name: "CA Foundation Business Economics (Paper 4) - Official RTP September 2025", subCode: "PAPER_4", month: 9 },

    // Paper 1 (Accounting) - True/False Conceptual MCQs
    { file: "p1_jan2025.json", name: "CA Foundation Accounting (Paper 1) - Official RTP January 2025 (Conceptual True/False Bank)", subCode: "PAPER_1", month: 1 },
    { file: "p1_may2025.json", name: "CA Foundation Accounting (Paper 1) - Official RTP May 2025 (Conceptual True/False Bank)", subCode: "PAPER_1", month: 5 },
    { file: "p1_sep2025.json", name: "CA Foundation Accounting (Paper 1) - Official RTP September 2025 (Conceptual True/False Bank)", subCode: "PAPER_1", month: 9 },

    // Paper 2 (Business Laws) - Practical Case Studies
    { file: "p2_jan2025.json", name: "CA Foundation Business Laws (Paper 2) - Official RTP January 2025 (Case Study Bank)", subCode: "PAPER_2", month: 1 },
    { file: "p2_may2025.json", name: "CA Foundation Business Laws (Paper 2) - Official RTP May 2025 (Case Study Bank)", subCode: "PAPER_2", month: 5 },
    { file: "p2_sep2025.json", name: "CA Foundation Business Laws (Paper 2) - Official RTP September 2025 (Case Study Bank)", subCode: "PAPER_2", month: 9 },
  ];

  const adminEmail = "admin@caprep.pro";

  for (const rf of rtpFiles) {
    const filePath = path.join("rtp_batches", rf.file);
    if (!fs.existsSync(filePath)) {
      console.warn(`File not found: ${filePath}`);
      continue;
    }

    const rawJson = fs.readFileSync(filePath, "utf-8");
    const subjectId = subMap[rf.subCode];

    // Check if batch already exists in DB
    const [existing] = await db
      .select()
      .from(importBatches)
      .where(eq(importBatches.batchName, rf.name))
      .limit(1);

    let batchId: string;

    if (existing) {
      console.log(`\nBatch "${rf.name}" already staged (ID: ${existing.id}).`);
      batchId = existing.id;
    } else {
      console.log(`\nStaging batch "${rf.name}"...`);
      const created = await createImportBatch({
        rawJsonString: rawJson,
        batchName: rf.name,
        academicLevelId: fndLevel.id,
        curriculumVersionId: activeVersion.id,
        subjectId,
        sourceType: "RTP",
        sourceTitle: `ICAI Revision Test Paper (RTP) 2025`,
        sourceYear: 2025,
        sourceMonth: rf.month,
        adminEmail,
      });
      batchId = created.batchId;
      console.log(`✓ Staged batch ID: ${batchId}`);
    }

    // Auto-approve all valid, curriculum-mapped questions in this batch
    const pending = await db
      .select()
      .from(importedQuestions)
      .where(
        and(
          eq(importedQuestions.batchId, batchId),
          eq(importedQuestions.status, "PENDING_REVIEW")
        )
      );

    if (pending.length > 0) {
      console.log(`Auto-approving ${pending.length} pending questions in batch...`);
      for (const p of pending) {
        if (p.validationStatus !== "INVALID" && p.curriculumNodeId) {
          await db
            .update(importedQuestions)
            .set({
              status: "APPROVED",
              reviewedBy: adminEmail,
              reviewedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(importedQuestions.id, p.id));
        }
      }
      await recalculateBatchCounts(batchId);
    }

    // Publish approved questions to live tables
    await fastPublishBatch(batchId, adminEmail);
  }

  console.log("\n========================================");
  console.log("ALL 2025 RTP BATCHES STAGED AND PUBLISHED!");
  console.log("========================================");
}

main().catch(console.error);
