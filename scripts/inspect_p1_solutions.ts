import * as fs from "fs";

async function main() {
  const text = fs.readFileSync("test_84774.txt", "utf8");

  // Let's find "ANSWERS" for Paper 1
  const m = text.match(/(?:SUGGESTED\s+ANSWERS|ANSWERS)[\s\S]{1,200}?PAPER\s*[-–:]\s*1/i);
  if (m) {
    const idx = m.index!;
    console.log("Answers header matched at:", idx);
    console.log(text.slice(idx, idx + 2000));
  } else {
    // Search for "485" or "Model Test Papers 1" in answers
    const idx = text.indexOf("MODEL TEST PAPER 1", 700000);
    console.log("Found at >700k:", idx);
    if (idx !== -1) {
      console.log(text.slice(idx, idx + 2000));
    }
  }
}

main().catch(console.error);
