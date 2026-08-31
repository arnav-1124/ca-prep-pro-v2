import { db } from "@/db";
import {
  aiExplanations,
  aiUsageLogs,
  questionVersions,
  questionOptions,
  practiceAttempts,
  practiceSessions,
  questions,
  caseStudies
} from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { GeminiProvider } from "./providers/gemini";
import { OpenRouterProvider } from "./providers/openrouter";
import { AIExplanationPayload, AIExplanationResult, AIProvider } from "./providers/base";
import { checkFeatureAllowance } from "../billing/entitlements";

// Global in-memory promise map to deduplicate concurrent AI generations
const activeGenerations = new Map<string, Promise<AIExplanationResult & { provider?: string; model?: string }>>();

/**
 * Retrieves a cached AI explanation for a specific question version.
 * Checks for 24-hour freshness.
 */
export async function getCachedExplanation(questionVersionId: string) {
  const [cached] = await db
    .select({
      explanation: aiExplanations.explanation,
      keyPoint: aiExplanations.keyPoint,
      provider: aiExplanations.provider,
      model: aiExplanations.model,
      createdAt: aiExplanations.createdAt,
    })
    .from(aiExplanations)
    .where(eq(aiExplanations.questionVersionId, questionVersionId))
    .limit(1);

  if (!cached) return null;

  // Enforce 24-hour freshness period
  const ageMs = Date.now() - new Date(cached.createdAt).getTime();
  if (ageMs > 24 * 60 * 60 * 1000) {
    console.log(`[AI Cache Expired] Explanation for version=${questionVersionId} is older than 24 hours (age: ${Math.round(ageMs / 3600000)}h)`);
    return null;
  }

  return cached;
}

/**
 * Evaluates whether a student profile has available daily quota for AI generations.
 */
export async function checkExplanationQuota(studentProfileId: string) {
  const allowance = await checkFeatureAllowance(studentProfileId, "EXPLANATION");
  return {
    allowed: allowance.allowed,
    used: allowance.used,
    limit: allowance.limit,
    resetTime: allowance.resetTime,
  };
}

/**
 * Core service to resolve an AI explanation for a question version.
 * Handles cache reads, authorization scopes, quota limits, and provider fallbacks.
 */
export async function getOrGenerateExplanation(
  studentProfileId: string,
  sessionId: string,
  questionVersionId: string
): Promise<AIExplanationResult & { fromCache: boolean }> {
  // 1. Authorize session ownership and question validity
  const [session] = await db
    .select()
    .from(practiceSessions)
    .where(eq(practiceSessions.id, sessionId))
    .limit(1);

  if (!session) {
    throw new Error("Practice session not found.");
  }

  if (session.studentProfileId !== studentProfileId) {
    throw new Error("Unauthorized access to practice session.");
  }

  // Verify that the student has actually attempted this question version in this session
  const [attempt] = await db
    .select()
    .from(practiceAttempts)
    .where(
      and(
        eq(practiceAttempts.practiceSessionId, sessionId),
        eq(practiceAttempts.questionVersionId, questionVersionId)
      )
    )
    .limit(1);

  if (!attempt) {
    throw new Error("You must submit an answer for this question before generating an explanation.");
  }

  // 2. Read from Cache (First-class check: free read, doesn't consume quota)
  const cached = await getCachedExplanation(questionVersionId);
  if (cached) {
    return {
      explanation: cached.explanation,
      keyPoint: cached.keyPoint,
      fromCache: true,
    };
  }

  // Deduplicate concurrent AI generations for the same question
  const activePromise = activeGenerations.get(questionVersionId);
  if (activePromise) {
    console.log(`[Concurrent Deduplication] Awaiting active AI generation for version=${questionVersionId}`);
    try {
      const dedupedResult = await activePromise;
      return {
        explanation: dedupedResult.explanation,
        keyPoint: dedupedResult.keyPoint,
        fromCache: true,
      };
    } catch {
      console.warn(`[Concurrent Deduplication] Shared AI generation failed, retrying independently...`);
    }
  }

  // 3. Verify Quota Limit
  const quota = await checkExplanationQuota(studentProfileId);
  if (!quota.allowed) {
    throw new Error("You have reached your AI explanation limit for today. Upgrade your plan for more daily credits.");
  }

  // 4. Load question details and options to send minimal context
  const [qData] = await db
    .select({
      questionText: questionVersions.questionText,
      correctAnswer: questionVersions.correctAnswer,
      caseStudyId: questions.caseStudyId,
      caseTitle: caseStudies.title,
      scenarioText: caseStudies.scenarioText,
    })
    .from(questionVersions)
    .innerJoin(questions, eq(questionVersions.questionId, questions.id))
    .leftJoin(caseStudies, eq(questions.caseStudyId, caseStudies.id))
    .where(eq(questionVersions.id, questionVersionId))
    .limit(1);

  if (!qData) {
    throw new Error("Question details not found.");
  }

  const options = await db
    .select()
    .from(questionOptions)
    .where(eq(questionOptions.questionVersionId, questionVersionId))
    .orderBy(asc(questionOptions.optionLetter));

  const optionsTexts = options.map((opt) => `${opt.optionLetter}: ${opt.optionText}`);

  const payload: AIExplanationPayload = {
    question: qData.questionText,
    options: optionsTexts,
    selectedOption: attempt.selectedAnswer,
    correctOption: qData.correctAnswer,
    caseTitle: qData.caseTitle || undefined,
    caseScenarioText: qData.scenarioText || undefined,
  };

  const runGeneration = async (): Promise<AIExplanationResult> => {
    // 5. Instantiating configured providers
    const primaryProviderName = (process.env.AI_PROVIDER || "gemini").toLowerCase();
    
    let providerInstance: AIProvider;
    let fallbackInstance: AIProvider;

    if (primaryProviderName === "openrouter") {
      providerInstance = new OpenRouterProvider();
      providerInstance.modelName = process.env.OPENROUTER_MODEL || "google/gemini-3.6-flash";
      fallbackInstance = new GeminiProvider();
      fallbackInstance.modelName = process.env.GEMINI_MODEL || "gemini-3.6-flash";
    } else {
      // Default is Gemini
      providerInstance = new GeminiProvider();
      providerInstance.modelName = process.env.GEMINI_MODEL || "gemini-3.6-flash";
      fallbackInstance = new OpenRouterProvider();
      fallbackInstance.modelName = process.env.OPENROUTER_MODEL || "google/gemini-3.6-flash";
    }

    const GEMINI_TIMEOUT_MS = Number(process.env.AI_GEMINI_TIMEOUT_MS || "8000");
    const OPENROUTER_TIMEOUT_MS = Number(process.env.AI_OPENROUTER_TIMEOUT_MS || "10000");
    const TOTAL_TIMEOUT_MS = Number(process.env.AI_TOTAL_TIMEOUT_MS || "15000");

    // Create absolute overall budget controller
    const totalController = new AbortController();
    const totalTimeoutId = setTimeout(() => totalController.abort(), TOTAL_TIMEOUT_MS);

    let result: AIExplanationResult;
    let activeProvider = providerInstance.name;
    let activeModel = providerInstance.modelName;
    const overallStartTime = Date.now();

    try {
      const providerTimeoutMs = activeProvider === "gemini" ? GEMINI_TIMEOUT_MS : OPENROUTER_TIMEOUT_MS;
      
      // Create combined abort controller for the primary attempt
      const primaryController = new AbortController();
      const primaryTimeoutId = setTimeout(() => primaryController.abort(), providerTimeoutMs);
      
      const onTotalAbort = () => primaryController.abort();
      totalController.signal.addEventListener("abort", onTotalAbort);

      const startTime = Date.now();
      try {
        console.log(`AI Explanation: Attempting with primary provider '${activeProvider}' (${activeModel})`);
        result = await providerInstance.generateExplanation(payload, primaryController.signal);
        const latency = Date.now() - startTime;
        console.log(`[AI Explanation Success] id=${questionVersionId} provider=${activeProvider} model=${activeModel} latency=${latency}ms fallback=false`);
      } catch (primaryErr: unknown) {
        const errObj = primaryErr as Error;
        const latency = Date.now() - startTime;
        const retryable = isRetryableError(primaryErr);
        console.warn(`[AI Explanation Failed] id=${questionVersionId} provider=${activeProvider} model=${activeModel} latency=${latency}ms error="${errObj?.message || "Unknown"}" retryable=${retryable}`);
        
        if (!retryable) {
          throw primaryErr; // Don't fall back for configuration or key errors
        }

        // Check if overall budget is already exceeded before triggering fallback
        if (totalController.signal.aborted) {
          throw new Error("TimeoutError: The operation was aborted due to overall time budget limit.");
        }

        // Controlled fallback to secondary provider
        activeProvider = fallbackInstance.name;
        activeModel = fallbackInstance.modelName;
        const fallbackTimeoutMs = activeProvider === "gemini" ? GEMINI_TIMEOUT_MS : OPENROUTER_TIMEOUT_MS;

        console.log(`AI Explanation: Falling back to secondary provider '${activeProvider}' (${activeModel})`);
        
        const fallbackController = new AbortController();
        const fallbackTimeoutId = setTimeout(() => fallbackController.abort(), fallbackTimeoutMs);
        
        const onTotalAbortFallback = () => fallbackController.abort();
        totalController.signal.addEventListener("abort", onTotalAbortFallback);

        const fallbackStartTime = Date.now();
        try {
          result = await fallbackInstance.generateExplanation(payload, fallbackController.signal);
          const fallbackLatency = Date.now() - fallbackStartTime;
          console.log(`[AI Explanation Success] id=${questionVersionId} provider=${activeProvider} model=${activeModel} latency=${fallbackLatency}ms fallback=true`);
        } catch (fallbackErr: unknown) {
          const errObj = fallbackErr as Error;
          const fallbackLatency = Date.now() - fallbackStartTime;
          console.error(`[AI Explanation Final Failed] id=${questionVersionId} provider=${activeProvider} model=${activeModel} latency=${fallbackLatency}ms error="${errObj?.message || "Unknown"}"`);
          throw fallbackErr;
        } finally {
          clearTimeout(fallbackTimeoutId);
          totalController.signal.removeEventListener("abort", onTotalAbortFallback);
        }
      } finally {
        clearTimeout(primaryTimeoutId);
        totalController.signal.removeEventListener("abort", onTotalAbort);
      }
    } catch (err: unknown) {
      const errObj = err as Error;
      const totalLatency = Date.now() - overallStartTime;
      console.error(`[AI Explanation Overall Error] id=${questionVersionId} totalLatency=${totalLatency}ms error="${errObj?.message || "Unknown"}"`);
      
      // Translate technical exceptions into friendly student concepts
      const msg = String(errObj?.message || "").toLowerCase();
      if (msg.includes("timeout") || msg.includes("aborted")) {
        throw new Error("The AI is taking longer than expected. Please try again.");
      }
      if (msg.includes("quota") || msg.includes("limit")) {
        throw err; // Keep quota credit errors as-is
      }
      throw new Error("The AI explanation service is temporarily busy. Please try again shortly.");
    } finally {
      clearTimeout(totalTimeoutId);
    }

    // Cache the successful result using database upsert (onConflictDoUpdate) to refresh expired values
    try {
      await db
        .insert(aiExplanations)
        .values({
          questionVersionId,
          provider: activeProvider,
          model: activeModel,
          explanation: result.explanation,
          keyPoint: result.keyPoint,
          createdAt: new Date(),
        })
        .onConflictDoUpdate({
          target: aiExplanations.questionVersionId,
          set: {
            provider: activeProvider,
            model: activeModel,
            explanation: result.explanation,
            keyPoint: result.keyPoint,
            createdAt: new Date(),
          },
        });
    } catch (dbErr) {
      console.warn("Race condition during cached explanation write:", dbErr);
    }

    return {
      explanation: result.explanation,
      keyPoint: result.keyPoint,
      provider: activeProvider,
      model: activeModel,
    };
  };

  const generationPromise = runGeneration();
  activeGenerations.set(questionVersionId, generationPromise);

  let finalResult: AIExplanationResult;
  let finalProvider = "gemini";
  let finalModel = "gemini-3.6-flash";

  try {
    const aiResponse = await generationPromise;
    finalResult = aiResponse;
    finalProvider = aiResponse.provider || finalProvider;
    finalModel = aiResponse.model || finalModel;
  } finally {
    activeGenerations.delete(questionVersionId);
  }

  // 7. Record usage log
  await db.insert(aiUsageLogs).values({
    studentProfileId,
    action: "EXPLANATION",
    questionVersionId,
    provider: finalProvider,
    model: finalModel,
  });

  return {
    explanation: finalResult.explanation,
    keyPoint: finalResult.keyPoint,
    fromCache: false,
  };
}

/**
 * Classification check to identify if an error from generateObject is retryable
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const name = error.name;
    const msg = error.message.toLowerCase();
    
    // Explicit timeout checks
    if (name === "TimeoutError" || msg.includes("timeout") || msg.includes("aborted")) {
      return true;
    }
  }

  // Check Vercel AI SDK APICallError properties
  if (error && typeof error === "object") {
    const errDict = error as Record<string, unknown>;
    const statusCode = errDict.statusCode;
    if (typeof statusCode === "number") {
      // 400 (Bad Request), 401 (Unauthorized), 403 (Forbidden), 404 (Not Found) are configuration issues
      if ([400, 401, 403, 404].includes(statusCode)) {
        return false;
      }
      
      // 429 (Rate Limit) and 5xx (Server errors) are retryable
      if (statusCode === 429 || statusCode >= 500) {
        return true;
      }
    }
  }

  // Check common validation errors
  const errMessage = error instanceof Error ? error.message : String(error || "");
  const errorMsg = errMessage.toLowerCase();
  if (errorMsg.includes("validation") || errorMsg.includes("zod") || errorMsg.includes("schema")) {
    return false;
  }

  // Default: assume transient network/provider error
  return true;
}
