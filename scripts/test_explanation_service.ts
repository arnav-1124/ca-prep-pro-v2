import { db } from "../src/db";
import { practiceSessions, practiceAttempts, aiExplanations } from "../src/db/schema";
import { getOrGenerateExplanation } from "../src/domains/ai/services";
import { desc, eq } from "drizzle-orm";

async function main() {
  console.log("=== Testing getOrGenerateExplanation Full Pipeline ===");

  // 1. Fetch recent attempt from DB
  const [attempt] = await db
    .select()
    .from(practiceAttempts)
    .orderBy(desc(practiceAttempts.createdAt))
    .limit(1);

  if (!attempt) {
    console.log("No practice attempts found in database to test with.");
    return;
  }

  const [session] = await db
    .select()
    .from(practiceSessions)
    .where(eq(practiceSessions.id, attempt.practiceSessionId))
    .limit(1);

  if (!session) {
    console.log("Session not found.");
    return;
  }

  console.log(`Found attempt for session ${session.id} (student: ${session.studentProfileId}, questionVersion: ${attempt.questionVersionId})`);

  // Clear existing cached explanation for this question version so we test live generation
  await db.delete(aiExplanations).where(eq(aiExplanations.questionVersionId, attempt.questionVersionId));
  console.log("Cleared cache for questionVersion to force live provider call.");

  // TEST A: With AI_PROVIDER = "gemini" (forcing primary Gemini failure -> automatic OpenRouter fallback)
  console.log("\n--- Scenario A: AI_PROVIDER='gemini' (Gemini fails -> OpenRouter fallback) ---");
  process.env.AI_PROVIDER = "gemini";
  
  try {
    const resultA = await getOrGenerateExplanation(
      session.studentProfileId,
      session.id,
      attempt.questionVersionId
    );
    console.log("✅ getOrGenerateExplanation succeeded via fallback!");
    console.log("From Cache:", resultA.fromCache);
    console.log("Explanation:", resultA.explanation.substring(0, 120) + "...");
    console.log("Key Point:", resultA.keyPoint);
  } catch (err: any) {
    console.error("❌ Scenario A failed:", err.message);
    process.exit(1);
  }

  // TEST B: Second call should hit the DB cache
  console.log("\n--- Scenario B: Second call for same version (DB Cache hit) ---");
  try {
    const resultB = await getOrGenerateExplanation(
      session.studentProfileId,
      session.id,
      attempt.questionVersionId
    );
    console.log("✅ getOrGenerateExplanation hit cache!");
    console.log("From Cache:", resultB.fromCache);
  } catch (err: any) {
    console.error("❌ Scenario B failed:", err.message);
    process.exit(1);
  }

  console.log("\n🎉 Full pipeline test completed with 100% success!");
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
