import fs from "fs";
import path from "path";

interface ParsedOption {
  letter: string;
  text: string;
}

interface ParsedQuestion {
  questionNumber: number;
  questionText: string;
  options: ParsedOption[];
  correctAnswer?: string;
}

function parseMtpAnswers(text: string): Map<number, string> {
  const ansMap = new Map<number, string>();
  const r1 = /(\d{1,3})\.?\s*\(([a-d])\)/gi;
  let m: RegExpExecArray | null;
  while ((m = r1.exec(text)) !== null) {
    const q = parseInt(m[1], 10);
    if (q >= 1 && q <= 100) ansMap.set(q, m[2].toUpperCase());
  }
  const r2 = /\(([a-d])\)\s*(\d{1,3})/gi;
  while ((m = r2.exec(text)) !== null) {
    const q = parseInt(m[2], 10);
    if (q >= 1 && q <= 100) ansMap.set(q, m[1].toUpperCase());
  }
  return ansMap;
}

function extractMtpQuestions(text: string): ParsedQuestion[] {
  let normalized = text.replace(/(?:\r?\n)\s*(\d{1,3})[.\s]\s+(?=[A-Z0-9`'"]|If|Which|The|A|What|In|For|An|Find|Calculate|When|Given|Consider|Suppose|Let|Determine)/gi, "\n<<<Q_START_$1>>> ");
  normalized = normalized.replace(/\(([a-d])\)([^\n]*?)\s+(\d{1,3})[.\s]\s+(?=[A-Z0-9`'"]|If|Which|The|A|What|In|For|An|Find|Calculate|When|Given|Consider|Suppose)/gi, "($1)$2\n<<<Q_START_$3>>> ");

  const rawBlocks = normalized.split(/\n?<<<Q_START_(\d{1,3})>>>\s*/);
  const questions: ParsedQuestion[] = [];
  const seen = new Set<number>();

  for (let i = 1; i < rawBlocks.length; i += 2) {
    const qNum = parseInt(rawBlocks[i], 10);
    const content = rawBlocks[i + 1] || "";

    if (qNum < 1 || qNum > 100) continue;
    if (seen.has(qNum)) continue;

    const firstOptIdx = content.search(/\([a-d]\)/i);
    if (firstOptIdx === -1) continue;

    let stem = content.slice(0, firstOptIdx).replace(/\s+/g, " ").trim();
    stem = stem.replace(/MODEL TEST PAPER\s*\d+[\s\S]*?BUSINESS ECONOMICS/gi, "").trim();
    stem = stem.replace(/FOUNDATION COURSE/gi, "").trim();
    stem = stem.replace(/PAPER\s*[-–\s]?\s*\d+:?[^.\n]*/gi, "").trim();
    stem = stem.replace(/^Time:\s*2\s*Hours\s*Marks:\s*100\s*/gi, "").trim();

    const optsText = content.slice(firstOptIdx);
    const optRegex = /\(([a-d])\)\s*([\s\S]*?)(?=\([a-d]\)|$)/gi;
    const options: ParsedOption[] = [];
    const seenLetters = new Set<string>();
    let om: RegExpExecArray | null;

    while ((om = optRegex.exec(optsText)) !== null) {
      const letter = om[1].toUpperCase();
      if (seenLetters.has(letter)) {
        // Repeated option letter means we reached another question block; stop here
        break;
      }

      let optVal = om[2].replace(/\s+/g, " ").trim();
      optVal = optVal.replace(/\s*\d{1,3}\s*MODEL TEST PAPER[\s\S]*$/gi, "").trim();
      optVal = optVal.replace(/\s*FOUNDATION COURSE[\s\S]*$/gi, "").trim();
      optVal = optVal.replace(/\s*PAPER\s*[-–\s]?\s*\d+:?[\s\S]*$/gi, "").trim();
      optVal = optVal.replace(/\s+\d{3}$/, "").trim();

      if (optVal.length > 0) {
        seenLetters.add(letter);
        options.push({ letter, text: optVal });
      }
    }

    if (options.length >= 2 && options.length <= 6 && stem.length >= 10) {
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

function mapEconomicsChapter(text: string): string {
  const lower = text.toLowerCase();
  
  if (lower.includes("indian economy") || lower.includes("niti aayog") || lower.includes("green revolution") || lower.includes("1991") || lower.includes("disinvestment") || lower.includes("agriculture sector") || lower.includes("industrial policy") || lower.includes("service sector") || lower.includes("demographic dividend")) {
    return "FND_P4_CH10";
  }
  if (lower.includes("international trade") || lower.includes("tariff") || lower.includes("quota") || lower.includes("exchange rate") || lower.includes("fdi") || lower.includes("wto") || lower.includes("balance of payment") || lower.includes("comparative advantage") || lower.includes("foreign trade")) {
    return "FND_P4_CH9";
  }
  if (lower.includes("money supply") || lower.includes("monetary policy") || lower.includes("rbi") || lower.includes("central bank") || lower.includes("repo rate") || lower.includes("cash reserve") || lower.includes("liquidity preference") || lower.includes("commercial bank") || lower.includes("credit creation") || lower.includes("broad money") || lower.includes("high powered money")) {
    return "FND_P4_CH8";
  }
  if (lower.includes("fiscal") || lower.includes("budget") || lower.includes("tax") || lower.includes("public debt") || lower.includes("market failure") || lower.includes("externality") || lower.includes("public good") || lower.includes("musgrave") || lower.includes("stabilization function") || lower.includes("allocation function")) {
    return "FND_P4_CH7";
  }
  if (lower.includes("national income") || lower.includes("gdp") || lower.includes("gnp") || lower.includes("ndp") || lower.includes("nnp") || lower.includes("keynes") || lower.includes("multiplier") || lower.includes("consumption function") || lower.includes("marginal propensity") || lower.includes("aggregate demand") || lower.includes("circular flow")) {
    return "FND_P4_CH6";
  }
  if (lower.includes("business cycle") || lower.includes("recession") || lower.includes("trough") || lower.includes("boom") || lower.includes("depression") || lower.includes("expansion") || lower.includes("contraction") || lower.includes("leading indicator") || lower.includes("lagging indicator") || lower.includes("peak")) {
    return "FND_P4_CH5";
  }
  if (lower.includes("monopoly") || lower.includes("monopolistic") || lower.includes("perfect competition") || lower.includes("oligopoly") || lower.includes("cartel") || lower.includes("price discrimination") || lower.includes("kinked demand") || lower.includes("price determination") || lower.includes("duopoly")) {
    return "FND_P4_CH4";
  }
  if (lower.includes("production") || lower.includes("cost") || lower.includes("returns to scale") || lower.includes("marginal product") || lower.includes("isoquant") || lower.includes("fixed cost") || lower.includes("variable cost") || lower.includes("average cost") || lower.includes("marginal cost") || lower.includes("economies of scale") || lower.includes("cobb-douglas")) {
    return "FND_P4_CH3";
  }
  if (lower.includes("demand") || lower.includes("supply") || lower.includes("elasticity") || lower.includes("indifference") || lower.includes("utility") || lower.includes("consumer surplus") || lower.includes("law of demand") || lower.includes("substitute") || lower.includes("complementary") || lower.includes("cross elasticity") || lower.includes("budget line")) {
    return "FND_P4_CH2";
  }
  
  return "FND_P4_CH1";
}

function main() {
  const txt = fs.readFileSync("test_84774.txt", "utf-8");

  const p4Starts = [563685, 591539, 615451, 642093, 665640, 691770, 715589, 741681, 773925, 805650];
  const p4Ends = [591539, 615451, 642093, 665640, 691770, 715589, 741681, 773925, 805650, 838000];

  const p4AnsStarts = [1653646, 1654679, 1655928, 1656974, 1657943, 1658901, 1659916, 1661210, 1662406, 1663676];
  const p4AnsEnds = [1654679, 1655928, 1656974, 1657943, 1658901, 1659916, 1661210, 1662406, 1663676, 1665000];

  const part1Items: any[] = [];
  const part2Items: any[] = [];

  for (let i = 0; i < 10; i++) {
    const qSlice = txt.slice(p4Starts[i], p4Ends[i]);
    const aSlice = txt.slice(p4AnsStarts[i], p4AnsEnds[i]);

    const parsedQs = extractMtpQuestions(qSlice);
    const ansMap = parseMtpAnswers(aSlice);

    console.log(`P4 MTP ${i + 1}: ${parsedQs.length} questions parsed, ${ansMap.size} answers found`);

    for (const q of parsedQs) {
      const ans = ansMap.get(q.questionNumber);
      if (!ans) continue;

      const hasOpt = q.options.some(o => o.letter === ans);
      if (!hasOpt) continue;

      const chapterCode = mapEconomicsChapter(q.questionText);

      const item = {
        questionText: q.questionText,
        type: "SINGLE_CHOICE",
        curriculumNodeCode: chapterCode,
        difficulty: "MEDIUM",
        options: q.options.map(o => ({
          letter: o.letter,
          text: o.text
        })),
        correctAnswer: ans,
        explanation: `Correct Answer: Option (${ans}). Official ICAI Foundation Model Test Paper ${i + 1} (February 2025 Edition).`,
        sourceMetadata: {
          mtpNumber: i + 1,
          questionNumber: q.questionNumber,
          sourceSeries: `Model Test Paper ${i + 1}`,
          examCycle: "May 2025 and onwards",
          edition: "February 2025"
        }
      };

      if (i < 5) {
        part1Items.push(item);
      } else {
        part2Items.push(item);
      }
    }
  }

  console.log(`\nPart 1 (MTP 1-5): ${part1Items.length} questions`);
  console.log(`Part 2 (MTP 6-10): ${part2Items.length} questions`);

  // Write Part 1
  const b1 = {
    batchMetadata: {
      name: "CA Foundation Business Economics (Paper 4) - Official MTP 2025 (Part 1: Papers 1-5)",
      academicLevel: "FOUNDATION",
      subjectCode: "PAPER_4",
      sourceType: "MTP",
      sourceTitle: "ICAI BoS Foundation Model Test Papers (Feb 2025)",
      sourceYear: 2025,
      sourceMonth: 2
    },
    questions: part1Items
  };
  const out1 = path.resolve("ingestion/batches/mtp/foundation_mtp_2025_p4_part1.json");
  fs.writeFileSync(out1, JSON.stringify(b1, null, 2));
  console.log(`Wrote Part 1 to ${out1}`);

  // Write Part 2
  const b2 = {
    batchMetadata: {
      name: "CA Foundation Business Economics (Paper 4) - Official MTP 2025 (Part 2: Papers 6-10)",
      academicLevel: "FOUNDATION",
      subjectCode: "PAPER_4",
      sourceType: "MTP",
      sourceTitle: "ICAI BoS Foundation Model Test Papers (Feb 2025)",
      sourceYear: 2025,
      sourceMonth: 2
    },
    questions: part2Items
  };
  const out2 = path.resolve("ingestion/batches/mtp/foundation_mtp_2025_p4_part2.json");
  fs.writeFileSync(out2, JSON.stringify(b2, null, 2));
  console.log(`Wrote Part 2 to ${out2}`);

  // Clean old single file if exists
  const old = path.resolve("ingestion/batches/mtp/foundation_mtp_2025_p4_economics.json");
  if (fs.existsSync(old)) fs.unlinkSync(old);
}

main();
