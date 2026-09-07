import fs from "fs";
import path from "path";

function inspectDir(dirName: string, label: string) {
  console.log(`\n================== ${label} ==================`);
  const fullDir = path.join(__dirname, "../ingestion/foundation", dirName);
  const files = fs.readdirSync(fullDir).filter(f => f.endsWith("_layout.txt"));

  for (const f of files) {
    const text = fs.readFileSync(path.join(fullDir, f), "utf-8");
    
    // Look for "Multiple Choice Questions" or "Test Your Knowledge"
    const hasTYK = /TEST YOUR KNOWLEDGE/i.test(text);
    const hasMCQ = /Multiple Choice Questions/i.test(text);

    // Count possible answer markers
    const answersIdx = Math.max(text.lastIndexOf("ANSWERS"), text.lastIndexOf("Answers"));
    let answerCount = 0;
    if (answersIdx !== -1) {
      const ansSnippet = text.substring(answersIdx);
      const m = ansSnippet.match(/(\d+)[\.\s\)]+\(?([a-d])\)?/gi);
      answerCount = m ? m.length : 0;
    }

    console.log(`- ${f.padEnd(20)} | TYK: ${hasTYK ? "YES" : "NO "} | MCQ: ${hasMCQ ? "YES" : "NO "} | AnsKey: ${answerCount} answers`);
  }
}

inspectDir("paper_2_laws", "PAPER 2: BUSINESS LAWS");
inspectDir("paper_1_accounting", "PAPER 1: ACCOUNTING");
