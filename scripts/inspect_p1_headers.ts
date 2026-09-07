import fs from "fs";
import path from "path";

const p1Dir = path.join(__dirname, "../ingestion/foundation/paper_1_accounting");
for (const f of ["ch1u7_layout.txt", "ch7u1_layout.txt"]) {
  const text = fs.readFileSync(path.join(p1Dir, f), "utf-8");
  const idx = text.search(/Multiple Choice Question/i);
  console.log(`\n=== ${f} ===`);
  console.log(text.substring(idx, idx + 1500));
}
