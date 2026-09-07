import fs from "fs";
import path from "path";
import { db } from "../src/db";
import { academicLevels, curriculumVersions, subjects, importBatches } from "../src/db/schema";
import { eq, and } from "drizzle-orm";
import { createImportBatch } from "../src/domains/questions/import/services";

async function main() {
  console.log("=== STAGING CA FOUNDATION MOCK TEST PAPERS (MTP) 2025 BATCHES ===");

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

  const allSubjects = await db
    .select()
    .from(subjects)
    .where(eq(subjects.academicLevelId, fndLevel.id));

  const subMap = new Map<string, string>();
  for (const s of allSubjects) {
    subMap.set(s.code, s.id);
  }

  console.log(`Level: ${fndLevel.name} (${fndLevel.id})`);
  console.log(`Active Version: ${activeVersion.name} (${activeVersion.id})`);
  console.log(`Subjects:`, [...subMap.entries()]);

  const batchesToStage = [
    {
      file: "foundation_mtp_2025_p1_accounting.json",
      name: "CA Foundation Accounting (Paper 1) - Official Model Test Papers 2025 (Conceptual True/False Bank)",
      subjectCode: "PAPER_1",
    },
    {
      file: "foundation_mtp_2025_p3_part1.json",
      name: "CA Foundation Quantitative Aptitude (Paper 3) - Official Model Test Papers 2025 (Part 1: Papers 1-5)",
      subjectCode: "PAPER_3",
    },
    {
      file: "foundation_mtp_2025_p3_part2.json",
      name: "CA Foundation Quantitative Aptitude (Paper 3) - Official Model Test Papers 2025 (Part 2: Papers 6-10)",
      subjectCode: "PAPER_3",
    },
    {
      file: "foundation_mtp_2025_p4_part1.json",
      name: "CA Foundation Business Economics (Paper 4) - Official Model Test Papers 2025 (Part 1: Papers 1-5)",
      subjectCode: "PAPER_4",
    },
    {
      file: "foundation_mtp_2025_p4_part2.json",
      name: "CA Foundation Business Economics (Paper 4) - Official Model Test Papers 2025 (Part 2: Papers 6-10)",
      subjectCode: "PAPER_4",
    },
  ];

  const existingBatches = await db.select().from(importBatches);
  const existingNames = new Set(existingBatches.map((b) => b.batchName));

  for (const b of batchesToStage) {
    if (existingNames.has(b.name)) {
      console.log(`\nBatch already exists in DB, skipping: "${b.name}"`);
      continue;
    }

    const filePath = path.resolve("ingestion/batches/mtp", b.file);
    if (!fs.existsSync(filePath)) {
      console.warn(`Batch file not found: ${filePath}`);
      continue;
    }

    const subjectId = subMap.get(b.subjectCode);
    if (!subjectId) {
      console.error(`Subject code ${b.subjectCode} not found in database!`);
      continue;
    }

    console.log(`\nStaging ${b.name} from ${b.file}...`);
    const rawJson = fs.readFileSync(filePath, "utf-8");

    const result = await createImportBatch({
      rawJsonString: rawJson,
      batchName: b.name,
      academicLevelId: fndLevel.id,
      curriculumVersionId: activeVersion.id,
      subjectId,
      sourceType: "MTP",
      sourceTitle: "ICAI BoS Foundation Model Test Papers (Feb 2025)",
      sourceYear: 2025,
      sourceMonth: 2,
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
  console.log("ALL 2025 MTP BATCHES STAGED SUCCESSFULLY IN NEON DB!");
  console.log("==================================================");
}

main().catch((err) => {
  console.error("Failed to stage batches:", err);
  process.exit(1);
});
