import * as fs from "fs";
import { validateImportBatch } from "../src/domains/questions/import/validation";

interface CaseStudyQuestion {
  questionIndex: number;
  questionType: "CASE_STUDY";
  questionText: string;
  difficulty: "MEDIUM" | "HARD";
  options: Array<{ letter: string; text: string }>;
  correctAnswer: string;
  explanation: string;
  caseStudy: {
    title: string;
    scenarioText: string;
  };
  curriculum: {
    subjectCode: string;
    nodeCode: string;
  };
  source: {
    sourceType: "MTP";
    sourceTitle: string;
    sourceYear: number;
    sourceMonth: string;
    sourceReference: string;
  };
}

function clean(str: string) {
  return str
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
}

async function main() {
  console.log("=== GENERATING HIGH-FIDELITY PAPER 2 (BUSINESS LAWS) CASE STUDY QUESTIONS ===");

  const text = fs.readFileSync("test_84774.txt", "utf8");
  const pages = text.split("\x0c");

  const qStarts = [85, 89, 93, 97, 102, 107, 111, 117, 122, 127, 134];
  const aStarts = [645, 657, 669, 682, 694, 708, 720, 734, 749, 766, 780];

  const questions: CaseStudyQuestion[] = [];
  let globalIndex = 1;

  for (let m = 0; m < 10; m++) {
    const mtpNum = m + 1;
    const qRaw = pages.slice(qStarts[m], qStarts[m + 1]).join("\n");
    const aRaw = pages.slice(aStarts[m], aStarts[m + 1]).join("\n");

    const qMainParts = qRaw.split(/(?:^|\n)\s*([1-6])\.\s*(?=\([a-z0-9ivx]+\))/g);
    const aMainParts = aRaw.split(/(?:^|\n)\s*([1-6])\.\s*(?=\([a-z0-9ivx]+\))/g);

    const ansMap = new Map<string, string>();
    for (let aj = 1; aj < aMainParts.length; aj += 2) {
      ansMap.set(aMainParts[aj], aMainParts[aj + 1]);
    }

    for (let qi = 1; qi < qMainParts.length; qi += 2) {
      const qNum = qMainParts[qi];
      const qBody = qMainParts[qi + 1];
      const aBody = ansMap.get(qNum) || "";

      // Split questions and answers by major letter (a), (b), (c)
      const qMajor = qBody.split(/(?:^|\n)\s*\(([a-c])\)\s+/gi);
      const aMajor = aBody.split(/(?:^|\n)\s*\(([a-c])\)\s+/gi);

      // Keep FIRST occurrence so inner sub-parts don't overwrite
      const qMap = new Map<string, string>();
      for (let j = 1; j < qMajor.length; j += 2) {
        const k = qMajor[j].toLowerCase();
        if (!qMap.has(k)) qMap.set(k, qMajor[j + 1]);
      }

      const aMap = new Map<string, string>();
      for (let aj = 1; aj < aMajor.length; aj += 2) {
        const ak = aMajor[aj].toLowerCase();
        if (!aMap.has(ak)) aMap.set(ak, aMajor[aj + 1]);
      }

      for (const [letter, partTextRaw] of qMap.entries()) {
        const partText = clean(partTextRaw);
        const ansText = clean(aMap.get(letter) || aBody);

        if (!partText || partText.length < 50) continue;

        // Check if this major part has inner sub-questions (i), (ii)
        const innerRegex = /(?:^|\n)\s*\(([i|v|x]+)\)\s+/gi;
        const innerParts: Array<{ subIdx: string; text: string }> = [];
        let im: RegExpExecArray | null;
        let lastInner = "";
        let lastInnerIdx = 0;
        const headerScenario = partText.split(/(?:^|\n)\s*\([i|v|x]+\)\s+/i)[0] || "";

        while ((im = innerRegex.exec(partText)) !== null) {
          if (lastInner) {
            innerParts.push({ subIdx: lastInner, text: partText.slice(lastInnerIdx, im.index) });
          }
          lastInner = im[1];
          lastInnerIdx = innerRegex.lastIndex;
        }
        if (lastInner) {
          innerParts.push({ subIdx: lastInner, text: partText.slice(lastInnerIdx) });
        }

        // Also split answer by (i), (ii)
        const aInnerMap = new Map<string, string>();
        let aim: RegExpExecArray | null;
        let aLastInner = "";
        let aLastInnerIdx = 0;
        while ((aim = innerRegex.exec(ansText)) !== null) {
          if (aLastInner && !aInnerMap.has(aLastInner.toLowerCase())) {
            aInnerMap.set(aLastInner.toLowerCase(), ansText.slice(aLastInnerIdx, aim.index));
          }
          aLastInner = aim[1];
          aLastInnerIdx = innerRegex.lastIndex;
        }
        if (aLastInner && !aInnerMap.has(aLastInner.toLowerCase())) {
          aInnerMap.set(aLastInner.toLowerCase(), ansText.slice(aLastInnerIdx));
        }

        const items =
          innerParts.length > 0
            ? innerParts.map((ip) => ({
                label: `${letter}(${ip.subIdx})`,
                scenario: clean(
                  headerScenario.length > 30 ? headerScenario + "\n\n" + ip.text : ip.text
                ),
                itemBody: clean(ip.text),
                answer: clean(aInnerMap.get(ip.subIdx.toLowerCase()) || ansText),
              }))
            : [
                {
                  label: letter,
                  scenario: partText,
                  itemBody: partText,
                  answer: ansText,
                },
              ];

        for (const it of items) {
          const combined = it.scenario + "\n" + it.answer;

          // Case study filter
          const hasFactualPremise = /(?:contract|agreement|goods|company|firm|partner|shares|cheque|rupees|`|\$|delivery|sold|purchased|loan|accident|truck|bricks|tomatoes|oil|jewellery|bangles|director|transporter|unpaid|insolvent|bank|limestone|wheat|car|furniture|machine)/i.test(
            it.scenario
          );
          const hasLegalQuestion = /\b(?:whether|decide|can\s+[a-z0-9A-Z_]+|advise|is\s+[a-z0-9A-Z_]+|examine\s+whether|state\s+with\s+reasons\s+whether|will\s+[a-z0-9A-Z_]+|what\s+is\s+the\s+maximum\s+amount|can\s+he\s+do\s+so)\b/i.test(
            it.scenario
          );
          const isTheoryDefinition = /^(?:define|explain|what\s+are|what\s+do\s+you\s+mean\s+by|differentiate|distinguish|state\s+the\s+essential\s+elements|list\s+the|discuss\s+stating)/i.test(
            it.itemBody
          );

          if (hasFactualPremise && hasLegalQuestion && !isTheoryDefinition && it.answer.length >= 80) {
            let nodeCode = "FND_P2_CH2";
            let actName = "the Indian Contract Act, 1872";

            if (/sale\s+of\s+goods/i.test(combined) || /goods\s+act/i.test(combined)) {
              actName = "the Sale of Goods Act, 1930";
              if (/lien|stoppage|unpaid\s+seller/i.test(combined)) nodeCode = "FND_P2_CH3_T4";
              else if (/caveat\s+emptor|condition|warrant/i.test(combined)) nodeCode = "FND_P2_CH3_T2";
              else if (/delivery|ownership|risk|property\s+in\s+goods/i.test(combined)) nodeCode = "FND_P2_CH3_T3";
              else nodeCode = "FND_P2_CH3_T1";
            } else if (/partnership/i.test(combined) || /partner/i.test(combined)) {
              actName = "the Indian Partnership Act, 1932";
              if (/dissolution|registration/i.test(combined)) nodeCode = "FND_P2_CH4_T3";
              else if (/emergency|relation|third\s+part|authority/i.test(combined)) nodeCode = "FND_P2_CH4_T2";
              else nodeCode = "FND_P2_CH4_T1";
            } else if (/companies\s+act|subsidiary|small\s+company|private\s+limited|share\s+capital|ultra\s+vires|perpetual|corporate\s+veil/i.test(combined)) {
              actName = "the Companies Act, 2013";
              if (/incorporation|ultra\s+vires|moa|aoa|perpetual|promoter/i.test(combined)) nodeCode = "FND_P2_CH6_T2";
              else nodeCode = "FND_P2_CH6_T1";
            } else if (/llp\s+act|limited\s+liability\s+partnership/i.test(combined)) {
              actName = "the Limited Liability Partnership Act, 2008";
              nodeCode = "FND_P2_CH5_T1";
            } else if (/cheque|negotiable\s+instrument|promissory\s+note|bill\s+of\s+exchange|138/i.test(combined)) {
              actName = "the Negotiable Instruments Act, 1881";
              if (/holder\s+in\s+due\s+course|negotiation/i.test(combined)) nodeCode = "FND_P2_CH7_T2";
              else nodeCode = "FND_P2_CH7_T1";
            } else {
              if (/necessaries|minor|quasi|contingent|68/i.test(combined)) nodeCode = "FND_P2_CH2_T5";
              else if (/breach|damages|anticipatory|73|74/i.test(combined)) nodeCode = "FND_P2_CH2_T4";
              else if (/performance|discharge|time|reciprocal|38|39|51/i.test(combined)) nodeCode = "FND_P2_CH2_T3";
              else if (/consideration|capacity|restraint|25|27/i.test(combined)) nodeCode = "FND_P2_CH2_T2";
              else nodeCode = "FND_P2_CH2_T1";
            }

            // Extract question prompt
            let questionPrompt = "";
            const promptMatch = it.scenario.match(
              /\b(?:Whether|Decide|Can\s+[a-z0-9A-Z_]+|Advise|Is\s+[a-z0-9A-Z_]+|Examine\s+whether|State\s+with\s+reasons\s+whether|Will\s+[a-z0-9A-Z_]+)\b[^?.]+[?.]/i
            );
            if (promptMatch && promptMatch[0].trim().length >= 15) {
              questionPrompt = promptMatch[0].trim();
            } else {
              const lines = it.scenario.split("\n").map((l) => l.trim()).filter(Boolean);
              const lastLine = lines[lines.length - 1] || "";
              if (lastLine.length >= 15 && !lastLine.includes("Marks)")) {
                questionPrompt = lastLine;
              } else {
                questionPrompt = `Decide the legal position and advise the parties in accordance with the provisions of ${actName}.`;
              }
            }

            // Clean scenario text
            const cleanedScenario = it.scenario
              .replace(/\(\d+\s*Marks\)/gi, "")
              .replace(/\(\d+\s*\+\s*\d+\s*=\s*\d+\s*Marks\)/gi, "")
              .trim();

            // Extract section citation
            const secMatch = it.answer.match(/Section\s+(\d+(?:\([0-9a-zA-Z]+\))*)/i);
            const secStr = secMatch ? `under ${secMatch[0]} of ${actName}` : `under the provisions of ${actName}`;

            // Check negative vs affirmative legal ruling
            const ansTail = it.answer.slice(-800);
            const isNegative = /\b(?:is\s+not\s+liable|cannot\s+recover|is\s+not\s+maintainable|is\s+not\s+bound|is\s+void|is\s+not\s+correct|will\s+not\s+succeed|cannot\s+do\s+so|cannot\s+exercise|not\s+entitled|shall\s+not\s+apply|cannot\s+be\s+categorized|cannot\s+be\s+considered|no\s+remedy|no\s+right|can\s+continue|not\s+be\s+applicable|not\s+applicable|void)\b/i.test(
              ansTail
            );

            // Create 4 distinct legal options
            let correctText = "";
            let distractor1 = "";
            let distractor2 = "";
            let distractor3 = "";

            if (isNegative) {
              correctText = `No, the claim/restriction is not legally enforceable ${secStr}, based on statutory criteria and the factual matrix.`;
              distractor1 = `Yes, the action is sustainable because express mutual agreement between the parties strictly overrides statutory restrictions.`;
              distractor2 = `Yes, because general commercial customs automatically create an implied enforceable obligation.`;
              distractor3 = `No, but compensation is personally recoverable under principles of equity outside the statute.`;
            } else {
              correctText = `Yes, the claim/action is legally maintainable and valid ${secStr}, as all mandatory statutory conditions are satisfied.`;
              distractor1 = `No, the action is barred due to lack of privity of contract and statutory exceptions.`;
              distractor2 = `No, because commercial agreements require express government approval and stamp duty registration to be enforceable.`;
              distractor3 = `Yes, but relief is strictly confined to nominal damages without enforcement of substantive rights.`;
            }

            // Rotate correct answer position across A, B, C, D
            const targetPos = (globalIndex - 1) % 4;
            const letters = ["A", "B", "C", "D"];
            const targetLetter = letters[targetPos];

            const rawOptionsPool = [
              { isCorrect: true, text: correctText },
              { isCorrect: false, text: distractor1 },
              { isCorrect: false, text: distractor2 },
              { isCorrect: false, text: distractor3 },
            ];

            // Put correct option at targetPos
            const orderedOpts: string[] = [];
            let dIdx = 1;
            for (let p = 0; p < 4; p++) {
              if (p === targetPos) {
                orderedOpts.push(correctText);
              } else {
                orderedOpts.push(rawOptionsPool[dIdx++].text);
              }
            }

            const formattedOptions = orderedOpts.map((txt, idx) => ({
              letter: letters[idx],
              text: txt,
            }));

            const cleanSnippet = cleanedScenario.slice(0, 45).replace(/\n/g, " ").replace(/[`'"]/g, "");
            const title = `MTP ${mtpNum} Case Study: Q${qNum}(${it.label}) - ${cleanSnippet}...`;

            questions.push({
              questionIndex: globalIndex++,
              questionType: "CASE_STUDY",
              questionText: questionPrompt,
              difficulty: "HARD",
              options: formattedOptions,
              correctAnswer: targetLetter,
              explanation: it.answer,
              caseStudy: {
                title,
                scenarioText: cleanedScenario,
              },
              curriculum: {
                subjectCode: "PAPER_2",
                nodeCode,
              },
              source: {
                sourceType: "MTP",
                sourceTitle: `ICAI BoS Foundation Model Test Papers (Feb 2025) — Business Laws Case Scenarios (MTP ${mtpNum})`,
                sourceYear: 2025,
                sourceMonth: "February",
                sourceReference: `MTP ${mtpNum}, Paper 2, Question ${qNum}(${it.label})`,
              },
            });
          }
        }
      }
    }
  }

  console.log(`\nExtracted & Structured ${questions.length} High-Yield Case Studies for Paper 2!`);

  const batchPayload = {
    schemaVersion: "2.0",
    batchName: "CA Foundation Business Laws (Paper 2) - Official Model Test Papers 2025 (Case-Based Question Bank)",
    academicLevelCode: "FOUNDATION",
    curriculumVersionName: "New Scheme of Education and Training (2024-2026)",
    subjectCode: "PAPER_2",
    sourceType: "MTP",
    sourceTitle: "ICAI BoS Foundation Model Test Papers (Feb 2025) — Business Laws Case Scenarios",
    sourceYear: 2025,
    sourceMonth: "February",
    questions,
  };

  const valResult = validateImportBatch(batchPayload);
  console.log(
    `Validation Result: isValid = ${valResult.isValid}, validCount = ${valResult.validCount}, invalidCount = ${valResult.invalidCount}`
  );

  if (!valResult.isValid) {
    console.error("Batch validation errors:", valResult.batchErrors);
    for (const qr of valResult.questionResults) {
      if (!qr.isValid) {
        console.error(`Question #${qr.index} errors:`, qr.errors);
      }
    }
    process.exit(1);
  }

  fs.writeFileSync("foundation_mtp_2025_p2_case_studies.json", JSON.stringify(batchPayload, null, 2));
  console.log("✓ Successfully saved valid batch to foundation_mtp_2025_p2_case_studies.json");
}

main().catch(console.error);
