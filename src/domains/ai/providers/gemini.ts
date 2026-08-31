import { createGoogle } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import { AIProvider, AIExplanationPayload, AIExplanationResult } from "./base";
import { getExplanationBudget } from "../config";

export class GeminiProvider implements AIProvider {
  name = "gemini";
  modelName: string;

  constructor(modelName?: string) {
    this.modelName = modelName || process.env.GEMINI_MODEL || "gemini-3.6-flash";
  }

  async generateExplanation(payload: AIExplanationPayload, abortSignal?: AbortSignal): Promise<AIExplanationResult> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured.");
    }

    const googleInstance = createGoogle({
      apiKey,
    });

    const prompt = this.compilePrompt(payload);
    const maxTokens = getExplanationBudget(payload);

    const { object } = await generateObject({
      model: googleInstance(this.modelName),
      schema: z.object({
        explanation: z.string(),
        keyPoint: z.string(),
      }),
      prompt,
      maxOutputTokens: maxTokens,
      maxRetries: 0,
      abortSignal: abortSignal || AbortSignal.timeout(8000),
    });

    return {
      explanation: object.explanation,
      keyPoint: object.keyPoint,
    };
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
