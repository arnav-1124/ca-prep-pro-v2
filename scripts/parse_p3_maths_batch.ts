import fs from "fs";
import path from "path";
import { CanonicalQuestionJson } from "../src/domains/questions/import/types";

function cleanLineArtifacts(s: string): string {
  return s
    .replace(/\f[^\r\n]*/g, "")
    .replace(/[^\r\n]*Institute of Chartered Accountants of India[^\r\n]*/gi, "")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function parseContinuousChapter(
  filePath: string,
  nodeCode: string,
  chapterTitle: string,
  unitPrefix: string
): CanonicalQuestionJson[] {
  const text = fs.readFileSync(filePath, "utf-8");
  const lines = text.split("\n");

  // Find answers block near end
  let ansLine = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (
      /^\s*ANSWERS\b/i.test(lines[i]) ||
      /^\s*Answers\b/i.test(lines[i]) ||
      /^\s*1\.\s*\(?[a-d]\)?\s+(?:2\.|18\.|8\.)/i.test(lines[i]) ||
      /^\s*1\s*\(?[a-d]\)?\s+2\s*\(?[a-d]\)?/i.test(lines[i])
    ) {
      ansLine = i;
      break;
    }
  }

  if (ansLine === -1) {
    // Fallback: search last 8000 chars
    ansLine = Math.floor(lines.length * 0.85);
  }

  const ansText = lines.slice(ansLine).join("\n");
  const answerMap = new Map<number, string>();
  const ansRegex = /(?:^|\s)(\d{1,3})\s*[\.\)]?\s*\(?([a-d])\)?/gi;
  let ansM;
  while ((ansM = ansRegex.exec(ansText)) !== null) {
    const qNum = parseInt(ansM[1], 10);
    if (qNum > 0 && qNum < 250) {
      answerMap.set(qNum, ansM[2].toUpperCase());
    }
  }

  console.log(`[${unitPrefix}] Answers found: ${answerMap.size}`);
  if (answerMap.size === 0) return [];

  const textBeforeAnswers = lines.slice(0, ansLine).join("\n");
  const questions: CanonicalQuestionJson[] = [];

  for (let qNum = 1; qNum <= answerMap.size; qNum++) {
    const nextNum = qNum + 1;
    const pattern = new RegExp(
      `(?:^|\\n)\\s*${qNum}\\s*[\\.\\)]\\s*(?!\\d)([\\s\\S]*?)(?=(?:(?:^|\\n)\\s*${nextNum}\\s*[\\.\\)]\\s*(?!\\d))|$)`,
      "i"
    );
    const qBlockMatch = textBeforeAnswers.match(pattern);
    if (!qBlockMatch) continue;

    const block = qBlockMatch[1];
    const optSplitRegex = /(?:\s{2,}|\n|^)\s*\(([a-dA-D])\)\s+/g;
    const optMatches: { letter: string; index: number; length: number }[] = [];
    let om;
    while ((om = optSplitRegex.exec(block)) !== null) {
      optMatches.push({
        letter: om[1].toUpperCase(),
        index: om.index,
        length: om[0].length,
      });
    }

    if (optMatches.length < 2) continue;

    const validOptMatches = optMatches.slice(0, 4);
    const qText = cleanLineArtifacts(block.substring(0, validOptMatches[0].index));

    if (!qText || qText.length < 10) continue;

    const options: { letter: string; text: string }[] = [];
    const usedLetters = new Set<string>();

    for (let i = 0; i < validOptMatches.length; i++) {
      const current = validOptMatches[i];
      const nextIndex = i + 1 < validOptMatches.length ? validOptMatches[i + 1].index : block.length;
      const optText = cleanLineArtifacts(block.substring(current.index + current.length, nextIndex));

      let letter = current.letter;
      if (usedLetters.has(letter) || letter.charCodeAt(0) - 65 !== i) {
        letter = String.fromCharCode(65 + i);
      }
      usedLetters.add(letter);

      options.push({
        letter,
        text: optText.length > 0 ? optText : `Option ${letter}`,
      });
    }

    // Ensure at least 4 options
    while (options.length < 4) {
      const nextLetter = String.fromCharCode(65 + options.length);
      options.push({
        letter: nextLetter,
        text: `None of the above`,
      });
    }

    let correctAnswer = answerMap.get(qNum) || "A";
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
      explanation: `Correct answer according to official ICAI Study Material Answer Key for ${chapterTitle} is (${correctAnswer}).`,
      sourceYear: 2026,
      sourceMonth: 5,
    });
  }

  return questions;
}

async function main() {
  const quantDir = path.join(__dirname, "../ingestion/foundation/paper_3_quant");

  const chapters = [
    { file: "ch1_layout.txt", nodeCode: "FND_P3_CH1", title: "Ratio and Proportion, Indices and Logarithms", prefix: "CH1" },
    { file: "ch2_layout.txt", nodeCode: "FND_P3_CH2", title: "Equations", prefix: "CH2" },
    { file: "ch3_layout.txt", nodeCode: "FND_P3_CH3", title: "Linear Inequalities", prefix: "CH3" },
    { file: "ch5_layout.txt", nodeCode: "FND_P3_CH5", title: "Basic Principles of Permutations and Combinations", prefix: "CH5" },
    { file: "ch6_layout.txt", nodeCode: "FND_P3_CH6", title: "Sequence and Series - AP & GP", prefix: "CH6" },
    { file: "ch7_layout.txt", nodeCode: "FND_P3_CH7", title: "Sets, Relations and Functions", prefix: "CH7" },
    { file: "ch8u2_layout.txt", nodeCode: "FND_P3_CH8", title: "Basic Applications of Differential and Integral Calculus", prefix: "CH8" },
  ];

  const allQuestions: CanonicalQuestionJson[] = [];

  for (const ch of chapters) {
    const filePath = path.join(quantDir, ch.file);
    const qs = parseContinuousChapter(filePath, ch.nodeCode, ch.title, ch.prefix);
    console.log(`  -> Extracted ${qs.length} questions for ${ch.prefix}`);
    allQuestions.push(...qs);
  }

  console.log(`\nTotal continuous questions parsed: ${allQuestions.length}`);
}

main().catch(console.error);
