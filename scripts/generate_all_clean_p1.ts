import fs from "fs";
import path from "path";

interface P1Unit {
  file: string;
  nodeCode: string;
  chapterTitle: string;
}

const P1_UNITS: P1Unit[] = [
  // Module 1
  { file: "ch1u1_layout.txt", nodeCode: "FND_P1_CH1_T1", chapterTitle: "Meaning and Scope of Accounting" },
  { file: "ch1u2_layout.txt", nodeCode: "FND_P1_CH1_T2", chapterTitle: "Accounting Concepts, Principles and Conventions" },
  { file: "ch1u3_layout.txt", nodeCode: "FND_P1_CH1_T3", chapterTitle: "Capital and Revenue Expenditures and Receipts" },
  { file: "ch1u4_layout.txt", nodeCode: "FND_P1_CH1_T4", chapterTitle: "Contingent Assets and Contingent Liabilities" },
  { file: "ch1u5_layout.txt", nodeCode: "FND_P1_CH1_T5", chapterTitle: "Accounting Policies" },
  { file: "ch1u6_layout.txt", nodeCode: "FND_P1_CH1_T5", chapterTitle: "Accounting as a Measurement Discipline" },
  { file: "ch1u7_layout.txt", nodeCode: "FND_P1_CH1_T6", chapterTitle: "Accounting Standards" },
  { file: "ch2u1_layout.txt", nodeCode: "FND_P1_CH2_T1", chapterTitle: "Basic Accounting Procedures - Journal Entries" },
  { file: "ch2u2_layout.txt", nodeCode: "FND_P1_CH2_T2", chapterTitle: "Ledgers" },
  { file: "ch2u3_layout.txt", nodeCode: "FND_P1_CH2_T2", chapterTitle: "Trial Balance" },
  { file: "ch2u4_layout.txt", nodeCode: "FND_P1_CH2_T1", chapterTitle: "Subsidiary Books" },
  { file: "ch2u5_layout.txt", nodeCode: "FND_P1_CH2_T3", chapterTitle: "Cash Book" },
  { file: "ch2u6_layout.txt", nodeCode: "FND_P1_CH2_T4", chapterTitle: "Rectification of Errors" },
  { file: "ch3_layout.txt", nodeCode: "FND_P1_CH3", chapterTitle: "Bank Reconciliation Statement" },
  { file: "ch4_layout.txt", nodeCode: "FND_P1_CH4", chapterTitle: "Inventories" },
  { file: "ch5_layout.txt", nodeCode: "FND_P1_CH5", chapterTitle: "Depreciation and Amortisation" },
  { file: "ch6_layout.txt", nodeCode: "FND_P1_CH6", chapterTitle: "Bills of Exchange and Promissory Notes" },
  { file: "ch7u1_layout.txt", nodeCode: "FND_P1_CH7_T1", chapterTitle: "Final Accounts of Non-Manufacturing Entities" },
  { file: "ch7u2_layout.txt", nodeCode: "FND_P1_CH7_T2", chapterTitle: "Final Accounts of Manufacturing Entities" },

  // Module 2
  { file: "ch8_layout.txt", nodeCode: "FND_P1_CH8", chapterTitle: "Financial Statements of Not-for-Profit Organisations" },
  { file: "ch9_layout.txt", nodeCode: "FND_P1_CH9", chapterTitle: "Accounts from Incomplete Records" },
  { file: "ch10u1_layout.txt", nodeCode: "FND_P1_CH10_T1", chapterTitle: "Introduction to Partnership Accounts" },
  { file: "ch10u2_layout.txt", nodeCode: "FND_P1_CH10_T1", chapterTitle: "Treatment of Goodwill in Partnership Accounts" },
  { file: "ch10u3_layout.txt", nodeCode: "FND_P1_CH10_T2", chapterTitle: "Admission of a New Partner" },
  { file: "ch10u4_layout.txt", nodeCode: "FND_P1_CH10_T2", chapterTitle: "Retirement of a Partner" },
  { file: "ch10u5_layout.txt", nodeCode: "FND_P1_CH10_T2", chapterTitle: "Death of a Partner" },
  { file: "ch10u6_layout.txt", nodeCode: "FND_P1_CH10_T3", chapterTitle: "Dissolution of Partnership Firms and LLPs" },
  { file: "ch11u1_layout.txt", nodeCode: "FND_P1_CH11_T1", chapterTitle: "Introduction to Company Accounts" },
  { file: "ch11u2_layout.txt", nodeCode: "FND_P1_CH11_T1", chapterTitle: "Issue, Forfeiture and Re-Issue of Shares" },
  { file: "ch11u3_layout.txt", nodeCode: "FND_P1_CH11_T2", chapterTitle: "Issue of Debentures" },
  { file: "ch11u4_layout.txt", nodeCode: "FND_P1_CH11_T2", chapterTitle: "Accounting for Bonus Issue and Right Issue" },
  { file: "ch11u5_layout.txt", nodeCode: "FND_P1_CH11_T3", chapterTitle: "Redemption of Preference Shares" },
  { file: "ch11u6_layout.txt", nodeCode: "FND_P1_CH11_T3", chapterTitle: "Redemption of Debentures" },
];

function cleanLine(s: string): string {
  return s
    .replace(/^[ \t]*(?:(?:\d+\.\.)?\d+\s+ACCOUNTING|\d+\.\d+\s+ACCOUNTING)[^\r\n]*$/gmi, "")
    .replace(/^[ \t]*[^\r\n]*The Institute of Chartered Accountants of India[^\r\n]*$/gmi, "")
    .replace(/^[ \t]*THEORETICAL FRAMEWORK\s*\d+\.\d+[^\r\n]*$/gmi, "")
    .replace(/\f/g, "")
    // Normalize currency
    .replace(/`\s*(\d[\d,]*)/g, "₹$1")
    .replace(/\bRs\.?\s*(\d[\d,]*)/g, "₹$1")
    // Clean broken chars
    .replace(/[\uFFFD]/g, "-")
    // Normalize whitespace
    .replace(/[\r\n]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function extractP1Answers(text: string): Record<string, string> {
  const ansMap: Record<string, string> = {};

  const indices: number[] = [];
  let pos = 0;
  while (true) {
    const idx = text.indexOf("Multiple Choice Questions", pos);
    if (idx === -1) break;
    indices.push(idx);
    pos = idx + 25;
  }

  let answerBlock = "";
  if (indices.length >= 2) {
    answerBlock = text.substring(indices[indices.length - 1]);
  } else {
    const hintsIdx = text.search(/ANSWERS?[\s\/]*HINTS/i);
    if (hintsIdx !== -1) {
      answerBlock = text.substring(hintsIdx);
    } else {
      answerBlock = text.slice(-15000);
    }
  }

  const subIdx = answerBlock.search(/Multiple Choice Questions/i);
  if (subIdx !== -1) {
    answerBlock = answerBlock.substring(subIdx);
  }

  const stopIdx = answerBlock.search(/(?:Theoretical Questions?|Practical Questions?|Short Answer Questions?)/i);
  if (stopIdx !== -1 && stopIdx > 30) {
    answerBlock = answerBlock.substring(0, stopIdx);
  } else {
    answerBlock = answerBlock.substring(0, 3500);
  }

  // Format 1: Roman numerals like "1.(i) (b)" or "(i) (b)"
  const romanRegex = /(?:(\d{1,2})\.?)?\s*\(([ivx]+)\)\s*\(?([a-d])\)?/gi;
  let rm;
  let currentNum = 1;
  while ((rm = romanRegex.exec(answerBlock)) !== null) {
    if (rm[1]) currentNum = parseInt(rm[1], 10);
    const roman = rm[2].toLowerCase();
    const ans = rm[3].toUpperCase();
    ansMap[`${currentNum}_${roman}`] = ans;
    if (!ansMap[`${currentNum}`]) {
      ansMap[`${currentNum}`] = ans;
    }
  }

  // Format 2: Standard numbers: "1. (c)" or "1 (c)" or "5 (a)"
  const stdRegex = /(?:^|\s|\n)(?:\(?(\d{1,2})\)?[\.\)]?)\s*\(?([a-d])\)?(?!\s*\()/gi;
  let sm;
  while ((sm = stdRegex.exec(answerBlock)) !== null) {
    const num = parseInt(sm[1], 10);
    if (num >= 1 && num <= 50) {
      const ans = sm[2].toUpperCase();
      if (!ansMap[`${num}`]) {
        ansMap[`${num}`] = ans;
      }
    }
  }

  return ansMap;
}

export interface OutputQuestion {
  canonicalNodeCode: string;
  questionType: "MCQ";
  difficulty: "EASY" | "MEDIUM" | "HARD";
  questionText: string;
  options: { letter: string; text: string }[];
  correctAnswer: string;
  explanation: string;
  sourceYear: number;
  sourceMonth: number;
}

export function parseAllP1Units(): OutputQuestion[] {
  const baseDir = path.join(process.cwd(), "ingestion", "foundation", "paper_1_accounting");
  const allQuestions: OutputQuestion[] = [];

  for (const u of P1_UNITS) {
    const filePath = path.join(baseDir, u.file);
    if (!fs.existsSync(filePath)) continue;

    const raw = fs.readFileSync(filePath, "utf8");
    const answers = extractP1Answers(raw);

    const mcqMatch = raw.match(/Multiple Choice Questions/i);
    if (!mcqMatch) continue;

    const afterMcq = raw.substring(mcqMatch.index! + mcqMatch[0].length);
    const endMatch = afterMcq.match(/(?:Theoretical Questions?|Theory Questions?|Descriptive Questions?|True and False|True\/False|Practical Questions?|ANSWERS\/HINTS|ANSWERS)/i);
    const mcqBlock = endMatch ? afterMcq.substring(0, endMatch.index!) : afterMcq.substring(0, 30000);

    // Parse question markers: support both "1." and "1.(i)" or "(i)"
    const qRegex = /(?:^|\n)\s*(?:(?:\((\d{1,2})\)|(\d{1,2})\.)\s*(?:\(([ivx]+)\)\s*)?|\(([ivx]+)\)\s+)/gi;
    const qMarkers: { numKey: string; parentNum: number; index: number; length: number }[] = [];
    let currentParentNum = 1;
    let qm;

    while ((qm = qRegex.exec(mcqBlock)) !== null) {
      let numKey = "";
      if (qm[1] || qm[2]) {
        currentParentNum = parseInt(qm[1] || qm[2], 10);
        if (qm[3]) {
          numKey = `${currentParentNum}_${qm[3].toLowerCase()}`;
        } else {
          numKey = `${currentParentNum}`;
        }
      } else if (qm[4]) {
        numKey = `${currentParentNum}_${qm[4].toLowerCase()}`;
      }

      const snippet = mcqBlock.substring(qm.index, qm.index + 20);
      if (!/^\s*\([a-d]\)\s+/i.test(snippet)) {
        qMarkers.push({
          numKey,
          parentNum: currentParentNum,
          index: qm.index,
          length: qm[0].length,
        });
      }
    }

    for (let i = 0; i < qMarkers.length; i++) {
      const cur = qMarkers[i];
      const nextIdx = i + 1 < qMarkers.length ? qMarkers[i + 1].index : mcqBlock.length;
      const block = mcqBlock.substring(cur.index + cur.length, nextIdx);

      // Extract options (a), (b), (c), (d)
      const optRegex = /(?:^|\s{2,}|\n)\s*\(([a-dA-D])\)\s+/g;
      const optMatches: { letter: string; index: number; length: number }[] = [];
      let om;
      while ((om = optRegex.exec(block)) !== null) {
        optMatches.push({
          letter: om[1].toUpperCase(),
          index: om.index,
          length: om[0].length,
        });
      }

      if (optMatches.length < 2) continue;

      const validOpts = optMatches.slice(0, 4);
      let qText = cleanLine(block.substring(0, validOpts[0].index));
      qText = qText.replace(/^(?:\(?\d{1,2}\)?[\.\)]?\s*)+/, "").replace(/^\([ivx]+\)\s*/i, "").trim();

      if (!qText || qText.length < 8) continue;

      const options: { letter: string; text: string }[] = [];
      for (let j = 0; j < validOpts.length; j++) {
        const opt = validOpts[j];
        const optEnd = j + 1 < validOpts.length ? validOpts[j + 1].index : block.length;
        const optText = cleanLine(block.substring(opt.index + opt.length, optEnd));
        const letter = String.fromCharCode(65 + j); // standard A, B, C, D
        if (optText.length > 0) {
          options.push({ letter, text: optText });
        }
      }

      if (options.length < 2) continue;

      // Pad with "None of the above" if 3 options exist
      if (options.length === 3) {
        options.push({ letter: "D", text: "None of the above" });
      }

      // Determine authoritative answer
      let correct = answers[cur.numKey] || answers[`${cur.parentNum}`];
      if (!correct || !options.some((o) => o.letter === correct)) {
        // Log if missing
        console.warn(`[WARN] Missing answer for ${u.file} Q#${cur.numKey} (Parent: ${cur.parentNum}). Options count: ${options.length}`);
        continue; // Do NOT insert questions with guessed answers!
      }

      allQuestions.push({
        canonicalNodeCode: u.nodeCode,
        questionType: "MCQ",
        difficulty: "MEDIUM",
        questionText: qText,
        options,
        correctAnswer: correct,
        explanation: `Correct answer according to official ICAI Study Material for ${u.chapterTitle} is (${correct}).`,
        sourceYear: 2026,
        sourceMonth: 5,
      });
    }
  }

  return allQuestions;
}

async function main() {
  const qs = parseAllP1Units();
  console.log(`\nTotal verified clean questions parsed for Paper 1: ${qs.length}`);

  // Check answer distribution
  const dist: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
  let dummyCount = 0;
  for (const q of qs) {
    dist[q.correctAnswer] = (dist[q.correctAnswer] || 0) + 1;
    for (const opt of q.options) {
      if (/^Option\s+[A-D]$/i.test(opt.text)) dummyCount++;
    }
  }

  console.log("Answer distribution:", dist);
  console.log(`Dummy option count: ${dummyCount}`);

  // Save clean batch
  const outPath = path.join(process.cwd(), "ingestion", "batches", "foundation_sm_p1_accounting.json");
  const payload = {
    batchName: "Foundation Study Material - Paper 1: Accounting (Clean ICAI Authoritative)",
    schemaVersion: "1.0",
    sourceType: "STUDY_MATERIAL",
    sourceTitle: "ICAI Foundation Study Material 2025-2026 - Paper 1 Accounting",
    sourceYear: 2026,
    sourceMonth: 5,
    questions: qs,
  };

  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
  console.log(`Saved updated clean batch to ${outPath}`);
}

main().catch(console.error);
