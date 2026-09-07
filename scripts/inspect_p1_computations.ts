import * as fs from "fs";

async function main() {
  const text = fs.readFileSync("test_84774.txt", "utf8");
  const p1Text = text.slice(0, 300000);

  const q1cMatches = [...p1Text.matchAll(/\(c\)([\s\S]{10,900}?)(?=(?:\(\d+\+\d+\+\d+\s*=|\b2\.\s*\(a\)))/gi)];
  console.log(`Found ${q1cMatches.length} (c) subparts in Paper 1`);
  q1cMatches.forEach((m, idx) => {
    console.log(`\n--- Item #${idx + 1} ---`);
    console.log(m[1].trim().replace(/\s+/g, " ").slice(0, 350));
  });
}

main().catch(console.error);
