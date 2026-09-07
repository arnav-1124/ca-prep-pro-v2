import fs from "fs";

function main() {
  const txt = fs.readFileSync("test_84774.txt", "utf-8");
  const p3Mtp1 = txt.slice(323052, 348089);

  // Check which question numbers from 1 to 100 appear
  const foundP3 = new Set<number>();
  const p3Matches = [...p3Mtp1.matchAll(/(?:^|\n)\s*(\d{1,3})\.\s+/g)];
  for (const m of p3Matches) {
    foundP3.add(parseInt(m[1], 10));
  }
  console.log(`P3 MTP 1 found ${foundP3.size} distinct question numbers.`);
  for (let i = 1; i <= 100; i++) {
    if (!foundP3.has(i)) {
      console.log(`  P3 MTP 1 missing question: ${i}`);
    }
  }

  const p4Mtp1 = txt.slice(563685, 591539);
  const foundP4 = new Set<number>();
  const p4Matches = [...p4Mtp1.matchAll(/(?:^|\n)\s*(\d{1,3})\.\s+/g)];
  for (const m of p4Matches) {
    foundP4.add(parseInt(m[1], 10));
  }
  console.log(`P4 MTP 1 found ${foundP4.size} distinct question numbers.`);
  for (let i = 1; i <= 100; i++) {
    if (!foundP4.has(i)) {
      console.log(`  P4 MTP 1 missing question: ${i}`);
    }
  }
}

main();
