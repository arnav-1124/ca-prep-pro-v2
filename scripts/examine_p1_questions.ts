import * as fs from "fs";

async function main() {
  const text = fs.readFileSync("test_84774.txt", "utf8");
  const m = text.match(/MODEL\s+TEST\s+PAPER\s+1[\s\S]{1,200}?FOUNDATION\s+COURSE[\s\S]{1,200}?ACCOUNTING/i);
  if (!m) {
    console.log("No match found");
    return;
  }
  const idx = m.index!;
  console.log("Found at:", idx);
  console.log(text.slice(idx, idx + 8000));
}

main().catch(console.error);
