import fs from "fs";

function main() {
  const txt = fs.readFileSync("test_84774.txt", "utf-8");

  console.log("=== PAPER 1 MTP HEADINGS ===");
  for (let i = 1; i <= 10; i++) {
    const p1Pattern = new RegExp(`MODEL TEST PAPER\\s*${i}[\\s\\S]{1,200}ACCOUNTING`, "gi");
    let match: RegExpExecArray | null;
    while ((match = p1Pattern.exec(txt)) !== null) {
      if (match.index < 300000) { // before Paper 2
        console.log(`\n--- Paper 1 MTP ${i} at pos ${match.index} ---`);
        console.log(txt.slice(match.index, match.index + 500).replace(/\s+/g, " "));
      }
    }
  }

  console.log("\n=== PAPER 2 MTP HEADINGS ===");
  for (let i = 1; i <= 10; i++) {
    const p2Pattern = new RegExp(`MODEL TEST PAPER\\s*${i}[\\s\\S]{1,200}BUSINESS LAWS`, "gi");
    let match: RegExpExecArray | null;
    while ((match = p2Pattern.exec(txt)) !== null) {
      if (match.index < 350000) { // before Paper 3
        console.log(`\n--- Paper 2 MTP ${i} at pos ${match.index} ---`);
        console.log(txt.slice(match.index, match.index + 500).replace(/\s+/g, " "));
      }
    }
  }
}

main();
