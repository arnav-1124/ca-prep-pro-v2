import { db } from "../src/db";
import { questionOptions } from "../src/db/schema";
import { eq } from "drizzle-orm";
import { withRetry } from "../src/domains/questions/import/services";

async function main() {
  const econOpts = await withRetry(() =>
    db.select().from(questionOptions).where(eq(questionOptions.questionVersionId, "dbd167d5-e93b-4213-b141-863e1d966122"))
  );
  console.log("Econ live options:", econOpts.map((o) => ({ letter: o.optionLetter, text: o.optionText })));

  const mathOpts = await withRetry(() =>
    db.select().from(questionOptions).where(eq(questionOptions.questionVersionId, "577bc039-810d-46ce-b610-4cb7f11b53a1"))
  );
  console.log("Math live options:", mathOpts.map((o) => ({ letter: o.optionLetter, text: o.optionText })));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
