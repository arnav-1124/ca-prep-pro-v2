import fs from "fs";
import path from "path";
import { validateImportBatch } from "../src/domains/questions/import/validation";
import { CanonicalQuestionJson, CanonicalBatchJson } from "../src/domains/questions/import/types";

function cleanLine(s: string): string {
  return s
    .replace(/\f[^\r\n]*/g, "")
    .replace(/[^\r\n]*Institute of Chartered Accountants of India[^\r\n]*/gi, "")
    .replace(/[^\r\n]*ADVANCED ACCOUNTING[^\r\n]*/gi, "")
    .replace(/[^\r\n]*CASE SCENARIOS?\s+\d+[^\r\n]*/gi, "")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function extractSequentialOptions(text: string): { letter: string; text: string }[] {
  const letters = ["a", "b", "c", "d"];
  const indices: { letter: string; idx: number }[] = [];
  let currentSearchPos = 0;

  for (const l of letters) {
    const regex = new RegExp(`(?:^|[\\s\\r\\n])\\(${l}\\)`, "i");
    const sub = text.substring(currentSearchPos);
    const m = sub.match(regex);
    if (!m || m.index === undefined) break;
    const absIdx = currentSearchPos + m.index + (m[0].length - 3);
    indices.push({ letter: l.toUpperCase(), idx: absIdx });
    currentSearchPos = absIdx + 3;
  }

  if (indices.length < 4) return [];

  const options: { letter: string; text: string }[] = [];
  for (let i = 0; i < indices.length; i++) {
    const start = indices[i].idx + 3;
    const end = i < indices.length - 1 ? indices[i + 1].idx : text.length;
    const optTxt = cleanLine(text.substring(start, end));
    if (optTxt.length > 0) {
      options.push({ letter: indices[i].letter, text: optTxt });
    }
  }

  return options;
}

function parseCaseScenariosBooklet(filePath: string): { questions: CanonicalQuestionJson[]; caseStudies: any[] } {
  if (!fs.existsSync(filePath)) return { questions: [], caseStudies: [] };
  const text = fs.readFileSync(filePath, "utf-8");

  const csBlocks = text.split(/\f?\s*CASE SCENARIO(?:S)?\s*[-–]?\s*(\d+)\b/i);
  const questions: CanonicalQuestionJson[] = [];
  const caseStudies: any[] = [];

  for (let i = 1; i < csBlocks.length; i += 2) {
    const csNum = parseInt(csBlocks[i], 10);
    const csBody = csBlocks[i + 1];
    if (!csBody) continue;

    const mcqIdx = csBody.search(/MULTIPLE CHOICE QUESTIONS/i);
    if (mcqIdx === -1) continue;

    const ansIdx = csBody.search(/ANSWERS? TO (?:THE )?(?:MULTIPLE CHOICE|CASE SCENARIO)/i);
    if (ansIdx === -1) continue;

    const scenarioText = cleanLine(csBody.substring(0, mcqIdx));
    const mcqPart = csBody.substring(mcqIdx + "MULTIPLE CHOICE QUESTIONS".length, ansIdx);
    const ansPart = csBody.substring(ansIdx);

    const csTitle = `Case Scenario ${csNum}: Advanced Accounting`;
    const csRef = `INT_P1_CS_${csNum}`;

    if (scenarioText.length < 50) continue;

    caseStudies.push({
      caseStudyRef: csRef,
      title: csTitle,
      scenarioText,
    });

    // Parse Answers
    const ansMap = new Map<number, { letter: string; reason: string }>();
    const ansRegex = /(\d+)\.\s*(?:Option\s*)?\(?([A-D])\)?\s*([\s\S]*?)(?=(?:\r?\n\s*\d+\.|\r?\n\s*CASE SCENARIO|$))/gi;
    let am;
    while ((am = ansRegex.exec(ansPart)) !== null) {
      const qNum = parseInt(am[1], 10);
      const letter = am[2].toUpperCase();
      let rawAns = am[3] || "";
      const reasonIdx = rawAns.search(/Reason:/i);
      let reason = "";
      if (reasonIdx !== -1) {
        reason = cleanLine(rawAns.substring(reasonIdx + 7));
      } else {
        reason = cleanLine(rawAns);
      }
      ansMap.set(qNum, { letter, reason });
    }

    // Determine relevant syllabus node based on content keywords
    let nodeCode = "INT_P1_CH1_T2";
    const lowerScen = scenarioText.toLowerCase();
    if (lowerScen.includes("cash flow") || lowerScen.includes("as 3") || lowerScen.includes("operating activities") || lowerScen.includes("investing activities")) {
      nodeCode = "INT_P1_CH2_T2";
    } else if (lowerScen.includes("balance sheet") || lowerScen.includes("schedule iii") || lowerScen.includes("statement of profit and loss")) {
      nodeCode = "INT_P1_CH2_T1";
    } else if (lowerScen.includes("buy back") || lowerScen.includes("buyback") || lowerScen.includes("section 68")) {
      nodeCode = "INT_P1_CH3_T1";
    } else if (lowerScen.includes("investment account") || lowerScen.includes("as 13") || lowerScen.includes("shares bought")) {
      nodeCode = "INT_P1_CH4_T1";
    } else if (lowerScen.includes("insurance claim") || lowerScen.includes("loss of stock") || lowerScen.includes("loss of profit")) {
      nodeCode = "INT_P1_CH4_T2";
    } else if (lowerScen.includes("amalgamation") || lowerScen.includes("purchase consideration") || lowerScen.includes("as 14")) {
      nodeCode = "INT_P1_CH5_T1";
    } else if (lowerScen.includes("internal reconstruction") || lowerScen.includes("capital reduction")) {
      nodeCode = "INT_P1_CH6_T1";
    } else if (lowerScen.includes("branch") || lowerScen.includes("foreign branch") || lowerScen.includes("head office")) {
      nodeCode = "INT_P1_CH7_T1";
    } else {
      nodeCode = "INT_P1_CH1_T2";
    }

    // Parse MCQs
    const qBlocks = mcqPart.split(/\r?\n(?=\d+\.\s+)/);
    for (const block of qBlocks) {
      const qm = block.match(/^(\d+)\.\s+([\s\S]+)/);
      if (!qm) continue;
      const qNum = parseInt(qm[1], 10);
      const qBody = qm[2];

      const ansInfo = ansMap.get(qNum);
      if (!ansInfo) continue;

      const optMatch = qBody.search(/(?:^|[\s\r\n])\(a\)/i);
      if (optMatch === -1) continue;

      const qText = cleanLine(qBody.substring(0, optMatch));
      const optPart = qBody.substring(optMatch);
      const options = extractSequentialOptions(optPart);

      if (options.length >= 4 && qText.length >= 10) {
        questions.push({
          nodeCode,
          questionType: "CASE_STUDY",
          difficulty: "HARD",
          caseStudyRef: csRef,
          caseStudy: {
            caseStudyRef: csRef,
            title: csTitle,
            scenarioText,
          },
          questionText: qText,
          options: options.slice(0, 4),
          correctAnswer: ansInfo.letter,
          explanation: ansInfo.reason || `Official ICAI Case Scenario question from Paper 1: Advanced Accounting.`,
          source: {
            sourceType: "STUDY_MATERIAL",
            sourceTitle: "ICAI Case Scenarios Booklet - Advanced Accounting",
            sourceYear: 2026,
            sourceMonth: 5,
            sourceReference: `Case Scenario ${csNum} - Q${qNum}`,
            sourceAttempt: "May 2026",
            applicability: "May 2026 Examination onwards",
          },
        });
      }
    }
  }

  return { questions, caseStudies };
}

async function main() {
  console.log("=== GENERATING CA INTERMEDIATE PAPER 1 (ADVANCED ACCOUNTING) BATCH ===");

  const csbPath = path.join(__dirname, "../ingestion/intermediate/booklets/p1_csb_layout.txt");
  const result = parseCaseScenariosBooklet(csbPath);

  console.log(`Extracted: ${result.caseStudies.length} Case Scenarios, ${result.questions.length} MCQs`);

  const batchPayload: CanonicalBatchJson = {
    schemaVersion: "2.0",
    batchName: "CA Intermediate Paper 1: Advanced Accounting (Study Material & Case Scenarios)",
    sourceType: "STUDY_MATERIAL",
    sourceTitle: "ICAI Study Material & Case Scenarios - Advanced Accounting (May 2026 Examination Edition)",
    sourceYear: 2026,
    sourceMonth: 5,
    caseStudies: result.caseStudies,
    questions: result.questions,
  };

  console.log("\nValidating against Canonical Batch Schema...");
  const valResult = validateImportBatch(batchPayload);
  console.log(`  ✓ Valid Questions: ${valResult.validCount} / ${valResult.totalQuestions}`);
  if (valResult.invalidCount > 0) {
    console.warn(`  ⚠ Invalid Questions: ${valResult.invalidCount}`);
    valResult.questionResults.forEach((r, idx) => {
      if (r.errors.length > 0) {
        console.warn(`    Q#${idx}:`, r.errors.map(e => e.message).join("; "));
      }
    });
  }

  const outDir = path.join(__dirname, "../ingestion/batches");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "intermediate_sm_p1_accounting.json");
  fs.writeFileSync(outPath, JSON.stringify(batchPayload, null, 2), "utf-8");
  console.log(`\n✓ Saved clean batch payload to ${outPath} (${fs.statSync(outPath).size} bytes)`);
}

main().catch(console.error);
