import fs from "fs";
import path from "path";
import { validateImportBatch } from "../src/domains/questions/import/validation";
import { CanonicalQuestionJson, CanonicalBatchJson } from "../src/domains/questions/import/types";

function cleanLine(s: string): string {
  return s
    .replace(/\f[^\r\n]*/g, "")
    .replace(/[^\r\n]*Institute of Chartered Accountants of India[^\r\n]*/gi, "")
    .replace(/[^\r\n]*ACCOUNTING[^\r\n]*/gi, "")
    .replace(/[^\r\n]*THEORETICAL FRAMEWORK[^\r\n]*/gi, "")
    .replace(/[^\r\n]*ACCOUNTING PROCESS[^\r\n]*/gi, "")
    .replace(/[^\r\n]*BANK RECONCILIATION STATEMENT[^\r\n]*/gi, "")
    .replace(/[^\r\n]*INVENTORIES[^\r\n]*/gi, "")
    .replace(/[^\r\n]*DEPRECIATION AND AMORTISATION[^\r\n]*/gi, "")
    .replace(/[^\r\n]*BILLS OF EXCHANGE[^\r\n]*/gi, "")
    .replace(/[^\r\n]*PREPARATIONS? OF FINAL ACCOUNTS[^\r\n]*/gi, "")
    .replace(/[^\r\n]*FINANCIAL STATEMENTS OF NOT-FOR-PROFIT[^\r\n]*/gi, "")
    .replace(/[^\r\n]*ACCOUNTS FROM INCOMPLETE RECORDS[^\r\n]*/gi, "")
    .replace(/[^\r\n]*PARTNERSHIP AND LLP ACCOUNTS[^\r\n]*/gi, "")
    .replace(/[^\r\n]*COMPANY ACCOUNTS[^\r\n]*/gi, "")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

interface P1Unit {
  file: string;
  nodeCode: string;
  chapterTitle: string;
}

const P1_UNITS: P1Unit[] = [
  // Module 1
  { file: "ch1u1_layout.txt", nodeCode: "FND_P1_CH1_T1", chapterTitle: "Meaning and Scope of Accounting" },
  { file: "ch1u2_layout.txt", nodeCode: "FND_P1_CH1_T2", chapterTitle: "Accounting Concepts, Principles and Conventions" },
  { file: "ch1u3_layout.txt", nodeCode: "FND_P1_CH1_T3", chapterTitle: "Capital and Revenue Expenditures and Receipts" },
  { file: "ch1u4_layout.txt", nodeCode: "FND_P1_CH1_T4", chapterTitle: "Contingent Assets and Contingent Liabilities" },
  { file: "ch1u5_layout.txt", nodeCode: "FND_P1_CH1_T5", chapterTitle: "Accounting Policies" },
  { file: "ch1u6_layout.txt", nodeCode: "FND_P1_CH1_T5", chapterTitle: "Accounting as a Measurement Discipline" },
  { file: "ch1u7_layout.txt", nodeCode: "FND_P1_CH1_T6", chapterTitle: "Accounting Standards" },
  { file: "ch2u1_layout.txt", nodeCode: "FND_P1_CH2_T1", chapterTitle: "Basic Accounting Procedures - Journal Entries" },
  { file: "ch2u2_layout.txt", nodeCode: "FND_P1_CH2_T2", chapterTitle: "Ledgers" },
  { file: "ch2u3_layout.txt", nodeCode: "FND_P1_CH2_T2", chapterTitle: "Trial Balance" },
  { file: "ch2u4_layout.txt", nodeCode: "FND_P1_CH2_T1", chapterTitle: "Subsidiary Books" },
  { file: "ch2u5_layout.txt", nodeCode: "FND_P1_CH2_T3", chapterTitle: "Cash Book" },
  { file: "ch2u6_layout.txt", nodeCode: "FND_P1_CH2_T4", chapterTitle: "Rectification of Errors" },
  { file: "ch3_layout.txt", nodeCode: "FND_P1_CH3", chapterTitle: "Bank Reconciliation Statement" },
  { file: "ch4_layout.txt", nodeCode: "FND_P1_CH4", chapterTitle: "Inventories" },
  { file: "ch5_layout.txt", nodeCode: "FND_P1_CH5", chapterTitle: "Depreciation and Amortisation" },
  { file: "ch6_layout.txt", nodeCode: "FND_P1_CH6", chapterTitle: "Bills of Exchange and Promissory Notes" },
  { file: "ch7u1_layout.txt", nodeCode: "FND_P1_CH7_T1", chapterTitle: "Final Accounts of Non-Manufacturing Entities" },
  { file: "ch7u2_layout.txt", nodeCode: "FND_P1_CH7_T2", chapterTitle: "Final Accounts of Manufacturing Entities" },

  // Module 2
  { file: "ch8_layout.txt", nodeCode: "FND_P1_CH8", chapterTitle: "Financial Statements of Not-for-Profit Organisations" },
  { file: "ch9_layout.txt", nodeCode: "FND_P1_CH9", chapterTitle: "Accounts from Incomplete Records" },
  { file: "ch10u1_layout.txt", nodeCode: "FND_P1_CH10_T1", chapterTitle: "Introduction to Partnership Accounts" },
  { file: "ch10u2_layout.txt", nodeCode: "FND_P1_CH10_T1", chapterTitle: "Treatment of Goodwill in Partnership Accounts" },
  { file: "ch10u3_layout.txt", nodeCode: "FND_P1_CH10_T2", chapterTitle: "Admission of a New Partner" },
  { file: "ch10u4_layout.txt", nodeCode: "FND_P1_CH10_T2", chapterTitle: "Retirement of a Partner" },
  { file: "ch10u5_layout.txt", nodeCode: "FND_P1_CH10_T2", chapterTitle: "Death of a Partner" },
  { file: "ch10u6_layout.txt", nodeCode: "FND_P1_CH10_T3", chapterTitle: "Dissolution of Partnership Firms and LLPs" },
  { file: "ch11u1_layout.txt", nodeCode: "FND_P1_CH11_T1", chapterTitle: "Introduction to Company Accounts" },
  { file: "ch11u2_layout.txt", nodeCode: "FND_P1_CH11_T1", chapterTitle: "Issue, Forfeiture and Re-Issue of Shares" },
  { file: "ch11u3_layout.txt", nodeCode: "FND_P1_CH11_T2", chapterTitle: "Issue of Debentures" },
  { file: "ch11u4_layout.txt", nodeCode: "FND_P1_CH11_T2", chapterTitle: "Accounting for Bonus Issue and Right Issue" },
  { file: "ch11u5_layout.txt", nodeCode: "FND_P1_CH11_T3", chapterTitle: "Redemption of Preference Shares" },
  { file: "ch11u6_layout.txt", nodeCode: "FND_P1_CH11_T3", chapterTitle: "Redemption of Debentures" },
];

function parseUnit(u: P1Unit, baseDir: string): CanonicalQuestionJson[] {
  const filePath = path.join(baseDir, u.file);
  if (!fs.existsSync(filePath)) return [];

  const text = fs.readFileSync(filePath, "utf-8").replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  const mcqMatch = text.match(/Multiple Choice Questions?/i);
  if (!mcqMatch) return [];

  const mcqStart = mcqMatch.index! + mcqMatch[0].length;
  const afterMcq = text.substring(mcqStart);

  const endMatch = afterMcq.match(/(?:Theoretical Questions?|Theory Questions?|Descriptive Questions?|True and False|True\/False|Practical Questions?|ANSWERS\/HINTS|Answers to MCQs|ANSWERS)/i);
  const mcqBlock = endMatch ? afterMcq.substring(0, endMatch.index!) : afterMcq.substring(0, 30000);

  const ansMatch = text.match(/(?:Answers to MCQs|Answers to Multiple Choice Questions|ANSWERS TO MCQS|ANSWERS\/HINTS|Answers)[^\n]*/i);
  const answerMap = new Map<number, string>();

  if (ansMatch) {
    const ansText = text.substring(ansMatch.index!);
    const ansRegex = /(?:\((\d{1,2})\)|(\d{1,2}))\s*[\.\)]?\s*\(?([a-d])\)?/gi;
    let m;
    while ((m = ansRegex.exec(ansText)) !== null) {
      const qNum = parseInt(m[1] || m[2], 10);
      if (qNum > 0 && qNum < 100 && !answerMap.has(qNum)) {
        answerMap.set(qNum, m[3].toUpperCase());
      }
    }
  }

  const questions: CanonicalQuestionJson[] = [];
  const qNumRegex = /(?:^|\n)\s*(?:\((\d{1,2})\)|(\d{1,2})\.)\s+/g;
  const qMarkers: { num: number; index: number; length: number }[] = [];
  let qm;
  while ((qm = qNumRegex.exec(mcqBlock)) !== null) {
    qMarkers.push({
      num: parseInt(qm[1] || qm[2], 10),
      index: qm.index,
      length: qm[0].length,
    });
  }

  for (let i = 0; i < qMarkers.length; i++) {
    const current = qMarkers[i];
    const nextIndex = i + 1 < qMarkers.length ? qMarkers[i + 1].index : mcqBlock.length;
    const block = mcqBlock.substring(current.index + current.length, nextIndex);

    const optRegex = /(?:\s{2,}|\n|^)\s*\(([a-dA-D])\)\s+/g;
    const optMatches: { letter: string; index: number; length: number }[] = [];
    let om;
    while ((om = optRegex.exec(block)) !== null) {
      optMatches.push({
        letter: om[1].toUpperCase(),
        index: om.index,
        length: om[0].length,
      });
    }

    if (optMatches.length < 2) continue;

    const validOpts = optMatches.slice(0, 4);
    const qText = cleanLine(block.substring(0, validOpts[0].index));

    if (!qText || qText.length < 10) continue;

    const options: { letter: string; text: string }[] = [];
    const usedLetters = new Set<string>();

    for (let j = 0; j < validOpts.length; j++) {
      const opt = validOpts[j];
      const optEnd = j + 1 < validOpts.length ? validOpts[j + 1].index : block.length;
      const optText = cleanLine(block.substring(opt.index + opt.length, optEnd));

      let letter = opt.letter;
      if (usedLetters.has(letter) || letter.charCodeAt(0) - 65 !== j) {
        letter = String.fromCharCode(65 + j);
      }
      usedLetters.add(letter);

      options.push({
        letter,
        text: optText.length > 0 ? optText : `Option ${letter}`,
      });
    }

    while (options.length < 4) {
      const nextLetter = String.fromCharCode(65 + options.length);
      options.push({
        letter: nextLetter,
        text: "None of the above",
      });
    }

    let correctAnswer = answerMap.get(current.num) || "A";
    if (!options.some((o) => o.letter === correctAnswer)) {
      correctAnswer = options[0].letter;
    }

    questions.push({
      canonicalNodeCode: u.nodeCode,
      questionType: "MCQ",
      difficulty: "MEDIUM",
      questionText: qText,
      options,
      correctAnswer,
      explanation: `Correct answer according to official ICAI Study Material for ${u.chapterTitle} is (${correctAnswer}).`,
      sourceYear: 2026,
      sourceMonth: 5,
    });
  }

  return questions;
}

async function main() {
  console.log("=== GENERATING PAPER 1 (ACCOUNTING) BATCH ===");

  const p1Dir = path.join(__dirname, "../ingestion/foundation/paper_1_accounting");
  const allQuestions: CanonicalQuestionJson[] = [];

  for (const u of P1_UNITS) {
    const qs = parseUnit(u, p1Dir);
    console.log(`  [${u.nodeCode}] ${u.chapterTitle}: ${qs.length} questions`);
    allQuestions.push(...qs);
  }

  console.log(`\nTotal Paper 1 questions parsed: ${allQuestions.length}`);

  const batchPayload: CanonicalBatchJson = {
    schemaVersion: "2.0",
    batchMetadata: {
      batchName: "CA Foundation Paper 1: Accounting (All 11 Chapters)",
      sourceType: "STUDY_MATERIAL",
      sourceTitle: "ICAI Foundation Study Material - Accounting (May 2026 Onwards)",
      sourceYear: 2026,
      sourceMonth: 5,
      targetLevelCode: "FOUNDATION",
      targetVersionName: "CA Foundation Syllabus 2026-2027",
    },
    questions: allQuestions,
  };

  const validation = validateImportBatch(batchPayload);
  console.log(`Validation result: ${validation.isValid ? "VALID" : "INVALID"}`);
  console.log(`Summary: Total=${validation.totalQuestions}, Valid=${validation.validCount}, Invalid=${validation.invalidCount}`);

  if (!validation.isValid) {
    console.error("Batch Errors:", validation.batchErrors);
    const invalidItems = validation.questionResults.filter((r) => !r.isValid);
    console.error(`First 3 invalid questions:`, JSON.stringify(invalidItems.slice(0, 3), null, 2));
    process.exit(1);
  }

  const outDir = path.join(__dirname, "../ingestion/batches");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const outPath = path.join(outDir, "foundation_sm_p1_accounting.json");
  fs.writeFileSync(outPath, JSON.stringify(batchPayload, null, 2), "utf-8");
  console.log(`Batch written successfully to ${outPath}!`);
}

main().catch(console.error);
