import fs from "fs";

interface ParsedQuestion {
  questionNumber: number;
  questionText: string;
  options: { letter: string; text: string }[];
  correctAnswer?: string;
}

function parseMtpSequential(text: string): ParsedQuestion[] {
  const questions: ParsedQuestion[] = [];
  
  // Find where Question 1 starts
  let q1Match = text.match(/(?:^|\n)\s*1[.\s]\s+([A-Z`'"]|If|Which|The|A|What|In|For|An|Find|Calculate|When|Given|Consider|Suppose)/i);
  if (!q1Match || q1Match.index === undefined) {
    return questions;
  }

  // Pre-find candidate start positions for each number 1 to 100
  // For each n from 1 to 100, find possible positions
  const numPositions = new Map<number, number[]>();
  for (let n = 1; n <= 100; n++) {
    const reg = new RegExp(`(?:^|\\n|\\([a-d]\\)[^\\n]*)\\s*${n}[.\\s]\\s+([A-Z\`\'"\\(]|If|Which|The|A|What|In|For|An|Find|Calculate|When|Given|Consider|Suppose|Log|Evaluate|Let|Determine)`, "gi");
    let m: RegExpExecArray | null;
    const positions: number[] = [];
    while ((m = reg.exec(text)) !== null) {
      // Find exact position of digit n
      const digitIdx = m.index + m[0].indexOf(`${n}`);
      positions.push(digitIdx);
    }
    numPositions.set(n, positions);
  }

  // Chain sequentially: start at Q1, then find the smallest position of Q(n) that is > lastPos
  const chosenPositions: { num: number; pos: number }[] = [];
  let lastPos = 0;

  for (let n = 1; n <= 100; n++) {
    const candidates = numPositions.get(n) || [];
    // Pick the first candidate that is > lastPos
    const valid = candidates.filter(p => p > lastPos);
    if (valid.length > 0) {
      const p = valid[0];
      chosenPositions.push({ num: n, pos: p });
      lastPos = p;
    } else {
      // Fallback: search more broadly for `\n n.` or `\n n ` after lastPos
      const broadReg = new RegExp(`(?:^|\\n)\\s*${n}[.\\s]\\s+`, "g");
      broadReg.lastIndex = lastPos;
      const bm = broadReg.exec(text);
      if (bm && bm.index > lastPos) {
        chosenPositions.push({ num: n, pos: bm.index });
        lastPos = bm.index;
      }
    }
  }

  // Now extract text between chosenPositions[i].pos and chosenPositions[i+1].pos
  for (let i = 0; i < chosenPositions.length; i++) {
    const curr = chosenPositions[i];
    const nextPos = (i + 1 < chosenPositions.length) ? chosenPositions[i + 1].pos : text.length;
    let block = text.slice(curr.pos, nextPos).trim();

    // Strip leading number and punctuation
    block = block.replace(/^\d{1,3}[.\s]\s*/, "");

    // Extract options
    const firstOptIdx = block.search(/\([a-d]\)/i);
    if (firstOptIdx === -1) continue;

    let stem = block.slice(0, firstOptIdx).replace(/\s+/g, " ").trim();
    // Clean header artifacts from stem
    stem = stem.replace(/MODEL TEST PAPER\s*\d+[\s\S]*?(?:QUANTITATIVE APTITUDE|BUSINESS ECONOMICS)/gi, "").trim();
    stem = stem.replace(/FOUNDATION COURSE/gi, "").trim();
    stem = stem.replace(/PAPER\s*[-–\s]?\s*\d+:?[^.\n]*/gi, "").trim();

    const optsText = block.slice(firstOptIdx);
    const optRegex = /\(([a-d])\)\s*([\s\S]*?)(?=\([a-d]\)|$)/gi;
    const options: { letter: string; text: string }[] = [];
    let om: RegExpExecArray | null;

    while ((om = optRegex.exec(optsText)) !== null) {
      const letter = om[1].toUpperCase();
      let optVal = om[2].replace(/\s+/g, " ").trim();
      // Remove page number / header artifacts at end of option
      optVal = optVal.replace(/\s*\d{1,3}\s*MODEL TEST PAPER[\s\S]*$/gi, "").trim();
      optVal = optVal.replace(/\s*FOUNDATION COURSE[\s\S]*$/gi, "").trim();
      optVal = optVal.replace(/\s*PAPER\s*[-–\s]?\s*\d+:?[\s\S]*$/gi, "").trim();
      // Remove trailing answer key markers or page numbers like `776`
      optVal = optVal.replace(/\s+\d{3}$/, "").trim();
      options.push({ letter, text: optVal });
    }

    if (options.length >= 2 && stem.length >= 10) {
      questions.push({
        questionNumber: curr.num,
        questionText: stem,
        options
      });
    }
  }

  return questions;
}

function main() {
  const txt = fs.readFileSync("test_84774.txt", "utf-8");

  const p3Starts = [323052, 348089, 372164, 396284, 416736, 440079, 464534, 490111, 513441, 542571];
  const p3Ends = [348089, 372164, 396284, 416736, 440079, 464534, 490111, 513441, 542571, 563685];

  console.log("=== SEQUENTIAL PARSE: PAPER 3 ===");
  let totalP3 = 0;
  for (let i = 0; i < 10; i++) {
    const qText = txt.slice(p3Starts[i], p3Ends[i]);
    const qs = parseMtpSequential(qText);
    console.log(`P3 MTP ${i + 1}: ${qs.length} / 100 parsed`);
    totalP3 += qs.length;
  }
  console.log(`Total P3: ${totalP3} / 1000`);

  const p4Starts = [563685, 591539, 615451, 642093, 665640, 691770, 715589, 741681, 773925, 805650];
  const p4Ends = [591539, 615451, 642093, 665640, 691770, 715589, 741681, 773925, 805650, 838000];

  console.log("\n=== SEQUENTIAL PARSE: PAPER 4 ===");
  let totalP4 = 0;
  for (let i = 0; i < 10; i++) {
    const qText = txt.slice(p4Starts[i], p4Ends[i]);
    const qs = parseMtpSequential(qText);
    console.log(`P4 MTP ${i + 1}: ${qs.length} / 100 parsed`);
    totalP4 += qs.length;
  }
  console.log(`Total P4: ${totalP4} / 1000`);
}

main();
