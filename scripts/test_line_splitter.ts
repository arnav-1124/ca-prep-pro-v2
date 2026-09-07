import fs from "fs";

interface ParsedQuestion {
  questionNumber: number;
  questionText: string;
  options: { letter: string; text: string }[];
}

function parseMtpLines(text: string): ParsedQuestion[] {
  // First, insert a unique delimiter before question starts
  // Question start pattern: newline, optional spaces, 1-3 digits, dot or space, followed by question word
  let normalized = text.replace(/(?:\r?\n)\s*(\d{1,3})[.\s]\s+(?=[A-Z0-9`'"]|If|Which|The|A|What|In|For|An|Find|Calculate|When|Given|Consider|Suppose|Log|Evaluate|Let|Determine)/gi, "\n<<<Q_START_$1>>> ");
  // Also handle cases where a question start was packed right after an option, e.g. "(d) ... 24 Which..."
  normalized = normalized.replace(/\(([a-d])\)([^\n]*?)\s+(\d{1,3})[.\s]\s+(?=[A-Z0-9`'"]|If|Which|The|A|What|In|For|An|Find|Calculate|When|Given|Consider|Suppose)/gi, "($1)$2\n<<<Q_START_$3>>> ");

  const rawBlocks = normalized.split(/\n?<<<Q_START_(\d{1,3})>>>\s*/);
  const questions: ParsedQuestion[] = [];
  const seen = new Set<number>();

  for (let i = 1; i < rawBlocks.length; i += 2) {
    const qNum = parseInt(rawBlocks[i], 10);
    const content = rawBlocks[i + 1] || "";

    if (qNum < 1 || qNum > 100) continue;
    if (seen.has(qNum)) continue;

    // Find options
    const firstOptIdx = content.search(/\([a-d]\)/i);
    if (firstOptIdx === -1) continue;

    let stem = content.slice(0, firstOptIdx).replace(/\s+/g, " ").trim();
    stem = stem.replace(/MODEL TEST PAPER\s*\d+[\s\S]*?(?:QUANTITATIVE APTITUDE|BUSINESS ECONOMICS)/gi, "").trim();
    stem = stem.replace(/FOUNDATION COURSE/gi, "").trim();
    stem = stem.replace(/PAPER\s*[-–\s]?\s*\d+:?[^.\n]*/gi, "").trim();

    const optsText = content.slice(firstOptIdx);
    const optRegex = /\(([a-d])\)\s*([\s\S]*?)(?=\([a-d]\)|$)/gi;
    const options: { letter: string; text: string }[] = [];
    let om: RegExpExecArray | null;

    while ((om = optRegex.exec(optsText)) !== null) {
      const letter = om[1].toUpperCase();
      let optVal = om[2].replace(/\s+/g, " ").trim();
      optVal = optVal.replace(/\s*\d{1,3}\s*MODEL TEST PAPER[\s\S]*$/gi, "").trim();
      optVal = optVal.replace(/\s*FOUNDATION COURSE[\s\S]*$/gi, "").trim();
      optVal = optVal.replace(/\s*PAPER\s*[-–\s]?\s*\d+:?[\s\S]*$/gi, "").trim();
      optVal = optVal.replace(/\s+\d{3}$/, "").trim();
      options.push({ letter, text: optVal });
    }

    if (options.length >= 2 && stem.length >= 8) {
      seen.add(qNum);
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

function main() {
  const txt = fs.readFileSync("test_84774.txt", "utf-8");

  const p3Starts = [323052, 348089, 372164, 396284, 416736, 440079, 464534, 490111, 513441, 542571];
  const p3Ends = [348089, 372164, 396284, 416736, 440079, 464534, 490111, 513441, 542571, 563685];

  console.log("=== DELIMITER PARSE: PAPER 3 ===");
  let totalP3 = 0;
  for (let i = 0; i < 10; i++) {
    const qText = txt.slice(p3Starts[i], p3Ends[i]);
    const qs = parseMtpLines(qText);
    console.log(`P3 MTP ${i + 1}: ${qs.length} / 100 questions parsed`);
    totalP3 += qs.length;
  }
  console.log(`Total P3: ${totalP3} / 1000`);

  const p4Starts = [563685, 591539, 615451, 642093, 665640, 691770, 715589, 741681, 773925, 805650];
  const p4Ends = [591539, 615451, 642093, 665640, 691770, 715589, 741681, 773925, 805650, 838000];

  console.log("\n=== DELIMITER PARSE: PAPER 4 ===");
  let totalP4 = 0;
  for (let i = 0; i < 10; i++) {
    const qText = txt.slice(p4Starts[i], p4Ends[i]);
    const qs = parseMtpLines(qText);
    console.log(`P4 MTP ${i + 1}: ${qs.length} / 100 questions parsed`);
    totalP4 += qs.length;
  }
  console.log(`Total P4: ${totalP4} / 1000`);
}

main();
