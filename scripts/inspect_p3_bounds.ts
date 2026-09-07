import fs from "fs";

function main() {
  const txt = fs.readFileSync("test_84774.txt", "utf-8");

  console.log("=== ALL P3 MTP HEADINGS ===");
  const p3Matches = [...txt.matchAll(/MODEL TEST PAPER\s*(\d+)[\s\S]{1,250}QUANTITATIVE APTITUDE/gi)];
  for (const m of p3Matches) {
    console.log(`P3 MTP ${m[1]} at index ${m.index}: ${txt.slice(m.index, m.index + 120).replace(/\s+/g, " ")}`);
  }

  console.log("\n=== ALL P4 MTP HEADINGS ===");
  const p4Matches = [...txt.matchAll(/MODEL TEST PAPER\s*(\d+)[\s\S]{1,250}BUSINESS ECONOMICS/gi)];
  for (const m of p4Matches) {
    console.log(`P4 MTP ${m[1]} at index ${m.index}: ${txt.slice(m.index, m.index + 120).replace(/\s+/g, " ")}`);
  }
}

main();
