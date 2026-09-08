import fs from "fs";
import path from "path";
import { validateImportBatch } from "../src/domains/questions/import/validation";
import { CanonicalQuestionJson, CanonicalBatchJson } from "../src/domains/questions/import/types";

function cleanLine(s: string): string {
  return s
    .replace(/\f[^\r\n]*/g, "")
    .replace(/[^\r\n]*Institute of Chartered Accountants of India[^\r\n]*/gi, "")
    .replace(/[^\r\n]*COST AND MANAGEMENT ACCOUNTING[^\r\n]*/gi, "")
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

function parseChapterTyk(filePath: string, defaultNodeCode: string, chapterName: string): CanonicalQuestionJson[] {
  if (!fs.existsSync(filePath)) return [];
  const text = fs.readFileSync(filePath, "utf-8");

  const mcqMatch = text.search(/Multiple Choice Questions\s*\(MCQs?\)|MCQs? based Questions/i);
  if (mcqMatch === -1) return [];

  const ansMatch = text.search(/Answers to the MCQs|Answers to MCQs/i);
  if (ansMatch === -1) return [];

  const mcqSection = text.substring(mcqMatch, ansMatch);
  const ansSection = text.substring(ansMatch);

  // Extract answer keys
  const ansMap = new Map<number, { letter: string; reason: string }>();
  const ansRegex = /(\d+)\.\s*\(?([A-D])\)?/gi;
  let am;
  // Limit search to the immediate Answers table (before "Answers to the Theoretical")
  const stopMatch = ansSection.search(/Answers to (?:the )?(?:Theoretical|Practical|Case)/i);
  const relevantAns = stopMatch !== -1 ? ansSection.substring(0, stopMatch) : ansSection.substring(0, 1000);

  while ((am = ansRegex.exec(relevantAns)) !== null) {
    const qNum = parseInt(am[1], 10);
    const letter = am[2].toUpperCase();
    ansMap.set(qNum, { letter, reason: `Official ICAI Study Material Answer for ${chapterName} TYK Q${qNum}.` });
  }

  // Extract Questions
  const questions: CanonicalQuestionJson[] = [];
  const qSplits = mcqSection.split(/\r?\n(?=\s*\d+\.\s+)/);

  for (const block of qSplits) {
    const m = block.match(/^\s*(\d+)\.\s+([\s\S]+)/);
    if (!m) continue;
    const qNum = parseInt(m[1], 10);
    const body = m[2];

    const ansInfo = ansMap.get(qNum);
    if (!ansInfo) continue;

    const optMatch = body.search(/(?:^|[\s\r\n])\(a\)/i);
    if (optMatch === -1) continue;

    const qText = cleanLine(body.substring(0, optMatch));
    const optPart = body.substring(optMatch);
    const options = extractSequentialOptions(optPart);

    if (options.length >= 4 && qText.length >= 10) {
      questions.push({
        nodeCode: defaultNodeCode,
        questionType: "MCQ",
        difficulty: "MEDIUM",
        questionText: qText,
        options: options.slice(0, 4),
        correctAnswer: ansInfo.letter,
        explanation: ansInfo.reason,
        source: {
          sourceType: "STUDY_MATERIAL",
          sourceTitle: "ICAI Study Material: Cost & Management Accounting (May 2026 Edition)",
          sourceYear: 2026,
          sourceMonth: 5,
          sourceReference: `${chapterName} - TYK Q${qNum}`,
          sourceAttempt: "May 2026",
          applicability: "May 2026 Examination onwards",
        },
      });
    }
  }

  return questions;
}

function mapCostingCaseNode(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("material") || lower.includes("eoq") || lower.includes("re-order") || lower.includes("lead time") || lower.includes("stock level") || lower.includes("oakwood")) {
    return "INT_P4_CH2_T1";
  }
  if (lower.includes("employee") || lower.includes("labour") || lower.includes("overtime") || lower.includes("halsey") || lower.includes("rowan")) {
    return "INT_P4_CH3_T1";
  }
  if (lower.includes("activity based") || lower.includes("cost driver") || lower.includes("cost pool") || lower.includes("abc")) {
    return "INT_P4_CH5_T1";
  }
  if (lower.includes("overhead") || lower.includes("apportionment") || lower.includes("absorption") || lower.includes("machine hour")) {
    return "INT_P4_CH4_T1";
  }
  if (lower.includes("cost sheet") || lower.includes("prime cost") || lower.includes("works cost")) {
    return "INT_P4_CH6_T1";
  }
  if (lower.includes("reconciliation") || lower.includes("integrated") || lower.includes("non-integrated")) {
    return "INT_P4_CH7_T1";
  }
  if (lower.includes("batch") || lower.includes("job costing") || lower.includes("contract") || lower.includes("economic batch")) {
    return "INT_P4_CH8_T1";
  }
  if (lower.includes("process") || lower.includes("equivalent unit") || lower.includes("joint product") || lower.includes("by product")) {
    return "INT_P4_CH9_T1";
  }
  if (lower.includes("service costing") || lower.includes("transport") || lower.includes("hotel") || lower.includes("hospital") || lower.includes("passenger km")) {
    return "INT_P4_CH10_T1";
  }
  if (lower.includes("standard cost") || lower.includes("variance") || lower.includes("favourable") || lower.includes("adverse")) {
    return "INT_P4_CH11_T1";
  }
  if (lower.includes("marginal cost") || lower.includes("p/v ratio") || lower.includes("break-even") || lower.includes("margin of safety") || lower.includes("cvp")) {
    return "INT_P4_CH12_T1";
  }
  if (lower.includes("budget") || lower.includes("cash budget") || lower.includes("flexible budget")) {
    return "INT_P4_CH13_T1";
  }
  return "INT_P4_CH1_T1";
}

function parseCostingCaseScenarios(filePath: string): { questions: CanonicalQuestionJson[]; caseStudies: any[] } {
  if (!fs.existsSync(filePath)) return { questions: [], caseStudies: [] };
  const text = fs.readFileSync(filePath, "utf-8");

  const csBlocks = text.split(/\f?\s*CASE SCENARIO\s+(\d+)\b/i);
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

    const csTitle = `Case Scenario ${csNum}: Cost and Management Accounting`;
    const csRef = `INT_P4_CS_${csNum}`;

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
      const reasonIdx = rawAns.search(/Reason:?/i);
      let reason = "";
      if (reasonIdx !== -1) {
        reason = cleanLine(rawAns.substring(reasonIdx + 7));
      } else {
        reason = cleanLine(rawAns);
      }
      ansMap.set(qNum, { letter, reason });
    }

    // Parse Questions
    const qSplits = mcqPart.split(/\r?\n(?=\s*\d+\.\s+)/);
    for (const block of qSplits) {
      const m = block.match(/^\s*(\d+)\.\s+([\s\S]+)/);
      if (!m) continue;
      const qNum = parseInt(m[1], 10);
      const body = m[2];

      const ansInfo = ansMap.get(qNum);
      if (!ansInfo) continue;

      const optMatch = body.search(/(?:^|[\s\r\n])\(a\)/i);
      if (optMatch === -1) continue;

      const qText = cleanLine(body.substring(0, optMatch));
      const optPart = body.substring(optMatch);
      const options = extractSequentialOptions(optPart);

      if (options.length >= 4 && qText.length >= 10) {
        const nodeCode = mapCostingCaseNode(`${scenarioText} ${qText}`);

        questions.push({
          nodeCode,
          questionType: "CASE_STUDY",
          difficulty: "HARD",
          caseStudyRef: csRef,
          caseStudyTitle: csTitle,
          caseStudyText: scenarioText,
          questionText: qText,
          options: options.slice(0, 4),
          correctAnswer: ansInfo.letter,
          explanation: ansInfo.reason || `Official BoS Case Scenario Explanation for ${csTitle} MCQ ${qNum}.`,
          source: {
            sourceType: "STUDY_MATERIAL",
            sourceTitle: "ICAI Case Scenario Booklet: Cost & Management Accounting",
            sourceYear: 2026,
            sourceMonth: 5,
            sourceReference: `${csTitle} - MCQ ${qNum}`,
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
  console.log("==================================================");
  console.log("GENERATING CA INTERMEDIATE PAPER 4 (COSTING) BATCH");
  console.log("==================================================");

  const chapterConfigs = [
    { file: "p4_ch1_layout.txt", nodeCode: "INT_P4_CH1_T1", title: "Chapter 1: Introduction to Cost Accounting" },
    { file: "p4_ch2_layout.txt", nodeCode: "INT_P4_CH2_T1", title: "Chapter 2: Material Cost" },
    { file: "p4_ch3_layout.txt", nodeCode: "INT_P4_CH3_T1", title: "Chapter 3: Employee Cost" },
    { file: "p4_ch4_layout.txt", nodeCode: "INT_P4_CH4_T1", title: "Chapter 4: Overheads" },
    { file: "p4_ch5_layout.txt", nodeCode: "INT_P4_CH5_T1", title: "Chapter 5: Activity Based Costing" },
    { file: "p4_ch6_layout.txt", nodeCode: "INT_P4_CH6_T1", title: "Chapter 6: Cost Sheet" },
    { file: "p4_ch7_layout.txt", nodeCode: "INT_P4_CH7_T1", title: "Chapter 7: Cost Accounting System" },
    { file: "p4_ch8_layout.txt", nodeCode: "INT_P4_CH8_T1", title: "Chapter 8: Unit & Batch Costing" },
    { file: "p4_ch9_layout.txt", nodeCode: "INT_P4_CH8_T1", title: "Chapter 9: Job Costing" },
    { file: "p4_ch10_layout.txt", nodeCode: "INT_P4_CH9_T1", title: "Chapter 10: Process & Operation Costing" },
    { file: "p4_ch11_layout.txt", nodeCode: "INT_P4_CH9_T1", title: "Chapter 11: Joint & By-Products" },
    { file: "p4_ch12_layout.txt", nodeCode: "INT_P4_CH10_T1", title: "Chapter 12: Service Costing" },
    { file: "p4_ch13_layout.txt", nodeCode: "INT_P4_CH11_T1", title: "Chapter 13: Standard Costing" },
    { file: "p4_ch14_layout.txt", nodeCode: "INT_P4_CH12_T1", title: "Chapter 14: Marginal Costing" },
    { file: "p4_ch15_layout.txt", nodeCode: "INT_P4_CH13_T1", title: "Chapter 15: Budget and Budgetary Control" },
  ];

  const chaptersDir = path.join(__dirname, "../ingestion/intermediate/paper_4_costing");
  const tykQuestions: CanonicalQuestionJson[] = [];

  for (const cfg of chapterConfigs) {
    const fPath = path.join(chaptersDir, cfg.file);
    const qs = parseChapterTyk(fPath, cfg.nodeCode, cfg.title);
    console.log(`  -> ${cfg.title}: Extracted ${qs.length} TYK MCQs.`);
    tykQuestions.push(...qs);
  }

  console.log("\nParsing Paper 4 Case Scenario Booklet...");
  const csbPath = path.join(__dirname, "../ingestion/intermediate/booklets/p4_csb_layout.txt");
  const csData = parseCostingCaseScenarios(csbPath);
  console.log(`  -> Extracted ${csData.questions.length} questions across ${csData.caseStudies.length} case scenarios.`);

  const allQuestions = [...tykQuestions, ...csData.questions];

  const batchJson: CanonicalBatchJson = {
    batchTitle: "CA Intermediate Paper 4 (Cost and Management Accounting) - Study Material & Case Scenario Booklet (May 2026)",
    academicLevelCode: "INTERMEDIATE",
    subjectCode: "PAPER_4",
    sourceType: "STUDY_MATERIAL",
    sourceYear: 2026,
    sourceMonth: 5,
    examAttemptCode: "MAY_2026",
    curriculumVersionName: "CA Intermediate Syllabus 2026-2027",
    caseStudies: csData.caseStudies,
    questions: allQuestions,
  };

  console.log(`\nTotal Questions Extracted: ${allQuestions.length}`);
  console.log("Validating batch...");

  const report = validateImportBatch(batchJson as any);
  console.log(`Validation: ${report.validCount} valid, ${report.invalidCount} invalid, ${report.totalQuestions} total.`);

  if (report.invalidCount > 0) {
    console.error("Validation Errors Sample:");
    report.questionResults.slice(0, 5).forEach((r, idx) => {
      if (r.errors.length > 0) {
        console.error(`  Q#${idx}:`, r.errors.map(e => e.message).join("; "));
      }
    });
    process.exit(1);
  }

  const outPath = path.join(__dirname, "../ingestion/batches/intermediate_sm_p4_costing.json");
  fs.writeFileSync(outPath, JSON.stringify(batchJson, null, 2), "utf-8");
  console.log(`Saved batch to ${outPath}`);
  console.log("==================================================");
}

main().catch((err) => {
  console.error("Error generating P4 batch:", err);
  process.exit(1);
});
