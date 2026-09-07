import fs from "fs";

function diagnosePaper(text: string, paperNum: number, mtpNum: number) {
  // Check which numbers from 1 to 100 are found by line starting with number
  const foundNums = new Set<number>();
  const lineRegex = /(?:^|\n)\s*(\d{1,3})[.\s]\s+([^\n]+)/g;
  let m: RegExpExecArray | null;
  while ((m = lineRegex.exec(text)) !== null) {
    const n = parseInt(m[1], 10);
    if (n >= 1 && n <= 100) {
      foundNums.add(n);
    }
  }

  const missing: number[] = [];
  for (let i = 1; i <= 100; i++) {
    if (!foundNums.has(i)) missing.push(i);
  }

  if (missing.length > 0) {
    console.log(`P${paperNum} MTP ${mtpNum} raw missing question starts (${missing.length}):`, missing.slice(0, 10));
    for (const miss of missing.slice(0, 3)) {
      // Find where miss appears in the text
      const searchStr = `${miss}`;
      let pos = 0;
      let count = 0;
      while ((pos = text.indexOf(searchStr, pos)) !== null && pos !== -1 && count < 3) {
        // Check if preceding char is newline or space
        const pre = pos > 0 ? text[pos - 1] : "\n";
        const post = pos + searchStr.length < text.length ? text[pos + searchStr.length] : "";
        if ((pre === "\n" || pre === " ") && (post === "." || post === " " || post === ")")) {
          console.log(`  Context around "${miss}" at pos ${pos}:`);
          console.log(`  "${text.slice(Math.max(0, pos - 40), Math.min(text.length, pos + 100)).replace(/\s+/g, " ")}"`);
          break;
        }
        pos += searchStr.length;
        count++;
      }
    }
  }
}

function main() {
  const txt = fs.readFileSync("test_84774.txt", "utf-8");

  const p3Starts = [323052, 348089, 372164, 396284, 416736, 440079, 464534, 490111, 513441, 542571];
  const p3Ends = [348089, 372164, 396284, 416736, 440079, 464534, 490111, 513441, 542571, 563685];

  console.log("=== DIAGNOSING PAPER 3 ===");
  for (let i = 0; i < 10; i++) {
    diagnosePaper(txt.slice(p3Starts[i], p3Ends[i]), 3, i + 1);
  }

  const p4Starts = [563685, 591539, 615451, 642093, 665640, 691770, 715589, 741681, 773925, 805650];
  const p4Ends = [591539, 615451, 642093, 665640, 691770, 715589, 741681, 773925, 805650, 838000];

  console.log("\n=== DIAGNOSING PAPER 4 ===");
  for (let i = 0; i < 10; i++) {
    diagnosePaper(txt.slice(p4Starts[i], p4Ends[i]), 4, i + 1);
  }
}

main();
