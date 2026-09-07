import * as fs from "fs";

async function main() {
  const text = fs.readFileSync("test_84774.txt", "utf8");

  // Search for the section where Paper 1 answers actually begin
  // Usually "ANSWERS" followed by "MODEL TEST PAPER 1" or similar
  const matches = [...text.matchAll(/(?:MODEL\s+TEST\s+PAPER\s+1[\s\S]{1,100}?ANSWERS|ANSWERS[\s\S]{1,100}?MODEL\s+TEST\s+PAPER\s+1)/gi)];
  console.log(`Found ${matches.length} matches`);
  for (const m of matches) {
    if (m.index! > 10000) {
      console.log(`[@${m.index}]:`);
      console.log(text.slice(m.index!, m.index! + 600).replace(/\r?\n/g, "\n"));
    }
  }
}

main().catch(console.error);
