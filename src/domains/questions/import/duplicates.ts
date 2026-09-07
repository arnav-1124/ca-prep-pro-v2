import { db } from "@/db";
import { questions, questionVersions, questionOptions } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { DuplicateDetectionResult, RawImportQuestionJson } from "./types";

/**
 * Normalizes question text for robust comparison.
 * Removes leading test annotations, trims, normalizes whitespace and punctuation.
 */
export function normalizeQuestionText(text: string): string {
  if (!text) return "";
  return text
    .replace(/^\[.*?\]\s*/i, "") // Remove bracketed headers e.g. [Development Sample]
    .toLowerCase()
    .replace(/[^\w\s]/g, " ") // Replace punctuations with space
    .replace(/\s+/g, " ") // Collapse multiple spaces
    .trim();
}

/**
 * Computes word set token Jaccard similarity between two strings.
 * Returns a score between 0.0 and 1.0.
 */
export function computeTokenSimilarity(strA: string, strB: string): number {
  const normA = normalizeQuestionText(strA);
  const normB = normalizeQuestionText(strB);

  if (normA === normB) return 1.0;
  if (!normA || !normB) return 0.0;

  const tokensA = new Set(normA.split(" ").filter((t) => t.length > 2));
  const tokensB = new Set(normB.split(" ").filter((t) => t.length > 2));

  if (tokensA.size === 0 || tokensB.size === 0) return 0.0;

  let intersectionCount = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) {
      intersectionCount++;
    }
  }

  const unionCount = tokensA.size + tokensB.size - intersectionCount;
  return unionCount === 0 ? 0.0 : intersectionCount / unionCount;
}

/**
 * Computes option text overlap similarity between two sets of options.
 * Returns a ratio between 0.0 and 1.0.
 */
export function computeOptionSimilarity(
  optionsA?: { letter?: string; text?: string }[] | null,
  optionsB?: { letter?: string; text?: string }[] | null
): number {
  if (!optionsA || !optionsB || optionsA.length === 0 || optionsB.length === 0) {
    return 0;
  }

  const normTextsA = optionsA.map((o) => normalizeQuestionText(o.text || "")).filter(Boolean);
  const normTextsB = optionsB.map((o) => normalizeQuestionText(o.text || "")).filter(Boolean);

  if (normTextsA.length === 0 || normTextsB.length === 0) return 0;

  let matchedCount = 0;
  for (const a of normTextsA) {
    for (const b of normTextsB) {
      if (a === b || computeTokenSimilarity(a, b) >= 0.8) {
        matchedCount++;
        break;
      }
    }
  }

  return matchedCount / Math.max(normTextsA.length, normTextsB.length);
}

/**
 * Checks if a question prompt text is generic or too short to uniquely identify the question.
 */
export function isGenericQuestionText(normText: string): boolean {
  if (!normText) return true;
  if (normText.length < 50) return true;
  return /^(which (of the following )?(statements? is|is|are)|select the (correct|incorrect)|consider the following|state whether|true or false)/i.test(
    normText
  );
}

export interface ExistingQuestionCandidate {
  questionId: string;
  versionId: string;
  questionText: string;
  normalizedText: string;
  correctAnswer?: string | null;
  options?: { letter: string; text: string; normalizedText?: string }[];
  difficulty: string;
  questionType: string;
}

/**
 * Pre-fetches existing live question candidates for an academic level and optional subject.
 * Scopes candidate retrieval to prevent full-table scans.
 */
export async function fetchDuplicateCandidates(
  academicLevelId: string,
  subjectId?: string | null
): Promise<ExistingQuestionCandidate[]> {
  const whereClauses = [
    eq(questions.academicLevelId, academicLevelId),
    eq(questionVersions.isActive, true),
  ];

  if (subjectId) {
    whereClauses.push(eq(questions.subjectId, subjectId));
  }

  const rows = await db
    .select({
      questionId: questions.id,
      versionId: questionVersions.id,
      questionText: questionVersions.questionText,
      correctAnswer: questionVersions.correctAnswer,
      difficulty: questions.difficulty,
      questionType: questions.questionType,
    })
    .from(questions)
    .innerJoin(questionVersions, eq(questions.id, questionVersions.questionId))
    .where(and(...whereClauses))
    .limit(2000); // Bounded candidate search

  if (rows.length === 0) {
    return [];
  }

  // Fetch options for candidate versions in chunks to avoid parameter limits
  const versionIds = rows.map((r) => r.versionId);
  const optionsMap = new Map<string, { letter: string; text: string; normalizedText: string }[]>();

  const CHUNK_SIZE = 100;
  for (let i = 0; i < versionIds.length; i += CHUNK_SIZE) {
    const chunk = versionIds.slice(i, i + CHUNK_SIZE);
    const optRows = await db
      .select({
        versionId: questionOptions.questionVersionId,
        letter: questionOptions.optionLetter,
        text: questionOptions.optionText,
      })
      .from(questionOptions)
      .where(inArray(questionOptions.questionVersionId, chunk));

    for (const opt of optRows) {
      const list = optionsMap.get(opt.versionId) || [];
      list.push({
        letter: opt.letter,
        text: opt.text,
        normalizedText: normalizeQuestionText(opt.text),
      });
      optionsMap.set(opt.versionId, list);
    }
  }

  return rows.map((r) => ({
    ...r,
    normalizedText: normalizeQuestionText(r.questionText),
    options: optionsMap.get(r.versionId) || [],
  }));
}

/**
 * Checks an imported question against existing live question candidates.
 */
export function checkQuestionDuplicate(
  importedQuestion: RawImportQuestionJson,
  candidates: ExistingQuestionCandidate[]
): DuplicateDetectionResult {
  const importedNorm = normalizeQuestionText(importedQuestion.questionText);

  if (!importedNorm || candidates.length === 0) {
    return {
      status: "NO_DUPLICATE",
      similarityScore: 0,
      candidateQuestionId: null,
      candidateVersionId: null,
      matchReason: null,
    };
  }

  const isGeneric = isGenericQuestionText(importedNorm);
  const importedHasOptions = Array.isArray(importedQuestion.options) && importedQuestion.options.length > 0;

  // 1. Exact Normalized Text Match
  for (const cand of candidates) {
    if (cand.normalizedText === importedNorm) {
      const candHasOptions = Array.isArray(cand.options) && cand.options.length > 0;

      // If text is generic or short, question text alone does NOT imply duplicate identity!
      if (isGeneric) {
        if (importedHasOptions && candHasOptions) {
          const optSim = computeOptionSimilarity(importedQuestion.options, cand.options);
          const answerMatches =
            cand.correctAnswer && importedQuestion.correctAnswer
              ? cand.correctAnswer.trim().toUpperCase() === importedQuestion.correctAnswer.trim().toUpperCase()
              : false;

          // If options overlap significantly (>= 50%) or answers match with partial options
          if (optSim >= 0.5) {
            return {
              status: answerMatches ? "EXACT_DUPLICATE" : "POTENTIAL_DUPLICATE",
              similarityScore: Math.round(optSim * 100),
              candidateQuestionId: cand.questionId,
              candidateVersionId: cand.versionId,
              candidatePreviewText: cand.questionText,
              matchReason: answerMatches
                ? "Exact question text and matching options found in live Question Bank."
                : "Identical question text and similar options found, but correct answer differs.",
            };
          } else {
            // Options are completely different (e.g. tradable permits vs accounting costs), NOT a duplicate!
            continue;
          }
        } else {
          // If options are missing (e.g. legacy or test mock), check correct answer if available
          if (cand.correctAnswer && importedQuestion.correctAnswer) {
            if (cand.correctAnswer.trim().toUpperCase() !== importedQuestion.correctAnswer.trim().toUpperCase()) {
              // Different correct answers on generic text -> NOT a duplicate!
              continue;
            }
          }
          // Fallback: If answers match or no answers provided, treat as match
          return {
            status: "EXACT_DUPLICATE",
            similarityScore: 100,
            candidateQuestionId: cand.questionId,
            candidateVersionId: cand.versionId,
            candidatePreviewText: cand.questionText,
            matchReason: "Exact question text match found in live Question Bank.",
          };
        }
      }

      // Non-generic question text (long and specific prompt)
      if (importedHasOptions && candHasOptions) {
        const optSim = computeOptionSimilarity(importedQuestion.options, cand.options);
        const answerMatches =
          cand.correctAnswer && importedQuestion.correctAnswer
            ? cand.correctAnswer.trim().toUpperCase() === importedQuestion.correctAnswer.trim().toUpperCase()
            : true;

        if (optSim === 0 && !answerMatches) {
          // Same long text but completely distinct options and answer
          return {
            status: "POTENTIAL_DUPLICATE",
            similarityScore: 85,
            candidateQuestionId: cand.questionId,
            candidateVersionId: cand.versionId,
            candidatePreviewText: cand.questionText,
            matchReason: "Identical question prompt found, but options and answer differ.",
          };
        }
      }

      return {
        status: "EXACT_DUPLICATE",
        similarityScore: 100,
        candidateQuestionId: cand.questionId,
        candidateVersionId: cand.versionId,
        candidatePreviewText: cand.questionText,
        matchReason: "Exact question text match found in live Question Bank.",
      };
    }
  }

  // 2. Fuzzy Token Similarity Check
  let highestScore = 0;
  let bestCandidate: ExistingQuestionCandidate | null = null;

  for (const cand of candidates) {
    const sim = computeTokenSimilarity(importedQuestion.questionText, cand.questionText);
    if (sim > highestScore) {
      highestScore = sim;
      bestCandidate = cand;
    }
  }

  const scorePercentage = Math.round(highestScore * 100);

  if (scorePercentage >= 85 && bestCandidate) {
    const candHasOptions = Array.isArray(bestCandidate.options) && bestCandidate.options.length > 0;
    // If prompt is generic and options are present, don't flag as duplicate unless options also match
    if (isGeneric && importedHasOptions && candHasOptions) {
      const optSim = computeOptionSimilarity(importedQuestion.options, bestCandidate.options);
      if (optSim < 0.5) {
        return {
          status: "NO_DUPLICATE",
          similarityScore: scorePercentage,
          candidateQuestionId: null,
          candidateVersionId: null,
          matchReason: null,
        };
      }
    }

    return {
      status: "POTENTIAL_DUPLICATE",
      similarityScore: scorePercentage,
      candidateQuestionId: bestCandidate.questionId,
      candidateVersionId: bestCandidate.versionId,
      candidatePreviewText: bestCandidate.questionText,
      matchReason: `High similarity (${scorePercentage}%) with existing question in Question Bank.`,
    };
  }

  return {
    status: "NO_DUPLICATE",
    similarityScore: scorePercentage,
    candidateQuestionId: null,
    candidateVersionId: null,
    matchReason: null,
  };
}

