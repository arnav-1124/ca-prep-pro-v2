import fs from "fs";
import path from "path";
import { validateImportBatch } from "../src/domains/questions/import/validation";
import { CanonicalQuestionJson, CanonicalBatchJson } from "../src/domains/questions/import/types";

function cleanLine(s: string): string {
  return s
    .replace(/\f[^\r\n]*/g, "")
    .replace(/[^\r\n]*Institute of Chartered Accountants of India[^\r\n]*/gi, "")
    .replace(/[^\r\n]*BUSINESS LAWS[^\r\n]*/gi, "")
    .replace(/[^\r\n]*THE INDIAN CONTRACT ACT[^\r\n]*/gi, "")
    .replace(/[^\r\n]*INDIAN REGULATORY FRAMEWORK[^\r\n]*/gi, "")
    .replace(/[^\r\n]*THE SALE OF GOODS ACT[^\r\n]*/gi, "")
    .replace(/[^\r\n]*THE INDIAN PARTNERSHIP ACT[^\r\n]*/gi, "")
    .replace(/[^\r\n]*THE LIMITED LIABILITY PARTNERSHIP ACT[^\r\n]*/gi, "")
    .replace(/[^\r\n]*THE COMPANIES ACT[^\r\n]*/gi, "")
    .replace(/[^\r\n]*THE NEGOTIABLE INSTRUMENTS ACT[^\r\n]*/gi, "")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

interface P2Unit {
  file: string;
  nodeCode: string;
  chapterTitle: string;
}

const P2_UNITS: P2Unit[] = [
  { file: "ch1_layout.txt", nodeCode: "FND_P2_CH1", chapterTitle: "Indian Regulatory Framework" },
  { file: "ch2u1_layout.txt", nodeCode: "FND_P2_CH2_T1", chapterTitle: "The Indian Contract Act: Nature of Contracts" },
  { file: "ch2u2_layout.txt", nodeCode: "FND_P2_CH2_T2", chapterTitle: "The Indian Contract Act: Consideration" },
  { file: "ch2u3_layout.txt", nodeCode: "FND_P2_CH2_T2", chapterTitle: "The Indian Contract Act: Essential Elements of Contract" },
  { file: "ch2u4_layout.txt", nodeCode: "FND_P2_CH2_T3", chapterTitle: "The Indian Contract Act: Performance of Contract" },
  { file: "ch2u5_layout.txt", nodeCode: "FND_P2_CH2_T4", chapterTitle: "The Indian Contract Act: Breach of Contract" },
  { file: "ch2u6_layout.txt", nodeCode: "FND_P2_CH2_T5", chapterTitle: "The Indian Contract Act: Contingent and Quasi Contracts" },
  { file: "ch2u7_layout.txt", nodeCode: "FND_P2_CH2", chapterTitle: "The Indian Contract Act: Indemnity and Guarantee" },
  { file: "ch2u8_layout.txt", nodeCode: "FND_P2_CH2", chapterTitle: "The Indian Contract Act: Bailment and Pledge" },
  { file: "ch2u9_layout.txt", nodeCode: "FND_P2_CH2", chapterTitle: "The Indian Contract Act: Agency" },
  { file: "ch3u1_layout.txt", nodeCode: "FND_P2_CH3_T1", chapterTitle: "The Sale of Goods Act: Formation of Contract of Sale" },
  { file: "ch3u2_layout.txt", nodeCode: "FND_P2_CH3_T2", chapterTitle: "The Sale of Goods Act: Conditions and Warranties" },
  { file: "ch3u3_layout.txt", nodeCode: "FND_P2_CH3_T3", chapterTitle: "The Sale of Goods Act: Transfer of Ownership" },
  { file: "ch3u4_layout.txt", nodeCode: "FND_P2_CH3_T4", chapterTitle: "The Sale of Goods Act: Unpaid Seller" },
  { file: "ch4u1_layout.txt", nodeCode: "FND_P2_CH4_T1", chapterTitle: "The Indian Partnership Act: General Nature of Partnership" },
  { file: "ch4u2_layout.txt", nodeCode: "FND_P2_CH4_T2", chapterTitle: "The Indian Partnership Act: Relations of Partners" },
  { file: "ch4u3_layout.txt", nodeCode: "FND_P2_CH4_T3", chapterTitle: "The Indian Partnership Act: Registration and Dissolution" },
  { file: "ch5_layout.txt", nodeCode: "FND_P2_CH5", chapterTitle: "The Limited Liability Partnership Act, 2008" },
  { file: "ch6_layout.txt", nodeCode: "FND_P2_CH6", chapterTitle: "The Companies Act, 2013" },
  { file: "ch7_layout.txt", nodeCode: "FND_P2_CH7", chapterTitle: "The Negotiable Instruments Act, 1881" },
];

function parseUnit(u: P2Unit, baseDir: string): CanonicalQuestionJson[] {
  const filePath = path.join(baseDir, u.file);
  if (!fs.existsSync(filePath)) return [];

  const text = fs.readFileSync(filePath, "utf-8").replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  const mcqMatch = text.match(/Multiple Choice Questions?/i);
  if (!mcqMatch) return [];

  const mcqStart = mcqMatch.index! + mcqMatch[0].length;
  const afterMcq = text.substring(mcqStart);

  const endMatch = afterMcq.match(/(?:Descriptive Questions?|Theoretical Questions?|Theory Questions?|True and False|True\/False|ANSWER\/HINTS|Answers to MCQs|ANSWERS)/i);
  const mcqBlock = endMatch ? afterMcq.substring(0, endMatch.index!) : afterMcq.substring(0, 25000);

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
  console.log("=== GENERATING PAPER 2 (BUSINESS LAWS) BATCH ===");

  const p2Dir = path.join(__dirname, "../ingestion/foundation/paper_2_laws");
  const allQuestions: CanonicalQuestionJson[] = [];

  for (const u of P2_UNITS) {
    const qs = parseUnit(u, p2Dir);
    console.log(`  [${u.nodeCode}] ${u.chapterTitle}: ${qs.length} questions`);
    allQuestions.push(...qs);
  }

  console.log(`\nTotal Paper 2 questions parsed: ${allQuestions.length}`);

  const batchPayload: CanonicalBatchJson = {
    schemaVersion: "2.0",
    batchMetadata: {
      batchName: "CA Foundation Paper 2: Business Laws (All 7 Chapters)",
      sourceType: "STUDY_MATERIAL",
      sourceTitle: "ICAI Foundation Study Material - Business Laws (May 2026 Onwards)",
      sourceYear: 2026,
      sourceMonth: 5,
      targetLevelCode: "FOUNDATION",
      targetVersionName: "CA Foundation Syllabus 2026-2027",
    },
    questions: allQuestions,
  };

  // Validate entire batch against Canonical Schema v2.0
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

  const outPath = path.join(outDir, "foundation_sm_p2_business_laws.json");
  fs.writeFileSync(outPath, JSON.stringify(batchPayload, null, 2), "utf-8");
  console.log(`Batch written successfully to ${outPath}!`);
}

main().catch(console.error);
