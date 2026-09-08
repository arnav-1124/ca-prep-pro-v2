import fs from "fs";
import path from "path";
import { validateImportBatch } from "../src/domains/questions/import/validation";
import { CanonicalQuestionJson, CanonicalBatchJson } from "../src/domains/questions/import/types";

function cleanLine(s: string): string {
  return s
    .replace(/\f[^\r\n]*/g, "")
    .replace(/[^\r\n]*Institute of Chartered Accountants of India[^\r\n]*/gi, "")
    .replace(/[^\r\n]*INCOME TAX LAW[^\r\n]*/gi, "")
    .replace(/[^\r\n]*GOODS AND SERVICES TAX[^\r\n]*/gi, "")
    .replace(/[^\r\n]*CASE SCENARIOS\s+\d+[^\r\n]*/gi, "")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function extractSequentialOptions(text: string): { letter: string; text: string }[] {
  const letters = ["a", "b", "c", "d"];
  const indices: { letter: string; idx: number }[] = [];
  let currentSearchPos = 0;

  for (const l of letters) {
    const regex = new RegExp(`(?:^|[\\s\\r\\n])\\(${l}\\)`, "i");
    const sub = text.substring(currentSearchPos);
    const m = sub.match(regex);
    if (!m || m.index === undefined) break;
    const absIdx = currentSearchPos + m.index + (m[0].length - 3);
    indices.push({ letter: l.toUpperCase(), idx: absIdx });
    currentSearchPos = absIdx + 3;
  }

  if (indices.length < 4) return [];

  const options: { letter: string; text: string }[] = [];
  for (let i = 0; i < indices.length; i++) {
    const start = indices[i].idx + 3;
    const end = i < indices.length - 1 ? indices[i + 1].idx : text.length;
    const optTxt = cleanLine(text.substring(start, end));
    if (optTxt.length > 0) {
      options.push({ letter: indices[i].letter, text: optTxt });
    }
  }

  return options;
}

function mapIncomeTaxNode(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("residential status") || lower.includes("ordinarily resident") || lower.includes("deemed resident")) {
    return "INT_P3_SECA_CH1_T1";
  }
  if (lower.includes("agricultural income") || lower.includes("section 10(") || lower.includes("exempt income")) {
    return "INT_P3_SECA_CH2_T1";
  }
  if (lower.includes("salary") || lower.includes("perquisite") || lower.includes("gratuity") || lower.includes("pension") || lower.includes("hra")) {
    return "INT_P3_SECA_CH3_T1";
  }
  if (lower.includes("house property") || lower.includes("annual value") || lower.includes("municipal value") || lower.includes("standard deduction under section 24")) {
    return "INT_P3_SECA_CH4_T1";
  }
  if (lower.includes("pgbp") || lower.includes("business or profession") || lower.includes("depreciation") || lower.includes("section 44ad") || lower.includes("presumptive")) {
    return "INT_P3_SECA_CH5_T1";
  }
  if (lower.includes("capital gain") || lower.includes("long-term capital") || lower.includes("short-term capital") || lower.includes("section 54") || lower.includes("equity shares")) {
    return "INT_P3_SECA_CH6_T1";
  }
  if (lower.includes("other sources") || lower.includes("gift") || lower.includes("dividend") || lower.includes("lottery")) {
    return "INT_P3_SECA_CH7_T1";
  }
  if (lower.includes("clubbing") || lower.includes("minor child") || lower.includes("set-off") || lower.includes("carry forward") || lower.includes("inter-head")) {
    return "INT_P3_SECA_CH8_T1";
  }
  if (lower.includes("80c") || lower.includes("80d") || lower.includes("80g") || lower.includes("80tta") || lower.includes("deduction under chapter vi-a")) {
    return "INT_P3_SECA_CH9_T1";
  }
  return "INT_P3_SECA_CH10_T1"; // Default: Computation of Total Income & Tax Liability
}

function mapGstNode(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("gst in india") || lower.includes("article 246a") || lower.includes("gst council")) {
    return "INT_P3_SECB_CH11_T1";
  }
  if (lower.includes("scope of supply") || lower.includes("schedule i") || lower.includes("schedule ii") || lower.includes("schedule iii") || lower.includes("mixed supply") || lower.includes("composite supply")) {
    return "INT_P3_SECB_CH12_T1";
  }
  if (lower.includes("reverse charge") || lower.includes("rcm") || lower.includes("composition levy") || lower.includes("section 10") || lower.includes("section 9(3)")) {
    return "INT_P3_SECB_CH13_T1";
  }
  if (lower.includes("exemption") || lower.includes("exempt supply") || lower.includes("pure services") || lower.includes("healthcare services")) {
    return "INT_P3_SECB_CH14_T1";
  }
  if (lower.includes("time of supply") || lower.includes("value of supply") || lower.includes("section 12") || lower.includes("section 13") || lower.includes("section 15") || lower.includes("transaction value")) {
    return "INT_P3_SECB_CH15_T1";
  }
  if (lower.includes("input tax credit") || lower.includes("itc") || lower.includes("blocked credit") || lower.includes("section 17(5)") || lower.includes("rule 42") || lower.includes("rule 43") || lower.includes("apportionment of credit")) {
    return "INT_P3_SECB_CH16_T1";
  }
  return "INT_P3_SECB_CH17_T1"; // Registration, Invoicing, E-way bill, Payment, Returns
}

function parseTaxCaseScenarios(filePath: string, isIncomeTax: boolean): { questions: CanonicalQuestionJson[]; caseStudies: any[] } {
  if (!fs.existsSync(filePath)) return { questions: [], caseStudies: [] };
  const text = fs.readFileSync(filePath, "utf-8");

  const csBlocks = text.split(/\f?\s*CASE SCENARIO\s+(\d+)\b/i);
  const questions: CanonicalQuestionJson[] = [];
  const caseStudies: any[] = [];

  const prefix = isIncomeTax ? "INT_P3A" : "INT_P3B";
  const sectionName = isIncomeTax ? "Income Tax Law" : "Goods & Services Tax";

  for (let i = 1; i < csBlocks.length; i += 2) {
    const csNum = parseInt(csBlocks[i], 10);
    const csBody = csBlocks[i + 1];
    if (!csBody) continue;

    // Find MCQ section and Answer section
    const mcqIdx = csBody.search(/MULTIPLE CHOICE QUESTIONS/i);
    if (mcqIdx === -1) continue;

    const ansIdx = csBody.search(/ANSWERS? TO (?:THE )?(?:MULTIPLE CHOICE|CASE SCENARIO)/i);
    if (ansIdx === -1) continue;

    const scenarioText = cleanLine(csBody.substring(0, mcqIdx));
    const mcqPart = csBody.substring(mcqIdx + "MULTIPLE CHOICE QUESTIONS".length, ansIdx);
    const ansPart = csBody.substring(ansIdx);

    const csTitle = `Case Scenario ${csNum}: ${sectionName}`;
    const csRef = `${prefix}_CS_${csNum}`;

    if (scenarioText.length < 50) continue;

    caseStudies.push({
      caseStudyRef: csRef,
      title: csTitle,
      scenarioText,
    });

    // Parse Answers
    const ansMap = new Map<number, { letter: string; reason: string }>();
    const ansRegex = /(\d+)\.\s*(?:Option\s*)?\(?([A-D])\)?\s*([\s\S]*?)(?=(?:\r?\n\s*\d+\.|\r?\n\s*CASE SCENARIO|$))/gi;
    let am;
    while ((am = ansRegex.exec(ansPart)) !== null) {
      const qNum = parseInt(am[1], 10);
      const letter = am[2].toUpperCase();
      let rawAns = am[3] || "";
      const reasonIdx = rawAns.search(/Reason:?/i);
      let reason = "";
      if (reasonIdx !== -1) {
        reason = cleanLine(rawAns.substring(reasonIdx + 7));
      } else {
        reason = cleanLine(rawAns);
      }
      ansMap.set(qNum, { letter, reason });
    }

    // Parse Questions
    const qSplits = mcqPart.split(/\r?\n(?=\d+\.\s+)/);
    for (const block of qSplits) {
      const m = block.match(/^(\d+)\.\s+([\s\S]+)/);
      if (!m) continue;
      const qNum = parseInt(m[1], 10);
      const body = m[2];

      const ansInfo = ansMap.get(qNum);
      if (!ansInfo) continue;

      const optMatch = body.search(/(?:^|[\s\r\n])\(a\)/i);
      if (optMatch === -1) continue;

      const qText = cleanLine(body.substring(0, optMatch));
      const optPart = body.substring(optMatch);
      const options = extractSequentialOptions(optPart);

      if (options.length >= 4 && qText.length >= 10) {
        const nodeCode = isIncomeTax
          ? mapIncomeTaxNode(`${scenarioText} ${qText}`)
          : mapGstNode(`${scenarioText} ${qText}`);

        questions.push({
          nodeCode,
          questionType: "CASE_STUDY",
          difficulty: "HARD",
          caseStudyRef: csRef,
          caseStudyTitle: csTitle,
          caseStudyText: scenarioText,
          questionText: qText,
          options: options.slice(0, 4),
          correctAnswer: ansInfo.letter,
          explanation: ansInfo.reason || `Official BoS Case Scenario Explanation for ${csTitle} MCQ ${qNum}.`,
          source: {
            sourceType: "STUDY_MATERIAL",
            sourceTitle: `ICAI Case Scenario Booklet: Taxation (${sectionName})`,
            sourceYear: 2026,
            sourceMonth: 5,
            sourceReference: `${csTitle} - MCQ ${qNum}`,
            sourceAttempt: "May 2026",
            applicability: isIncomeTax
              ? "As amended by Finance Act, 2025 (May/Sep 2026, Jan 2027 Examinations)"
              : "As amended by Finance (No. 2) Act, 2024 & CGST Notifications up to 31.10.2025",
          },
        });
      }
    }
  }

  return { questions, caseStudies };
}

async function main() {
  console.log("==================================================");
  console.log("GENERATING CA INTERMEDIATE PAPER 3 (TAXATION) BATCH");
  console.log("==================================================");

  const baseDir = path.join(__dirname, "../ingestion/intermediate/paper_3_taxation");
  const p3aCsb = path.join(baseDir, "p3a_csb_layout.txt");
  const p3bCsb = path.join(baseDir, "p3b_csb_layout.txt");

  console.log("Parsing Section A (Income Tax) Case Scenario Booklet...");
  const taxData = parseTaxCaseScenarios(p3aCsb, true);
  console.log(`  -> Extracted ${taxData.questions.length} questions across ${taxData.caseStudies.length} case scenarios.`);

  console.log("Parsing Section B (GST) Case Scenario Booklet...");
  const gstData = parseTaxCaseScenarios(p3bCsb, false);
  console.log(`  -> Extracted ${gstData.questions.length} questions across ${gstData.caseStudies.length} case scenarios.`);

  const allQuestions = [...taxData.questions, ...gstData.questions];
  const allCaseStudies = [...taxData.caseStudies, ...gstData.caseStudies];

  const batchJson: CanonicalBatchJson = {
    batchTitle: "CA Intermediate Paper 3 (Taxation) - BoS Case Scenario Booklet (May 2026)",
    academicLevelCode: "INTERMEDIATE",
    subjectCode: "PAPER_3",
    sourceType: "STUDY_MATERIAL",
    sourceYear: 2026,
    sourceMonth: 5,
    examAttemptCode: "MAY_2026",
    curriculumVersionName: "CA Intermediate Syllabus 2026-2027",
    caseStudies: allCaseStudies,
    questions: allQuestions,
  };

  console.log(`\nTotal Questions Extracted: ${allQuestions.length}`);
  console.log("Validating batch...");

  const report = validateImportBatch(batchJson as any);
  console.log(`Validation: ${report.validCount} valid, ${report.invalidCount} invalid, ${report.totalQuestions} total.`);

  if (report.invalidCount > 0) {
    console.error("Validation Errors Sample:");
    report.questionResults.slice(0, 5).forEach((r, idx) => {
      if (r.errors.length > 0) {
        console.error(`  Q#${idx}:`, r.errors.map(e => e.message).join("; "));
      }
    });
    process.exit(1);
  }

  const outPath = path.join(__dirname, "../ingestion/batches/intermediate_sm_p3_taxation.json");
  fs.writeFileSync(outPath, JSON.stringify(batchJson, null, 2), "utf-8");
  console.log(`Saved batch to ${outPath}`);
  console.log("==================================================");
}

main().catch((err) => {
  console.error("Error generating P3 batch:", err);
  process.exit(1);
});
