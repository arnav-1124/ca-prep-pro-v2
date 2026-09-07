import fs from "fs";

interface TrueFalseItem {
  mtpNum: number;
  subNum: number;
  statement: string;
  answer?: string; // "A" (True) or "B" (False)
  explanation?: string;
  chapterCode?: string;
}

function extractP1TrueFalse() {
  const txt = fs.readFileSync("test_84774.txt", "utf-8");

  // In Paper 1, Question 1(a) in each MTP has True/False statements
  // Let's find all occurrences of "State with reasons whether the following statements are True or False"
  const qMatches = [...txt.matchAll(/State with reasons[,\s]+whether the following statements are\s*(?:true or false|True or False):([\s\S]*?)(?=\(b\)|\(B\)|2\.\s*\(a\)|Question No\.|MODEL TEST PAPER|$)/gi)];
  console.log(`Found ${qMatches.length} True/False question blocks in text`);

  const items: TrueFalseItem[] = [];

  for (let mIdx = 0; mIdx < qMatches.length && mIdx < 10; mIdx++) {
    const block = qMatches[mIdx][1];
    // Split into sub-items: (i), (ii), (iii), (iv), (v), (vi) or 1., 2., 3.
    const subMatches = [...block.matchAll(/(?:\(([ivx]+)\)|(\d+)\.)\s+([\s\S]*?)(?=(?:\([ivx]+\)|\d+\.)|$)/gi)];
    for (let sIdx = 0; sIdx < subMatches.length; sIdx++) {
      const stmt = subMatches[sIdx][3].replace(/\s+/g, " ").trim();
      if (stmt.length > 15) {
        items.push({
          mtpNum: mIdx + 1,
          subNum: sIdx + 1,
          statement: stmt
        });
      }
    }
  }

  console.log(`Extracted ${items.length} total True/False statements from MTP 1-10`);
  for (const it of items.slice(0, 6)) {
    console.log(`MTP ${it.mtpNum} Q1(a)(${it.subNum}): ${it.statement}`);
  }

  // Also extract from May 2025 Series II (mtp_sample_test.txt)
  if (fs.existsSync("mtp_sample_test.txt")) {
    const s2Txt = fs.readFileSync("mtp_sample_test.txt", "utf-8");
    const s2Match = s2Txt.match(/State with reasons[,\s]+whether the following statements are\s*(?:true or false|True or False):([\s\S]*?)(?=\(b\)|\(B\)|2\.\s*\(a\)|$)/i);
    if (s2Match) {
      const subMatches = [...s2Match[1].matchAll(/(?:\(([ivx]+)\)|(\d+)\.)\s+([\s\S]*?)(?=(?:\([ivx]+\)|\d+\.)|$)/gi)];
      console.log(`\nMay 2025 Series II Paper 1: found ${subMatches.length} True/False statements`);
      for (let sIdx = 0; sIdx < subMatches.length; sIdx++) {
        const stmt = subMatches[sIdx][3].replace(/\s+/g, " ").trim();
        if (stmt.length > 15) {
          items.push({
            mtpNum: 2025, // Series II May 2025
            subNum: sIdx + 1,
            statement: stmt
          });
          console.log(`  Series II Q1(a)(${sIdx + 1}): ${stmt}`);
        }
      }
    }
  }

  return items;
}

extractP1TrueFalse();
