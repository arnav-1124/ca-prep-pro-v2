import { db } from "@/db";
import {
  academicLevels,
  curriculumVersions,
  subjects,
  curriculumNodes,
  questions,
  questionVersions,
  questionOptions,
  caseStudies,
  practiceAttempts,
  testQuestions,
  questionReviews,
  importedQuestions,
} from "@/db/schema";
import { eq, and, desc, sql, inArray, ilike, or } from "drizzle-orm";
import {
  AttentionSeverity,
  AttentionFlag,
  ReviewDecision,
  ReviewQueueItem,
  ReviewQueueFilterParams,
  ReviewQueueResponse,
  RecordReviewInput,
  RecordReviewResult,
  ReviewHistoryRecord,
} from "./types";

const SEVERITY_WEIGHTS: Record<AttentionSeverity, number> = {
  CRITICAL: 5,
  HIGH: 4,
  MEDIUM: 3,
  LOW: 2,
  INFO: 1,
};

/**
 * Computes deterministic operational intelligence and attention flags for a given question record.
 */
export function computeAttentionFlags(item: {
  isCurriculumVersionActive: boolean;
  isCurriculumNodeActive: boolean;
  isActive: boolean;
  explanation: string | null;
  optionsCount: number;
  questionType: string;
  duplicateCandidateQuestionId: string | null;
  duplicateSimilarityScore: number | null;
  latestReviewDecision: ReviewDecision | null;
  latestReviewNotes: string | null;
  practiceAttemptsCount: number;
  testQuestionsCount: number;
  totalVersionsCount: number;
}): { flags: AttentionFlag[]; highestSeverity: AttentionSeverity } {
  const flags: AttentionFlag[] = [];

  // 1. Obsolete Curriculum Version
  if (!item.isCurriculumVersionActive) {
    flags.push({
      reason: "OBSOLETE_CURRICULUM",
      severity: "HIGH",
      label: "Obsolete Curriculum",
      description: "Mapped to an inactive or superseded curriculum version.",
    });
  }

  // 2. Inactive Curriculum Node
  if (!item.isCurriculumNodeActive) {
    flags.push({
      reason: "INACTIVE_NODE",
      severity: "CRITICAL",
      label: "Inactive Node",
      description: "The specific chapter/topic node has been deactivated.",
    });
  }

  // 3. Retired / Inactive Question
  if (!item.isActive) {
    flags.push({
      reason: "RETIRED_QUESTION",
      severity: "MEDIUM",
      label: "Retired / Inactive",
      description: "Question is retired from active student practice pools.",
    });
  }

  // 4. Weak / Missing Explanation
  if (!item.explanation || item.explanation.trim().length < 20) {
    flags.push({
      reason: "WEAK_EXPLANATION",
      severity: "MEDIUM",
      label: "Weak Explanation",
      description: "Explanation is missing or shorter than 20 characters.",
    });
  }

  // 5. Malformed Options (MCQ with < 4 options)
  if (item.questionType === "MCQ" && item.optionsCount < 4) {
    flags.push({
      reason: "FEW_OPTIONS",
      severity: "HIGH",
      label: "Malformed Options",
      description: `MCQ question has only ${item.optionsCount} option choices (standard is 4).`,
    });
  }

  // 6. Potential Duplicate
  if (item.duplicateCandidateQuestionId && (item.duplicateSimilarityScore || 0) >= 80) {
    flags.push({
      reason: "POTENTIAL_DUPLICATE",
      severity: "HIGH",
      label: "Duplicate Candidate",
      description: `Flagged with ${item.duplicateSimilarityScore}% similarity to another live question.`,
    });
  }

  // 7. Review Decision: Needs Changes
  if (item.latestReviewDecision === "NEEDS_CHANGES") {
    flags.push({
      reason: "NEEDS_CHANGES",
      severity: "HIGH",
      label: "Needs Changes",
      description: item.latestReviewNotes || "Flagged by reviewer as requiring editorial correction.",
    });
  }

  // 8. Never Reviewed
  if (!item.latestReviewDecision) {
    flags.push({
      reason: "NEVER_REVIEWED",
      severity: "LOW",
      label: "Unreviewed",
      description: "Has never received a recorded human review decision.",
    });
  }

  // 9. Zero Usage
  if (item.practiceAttemptsCount === 0 && item.testQuestionsCount === 0) {
    flags.push({
      reason: "ZERO_USAGE",
      severity: "INFO",
      label: "Zero Usage",
      description: "Has 0 student practice attempts and 0 test usages.",
    });
  }

  // 10. Heavy Usage
  if (item.practiceAttemptsCount >= 20 || item.testQuestionsCount >= 3) {
    flags.push({
      reason: "HEAVY_USAGE",
      severity: "INFO",
      label: "Heavy Usage",
      description: `High student traffic (${item.practiceAttemptsCount} attempts, ${item.testQuestionsCount} tests).`,
    });
  }

  // 11. Multi-Versioned / Amended
  if (item.totalVersionsCount > 1) {
    flags.push({
      reason: "MULTI_VERSIONED",
      severity: "INFO",
      label: `Amended (${item.totalVersionsCount} versions)`,
      description: `Question has ${item.totalVersionsCount} version snapshots.`,
    });
  }

  let highestSeverity: AttentionSeverity = "INFO";
  let maxWeight = 0;
  for (const f of flags) {
    const w = SEVERITY_WEIGHTS[f.severity] || 0;
    if (w > maxWeight) {
      maxWeight = w;
      highestSeverity = f.severity;
    }
  }

  return { flags, highestSeverity };
}

/**
 * Retrieves paginated questions for the Operational Review Queue with deterministic attention flags and metrics.
 */
export async function getQuestionReviewQueueData(
  params: ReviewQueueFilterParams
): Promise<ReviewQueueResponse> {
  const targetLevelCode = params.levelCode || "INTERMEDIATE";
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize || 20));

  // 1. Resolve Academic Level
  const [level] = await db
    .select()
    .from(academicLevels)
    .where(eq(academicLevels.code, targetLevelCode))
    .limit(1);

  if (!level) {
    throw new Error(`Academic Level '${targetLevelCode}' not found.`);
  }

  // 2. Fetch all levels, curriculum versions, and subjects for filtering
  const [allLevels, allVersions, allSubjects] = await Promise.all([
    db.select({ id: academicLevels.id, code: academicLevels.code, name: academicLevels.name }).from(academicLevels),
    db
      .select({ id: curriculumVersions.id, name: curriculumVersions.name, isActive: curriculumVersions.isActive })
      .from(curriculumVersions)
      .where(eq(curriculumVersions.academicLevelId, level.id)),
    db
      .select({ id: subjects.id, code: subjects.code, name: subjects.name })
      .from(subjects)
      .where(eq(subjects.academicLevelId, level.id)),
  ]);

  // 3. Build Base Question Query
  const conditions = [eq(questions.academicLevelId, level.id)];

  if (params.subjectId && params.subjectId !== "ALL") {
    conditions.push(eq(questions.subjectId, params.subjectId));
  }

  // Search query (search in question text preview or node name)
  if (params.searchQuery && params.searchQuery.trim().length > 0) {
    const term = `%${params.searchQuery.trim()}%`;
    conditions.push(
      or(
        ilike(curriculumNodes.name, term),
        ilike(curriculumNodes.code, term),
        ilike(subjects.name, term)
      )!
    );
  }

  // 4. Fetch questions matching scope with related curriculum, subject, and node data
  const baseQuestions = await db
    .select({
      id: questions.id,
      academicLevelId: questions.academicLevelId,
      academicLevelCode: academicLevels.code,
      academicLevelName: academicLevels.name,
      subjectId: questions.subjectId,
      subjectCode: subjects.code,
      subjectName: subjects.name,
      curriculumNodeId: questions.curriculumNodeId,
      curriculumNodeCode: curriculumNodes.code,
      curriculumNodeName: curriculumNodes.name,
      curriculumNodeType: curriculumNodes.type,
      isCurriculumNodeActive: curriculumNodes.isActive,
      curriculumNodeParentId: curriculumNodes.parentId,
      curriculumVersionId: curriculumNodes.curriculumVersionId,
      curriculumVersionName: curriculumVersions.name,
      isCurriculumVersionActive: curriculumVersions.isActive,
      caseStudyId: questions.caseStudyId,
      caseStudyTitle: caseStudies.title,
      difficulty: questions.difficulty,
      questionType: questions.questionType,
      createdAt: questions.createdAt,
    })
    .from(questions)
    .innerJoin(academicLevels, eq(questions.academicLevelId, academicLevels.id))
    .innerJoin(subjects, eq(questions.subjectId, subjects.id))
    .innerJoin(curriculumNodes, eq(questions.curriculumNodeId, curriculumNodes.id))
    .innerJoin(curriculumVersions, eq(curriculumNodes.curriculumVersionId, curriculumVersions.id))
    .leftJoin(caseStudies, eq(questions.caseStudyId, caseStudies.id))
    .where(and(...conditions));

  if (baseQuestions.length === 0) {
    return {
      items: [],
      pagination: { totalCount: 0, page: 1, pageSize, totalPages: 0 },
      filterOptions: {
        levels: allLevels,
        versions: allVersions,
        subjects: allSubjects,
        selectedLevelCode: targetLevelCode,
      },
      metrics: {
        totalQuestionsNeedingAttention: 0,
        criticalCount: 0,
        highCount: 0,
        mediumCount: 0,
        unreviewedCount: 0,
        obsoleteCurriculumCount: 0,
        retiredCount: 0,
        weakExplanationCount: 0,
        needsChangesCount: 0,
        zeroUsageCount: 0,
      },
    };
  }

  const questionIds = baseQuestions.map((q) => q.id);

  // 5. Fetch Question Versions, Options Count, Usage Counts, and Latest Review Decisions in parallel
  const [allQVersions, allOptions, practiceCounts, testCounts, latestReviews, duplicateMatches] = await Promise.all([
    // All versions for these questions
    db
      .select({
        id: questionVersions.id,
        questionId: questionVersions.questionId,
        versionNumber: questionVersions.versionNumber,
        questionText: questionVersions.questionText,
        correctAnswer: questionVersions.correctAnswer,
        explanation: questionVersions.explanation,
        isActive: questionVersions.isActive,
        createdAt: questionVersions.createdAt,
      })
      .from(questionVersions)
      .where(inArray(questionVersions.questionId, questionIds))
      .orderBy(desc(questionVersions.versionNumber)),

    // Options count grouped by version
    db
      .select({
        questionVersionId: questionOptions.questionVersionId,
        count: sql<number>`count(*)::int`,
      })
      .from(questionOptions)
      .groupBy(questionOptions.questionVersionId),

    // Practice attempts count grouped by questionVersionId
    db
      .select({
        questionVersionId: practiceAttempts.questionVersionId,
        count: sql<number>`count(*)::int`,
        lastAttemptedAt: sql<Date | null>`max(${practiceAttempts.createdAt})`,
      })
      .from(practiceAttempts)
      .groupBy(practiceAttempts.questionVersionId),

    // Test questions count grouped by questionId
    db
      .select({
        questionId: testQuestions.questionId,
        count: sql<number>`count(*)::int`,
      })
      .from(testQuestions)
      .where(inArray(testQuestions.questionId, questionIds))
      .groupBy(testQuestions.questionId),

    // Latest review decisions for each question
    db
      .select({
        id: questionReviews.id,
        questionId: questionReviews.questionId,
        questionVersionId: questionReviews.questionVersionId,
        decision: questionReviews.decision,
        notes: questionReviews.notes,
        reviewedBy: questionReviews.reviewedBy,
        createdAt: questionReviews.createdAt,
      })
      .from(questionReviews)
      .where(inArray(questionReviews.questionId, questionIds))
      .orderBy(desc(questionReviews.createdAt)),

    // Duplicate match records from staging if linked
    db
      .select({
        publishedQuestionId: importedQuestions.publishedQuestionId,
        duplicateCandidateQuestionId: importedQuestions.duplicateCandidateQuestionId,
        duplicateSimilarityScore: importedQuestions.duplicateSimilarityScore,
        duplicateMatchReason: importedQuestions.duplicateMatchReason,
      })
      .from(importedQuestions)
      .where(
        and(
          inArray(importedQuestions.publishedQuestionId, questionIds),
          eq(importedQuestions.duplicateStatus, "POTENTIAL_DUPLICATE")
        )
      ),
  ]);

  // Build lookups
  const optionsCountMap = new Map<string, number>();
  for (const opt of allOptions) {
    optionsCountMap.set(opt.questionVersionId, Number(opt.count) || 0);
  }

  const practiceAttemptsMap = new Map<string, { count: number; lastAttemptedAt: Date | null }>();
  for (const p of practiceCounts) {
    practiceAttemptsMap.set(p.questionVersionId, {
      count: Number(p.count) || 0,
      lastAttemptedAt: p.lastAttemptedAt ? new Date(p.lastAttemptedAt) : null,
    });
  }

  const testQuestionsMap = new Map<string, number>();
  for (const t of testCounts) {
    testQuestionsMap.set(t.questionId, Number(t.count) || 0);
  }

  const latestReviewMap = new Map<string, typeof latestReviews[0]>();
  for (const r of latestReviews) {
    if (!latestReviewMap.has(r.questionId)) {
      latestReviewMap.set(r.questionId, r);
    }
  }

  const duplicateMap = new Map<string, typeof duplicateMatches[0]>();
  for (const d of duplicateMatches) {
    if (d.publishedQuestionId && !duplicateMap.has(d.publishedQuestionId)) {
      duplicateMap.set(d.publishedQuestionId, d);
    }
  }

  // Group versions by question ID
  const versionsByQuestion = new Map<string, typeof allQVersions>();
  for (const v of allQVersions) {
    const list = versionsByQuestion.get(v.questionId) || [];
    list.push(v);
    versionsByQuestion.set(v.questionId, list);
  }

  // 6. Map Question Items & Evaluate Attention Flags
  const processedItems: ReviewQueueItem[] = [];

  let totalQuestionsNeedingAttention = 0;
  let criticalCount = 0;
  let highCount = 0;
  let mediumCount = 0;
  let unreviewedCount = 0;
  let obsoleteCurriculumCount = 0;
  let retiredCount = 0;
  let weakExplanationCount = 0;
  let needsChangesCount = 0;
  let zeroUsageCount = 0;

  for (const bq of baseQuestions) {
    const qVersions = versionsByQuestion.get(bq.id) || [];
    const activeVer = qVersions.find((v) => v.isActive) || qVersions[0];

    if (!activeVer) continue;

    const optCount = optionsCountMap.get(activeVer.id) || 0;
    const practiceInfo = practiceAttemptsMap.get(activeVer.id) || { count: 0, lastAttemptedAt: null };
    const testCount = testQuestionsMap.get(bq.id) || 0;
    const latestRev = latestReviewMap.get(bq.id);
    const dupInfo = duplicateMap.get(bq.id);

    const hierarchyPath = `${bq.subjectName} > ${bq.curriculumNodeName}`;

    const { flags, highestSeverity } = computeAttentionFlags({
      isCurriculumVersionActive: bq.isCurriculumVersionActive,
      isCurriculumNodeActive: bq.isCurriculumNodeActive,
      isActive: activeVer.isActive,
      explanation: activeVer.explanation,
      optionsCount: optCount,
      questionType: bq.questionType,
      duplicateCandidateQuestionId: dupInfo?.duplicateCandidateQuestionId || null,
      duplicateSimilarityScore: dupInfo?.duplicateSimilarityScore || null,
      latestReviewDecision: (latestRev?.decision as ReviewDecision) || null,
      latestReviewNotes: latestRev?.notes || null,
      practiceAttemptsCount: practiceInfo.count,
      testQuestionsCount: testCount,
      totalVersionsCount: qVersions.length,
    });

    // Metric counters
    if (flags.some((f) => f.reason !== "ZERO_USAGE" && f.reason !== "NEVER_REVIEWED")) {
      totalQuestionsNeedingAttention++;
    }
    if (highestSeverity === "CRITICAL") criticalCount++;
    if (highestSeverity === "HIGH") highCount++;
    if (highestSeverity === "MEDIUM") mediumCount++;
    if (!latestRev) unreviewedCount++;
    if (!bq.isCurriculumVersionActive) obsoleteCurriculumCount++;
    if (!activeVer.isActive) retiredCount++;
    if (!activeVer.explanation || activeVer.explanation.trim().length < 20) weakExplanationCount++;
    if (latestRev?.decision === "NEEDS_CHANGES") needsChangesCount++;
    if (practiceInfo.count === 0 && testCount === 0) zeroUsageCount++;

    const item: ReviewQueueItem = {
      id: bq.id,
      academicLevelId: bq.academicLevelId,
      academicLevelCode: bq.academicLevelCode,
      academicLevelName: bq.academicLevelName,
      subjectId: bq.subjectId,
      subjectCode: bq.subjectCode,
      subjectName: bq.subjectName,
      curriculumVersionId: bq.curriculumVersionId,
      curriculumVersionName: bq.curriculumVersionName,
      isCurriculumVersionActive: bq.isCurriculumVersionActive,
      curriculumNodeId: bq.curriculumNodeId,
      curriculumNodeCode: bq.curriculumNodeCode,
      curriculumNodeName: bq.curriculumNodeName,
      isCurriculumNodeActive: bq.isCurriculumNodeActive,
      hierarchyPath,
      difficulty: bq.difficulty as "EASY" | "MEDIUM" | "HARD",
      questionType: bq.questionType as "MCQ" | "CASE_STUDY",
      caseStudyId: bq.caseStudyId,
      caseStudyTitle: bq.caseStudyTitle,
      activeVersionId: activeVer.id,
      versionNumber: activeVer.versionNumber,
      totalVersionsCount: qVersions.length,
      questionTextPreview: activeVer.questionText.slice(0, 200),
      correctAnswer: activeVer.correctAnswer,
      hasExplanation: Boolean(activeVer.explanation && activeVer.explanation.trim().length > 0),
      explanationLength: activeVer.explanation ? activeVer.explanation.trim().length : 0,
      optionsCount: optCount,
      isActive: activeVer.isActive,
      practiceAttemptsCount: practiceInfo.count,
      testQuestionsCount: testCount,
      aiConversationsCount: 0,
      totalUsageCount: practiceInfo.count + testCount,
      lastAttemptedAt: practiceInfo.lastAttemptedAt,
      latestReviewDecision: (latestRev?.decision as ReviewDecision) || null,
      latestReviewNotes: latestRev?.notes || null,
      latestReviewedBy: latestRev?.reviewedBy || null,
      latestReviewedAt: latestRev?.createdAt ? new Date(latestRev.createdAt) : null,
      duplicateCandidateQuestionId: dupInfo?.duplicateCandidateQuestionId || null,
      duplicateSimilarityScore: dupInfo?.duplicateSimilarityScore || null,
      duplicateMatchReason: dupInfo?.duplicateMatchReason || null,
      attentionFlags: flags,
      highestSeverity,
      createdAt: bq.createdAt,
    };

    processedItems.push(item);
  }

  // 7. Apply Post-Computation Filters (Attention Reason, Severity, Review Status, Usage State)
  let filteredItems = processedItems;

  if (params.curriculumVersionId && params.curriculumVersionId !== "ALL") {
    filteredItems = filteredItems.filter((i) => i.curriculumVersionId === params.curriculumVersionId);
  }

  if (params.attentionReason && params.attentionReason !== "ALL") {
    filteredItems = filteredItems.filter((i) =>
      i.attentionFlags.some((f) => f.reason === params.attentionReason)
    );
  }

  if (params.severity && params.severity !== "ALL") {
    filteredItems = filteredItems.filter((i) => i.highestSeverity === params.severity);
  }

  if (params.reviewStatus && params.reviewStatus !== "ALL") {
    if (params.reviewStatus === "UNREVIEWED") {
      filteredItems = filteredItems.filter((i) => i.latestReviewDecision === null);
    } else {
      filteredItems = filteredItems.filter((i) => i.latestReviewDecision === params.reviewStatus);
    }
  }

  if (params.usageState && params.usageState !== "ALL") {
    if (params.usageState === "ZERO_USAGE") {
      filteredItems = filteredItems.filter((i) => i.totalUsageCount === 0);
    } else if (params.usageState === "HEAVY_USAGE") {
      filteredItems = filteredItems.filter((i) => i.totalUsageCount >= 20);
    } else if (params.usageState === "ATTEMPTED") {
      filteredItems = filteredItems.filter((i) => i.totalUsageCount > 0);
    }
  }

  // 8. Sorting
  const sortBy = params.sortBy || "severity";
  const sortOrder = params.sortOrder || "desc";

  filteredItems.sort((a, b) => {
    let diff = 0;
    if (sortBy === "severity") {
      diff = SEVERITY_WEIGHTS[a.highestSeverity] - SEVERITY_WEIGHTS[b.highestSeverity];
    } else if (sortBy === "usage") {
      diff = a.totalUsageCount - b.totalUsageCount;
    } else if (sortBy === "version") {
      diff = a.versionNumber - b.versionNumber;
    } else if (sortBy === "subject") {
      diff = a.subjectName.localeCompare(b.subjectName);
    } else {
      // created
      diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    }
    return sortOrder === "asc" ? diff : -diff;
  });

  // 9. Pagination
  const totalCount = filteredItems.length;
  const totalPages = Math.ceil(totalCount / pageSize);
  const startIndex = (page - 1) * pageSize;
  const paginatedItems = filteredItems.slice(startIndex, startIndex + pageSize);

  return {
    items: paginatedItems,
    pagination: {
      totalCount,
      page,
      pageSize,
      totalPages,
    },
    filterOptions: {
      levels: allLevels,
      versions: allVersions,
      subjects: allSubjects,
      selectedLevelCode: targetLevelCode,
    },
    metrics: {
      totalQuestionsNeedingAttention,
      criticalCount,
      highCount,
      mediumCount,
      unreviewedCount,
      obsoleteCurriculumCount,
      retiredCount,
      weakExplanationCount,
      needsChangesCount,
      zeroUsageCount,
    },
  };
}

/**
 * Records an administrative review decision for a question.
 */
export async function recordQuestionReviewDecision(
  input: RecordReviewInput
): Promise<RecordReviewResult> {
  // 1. Verify Question Exists
  const [q] = await db
    .select({ id: questions.id })
    .from(questions)
    .where(eq(questions.id, input.questionId))
    .limit(1);

  if (!q) {
    throw new Error("Question not found.");
  }

  // 2. Resolve target question version
  let targetVersionId = input.versionId;
  if (!targetVersionId) {
    const [activeVer] = await db
      .select({ id: questionVersions.id })
      .from(questionVersions)
      .where(
        and(
          eq(questionVersions.questionId, input.questionId),
          eq(questionVersions.isActive, true)
        )
      )
      .limit(1);

    if (!activeVer) {
      const [latestVer] = await db
        .select({ id: questionVersions.id })
        .from(questionVersions)
        .where(eq(questionVersions.questionId, input.questionId))
        .orderBy(desc(questionVersions.versionNumber))
        .limit(1);

      if (!latestVer) {
        throw new Error("No question versions exist for this question.");
      }
      targetVersionId = latestVer.id;
    } else {
      targetVersionId = activeVer.id;
    }
  }

  const reviewerEmail = input.reviewerEmail || "admin@caprep.pro";

  // 3. Insert Review Decision
  const [inserted] = await db
    .insert(questionReviews)
    .values({
      questionId: input.questionId,
      questionVersionId: targetVersionId,
      reviewedBy: reviewerEmail,
      decision: input.decision,
      notes: input.notes?.trim() || null,
    })
    .returning();

  const decisionLabels: Record<ReviewDecision, string> = {
    ACCEPTED: "Question marked as Accepted / Verified.",
    REVIEWED: "Question marked as Reviewed.",
    NEEDS_CHANGES: "Question flagged as Needs Changes.",
    DISMISSED: "Attention flag dismissed by reviewer.",
  };

  return {
    success: true,
    reviewId: inserted.id,
    decision: input.decision,
    message: decisionLabels[input.decision] || "Review decision recorded.",
  };
}

/**
 * Retrieves the full review history and audit timeline for a question.
 */
export async function getQuestionReviewHistory(
  questionId: string
): Promise<ReviewHistoryRecord[]> {
  const records = await db
    .select({
      id: questionReviews.id,
      questionId: questionReviews.questionId,
      questionVersionId: questionReviews.questionVersionId,
      versionNumber: questionVersions.versionNumber,
      reviewedBy: questionReviews.reviewedBy,
      decision: questionReviews.decision,
      notes: questionReviews.notes,
      createdAt: questionReviews.createdAt,
    })
    .from(questionReviews)
    .innerJoin(questionVersions, eq(questionReviews.questionVersionId, questionVersions.id))
    .where(eq(questionReviews.questionId, questionId))
    .orderBy(desc(questionReviews.createdAt));

  return records.map((r) => ({
    id: r.id,
    questionId: r.questionId,
    questionVersionId: r.questionVersionId,
    versionNumber: r.versionNumber,
    reviewedBy: r.reviewedBy,
    decision: r.decision as ReviewDecision,
    notes: r.notes,
    createdAt: r.createdAt,
  }));
}
