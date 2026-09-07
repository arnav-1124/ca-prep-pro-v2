import { db } from "../src/db";
import { questions, questionVersions, questionSources, subjects } from "../src/db/schema";
import { eq, sql } from "drizzle-orm";

async function main() {
  console.log("=== BREAKDOWN BY SUBJECT AND SOURCE TYPE ===");

  const rows = await db
    .select({
      subjectCode: subjects.code,
      subjectName: subjects.name,
      sourceType: questionSources.sourceType,
      count: sql<number>`count(*)`,
    })
    .from(questions)
    .innerJoin(questionVersions, eq(questions.id, questionVersions.questionId))
    .leftJoin(questionSources, eq(questionVersions.sourceId, questionSources.id))
    .innerJoin(subjects, eq(questions.subjectId, subjects.id))
    .groupBy(subjects.code, subjects.name, questionSources.sourceType)
    .orderBy(subjects.code, questionSources.sourceType);

  console.table(rows);

  const totalsBySubject = await db
    .select({
      subjectCode: subjects.code,
      subjectName: subjects.name,
      totalQuestions: sql<number>`count(*)`,
    })
    .from(questions)
    .innerJoin(subjects, eq(questions.subjectId, subjects.id))
    .groupBy(subjects.code, subjects.name)
    .orderBy(subjects.code);

  console.log("\nTotals By Subject:");
  console.table(totalsBySubject);
}

main().catch(console.error);
