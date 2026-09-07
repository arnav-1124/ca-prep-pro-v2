import * as fs from "fs";

async function main() {
  const text = fs.readFileSync("test_84774.txt", "utf8");

  // Search for the start of MTP 1 for Paper 1
  const m = text.match(/PAPER\s*[-–:]\s*1\s+ACCOUNTING[\s\S]{1,500}?(?:MODEL\s+TEST\s+PAPER\s*[-–:]\s*1)/i);
  if (m) {
    const idx = m.index!;
    console.log("Matched at index:", idx);
    console.log(text.slice(idx, idx + 2500));
  } else {
    // Try finding "PAPER - 1" after the contents page
    const idx = text.indexOf("PAPER - 1", 3000);
    console.log("Found after 3000 at:", idx);
    console.log(text.slice(idx, idx + 2500));
  }
}

main().catch(console.error);
