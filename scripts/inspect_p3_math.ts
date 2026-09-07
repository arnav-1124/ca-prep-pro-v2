import fs from "fs";
import path from "path";

const dir = path.join(__dirname, "../ingestion/foundation/paper_3_quant");
const files = ["ch1_layout.txt", "ch2_layout.txt", "ch3_layout.txt", "ch4_layout.txt", "ch5_layout.txt", "ch6_layout.txt", "ch7_layout.txt", "ch8u2_layout.txt"];

for (const f of files) {
  const p = path.join(dir, f);
  const text = fs.readFileSync(p, "utf-8");
  console.log(`\n=== File: ${f} (${text.length} chars) ===`);

  // Search for anything like "Answer" or "Answers" or "Key"
  const matches = [...text.matchAll(/(?:exercise|answer|solutions?)/gi)];
  const keywords = matches.map(m => m[0]);
  const uniqueKeywords = [...new Set(keywords.map(k => k.toUpperCase()))];
  console.log("  Keywords found:", uniqueKeywords);

  // Look at last 1000 characters of the file
  const endSlice = text.substring(Math.max(0, text.length - 800));
  console.log("  End of file preview:\n" + endSlice.split("\n").filter(l => l.trim()).slice(-8).join("\n"));
}
