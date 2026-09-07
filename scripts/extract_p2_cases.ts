import * as fs from "fs";

function clean(str: string) {
  return str
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
}

interface CaseStudyRaw {
  mtpNumber: number;
  questionNumber: string;
  marks?: string;
  scenarioAndQuestion: string;
  officialAnswer?: string;
}

async function main() {
  const text = fs.readFileSync("test_84774.txt", "utf8");
  const pages = text.split("\x0c");

  const qStarts = [85, 89, 93, 97, 102, 107, 111, 117, 122, 127, 134];
  const aStarts = [645, 657, 669, 682, 694, 708, 720, 734, 749, 766, 780];

  const allCases: CaseStudyRaw[] = [];

  for (let m = 0; m < 10; m++) {
    const qText = pages.slice(qStarts[m], qStarts[m + 1]).join("\n");
    const aText = pages.slice(aStarts[m], aStarts[m + 1]).join("\n");

    // Extract by questions
    // Split by main questions 1 to 6
    const qParts = qText.split(/(?:^|\n)\s*([1-6])\.\s+/g);
    const aParts = aText.split(/(?:^|\n)\s*([1-6])\.\s+/g);

    const ansMap = new Map<string, string>();
    for (let j = 1; j < aParts.length; j += 2) {
      const qNum = aParts[j];
      const qAnsBody = aParts[j + 1];
      ansMap.set(qNum, qAnsBody);
    }

    for (let i = 1; i < qParts.length; i += 2) {
      const qNum = qParts[i];
      const qBody = qParts[i + 1];
      const aBody = ansMap.get(qNum) || "";

      // Split subparts by (a), (b), (c) or (i), (ii), (iii)
      const subParts = qBody.split(/(?:^|\n)\s*\(([a-z0-9ivx]+)\)\s+/gi);
      const aSubParts = aBody.split(/(?:^|\n)\s*\(([a-z0-9ivx]+)\)\s+/gi);

      const aSubMap = new Map<string, string>();
      for (let aj = 1; aj < aSubParts.length; aj += 2) {
        const key = aSubParts[aj].toLowerCase();
        aSubMap.set(key, aSubParts[aj + 1]);
      }

      for (let sj = 1; sj < subParts.length; sj += 2) {
        const subKey = subParts[sj].toLowerCase();
        const subContent = subParts[sj + 1];
        const trimmed = clean(subContent);

        // Check if this subpart is a case study
        // Case studies describe parties (Mr., Mrs., A, B, Limited, Firm, sold, bought, contract, agreement, cheque, etc.)
        // and ask a legal determination (Whether, Decide, Can, Advise, Is, State with reasons)
        const isCase =
          /(?:whether|decide|can\s+[a-z]+|advise|is\s+[a-z]+|examine\s+whether|state\s+with\s+reasons\s+whether)/i.test(
            trimmed
          ) &&
          /(?:contract|agreement|goods|company|private\s+limited|limited|firm|partner|shares|cheque|rupees|`|\$|delivery|sold|purchased|loan|accident)/i.test(
            trimmed
          ) &&
          !/^(?:define|explain|what\s+are|what\s+do\s+you\s+mean|differentiate|distinguish|state\s+the\s+essential)/i.test(
            trimmed
          );

        if (isCase) {
          // Look up corresponding answer
          let ans = aSubMap.get(subKey);
          if (!ans) {
            // Check if combined in parent answer
            ans = aBody;
          }

          allCases.push({
            mtpNumber: m + 1,
            questionNumber: `MTP ${m + 1} - Q${qNum}(${subKey})`,
            scenarioAndQuestion: trimmed,
            officialAnswer: ans ? clean(ans).slice(0, 1500) : undefined,
          });
        }
      }
    }
  }

  console.log(`Total practical case studies extracted across 10 MTPs: ${allCases.length}`);
  fs.writeFileSync("p2_cases_extracted.json", JSON.stringify(allCases, null, 2));
  console.log("Saved to p2_cases_extracted.json");

  // Print first 5
  for (let k = 0; k < Math.min(5, allCases.length); k++) {
    console.log(`\n--- Case ${k + 1}: ${allCases[k].questionNumber} ---`);
    console.log("Scenario & Q:", allCases[k].scenarioAndQuestion.slice(0, 200) + "...");
    console.log("Answer snippet:", allCases[k].officialAnswer?.slice(0, 200) + "...");
  }
}

main().catch(console.error);
