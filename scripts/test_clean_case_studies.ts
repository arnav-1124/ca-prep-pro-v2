import { db } from "../src/db";
import { caseStudies } from "../src/db/schema";
import { eq } from "drizzle-orm";

export function cleanText(raw: string): string {
  let text = raw;

  // 1. Remove form-feed characters
  text = text.replace(/\f/g, "\n");

  // 2. Remove standalone page numbers (e.g. line with just 80, 81, 648, etc.)
  text = text.replace(/(?:^|\n)\s*\d{1,4}\s*(?=\n|$)/g, "\n");

  // 3. Remove marks like (7 Marks), (3+3 = 6 Marks), (4 Marks)
  text = text.replace(/\(\s*\d+(?:\s*[+x]\s*\d+)*\s*=\s*\d+\s*Marks\s*\)/gi, "");
  text = text.replace(/\(\s*\d+\s*Marks\s*\)/gi, "");

  // 4. Fix hyphenated word breaks (e.g. "con-\ntract" -> "contract")
  text = text.replace(/(\b[A-Za-z]+)-\s*\n\s*([A-Za-z]+\b)/g, "$1$2");

  // 5. Normalize fragmented lines:
  // If a line does not end with a sentence terminator (. ? ! : ") and next line starts with lowercase or continuation word, join with space
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);

  const paragraphs: string[] = [];
  let currentPara = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if this line is a list item or new sub-paragraph
    const isNewBlock =
      /^(?:\([a-z0-9ivx]+\)|\d+\.|[A-Z]\.|\*|•|I\.|II\.|III\.|IV\.|V\.)\s+/i.test(line) ||
      /^Scenario\b/i.test(line) ||
      /^Case\b/i.test(line);

    if (!currentPara) {
      currentPara = line;
    } else if (isNewBlock) {
      paragraphs.push(currentPara);
      currentPara = line;
    } else {
      // Check if currentPara ends with terminal punctuation and next line starts with capital
      const endsWithPunct = /[.?!:]\s*["']?$/.test(currentPara);
      const nextStartsCapital = /^[A-Z]/.test(line);

      // If it ends with terminal punctuation and the previous paragraph was substantial, consider starting a new paragraph
      if (endsWithPunct && nextStartsCapital && currentPara.length > 120) {
        paragraphs.push(currentPara);
        currentPara = line;
      } else {
        // Otherwise it's a wrapped line in the same paragraph
        currentPara += " " + line;
      }
    }
  }

  if (currentPara) {
    paragraphs.push(currentPara);
  }

  return paragraphs.join("\n\n").trim();
}

async function main() {
  const allCs = await db.select().from(caseStudies).limit(5);
  for (const cs of allCs) {
    console.log("================ BEFORE ================");
    console.log(cs.title);
    console.log(JSON.stringify(cs.scenarioText));
    console.log("================ AFTER ================");
    const cleaned = cleanText(cs.scenarioText);
    console.log(cleaned);
  }
}

main().catch(console.error);
