import fs from "fs";
import path from "path";
import { validateImportQuestion } from "../src/domains/questions/import/validation";
import { CanonicalQuestionJson } from "../src/domains/questions/import/types";

function cleanLineArtifacts(s: string): string {
  return s
    .replace(/\f[^\r\n]*/g, "") // strip page header lines starting with form feed
    .replace(/[^\r\n]*Institute of Chartered Accountants of India[^\r\n]*/gi, "") // strip copyright footer
    .replace(/[\r\n]+/g, " ") // normalize whitespace
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function parseQuantUnitText(
  text: string,
  nodeCode: string,
  chapterTitle: string,
  unitPrefix: string,
  customAnswersMarker?: string
): CanonicalQuestionJson[] {
  // 1. Locate answers block
  let answersIdx = -1;
  if (customAnswersMarker) {
    answersIdx = text.lastIndexOf(customAnswersMarker);
  } else {
    const idx1 = text.lastIndexOf("ANSWERS");
    const idx2 = text.lastIndexOf("Answers");
    answersIdx = Math.max(idx1, idx2);
  }

  if (answersIdx === -1) {
    console.error(`  No answers block found for ${unitPrefix}`);
    return [];
  }

  const answersText = text.substring(answersIdx);
  const answerMap = new Map<number, string>();
  const ansRegex = /(\d+)\s*[\.\)]?\s*\(?([a-d])\)?/gi;
  let ansM;
  while ((ansM = ansRegex.exec(answersText)) !== null) {
    answerMap.set(parseInt(ansM[1], 10), ansM[2].toUpperCase());
  }

  console.log(`  [${unitPrefix}] Answers found: ${answerMap.size}`);
  if (answerMap.size === 0) return [];

  const textBeforeAnswers = text.substring(0, answersIdx);
  const questions: CanonicalQuestionJson[] = [];

  for (let qNum = 1; qNum <= answerMap.size; qNum++) {
    const nextNum = qNum + 1;
    const pattern = new RegExp(
      `(?:^|\\n)\\s*${qNum}\\s*[\\.\\)]\\s*(?!\\d)([\\s\\S]*?)(?=(?:(?:^|\\n)\\s*${nextNum}\\s*[\\.\\)]\\s*(?!\\d))|${customAnswersMarker || "ANSWERS|Answers"}|$)`,
      "i"
    );
    const qBlockMatch = textBeforeAnswers.match(pattern);
    if (!qBlockMatch) {
      continue;
    }

    const block = qBlockMatch[1];
    // In Quant, options can be on separate lines OR separated by 2+ spaces horizontally
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

    if (optMatches.length < 2) {
      continue;
    }

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
        letter = String.fromCharCode(65 + i);
      }
      usedLetters.add(letter);

      options.push({
        letter,
        text: optText,
      });
    }

    const correctAnswer = answerMap.get(qNum) || "A";

    if (qText.length >= 5 && options.length >= 2) {
      questions.push({
        externalId: `SM-FND-P3-${nodeCode}-${unitPrefix}-Q${qNum.toString().padStart(3, "0")}`,
        questionType: "MCQ",
        difficulty: "MEDIUM",
        curriculum: {
          subjectCode: "PAPER_3",
          nodeCode,
          _chapterTitle: chapterTitle,
        },
        questionText: qText,
        options,
        correctAnswer,
        explanation: `As per ICAI Study Material (Paper 3: Quantitative Aptitude, ${chapterTitle}), the correct option is (${correctAnswer}).`,
        source: {
          sourceType: "STUDY_MATERIAL",
          sourceTitle: `ICAI Study Material — ${chapterTitle}`,
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
  console.log("=== TESTING PAPER 3 LOGICAL REASONING PARSING ===");
  const baseDir = path.join(__dirname, "../ingestion/foundation/paper_3_quant");

  const lrConfigs = [
    { file: "ch9_layout.txt", nodeCode: "FND_P3_CH9", title: "Chapter 9: Number Series, Coding and Decoding and Odd Man Out", marker: "Exercise-9 A" },
    { file: "ch10_layout.txt", nodeCode: "FND_P3_CH10", title: "Chapter 10: Direction Tests", marker: "\n16. (d)    17. (a)" },
    { file: "ch11_layout.txt", nodeCode: "FND_P3_CH11", title: "Chapter 11: Seating Arrangements", marker: "Answers" },
    { file: "ch12_layout.txt", nodeCode: "FND_P3_CH12", title: "Chapter 12: Blood Relations", marker: "ANSWERS Exercise 12(A)" },
  ];

  for (const c of lrConfigs) {
    const text = fs.readFileSync(path.join(baseDir, c.file), "utf-8");
    const qs = parseQuantUnitText(text, c.nodeCode, c.title, c.file.replace("_layout.txt", "").toUpperCase(), c.marker);
    console.log(`[${c.nodeCode}] Parsed ${qs.length} questions`);

    let valid = 0;
    for (const q of qs) {
      const res = validateImportQuestion(q);
      if (res.isValid) valid++;
      else console.log(`  Invalid question ${q.externalId}:`, res.errors);
    }
    console.log(`  Validation: ${valid} / ${qs.length} valid`);
  }
}

main();
