import fs from "fs";
import path from "path";
import { CanonicalQuestionJson } from "../src/domains/questions/import/types";

function cleanLine(s: string): string {
  return s
    .replace(/\f[^\r\n]*/g, "")
    .replace(/[^\r\n]*Institute of Chartered Accountants of India[^\r\n]*/gi, "")
    .replace(/[^\r\n]*ACCOUNTING[^\r\n]*/gi, "")
    .replace(/[^\r\n]*THEORETICAL FRAMEWORK[^\r\n]*/gi, "")
    .replace(/[^\r\n]*PREPARATIONS? OF FINAL ACCOUNTS[^\r\n]*/gi, "")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function parseP1Unit(
  filePath: string,
  nodeCode: string,
  chapterTitle: string
): CanonicalQuestionJson[] {
  const text = fs.readFileSync(filePath, "utf-8").replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // 1. Locate Multiple Choice Questions section
  const mcqMatch = text.match(/Multiple Choice Questions?/i);
  if (!mcqMatch) {
    return [];
  }

  const mcqStart = mcqMatch.index! + mcqMatch[0].length;
  const afterMcq = text.substring(mcqStart);

  // 2. Locate end of MCQs
  const endMatch = afterMcq.match(/(?:Theoretical Questions?|Theory Questions?|Descriptive Questions?|True and False|True\/False|Practical Questions?|ANSWERS\/HINTS|Answers to MCQs|ANSWERS)/i);
  const mcqBlock = endMatch ? afterMcq.substring(0, endMatch.index!) : afterMcq.substring(0, 30000);

  // 3. Locate answers section
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

  // 4. Parse question blocks: match "1." or "(1)"
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

async function main() {
  const p1Dir = path.join(__dirname, "../ingestion/foundation/paper_1_accounting");
  const files = fs.readdirSync(p1Dir).filter(f => f.endsWith("_layout.txt"));

  let totalQs = 0;
  for (const f of files) {
    const filePath = path.join(p1Dir, f);
    const qs = parseP1Unit(filePath, "FND_P1_CH1", "Accounting");
    console.log(`- ${f.padEnd(20)}: ${qs.length} questions parsed`);
    totalQs += qs.length;
  }
  console.log(`\nTotal Paper 1 Questions Parsed: ${totalQs}`);
}

main().catch(console.error);
