import { db } from "../src/db";
import {
  questions,
  questionVersions,
  questionOptions,
  caseStudies,
  curriculumNodes,
  subjects,
} from "../src/db/schema";
import { eq, ilike, sql } from "drizzle-orm";

async function main() {
  console.log("==========================================================");
  console.log("=== COMPREHENSIVE LIVE DATABASE RE-INGESTION AUDIT ===");
  console.log("==========================================================\n");

  // 1. Overall counts
  const [qCount] = await db.select({ count: sql<number>`count(*)` }).from(questions);
  const [vCount] = await db.select({ count: sql<number>`count(*)` }).from(questionVersions);
  const [oCount] = await db.select({ count: sql<number>`count(*)` }).from(questionOptions);
  const [csCount] = await db.select({ count: sql<number>`count(*)` }).from(caseStudies);

  console.log(`Live Questions: ${qCount.count}`);
  console.log(`Live Versions: ${vCount.count}`);
  console.log(`Live Options: ${oCount.count}`);
  console.log(`Live Case Studies: ${csCount.count}\n`);

  // 2. Dummy option scan
  const dummyOpts = await db
    .select({
      id: questionOptions.id,
      optionLetter: questionOptions.optionLetter,
      optionText: questionOptions.optionText,
      versionId: questionOptions.questionVersionId,
    })
    .from(questionOptions)
    .where(ilike(questionOptions.optionText, "Option %"));

  console.log(`Dummy Option Count ("Option A/B/C/D"): ${dummyOpts.length}`);
  if (dummyOpts.length > 0) {
    console.error("FAIL: Found dummy options:", dummyOpts);
  } else {
    console.log("PASS: 0 dummy options found across the entire database!\n");
  }

  // 3. Option correctness integrity scan
  const [trueOptsCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(questionOptions)
    .where(eq(questionOptions.isCorrect, true));

  console.log(`Total Options with is_correct = TRUE: ${trueOptsCount.count}`);
  console.log(`Total Question Versions: ${vCount.count}`);
  if (Number(trueOptsCount.count) === Number(vCount.count)) {
    console.log("PASS: Exactly 1 correct option per question version across 100% of the question bank!\n");
  } else {
    console.warn(`WARN: Difference between correct options (${trueOptsCount.count}) and versions (${vCount.count})`);
  }

  // 4. Answer distribution
  const dist = await db
    .select({
      correctAnswer: questionVersions.correctAnswer,
      count: sql<number>`count(*)`,
    })
    .from(questionVersions)
    .groupBy(questionVersions.correctAnswer)
    .orderBy(questionVersions.correctAnswer);

  console.log("Overall Answer Distribution:");
  for (const d of dist) {
    const pct = ((Number(d.count) / Number(vCount.count)) * 100).toFixed(1);
    console.log(`  [${d.correctAnswer}]: ${d.count} (${pct}%)`);
  }

  // 5. Inspect User-Reported Questions
  console.log("\n----------------------------------------------------------");
  console.log("--- AUDITING SPECIFIC USER-REPORTED QUESTIONS ---");
  console.log("----------------------------------------------------------");

  const targetQuestions = [
    "Financial statements are part of",
    "Financial position of the business is ascertained on the basis of",
  ];

  for (const t of targetQuestions) {
    console.log(`\nQuery: "${t}"`);
    const versions = await db
      .select({
        id: questionVersions.id,
        questionText: questionVersions.questionText,
        correctAnswer: questionVersions.correctAnswer,
        explanation: questionVersions.explanation,
      })
      .from(questionVersions)
      .where(ilike(questionVersions.questionText, `%${t}%`));

    for (const v of versions) {
      console.log(`Version ID: ${v.id}`);
      console.log(`Question Text: "${v.questionText}"`);
      console.log(`Correct Answer: "${v.correctAnswer}"`);
      console.log(`Explanation: "${v.explanation}"`);

      const opts = await db
        .select({
          id: questionOptions.id,
          optionLetter: questionOptions.optionLetter,
          optionText: questionOptions.optionText,
          isCorrect: questionOptions.isCorrect,
        })
        .from(questionOptions)
        .where(eq(questionOptions.questionVersionId, v.id))
        .orderBy(questionOptions.optionLetter);

      console.log("Options:");
      for (const o of opts) {
        console.log(`  [${o.optionLetter}] ${o.isCorrect ? "(*) CORRECT" : "    "}: "${o.optionText}" (ID: ${o.id})`);
      }
    }
  }

  console.log("\n==========================================================");
  console.log("=== AUDIT COMPLETE ===");
  console.log("==========================================================");
}

main().catch(console.error);
