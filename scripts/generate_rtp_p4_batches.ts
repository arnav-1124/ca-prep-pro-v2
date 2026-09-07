import * as fs from "fs";
import * as path from "path";
import { validateImportBatch } from "../src/domains/questions/import/validation";
import { RawImportBatchJson, CanonicalQuestionJson } from "../src/domains/questions/import/types";

const P4_ANSWERS: Record<string, Record<number, string>> = {
  jan2025: {
    1: "B", 2: "A", 3: "A", 4: "A", 5: "D", 6: "A", 7: "C", 8: "B", 9: "A", 10: "A",
    11: "C", 12: "D", 13: "A", 14: "A", 15: "B", 16: "D", 17: "C", 18: "D", 19: "B", 20: "B",
    21: "B", 22: "C", 23: "A", 24: "A", 25: "C"
  },
  may2025: {
    1: "A", 2: "A", 3: "B", 4: "B", 5: "B", 6: "A", 7: "C", 8: "C", 9: "A", 10: "C",
    11: "A", 12: "C", 13: "D", 14: "C", 15: "D", 16: "D", 17: "C", 18: "C", 19: "B", 20: "B",
    21: "C", 22: "B", 23: "C", 24: "A", 25: "C"
  },
  sep2025: {
    1: "B", 2: "D", 3: "D", 4: "B", 5: "A", 6: "A", 7: "B", 8: "A", 9: "A", 10: "D",
    11: "D", 12: "B", 13: "C", 14: "C", 15: "B", 16: "A", 17: "B", 18: "C", 19: "C", 20: "B",
    21: "B", 22: "B", 23: "B", 24: "A", 25: "A"
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

function mapEconomicsTopic(text: string, qNum: number): string {
  const lower = text.toLowerCase();
  if (lower.includes("microeconomic") || lower.includes("nature of economics") || lower.includes("positive economics") || lower.includes("normative economics") || lower.includes("scope of business")) {
    return "FND_P4_CH1";
  }
  if (lower.includes("demand") || lower.includes("elasticity") || lower.includes("utility") || lower.includes("indifference curve") || lower.includes("consumer surplus") || lower.includes("substitution effect") || lower.includes("income effect") || lower.includes("price effect") || lower.includes("complementary")) {
    return "FND_P4_CH2";
  }
  if (lower.includes("isoquant") || lower.includes("production function") || lower.includes("returns to scale") || lower.includes("envelope curve") || lower.includes("average cost") || lower.includes("marginal cost") || lower.includes("fixed cost") || lower.includes("short run") || lower.includes("long run average")) {
    return "FND_P4_CH3";
  }
  if (lower.includes("monopoly") || lower.includes("perfect competition") || lower.includes("monopolistic") || lower.includes("oligopoly") || lower.includes("price discrimination") || lower.includes("kinked demand") || lower.includes("cartel")) {
    return "FND_P4_CH4";
  }
  if (lower.includes("business cycle") || lower.includes("trough") || lower.includes("peak") || lower.includes("boom") || lower.includes("recession") || lower.includes("depression") || lower.includes("contraction")) {
    return "FND_P4_CH5";
  }
  if (lower.includes("national income") || lower.includes("gdp") || lower.includes("gnp") || lower.includes("ndp") || lower.includes("factor income") || lower.includes("transfer payment") || lower.includes("keynes") || lower.includes("unemployment") || lower.includes("consumption function") || lower.includes("multiplier")) {
    return "FND_P4_CH6";
  }
  if (lower.includes("fiscal") || lower.includes("budget") || lower.includes("public finance") || lower.includes("tax") || lower.includes("gst") || lower.includes("article 112") || lower.includes("annual financial statement") || lower.includes("market failure") || lower.includes("public goods") || lower.includes("externalit") || lower.includes("common resource")) {
    return "FND_P4_CH7";
  }
  if (lower.includes("money supply") || lower.includes("rbi") || lower.includes("reserve bank") || lower.includes("cash reserve ratio") || lower.includes("crr") || lower.includes("repo") || lower.includes("m1") || lower.includes("m2") || lower.includes("m3") || lower.includes("currency deposit ratio") || lower.includes("cdr") || lower.includes("commercial bank")) {
    return "FND_P4_CH8";
  }
  if (lower.includes("international trade") || lower.includes("tariff") || lower.includes("quota") || lower.includes("exchange rate") || lower.includes("foreign direct investment") || lower.includes("fdi") || lower.includes("comparative advantage") || lower.includes("depreciation of the currency") || lower.includes("revaluation")) {
    return "FND_P4_CH9";
  }
  if (lower.includes("niti aayog") || lower.includes("indian economy") || lower.includes("five year plan") || lower.includes("agriculture") || lower.includes("industrial policy") || lower.includes("service sector") || lower.includes("reforms")) {
    return "FND_P4_CH10";
  }

  // Fallback distribution
  if (qNum <= 5) return "FND_P4_CH2";
  if (qNum <= 10) return "FND_P4_CH3";
  if (qNum <= 15) return "FND_P4_CH6";
  if (qNum <= 20) return "FND_P4_CH7";
  return "FND_P4_CH8";
}

function parseP4RtpQuestions(filePath: string, termKey: string): CanonicalQuestionJson[] {
  let rawText = fs.readFileSync(filePath, "utf-8");
  rawText = rawText.replace(/(?:^|\s)([a-d])\)\s+/gm, " ($1) ");

  const ansIdx = rawText.indexOf("SUGGESTED ANSWERS");
  const qPart = ansIdx !== -1 ? rawText.slice(0, ansIdx) : rawText;
  const cleaned = cleanPdfPageBreaks(qPart);

  const blocks = cleaned.split(/(?:^|\n)\s*(\d{1,2})\.\s+/);
  const questions: CanonicalQuestionJson[] = [];
  const ansMap = P4_ANSWERS[termKey] || {};

  const termNames: Record<string, { title: string; month: number }> = {
    jan2025: { title: "January 2025", month: 1 },
    may2025: { title: "May 2025", month: 5 },
    sep2025: { title: "September 2025", month: 9 }
  };
  const termInfo = termNames[termKey];

  for (let i = 1; i < blocks.length; i += 2) {
    const qNum = parseInt(blocks[i], 10);
    const body = blocks[i + 1];
    if (qNum < 1 || qNum > 25) continue;

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
        const nodeCode = mapEconomicsTopic(stem, qNum);
        const optMatchCorrect = options.find(o => o.letter === correct);

        questions.push({
          externalId: `RTP_2025_${termKey.toUpperCase()}_P4_Q${qNum}`,
          questionType: "MCQ",
          difficulty: qNum > 18 ? "HARD" : qNum > 8 ? "MEDIUM" : "EASY",
          questionText: stem,
          options,
          correctAnswer: correct,
          explanation: `Official ICAI Answer Key for RTP ${termInfo.title} (Paper 4: Business Economics, Q${qNum}): Option (${correct}) ${optMatchCorrect?.text || ""}.`,
          curriculum: {
            subjectCode: "PAPER_4",
            nodeCode
          },
          source: {
            sourceType: "RTP",
            sourceTitle: `ICAI Revision Test Paper (RTP) - ${termInfo.title}`,
            sourceYear: 2025,
            sourceMonth: termInfo.month,
            sourceAttempt: `${termKey.toUpperCase()}_2025`,
            paperNumber: "4",
            questionNumber: String(qNum),
            sourceReference: `RTP ${termInfo.title} Paper 4 Q${qNum}`
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
  console.log("=== GENERATING PAPER 4 (BUSINESS ECONOMICS) RTP BATCHES ===");

  if (!fs.existsSync("rtp_batches")) {
    fs.mkdirSync("rtp_batches", { recursive: true });
  }

  const terms = [
    { key: "jan2025", file: "rtp_downloads/rtp_jan2025_p4.txt", name: "January 2025", month: 1 },
    { key: "may2025", file: "rtp_downloads/rtp_may2025_p4.txt", name: "May 2025", month: 5 },
    { key: "sep2025", file: "rtp_downloads/rtp_sep2025_p4.txt", name: "September 2025", month: 9 }
  ];

  for (const t of terms) {
    const qs = parseP4RtpQuestions(t.file, t.key);
    console.log(`\nTerm ${t.name}: Extracted ${qs.length} MCQs`);

    const batch: RawImportBatchJson = {
      batchName: `CA Foundation Business Economics (Paper 4) - Official RTP ${t.name}`,
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

    const outPath = `rtp_batches/p4_${t.key}.json`;
    fs.writeFileSync(outPath, JSON.stringify(batch, null, 2), "utf-8");
    console.log(`✓ Saved ${qs.length} validated MCQs to ${outPath}`);
  }
}

main().catch(console.error);
