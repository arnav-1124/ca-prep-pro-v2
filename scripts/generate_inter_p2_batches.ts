import fs from "fs";
import path from "path";
import { validateImportBatch } from "../src/domains/questions/import/validation";
import { CanonicalQuestionJson, CanonicalBatchJson } from "../src/domains/questions/import/types";

function cleanLine(s: string): string {
  return s
    .replace(/\f[^\r\n]*/g, "")
    .replace(/[^\r\n]*Institute of Chartered Accountants of India[^\r\n]*/gi, "")
    .replace(/[^\r\n]*CORPORATE AND OTHER LAWS[^\r\n]*/gi, "")
    .replace(/[^\r\n]*CASE SCENARIOS\s+\d+[^\r\n]*/gi, "")
    .replace(/[^\r\n]*PRELIMINARY\s+\d+\.\d+[^\r\n]*/gi, "")
    .replace(/[^\r\n]*INCORPORATION OF COMPANY[^\r\n]*/gi, "")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function extractSequentialOptions(text: string): { letter: string; text: string }[] {
  const letters = ["a", "b", "c", "d"];
  const indices: { letter: string; idx: number }[] = [];
  let currentSearchPos = 0;

  for (const l of letters) {
    // Match (a) with possible whitespace, often preceded by newline or space
    const regex = new RegExp(`(?:^|[\\s\\r\\n])\\(${l}\\)`, "i");
    const sub = text.substring(currentSearchPos);
    const m = sub.match(regex);
    if (!m || m.index === undefined) break;
    const absIdx = currentSearchPos + m.index + (m[0].length - 3); // Position right at '('
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

/**
 * Parses chapter TYK MCQs from layout text
 */
function parseChapterTyk(filePath: string, defaultNodeCode: string, chapterName: string): CanonicalQuestionJson[] {
  if (!fs.existsSync(filePath)) return [];
  const text = fs.readFileSync(filePath, "utf-8");

  // Find start of MCQ section
  const mcqMatch = text.search(/MCQ based Questions|Multiple Choice Questions/i);
  if (mcqMatch === -1) return [];

  // Find answer section
  const ansMatch = text.search(/Answer(?:s)? to MCQ based Questions|Answers to Multiple/i);
  if (ansMatch === -1) return [];

  const mcqSection = text.substring(mcqMatch, ansMatch);
  const ansSection = text.substring(ansMatch);

  // Extract answer keys
  const ansMap = new Map<number, { letter: string; reason: string }>();
  const ansRegex = /(\d+)\.\s*\(?([A-D])\)?\s*([^\r\n]+(?:\r?\n(?!\d+\.)[^\r\n]+)*)/gi;
  let am;
  while ((am = ansRegex.exec(ansSection)) !== null) {
    const qNum = parseInt(am[1], 10);
    const letter = am[2].toUpperCase();
    const reason = cleanLine(am[3] || "");
    ansMap.set(qNum, { letter, reason });
  }

  // Extract Questions
  const questions: CanonicalQuestionJson[] = [];
  const qSplits = mcqSection.split(/\r?\n(?=\d+\.\s+)/);

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
      questions.push({
        nodeCode: defaultNodeCode,
        questionType: "MCQ",
        difficulty: "MEDIUM",
        questionText: qText,
        options: options.slice(0, 4),
        correctAnswer: ansInfo.letter,
        explanation: ansInfo.reason || `Test Your Knowledge question from ${chapterName}.`,
        source: {
          sourceType: "STUDY_MATERIAL",
          sourceTitle: "ICAI Study Material (May 2026 Examination Edition)",
          sourceYear: 2026,
          sourceMonth: 5,
          sourceReference: `${chapterName} - TYK Q${qNum}`,
          sourceAttempt: "May 2026",
          applicability: "May 2026 Examination onwards",
        },
      });
    }
  }

  return questions;
}

/**
 * Parses Case Scenarios Booklet for Paper 2
 */
function parseCaseScenariosBooklet(filePath: string): { questions: CanonicalQuestionJson[]; caseStudies: any[] } {
  if (!fs.existsSync(filePath)) return { questions: [], caseStudies: [] };
  const text = fs.readFileSync(filePath, "utf-8");

  const csBlocks = text.split(/\f?\s*CASE SCENARIO\s+(\d+)\b/i);
  const questions: CanonicalQuestionJson[] = [];
  const caseStudies: any[] = [];

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

    const csTitle = `Case Scenario ${csNum}: Corporate & Other Laws`;
    const csRef = `INT_P2_CS_${csNum}`;

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
      const reasonIdx = rawAns.search(/Reason:/i);
      let reason = "";
      if (reasonIdx !== -1) {
        reason = cleanLine(rawAns.substring(reasonIdx + 7));
      } else {
        reason = cleanLine(rawAns);
      }
      ansMap.set(qNum, { letter, reason });
    }

    // Determine relevant syllabus node based on content keywords
    let nodeCode = "INT_P2_MOD1_CH1";
    const lowerScen = scenarioText.toLowerCase();
    if (lowerScen.includes("prospectus") || lowerScen.includes("allotment")) nodeCode = "INT_P2_MOD1_CH3";
    else if (lowerScen.includes("share capital") || lowerScen.includes("debenture") || lowerScen.includes("sweat equity")) nodeCode = "INT_P2_MOD1_CH4";
    else if (lowerScen.includes("deposit")) nodeCode = "INT_P2_MOD1_CH5";
    else if (lowerScen.includes("charge")) nodeCode = "INT_P2_MOD1_CH6";
    else if (lowerScen.includes("annual general meeting") || lowerScen.includes("agm") || lowerScen.includes("quorum") || lowerScen.includes("proxy") || lowerScen.includes("resolution")) nodeCode = "INT_P2_MOD1_CH7";
    else if (lowerScen.includes("dividend") || lowerScen.includes("iepf") || lowerScen.includes("unpaid dividend")) nodeCode = "INT_P2_MOD1_CH8";
    else if (lowerScen.includes("books of account") || lowerScen.includes("financial statement") || lowerScen.includes("csr") || lowerScen.includes("board's report")) nodeCode = "INT_P2_MOD1_CH9";
    else if (lowerScen.includes("auditor") || lowerScen.includes("caro") || lowerScen.includes("audit committee")) nodeCode = "INT_P2_MOD1_CH10";
    else if (lowerScen.includes("foreign company") || lowerScen.includes("outside india")) nodeCode = "INT_P2_MOD1_CH11";
    else if (lowerScen.includes("llp") || lowerScen.includes("limited liability partnership")) nodeCode = "INT_P2_MOD1_CH12";
    else if (lowerScen.includes("general clauses") || lowerScen.includes("repeal") || lowerScen.includes("good faith")) nodeCode = "INT_P2_MOD2_CH13_T1";
    else if (lowerScen.includes("interpretation") || lowerScen.includes("statute") || lowerScen.includes("literal rule")) nodeCode = "INT_P2_MOD2_CH14_T1";
    else if (lowerScen.includes("fema") || lowerScen.includes("foreign exchange") || lowerScen.includes("capital account") || lowerScen.includes("current account")) nodeCode = "INT_P2_MOD2_CH15_T1";
    else if (lowerScen.includes("incorporation") || lowerScen.includes("moa") || lowerScen.includes("aoa")) nodeCode = "INT_P2_MOD1_CH2";

    // Parse MCQs inside Case Scenario
    const qBlocks = mcqPart.split(/\r?\n(?=\d+\.\s+)/);
    for (const block of qBlocks) {
      const qm = block.match(/^(\d+)\.\s+([\s\S]+)/);
      if (!qm) continue;
      const qNum = parseInt(qm[1], 10);
      const qBody = qm[2];

      const ansInfo = ansMap.get(qNum);
      if (!ansInfo) continue;

      const optMatch = qBody.search(/(?:^|[\s\r\n])\(a\)/i);
      if (optMatch === -1) continue;

      const qText = cleanLine(qBody.substring(0, optMatch));
      const optPart = qBody.substring(optMatch);
      const options = extractSequentialOptions(optPart);

      if (options.length >= 4 && qText.length >= 10) {
        questions.push({
          nodeCode,
          questionType: "CASE_STUDY",
          difficulty: "HARD",
          caseStudyRef: csRef,
          caseStudy: {
            caseStudyRef: csRef,
            title: csTitle,
            scenarioText,
          },
          questionText: qText,
          options: options.slice(0, 4),
          correctAnswer: ansInfo.letter,
          explanation: ansInfo.reason || `Official case scenario question from ICAI Case Scenarios Booklet.`,
          source: {
            sourceType: "STUDY_MATERIAL",
            sourceTitle: "ICAI Case Scenarios Booklet - Corporate & Other Laws",
            sourceYear: 2026,
            sourceMonth: 5,
            sourceReference: `Case Scenario ${csNum} - Q${qNum}`,
            sourceAttempt: "May 2026",
            applicability: "May 2026 Examination onwards (amendments up to 31st Oct 2025)",
          },
        });
      }
    }
  }

  return { questions, caseStudies };
}

async function main() {
  console.log("==================================================");
  console.log("GENERATING CA INTERMEDIATE PAPER 2 (LAW) BATCH");
  console.log("==================================================");

  const chapterConfigs = [
    { file: "p2_ch1_layout.txt", nodeCode: "INT_P2_MOD1_CH1", name: "Chapter 1: Preliminary" },
    { file: "p2_ch2_layout.txt", nodeCode: "INT_P2_MOD1_CH2", name: "Chapter 2: Incorporation" },
    { file: "p2_ch3_layout.txt", nodeCode: "INT_P2_MOD1_CH3", name: "Chapter 3: Prospectus" },
    { file: "p2_ch4_layout.txt", nodeCode: "INT_P2_MOD1_CH4", name: "Chapter 4: Share Capital" },
    { file: "p2_ch5_layout.txt", nodeCode: "INT_P2_MOD1_CH5", name: "Chapter 5: Deposits" },
    { file: "p2_ch6_layout.txt", nodeCode: "INT_P2_MOD1_CH6", name: "Chapter 6: Charges" },
    { file: "p2_ch7_layout.txt", nodeCode: "INT_P2_MOD1_CH7", name: "Chapter 7: Management" },
    { file: "p2_ch8_layout.txt", nodeCode: "INT_P2_MOD1_CH8", name: "Chapter 8: Dividend" },
    { file: "p2_ch9_layout.txt", nodeCode: "INT_P2_MOD1_CH9", name: "Chapter 9: Accounts & CSR" },
    { file: "p2_ch10_layout.txt", nodeCode: "INT_P2_MOD1_CH10", name: "Chapter 10: Audit" },
    { file: "p2_ch11_layout.txt", nodeCode: "INT_P2_MOD1_CH11", name: "Chapter 11: Foreign Companies" },
    { file: "p2_ch12_layout.txt", nodeCode: "INT_P2_MOD1_CH12", name: "Chapter 12: LLP Act" },
    { file: "p2_other_ch1_layout.txt", nodeCode: "INT_P2_MOD2_CH13_T1", name: "General Clauses Act" },
    { file: "p2_other_ch2_layout.txt", nodeCode: "INT_P2_MOD2_CH14_T1", name: "Interpretation of Statutes" },
    { file: "p2_other_ch3_layout.txt", nodeCode: "INT_P2_MOD2_CH15_T1", name: "FEMA 1999" },
  ];

  const allQuestions: CanonicalQuestionJson[] = [];

  // 1. Parse Chapter TYKs
  console.log("\n1. Parsing Chapter Test Your Knowledge MCQs...");
  for (const ch of chapterConfigs) {
    const filePath = path.join(__dirname, "../ingestion/intermediate/paper_2_law", ch.file);
    const qs = parseChapterTyk(filePath, ch.nodeCode, ch.name);
    console.log(`  - ${ch.name}: ${qs.length} MCQs extracted`);
    allQuestions.push(...qs);
  }

  // 2. Parse Case Scenarios Booklet
  console.log("\n2. Parsing Case Scenarios Booklet...");
  const csbPath = path.join(__dirname, "../ingestion/intermediate/booklets/p2_csb_layout.txt");
  const csbResult = parseCaseScenariosBooklet(csbPath);
  console.log(`  - Case Scenarios: ${csbResult.caseStudies.length} scenarios, ${csbResult.questions.length} questions extracted`);
  allQuestions.push(...csbResult.questions);

  console.log(`\nTotal Paper 2 Questions Extracted: ${allQuestions.length}`);

  const batchPayload: CanonicalBatchJson = {
    schemaVersion: "2.0",
    batchName: "CA Intermediate Paper 2: Corporate and Other Laws (SM & Case Scenarios)",
    sourceType: "STUDY_MATERIAL",
    sourceTitle: "ICAI Study Material & Case Scenarios (May 2026 Examination Edition)",
    sourceYear: 2026,
    sourceMonth: 5,
    caseStudies: csbResult.caseStudies,
    questions: allQuestions,
  };

  // 3. In-memory Validation
  console.log("\n3. Validating against Canonical Batch Schema...");
  const valResult = validateImportBatch(batchPayload);
  if (valResult.batchErrors.length > 0) {
    console.error("Batch Errors:", valResult.batchErrors);
    throw new Error("Validation failed");
  }
  console.log(`  ✓ Valid Questions: ${valResult.validCount} / ${valResult.totalQuestions}`);
  if (valResult.invalidCount > 0) {
    console.warn(`  ⚠ Invalid Questions: ${valResult.invalidCount}`);
    valResult.questionResults.forEach((r, idx) => {
      if (r.errors.length > 0) {
        console.warn(`    Q#${idx} [${allQuestions[idx].nodeCode}]:`, r.errors.map(e => e.message).join("; "));
      }
    });
  }

  // 4. Save to `ingestion/batches/`
  const outDir = path.join(__dirname, "../ingestion/batches");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "intermediate_sm_p2_law.json");
  fs.writeFileSync(outPath, JSON.stringify(batchPayload, null, 2), "utf-8");
  console.log(`\n✓ Saved clean batch payload to ${outPath} (${fs.statSync(outPath).size} bytes)`);
}

main().catch(console.error);
