import { db } from "./index";
import { academicLevels } from "./schema";
import { importCurriculumJson } from "../domains/academics/services";
import fs from "fs";
import path from "path";

async function main() {
  console.log("Seeding academic levels...");
  
  const levels = [
    { code: "FOUNDATION", name: "CA Foundation" },
    { code: "INTERMEDIATE", name: "CA Intermediate" },
    { code: "FINAL", name: "CA Final" },
  ];

  for (const level of levels) {
    await db
      .insert(academicLevels)
      .values(level)
      .onConflictDoUpdate({
        target: academicLevels.code,
        set: { name: level.name },
      });
  }
  console.log("Seeding academic levels completed.");

  console.log("Importing CA Intermediate syllabus...");
  const fixturePath = path.join(__dirname, "../domains/academics/fixtures/intermediate_syllabus.json");
  const syllabusJson = fs.readFileSync(fixturePath, "utf8");
  const result = await importCurriculumJson(syllabusJson);
  console.log(`CA Intermediate syllabus imported! Version ID: ${result.versionId}`);
}

main()
  .then(() => {
    console.log("Seeding completed successfully!");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Seeding failed:", err);
    process.exit(1);
  });
