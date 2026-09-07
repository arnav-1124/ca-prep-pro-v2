import { db } from "../src/db";
import { caseStudies } from "../src/db/schema";

async function main() {
  const allCs = await db.select().from(caseStudies).limit(10);
  console.log(`Inspecting first 10 of ${allCs.length} Case Studies in DB:`);
  for (const cs of allCs) {
    console.log(`\n========================================`);
    console.log(`ID: ${cs.id}`);
    console.log(`Title: ${cs.title}`);
    console.log(`Scenario snippet (first 300 chars):`);
    console.log(JSON.stringify(cs.scenarioText.slice(0, 300)));
  }
}

main().catch(console.error);
