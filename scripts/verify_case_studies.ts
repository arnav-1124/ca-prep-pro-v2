import { db } from "../src/db";
import { questions, questionVersions, questionOptions, caseStudies, subjects, academicLevels } from "../src/db/schema";
import { eq, and } from "drizzle-orm";

async function main() {
  console.log("=== VERIFYING PAPER 2 CASE STUDY QUESTIONS IN DB ===");

  // Fetch Foundation Paper 2
  const [fnd] = await db
    .select()
    .from(academicLevels)
    .where(eq(academicLevels.code, "FOUNDATION"))
    .limit(1);

  const [p2] = await db
    .select()
    .from(subjects)
    .where(
      and(
        eq(subjects.code, "PAPER_2"),
        eq(subjects.academicLevelId, fnd.id)
      )
    )
    .limit(1);

  if (!p2) {
    throw new Error("Paper 2 not found.");
  }

  // Count CASE_STUDY questions in Paper 2
  const csQuestions = await db
    .select({
      id: questions.id,
      questionType: questions.questionType,
      caseStudyId: questions.caseStudyId,
      csTitle: caseStudies.title,
      scenarioSnippet: caseStudies.scenarioText,
      qText: questionVersions.questionText,
      correctAnswer: questionVersions.correctAnswer,
      explanation: questionVersions.explanation,
    })
    .from(questions)
    .innerJoin(questionVersions, eq(questions.id, questionVersions.questionId))
    .leftJoin(caseStudies, eq(questions.caseStudyId, caseStudies.id))
    .where(
      and(
        eq(questions.subjectId, p2.id),
        eq(questions.questionType, "CASE_STUDY")
      )
    )
    .limit(3);

  console.log(`Sample of 3 published Case Study questions:`);
  for (const q of csQuestions) {
    console.log(`\n----------------------------------------`);
    console.log(`Question ID: ${q.id}`);
    console.log(`Type: ${q.questionType}`);
    console.log(`Case Study Ref ID: ${q.caseStudyId}`);
    console.log(`Case Study Title: ${q.csTitle}`);
    console.log(`Scenario: ${q.scenarioSnippet?.slice(0, 160)}...`);
    console.log(`Question: ${q.qText?.slice(0, 140)}...`);
    console.log(`Correct Answer: ${q.correctAnswer}`);
    console.log(`Explanation: ${q.explanation?.slice(0, 160)}...`);

    // Fetch options
    const [activeVersion] = await db
      .select({ id: questionVersions.id })
      .from(questionVersions)
      .where(eq(questionVersions.questionId, q.id))
      .limit(1);

    if (activeVersion) {
      const opts = await db
        .select()
        .from(questionOptions)
        .where(eq(questionOptions.questionVersionId, activeVersion.id));
      console.log(`Options (${opts.length}):`);
      for (const o of opts) {
        console.log(`  [${o.optionLetter}]: ${o.optionText.slice(0, 100)}...`);
      }
    }
  }

  // Count total case studies created
  const totalCs = await db.select().from(caseStudies);
  console.log(`\nTotal Case Studies in database: ${totalCs.length}`);
}

main().catch(console.error);
