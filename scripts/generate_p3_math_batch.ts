import fs from "fs";
import path from "path";
import { validateImportBatch } from "../src/domains/questions/import/validation";
import { CanonicalQuestionJson, CanonicalBatchJson } from "../src/domains/questions/import/types";

function cleanLine(s: string): string {
  return s
    .replace(/\f[^\r\n]*/g, "")
    .replace(/[^\r\n]*Institute of Chartered Accountants of India[^\r\n]*/gi, "")
    .replace(/[^\r\n]*BUSINESS MATHEMATICS[^\r\n]*/gi, "")
    .replace(/[^\r\n]*COMMON PROFICIENCY TEST[^\r\n]*/gi, "")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function parseExerciseBlock(
  exerciseText: string,
  answersText: string,
  nodeCode: string,
  chapterTitle: string,
  defaultAnswerMap?: Map<number, string>
): CanonicalQuestionJson[] {
  const answerMap = defaultAnswerMap || new Map<number, string>();
  if (!defaultAnswerMap && answersText) {
    const ansRegex = /(?:^|\s)(\d{1,3})\s*[\.\)]?\s*\(?([a-d])\)?/gi;
    let m;
    while ((m = ansRegex.exec(answersText)) !== null) {
      const qNum = parseInt(m[1], 10);
      if (qNum > 0 && qNum < 200 && !answerMap.has(qNum)) {
        answerMap.set(qNum, m[2].toUpperCase());
      }
    }
  }

  const qNumRegex = /(?:^|\n)\s*(\d{1,3})\s*[\.\)]\s+/g;
  const qMarkers: { num: number; index: number; length: number }[] = [];
  let qm;
  while ((qm = qNumRegex.exec(exerciseText)) !== null) {
    qMarkers.push({
      num: parseInt(qm[1], 10),
      index: qm.index,
      length: qm[0].length,
    });
  }

  const questions: CanonicalQuestionJson[] = [];

  for (let i = 0; i < qMarkers.length; i++) {
    const current = qMarkers[i];
    const nextIndex = i + 1 < qMarkers.length ? qMarkers[i + 1].index : exerciseText.length;
    const block = exerciseText.substring(current.index + current.length, nextIndex);

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
      canonicalNodeCode: nodeCode,
      questionType: "MCQ",
      difficulty: "MEDIUM",
      questionText: qText,
      options,
      correctAnswer,
      explanation: `Correct answer according to official ICAI Study Material for ${chapterTitle} is (${correctAnswer}).`,
      sourceYear: 2026,
      sourceMonth: 5,
    });
  }

  return questions;
}

function parseChapter(
  filePath: string,
  nodeCode: string,
  title: string
): CanonicalQuestionJson[] {
  const text = fs.readFileSync(filePath, "utf-8").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const ansRegex = /(?:^|\s)(\d{1,3})\s*[\.\)]?\s*\(?([a-d])\)?/gi;
  const answerMap = new Map<number, string>();
  let m;
  while ((m = ansRegex.exec(text)) !== null) {
    const qNum = parseInt(m[1], 10);
    if (qNum > 0 && qNum < 200 && !answerMap.has(qNum)) {
      answerMap.set(qNum, m[2].toUpperCase());
    }
  }

  return parseExerciseBlock(text, "", nodeCode, title, answerMap);
}

async function main() {
  console.log("=== GENERATING PAPER 3 PART A BATCHES ===");
  const quantDir = path.join(__dirname, "../ingestion/foundation/paper_3_quant");
  const outDir = path.join(__dirname, "../ingestion/batches");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const batchConfigs = [
    {
      file: "foundation_sm_p3_math_part1.json",
      name: "CA Foundation Paper 3: Business Mathematics (Part 1: Ch 1 to 4)",
      chapters: [
        { file: "ch1_layout.txt", nodeCode: "FND_P3_CH1", title: "Ratio and Proportion, Indices and Logarithms" },
        { file: "ch2_layout.txt", nodeCode: "FND_P3_CH2", title: "Equations" },
        { file: "ch3_layout.txt", nodeCode: "FND_P3_CH3", title: "Linear Inequalities" },
        { file: "ch4_layout.txt", nodeCode: "FND_P3_CH4", title: "Mathematics of Finance" },
      ],
    },
    {
      file: "foundation_sm_p3_math_part2.json",
      name: "CA Foundation Paper 3: Business Mathematics (Part 2: Ch 5 to 6)",
      chapters: [
        { file: "ch5_layout.txt", nodeCode: "FND_P3_CH5", title: "Basic Principles of Permutations and Combinations" },
        { file: "ch6_layout.txt", nodeCode: "FND_P3_CH6", title: "Sequence and Series - AP & GP" },
      ],
    },
    {
      file: "foundation_sm_p3_math_part3.json",
      name: "CA Foundation Paper 3: Business Mathematics (Part 3: Ch 7 to 8)",
      chapters: [
        { file: "ch7_layout.txt", nodeCode: "FND_P3_CH7", title: "Sets, Relations and Functions" },
        { file: "ch8u2_layout.txt", nodeCode: "FND_P3_CH8", title: "Basic Applications of Differential and Integral Calculus" },
      ],
    },
  ];

  for (const b of batchConfigs) {
    console.log(`\nProcessing ${b.name}...`);
    const batchQuestions: CanonicalQuestionJson[] = [];

    for (const ch of b.chapters) {
      const filePath = path.join(quantDir, ch.file);
      const qs = parseChapter(filePath, ch.nodeCode, ch.title);
      console.log(`  [${ch.nodeCode}] ${ch.title}: ${qs.length} questions`);
      batchQuestions.push(...qs);
    }

    console.log(`  Total for ${b.name}: ${batchQuestions.length} questions`);

    const batchPayload: CanonicalBatchJson = {
      schemaVersion: "2.0",
      batchMetadata: {
        batchName: b.name,
        sourceType: "STUDY_MATERIAL",
        sourceTitle: "ICAI Foundation Study Material - Business Mathematics (May 2026 Onwards)",
        sourceYear: 2026,
        sourceMonth: 5,
        targetLevelCode: "FOUNDATION",
        targetVersionName: "CA Foundation Syllabus 2026-2027",
      },
      questions: batchQuestions,
    };

    const validation = validateImportBatch(batchPayload);
    console.log(`  Validation: ${validation.isValid ? "VALID" : "INVALID"} (Total: ${validation.totalQuestions}, Valid: ${validation.validCount}, Invalid: ${validation.invalidCount})`);

    if (!validation.isValid) {
      console.error("  Batch Errors:", validation.batchErrors);
      process.exit(1);
    }

    const outPath = path.join(outDir, b.file);
    fs.writeFileSync(outPath, JSON.stringify(batchPayload, null, 2), "utf-8");
    console.log(`  Saved to ${outPath}`);
  }

  console.log("\nAll 3 Business Mathematics batches generated and validated successfully!");
}

main().catch(console.error);
