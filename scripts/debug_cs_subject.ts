import { db } from "../src/db";
import { questions, subjects, curriculumNodes } from "../src/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  const csQs = await db
    .select({
      id: questions.id,
      subjectId: questions.subjectId,
      curriculumNodeId: questions.curriculumNodeId,
      type: questions.questionType,
    })
    .from(questions)
    .where(eq(questions.questionType, "CASE_STUDY"))
    .limit(5);

  console.log("Found CASE_STUDY questions in DB:", csQs.length);
  console.log(csQs);

  if (csQs.length > 0) {
    const [sub] = await db.select().from(subjects).where(eq(subjects.id, csQs[0].subjectId)).limit(1);
    console.log("Subject of first CASE_STUDY:", sub);
  }
}

main().catch(console.error);
