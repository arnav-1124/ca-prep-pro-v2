import fs from "fs";

function testParseQuestions(text: string, paperNum: number, mtpNum: number) {
  // Regex for question boundary: a line starting with number and dot/parenthesis, e.g. "1. " or "100. "
  // followed by question text, then options (a), (b), (c), (d)
  
  // Split into candidate questions using regex matching `\n\s*(\d{1,3})\.\s+`
  const qMatches = [...text.matchAll(/\n\s*(\d{1,3})\.\s+([\s\S]*?)(?=\n\s*\d{1,3}\.\s+|$)/g)];
  console.log(`\n=== P${paperNum} MTP ${mtpNum}: Found ${qMatches.length} raw questions ===`);

  let validCount = 0;
  for (const qm of qMatches) {
    const qNum = parseInt(qm[1], 10);
    const body = qm[2].trim();

    // Option extractor: (a) ... (b) ... (c) ... (d) ...
    // Note that options can be on separate lines or on same lines
    const optRegex = /\(([a-d])\)\s*([\s\S]*?)(?=\([a-d]\)|$)/gi;
    const opts: { letter: string; text: string }[] = [];
    
    // Find where the first option begins
    const firstOptIndex = body.search(/\([a-d]\)/i);
    let stem = body;
    if (firstOptIndex !== -1) {
      stem = body.slice(0, firstOptIndex).trim();
      const optsSection = body.slice(firstOptIndex);
      let optMatch: RegExpExecArray | null;
      while ((optMatch = optRegex.exec(optsSection)) !== null) {
        opts.push({
          letter: optMatch[1].toUpperCase(),
          text: optMatch[2].replace(/\s+/g, " ").trim()
        });
      }
    }

    if (opts.length >= 2 && stem.length >= 10) {
      validCount++;
    } else {
      if (qNum <= 10 || qNum >= 95) {
        console.log(`Issue with Q${qNum}: opts length = ${opts.length}, stem len = ${stem.length}`);
        console.log(`  Body: ${body.slice(0, 150).replace(/\s+/g, " ")}`);
      }
    }
  }

  console.log(`Valid questions parsed: ${validCount} / ${qMatches.length}`);
}

function parseAnswers(text: string): Map<number, string> {
  const ansMap = new Map<number, string>();
  // Answers format: "1. (d) 2. (d)" or "1 (a) 2 (a)" or "1. (c)"
  const ansRegex = /(\d{1,3})\.?\s*\(([a-d])\)/gi;
  let m: RegExpExecArray | null;
  while ((m = ansRegex.exec(text)) !== null) {
    ansMap.set(parseInt(m[1], 10), m[2].toUpperCase());
  }
  return ansMap;
}

function main() {
  const txt = fs.readFileSync("test_84774.txt", "utf-8");

  // Test P3 MTP 1
  const p3Mtp1Text = txt.slice(323052, 348089);
  testParseQuestions(p3Mtp1Text, 3, 1);

  // Test P3 MTP 1 Answers
  const p3Mtp1Ans = txt.slice(1639129, 1640336);
  const p3AnsMap = parseAnswers(p3Mtp1Ans);
  console.log(`P3 MTP 1 Answers count: ${p3AnsMap.size}`);
  console.log(`  Sample: Q1 -> ${p3AnsMap.get(1)}, Q50 -> ${p3AnsMap.get(50)}, Q100 -> ${p3AnsMap.get(100)}`);

  // Test P4 MTP 1
  const p4Mtp1Text = txt.slice(563685, 591539);
  testParseQuestions(p4Mtp1Text, 4, 1);

  // Test P4 MTP 1 Answers
  const p4Mtp1Ans = txt.slice(1653646, 1654679);
  const p4AnsMap = parseAnswers(p4Mtp1Ans);
  console.log(`P4 MTP 1 Answers count: ${p4AnsMap.size}`);
  console.log(`  Sample: Q1 -> ${p4AnsMap.get(1)}, Q50 -> ${p4AnsMap.get(50)}, Q100 -> ${p4AnsMap.get(100)}`);
}

main();
