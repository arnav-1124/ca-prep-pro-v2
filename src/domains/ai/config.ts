import { AIExplanationPayload } from "./providers/base";

/**
 * Server-side central AI Configuration for Explanation Generation Budgets.
 * These settings control max output token ceilings to prevent pathological provider request charges.
 */
export const AI_CONFIG = {
  // Hard maximum output limit ceiling (exactly 10,000 tokens) locked by v1 output policy
  explanationMaxOutputTokens: parseInt(process.env.AI_EXPLANATION_MAX_OUTPUT_TOKENS || "10000", 10),

  // Centralized configurations for each complexity category
  budgets: {
    SIMPLE: parseInt(process.env.AI_BUDGET_SIMPLE || "10000", 10),
    STANDARD: parseInt(process.env.AI_BUDGET_STANDARD || "10000", 10),
    NUMERICAL: parseInt(process.env.AI_BUDGET_NUMERICAL || "10000", 10),
    CASE_STUDY: parseInt(process.env.AI_BUDGET_CASE_STUDY || "10000", 10),
  }
};

/**
 * Smart classification helper to categorize explanation complexity based on question parameters.
 * Under current locked policy, all categories resolve to a 10,000 token maximum ceiling.
 */
export function getExplanationBudget(payload: AIExplanationPayload): number {
  // Category A: Case study question
  if (payload.caseScenarioText) {
    return AI_CONFIG.budgets.CASE_STUDY;
  }

  // Category B: Numerical / computational question (Accounting, costing, taxation, computations)
  const lowerText = (payload.question || "").toLowerCase();
  const numericalKeywords = [
    "calculate", "compute", "valuation", "reconstruction", "balance",
    "ledger", "journal", "debit", "credit", "asset", "liability", "tax",
    "cost", "interest", "depreciation", "ratio", "working steps"
  ];
  const isNumerical = numericalKeywords.some((word) => lowerText.includes(word));
  if (isNumerical) {
    return AI_CONFIG.budgets.NUMERICAL;
  }

  // Category C: Simple conceptual MCQ
  const isSimple = lowerText.length < 150 && !lowerText.includes("why") && !lowerText.includes("explain");
  if (isSimple) {
    return AI_CONFIG.budgets.SIMPLE;
  }

  // Category D: Standard analytical MCQ
  return AI_CONFIG.budgets.STANDARD;
}
