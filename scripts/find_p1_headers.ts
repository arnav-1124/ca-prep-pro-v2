import * as fs from "fs";

async function main() {
  const text = fs.readFileSync("test_84774.txt", "utf8");

  // Search for Paper 1
  const matches = [...text.matchAll(/(?:MODEL\s+TEST\s+PAPER|PAPER\s*[-–:]\s*1)/gi)];
  console.log(`Found ${matches.length} matches for Paper 1 / MTP headers`);
  for (const m of matches.slice(0, 10)) {
    const idx = m.index!;
    const snippet = text.slice(idx, idx + 120).replace(/\s+/g, " ");
    console.log(`[@${idx}]: ${snippet}`);
  }
}

main().catch(console.error);
