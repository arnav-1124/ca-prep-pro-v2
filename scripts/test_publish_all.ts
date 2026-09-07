import { publishAllApprovedBatches } from "../src/domains/questions/import/services";

async function main() {
  console.log("=== PUBLISHING ALL APPROVED BATCHES TO LIVE QUESTION BANK ===");
  const result = await publishAllApprovedBatches("admin@caprep.pro");
  console.log("Publish result:", result);
}

main().catch(console.error);
