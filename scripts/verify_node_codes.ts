import fs from "fs";
import path from "path";
import { db } from "../src/db";
import { curriculumNodes } from "../src/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  const interVerId = "76a04841-fd13-45c9-a598-7eeb3994115d";
  const dbNodes = await db
    .select({ code: curriculumNodes.code })
    .from(curriculumNodes)
    .where(eq(curriculumNodes.curriculumVersionId, interVerId));

  const nodeSet = new Set(dbNodes.map((n) => n.code));
  console.log("Database nodes for Intermediate:", nodeSet.size);
  console.log("Sample P2 nodes in Neon:", Array.from(nodeSet).filter(c => c?.includes("P2_MOD2")));

  const batchFiles = [
    "intermediate_sm_p1_accounting.json",
    "intermediate_sm_p2_law.json",
    "intermediate_sm_p3_taxation.json",
    "intermediate_sm_p4_costing.json",
    "intermediate_sm_p5_auditing.json",
    "intermediate_sm_p6_fmsm.json",
  ];

  let allValid = true;
  for (const bf of batchFiles) {
    const fPath = path.join(__dirname, "../ingestion/batches", bf);
    const data = JSON.parse(fs.readFileSync(fPath, "utf-8"));
    const missing = new Set<string>();
    for (const q of data.questions) {
      if (!nodeSet.has(q.nodeCode)) {
        missing.add(q.nodeCode);
      }
    }
    if (missing.size > 0) {
      console.error(bf, "has missing nodes:", Array.from(missing));
      allValid = false;
    } else {
      console.log(bf, `OK! All ${data.questions.length} question node codes exist in Neon.`);
    }
  }

  if (!allValid) {
    console.error("Some node codes are missing in Neon!");
    process.exit(1);
  }
  console.log("\nALL 6 BATCHES NODE CODES 100% VALID IN NEON DB!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
