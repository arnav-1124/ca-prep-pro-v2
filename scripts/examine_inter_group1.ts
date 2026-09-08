import fs from "fs";
import path from "path";

function inspectLawFiles() {
  console.log("=== EXAMINING PAPER 2 LAW CHAPTERS ===");
  const dir = "ingestion/intermediate/paper_2_law";
  const files = fs.readdirSync(dir).filter(f => f.endsWith("_layout.txt"));
  for (const f of files) {
    const content = fs.readFileSync(path.join(dir, f), "utf-8");
    const hasTyk = content.includes("TEST YOUR KNOWLEDGE");
    const hasMcq = /MCQ based Questions|Multiple Choice Questions/i.test(content);
    const hasAns = /Answer to MCQ|Answers to Multiple/i.test(content);
    console.log(`  ${f}: Length ${content.length} chars | TYK: ${hasTyk} | MCQ Header: ${hasMcq} | Ans: ${hasAns}`);
  }
}

function inspectBooklet(filePath: string, name: string) {
  console.log(`\n=== EXAMINING BOOKLET: ${name} ===`);
  if (!fs.existsSync(filePath)) {
    console.log(`  File does not exist: ${filePath}`);
    return;
  }
  const content = fs.readFileSync(filePath, "utf-8");
  const caseMatches = content.match(/CASE SCENARIO\s*(\d+)?/gi) || [];
  const mcqMatches = content.match(/MULTIPLE CHOICE QUESTIONS/gi) || [];
  const ansMatches = content.match(/ANSWERS? TO (?:THE )?(?:MULTIPLE CHOICE|CASE SCENARIO)/gi) || [];
  console.log(`  Length: ${content.length} chars`);
  console.log(`  Case Scenario references: ${caseMatches.length}`);
  console.log(`  MCQ sections: ${mcqMatches.length}`);
  console.log(`  Answer sections: ${ansMatches.length}`);
}

async function main() {
  inspectLawFiles();
  inspectBooklet("ingestion/intermediate/booklets/p1_csb_layout.txt", "Paper 1 (Advanced Accounting CSB)");
  inspectBooklet("ingestion/intermediate/booklets/p2_csb_layout.txt", "Paper 2 (Corporate & Other Laws CSB)");
  inspectBooklet("ingestion/intermediate/paper_3_taxation/p3a_csb_layout.txt", "Paper 3A (Income Tax CSB)");
  inspectBooklet("ingestion/intermediate/paper_3_taxation/p3b_csb_layout.txt", "Paper 3B (GST CSB)");
}

main().catch(console.error);
