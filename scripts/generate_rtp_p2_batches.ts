import * as fs from "fs";
import * as path from "path";
import { validateImportBatch } from "../src/domains/questions/import/validation";
import { RawImportBatchJson, CanonicalQuestionJson } from "../src/domains/questions/import/types";

function clean(str: string): string {
  return str
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .replace(/\x0c/g, "\n")
    .replace(/\d+\s+(?:JANUARY|MAY|SEPTEMBER)\s+\d{4}\s+EXAMINATION/gi, "")
    .replace(/\?*The Institute of Chartered Accountants of India/gi, "")
    .replace(/REVISION TEST PAPER/gi, "")
    .replace(/BUSINESS LAWS/gi, "")
    .replace(/FOUNDATION EXAMINATION/gi, "")
    .replace(/PAPER\s*[\?–\-]\s*2:?/gi, "")
    .trim();
}

function parseP2RtpCaseStudies(filePath: string, termKey: string): CanonicalQuestionJson[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const ansIdx = content.indexOf("SUGGESTED ANSWERS");
  if (ansIdx === -1) return [];

  const qSection = clean(content.slice(0, ansIdx));
  const aSection = clean(content.slice(ansIdx));

  const qParts = qSection.split(/(?:^|\n)\s*(\d{1,2})\.\s+(?=[A-Z]|Mr\.|Mrs\.|Ms\.|A\b|B\b|X\b|Y\b|Whether|What|Explain|State|Discuss|Under)/g);
  const aParts = aSection.split(/(?:^|\n)\s*(\d{1,2})\.\s+/g);

  const aMap = new Map<number, string>();
  for (let i = 1; i < aParts.length; i += 2) {
    aMap.set(parseInt(aParts[i], 10), aParts[i + 1]);
  }

  const termNames: Record<string, { title: string; month: number }> = {
    jan2025: { title: "January 2025", month: 1 },
    may2025: { title: "May 2025", month: 5 },
    sep2025: { title: "September 2025", month: 9 }
  };
  const termInfo = termNames[termKey];

  const questions: CanonicalQuestionJson[] = [];
  let globalIndex = 1;

  for (let i = 1; i < qParts.length; i += 2) {
    const qNum = parseInt(qParts[i], 10);
    const qBody = clean(qParts[i + 1]);
    const aBody = clean(aMap.get(qNum) || "");

    if (qBody.length < 50 || aBody.length < 50) continue;

    const hasFactualPremise = /(?:contract|agreement|goods|company|firm|partner|shares|cheque|rupees|`|\$|delivery|sold|purchased|loan|accident|truck|bricks|tomatoes|oil|jewellery|bangles|director|transporter|unpaid|insolvent|bank|limestone|wheat|car|furniture|machine)/i.test(qBody);
    const isTheoryDefinition = /^(?:define|explain the hierarchical|what is the significance of the supreme court|explain the types of laws|what is the concept of "reservation)/i.test(qBody);

    if (hasFactualPremise && !isTheoryDefinition) {
      const combined = qBody + "\n" + aBody;
      let nodeCode = "FND_P2_CH2";
      let actName = "the Indian Contract Act, 1872";

      if (/sale\s+of\s+goods/i.test(combined) || /goods\s+act/i.test(combined)) {
        actName = "the Sale of Goods Act, 1930";
        if (/lien|stoppage|unpaid\s+seller/i.test(combined)) nodeCode = "FND_P2_CH3_T4";
        else if (/caveat\s+emptor|condition|warrant/i.test(combined)) nodeCode = "FND_P2_CH3_T2";
        else if (/delivery|ownership|risk|property\s+in\s+goods/i.test(combined)) nodeCode = "FND_P2_CH3_T3";
        else nodeCode = "FND_P2_CH3_T1";
      } else if (/partnership/i.test(combined) || /partner/i.test(combined)) {
        actName = "the Indian Partnership Act, 1932";
        if (/dissolution|registration/i.test(combined)) nodeCode = "FND_P2_CH4_T3";
        else if (/emergency|relation|third\s+part|authority/i.test(combined)) nodeCode = "FND_P2_CH4_T2";
        else nodeCode = "FND_P2_CH4_T1";
      } else if (/companies\s+act|subsidiary|small\s+company|private\s+limited|share\s+capital|ultra\s+vires|perpetual|corporate\s+veil/i.test(combined)) {
        actName = "the Companies Act, 2013";
        if (/incorporation|ultra\s+vires|moa|aoa|perpetual|promoter/i.test(combined)) nodeCode = "FND_P2_CH6_T2";
        else nodeCode = "FND_P2_CH6_T1";
      } else if (/llp\s+act|limited\s+liability\s+partnership/i.test(combined)) {
        actName = "the Limited Liability Partnership Act, 2008";
        nodeCode = "FND_P2_CH5_T1";
      } else if (/cheque|negotiable\s+instrument|promissory\s+note|bill\s+of\s+exchange|138/i.test(combined)) {
        actName = "the Negotiable Instruments Act, 1881";
        if (/holder\s+in\s+due\s+course|negotiation/i.test(combined)) nodeCode = "FND_P2_CH7_T2";
        else nodeCode = "FND_P2_CH7_T1";
      } else {
        if (/necessaries|minor|quasi|contingent|68/i.test(combined)) nodeCode = "FND_P2_CH2_T5";
        else if (/breach|damages|anticipatory|73|74/i.test(combined)) nodeCode = "FND_P2_CH2_T4";
        else if (/performance|discharge|time|reciprocal|38|39|51|appropriat/i.test(combined)) nodeCode = "FND_P2_CH2_T3";
        else if (/consideration|capacity|restraint|25|27/i.test(combined)) nodeCode = "FND_P2_CH2_T2";
        else nodeCode = "FND_P2_CH2_T1";
      }

      let questionPrompt = "";
      const promptMatch = qBody.match(/\b(?:Whether|Decide|Can\s+[a-z0-9A-Z_]+|Advise|Is\s+[a-z0-9A-Z_]+|Examine\s+whether|State\s+with\s+reasons\s+whether|Will\s+[a-z0-9A-Z_]+)\b[^?.]+[?.]/i);
      if (promptMatch && promptMatch[0].trim().length >= 15) {
        questionPrompt = promptMatch[0].trim();
      } else {
        const lines = qBody.split("\n").map(l => l.trim()).filter(Boolean);
        const lastLine = lines[lines.length - 1] || "";
        if (lastLine.length >= 15 && !lastLine.includes("Marks)")) {
          questionPrompt = lastLine;
        } else {
          questionPrompt = `Decide the legal position and rights of the parties in accordance with the provisions of ${actName}.`;
        }
      }

      const secMatch = aBody.match(/Section\s+(\d+(?:\([0-9a-zA-Z]+\))*)/i);
      const secStr = secMatch ? `under ${secMatch[0]} of ${actName}` : `under the provisions of ${actName}`;

      const ansTail = aBody.slice(-800);
      const isNegative = /\b(?:is\s+not\s+liable|cannot\s+recover|is\s+not\s+maintainable|is\s+not\s+bound|is\s+void|is\s+not\s+correct|will\s+not\s+succeed|cannot\s+do\s+so|cannot\s+exercise|not\s+entitled|shall\s+not\s+apply|cannot\s+be\s+categorized|cannot\s+be\s+considered|no\s+remedy|no\s+right|not\s+be\s+applicable|not\s+applicable|void)\b/i.test(ansTail);

      let correctText = "";
      let distractor1 = "";
      let distractor2 = "";
      let distractor3 = "";

      if (isNegative) {
        correctText = `No, the contention/claim is not legally sustainable ${secStr}, based on statutory provisions and the established facts.`;
        distractor1 = `Yes, the contention is valid because private agreement between parties overrides explicit statutory rules.`;
        distractor2 = `Yes, because customary commercial practice automatically establishes legal entitlement.`;
        distractor3 = `No, but relief is granted on equitable grounds independent of statutory requirements.`;
      } else {
        correctText = `Yes, the contention/claim is legally valid and enforceable ${secStr}, as all mandatory statutory conditions are satisfied.`;
        distractor1 = `No, the claim is barred due to statutory exceptions and lack of requisite compliance.`;
        distractor2 = `No, because commercial agreements require express registration and government sanction to take effect.`;
        distractor3 = `Yes, but relief is strictly restricted to nominal damages without enforcement of core legal rights.`;
      }

      const targetPos = (globalIndex - 1) % 4;
      const letters = ["A", "B", "C", "D"];
      const targetLetter = letters[targetPos];

      const rawPool = [
        { isCorrect: true, text: correctText },
        { isCorrect: false, text: distractor1 },
        { isCorrect: false, text: distractor2 },
        { isCorrect: false, text: distractor3 }
      ];

      const orderedOpts: string[] = [];
      let dIdx = 1;
      for (let p = 0; p < 4; p++) {
        if (p === targetPos) {
          orderedOpts.push(correctText);
        } else {
          orderedOpts.push(rawPool[dIdx++].text);
        }
      }

      const options = orderedOpts.map((txt, idx) => ({
        letter: letters[idx],
        text: txt
      }));

      const cleanSnippet = qBody.slice(0, 45).replace(/\n/g, " ").replace(/[`'"]/g, "");
      const title = `RTP ${termInfo.title} — Case Problem Q${qNum}: ${cleanSnippet}...`;

      questions.push({
        externalId: `RTP_2025_${termKey.toUpperCase()}_P2_CS_Q${qNum}`,
        questionType: "CASE_STUDY",
        difficulty: "HARD",
        questionText: questionPrompt,
        options,
        correctAnswer: targetLetter,
        explanation: aBody,
        caseStudy: {
          title,
          scenarioText: qBody
        },
        curriculum: {
          subjectCode: "PAPER_2",
          nodeCode
        },
        source: {
          sourceType: "RTP",
          sourceTitle: `ICAI Revision Test Paper (RTP) - ${termInfo.title}`,
          sourceYear: 2025,
          sourceMonth: termInfo.month,
          sourceAttempt: `${termKey.toUpperCase()}_2025`,
          paperNumber: "2",
          questionNumber: String(qNum),
          sourceReference: `RTP ${termInfo.title} Paper 2 Q${qNum}`
        }
      });
      globalIndex++;
    }
  }

  return questions;
}

async function main() {
  console.log("=== GENERATING PAPER 2 (BUSINESS LAWS) RTP CASE STUDY BATCHES ===");

  if (!fs.existsSync("rtp_batches")) {
    fs.mkdirSync("rtp_batches", { recursive: true });
  }

  const terms = [
    { key: "jan2025", file: "rtp_downloads/rtp_jan2025_p2.txt", name: "January 2025", month: 1 },
    { key: "may2025", file: "rtp_downloads/rtp_may2025_p2.txt", name: "May 2025", month: 5 },
    { key: "sep2025", file: "rtp_downloads/rtp_sep2025_p2.txt", name: "September 2025", month: 9 }
  ];

  for (const t of terms) {
    const qs = parseP2RtpCaseStudies(t.file, t.key);
    console.log(`\nTerm ${t.name}: Extracted ${qs.length} Case Studies`);

    const batch: RawImportBatchJson = {
      batchName: `CA Foundation Business Laws (Paper 2) - Official RTP ${t.name} (Case Study Bank)`,
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

    const outPath = `rtp_batches/p2_${t.key}.json`;
    fs.writeFileSync(outPath, JSON.stringify(batch, null, 2), "utf-8");
    console.log(`✓ Saved ${qs.length} validated Case Studies to ${outPath}`);
  }
}

main().catch(console.error);
