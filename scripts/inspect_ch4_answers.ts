import fs from "fs";
import path from "path";

const p = path.join(__dirname, "../ingestion/foundation/paper_3_quant/ch4_layout.txt");
const text = fs.readFileSync(p, "utf-8");

const exMatches = [...text.matchAll(/Exercise\s*4\s*\(([a-zA-Z])\)/gi)];
console.log("Exercise matches in ch4:");
for (const m of exMatches) {
  console.log(`Exercise 4(${m[1]}) at index ${m.index}`);
  const snippetAfter = text.substring(m.index!, Math.min(text.length, m.index! + 300)).replace(/\n/g, " ");
  console.log(`  Snippet: ${snippetAfter}`);
}
