import { db } from "@/db";
import { questions, questionVersions } from "@/db/schema";
import { eq, and } from "drizzle-orm";
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

export interface ExistingQuestionCandidate {
  questionId: string;
  versionId: string;
  questionText: string;
  normalizedText: string;
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
      difficulty: questions.difficulty,
      questionType: questions.questionType,
    })
    .from(questions)
    .innerJoin(questionVersions, eq(questions.id, questionVersions.questionId))
    .where(and(...whereClauses))
    .limit(1000); // Bounded candidate search

  return rows.map((r) => ({
    ...r,
    normalizedText: normalizeQuestionText(r.questionText),
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

  // 1. Exact Normalized Text Match
  for (const cand of candidates) {
    if (cand.normalizedText === importedNorm) {
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
