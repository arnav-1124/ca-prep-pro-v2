import fs from "fs";
import { execSync } from "child_process";

function main() {
  // Extract pages 790 to 820 with pdftotext
  execSync("pdftotext -f 790 -l 820 test_84774.pdf test_answers_all.txt");
  const raw = fs.readFileSync("test_answers_all.txt", "utf-8");

  // The file has separate sections for each MTP
  // Let's split by "MODEL TEST PAPER"
  const sections = raw.split(/MODEL TEST PAPER\s*/gi);
  console.log(`Total sections found: ${sections.length}`);

  const p3Ans: Record<number, Map<number, string>> = {};
  const p4Ans: Record<number, Map<number, string>> = {};

  for (let i = 1; i < sections.length; i++) {
    const sec = sections[i];
    const headerMatch = sec.match(/^(\d+)\s*[\s\S]*?(QUANTITATIVE APTITUDE|BUSINESS ECONOMICS)/i);
    if (!headerMatch) continue;

    const mtpNum = parseInt(headerMatch[1], 10);
    const subject = headerMatch[2].toUpperCase().includes("QUANTITATIVE") ? "P3" : "P4";

    // Extract all tokens like "1 (b)" or "1\n(b)" or "4 (c) 9 (d)"
    // Using regex matching any number 1-100 followed by (letter)
    const map = new Map<number, string>();
    const tokenRegex = /(\d{1,3})\s*\(([a-d])\)/gi;
    let m: RegExpExecArray | null;
    while ((m = tokenRegex.exec(sec)) !== null) {
      const qNum = parseInt(m[1], 10);
      if (qNum >= 1 && qNum <= 100) {
        map.set(qNum, m[2].toUpperCase());
      }
    }

    if (subject === "P3") {
      p3Ans[mtpNum] = map;
    } else {
      p4Ans[mtpNum] = map;
    }

    console.log(`${subject} MTP ${mtpNum}: extracted ${map.size} answers`);
    if (map.size < 100) {
      const missing: number[] = [];
      for (let q = 1; q <= 100; q++) {
        if (!map.has(q)) missing.push(q);
      }
      console.log(`  Missing in ${subject} MTP ${mtpNum}:`, missing);
    }
  }
}

main();
