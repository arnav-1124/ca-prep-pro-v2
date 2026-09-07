import { selectNextEligibleQuestion } from "../src/domains/practice/services/selector";
import { db } from "../src/db";
import { academicLevels, curriculumVersions } from "../src/db/schema";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

async function main() {
  const [fnd] = await db.select().from(academicLevels).where(eq(academicLevels.code, "FOUNDATION"));
  const [ver] = await db.select().from(curriculumVersions).where(and(eq(curriculumVersions.academicLevelId, fnd.id), eq(curriculumVersions.isActive, true)));

  console.log("Testing Case Study Selection with different seeds:");
  for (let i = 1; i <= 5; i++) {
    const seed = Math.floor(Math.random() * 2147483647);
    const q = await selectNextEligibleQuestion(crypto.randomUUID(), seed, {
      academicLevelId: fnd.id,
      curriculumVersionId: ver.id,
      practiceMode: "CASE_STUDY",
      difficulty: "ANY",
    });
    console.log(`Seed ${seed}: Case="${q?.caseStudyTitle?.slice(0, 35)}" Q="${q?.questionText.slice(0, 35)}" QuestionId=${q?.questionId}`);
  }

  console.log("\nTesting Standalone MCQ Selection with different seeds:");
  for (let i = 1; i <= 5; i++) {
    const seed = Math.floor(Math.random() * 2147483647);
    const q = await selectNextEligibleQuestion(crypto.randomUUID(), seed, {
      academicLevelId: fnd.id,
      curriculumVersionId: ver.id,
      practiceMode: "QUESTION",
      difficulty: "ANY",
    });
    console.log(`Seed ${seed}: Question="${q?.questionText?.slice(0, 40)}" QuestionId=${q?.questionId}`);
  }
}

main().catch(console.error);
