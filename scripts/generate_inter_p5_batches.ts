import fs from "fs";
import path from "path";
import { validateImportBatch } from "../src/domains/questions/import/validation";
import { CanonicalQuestionJson, CanonicalBatchJson } from "../src/domains/questions/import/types";

function cleanLine(s: string): string {
  return s
    .replace(/\f[^\r\n]*/g, "")
    .replace(/[^\r\n]*Institute of Chartered Accountants of India[^\r\n]*/gi, "")
    .replace(/[^\r\n]*AUDITING AND ETHICS[^\r\n]*/gi, "")
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
  // Match both "1. (b)" and "1. d"
  const ansRegex = /(\d+)\.\s*\(?([A-D])\)?/gi;
  let am;
  const stopMatch = ansSection.search(/Answers to (?:the )?(?:Theoretical|Correct\/Incorrect|Questions involving)/i);
  const relevantAns = stopMatch !== -1 ? ansSection.substring(0, stopMatch) : ansSection.substring(0, 1000);

  while ((am = ansRegex.exec(relevantAns)) !== null) {
    const qNum = parseInt(am[1], 10);
    const letter = am[2].toUpperCase();
    ansMap.set(qNum, { letter, reason: `Official ICAI Study Material Answer for ${chapterName} TYK Q${qNum}.` });
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
          sourceTitle: "ICAI Study Material: Auditing and Ethics (May 2026 Edition)",
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

function mapAuditingCaseNode(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("audit strategy") || lower.includes("audit planning") || lower.includes("audit programme") || lower.includes("sa 300") || lower.includes("direction and supervision")) {
    return "INT_P5_CH2_T1";
  }
  if (lower.includes("risk assessment") || lower.includes("internal control") || lower.includes("sa 315") || lower.includes("romm") || lower.includes("it environment") || lower.includes("walkthrough")) {
    return "INT_P5_CH3_T1";
  }
  if (lower.includes("audit sampling") || lower.includes("sa 530") || lower.includes("sa 500") || lower.includes("audit evidence") || lower.includes("external confirmation") || lower.includes("sa 505")) {
    return "INT_P5_CH4_T1";
  }
  if (lower.includes("items of financial") || lower.includes("inventory") || lower.includes("trade receivables") || lower.includes("cut-off") || lower.includes("substantive procedure") || lower.includes("fixed assets")) {
    return "INT_P5_CH5_T1";
  }
  if (lower.includes("documentation") || lower.includes("working papers") || lower.includes("sa 230") || lower.includes("written representation") || lower.includes("sa 580") || lower.includes("misstatement")) {
    return "INT_P5_CH6_T1";
  }
  if (lower.includes("audit report") || lower.includes("sa 700") || lower.includes("sa 705") || lower.includes("modified opinion") || lower.includes("key audit matters") || lower.includes("sa 701")) {
    return "INT_P5_CH7_T1";
  }
  if (lower.includes("bank audit") || lower.includes("npa") || lower.includes("special features of audit") || lower.includes("government") || lower.includes("c&ag") || lower.includes("ngo") || lower.includes("educational institution")) {
    return "INT_P5_CH8_T1";
  }
  return "INT_P5_CH1_T1";
}

function parseAuditingCaseScenarios(filePath: string): { questions: CanonicalQuestionJson[]; caseStudies: any[] } {
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

    const csTitle = `Case Scenario ${csNum}: Auditing and Ethics`;
    const csRef = `INT_P5_CS_${csNum}`;

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
        const nodeCode = mapAuditingCaseNode(`${scenarioText} ${qText}`);

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
            sourceTitle: "ICAI Case Scenario Booklet: Auditing and Ethics",
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
  console.log("GENERATING CA INTERMEDIATE PAPER 5 (AUDITING) BATCH");
  console.log("==================================================");

  const chapterConfigs = [
    { file: "p5_ch1_layout.txt", nodeCode: "INT_P5_CH1_T1", title: "Chapter 1: Nature, Objective and Scope of Audit" },
    { file: "p5_ch2_layout.txt", nodeCode: "INT_P5_CH2_T1", title: "Chapter 2: Audit Strategy, Audit Planning" },
    { file: "p5_ch3_layout.txt", nodeCode: "INT_P5_CH3_T1", title: "Chapter 3: Risk Assessment and Internal Control" },
    { file: "p5_ch4_layout.txt", nodeCode: "INT_P5_CH4_T1", title: "Chapter 4: Audit Evidence" },
    { file: "p5_ch5_layout.txt", nodeCode: "INT_P5_CH5_T1", title: "Chapter 5: Audit of Items of Financial Statements" },
    { file: "p5_ch6_layout.txt", nodeCode: "INT_P5_CH6_T1", title: "Chapter 6: Audit Documentation" },
    { file: "p5_ch7_layout.txt", nodeCode: "INT_P5_CH6_T1", title: "Chapter 7: Evaluation of Misstatements" },
    { file: "p5_ch8_layout.txt", nodeCode: "INT_P5_CH7_T1", title: "Chapter 8: Audit Report" },
    { file: "p5_ch9_layout.txt", nodeCode: "INT_P5_CH8_T1", title: "Chapter 9: Special Features of Audit of Different Entities" },
    { file: "p5_ch10_layout.txt", nodeCode: "INT_P5_CH8_T1", title: "Chapter 10: Audit of Banks" },
    { file: "p5_ch11_layout.txt", nodeCode: "INT_P5_CH1_T1", title: "Chapter 11: Ethics and Independence" },
  ];

  const chaptersDir = path.join(__dirname, "../ingestion/intermediate/paper_5_auditing");
  const tykQuestions: CanonicalQuestionJson[] = [];

  for (const cfg of chapterConfigs) {
    const fPath = path.join(chaptersDir, cfg.file);
    const qs = parseChapterTyk(fPath, cfg.nodeCode, cfg.title);
    console.log(`  -> ${cfg.title}: Extracted ${qs.length} TYK MCQs.`);
    tykQuestions.push(...qs);
  }

  console.log("\nParsing Paper 5 Case Scenario Booklet...");
  const csbPath = path.join(__dirname, "../ingestion/intermediate/booklets/p5_csb_layout.txt");
  const csData = parseAuditingCaseScenarios(csbPath);
  console.log(`  -> Extracted ${csData.questions.length} questions across ${csData.caseStudies.length} case scenarios.`);

  const allQuestions = [...tykQuestions, ...csData.questions];

  const batchJson: CanonicalBatchJson = {
    batchTitle: "CA Intermediate Paper 5 (Auditing and Ethics) - Study Material & Case Scenario Booklet (May 2026)",
    academicLevelCode: "INTERMEDIATE",
    subjectCode: "PAPER_5",
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

  const outPath = path.join(__dirname, "../ingestion/batches/intermediate_sm_p5_auditing.json");
  fs.writeFileSync(outPath, JSON.stringify(batchJson, null, 2), "utf-8");
  console.log(`Saved batch to ${outPath}`);
  console.log("==================================================");
}

main().catch((err) => {
  console.error("Error generating P5 batch:", err);
  process.exit(1);
});
