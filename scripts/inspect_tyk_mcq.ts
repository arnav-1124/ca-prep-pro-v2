import fs from "fs";
import path from "path";

function inspectMCQ(filePath: string) {
  console.log(`\n================== ${path.basename(filePath)} ==================`);
  const text = fs.readFileSync(filePath, "utf-8");
  const mcqIdx = text.search(/Multiple Choice Questions/i);
  if (mcqIdx === -1) {
    console.log("No MCQ section found");
    return;
  }
  const snippet = text.substring(mcqIdx, Math.min(text.length, mcqIdx + 2500));
  console.log(snippet);
}

inspectMCQ(path.join(__dirname, "../ingestion/foundation/paper_2_laws/ch1_layout.txt"));
inspectMCQ(path.join(__dirname, "../ingestion/foundation/paper_2_laws/ch2u1_layout.txt"));
inspectMCQ(path.join(__dirname, "../ingestion/foundation/paper_1_accounting/ch1u3_layout.txt"));
