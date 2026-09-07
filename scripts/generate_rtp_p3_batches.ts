import * as fs from "fs";
import * as path from "path";
import { validateImportBatch } from "../src/domains/questions/import/validation";
import { RawImportBatchJson, CanonicalQuestionJson } from "../src/domains/questions/import/types";

const P3_ANSWERS: Record<string, Record<number, string>> = {
  jan2025: {
    1: "A", 2: "C", 3: "A", 4: "A", 5: "B", 6: "D", 7: "C", 8: "B", 9: "C", 10: "A",
    11: "D", 12: "B", 13: "B", 14: "C", 15: "A", 16: "B", 17: "B", 18: "C", 19: "B", 20: "A",
    21: "B", 22: "C", 23: "A", 24: "C", 25: "B", 26: "B", 27: "C", 28: "A", 29: "C", 30: "C"
  },
  may2025: {
    1: "B", 2: "D", 3: "C", 4: "C", 5: "C", 6: "B", 7: "B", 8: "D", 9: "D", 10: "D",
    11: "C", 12: "A", 13: "A", 14: "D", 15: "A", 16: "B", 17: "B", 18: "D", 19: "A", 20: "A",
    21: "C", 22: "C", 23: "B", 24: "A", 25: "B", 26: "A", 27: "A", 28: "B", 29: "B", 30: "B"
  },
  sep2025: {
    1: "D", 2: "C", 3: "D", 4: "D", 5: "C", 6: "C", 7: "B", 8: "B", 9: "A", 10: "A",
    11: "B", 12: "A", 13: "B", 14: "A", 15: "C", 16: "B", 17: "B", 18: "C", 19: "A", 20: "C",
    21: "D", 22: "A", 23: "C", 24: "D", 25: "C", 26: "D", 27: "B", 28: "B", 29: "B", 30: "C"
  }
};

function cleanPdfPageBreaks(text: string): string {
  return text
    .replace(/\x0c/g, "\n")
    .replace(/\d+\s+(?:JANUARY|MAY|SEPTEMBER)\s+\d{4}\s+EXAMINATION/gi, "")
    .replace(/\?*The Institute of Chartered Accountants of India/gi, "")
    .replace(/REVISION TEST PAPER/gi, "")
    .replace(/FOUNDATION EXAMINATION/gi, "")
    .replace(/QUANTITATIVE APTITUDE/gi, "")
    .replace(/BUSINESS ECONOMICS/gi, "")
    .replace(/BUSINESS LAWS/gi, "")
    .replace(/ACCOUNTING/gi, "")
    .replace(/PAPER\s*[\?–\-]\s*\d+:?/gi, "")
    .replace(/QUESTIONS/gi, "");
}

function mapQuantTopic(text: string, qNum: number): string {
  const lower = text.toLowerCase();
  if (lower.includes("ratio") || lower.includes("proportion") || lower.includes("indices") || lower.includes("logarithm") || lower.includes("log4") || lower.includes("log2") || lower.includes("log10")) {
    return "FND_P3_CH1";
  }
  if (lower.includes("equation") || lower.includes("roots") || lower.includes("quadratic") || lower.includes("linear equation")) {
    return "FND_P3_CH2";
  }
  if (lower.includes("inequalit")) {
    return "FND_P3_CH3";
  }
  if (lower.includes("compound interest") || lower.includes("simple interest") || lower.includes("annuity") || lower.includes("effective rate") || lower.includes("nominal rate") || lower.includes("future value") || lower.includes("present value") || lower.includes("depreciation is") || lower.includes("population")) {
    return "FND_P3_CH4";
  }
  if (lower.includes("permutation") || lower.includes("combination") || lower.includes("arranged") || lower.includes("words that can be formed") || lower.includes("sample of size")) {
    return "FND_P3_CH5";
  }
  if (lower.includes("arithmetic progression") || lower.includes("geometric progression") || lower.includes(" a.p.") || lower.includes(" g.p.") || lower.includes("sum of `terms")) {
    return "FND_P3_CH6";
  }
  if (lower.includes("universal set") || lower.includes("n(a)") || lower.includes("subset") || lower.includes("f(x)") || lower.includes("gof")) {
    return "FND_P3_CH7";
  }
  if (lower.includes("derivative") || lower.includes("marginal cost") || lower.includes("marginal revenue") || lower.includes("differentiat") || lower.includes("integrat") || lower.includes("dx=")) {
    return "FND_P3_CH8";
  }
  if (lower.includes("series") || lower.includes("missing term") || lower.includes("coding") || lower.includes("coded as") || lower.includes("wrong number")) {
    return "FND_P3_CH9";
  }
  if (lower.includes("direction") || lower.includes("walks north") || lower.includes("walks south") || lower.includes("towards west") || lower.includes("turns left") || lower.includes("turns right") || lower.includes("facing")) {
    return "FND_P3_CH10";
  }
  if (lower.includes("seating") || lower.includes("sitting in a row") || lower.includes("circle") || lower.includes("round table")) {
    return "FND_P3_CH11";
  }
  if (lower.includes("brother") || lower.includes("sister") || lower.includes("mother") || lower.includes("father") || lower.includes("son") || lower.includes("daughter") || lower.includes("uncle") || lower.includes("maternal") || lower.includes("pointing") || lower.includes("gentleman")) {
    return "FND_P3_CH12";
  }
  if (lower.includes("ogive") || lower.includes("histogram") || lower.includes("frequency") || lower.includes("discrete") || lower.includes("continuous variable")) {
    return "FND_P3_CH13";
  }
  if (lower.includes("mean deviation") || lower.includes("standard deviation") || lower.includes("quartile deviation") || lower.includes("median") || lower.includes("mode") || lower.includes("dispersion") || lower.includes("variance") || lower.includes("harmonic mean") || lower.includes("coefficient of variation") || lower.includes("central tendency")) {
    return "FND_P3_CH14";
  }
  if (lower.includes("probability") || lower.includes("dice") || lower.includes("pack of 52") || lower.includes("card is drawn") || lower.includes("chance of picking")) {
    return "FND_P3_CH15";
  }
  if (lower.includes("binomial") || lower.includes("poisson") || lower.includes("normal distribution")) {
    return "FND_P3_CH16";
  }
  if (lower.includes("correlation") || lower.includes("regression") || lower.includes("karl pearson") || lower.includes("spearman") || lower.includes("coefficients of correlation") || lower.includes("regression lines")) {
    return "FND_P3_CH17";
  }
  if (lower.includes("index number") || lower.includes("laspyres") || lower.includes("paasche") || lower.includes("fisher") || lower.includes("circular test") || lower.includes("time reversal")) {
    return "FND_P3_CH18";
  }

  if (qNum <= 8) return "FND_P3_CH1";
  if (qNum <= 12) return "FND_P3_CH9";
  return "FND_P3_CH14";
}

function parseP3RtpQuestions(filePath: string, termKey: string): CanonicalQuestionJson[] {
  let rawText = fs.readFileSync(filePath, "utf-8");
  rawText = rawText.replace(/(?:^|\s)([a-d])\)\s+/gm, " ($1) ");

  if (termKey === "sep2025") {
    rawText = rawText.replace(/Find the value of p from[\s\S]*?6\.\s*\n/i, "6. Find the value of p from 4 x (2/3)^(-6) * (3/2)^(-4) = 2^p\n");
  }

  const ansIdx = rawText.indexOf("SUGGESTED ANSWERS");
  const qPart = ansIdx !== -1 ? rawText.slice(0, ansIdx) : rawText;
  const cleaned = cleanPdfPageBreaks(qPart);

  const blocks = cleaned.split(/(?:^|\n)\s*(\d{1,2})\.\s+/);
  const questions: CanonicalQuestionJson[] = [];
  const ansMap = P3_ANSWERS[termKey] || {};

  const termNames: Record<string, { title: string; month: number }> = {
    jan2025: { title: "January 2025", month: 1 },
    may2025: { title: "May 2025", month: 5 },
    sep2025: { title: "September 2025", month: 9 }
  };
  const termInfo = termNames[termKey];

  for (let i = 1; i < blocks.length; i += 2) {
    const qNum = parseInt(blocks[i], 10);
    const body = blocks[i + 1];
    if (qNum < 1 || qNum > 30) continue;

    const idxA = body.search(/(?:^|\s)\(a\)\s+/i);
    const idxB = body.search(/(?:^|\s)\(b\)\s+/i);
    const idxC = body.search(/(?:^|\s)\(c\)\s+/i);
    const idxD = body.search(/(?:^|\s)\(d\)\s+/i);

    if (idxA !== -1 && idxB !== -1 && idxC !== -1 && idxD !== -1 && idxA < idxB && idxB < idxC && idxC < idxD) {
      const stem = body.slice(0, idxA).replace(/\s+/g, " ").trim();
      
      const optA = body.slice(idxA).replace(/(?:^|\s)\(a\)\s*/i, "");
      const textA = optA.slice(0, optA.search(/(?:^|\s)\(b\)\s*/i)).replace(/\s+/g, " ").trim();

      const optB = body.slice(idxB).replace(/(?:^|\s)\(b\)\s*/i, "");
      const textB = optB.slice(0, optB.search(/(?:^|\s)\(c\)\s*/i)).replace(/\s+/g, " ").trim();

      const optC = body.slice(idxC).replace(/(?:^|\s)\(c\)\s*/i, "");
      const textC = optC.slice(0, optC.search(/(?:^|\s)\(d\)\s*/i)).replace(/\s+/g, " ").trim();

      const textD = body.slice(idxD).replace(/(?:^|\s)\(d\)\s*/i, "").replace(/\s+/g, " ").trim();

      const options = [
        { letter: "A", text: textA },
        { letter: "B", text: textB },
        { letter: "C", text: textC },
        { letter: "D", text: textD }
      ];

      if (stem.length >= 10) {
        const correct = ansMap[qNum] || "A";
        const nodeCode = mapQuantTopic(stem, qNum);
        const optMatchCorrect = options.find(o => o.letter === correct);

        questions.push({
          externalId: `RTP_2025_${termKey.toUpperCase()}_P3_Q${qNum}`,
          questionType: "MCQ",
          difficulty: qNum > 20 ? "HARD" : qNum > 10 ? "MEDIUM" : "EASY",
          questionText: stem,
          options,
          correctAnswer: correct,
          explanation: `Official ICAI Answer Key for RTP ${termInfo.title} (Paper 3: Quantitative Aptitude, Q${qNum}): Option (${correct}) ${optMatchCorrect?.text || ""}.`,
          curriculum: {
            subjectCode: "PAPER_3",
            nodeCode
          },
          source: {
            sourceType: "RTP",
            sourceTitle: `ICAI Revision Test Paper (RTP) - ${termInfo.title}`,
            sourceYear: 2025,
            sourceMonth: termInfo.month,
            sourceAttempt: `${termKey.toUpperCase()}_2025`,
            paperNumber: "3",
            questionNumber: String(qNum),
            sourceReference: `RTP ${termInfo.title} Paper 3 Q${qNum}`
          }
        });
      }
    }
  }

  questions.sort((a, b) => {
    const na = parseInt(a.source?.questionNumber || "0", 10);
    const nb = parseInt(b.source?.questionNumber || "0", 10);
    return na - nb;
  });

  return questions;
}

async function main() {
  console.log("=== GENERATING PAPER 3 (QUANTITATIVE APTITUDE) RTP BATCHES ===");

  if (!fs.existsSync("rtp_batches")) {
    fs.mkdirSync("rtp_batches", { recursive: true });
  }

  const terms = [
    { key: "jan2025", file: "rtp_downloads/rtp_jan2025_p3.txt", name: "January 2025", month: 1 },
    { key: "may2025", file: "rtp_downloads/rtp_may2025_p3.txt", name: "May 2025", month: 5 },
    { key: "sep2025", file: "rtp_downloads/rtp_sep2025_p3.txt", name: "September 2025", month: 9 }
  ];

  for (const t of terms) {
    const qs = parseP3RtpQuestions(t.file, t.key);
    console.log(`\nTerm ${t.name}: Extracted ${qs.length} MCQs`);

    const batch: RawImportBatchJson = {
      batchName: `CA Foundation Quantitative Aptitude (Paper 3) - Official RTP ${t.name}`,
      sourceType: "RTP",
      sourceTitle: `ICAI Revision Test Paper (RTP) ${t.name}`,
      sourceYear: 2025,
      sourceMonth: t.month,
      curriculumVersionId: "1677d3d5-fb55-40c3-b853-410432eb913f",
      questions: qs
    };

    const valResult = validateImportBatch(batch);
    if (!valResult.isValid) {
      console.error(`Validation failed for ${t.name}:`, valResult.errors);
      process.exit(1);
    }

    const outPath = `rtp_batches/p3_${t.key}.json`;
    fs.writeFileSync(outPath, JSON.stringify(batch, null, 2), "utf-8");
    console.log(`✓ Saved ${qs.length} validated MCQs to ${outPath}`);
  }
}

main().catch(console.error);
