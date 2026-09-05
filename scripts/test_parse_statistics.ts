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

export function parseStatsUnit(
  text: string,
  nodeCode: string,
  chapterTitle: string,
  unitPrefix: string
): CanonicalQuestionJson[] {
  // Locate ANSWERS
  const answersIdx = text.lastIndexOf("ANSWERS");
  if (answersIdx === -1) {
    console.error(`  No ANSWERS found in ${unitPrefix}`);
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
      `(?:^|\\n)\\s*${qNum}\\s*[\\.\\)]\\s*(?!\\d)([\\s\\S]*?)(?=(?:(?:^|\\n)\\s*${nextNum}\\s*[\\.\\)]\\s*(?!\\d))|ANSWERS|$)`,
      "i"
    );
    const qBlockMatch = textBeforeAnswers.match(pattern);
    if (!qBlockMatch) {
      continue;
    }

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

    // If answer is (d) but only (a), (b), (c) were printed, supply (d) None of these
    if (correctAnswer === "D" && options.length === 3 && !options.some(o => o.letter === "D")) {
      options.push({ letter: "D", text: "None of these" });
    }

    if (qText.length >= 10 && options.length >= 2) {
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
  console.log("=== TESTING PAPER 3 STATISTICS PARSING ===");
  const baseDir = path.join(__dirname, "../ingestion/foundation/paper_3_quant");

  const statsUnits = [
    { file: "ch13u2_layout.txt", nodeCode: "FND_P3_CH13", title: "Chapter 13: Statistical Representation of Data (Sampling)" },
    { file: "ch14u2_layout.txt", nodeCode: "FND_P3_CH14", title: "Chapter 14: Measures of Central Tendency and Dispersion" },
    { file: "ch15_layout.txt", nodeCode: "FND_P3_CH15", title: "Chapter 15: Probability" },
    { file: "ch16_layout.txt", nodeCode: "FND_P3_CH16", title: "Chapter 16: Theoretical Distributions" },
    { file: "ch17_layout.txt", nodeCode: "FND_P3_CH17", title: "Chapter 17: Correlation and Regression" },
  ];

  for (const s of statsUnits) {
    const text = fs.readFileSync(path.join(baseDir, s.file), "utf-8");
    const qs = parseStatsUnit(text, s.nodeCode, s.title, s.file.replace("_layout.txt", "").toUpperCase());
    console.log(`[${s.nodeCode}] Parsed ${qs.length} questions`);

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
