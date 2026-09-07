import fs from "fs";
import path from "path";
import { db } from "../src/db";
import {
  academicLevels,
  subjects,
  curriculumVersions,
  curriculumNodes,
  importBatches,
  importedQuestions,
  questionSources,
  questions,
  questionVersions,
  questionOptions,
  caseStudies,
  practiceSessions,
  practiceSessionQuestions,
  practiceAttempts,
  tests,
  testQuestions,
  testAnswers,
} from "../src/db/schema";
import { eq, and, sql } from "drizzle-orm";

interface BatchQuestion {
  canonicalNodeCode?: string;
  nodeCode?: string;
  questionType?: "MCQ" | "CASE_STUDY";
  difficulty?: "EASY" | "MEDIUM" | "HARD";
  questionText: string;
  options: { letter: string; text: string }[];
  correctAnswer: string;
  explanation?: string;
  sourceYear?: number;
  sourceMonth?: number;
  caseStudyRef?: string;
  caseStudy?: {
    title: string;
    scenarioText: string;
  };
}

interface BatchFile {
  batchName: string;
  sourceType: string;
  sourceTitle: string;
  sourceYear?: number;
  sourceMonth?: number;
  questions: BatchQuestion[];
}

async function main() {
  console.log("=================================================================");
  console.log("=== UNIVERSAL QUESTION BANK RESET & AUTHORITATIVE RE-INGESTION ===");
  console.log("=================================================================\n");

  // 1. Resolve Active Foundation Curriculum Version
  const [fndLevel] = await db
    .select()
    .from(academicLevels)
    .where(eq(academicLevels.code, "FOUNDATION"))
    .limit(1);

  if (!fndLevel) {
    throw new Error("Academic level FOUNDATION not found.");
  }

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

  if (!activeVersion) {
    throw new Error("Active curriculum version for FOUNDATION not found.");
  }

  console.log(`Resolved Active Curriculum Version: ${activeVersion.name} (${activeVersion.id})`);

  // 2. Fetch all active curriculum nodes for Foundation
  const allNodes = await db
    .select({
      id: curriculumNodes.id,
      code: curriculumNodes.code,
      name: curriculumNodes.name,
      subjectId: curriculumNodes.subjectId,
    })
    .from(curriculumNodes)
    .where(
      and(
        eq(curriculumNodes.curriculumVersionId, activeVersion.id),
        eq(curriculumNodes.isActive, true)
      )
    );

  console.log(`Loaded ${allNodes.length} active curriculum nodes for Foundation.`);
  const nodeByCode = new Map(allNodes.map((n) => [n.code, n]));

  // Also build fallback map by subject
  const allSubjects = await db
    .select()
    .from(subjects)
    .where(eq(subjects.academicLevelId, fndLevel.id));
  const subjectByCode = new Map(allSubjects.map((s) => [s.code, s]));
  const defaultNodeBySubject = new Map<string, typeof allNodes[0]>();
  for (const s of allSubjects) {
    const firstNode = allNodes.find((n) => n.subjectId === s.id);
    if (firstNode) defaultNodeBySubject.set(s.id, firstNode);
  }

  // 3. WIPE QUESTION AND TEST TABLES SAFELY
  console.log("\nClearing old question and session tables...");
  await db.execute(sql`DELETE FROM practice_attempts;`);
  await db.execute(sql`DELETE FROM practice_session_questions;`);
  await db.execute(sql`DELETE FROM practice_sessions;`);
  await db.execute(sql`DELETE FROM test_answers;`);
  await db.execute(sql`DELETE FROM test_questions;`);
  await db.execute(sql`DELETE FROM tests;`);
  await db.execute(sql`DELETE FROM imported_questions;`);
  try {
    await db.execute(sql`DELETE FROM import_audit_events;`);
  } catch {}
  await db.execute(sql`DELETE FROM question_options;`);
  await db.execute(sql`DELETE FROM question_versions;`);
  await db.execute(sql`DELETE FROM questions;`);
  await db.execute(sql`DELETE FROM case_studies;`);
  await db.execute(sql`DELETE FROM question_sources;`);
  await db.execute(sql`DELETE FROM import_batches;`);
  console.log("Successfully wiped all old question records!\n");

  // 4. INVENTORY OF CLEAN BATCH FILES TO RE-INGEST
  const batchFiles: { filePath: string; defaultSubjectCode: string }[] = [
    // Study Material
    { filePath: "ingestion/batches/foundation_sm_p1_accounting.json", defaultSubjectCode: "FND_P1" },
    { filePath: "ingestion/batches/foundation_sm_p2_business_laws.json", defaultSubjectCode: "FND_P2" },
    { filePath: "ingestion/batches/foundation_sm_p3_logical_reasoning.json", defaultSubjectCode: "FND_P3" },
    { filePath: "ingestion/batches/foundation_sm_p3_math_part1.json", defaultSubjectCode: "FND_P3" },
    { filePath: "ingestion/batches/foundation_sm_p3_math_part2.json", defaultSubjectCode: "FND_P3" },
    { filePath: "ingestion/batches/foundation_sm_p3_math_part3.json", defaultSubjectCode: "FND_P3" },
    { filePath: "ingestion/batches/foundation_sm_p3_statistics_descriptive.json", defaultSubjectCode: "FND_P3" },
    { filePath: "ingestion/batches/foundation_sm_p3_statistics_probability.json", defaultSubjectCode: "FND_P3" },
    { filePath: "ingestion/batches/foundation_sm_p4_part1_micro.json", defaultSubjectCode: "FND_P4" },
    { filePath: "ingestion/batches/foundation_sm_p4_part2_macro.json", defaultSubjectCode: "FND_P4" },

    // 2025 MTPs
    { filePath: "ingestion/batches/mtp/foundation_mtp_2025_p1_accounting.json", defaultSubjectCode: "FND_P1" },
    { filePath: "ingestion/batches/mtp/foundation_mtp_2025_p2_case_studies.json", defaultSubjectCode: "FND_P2" },
    { filePath: "ingestion/batches/mtp/foundation_mtp_2025_p3_part1.json", defaultSubjectCode: "FND_P3" },
    { filePath: "ingestion/batches/mtp/foundation_mtp_2025_p3_part2.json", defaultSubjectCode: "FND_P3" },
    { filePath: "ingestion/batches/mtp/foundation_mtp_2025_p4_part1.json", defaultSubjectCode: "FND_P4" },
    { filePath: "ingestion/batches/mtp/foundation_mtp_2025_p4_part2.json", defaultSubjectCode: "FND_P4" },

    // 2025 RTPs
    { filePath: "rtp_batches/p1_jan2025.json", defaultSubjectCode: "FND_P1" },
    { filePath: "rtp_batches/p1_may2025.json", defaultSubjectCode: "FND_P1" },
    { filePath: "rtp_batches/p1_sep2025.json", defaultSubjectCode: "FND_P1" },
    { filePath: "rtp_batches/p2_jan2025.json", defaultSubjectCode: "FND_P2" },
    { filePath: "rtp_batches/p2_may2025.json", defaultSubjectCode: "FND_P2" },
    { filePath: "rtp_batches/p2_sep2025.json", defaultSubjectCode: "FND_P2" },
    { filePath: "rtp_batches/p3_jan2025.json", defaultSubjectCode: "FND_P3" },
    { filePath: "rtp_batches/p3_may2025.json", defaultSubjectCode: "FND_P3" },
    { filePath: "rtp_batches/p3_sep2025.json", defaultSubjectCode: "FND_P3" },
    { filePath: "rtp_batches/p4_jan2025.json", defaultSubjectCode: "FND_P4" },
    { filePath: "rtp_batches/p4_may2025.json", defaultSubjectCode: "FND_P4" },
    { filePath: "rtp_batches/p4_sep2025.json", defaultSubjectCode: "FND_P4" },
  ];

  let grandTotalInserted = 0;
  const caseStudyCache = new Map<string, string>();

  const subjectCodeMap: Record<string, string> = {
    FND_P1: "PAPER_1",
    P1: "PAPER_1",
    PAPER_1: "PAPER_1",
    FND_P2: "PAPER_2",
    P2: "PAPER_2",
    PAPER_2: "PAPER_2",
    FND_P3: "PAPER_3",
    P3: "PAPER_3",
    PAPER_3: "PAPER_3",
    FND_P4: "PAPER_4",
    P4: "PAPER_4",
    PAPER_4: "PAPER_4",
  };

  // 5. PROCESS AND INSERT EACH BATCH
  for (const bInfo of batchFiles) {
    if (!fs.existsSync(bInfo.filePath)) {
      console.warn(`[WARN] Batch file not found: ${bInfo.filePath}`);
      continue;
    }

    const rawData = fs.readFileSync(bInfo.filePath, "utf8");
    const data = JSON.parse(rawData) as BatchFile;
    if (!data.questions || data.questions.length === 0) continue;

    const mappedSubCode = subjectCodeMap[bInfo.defaultSubjectCode] || bInfo.defaultSubjectCode;
    const defaultSubject = subjectByCode.get(mappedSubCode);
    if (!defaultSubject) {
      throw new Error(`Could not resolve subject for code ${bInfo.defaultSubjectCode} (mapped to ${mappedSubCode})`);
    }
    const defaultNode = defaultNodeBySubject.get(defaultSubject.id);

    console.log(`\n--> Ingesting ${bInfo.filePath} (${data.questions.length} questions)...`);

    const safeMonth = (() => {
      const m = data.sourceMonth;
      if (typeof m === "number") return m;
      if (!m) return 5;
      const s = String(m).toLowerCase();
      const map: Record<string, number> = {
        jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
        apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7,
        aug: 8, august: 8, sep: 9, september: 9, oct: 10, october: 10,
        nov: 11, november: 11, dec: 12, december: 12
      };
      return map[s] || parseInt(s, 10) || 5;
    })();

    const resolvedSourceType =
      (data.sourceType as any) ||
      (data as any).batchMetadata?.sourceType ||
      (bInfo.filePath.toLowerCase().includes("mtp") ? "MTP" : undefined) ||
      (bInfo.filePath.toLowerCase().includes("rtp") ? "RTP" : "STUDY_MATERIAL");
    const resolvedBatchName =
      data.batchName || (data as any).batchMetadata?.name || path.basename(bInfo.filePath, ".json");
    const resolvedSourceTitle =
      data.sourceTitle || (data as any).batchMetadata?.sourceTitle || resolvedBatchName;

    // Create Import Batch Container
    const [batchRecord] = await db
      .insert(importBatches)
      .values({
        batchName: resolvedBatchName,
        schemaVersion: "1.0",
        academicLevelId: fndLevel.id,
        curriculumVersionId: activeVersion.id,
        subjectId: defaultSubject?.id,
        sourceType: resolvedSourceType,
        sourceTitle: resolvedSourceTitle,
        sourceYear: data.sourceYear || (data as any).batchMetadata?.sourceYear || 2025,
        sourceMonth: safeMonth,
        status: "COMPLETED",
        totalQuestions: data.questions.length,
        validQuestionsCount: data.questions.length,
        approvedCount: data.questions.length,
        publishedCount: data.questions.length,
      })
      .returning();

    // Create Question Source
    const [sourceRecord] = await db
      .insert(questionSources)
      .values({
        sourceType: resolvedSourceType,
        sourceTitle: resolvedSourceTitle,
        sourceYear: data.sourceYear || (data as any).batchMetadata?.sourceYear || 2025,
        sourceMonth: safeMonth,
        importBatchId: batchRecord.id,
      })
      .returning();

    // Process in chunks of 50 to ensure safe payload size
    const chunkSize = 50;
    for (let c = 0; c < data.questions.length; c += chunkSize) {
      const chunk = data.questions.slice(c, c + chunkSize);

      // Handle Case Studies if any
      for (const q of chunk) {
        if (q.questionType === "CASE_STUDY" && q.caseStudy) {
          const csKey = (q.caseStudyRef || q.caseStudy.title || "").trim();
          if (csKey && !caseStudyCache.has(csKey)) {
            const [cs] = await db
              .insert(caseStudies)
              .values({
                academicLevelId: fndLevel.id,
                subjectId: defaultSubject!.id,
                title: q.caseStudy.title,
                scenarioText: q.caseStudy.scenarioText,
              })
              .returning();
            caseStudyCache.set(csKey, cs.id);
          }
        }
      }

      // Map questions strictly to the batch's default subject
      const questionsToInsert = chunk.map((q) => {
        const nodeCode = (q.canonicalNodeCode || q.nodeCode || "").trim();
        let node: typeof allNodes[0] | undefined = undefined;

        if (nodeCode.length >= 3) {
          const directMatch = nodeByCode.get(nodeCode);
          if (directMatch && directMatch.subjectId === defaultSubject!.id) {
            node = directMatch;
          } else {
            node = allNodes.find(
              (n) => n.subjectId === defaultSubject!.id && (n.code.startsWith(nodeCode) || nodeCode.startsWith(n.code))
            );
          }
        }

        if (!node) {
          node = defaultNode;
        }

        const subjectId = defaultSubject!.id;
        const nodeId = node ? node.id : defaultNode!.id;

        let csId: string | null = null;
        if (q.questionType === "CASE_STUDY" && q.caseStudy) {
          const csKey = (q.caseStudyRef || q.caseStudy.title || "").trim();
          csId = caseStudyCache.get(csKey) || null;
        }

        return {
          academicLevelId: fndLevel.id,
          subjectId,
          curriculumNodeId: nodeId,
          caseStudyId: csId,
          difficulty: q.difficulty || "MEDIUM",
          questionType: q.questionType || "MCQ",
          isAiGenerated: false,
        };
      });

      const insertedQs = await db
        .insert(questions)
        .values(questionsToInsert)
        .returning({ id: questions.id });

      // Insert question versions
      const versionsToInsert = chunk.map((q, idx) => ({
        questionId: insertedQs[idx].id,
        versionNumber: 1,
        questionText: q.questionText,
        correctAnswer: q.correctAnswer.toUpperCase(),
        explanation: q.explanation || `Correct answer is (${q.correctAnswer.toUpperCase()}).`,
        sourceId: sourceRecord.id,
        isActive: true,
      }));

      const insertedVersions = await db
        .insert(questionVersions)
        .values(versionsToInsert)
        .returning({ id: questionVersions.id });

      // Insert question options with entity-level isCorrect
      const optionsToInsert: {
        questionVersionId: string;
        optionLetter: string;
        optionText: string;
        isCorrect: boolean;
      }[] = [];

      chunk.forEach((q, idx) => {
        const vId = insertedVersions[idx].id;
        const normCorrect = q.correctAnswer.trim().toUpperCase();

        q.options.forEach((opt) => {
          const normOptLetter = opt.letter.trim().toUpperCase();
          optionsToInsert.push({
            questionVersionId: vId,
            optionLetter: normOptLetter,
            optionText: opt.text,
            isCorrect: normOptLetter === normCorrect,
          });
        });
      });

      if (optionsToInsert.length > 0) {
        await db.insert(questionOptions).values(optionsToInsert);
      }

      grandTotalInserted += chunk.length;
    }

    console.log(`   -> Completed ${bInfo.filePath}. Cumulative questions inserted: ${grandTotalInserted}`);
  }

  console.log("\n=================================================================");
  console.log(`=== UNIVERSAL RE-INGESTION COMPLETE! TOTAL INSERTED: ${grandTotalInserted} ===`);
  console.log("=================================================================\n");
}

main().catch((err) => {
  console.error("Re-ingestion failed:", err);
  process.exit(1);
});
