import { db } from "../src/db";
import { academicLevels, curriculumVersions, subjects, curriculumNodes } from "../src/db/schema";
import { eq, and } from "drizzle-orm";

async function main() {
  console.log("=== ENSURING FND_P2_CH7 EXISTS IN DATABASE ===");

  const [fndLevel] = await db
    .select()
    .from(academicLevels)
    .where(eq(academicLevels.code, "FOUNDATION"))
    .limit(1);

  if (!fndLevel) throw new Error("Foundation level not found");

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

  if (!activeVersion) throw new Error("Active version not found");

  const [p2Subject] = await db
    .select()
    .from(subjects)
    .where(
      and(
        eq(subjects.academicLevelId, fndLevel.id),
        eq(subjects.code, "PAPER_2")
      )
    )
    .limit(1);

  if (!p2Subject) throw new Error("Paper 2 subject not found");

  // Check if FND_P2_CH7 exists
  const [existingCh7] = await db
    .select()
    .from(curriculumNodes)
    .where(
      and(
        eq(curriculumNodes.curriculumVersionId, activeVersion.id),
        eq(curriculumNodes.code, "FND_P2_CH7")
      )
    )
    .limit(1);

  if (!existingCh7) {
    console.log("Inserting FND_P2_CH7 node...");
    const [inserted] = await db
      .insert(curriculumNodes)
      .values({
        curriculumVersionId: activeVersion.id,
        subjectId: p2Subject.id,
        type: "CHAPTER",
        name: "Chapter 7: The Negotiable Instruments Act, 1881",
        code: "FND_P2_CH7",
        sortOrder: 7,
        isActive: true,
      })
      .returning();

    console.log(`Inserted FND_P2_CH7 (${inserted.id})`);

    // Insert topics
    await db.insert(curriculumNodes).values([
      {
        curriculumVersionId: activeVersion.id,
        subjectId: p2Subject.id,
        parentId: inserted.id,
        type: "TOPIC",
        name: "Promissory Notes, Bills of Exchange and Cheques",
        code: "FND_P2_CH7_T1",
        sortOrder: 1,
        isActive: true,
      },
      {
        curriculumVersionId: activeVersion.id,
        subjectId: p2Subject.id,
        parentId: inserted.id,
        type: "TOPIC",
        name: "Holder, Holder in Due Course and Negotiation",
        code: "FND_P2_CH7_T2",
        sortOrder: 2,
        isActive: true,
      },
    ]);
    console.log("Inserted topics for Chapter 7!");
  } else {
    console.log("FND_P2_CH7 already exists in database.");
  }
}

main().catch(console.error);
