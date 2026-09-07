import * as fs from "fs";

async function main() {
  const text = fs.readFileSync("test_84774.txt", "utf8");
  // Paper 1 answers start at 832937 and end at 1216685
  const p1AnsText = text.slice(832937, 1216685);

  // Look for 1. (c) or (c) in Paper 1 answers
  const cMatches = [...p1AnsText.matchAll(/(?:^|\n)\s*(?:1\.\s*)?\(c\)([\s\S]{10,600}?)(?=(?:^|\n)\s*2\.\s*\(a\))/gi)];
  console.log(`Found ${cMatches.length} (c) answer matches in Paper 1`);
  cMatches.forEach((m, idx) => {
    console.log(`\n--- Answer #${idx + 1} ---`);
    console.log(m[1].trim().replace(/\s+/g, " ").slice(0, 300));
  });
}

main().catch(console.error);
