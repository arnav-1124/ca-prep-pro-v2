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
  importAuditEvents,
} from "../src/db/schema";
import { eq, and, isNull, asc, inArray } from "drizzle-orm";
import { createImportBatch, recalculateBatchCounts, withRetry } from "../src/domains/questions/import/services";

interface BatchFileConfig {
  file: string;
  paperNumber: number;
  subjectCode: string;
  subjectId: string;
  subjectName: string;
  statutoryNote: string;
}

const BATCH_CONFIGS: BatchFileConfig[] = [
  {
    file: "intermediate_sm_p1_accounting.json",
    paperNumber: 1,
    subjectCode: "PAPER_1",
    subjectId: "1811547c-0dec-4215-bc4d-1888e232a23f",
    subjectName: "Advanced Accounting",
    statutoryNote: "Applicable for May 2026, September 2026 & January 2027 Examinations under New Scheme",
  },
  {
    file: "intermediate_sm_p2_law.json",
    paperNumber: 2,
    subjectCode: "PAPER_2",
    subjectId: "ed0b7c2b-71c7-478b-8547-f32896bf1d1a",
    subjectName: "Corporate and Other Laws",
    statutoryNote: "Relevant for May 2026 Examination (as amended up to 31.10.2025; Companies Act 2013, LLP Act 2008 & Other Laws)",
  },
  {
    file: "intermediate_sm_p3_taxation.json",
    paperNumber: 3,
    subjectCode: "PAPER_3",
    subjectId: "6c1c66bf-9944-4aa5-8dbc-56407fac0f16",
    subjectName: "Taxation",
    statutoryNote: "Relevant for May 2026 Examination (Income Tax as amended by Finance Act 2025; GST as amended up to 31.10.2025)",
  },
  {
    file: "intermediate_sm_p4_costing.json",
    paperNumber: 4,
    subjectCode: "PAPER_4",
    subjectId: "a64558d4-72aa-4da4-81ad-cb76540be838",
    subjectName: "Cost and Management Accounting",
    statutoryNote: "Applicable for May 2026, September 2026 & January 2027 Examinations",
  },
  {
    file: "intermediate_sm_p5_auditing.json",
    paperNumber: 5,
    subjectCode: "PAPER_5",
    subjectId: "e0678d4f-d8ba-438c-825c-e66cb5628f0c",
    subjectName: "Auditing and Ethics",
    statutoryNote: "Relevant for May 2026 Examination (Engagement & Quality Control Standards, SA 200 to SA 700 series)",
  },
  {
    file: "intermediate_sm_p6_fmsm.json",
    paperNumber: 6,
    subjectCode: "PAPER_6",
    subjectId: "4fdd0fbd-336a-4678-bc33-f233a9e9ff51",
    subjectName: "Financial Management and Strategic Management",
    statutoryNote: "Applicable for May 2026, September 2026 & January 2027 Examinations under New Scheme",
  },
];

async function publishBatchChunked(batchId: string, adminEmail: string, statutoryNote: string, defaultSubjectId: string, chunkSize = 50) {
  const [batch] = await withRetry(() =>
    db
      .select()
      .from(importBatches)
      .where(eq(importBatches.id, batchId))
      .limit(1)
  );

  if (!batch) {
    throw new Error(`Batch ${batchId} not found.`);
  }

  console.log(`\nPublishing Batch: ${batch.batchName} (Batch ID: ${batch.id})`);

  // Active curriculum nodes mapping
  const activeNodes = await withRetry(() =>
    db
      .select({
        id: curriculumNodes.id,
        code: curriculumNodes.code,
        subjectId: curriculumNodes.subjectId,
        isActive: curriculumNodes.isActive,
      })
      .from(curriculumNodes)
      .where(eq(curriculumNodes.curriculumVersionId, batch.curriculumVersionId))
  );

  const activeNodeMap = new Map<string, { id: string; subjectId: string; isActive: boolean }>();
  for (const n of activeNodes) {
    activeNodeMap.set(n.id, n);
    if (n.code) {
      activeNodeMap.set(n.code.toUpperCase(), n);
    }
  }

  // Create Question Source container with examAttemptId
  const [sourceRecord] = await withRetry(() =>
    db
      .insert(questionSources)
      .values({
        sourceType: batch.sourceType,
        sourceTitle: batch.sourceTitle || batch.batchName,
        sourceYear: batch.sourceYear || 2026,
        sourceMonth: batch.sourceMonth || 5,
        paperNumber: batch.paperNumber || null,
        examAttemptId: batch.examAttemptId,
        importBatchId: batch.id,
      })
      .returning({ id: questionSources.id })
  );

  const batchSourceId = sourceRecord.id;

  // Query approved questions to publish
  const approvedQuestions = await withRetry(() =>
    db
      .select()
      .from(importedQuestions)
      .where(
        and(
          eq(importedQuestions.batchId, batchId),
          eq(importedQuestions.status, "APPROVED"),
          isNull(importedQuestions.publishedQuestionId)
        )
      )
      .orderBy(asc(importedQuestions.questionIndex))
  );

  console.log(`  -> Approved questions to publish: ${approvedQuestions.length}`);
  if (approvedQuestions.length === 0) {
    console.log("  -> Zero approved questions pending publication in this batch.");
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
        const scenarioText = payload.caseStudy?.scenarioText || payload.caseStudyText;
        const title = payload.caseStudy?.title || payload.caseStudyTitle || "Case Study Scenario";
        if (scenarioText) {
          const csKey = (payload.caseStudyRef || title).trim();
          if (csKey && !caseStudyCache.has(csKey)) {
            const nodeId = item.curriculumNodeId || (payload.nodeCode ? activeNodeMap.get(payload.nodeCode.toUpperCase())?.id : null);
            const node = nodeId ? activeNodeMap.get(nodeId) : null;
            const subjectId = item.subjectId || node?.subjectId || defaultSubjectId;
            const [cs] = await withRetry(() =>
              db
                .insert(caseStudies)
                .values({
                  academicLevelId: item.academicLevelId,
                  subjectId,
                  title,
                  scenarioText,
                })
                .returning({ id: caseStudies.id })
            );
            caseStudyCache.set(csKey, cs.id);
          }
        }
      }
    }

    // 2. Insert Questions
    const questionsToInsert = chunk.map((item) => {
      const payload = (item.editedPayload || item.rawPayload) as any;
      const nodeId = item.curriculumNodeId || (payload.nodeCode ? activeNodeMap.get(payload.nodeCode.toUpperCase())?.id : null);
      const node = nodeId ? activeNodeMap.get(nodeId) : null;
      const subjectId = item.subjectId || node?.subjectId || defaultSubjectId;
      let caseStudyId: string | null = null;
      if (item.questionType === "CASE_STUDY") {
        const csKey = (payload.caseStudyRef || payload.caseStudy?.title || payload.caseStudyTitle || "").trim();
        caseStudyId = caseStudyCache.get(csKey) || null;
      }

      return {
        academicLevelId: item.academicLevelId,
        subjectId,
        curriculumNodeId: node?.id || nodeId || activeNodes[0].id,
        caseStudyId,
        difficulty: item.difficulty || "MEDIUM",
        questionType: item.questionType,
        isAiGenerated: false,
      };
    });

    const insertedQuestions = await withRetry(() =>
      db
        .insert(questions)
        .values(questionsToInsert)
        .returning({ id: questions.id })
    );

    // 3. Insert Question Versions with attempt & statutory metadata
    const versionsToInsert = chunk.map((item, idx) => {
      const qId = insertedQuestions[idx].id;
      const payload = (item.editedPayload || item.rawPayload) as any;
      const sourceMeta: Record<string, unknown> = {
        examAttemptId: batch.examAttemptId,
        examAttempt: "May 2026",
        sourceYear: batch.sourceYear || 2026,
        sourceMonth: batch.sourceMonth || 5,
        statutoryNote,
        sourceReference: payload.source?.sourceReference || null,
        sourceTitle: batch.sourceTitle || batch.batchName,
      };
      if (payload.externalId) sourceMeta.externalId = payload.externalId;

      return {
        questionId: qId,
        versionNumber: 1,
        questionText: payload.questionText,
        correctAnswer: payload.correctAnswer,
        explanation: payload.explanation || null,
        sourceId: batchSourceId,
        sourceMetadata: sourceMeta,
        isActive: true,
      };
    });

    const insertedVersions = await withRetry(() =>
      db
        .insert(questionVersions)
        .values(versionsToInsert)
        .returning({ id: questionVersions.id })
    );

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
      await withRetry(() => db.insert(questionOptions).values(optionsToInsert));
    }

    // 5. Update Staging Rows in parallel
    await Promise.all(
      chunk.map((item, idx) =>
        withRetry(() =>
          db
            .update(importedQuestions)
            .set({
              publishedQuestionId: insertedQuestions[idx].id,
              publishedQuestionVersionId: insertedVersions[idx].id,
              updatedAt: new Date(),
            })
            .where(eq(importedQuestions.id, item.id))
        )
      )
    );

    totalPublished += chunk.length;
    console.log(`  Progress: Published ${totalPublished} / ${approvedQuestions.length} questions...`);
  }

  // 6. Update Batch Record
  await recalculateBatchCounts(batchId);
  await withRetry(() =>
    db
      .update(importBatches)
      .set({
        status: "PUBLISHED",
        publishedAt: new Date(),
        publishedBy: adminEmail,
        updatedAt: new Date(),
      })
      .where(eq(importBatches.id, batchId))
  );

  console.log(`  ✓ Batch published successfully! Total questions published: ${totalPublished}\n`);
}

async function main() {
  console.log("================================================================================");
  console.log("STAGE AND PUBLISH CA INTERMEDIATE OFFICIAL STUDY MATERIAL (ATTEMPT: MAY 2026)");
  console.log("================================================================================\n");

  const interLevelId = "4649380e-94f6-4344-a279-11d42a8991a2";
  const interCurriculumVersionId = "76a04841-fd13-45c9-a598-7eeb3994115d";
  const may2026AttemptId = "fdfe2067-83bc-4c5f-87b0-58d1cc02abe9";
  const adminEmail = "admin@caprep.pro";

  // Verify Intermediate Level & Active Curriculum
  const [level] = await withRetry(() =>
    db
      .select()
      .from(academicLevels)
      .where(eq(academicLevels.id, interLevelId))
      .limit(1)
  );

  if (!level) {
    throw new Error(`Academic level ${interLevelId} not found.`);
  }

  const [version] = await withRetry(() =>
    db
      .select()
      .from(curriculumVersions)
      .where(eq(curriculumVersions.id, interCurriculumVersionId))
      .limit(1)
  );

  if (!version || !version.isActive) {
    throw new Error(`Curriculum version ${interCurriculumVersionId} not found or inactive.`);
  }

  console.log(`Academic Level: ${level.name} (${level.code})`);
  console.log(`Curriculum Version: ${version.name} (Active: ${version.isActive})`);
  console.log(`Target Exam Attempt: May 2026 (ID: ${may2026AttemptId})\n`);

  // Clean up any stale un-published intermediate batches from prior attempts
  const existingBatches = await withRetry(() =>
    db
      .select()
      .from(importBatches)
      .where(eq(importBatches.academicLevelId, interLevelId))
  );

  for (const b of existingBatches) {
    if (b.status !== "PUBLISHED") {
      console.log(`Cleaning un-published batch: ${b.batchName} (${b.id})`);
      const staged = await withRetry(() =>
        db
          .select({ pubId: importedQuestions.publishedQuestionId })
          .from(importedQuestions)
          .where(eq(importedQuestions.batchId, b.id))
      );

      const publishedQIds = staged.map((s) => s.pubId).filter(Boolean) as string[];

      // 1. Unlink publishedQuestionId from importedQuestions to prevent foreign key violations
      await withRetry(() =>
        db
          .update(importedQuestions)
          .set({ publishedQuestionId: null, publishedQuestionVersionId: null })
          .where(eq(importedQuestions.batchId, b.id))
      );

      // Find all question sources for this batch
      const batchSources = await withRetry(() =>
        db
          .select({ id: questionSources.id })
          .from(questionSources)
          .where(eq(questionSources.importBatchId, b.id))
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

      // 2. Batch delete partially published questions
      if (allQIdsToDelete.length > 0) {
        console.log(`  Deleting ${allQIdsToDelete.length} partially published live questions in chunks...`);
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

      // 3. Clean up staging, sources, audits, batch record
      await withRetry(() => db.delete(importAuditEvents).where(eq(importAuditEvents.batchId, b.id)));
      await withRetry(() => db.delete(importedQuestions).where(eq(importedQuestions.batchId, b.id)));
      await withRetry(() => db.delete(questionSources).where(eq(questionSources.importBatchId, b.id)));
      await withRetry(() => db.delete(importBatches).where(eq(importBatches.id, b.id)));

      // 4. Clean up any orphaned case studies for this subject
      if (b.subjectId) {
        const orphanedCaseStudies = await withRetry(() =>
          db
            .select({ id: caseStudies.id })
            .from(caseStudies)
            .leftJoin(questions, eq(questions.caseStudyId, caseStudies.id))
            .where(
              and(
                eq(caseStudies.academicLevelId, interLevelId),
                eq(caseStudies.subjectId, b.subjectId),
                isNull(questions.id)
              )
            )
        );
        const orphanIds = orphanedCaseStudies.map((cs) => cs.id);
        if (orphanIds.length > 0) {
          console.log(`  Cleaning ${orphanIds.length} orphaned case studies for subject...`);
          for (let oc = 0; oc < orphanIds.length; oc += 50) {
            const oChunk = orphanIds.slice(oc, oc + 50);
            await withRetry(() => db.delete(caseStudies).where(inArray(caseStudies.id, oChunk)));
          }
        }
      }

      console.log(`  ✓ Un-published batch ${b.id} cleaned successfully.`);
    }
  }

  for (const cfg of BATCH_CONFIGS) {
    // Check if this paper is already PUBLISHED
    const [existingPublished] = await withRetry(() =>
      db
        .select()
        .from(importBatches)
        .where(
          and(
            eq(importBatches.academicLevelId, interLevelId),
            eq(importBatches.subjectId, cfg.subjectId),
            eq(importBatches.status, "PUBLISHED")
          )
        )
        .limit(1)
    );

    if (existingPublished) {
      console.log(`--------------------------------------------------------------------------------`);
      console.log(`Paper ${cfg.paperNumber}: ${cfg.subjectName} is ALREADY PUBLISHED. Skipping.`);
      continue;
    }

    const fPath = path.join(__dirname, "../ingestion/batches", cfg.file);
    if (!fs.existsSync(fPath)) {
      throw new Error(`Batch file not found: ${fPath}`);
    }

    const fileContent = fs.readFileSync(fPath, "utf-8");
    const batchJson = JSON.parse(fileContent);

    console.log(`--------------------------------------------------------------------------------`);
    console.log(`[STAGE] Paper ${cfg.paperNumber}: ${cfg.subjectName}`);
    console.log(`Loading payload from ${cfg.file} (${batchJson.questions.length} questions)...`);

    // 1. Stage batch
    const stageResult = await createImportBatch({
      rawJsonString: fileContent,
      batchName: `CA Intermediate Paper ${cfg.paperNumber} (${cfg.subjectName}) - Study Material (May 2026)`,
      academicLevelId: interLevelId,
      curriculumVersionId: interCurriculumVersionId,
      subjectId: cfg.subjectId,
      examAttemptId: may2026AttemptId,
      sourceType: "STUDY_MATERIAL",
      sourceTitle: `ICAI Study Material & BoS Case Scenarios (May 2026 Examination Edition)`,
      sourceYear: 2026,
      sourceMonth: 5,
      paperNumber: cfg.paperNumber,
      adminEmail,
    });

    console.log(`  ✓ Batch Staged: ${stageResult.batchId}`);
    console.log(`    Total Questions: ${stageResult.totalQuestions}, Valid: ${stageResult.validCount}, Invalid: ${stageResult.invalidCount}`);

    if (stageResult.invalidCount > 0) {
      throw new Error(`Batch ${cfg.file} has ${stageResult.invalidCount} invalid questions! Staging aborted.`);
    }

    // 2. Auto-approve all valid questions
    console.log(`  Approving ${stageResult.validCount} valid questions...`);
    await withRetry(() =>
      db
        .update(importedQuestions)
        .set({
          status: "APPROVED",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(importedQuestions.batchId, stageResult.batchId),
            eq(importedQuestions.validationStatus, "VALID")
          )
        )
    );

    await recalculateBatchCounts(stageResult.batchId);

    // 3. Publish to live tables
    await publishBatchChunked(stageResult.batchId, adminEmail, cfg.statutoryNote, cfg.subjectId, 50);
  }

  console.log("================================================================================");
  console.log("ALL 6 INTERMEDIATE STUDY MATERIAL BATCHES STAGED AND PUBLISHED SUCCESSFULLY!");
  console.log("================================================================================");
}

main().catch((err) => {
  console.error("Fatal Error during staging and publication:", err);
  process.exit(1);
});
