import fs from "fs";
import path from "path";
import { validateImportQuestion } from "../src/domains/questions/import/validation";
import { CanonicalQuestionJson } from "../src/domains/questions/import/types";

export function parseIcaiMcqText(text: string, subjectCode: string, nodeCode: string, chapterTitle: string): CanonicalQuestionJson[] {
  // 1. Locate ANSWERS block
  const answersMatch = text.match(/ANSWERS\s*([\s\S]+?)(?:\f|Chapter|\n\n\n|$)/i);
  if (!answersMatch) {
    console.error("No ANSWERS block found");
    return [];
  }

  const answersText = answersMatch[1];
  const answerMap = new Map<number, string>();
  // Match patterns like: 1. (d), 2 (d), 3. (b), 10. (a)
  const ansRegex = /(\d+)\s*[\.\)]?\s*\(?([a-d])\)?/gi;
  let ansM;
  while ((ansM = ansRegex.exec(answersText)) !== null) {
    answerMap.set(parseInt(ansM[1], 10), ansM[2].toUpperCase());
  }

  console.log(`Found ${answerMap.size} answers in ANSWERS block`);

  // 2. Locate Questions section
  // Questions typically start around "MULTIPLE CHOICE QUESTIONS" or question "1." before the ANSWERS section
  const textBeforeAnswers = text.substring(0, answersMatch.index);
  
  const tykIdx = textBeforeAnswers.lastIndexOf("TEST YOUR KNOWLEDGE");
  const mcqIdx = textBeforeAnswers.lastIndexOf("Multiple Choice Questions");
  const qStartIdx = Math.max(tykIdx, mcqIdx);
  const relevantText = qStartIdx !== -1 ? textBeforeAnswers.substring(qStartIdx) : textBeforeAnswers;

  const questions: CanonicalQuestionJson[] = [];

  for (let qNum = 1; qNum <= answerMap.size; qNum++) {
    const nextNum = qNum + 1;
    // Regex to capture between `qNum.` and `nextNum.` or end of relevant text
    const pattern = new RegExp(
      `(?:^|\\n)\\s*${qNum}\\s*[\\.\\)]\\s*([\\s\\S]*?)(?=(?:(?:^|\\n)\\s*${nextNum}\\s*[\\.\\)])|ANSWERS|$)`,
      "i"
    );
    const qBlockMatch = relevantText.match(pattern);
    if (qNum === 2) {
      console.log("Q2 pattern:", pattern);
      console.log("Q2 qBlockMatch found:", !!qBlockMatch);
      if (qBlockMatch) {
        console.log("Q2 block content:", JSON.stringify(qBlockMatch[1]));
      }
    }
    if (!qBlockMatch) {
      // Try finding anywhere
      continue;
    }

    const block = qBlockMatch[1];

    // Separate question text from options (a), (b), (c), (d)
    // We match options that start on a line (or indented on a line) with (a), (b), (c), (d)
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

    if (qNum === 2) {
      console.log("Q2 optMatches count:", optMatches.length, optMatches);
    }

    if (optMatches.length < 2) {
      continue;
    }

    function cleanLineArtifacts(s: string): string {
      return s
        .replace(/\f[^\r\n]*/g, "") // strip page header lines starting with form feed
        .replace(/[^\r\n]*Institute of Chartered Accountants of India[^\r\n]*/gi, "") // strip copyright footer
        .replace(/[\r\n]+/g, " ") // normalize whitespace
        .replace(/\s{2,}/g, " ")
        .trim();
    }

    const firstOptIndex = optMatches[0].index;
    const qText = cleanLineArtifacts(block.substring(0, firstOptIndex));

    const options: { letter: string; text: string }[] = [];
    for (let i = 0; i < optMatches.length; i++) {
      const current = optMatches[i];
      const nextIndex = i + 1 < optMatches.length ? optMatches[i + 1].index : block.length;
      const optText = cleanLineArtifacts(block.substring(current.index + current.length, nextIndex));

      options.push({
        letter: current.letter,
        text: optText,
      });
    }

    const correctAnswer = answerMap.get(qNum) || "A";

    if (qNum === 2) {
      console.log("Q2 qText:", JSON.stringify(qText), "len:", qText.length);
      console.log("Q2 options:", JSON.stringify(options, null, 2));
      console.log("Q2 condition check:", qText.length >= 10, options.length >= 2);
    }
    // Clean question text if too short or header artifacts
    if (qText.length >= 10 && options.length >= 2) {
      console.log("Pushing Q2!");
      questions.push({
        externalId: `SM-FND-P4-${nodeCode}-Q${qNum.toString().padStart(3, "0")}`,
        questionType: "MCQ",
        difficulty: "MEDIUM",
        curriculum: {
          subjectCode,
          nodeCode,
          _chapterTitle: chapterTitle,
        },
        questionText: qText,
        options,
        correctAnswer,
        explanation: `As per ICAI Study Material (Paper 4: Business Economics, ${chapterTitle}), the correct option is (${correctAnswer}).`,
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
  const textPath = path.join(__dirname, "../ingestion/foundation/paper_4_economics/ch1u2_layout.txt");
  const text = fs.readFileSync(textPath, "utf-8");
  const questions = parseIcaiMcqText(text, "PAPER_4", "FND_P4_CH1", "Chapter 1: Nature & Scope of Business Economics");
  console.log(`Parsed ${questions.length} questions`);

  let valid = 0;
  for (const q of questions) {
    const res = validateImportQuestion(q);
    if (res.isValid) {
      valid++;
    } else {
      console.log(`Invalid question #${q.externalId}:`, res.errors);
    }
  }
  console.log(`Validation result: ${valid} / ${questions.length} valid`);
  const foundNums = new Set(questions.map(q => parseInt((q.externalId || "").split("-Q")[1], 10)));
  for (let i = 1; i <= 48; i++) {
    if (!foundNums.has(i)) {
      console.log(`Missing Question #${i}`);
    }
  }
  if (questions.length > 0) {
    console.log("Sample question 1:", JSON.stringify(questions[0], null, 2));
    console.log("Sample question last:", JSON.stringify(questions[questions.length - 1], null, 2));
  }
}

main();
