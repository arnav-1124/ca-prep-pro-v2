import * as fs from "fs";

async function main() {
  const text = fs.readFileSync("test_84774.txt", "utf8");
  console.log("Total text length:", text.length);

  // Look for occurrences of case-related keywords across the text
  const keywords = [
    "case scenario",
    "case study",
    "case based",
    "read the following",
    "common data for questions",
    "based on the above information",
  ];

  for (const kw of keywords) {
    const regex = new RegExp(kw.replace(/\s+/g, "\\s+"), "gi");
    const matches = [...text.matchAll(regex)];
    console.log(`\n=== Keyword: "${kw}" (Found: ${matches.length}) ===`);
    for (const m of matches.slice(0, 8)) {
      const idx = m.index!;
      const snippet = text
        .slice(Math.max(0, idx - 80), Math.min(text.length, idx + 180))
        .replace(/\s+/g, " ");
      console.log(`  [@${idx}]: ${snippet}`);
    }
  }

  // Check Paper 1 Questions structure
  console.log("\n=== Checking Paper 1 (Accounting) Outline ===");
  const p1Start = text.indexOf("PAPER – 1: ACCOUNTING");
  console.log("Paper 1 first occurrence at:", p1Start);
  if (p1Start !== -1) {
    const p1Snippet = text.slice(p1Start, p1Start + 1500).replace(/\r?\n/g, "\n");
    console.log("P1 Header snippet:\n", p1Snippet);
  }
}

main().catch(console.error);
