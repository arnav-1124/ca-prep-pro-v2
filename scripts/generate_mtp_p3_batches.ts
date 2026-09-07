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
  let normalized = text.replace(/(?:\r?\n)\s*(\d{1,3})[.\s]\s+(?=[A-Z0-9`'"]|If|Which|The|A|What|In|For|An|Find|Calculate|When|Given|Consider|Suppose|Log|Evaluate|Let|Determine)/gi, "\n<<<Q_START_$1>>> ");
  normalized = normalized.replace(/\(([a-d])\)([^\n]*?)\s+(\d{1,3})[.\s]\s+(?=[A-Z0-9`'"]|If|Which|The|A|What|In|For|An|Find|Calculate|When|Given|Consider|Suppose|Log|Evaluate)/gi, "($1)$2\n<<<Q_START_$3>>> ");

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
    stem = stem.replace(/MODEL TEST PAPER\s*\d+[\s\S]*?(?:QUANTITATIVE APTITUDE|QUNTITATIVE APTITUDE)/gi, "").trim();
    stem = stem.replace(/FOUNDATION COURSE/gi, "").trim();
    stem = stem.replace(/PAPER\s*[-–\s]?\s*3:?[^.\n]*/gi, "").trim();
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

function mapQuantChapter(text: string, qNum: number): string {
  const lower = text.toLowerCase();

  if (lower.includes("brother") || lower.includes("sister") || lower.includes("mother") || lower.includes("father") || lower.includes("son") || lower.includes("daughter") || lower.includes("uncle") || lower.includes("niece") || lower.includes("nephew") || lower.includes("maternal") || lower.includes("paternal") || lower.includes("blood relation") || lower.includes("wife") || lower.includes("husband") || lower.includes("pointing to")) {
    return "FND_P3_CH12";
  }
  if (lower.includes("seated") || lower.includes("sitting") || lower.includes("circle") || lower.includes("facing north") || lower.includes("facing center") || lower.includes("row of") || lower.includes("left of") || lower.includes("right of") || lower.includes("immediate left")) {
    return "FND_P3_CH11";
  }
  if (lower.includes("walks") || lower.includes("direction") || lower.includes("towards north") || lower.includes("towards south") || lower.includes("towards east") || lower.includes("towards west") || lower.includes("turned left") || lower.includes("turned right") || lower.includes("how far is he") || lower.includes("distance from starting point")) {
    return "FND_P3_CH10";
  }
  if (lower.includes("coded") || lower.includes("coding") || lower.includes("missing term") || lower.includes("odd man") || lower.includes("wrong term") || (qNum >= 41 && qNum <= 60 && (lower.includes("series") || lower.includes("pattern")))) {
    return "FND_P3_CH9";
  }
  if (lower.includes("index number") || lower.includes("laspeyres") || lower.includes("paasche") || lower.includes("fisher") || lower.includes("cost of living") || lower.includes("consumer price") || lower.includes("time reversal") || lower.includes("factor reversal")) {
    return "FND_P3_CH18";
  }
  if (lower.includes("correlation") || lower.includes("regression") || lower.includes("rank correlation") || lower.includes("scatter diagram") || lower.includes("covariance") || lower.includes("coefficient of correlation") || lower.includes("byx") || lower.includes("bxy")) {
    return "FND_P3_CH17";
  }
  if (lower.includes("binomial") || lower.includes("poisson") || lower.includes("normal distribution") || lower.includes("standard normal") || lower.includes("bell shaped") || lower.includes("parameter of poisson") || lower.includes("variance of binomial")) {
    return "FND_P3_CH16";
  }
  if (lower.includes("probability") || lower.includes("dice") || lower.includes("die is thrown") || lower.includes("coin is tossed") || lower.includes("pack of cards") || lower.includes("mutually exclusive") || lower.includes("independent events") || lower.includes("conditional probability")) {
    return "FND_P3_CH15";
  }
  if (lower.includes("standard deviation") || lower.includes("mean deviation") || lower.includes("variance") || lower.includes("quartile deviation") || lower.includes("coefficient of variation") || lower.includes("harmonic mean") || lower.includes("geometric mean") || lower.includes("arithmetic mean") || lower.includes("median") || lower.includes("mode") || lower.includes("dispersion") || lower.includes("central tendency")) {
    return "FND_P3_CH14";
  }
  if (lower.includes("histogram") || lower.includes("ogive") || lower.includes("frequency polygon") || lower.includes("pie chart") || lower.includes("bar chart") || lower.includes("tally mark") || lower.includes("class interval") || lower.includes("primary data") || lower.includes("secondary data") || (qNum >= 61 && qNum <= 100 && lower.includes("frequency"))) {
    return "FND_P3_CH13";
  }
  if (lower.includes("derivative") || lower.includes("differential") || lower.includes("integral") || lower.includes("integrate") || lower.includes("dx") || lower.includes("dy/dx") || lower.includes("f'(x)") || lower.includes("marginal cost") || lower.includes("marginal revenue")) {
    return "FND_P3_CH8";
  }
  if (lower.includes("subset") || lower.includes("universal set") || lower.includes("venn diagram") || lower.includes("relation") || lower.includes("function") || lower.includes("domain") || lower.includes("range") || lower.includes("f(x)") || lower.includes("g(x)")) {
    return "FND_P3_CH7";
  }
  if (lower.includes("arithmetic progression") || lower.includes("geometric progression") || lower.includes("common difference") || lower.includes("common ratio") || lower.includes(" a.p.") || lower.includes(" g.p.") || lower.includes("ap and gp") || lower.includes("sum of n terms")) {
    return "FND_P3_CH6";
  }
  if (lower.includes("permutation") || lower.includes("combination") || lower.includes("npr") || lower.includes("ncr") || lower.includes("factorial") || lower.includes("arranged in") || lower.includes("can be chosen") || lower.includes("ways to select")) {
    return "FND_P3_CH5";
  }
  if (lower.includes("compound interest") || lower.includes("simple interest") || lower.includes("annuity") || lower.includes("present value") || lower.includes("effective rate") || lower.includes("sinking fund") || lower.includes("perpetuity") || lower.includes("sum of money becomes") || lower.includes("amount of rs") || lower.includes("rate of interest")) {
    return "FND_P3_CH4";
  }
  if (lower.includes("inequality") || lower.includes("inequalities") || lower.includes("feasible region") || lower.includes("shaded region") || lower.includes("objective function")) {
    return "FND_P3_CH3";
  }
  if (lower.includes("quadratic") || lower.includes("roots of the equation") || lower.includes("equation") || lower.includes("simultaneous equation") || lower.includes("root is reciprocal")) {
    return "FND_P3_CH2";
  }
  if (lower.includes("ratio") || lower.includes("proportion") || lower.includes("log") || lower.includes("indices") || lower.includes("triplicate") || lower.includes("sub-duplicate") || lower.includes("mean proportional")) {
    return "FND_P3_CH1";
  }

  if (qNum <= 40) return "FND_P3_CH1";
  if (qNum <= 60) return "FND_P3_CH9";
  return "FND_P3_CH14";
}

function main() {
  const txt = fs.readFileSync("test_84774.txt", "utf-8");

  const p3Starts = [323052, 348089, 372164, 396284, 416736, 440079, 464534, 490111, 513441, 542571];
  const p3Ends = [348089, 372164, 396284, 416736, 440079, 464534, 490111, 513441, 542571, 563685];

  const p3AnsStarts = [1639129, 1640336, 1641767, 1643286, 1644758, 1646320, 1647920, 1649449, 1650586, 1652183];
  const p3AnsEnds = [1640336, 1641767, 1643286, 1644758, 1646320, 1647920, 1649449, 1650586, 1652183, 1653646];

  const part1Items: any[] = [];
  const part2Items: any[] = [];

  for (let i = 0; i < 10; i++) {
    const qSlice = txt.slice(p3Starts[i], p3Ends[i]);
    const aSlice = txt.slice(p3AnsStarts[i], p3AnsEnds[i]);

    const parsedQs = extractMtpQuestions(qSlice);
    const ansMap = parseMtpAnswers(aSlice);

    console.log(`P3 MTP ${i + 1}: ${parsedQs.length} questions parsed, ${ansMap.size} answers found`);

    for (const q of parsedQs) {
      const ans = ansMap.get(q.questionNumber);
      if (!ans) continue;

      const hasOpt = q.options.some(o => o.letter === ans);
      if (!hasOpt) continue;

      const chapterCode = mapQuantChapter(q.questionText, q.questionNumber);

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
      name: "CA Foundation Quantitative Aptitude (Paper 3) - Official MTP 2025 (Part 1: Papers 1-5)",
      academicLevel: "FOUNDATION",
      subjectCode: "PAPER_3",
      sourceType: "MTP",
      sourceTitle: "ICAI BoS Foundation Model Test Papers (Feb 2025)",
      sourceYear: 2025,
      sourceMonth: 2
    },
    questions: part1Items
  };
  const out1 = path.resolve("ingestion/batches/mtp/foundation_mtp_2025_p3_part1.json");
  fs.writeFileSync(out1, JSON.stringify(b1, null, 2));
  console.log(`Wrote Part 1 to ${out1}`);

  // Write Part 2
  const b2 = {
    batchMetadata: {
      name: "CA Foundation Quantitative Aptitude (Paper 3) - Official MTP 2025 (Part 2: Papers 6-10)",
      academicLevel: "FOUNDATION",
      subjectCode: "PAPER_3",
      sourceType: "MTP",
      sourceTitle: "ICAI BoS Foundation Model Test Papers (Feb 2025)",
      sourceYear: 2025,
      sourceMonth: 2
    },
    questions: part2Items
  };
  const out2 = path.resolve("ingestion/batches/mtp/foundation_mtp_2025_p3_part2.json");
  fs.writeFileSync(out2, JSON.stringify(b2, null, 2));
  console.log(`Wrote Part 2 to ${out2}`);

  const old = path.resolve("ingestion/batches/mtp/foundation_mtp_2025_p3_quant.json");
  if (fs.existsSync(old)) fs.unlinkSync(old);
}

main();
