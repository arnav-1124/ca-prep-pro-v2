import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { AIProvider, AIExplanationPayload, AIExplanationResult } from "./base";
import { getExplanationBudget } from "../config";

const DEFAULT_CANDIDATE_MODELS = [
  "google/gemini-2.5-flash",
  "meta-llama/llama-3.3-70b-instruct",
  "deepseek/deepseek-chat",
];

export class OpenRouterProvider implements AIProvider {
  name = "openrouter";
  modelName: string;

  constructor(modelName?: string) {
    this.modelName = modelName || process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash";
  }

  async generateExplanation(payload: AIExplanationPayload, abortSignal?: AbortSignal): Promise<AIExplanationResult> {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error("OPENROUTER_API_KEY is not configured.");
    }

    const openrouterInstance = createOpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey,
      headers: {
        "HTTP-Referer": "https://capreppro.com",
        "X-OpenRouter-Title": "CA Prep Pro",
      },
    });

    const prompt = this.compilePrompt(payload);
    const maxTokens = getExplanationBudget(payload);

    // Prioritize configured modelName, followed by resilient candidate models
    const modelsToTry = [
      this.modelName,
      ...DEFAULT_CANDIDATE_MODELS.filter((m) => m !== this.modelName),
    ];

    let lastError: unknown = null;

    for (const currentModel of modelsToTry) {
      if (abortSignal?.aborted) {
        throw new Error("TimeoutError: OpenRouter generation aborted due to timeout.");
      }

      try {
        const { object } = await generateObject({
          model: openrouterInstance(currentModel),
          schema: z.object({
            explanation: z.string(),
            keyPoint: z.string(),
          }),
          prompt,
          maxOutputTokens: maxTokens,
          maxRetries: 0,
          abortSignal: abortSignal || AbortSignal.timeout(10000),
        });

        return {
          explanation: object.explanation,
          keyPoint: object.keyPoint,
          provider: this.name,
          model: currentModel,
        };
      } catch (err: unknown) {
        lastError = err;
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[OpenRouter Model Warning] Model '${currentModel}' failed: "${msg}". Attempting next candidate...`);
      }
    }

    throw lastError || new Error("All OpenRouter candidate models failed.");
  }

  private compilePrompt(payload: AIExplanationPayload): string {
    const optionsText = payload.options.join("\n");
    const caseBlock = payload.caseScenarioText
      ? `Case Scenario: ${payload.caseTitle || ""}\n${payload.caseScenarioText}\n\n`
      : "";

    return `You are a helpful Chartered Accountancy (CA) tutor explaining a practice question to a student.

${caseBlock}Question:
${payload.question}

Options:
${optionsText}

Student's Selected Option: ${payload.selectedOption || "None"}
Correct Option: ${payload.correctOption}

Your task is to explain the question and why the correct option is right.
Keep the explanation clear, professional, student-focused, and target approximately 80 to 150 words.
Provide a clear structured response matching the schema.`;
  }
}
