import { db } from "../src/db";
import { caseStudies, questions, curriculumNodes, subjects } from "../src/db/schema";
import { eq, inArray } from "drizzle-orm";

function cleanScenarioText(raw: string): string {
  let text = raw;

  // 1. Remove form-feed characters
  text = text.replace(/\f/g, "\n");

  // 2. Remove standalone page numbers (e.g. line with just 80, 81, 648, etc.)
  text = text.replace(/(?:^|\n)\s*\d{1,4}\s*(?=\n|$)/g, "\n");

  // 3. Remove marks like (7 Marks), (3+3 = 6 Marks), (4 Marks), (6 Statements x 2 Marks = 12 Marks)
  text = text.replace(/\(\s*\d+(?:\s*[+x]\s*\d+)*\s*=\s*\d+\s*Marks\s*\)/gi, "");
  text = text.replace(/\(\s*\d+\s*Marks\s*\)/gi, "");

  // 4. Fix hyphenated word breaks (e.g. "con-\ntract" -> "contract")
  text = text.replace(/(\b[A-Za-z]+)-\s*\n\s*([A-Za-z]+\b)/g, "$1$2");

  // 5. Split into non-empty lines and merge wrapped lines inside paragraphs
  const rawLines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);

  const paragraphs: string[] = [];
  let current = "";

  for (const line of rawLines) {
    const isNewBlock =
      /^(?:\([a-z0-9ivx]+\)|\d+\.|[A-Z]\.|\*|•|I\.|II\.|III\.|IV\.|V\.)\s+/i.test(line) ||
      /^Scenario\b/i.test(line) ||
      /^Case\b/i.test(line);

    if (!current) {
      current = line;
    } else if (isNewBlock) {
      paragraphs.push(current);
      current = line;
    } else {
      const endsWithPunct = /[.?!:]\s*["']?$/.test(current);
      const nextStartsCapital = /^[A-Z]/.test(line);

      if (endsWithPunct && nextStartsCapital && current.length > 150) {
        paragraphs.push(current);
        current = line;
      } else {
        current += " " + line;
      }
    }
  }

  if (current) {
    paragraphs.push(current);
  }

  return paragraphs.join("\n\n").trim();
}

async function main() {
  console.log("=== CLEANING & ENRICHING ALL CASE STUDY RECORDS IN NEON DB ===");

  // Fetch all case studies
  const allCs = await db.select().from(caseStudies);
  console.log(`Found ${allCs.length} Case Studies in database.`);

  let updatedCount = 0;
  for (const cs of allCs) {
    const cleanedText = cleanScenarioText(cs.scenarioText);

    // Clean up title if it contains truncated ellipsis or weird formatting
    let cleanTitle = cs.title;
    const mtpMatch = cs.title.match(/MTP\s*(\d+)\s*(?:Case Study:)?\s*Q?(\d+)?(?:\(([a-z0-9ivx]+)\))?/i);
    if (mtpMatch) {
      const mtpNum = mtpMatch[1];
      const qNum = mtpMatch[2] || "1";
      const subPart = mtpMatch[3] ? `(${mtpMatch[3]})` : "";

      // Fetch the question to get the curriculum node or statute name
      const [linkedQ] = await db
        .select({
          nodeId: questions.curriculumNodeId,
        })
        .from(questions)
        .where(eq(questions.caseStudyId, cs.id))
        .limit(1);

      let topicName = "Business Laws Case Scenario";
      if (linkedQ?.nodeId) {
        const [node] = await db
          .select({ name: curriculumNodes.name, code: curriculumNodes.code })
          .from(curriculumNodes)
          .where(eq(curriculumNodes.id, linkedQ.nodeId))
          .limit(1);

        if (node?.name) {
          topicName = node.name;
        }
      }

      cleanTitle = `MTP ${mtpNum} — Case Scenario ${qNum}${subPart}: ${topicName}`;
    }

    // Only update if changed
    if (cleanedText !== cs.scenarioText || cleanTitle !== cs.title) {
      await db
        .update(caseStudies)
        .set({
          title: cleanTitle,
          scenarioText: cleanedText,
        })
        .where(eq(caseStudies.id, cs.id));
      updatedCount++;
    }
  }

  console.log(`✓ Updated and polished ${updatedCount} Case Studies successfully!`);
}

main().catch((err) => {
  console.error("Failed to clean case studies:", err);
  process.exit(1);
});
