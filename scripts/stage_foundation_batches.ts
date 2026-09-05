import fs from "fs";
import path from "path";
import { db } from "../src/db";
import { academicLevels, curriculumVersions, subjects, importBatches } from "../src/db/schema";
import { eq, and } from "drizzle-orm";
import { createImportBatch } from "../src/domains/questions/import/services";

async function main() {
  console.log("=== STAGING CA FOUNDATION STUDY MATERIAL BATCHES ===");

  // 1. Resolve Academic Level & Active Version
  const [fndLevel] = await db
    .select()
    .from(academicLevels)
    .where(eq(academicLevels.code, "FOUNDATION"))
    .limit(1);

  if (!fndLevel) {
    throw new Error("CA Foundation level not found in database.");
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
    throw new Error("Active curriculum version for Foundation not found.");
  }

  const [p4Subject] = await db
    .select()
    .from(subjects)
    .where(
      and(
        eq(subjects.academicLevelId, fndLevel.id),
        eq(subjects.code, "PAPER_4")
      )
    )
    .limit(1);

  const [p3Subject] = await db
    .select()
    .from(subjects)
    .where(
      and(
        eq(subjects.academicLevelId, fndLevel.id),
        eq(subjects.code, "PAPER_3")
      )
    )
    .limit(1);

  console.log(`Level: ${fndLevel.name} (${fndLevel.id})`);
  console.log(`Version: ${activeVersion.name} (${activeVersion.id})`);
  console.log(`Subject Paper 4: ${p4Subject?.name} (${p4Subject?.id})`);
  console.log(`Subject Paper 3: ${p3Subject?.name} (${p3Subject?.id})`);

  const batchesToStage = [
    {
      file: "foundation_sm_p4_part1_micro.json",
      name: "CA Foundation Paper 4: Business Economics (Part 1: Microeconomics)",
      subjectId: p4Subject?.id,
    },
    {
      file: "foundation_sm_p4_part2_macro.json",
      name: "CA Foundation Paper 4: Business Economics (Part 2: Macroeconomics & Indian Economy)",
      subjectId: p4Subject?.id,
    },
    {
      file: "foundation_sm_p3_logical_reasoning.json",
      name: "CA Foundation Paper 3: Quantitative Aptitude (Part B: Logical Reasoning)",
      subjectId: p3Subject?.id,
    },
    {
      file: "foundation_sm_p3_statistics_descriptive.json",
      name: "CA Foundation Paper 3: Quantitative Aptitude (Part C: Statistics - Descriptive)",
      subjectId: p3Subject?.id,
    },
    {
      file: "foundation_sm_p3_statistics_probability.json",
      name: "CA Foundation Paper 3: Quantitative Aptitude (Part C: Statistics - Probability & Inference)",
      subjectId: p3Subject?.id,
    },
  ];

  const existingBatches = await db.select().from(importBatches);
  const existingNames = new Set(existingBatches.map((b) => b.batchName));

  for (const b of batchesToStage) {
    if (existingNames.has(b.name)) {
      console.log(`\nBatch already exists in DB, skipping: "${b.name}"`);
      continue;
    }

    const filePath = path.join(__dirname, "../ingestion/batches", b.file);
    if (!fs.existsSync(filePath)) {
      console.warn(`Batch file not found: ${filePath}`);
      continue;
    }

    console.log(`\nStaging ${b.name} from ${b.file}...`);
    const rawJson = fs.readFileSync(filePath, "utf-8");

    const result = await createImportBatch({
      rawJsonString: rawJson,
      batchName: b.name,
      academicLevelId: fndLevel.id,
      curriculumVersionId: activeVersion.id,
      subjectId: b.subjectId,
      sourceType: "STUDY_MATERIAL",
      sourceTitle: "ICAI Study Material 2025-2026",
      sourceYear: 2026,
      sourceMonth: 5,
      adminEmail: "admin@caprep.pro",
    });

    console.log(`✓ Successfully staged batch: ${result.batchId}`);
    console.log(`  Batch Name: ${result.batchName}`);
    console.log(`  Total Staged Questions: ${result.totalQuestions}`);
    console.log(`  Valid Questions: ${result.validQuestions}`);
    console.log(`  Mapped Questions: ${result.mappedQuestions}`);
    console.log(`  Duplicate Candidates Flagged: ${result.duplicateCandidatesCount}`);
  }

  console.log("\n==================================================");
  console.log("ALL FOUNDATION BATCHES STAGED SUCCESSFULLY IN NEON DB!");
  console.log("==================================================");
}

main().catch((err) => {
  console.error("Failed to stage batches:", err);
  process.exit(1);
});
