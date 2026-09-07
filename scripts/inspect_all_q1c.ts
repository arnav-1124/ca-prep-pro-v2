import * as fs from "fs";

async function main() {
  const text = fs.readFileSync("test_84774.txt", "utf8");
  // Paper 1 questions: 0 to 250000
  // Paper 1 answers: 832937 to 1216685

  for (let mtp = 1; mtp <= 10; mtp++) {
    // Search for MTP mtp header
    const mtpRegex = new RegExp(`MODEL\\s+TEST\\s+PAPER\\s+${mtp}[\\s\\S]{1,200}?ACCOUNTING`, "i");
    const m = text.match(mtpRegex);
    if (!m) continue;
    const qSection = text.slice(m.index!, m.index! + 30000);
    // Find Q1(c)
    const cMatch = qSection.match(/\(c\)([\s\S]{10,1200}?)(?=(?:\(\d+\+\d+\+\d+\s*=|\b2\.\s*\(a\)))/i);
    console.log(`\n================ MTP ${mtp} Q1(c) ================`);
    if (cMatch) {
      console.log(cMatch[1].trim().replace(/\s+/g, " "));
    } else {
      console.log("Q1(c) not found with regex");
    }
  }
}

main().catch(console.error);
