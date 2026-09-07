import { db } from "../src/db";
import { academicLevels, curriculumVersions, subjects, curriculumNodes } from "../src/db/schema";
import { eq, and } from "drizzle-orm";

async function main() {
  const [fndLevel] = await db
    .select()
    .from(academicLevels)
    .where(eq(academicLevels.code, "FOUNDATION"))
    .limit(1);

  if (!fndLevel) return;

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

  if (!activeVersion) return;

  const allSubjects = await db
    .select()
    .from(subjects)
    .where(eq(subjects.academicLevelId, fndLevel.id))
    .orderBy(subjects.sortOrder);

  for (const sub of allSubjects) {
    const nodes = await db
      .select()
      .from(curriculumNodes)
      .where(
        and(
          eq(curriculumNodes.curriculumVersionId, activeVersion.id),
          eq(curriculumNodes.subjectId, sub.id)
        )
      )
      .orderBy(curriculumNodes.sortOrder);

    console.log(`\n=== [${sub.code}] ${sub.name} (Total nodes: ${nodes.length}) ===`);
    for (const n of nodes) {
      console.log(`  ${(n.type || "").padEnd(8)}: [${n.code}] ${n.name}`);
    }
  }
}

main().catch(console.error);
