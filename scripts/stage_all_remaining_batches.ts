import fs from "fs";
import path from "path";
import { db } from "../src/db";
import { academicLevels, curriculumVersions, subjects, importBatches } from "../src/db/schema";
import { eq, and } from "drizzle-orm";
import { createImportBatch } from "../src/domains/questions/import/services";

async function main() {
  console.log("=== STAGING ALL REMAINING CA FOUNDATION BATCHES ===");

  const [fndLevel] = await db
    .select()
    .from(academicLevels)
    .where(eq(academicLevels.code, "FOUNDATION"))
    .limit(1);

  if (!fndLevel) throw new Error("CA Foundation level not found in database.");

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

  if (!activeVersion) throw new Error("Active curriculum version for Foundation not found.");

  const allSubjects = await db
    .select()
    .from(subjects)
    .where(eq(subjects.academicLevelId, fndLevel.id));

  const p1 = allSubjects.find((s) => s.code === "PAPER_1");
  const p2 = allSubjects.find((s) => s.code === "PAPER_2");
  const p3 = allSubjects.find((s) => s.code === "PAPER_3");

  const batchesToStage = [
    {
      file: "foundation_sm_p1_accounting.json",
      name: "CA Foundation Paper 1: Accounting (All 11 Chapters)",
      subjectId: p1?.id,
    },
    {
      file: "foundation_sm_p2_business_laws.json",
      name: "CA Foundation Paper 2: Business Laws (All 7 Chapters)",
      subjectId: p2?.id,
    },
    {
      file: "foundation_sm_p3_math_part1.json",
      name: "CA Foundation Paper 3: Business Mathematics (Part 1: Ch 1 to 4)",
      subjectId: p3?.id,
    },
    {
      file: "foundation_sm_p3_math_part2.json",
      name: "CA Foundation Paper 3: Business Mathematics (Part 2: Ch 5 to 6)",
      subjectId: p3?.id,
    },
    {
      file: "foundation_sm_p3_math_part3.json",
      name: "CA Foundation Paper 3: Business Mathematics (Part 3: Ch 7 to 8)",
      subjectId: p3?.id,
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

    console.log(`\nStaging "${b.name}" from ${b.file}...`);
    const rawJson = fs.readFileSync(filePath, "utf-8");

    const result = await createImportBatch({
      rawJsonString: rawJson,
      batchName: b.name,
      academicLevelId: fndLevel.id,
      curriculumVersionId: activeVersion.id,
      subjectId: b.subjectId,
      sourceType: "STUDY_MATERIAL",
      sourceTitle: "ICAI Foundation Study Material 2025-2026 (May 2026 Onwards)",
      sourceYear: 2026,
      sourceMonth: 5,
      adminEmail: "admin@caprep.pro",
    });

    console.log(`  ✓ Batch Staged: ${result.batchId}`);
    console.log(`    Total Questions: ${result.totalQuestions}`);
    console.log(`    Valid Questions: ${result.validCount}`);
    console.log(`    Duplicate Candidates: ${result.duplicateCandidatesCount}`);
  }

  console.log("\nAll remaining batches staged successfully!");
}

main().catch(console.error);
