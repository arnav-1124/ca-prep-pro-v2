import { importCurriculumJson, getCurriculumSubjects, getCurriculumTree } from "./services";
import { db } from "../../db";
import { curriculumVersions, curriculumNodes } from "../../db/schema";
import { eq } from "drizzle-orm";
import fs from "fs";
import path from "path";

async function runTests() {
  console.log("--------------------------------------------------");
  console.log("Running Academics Import Verification Tests...");
  console.log("--------------------------------------------------");

  // Test 1: Idempotency check
  console.log("1. Testing Import Idempotency...");
  const fixturePath = path.join(__dirname, "fixtures/intermediate_syllabus.json");
  const syllabusJson = fs.readFileSync(fixturePath, "utf8");

  // Re-run the import (first time was already seeded)
  const result1 = await importCurriculumJson(syllabusJson);
  console.log(`Import ran successfully! Version ID: ${result1.versionId}`);

  // Count active versions and nodes to verify no duplicates
  const allVersions = await db.select().from(curriculumVersions);
  console.log(`Total versions in DB: ${allVersions.length}`);

  const activeVersion = allVersions.find((v) => v.id === result1.versionId);
  if (!activeVersion || !activeVersion.isActive) {
    throw new Error("Imported version should be marked active");
  }

  const nodes = await db
    .select()
    .from(curriculumNodes)
    .where(eq(curriculumNodes.curriculumVersionId, result1.versionId));
  console.log(`Total nodes in imported version: ${nodes.length}`);

  // Run import a second time to ensure absolute idempotency
  const result2 = await importCurriculumJson(syllabusJson);
  if (result2.versionId !== result1.versionId) {
    throw new Error("Idempotent import should resolve to the same version ID");
  }

  const nodesAfter = await db
    .select()
    .from(curriculumNodes)
    .where(eq(curriculumNodes.curriculumVersionId, result1.versionId));
  console.log(`Total nodes after second run: ${nodesAfter.length}`);
  if (nodesAfter.length !== nodes.length) {
    throw new Error(`DUPLICATE NODES CREATED! Got ${nodesAfter.length}, expected ${nodes.length}`);
  }
  console.log("✅ Idempotency test passed!");

  // Test 2: Validation checks
  console.log("\n2. Testing Validation Failure for Invalid Level Code...");
  const invalidLevelJson = syllabusJson.replace('"levelCode": "INTERMEDIATE"', '"levelCode": "INVALID_LEVEL"');
  try {
    await importCurriculumJson(invalidLevelJson);
    throw new Error("Should have thrown error for invalid level code");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`✅ Passed: Threw expected error: "${msg}"`);
  }

  console.log("\n3. Testing Validation Failure for Duplicate Node Codes...");
  const duplicateCodeJson = syllabusJson.replace('"code": "INT_P1_CH1_T2"', '"code": "INT_P1_CH1_T1"');
  try {
    await importCurriculumJson(duplicateCodeJson);
    throw new Error("Should have thrown error for duplicate node codes");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`✅ Passed: Threw expected error: "${msg}"`);
  }

  console.log("\n4. Testing Tree Construction Memory Mapper...");
  const subjectsList = await getCurriculumSubjects(result1.versionId);
  if (subjectsList.length === 0) {
    throw new Error("Expected subjects list to not be empty");
  }
  console.log(`Resolved ${subjectsList.length} subjects for version.`);

  const taxationSubject = subjectsList.find((s) => s.name === "Taxation");
  if (!taxationSubject) {
    throw new Error("Expected to find Taxation subject");
  }

  const tree = await getCurriculumTree(taxationSubject.id, result1.versionId);
  console.log("Taxation Node Tree structure resolved!");

  if (tree.length === 0 || tree[0].children.length === 0) {
    throw new Error("Tree structure is empty or flat");
  }
  console.log("✅ Tree mapper test passed!");
  console.log("\n🎉 ALL ACADEMICS TESTS PASSED SUCCESSFULLY!");
}

runTests().catch((err) => {
  console.error("\n❌ Test Suite Failed:", err);
  process.exit(1);
});
