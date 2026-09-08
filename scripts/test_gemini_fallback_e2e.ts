import { GeminiProvider } from "../src/domains/ai/providers/gemini";
import { OpenRouterProvider } from "../src/domains/ai/providers/openrouter";

async function testDirectOpenRouter() {
  console.log("\n--- TEST 1: Direct OpenRouterProvider generation ---");
  const provider = new OpenRouterProvider();
  const payload = {
    question: "Which accounting standard deals with Accounting for Taxes on Income in India?",
    options: [
      "A: AS 18",
      "B: AS 22",
      "C: AS 10",
      "D: AS 2"
    ],
    selectedOption: "A",
    correctOption: "B",
  };

  try {
    const res = await provider.generateExplanation(payload);
    console.log("✅ OpenRouter succeeded!");
    console.log("Provider:", res.provider);
    console.log("Model:", res.model);
    console.log("Explanation:", res.explanation.substring(0, 100) + "...");
    console.log("Key Point:", res.keyPoint);
    return true;
  } catch (err: any) {
    console.error("❌ OpenRouter failed:", err.message);
    return false;
  }
}

async function testGeminiFallbackSimulation() {
  console.log("\n--- TEST 2: Primary Gemini -> Secondary OpenRouter Fallback Simulation ---");
  const gemini = new GeminiProvider();
  const openrouter = new OpenRouterProvider();

  const payload = {
    question: "Under the Companies Act, 2013, what is the minimum number of directors required for a public company?",
    options: [
      "A: 1",
      "B: 2",
      "C: 3",
      "D: 7"
    ],
    selectedOption: "B",
    correctOption: "C",
  };

  let finalResult;
  let activeProvider = gemini.name;
  let activeModel = gemini.modelName;

  try {
    console.log(`Attempting primary '${activeProvider}' (${activeModel})...`);
    finalResult = await gemini.generateExplanation(payload);
    console.log("Primary succeeded unexpectedly.");
  } catch (err: any) {
    console.warn(`[Primary Failed as expected] error="${err.message}". Executing fallback to '${openrouter.name}'...`);
    activeProvider = openrouter.name;
    activeModel = openrouter.modelName;
    finalResult = await openrouter.generateExplanation(payload);
    console.log("✅ Fallback succeeded!");
    console.log("Provider:", finalResult.provider);
    console.log("Model:", finalResult.model);
    console.log("Explanation:", finalResult.explanation.substring(0, 100) + "...");
    console.log("Key Point:", finalResult.keyPoint);
  }
  return true;
}

async function main() {
  const t1 = await testDirectOpenRouter();
  const t2 = await testGeminiFallbackSimulation();
  if (t1 && t2) {
    console.log("\n🎉 ALL AI TESTS PASSED SUCCESSFULLY!");
  } else {
    console.error("\n❌ TESTS FAILED");
    process.exit(1);
  }
}

main();
