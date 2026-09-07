import * as fs from "fs";
import * as path from "path";
import { validateImportBatch } from "../src/domains/questions/import/validation";
import { RawImportBatchJson, CanonicalQuestionJson } from "../src/domains/questions/import/types";

function cleanPdfPageBreaks(text: string): string {
  return text
    .replace(/\x0c/g, "\n")
    .replace(/\d+\s+(?:JANUARY|MAY|SEPTEMBER)\s+\d{4}\s+EXAMINATION/gi, "")
    .replace(/\?*The Institute of Chartered Accountants of India/gi, "")
    .replace(/REVISION TEST PAPER/gi, "")
    .replace(/FOUNDATION EXAMINATION/gi, "")
    .replace(/ACCOUNTING/gi, "")
    .replace(/PAPER\s*[\?–\-]\s*\d+:?/gi, "")
    .replace(/QUESTIONS/gi, "");
}

function mapAccountingTopic(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("debit note") || lower.includes("sales return") || lower.includes("purchases return") || lower.includes("subsidiary book") || lower.includes("nominal account") || lower.includes("ledger")) {
    return "FND_P1_CH2";
  }
  if (lower.includes("cash book") || lower.includes("petty cash")) {
    return "FND_P1_CH2_T3";
  }
  if (lower.includes("furniture") || lower.includes("capital") || lower.includes("revenue expenditure") || lower.includes("contingent")) {
    return "FND_P1_CH1_T3";
  }
  if (lower.includes("accounting standard") || lower.includes("icai") || lower.includes("central government")) {
    return "FND_P1_CH1_T6";
  }
  if (lower.includes("concepts") || lower.includes("conventions") || lower.includes("assumptions") || lower.includes("results and position disclosed")) {
    return "FND_P1_CH1_T2";
  }
  if (lower.includes("bank reconciliation") || lower.includes("passbook") || lower.includes("bank balance")) {
    return "FND_P1_CH3";
  }
  if (lower.includes("inventory") || lower.includes("periodic inventory") || lower.includes("warehouse rent") || lower.includes("cost of finished")) {
    return "FND_P1_CH4";
  }
  if (lower.includes("depreciation") || lower.includes("reducing balance") || lower.includes("depreciable asset") || lower.includes("land is")) {
    return "FND_P1_CH5";
  }
  if (lower.includes("promissory note") || lower.includes("bill of exchange") || lower.includes("public holiday") || lower.includes("bearer")) {
    return "FND_P1_CH6";
  }
  if (lower.includes("outstanding salaries") || lower.includes("outstanding expenditure") || lower.includes("balance sheet") || lower.includes("debtors") || lower.includes("bad debt") || lower.includes("provision for doubtful")) {
    return "FND_P1_CH7";
  }
  if (lower.includes("non-profit") || lower.includes("receipts and payments") || lower.includes("income expenditure")) {
    return "FND_P1_CH8";
  }
  if (lower.includes("goodwill") || lower.includes("partner") || lower.includes("joint life policy") || lower.includes("surrender value")) {
    return "FND_P1_CH10";
  }
  if (lower.includes("share") || lower.includes("debenture") || lower.includes("preference shares") || lower.includes("equity shares") || lower.includes("company x ltd")) {
    return "FND_P1_CH11";
  }
  return "FND_P1_CH1";
}

function parseP1TrueFalseQuestions(filePath: string, termKey: string): CanonicalQuestionJson[] {
  const rawText = fs.readFileSync(filePath, "utf-8");
  const ansIdx = rawText.indexOf("SUGGESTED ANSWERS");
  const qSection = rawText.slice(0, ansIdx);
  const aSection = rawText.slice(ansIdx);

  const tfStart = qSection.indexOf("True and False");
  const tfEnd = qSection.indexOf("Theoretical Framework");
  const tfBlock = cleanPdfPageBreaks(qSection.slice(tfStart, tfEnd !== -1 ? tfEnd : tfStart + 3500));

  const aCleaned = cleanPdfPageBreaks(aSection);
  const a1Match = aCleaned.match(/(?:^|\n)\s*1\.\s+([\s\S]*?)(?=(?:\n\s*2\.\s+)|\n\s*Theoretical Framework|$)/);
  const a1Block = a1Match ? a1Match[1] : "";

  const qRegex = /\(([a-z0-9]+)\)\s*([\s\S]*?)(?=\([a-z0-9]+\)|$)/gi;
  const qMap = new Map<string, string>();
  let qm: RegExpExecArray | null;
  while ((qm = qRegex.exec(tfBlock)) !== null) {
    const key = qm[1].toLowerCase();
    const text = qm[2].replace(/\s+/g, " ").trim();
    if (text.length > 10 && !text.includes("State with reasons")) {
      qMap.set(key, text);
    }
  }

  const aRegex = /\(([a-z0-9]+)\)\s*([\s\S]*?)(?=\([a-z0-9]+\)|$)/gi;
  const aMap = new Map<string, { isTrue: boolean; explanation: string }>();
  let am: RegExpExecArray | null;
  while ((am = aRegex.exec(a1Block)) !== null) {
    const key = am[1].toLowerCase();
    const fullAns = am[2].replace(/\s+/g, " ").trim();
    const isTrue = /^True/i.test(fullAns);
    const explanation = fullAns.replace(/^(?:True|False):?\s*/i, "").trim();
    aMap.set(key, { isTrue, explanation });
  }

  const termNames: Record<string, { title: string; month: number }> = {
    jan2025: { title: "January 2025", month: 1 },
    may2025: { title: "May 2025", month: 5 },
    sep2025: { title: "September 2025", month: 9 }
  };
  const termInfo = termNames[termKey];

  const questions: CanonicalQuestionJson[] = [];
  let index = 1;

  for (const [key, qText] of qMap.entries()) {
    const ans = aMap.get(key);
    if (ans) {
      const correct = ans.isTrue ? "A" : "B";
      const nodeCode = mapAccountingTopic(qText);

      questions.push({
        externalId: `RTP_2025_${termKey.toUpperCase()}_P1_TF_${key.toUpperCase()}`,
        questionType: "MCQ",
        difficulty: "MEDIUM",
        questionText: `State whether the following statement is True or False:\n"${qText}"`,
        options: [
          { letter: "A", text: "True" },
          { letter: "B", text: "False" }
        ],
        correctAnswer: correct,
        explanation: `${ans.isTrue ? "True" : "False"}: ${ans.explanation}`,
        curriculum: {
          subjectCode: "PAPER_1",
          nodeCode
        },
        source: {
          sourceType: "RTP",
          sourceTitle: `ICAI Revision Test Paper (RTP) - ${termInfo.title}`,
          sourceYear: 2025,
          sourceMonth: termInfo.month,
          sourceAttempt: `${termKey.toUpperCase()}_2025`,
          paperNumber: "1",
          questionNumber: `1(${key})`,
          sourceReference: `RTP ${termInfo.title} Paper 1 Q1(${key})`
        }
      });
      index++;
    }
  }

  return questions;
}

async function main() {
  console.log("=== GENERATING PAPER 1 (ACCOUNTING) RTP BATCHES ===");

  if (!fs.existsSync("rtp_batches")) {
    fs.mkdirSync("rtp_batches", { recursive: true });
  }

  const terms = [
    { key: "jan2025", file: "rtp_downloads/rtp_jan2025_p1.txt", name: "January 2025", month: 1 },
    { key: "may2025", file: "rtp_downloads/rtp_may2025_p1.txt", name: "May 2025", month: 5 },
    { key: "sep2025", file: "rtp_downloads/rtp_sep2025_p1.txt", name: "September 2025", month: 9 }
  ];

  for (const t of terms) {
    const qs = parseP1TrueFalseQuestions(t.file, t.key);
    console.log(`\nTerm ${t.name}: Extracted ${qs.length} True/False MCQs`);

    const batch: RawImportBatchJson = {
      batchName: `CA Foundation Accounting (Paper 1) - Official RTP ${t.name} (Conceptual True/False Bank)`,
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

    const outPath = `rtp_batches/p1_${t.key}.json`;
    fs.writeFileSync(outPath, JSON.stringify(batch, null, 2), "utf-8");
    console.log(`✓ Saved ${qs.length} validated MCQs to ${outPath}`);
  }
}

main().catch(console.error);
