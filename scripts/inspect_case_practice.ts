import { db } from "../src/db";
import { caseStudies, questions, practiceSessions, practiceSessionQuestions } from "../src/db/schema";
import { eq, sql, desc } from "drizzle-orm";

async function main() {
  console.log("=== CASE STUDIES AND QUESTIONS ===");
  const csCounts = await db
    .select({
      caseId: caseStudies.id,
      title: caseStudies.title,
      questionCount: sql<number>`count(${questions.id})`
    })
    .from(caseStudies)
    .innerJoin(questions, eq(questions.caseStudyId, caseStudies.id))
    .groupBy(caseStudies.id, caseStudies.title)
    .limit(10);
  console.table(csCounts);

  console.log("\n=== RECENT PRACTICE SESSIONS ===");
  const recentSessions = await db
    .select({
      id: practiceSessions.id,
      practiceMode: practiceSessions.practiceMode,
      questionCount: practiceSessions.questionCount,
      status: practiceSessions.status,
      startedAt: practiceSessions.startedAt,
    })
    .from(practiceSessions)
    .orderBy(desc(practiceSessions.startedAt))
    .limit(5);
  console.table(recentSessions);

  if (recentSessions.length > 0) {
    const latest = recentSessions[0];
    const delivered = await db
      .select({
        seq: practiceSessionQuestions.sequenceNumber,
        qId: practiceSessionQuestions.questionId,
        qvId: practiceSessionQuestions.questionVersionId,
      })
      .from(practiceSessionQuestions)
      .where(eq(practiceSessionQuestions.practiceSessionId, latest.id));
    console.log(`\nDelivered questions for latest session (${latest.id}): ${delivered.length}`);
    console.table(delivered);
  }
}

main().catch(console.error);
