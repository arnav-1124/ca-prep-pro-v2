import fs from "fs";
import path from "path";
import { validateImportQuestion, validateImportBatch } from "../src/domains/questions/import/validation";
import { CanonicalQuestionJson, CanonicalBatchJson } from "../src/domains/questions/import/types";

interface UnitConfig {
  file: string;
  nodeCode: string;
  chapterTitle: string;
  unitTitle?: string;
}

const UNITS: UnitConfig[] = [
  { file: "ch1u2_layout.txt", nodeCode: "FND_P4_CH1", chapterTitle: "Chapter 1: Nature & Scope of Business Economics" },
  { file: "ch2u3_layout.txt", nodeCode: "FND_P4_CH2", chapterTitle: "Chapter 2: Theory of Demand and Supply" },
  { file: "ch3u2_layout.txt", nodeCode: "FND_P4_CH3", chapterTitle: "Chapter 3: Theory of Production and Cost" },
  { file: "ch4u3_layout.txt", nodeCode: "FND_P4_CH4", chapterTitle: "Chapter 4: Price Determination in Different Markets" },
  { file: "ch5_layout.txt", nodeCode: "FND_P4_CH5", chapterTitle: "Chapter 5: Business Cycles" },
  { file: "ch6u1_layout.txt", nodeCode: "FND_P4_CH6", chapterTitle: "Chapter 6: Determination of National Income", unitTitle: "Unit 1: National Income Accounting" },
  { file: "ch6u2_layout.txt", nodeCode: "FND_P4_CH6", chapterTitle: "Chapter 6: Determination of National Income", unitTitle: "Unit 2: Keynesian Theory of Determination of National Income" },
  { file: "ch7u1_layout.txt", nodeCode: "FND_P4_CH7", chapterTitle: "Chapter 7: Public Finance", unitTitle: "Unit 1: Fiscal Functions" },
  { file: "ch7u2_layout.txt", nodeCode: "FND_P4_CH7", chapterTitle: "Chapter 7: Public Finance", unitTitle: "Unit 2: Market Failure" },
  { file: "ch7u3_layout.txt", nodeCode: "FND_P4_CH7", chapterTitle: "Chapter 7: Public Finance", unitTitle: "Unit 3: Fiscal Policy" },
  { file: "ch7u4_layout.txt", nodeCode: "FND_P4_CH7", chapterTitle: "Chapter 7: Public Finance", unitTitle: "Unit 4: Public Debt" },
  { file: "ch8u1_layout.txt", nodeCode: "FND_P4_CH8", chapterTitle: "Chapter 8: Money Market", unitTitle: "Unit 1: The Concept of Money Demand" },
  { file: "ch8u2_layout.txt", nodeCode: "FND_P4_CH8", chapterTitle: "Chapter 8: Money Market", unitTitle: "Unit 2: The Concept of Money Supply" },
  { file: "ch8u3_layout.txt", nodeCode: "FND_P4_CH8", chapterTitle: "Chapter 8: Money Market", unitTitle: "Unit 3: Monetary Policy" },
  { file: "ch9u1_layout.txt", nodeCode: "FND_P4_CH9", chapterTitle: "Chapter 9: International Trade", unitTitle: "Unit 1: Theories of International Trade" },
  { file: "ch9u2_layout.txt", nodeCode: "FND_P4_CH9", chapterTitle: "Chapter 9: International Trade", unitTitle: "Unit 2: Trade Policy - Tariffs and Non-Tariff Measures" },
  { file: "ch9u3_layout.txt", nodeCode: "FND_P4_CH9", chapterTitle: "Chapter 9: International Trade", unitTitle: "Unit 3: Trade Agreements" },
  { file: "ch9u4_layout.txt", nodeCode: "FND_P4_CH9", chapterTitle: "Chapter 9: International Trade", unitTitle: "Unit 4: Exchange Rate and its Economic Effects" },
  { file: "ch9u5_layout.txt", nodeCode: "FND_P4_CH9", chapterTitle: "Chapter 9: International Trade", unitTitle: "Unit 5: International Capital Movements" },
  { file: "ch10_layout.txt", nodeCode: "FND_P4_CH10", chapterTitle: "Chapter 10: Indian Economy" },
];

function cleanLineArtifacts(s: string): string {
  return s
    .replace(/\f[^\r\n]*/g, "") // strip page header lines starting with form feed
    .replace(/[^\r\n]*Institute of Chartered Accountants of India[^\r\n]*/gi, "") // strip copyright footer
    .replace(/[\r\n]+/g, " ") // normalize whitespace
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function parseUnitText(
  text: string,
  nodeCode: string,
  chapterTitle: string,
  unitPrefix: string,
  unitTitle?: string
): CanonicalQuestionJson[] {
  // 1. Locate ANSWERS block
  const answersIdx = text.lastIndexOf("ANSWERS");
  if (answersIdx === -1) {
    console.error(`  No ANSWERS block found in ${unitPrefix}`);
    return [];
  }

  const answersText = text.substring(answersIdx);
  const answerMap = new Map<number, string>();
  const ansRegex = /(\d+)\s*[\.\)]?\s*\(?([a-d])\)?/gi;
  let ansM;
  while ((ansM = ansRegex.exec(answersText)) !== null) {
    answerMap.set(parseInt(ansM[1], 10), ansM[2].toUpperCase());
  }

  const textBeforeAnswers = text.substring(0, answersIdx);
  const tykIdx = textBeforeAnswers.lastIndexOf("TEST YOUR KNOWLEDGE");
  const mcqIdx = textBeforeAnswers.lastIndexOf("Multiple Choice Questions");
  const qStartIdx = Math.max(tykIdx, mcqIdx);
  const relevantText = qStartIdx !== -1 ? textBeforeAnswers.substring(qStartIdx) : textBeforeAnswers;

  const questions: CanonicalQuestionJson[] = [];

  for (let qNum = 1; qNum <= answerMap.size; qNum++) {
    const nextNum = qNum + 1;
    const pattern = new RegExp(
      `(?:^|\\n)\\s*${qNum}\\s*[\\.\\)]\\s*(?!\\d)([\\s\\S]*?)(?=(?:(?:^|\\n)\\s*${nextNum}\\s*[\\.\\)]\\s*(?!\\d))|ANSWERS|$)`,
      "i"
    );
    const qBlockMatch = relevantText.match(pattern);
    if (!qBlockMatch) {
      continue;
    }

    const block = qBlockMatch[1];
    const optSplitRegex = /(?:^|\n)\s*\(([a-dA-D])\)\s+/g;
    const optMatches: { letter: string; index: number; length: number }[] = [];
    let om;
    while ((om = optSplitRegex.exec(block)) !== null) {
      optMatches.push({
        letter: om[1].toUpperCase(),
        index: om.index,
        length: om[0].length,
      });
    }

    if (optMatches.length < 2) {
      continue;
    }

    // Limit to max 4 options (or up to 6) if extra trailing text matched
    const validOptMatches = optMatches.slice(0, 4);

    const firstOptIndex = validOptMatches[0].index;
    const qText = cleanLineArtifacts(block.substring(0, firstOptIndex));

    const options: { letter: string; text: string }[] = [];
    const usedLetters = new Set<string>();

    for (let i = 0; i < validOptMatches.length; i++) {
      const current = validOptMatches[i];
      const nextIndex = i + 1 < validOptMatches.length ? validOptMatches[i + 1].index : block.length;
      const optText = cleanLineArtifacts(block.substring(current.index + current.length, nextIndex));

      let letter = current.letter;
      if (usedLetters.has(letter) || letter.charCodeAt(0) - 65 !== i) {
        // Correct OCR/ICAI typo in option letter
        letter = String.fromCharCode(65 + i);
      }
      usedLetters.add(letter);

      options.push({
        letter,
        text: optText,
      });
    }

    const correctAnswer = answerMap.get(qNum) || "A";

    if (qText.length >= 10 && options.length >= 2) {
      const displayTitle = unitTitle ? `${chapterTitle} — ${unitTitle}` : chapterTitle;
      questions.push({
        externalId: `SM-FND-P4-${nodeCode}-${unitPrefix}-Q${qNum.toString().padStart(3, "0")}`,
        questionType: "MCQ",
        difficulty: "MEDIUM",
        curriculum: {
          subjectCode: "PAPER_4",
          nodeCode,
          _chapterTitle: chapterTitle,
        },
        questionText: qText,
        options,
        correctAnswer,
        explanation: `As per ICAI Study Material (Paper 4: Business Economics, ${displayTitle}), the correct option is (${correctAnswer}).`,
        source: {
          sourceType: "STUDY_MATERIAL",
          sourceTitle: `ICAI Study Material — ${displayTitle}`,
          sourceYear: 2026,
          sourceMonth: 5,
          sourceAttempt: "MAY_2026",
          applicability: ["MAY_2025", "SEPT_2025", "JAN_2026", "MAY_2026", "SEPT_2026"],
        },
      });
    }
  }

  return questions;
}

async function main() {
  console.log("=== PARSING ALL CA FOUNDATION PAPER 4 (BUSINESS ECONOMICS) MCQS ===");
  const baseDir = path.join(__dirname, "../ingestion/foundation/paper_4_economics");
  const allQuestions: CanonicalQuestionJson[] = [];

  for (const u of UNITS) {
    const filePath = path.join(baseDir, u.file);
    if (!fs.existsSync(filePath)) {
      console.warn(`File not found: ${u.file}`);
      continue;
    }

    const unitPrefix = u.file.replace("_layout.txt", "").toUpperCase();
    const text = fs.readFileSync(filePath, "utf-8");
    const questions = parseUnitText(text, u.nodeCode, u.chapterTitle, unitPrefix, u.unitTitle);
    console.log(`[${u.nodeCode}] ${u.file} -> Parsed: ${questions.length} questions`);

    for (const q of questions) {
      const val = validateImportQuestion(q);
      if (!val.isValid) {
        console.warn(`  Validation failed for ${q.externalId}:`, val.errors);
      }
    }

    allQuestions.push(...questions);
  }

  console.log("\n==================================================");
  console.log(`TOTAL PAPER 4 QUESTIONS PARSED: ${allQuestions.length}`);
  console.log("==================================================");

  const part1Units = UNITS.filter(u => ["FND_P4_CH1", "FND_P4_CH2", "FND_P4_CH3", "FND_P4_CH4", "FND_P4_CH5"].includes(u.nodeCode));
  const part2Units = UNITS.filter(u => ["FND_P4_CH6", "FND_P4_CH7", "FND_P4_CH8", "FND_P4_CH9", "FND_P4_CH10"].includes(u.nodeCode));

  const batches = [
    {
      name: "foundation_sm_p4_part1_micro.json",
      title: "CA Foundation Paper 4: Business Economics — Part 1: Microeconomics (Chapters 1-5)",
      units: part1Units,
    },
    {
      name: "foundation_sm_p4_part2_macro.json",
      title: "CA Foundation Paper 4: Business Economics — Part 2: Macroeconomics & Indian Economy (Chapters 6-10)",
      units: part2Units,
    },
  ];

  const batchOutDir = path.join(__dirname, "../ingestion/batches");
  if (!fs.existsSync(batchOutDir)) {
    fs.mkdirSync(batchOutDir, { recursive: true });
  }

  for (const b of batches) {
    const questions: CanonicalQuestionJson[] = [];
    console.log(`\n=== Processing ${b.title} ===`);

    for (const u of b.units) {
      const filePath = path.join(baseDir, u.file);
      if (!fs.existsSync(filePath)) {
        console.warn(`File not found: ${u.file}`);
        continue;
      }

      const unitPrefix = u.file.replace("_layout.txt", "").toUpperCase();
      const text = fs.readFileSync(filePath, "utf-8");
      const unitQs = parseUnitText(text, u.nodeCode, u.chapterTitle, unitPrefix, u.unitTitle);
      console.log(`[${u.nodeCode}] ${u.file} -> Parsed: ${unitQs.length} questions`);
      questions.push(...unitQs);
    }

    const batchPayload: CanonicalBatchJson = {
      schemaVersion: "2.0",
      batchName: b.title,
      academicLevelCode: "FOUNDATION",
      sourceType: "STUDY_MATERIAL",
      sourceTitle: b.title,
      sourceYear: 2026,
      exportedAt: new Date().toISOString(),
      questions,
    };

    const batchVal = validateImportBatch(batchPayload);
    console.log(`Validation for ${b.name}: ${batchVal.isValid ? "✓ PASSED (100% VALID)" : "✗ FAILED"}`);
    console.log(`  Valid Questions: ${batchVal.validCount} / ${batchVal.totalQuestions}`);
    if (batchVal.invalidCount > 0 || batchVal.batchErrors.length > 0) {
      console.error(`  Invalid Questions: ${batchVal.invalidCount}`);
      console.error(`  Batch Errors:`, batchVal.batchErrors);
    }

    const batchOutFile = path.join(batchOutDir, b.name);
    fs.writeFileSync(batchOutFile, JSON.stringify(batchPayload, null, 2), "utf-8");
    console.log(`Saved: ${batchOutFile}`);
  }
}

main();
