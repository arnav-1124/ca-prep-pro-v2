import fs from "fs";
import path from "path";
import { validateImportBatch } from "../src/domains/questions/import/validation";

function testBatch(filePath: string) {
  const fullPath = path.resolve(filePath);
  console.log(`\n================ Validating: ${path.basename(fullPath)} ================`);
  const raw = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
  const res = validateImportBatch(raw);
  console.log(`  Valid: ${res.isValid}`);
  console.log(`  Total questions: ${res.totalQuestions}`);
  console.log(`  Valid count: ${res.validCount}`);
  console.log(`  Invalid count: ${res.invalidCount}`);
  if (res.batchErrors.length > 0) {
    console.log(`  Batch errors:`, res.batchErrors);
  }
  if (res.invalidCount > 0) {
    const invalidSamples = res.questionResults.filter(q => !q.isValid).slice(0, 3);
    console.log(`  Sample invalid errors:`, JSON.stringify(invalidSamples, null, 2));
  }
}

function main() {
  const batches = [
    "ingestion/batches/mtp/foundation_mtp_2025_p1_accounting.json",
    "ingestion/batches/mtp/foundation_mtp_2025_p3_part1.json",
    "ingestion/batches/mtp/foundation_mtp_2025_p3_part2.json",
    "ingestion/batches/mtp/foundation_mtp_2025_p4_part1.json",
    "ingestion/batches/mtp/foundation_mtp_2025_p4_part2.json"
  ];

  for (const b of batches) {
    testBatch(b);
  }
}

main();
