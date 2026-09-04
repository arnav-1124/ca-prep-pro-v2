import { importCurriculumJson } from "../src/domains/academics/services";
import { db } from "../src/db";
import { academicLevels, curriculumVersions, subjects, curriculumNodes } from "../src/db/schema";
import { eq } from "drizzle-orm";
import fs from "fs";
import path from "path";

async function main() {
  console.log("==================================================");
  console.log("SEEDING & PUBLISHING CURRICULUM FOR ALL 3 LEVELS");
  console.log("==================================================");

  const fixtures = [
    { file: "foundation_syllabus.json", level: "FOUNDATION" },
    { file: "intermediate_syllabus.json", level: "INTERMEDIATE" },
    { file: "final_syllabus.json", level: "FINAL" },
  ];

  for (const item of fixtures) {
    const filePath = path.join(__dirname, "../src/domains/academics/fixtures", item.file);
    console.log(`\nImporting ${item.level} from ${item.file}...`);
    const jsonContent = fs.readFileSync(filePath, "utf-8");
    const result = await importCurriculumJson(jsonContent);
    console.log(`  ✓ ${item.level} imported successfully! Version ID: ${result.versionId}`);

    // Ensure version is explicitly marked active
    await db
      .update(curriculumVersions)
      .set({ isActive: true })
      .where(eq(curriculumVersions.id, result.versionId));
  }

  // Verification Report
  console.log("\n==================================================");
  console.log("CURRICULUM STATE ACROSS ALL 3 LEVELS");
  console.log("==================================================");

  const levels = await db.select().from(academicLevels).orderBy(academicLevels.code);
  for (const l of levels) {
    const [activeVersion] = await db
      .select()
      .from(curriculumVersions)
      .where(eq(curriculumVersions.academicLevelId, l.id))
      .limit(1);

    const levelSubjects = await db
      .select()
      .from(subjects)
      .where(eq(subjects.academicLevelId, l.id))
      .orderBy(subjects.sortOrder);

    let totalNodes = 0;
    if (activeVersion) {
      totalNodes = await db.$count(curriculumNodes, eq(curriculumNodes.curriculumVersionId, activeVersion.id));
    }

    console.log(`\nLevel: ${l.name} (${l.code})`);
    console.log(`  Active Version: ${activeVersion?.name || "NONE"} (ID: ${activeVersion?.id}, Active: ${activeVersion?.isActive})`);
    console.log(`  Total Subjects: ${levelSubjects.length} | Total Curriculum Nodes: ${totalNodes}`);
    for (const s of levelSubjects) {
      const sNodes = await db.$count(curriculumNodes, eq(curriculumNodes.subjectId, s.id));
      console.log(`    - [${s.code}] ${s.name} (Sort: ${s.sortOrder}, Nodes: ${sNodes})`);
    }
  }

  console.log("\n==================================================");
  console.log("ALL 3 LEVELS SEEDED & ACTIVATED SUCCESSFULLY!");
  console.log("==================================================");
}

main().catch((err) => {
  console.error("Failed to seed curriculum:", err);
  process.exit(1);
});
