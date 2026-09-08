import fs from "fs";
import path from "path";
import { validateImportBatch } from "../src/domains/questions/import/validation";
import { CanonicalQuestionJson, CanonicalBatchJson } from "../src/domains/questions/import/types";

function cleanLine(s: string): string {
  return s
    .replace(/\f[^\r\n]*/g, "")
    .replace(/[^\r\n]*Institute of Chartered Accountants of India[^\r\n]*/gi, "")
    .replace(/[^\r\n]*FINANCIAL MANAGEMENT[^\r\n]*/gi, "")
    .replace(/[^\r\n]*STRATEGIC MANAGEMENT[^\r\n]*/gi, "")
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

  const mcqSectionFull = text.substring(mcqMatch);
  const ansRelIdx = mcqSectionFull.search(/Answers to (?:the )?MCQs?(?: based Questions)?/i);
  if (ansRelIdx === -1) return [];

  const mcqSection = mcqSectionFull.substring(0, ansRelIdx);
  const ansSection = mcqSectionFull.substring(ansRelIdx);

  // Extract answer keys
  const ansMap = new Map<number, { letter: string; reason: string }>();
  if (filePath.includes("p6a_ch1")) {
    const fmCh1 = [[1, "D"], [2, "B"], [3, "C"], [4, "D"], [5, "C"], [6, "D"], [7, "D"], [8, "D"], [9, "A"], [10, "D"], [11, "B"], [12, "A"]] as const;
    for (const [qNum, letter] of fmCh1) {
      ansMap.set(qNum, { letter, reason: `Official ICAI Study Material Answer for ${chapterName} TYK Q${qNum}.` });
    }
  } else {
    const ansRegex = /(\d+)\.\s*\(?([A-D])\)?/gi;
    let am;
    const stopMatch = ansSection.search(/Answers to (?:the )?(?:Theoretical|Practical|Case)/i);
    const relevantAns = stopMatch !== -1 ? ansSection.substring(0, stopMatch) : ansSection.substring(0, 1000);

    while ((am = ansRegex.exec(relevantAns)) !== null) {
      const qNum = parseInt(am[1], 10);
      const letter = am[2].toUpperCase();
      ansMap.set(qNum, { letter, reason: `Official ICAI Study Material Answer for ${chapterName} TYK Q${qNum}.` });
    }
  }

  // Extract Questions
  const questions: CanonicalQuestionJson[] = [];
  const qSplits = mcqSection.split(/\r?\n(?=\s*(?:\(\d+\)|\d+\.)\s+)/);

  for (const block of qSplits) {
    const m = block.match(/^\s*(?:\((\d+)\)|(\d+)\.)\s+([\s\S]+)/);
    if (!m) continue;
    const qNum = parseInt(m[1] || m[2], 10);
    const body = m[3];

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
          sourceTitle: "ICAI Study Material: Financial Management and Strategic Management (May 2026 Edition)",
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

function mapFmCaseNode(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("ratio") || lower.includes("current ratio") || lower.includes("debt equity") || lower.includes("turnover") || lower.includes("gross profit ratio") || lower.includes("return on equity")) {
    return "INT_P6_SECA_CH2_T1";
  }
  if (lower.includes("cost of capital") || lower.includes("wacc") || lower.includes("capital structure") || lower.includes("leverage") || lower.includes("ebit") || lower.includes("eps") || lower.includes("dol") || lower.includes("dfl")) {
    return "INT_P6_SECA_CH3_T1";
  }
  if (lower.includes("npv") || lower.includes("irr") || lower.includes("capital budgeting") || lower.includes("payback") || lower.includes("cash flow") || lower.includes("profitability index")) {
    return "INT_P6_SECA_CH4_T1";
  }
  if (lower.includes("dividend") || lower.includes("walter") || lower.includes("gordon") || lower.includes("working capital") || lower.includes("operating cycle") || lower.includes("debtors") || lower.includes("inventory management")) {
    return "INT_P6_SECA_CH5_T1";
  }
  return "INT_P6_SECA_CH1_T1";
}

function mapSmCaseNode(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("vision") || lower.includes("mission") || lower.includes("objective") || lower.includes("business model") || lower.includes("strategic intent") || lower.includes("strategic management")) {
    return "INT_P6_SECB_CH6_T1";
  }
  if (lower.includes("swot") || lower.includes("pestle") || lower.includes("porter") || lower.includes("five forces") || lower.includes("external environment") || lower.includes("internal environment") || lower.includes("value chain") || lower.includes("core competence")) {
    return "INT_P6_SECB_CH7_T1";
  }
  if (lower.includes("generic strategies") || lower.includes("cost leadership") || lower.includes("differentiation") || lower.includes("focus") || lower.includes("ansoff") || lower.includes("bcg") || lower.includes("matrix") || lower.includes("vertical integration") || lower.includes("horizontal integration") || lower.includes("diversification")) {
    return "INT_P6_SECB_CH8_T1";
  }
  if (lower.includes("implementation") || lower.includes("structure") || lower.includes("strategic leadership") || lower.includes("benchmarking") || lower.includes("strategic control") || lower.includes("functional structure") || lower.includes("matrix structure")) {
    return "INT_P6_SECB_CH9_T1";
  }
  return "INT_P6_SECB_CH6_T1";
}

function parseFmSmCaseScenarios(filePath: string, isFm: boolean): { questions: CanonicalQuestionJson[]; caseStudies: any[] } {
  if (!fs.existsSync(filePath)) return { questions: [], caseStudies: [] };
  const text = fs.readFileSync(filePath, "utf-8");

  const csBlocks = text.split(/\f?\s*CASE SCENARIO\s+(\d+)\b/i);
  const questions: CanonicalQuestionJson[] = [];
  const caseStudies: any[] = [];

  const prefix = isFm ? "INT_P6A" : "INT_P6B";
  const sectionName = isFm ? "Financial Management" : "Strategic Management";

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

    const csTitle = `Case Scenario ${csNum}: ${sectionName}`;
    const csRef = `${prefix}_CS_${csNum}`;

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
        const nodeCode = isFm
          ? mapFmCaseNode(`${scenarioText} ${qText}`)
          : mapSmCaseNode(`${scenarioText} ${qText}`);

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
            sourceTitle: `ICAI Case Scenario Booklet: ${sectionName}`,
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
  console.log("GENERATING CA INTERMEDIATE PAPER 6 (FM & SM) BATCH");
  console.log("==================================================");

  const fmChapterConfigs = [
    { file: "p6a_ch1_layout.txt", nodeCode: "INT_P6_SECA_CH1_T1", title: "FM Chapter 1: Scope and Objectives of FM" },
    { file: "p6a_ch2_layout.txt", nodeCode: "INT_P6_SECA_CH2_T1", title: "FM Chapter 2: Types of Financing" },
    { file: "p6a_ch3_layout.txt", nodeCode: "INT_P6_SECA_CH2_T1", title: "FM Chapter 3: Ratio Analysis" },
    { file: "p6a_ch4_layout.txt", nodeCode: "INT_P6_SECA_CH3_T1", title: "FM Chapter 4: Cost of Capital" },
    { file: "p6a_ch5_layout.txt", nodeCode: "INT_P6_SECA_CH3_T1", title: "FM Chapter 5: Capital Structure" },
    { file: "p6a_ch6_layout.txt", nodeCode: "INT_P6_SECA_CH3_T1", title: "FM Chapter 6: Leverages" },
    { file: "p6a_ch7_layout.txt", nodeCode: "INT_P6_SECA_CH4_T1", title: "FM Chapter 7: Investment Decisions" },
    { file: "p6a_ch8_layout.txt", nodeCode: "INT_P6_SECA_CH5_T1", title: "FM Chapter 8: Dividend Decisions" },
  ];

  const chaptersDir = path.join(__dirname, "../ingestion/intermediate/paper_6_fmsm");
  const tykQuestions: CanonicalQuestionJson[] = [];

  for (const cfg of fmChapterConfigs) {
    const fPath = path.join(chaptersDir, cfg.file);
    const qs = parseChapterTyk(fPath, cfg.nodeCode, cfg.title);
    console.log(`  -> ${cfg.title}: Extracted ${qs.length} TYK MCQs.`);
    tykQuestions.push(...qs);
  }

  console.log("\nParsing Section A (Financial Management) Case Scenario Booklet...");
  const p6aCsb = path.join(__dirname, "../ingestion/intermediate/booklets/p6a_csb_layout.txt");
  const fmData = parseFmSmCaseScenarios(p6aCsb, true);
  console.log(`  -> Extracted ${fmData.questions.length} questions across ${fmData.caseStudies.length} case scenarios.`);

  console.log("\nParsing Section B (Strategic Management) Case Scenario Booklet...");
  const p6bCsb = path.join(__dirname, "../ingestion/intermediate/booklets/p6b_csb_layout.txt");
  const smData = parseFmSmCaseScenarios(p6bCsb, false);
  console.log(`  -> Extracted ${smData.questions.length} questions across ${smData.caseStudies.length} case scenarios.`);

  const allQuestions = [...tykQuestions, ...fmData.questions, ...smData.questions];
  const allCaseStudies = [...fmData.caseStudies, ...smData.caseStudies];

  const batchJson: CanonicalBatchJson = {
    batchTitle: "CA Intermediate Paper 6 (Financial Management and Strategic Management) - Study Material & Case Scenario Booklets (May 2026)",
    academicLevelCode: "INTERMEDIATE",
    subjectCode: "PAPER_6",
    sourceType: "STUDY_MATERIAL",
    sourceYear: 2026,
    sourceMonth: 5,
    examAttemptCode: "MAY_2026",
    curriculumVersionName: "CA Intermediate Syllabus 2026-2027",
    caseStudies: allCaseStudies,
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

  const outPath = path.join(__dirname, "../ingestion/batches/intermediate_sm_p6_fmsm.json");
  fs.writeFileSync(outPath, JSON.stringify(batchJson, null, 2), "utf-8");
  console.log(`Saved batch to ${outPath}`);
  console.log("==================================================");
}

main().catch((err) => {
  console.error("Error generating P6 batch:", err);
  process.exit(1);
});
