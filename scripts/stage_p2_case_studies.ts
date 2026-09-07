import * as fs from "fs";
import * as path from "path";
import { db } from "../src/db";
import {
  importBatches,
  importedQuestions,
  academicLevels,
  curriculumVersions,
  subjects,
} from "../src/db/schema";
import { eq, and, ne } from "drizzle-orm";
import { createImportBatch, recalculateBatchCounts } from "../src/domains/questions/import/services";

async function main() {
  console.log("=== STAGING & APPROVING PAPER 2 CASE STUDY QUESTIONS ===");
  const adminEmail = "admin@caprep.pro";

  // 1. Resolve Academic Level & Version
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

  const [lawSubject] = await db
    .select()
    .from(subjects)
    .where(
      and(
        eq(subjects.academicLevelId, fndLevel.id),
        eq(subjects.code, "PAPER_2")
      )
    )
    .limit(1);

  if (!lawSubject) {
    throw new Error("Paper 2 (Business Laws) not found in database.");
  }

  const batchFilePath = "foundation_mtp_2025_p2_case_studies.json";
  const rawJson = fs.readFileSync(batchFilePath, "utf8");
  const batchObj = JSON.parse(rawJson);

  // Copy to ingestion directory for permanent archival
  const targetDir = path.resolve("ingestion/batches/mtp");
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  fs.writeFileSync(path.join(targetDir, "foundation_mtp_2025_p2_case_studies.json"), rawJson);

  console.log(`Payload: ${batchObj.batchName} (${batchObj.questions.length} questions)`);

  // 2. Stage batch via createImportBatch
  console.log("Creating staging batch in Neon PostgreSQL...");
  const stagingResult = await createImportBatch({
    rawJsonString: rawJson,
    batchName: batchObj.batchName,
    academicLevelId: fndLevel.id,
    curriculumVersionId: activeVersion.id,
    subjectId: lawSubject.id,
    sourceType: "MTP",
    sourceTitle: "ICAI BoS Foundation Model Test Papers (Feb 2025) — Business Laws Case Scenarios",
    sourceYear: 2025,
    sourceMonth: 2,
    adminEmail,
  });
  console.log("✓ Batch Staged Successfully:", stagingResult);

  const batchId = stagingResult.batchId;

  // 3. Auto-approve valid & mapped questions that are not exact duplicates
  console.log(`Approving valid questions in batch ${batchId}...`);
  await db
    .update(importedQuestions)
    .set({
      status: "APPROVED",
      reviewedBy: adminEmail,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(importedQuestions.batchId, batchId),
        eq(importedQuestions.status, "PENDING_REVIEW"),
        ne(importedQuestions.validationStatus, "INVALID"),
        ne(importedQuestions.curriculumMappingStatus, "UNMAPPED"),
        ne(importedQuestions.duplicateStatus, "EXACT_DUPLICATE")
      )
    );

  // If any are exact duplicates, reject them
  await db
    .update(importedQuestions)
    .set({
      status: "REJECTED",
      rejectionReason: "DUPLICATE_QUESTION",
      rejectionNotes: "Exact text matched existing question in Question Bank.",
      reviewedBy: adminEmail,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(importedQuestions.batchId, batchId),
        eq(importedQuestions.status, "PENDING_REVIEW"),
        eq(importedQuestions.duplicateStatus, "EXACT_DUPLICATE")
      )
    );

  await recalculateBatchCounts(batchId);

  const [batch] = await db.select().from(importBatches).where(eq(importBatches.id, batchId)).limit(1);
  console.log(`\nBatch Summary:`);
  console.log(`- Batch ID: ${batch.id}`);
  console.log(`- Total Questions: ${batch.totalQuestions}`);
  console.log(`- Valid: ${batch.validQuestionsCount}`);
  console.log(`- Approved: ${batch.approvedCount}`);
  console.log(`- Rejected: ${batch.rejectedCount}`);
  console.log(`- Status: ${batch.status}`);
}

main().catch((err) => {
  console.error("Staging failed:", err);
  process.exit(1);
});
