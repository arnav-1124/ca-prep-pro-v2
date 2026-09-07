import { OpenRouterProvider } from "../src/domains/ai/providers/openrouter";

async function main() {
  const provider = new OpenRouterProvider();
  console.log("Testing provider:", provider.name, "Model:", provider.modelName);

  const res = await provider.generateExplanation({
    question: "Accounting Standards for non-corporate entities in India are issued by the Central Government. True or False?",
    options: ["A. True", "B. False"],
    correctAnswer: "B",
    explanation: "Accounting Standards for non-corporate entities in India are issued by the Institute of Chartered Accountants of India (ICAI), not by the Central Government.",
    difficulty: "EASY",
    subjectName: "Accounting",
    topicName: "Accounting Standards",
  });

  console.log("\nExplanation Result:\n", JSON.stringify(res, null, 2));
}

main().catch(console.error);
