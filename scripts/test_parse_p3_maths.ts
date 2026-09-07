import fs from "fs";
import path from "path";

interface ChapterConfig {
  file: string;
  nodeCode: string;
  chapterTitle: string;
}

const CHAPTERS: ChapterConfig[] = [
  { file: "ch1_layout.txt", nodeCode: "FND_P3_CH1", chapterTitle: "Ratio and Proportion, Indices and Logarithms" },
  { file: "ch2_layout.txt", nodeCode: "FND_P3_CH2", chapterTitle: "Equations" },
  { file: "ch3_layout.txt", nodeCode: "FND_P3_CH3", chapterTitle: "Linear Inequalities" },
  { file: "ch4_layout.txt", nodeCode: "FND_P3_CH4", chapterTitle: "Mathematics of Finance" },
  { file: "ch5_layout.txt", nodeCode: "FND_P3_CH5", chapterTitle: "Basic Principles of Permutations and Combinations" },
  { file: "ch6_layout.txt", nodeCode: "FND_P3_CH6", chapterTitle: "Sequence and Series - AP & GP" },
  { file: "ch7_layout.txt", nodeCode: "FND_P3_CH7", chapterTitle: "Sets, Relations and Functions" },
  { file: "ch8u2_layout.txt", nodeCode: "FND_P3_CH8", chapterTitle: "Basic Applications of Differential and Integral Calculus" },
];

const quantDir = path.join(__dirname, "../ingestion/foundation/paper_3_quant");

for (const ch of CHAPTERS) {
  const filePath = path.join(quantDir, ch.file);
  const text = fs.readFileSync(filePath, "utf-8");

  // Extract answer keys from the end
  // Many chapters have "ANSWERS" or answer grids at the end
  // Let's find all answer pairs: e.g. "1. (a)", "1 (b)", "1.(c)", "103 (b)"
  // In ch1..ch8, the answer key is usually in the last 10,000 characters
  const endSlice = text.substring(Math.max(0, text.length - 15000));
  
  const ansRegex = /(?:^|\s)(\d{1,3})\s*[\.\)]?\s*\(?([a-d])\)?/gi;
  let m;
  const answerMap = new Map<number, string>();
  while ((m = ansRegex.exec(endSlice)) !== null) {
    const qNum = parseInt(m[1], 10);
    const ans = m[2].toUpperCase();
    if (qNum > 0 && qNum < 300) {
      answerMap.set(qNum, ans);
    }
  }

  console.log(`[${ch.nodeCode}] ${ch.chapterTitle} | Answers detected: ${answerMap.size} | File size: ${text.length}`);
}
