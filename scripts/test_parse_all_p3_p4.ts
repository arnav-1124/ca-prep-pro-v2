import fs from "fs";

interface ParsedQuestion {
  questionNumber: number;
  questionText: string;
  options: { letter: string; text: string }[];
  correctAnswer?: string;
}

function parseMtpQuestions(text: string): ParsedQuestion[] {
  // Regex to split on question start: line starting with 1-3 digits followed by '.' or space,
  // then followed by a capital letter or standard question start
  const qMatches = [...text.matchAll(/(?:^|\n)\s*(\d{1,3})[.\s]\s+([\s\S]*?)(?=(?:\n\s*\d{1,3}[.\s]\s+[A-Z0-9`'"])|$)/g)];
  
  const questions: ParsedQuestion[] = [];
  const seenNumbers = new Set<number>();

  for (const m of qMatches) {
    const qNum = parseInt(m[1], 10);
    if (qNum < 1 || qNum > 100) continue;
    if (seenNumbers.has(qNum)) continue;

    const rawBody = m[2].trim();
    
    // Find where options start: (a) or (A)
    const firstOptIdx = rawBody.search(/\([a-d]\)/i);
    if (firstOptIdx === -1) continue;

    const stem = rawBody.slice(0, firstOptIdx).replace(/\s+/g, " ").trim();
    const optsText = rawBody.slice(firstOptIdx);

    const optRegex = /\(([a-d])\)\s*([\s\S]*?)(?=\([a-d]\)|$)/gi;
    const options: { letter: string; text: string }[] = [];
    let optMatch: RegExpExecArray | null;

    while ((optMatch = optRegex.exec(optsText)) !== null) {
      const letter = optMatch[1].toUpperCase();
      let optVal = optMatch[2].replace(/\s+/g, " ").trim();
      // Remove page number or header artifacts if present at end of last option
      optVal = optVal.replace(/\s*\d+\s*MODEL TEST PAPER[\s\S]*$/gi, "").trim();
      optVal = optVal.replace(/\s*FOUNDATION COURSE[\s\S]*$/gi, "").trim();
      options.push({ letter, text: optVal });
    }

    if (options.length >= 2 && stem.length >= 10) {
      seenNumbers.add(qNum);
      questions.push({
        questionNumber: qNum,
        questionText: stem,
        options
      });
    }
  }

  questions.sort((a, b) => a.questionNumber - b.questionNumber);
  return questions;
}

function parseMtpAnswers(text: string): Map<number, string> {
  const ansMap = new Map<number, string>();
  // Match forms like "1. (d)", "1 (d)", "1. (a)", "1 (a)", "1(d)"
  const ansRegex = /(\d{1,3})\.?\s*\(([a-d])\)/gi;
  let m: RegExpExecArray | null;
  while ((m = ansRegex.exec(text)) !== null) {
    const qNum = parseInt(m[1], 10);
    if (qNum >= 1 && qNum <= 100) {
      ansMap.set(qNum, m[2].toUpperCase());
    }
  }
  return ansMap;
}

function main() {
  const txt = fs.readFileSync("test_84774.txt", "utf-8");

  // Paper 3 boundaries
  const p3QuestionStarts = [
    323052, 348089, 372164, 396284, 416736,
    440079, 464534, 490111, 513441, 542571
  ];
  const p3QuestionEnds = [
    348089, 372164, 396284, 416736, 440079,
    464534, 490111, 513441, 542571, 563685
  ];

  const p3AnswerStarts = [
    1639129, 1640336, 1641767, 1643286, 1644758,
    1646320, 1647920, 1649449, 1650586, 1652183
  ];
  const p3AnswerEnds = [
    1640336, 1641767, 1643286, 1644758, 1646320,
    1647920, 1649449, 1650586, 1652183, 1653646
  ];

  console.log("==================== PAPER 3 TEST RUN ====================");
  let totalP3Questions = 0;
  for (let i = 0; i < 10; i++) {
    const qText = txt.slice(p3QuestionStarts[i], p3QuestionEnds[i]);
    const aText = txt.slice(p3AnswerStarts[i], p3AnswerEnds[i]);
    const qs = parseMtpQuestions(qText);
    const ans = parseMtpAnswers(aText);

    let matchedAns = 0;
    for (const q of qs) {
      const correct = ans.get(q.questionNumber);
      if (correct) {
        q.correctAnswer = correct;
        matchedAns++;
      }
    }

    console.log(`P3 MTP ${i + 1}: ${qs.length} questions parsed, ${ans.size} answers found, ${matchedAns} matched.`);
    totalP3Questions += qs.length;
  }
  console.log(`Total P3 Questions Parsed: ${totalP3Questions} / 1000`);

  // Paper 4 boundaries
  const p4QuestionStarts = [
    563685, 591539, 615451, 642093, 665640,
    691770, 715589, 741681, 773925, 805650
  ];
  const p4QuestionEnds = [
    591539, 615451, 642093, 665640, 691770,
    715589, 741681, 773925, 805650, 838000
  ];

  const p4AnswerStarts = [
    1653646, 1654679, 1655928, 1656974, 1657943,
    1658901, 1659916, 1661210, 1662406, 1663676
  ];
  const p4AnswerEnds = [
    1654679, 1655928, 1656974, 1657943, 1658901,
    1659916, 1661210, 1662406, 1663676, 1665000
  ];

  console.log("\n==================== PAPER 4 TEST RUN ====================");
  let totalP4Questions = 0;
  for (let i = 0; i < 10; i++) {
    const qText = txt.slice(p4QuestionStarts[i], p4QuestionEnds[i]);
    const aText = txt.slice(p4AnswerStarts[i], p4AnswerEnds[i]);
    const qs = parseMtpQuestions(qText);
    const ans = parseMtpAnswers(aText);

    let matchedAns = 0;
    for (const q of qs) {
      const correct = ans.get(q.questionNumber);
      if (correct) {
        q.correctAnswer = correct;
        matchedAns++;
      }
    }

    console.log(`P4 MTP ${i + 1}: ${qs.length} questions parsed, ${ans.size} answers found, ${matchedAns} matched.`);
    totalP4Questions += qs.length;
  }
  console.log(`Total P4 Questions Parsed: ${totalP4Questions} / 1000`);
}

main();
