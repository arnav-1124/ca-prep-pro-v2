import { db } from "@/db";
import {
  importBatches,
  importedQuestions,
  importAuditEvents,
  questions,
  questionVersions,
  questionOptions,
  questionSources,
  caseStudies,
  academicLevels,
  curriculumVersions,
  subjects,
  curriculumNodes,
} from "@/db/schema";
import { eq, and, desc, asc, count, isNull, ne } from "drizzle-orm";
import {
  RawImportQuestionJson,
  QuestionSourceType,
  RejectionReason,
  EditQuestionPayload,
} from "./types";
import { validateImportBatch, validateImportQuestion } from "./validation";
import { buildVersionCurriculumContext, resolveQuestionCurriculum } from "./mapping";
import { fetchDuplicateCandidates, checkQuestionDuplicate } from "./duplicates";

export interface CreateImportBatchInput {
  rawJsonString: string;
  batchName?: string;
  academicLevelId: string;
  curriculumVersionId: string;
  subjectId?: string;
  sourceType?: QuestionSourceType;
  sourceTitle?: string;
  sourceYear?: number;
  sourceMonth?: number;
  adminEmail: string;
}

/**
 * Creates an import batch from raw JSON, parses and validates each question,
 * runs in-memory curriculum mapping and duplicate checks, and writes to staging tables.
 */
export async function createImportBatch(input: CreateImportBatchInput) {
  let parsedPayload: unknown;
  try {
    parsedPayload = JSON.parse(input.rawJsonString);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Malformed JSON syntax";
    throw new Error(`JSON parsing failed: ${errorMsg}`);
  }

  // 1. Validate Batch Structure
  const validationResult = validateImportBatch(parsedPayload);
  if (validationResult.batchErrors.length > 0) {
    throw new Error(validationResult.batchErrors.join(". "));
  }

  // 2. Load Curriculum Context for Target Version
  const curriculumCtx = await buildVersionCurriculumContext(
    input.academicLevelId,
    input.curriculumVersionId
  );
  if (!curriculumCtx) {
    throw new Error("Specified academic level or curriculum version was not found.");
  }

  // 3. Pre-fetch Live Duplicate Candidates
  const duplicateCandidates = await fetchDuplicateCandidates(
    input.academicLevelId,
    input.subjectId || null
  );

  // 4. Determine Batch Header Metadata
  const payloadObj = (!Array.isArray(parsedPayload) && typeof parsedPayload === "object" ? parsedPayload : {}) as Partial<import("./types").CanonicalBatchJson>;
  const schemaVersion = payloadObj.schemaVersion?.trim() || "2.0";
  const batchSourceType = input.sourceType || payloadObj.sourceType || "STUDY_MATERIAL";
  const batchSourceTitle = input.sourceTitle || payloadObj.sourceTitle || null;
  const batchSourceYear = input.sourceYear || payloadObj.sourceYear || null;
  const batchSourceMonth = input.sourceMonth || payloadObj.sourceMonth || null;

  const fallbackName = `Import — ${curriculumCtx.academicLevel.name} (${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })})`;
  const batchName = input.batchName?.trim() || payloadObj.batchName?.trim() || fallbackName;

  // Build batch case studies lookup map
  const batchCaseStudiesMap = new Map<string, { caseStudyRef?: string; title: string; scenarioText: string }>();
  if (Array.isArray(payloadObj.caseStudies)) {
    for (const cs of payloadObj.caseStudies) {
      if (cs && typeof cs === "object") {
        if (cs.caseStudyRef) batchCaseStudiesMap.set(cs.caseStudyRef.trim(), cs);
        if (cs.title) batchCaseStudiesMap.set(cs.title.trim(), cs);
      }
    }
  }

  // 5. Insert `import_batches` Header
  const [createdBatch] = await db
    .insert(importBatches)
    .values({
      batchName,
      schemaVersion,
      academicLevelId: input.academicLevelId,
      curriculumVersionId: input.curriculumVersionId,
      subjectId: input.subjectId || null,
      sourceType: batchSourceType,
      sourceTitle: batchSourceTitle,
      sourceYear: batchSourceYear,
      sourceMonth: batchSourceMonth,
      status: "PENDING_REVIEW",
      totalQuestions: validationResult.totalQuestions,
      validQuestionsCount: validationResult.validCount,
      invalidQuestionsCount: validationResult.invalidCount,
      pendingReviewCount: validationResult.totalQuestions,
      createdByUserEmail: input.adminEmail,
    })
    .returning();

  let duplicateCount = 0;
  let mappedCount = 0;
  const rowsToInsert: (typeof importedQuestions.$inferInsert)[] = [];

  // 6. Process and Insert Staging Questions
  for (let i = 0; i < validationResult.questionResults.length; i++) {
    const qResult = validationResult.questionResults[i];
    const rawQuestion = (
      Array.isArray(parsedPayload)
        ? parsedPayload[i]
        : (parsedPayload as import("./types").CanonicalBatchJson).questions[i]
    ) as import("./types").CanonicalQuestionJson;

    // Resolve case study from batch-level map if referenced
    if (rawQuestion.caseStudyRef && !rawQuestion.caseStudy) {
      const resolvedCs = batchCaseStudiesMap.get(rawQuestion.caseStudyRef.trim());
      if (resolvedCs) {
        rawQuestion.caseStudy = resolvedCs;
      }
    }

    // Curriculum Mapping
    const mappingResult = resolveQuestionCurriculum(
      rawQuestion,
      curriculumCtx,
      input.subjectId || null
    );

    // Duplicate Detection (if structurally valid)
    let duplicateResult: import("./types").DuplicateDetectionResult = {
      status: "NO_DUPLICATE",
      similarityScore: 0,
      candidateQuestionId: null,
      candidateVersionId: null,
      matchReason: null,
    };

    if (qResult.isValid) {
      duplicateResult = checkQuestionDuplicate(rawQuestion, duplicateCandidates);
      if (duplicateResult.status !== "NO_DUPLICATE") {
        duplicateCount++;
      }
    }

    if (mappingResult.status !== "UNMAPPED") {
      mappedCount++;
    }

    const questionPreview = rawQuestion.questionText
      ? rawQuestion.questionText.slice(0, 300)
      : `Question #${i + 1} (Empty)`;

    const initialStatus = qResult.isValid ? "PENDING_REVIEW" : "VALIDATION_FAILED";

    rowsToInsert.push({
      batchId: createdBatch.id,
      questionIndex: i + 1,
      rawPayload: rawQuestion,
      questionTextPreview: questionPreview,
      questionType: rawQuestion.questionType || "MCQ",
      difficulty: rawQuestion.difficulty || "MEDIUM",
      status: initialStatus,
      validationStatus: qResult.isValid ? (qResult.hasWarnings ? "WARNING" : "VALID") : "INVALID",
      validationErrors: qResult.errors.length > 0 ? qResult.errors : null,
      validationWarnings: qResult.warnings.length > 0 ? qResult.warnings : null,
      curriculumMappingStatus: mappingResult.status,
      academicLevelId: mappingResult.academicLevelId,
      curriculumVersionId: mappingResult.curriculumVersionId,
      subjectId: mappingResult.subjectId,
      curriculumNodeId: mappingResult.curriculumNodeId,
      duplicateStatus: duplicateResult.status,
      duplicateCandidateQuestionId: duplicateResult.candidateQuestionId,
      duplicateCandidateVersionId: duplicateResult.candidateVersionId,
      duplicateSimilarityScore: duplicateResult.similarityScore || null,
      duplicateMatchReason: duplicateResult.matchReason,
    });
  }

  // 6. Bulk Insert Staged Questions in Chunks of 50
  const CHUNK_SIZE = 50;
  for (let c = 0; c < rowsToInsert.length; c += CHUNK_SIZE) {
    const chunk = rowsToInsert.slice(c, c + CHUNK_SIZE);
    await db.insert(importedQuestions).values(chunk);
  }

  // 7. Update batch statistics with duplicate count
  await db
    .update(importBatches)
    .set({
      duplicateCandidatesCount: duplicateCount,
      updatedAt: new Date(),
    })
    .where(eq(importBatches.id, createdBatch.id));

  // 8. Record Audit Event
  await db.insert(importAuditEvents).values({
    batchId: createdBatch.id,
    action: "BATCH_CREATED",
    performedBy: input.adminEmail || "system@caprep.pro",
    details: {
      totalQuestions: validationResult.totalQuestions,
      validCount: validationResult.validCount,
      invalidCount: validationResult.invalidCount,
      duplicateCount,
      academicLevelId: input.academicLevelId,
      curriculumVersionId: input.curriculumVersionId,
    },
  });

  return {
    batchId: createdBatch.id,
    batchName,
    totalQuestions: validationResult.totalQuestions,
    validCount: validationResult.validCount,
    validQuestions: validationResult.validCount,
    invalidCount: validationResult.invalidCount,
    invalidQuestions: validationResult.invalidCount,
    mappedQuestions: mappedCount,
    duplicateCandidatesCount: duplicateCount,
  };
}

/**
 * Fetches paginated list of import batches with filters.
 */
export async function getImportBatchesData(params: {
  levelCode?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(50, Math.max(5, params.pageSize || 10));
  const offset = (page - 1) * pageSize;

  const whereConditions = [];

  if (params.levelCode && params.levelCode !== "ALL") {
    const [level] = await db
      .select({ id: academicLevels.id })
      .from(academicLevels)
      .where(eq(academicLevels.code, params.levelCode.toUpperCase()))
      .limit(1);
    if (level) {
      whereConditions.push(eq(importBatches.academicLevelId, level.id));
    }
  }

  if (params.status && params.status !== "ALL") {
    whereConditions.push(eq(importBatches.status, params.status));
  }

  const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

  const [totalRow] = await db
    .select({ count: count() })
    .from(importBatches)
    .where(whereClause);

  const totalBatches = totalRow?.count || 0;
  const totalPages = Math.ceil(totalBatches / pageSize) || 1;

  const batches = await db
    .select({
      id: importBatches.id,
      batchName: importBatches.batchName,
      sourceType: importBatches.sourceType,
      sourceTitle: importBatches.sourceTitle,
      sourceYear: importBatches.sourceYear,
      sourceMonth: importBatches.sourceMonth,
      status: importBatches.status,
      totalQuestions: importBatches.totalQuestions,
      validQuestionsCount: importBatches.validQuestionsCount,
      invalidQuestionsCount: importBatches.invalidQuestionsCount,
      duplicateCandidatesCount: importBatches.duplicateCandidatesCount,
      approvedCount: importBatches.approvedCount,
      rejectedCount: importBatches.rejectedCount,
      pendingReviewCount: importBatches.pendingReviewCount,
      publishedCount: importBatches.publishedCount,
      createdByUserEmail: importBatches.createdByUserEmail,
      createdAt: importBatches.createdAt,
      levelCode: academicLevels.code,
      levelName: academicLevels.name,
      versionName: curriculumVersions.name,
      subjectName: subjects.name,
    })
    .from(importBatches)
    .innerJoin(academicLevels, eq(importBatches.academicLevelId, academicLevels.id))
    .innerJoin(curriculumVersions, eq(importBatches.curriculumVersionId, curriculumVersions.id))
    .leftJoin(subjects, eq(importBatches.subjectId, subjects.id))
    .where(whereClause)
    .orderBy(desc(importBatches.createdAt))
    .limit(pageSize)
    .offset(offset);

  // Fetch Academic Levels for filter toolbar
  const levels = await db
    .select({
      id: academicLevels.id,
      code: academicLevels.code,
      name: academicLevels.name,
    })
    .from(academicLevels);

  return {
    batches,
    levels,
    pagination: {
      page,
      pageSize,
      totalCount: totalBatches,
      totalPages,
    },
  };
}

/**
 * Fetches batch detail and summary.
 */
export async function getImportBatchDetailData(batchId: string) {
  const [batch] = await db
    .select({
      id: importBatches.id,
      batchName: importBatches.batchName,
      academicLevelId: importBatches.academicLevelId,
      curriculumVersionId: importBatches.curriculumVersionId,
      subjectId: importBatches.subjectId,
      sourceType: importBatches.sourceType,
      sourceTitle: importBatches.sourceTitle,
      sourceYear: importBatches.sourceYear,
      sourceMonth: importBatches.sourceMonth,
      status: importBatches.status,
      totalQuestions: importBatches.totalQuestions,
      validQuestionsCount: importBatches.validQuestionsCount,
      invalidQuestionsCount: importBatches.invalidQuestionsCount,
      duplicateCandidatesCount: importBatches.duplicateCandidatesCount,
      approvedCount: importBatches.approvedCount,
      rejectedCount: importBatches.rejectedCount,
      pendingReviewCount: importBatches.pendingReviewCount,
      publishedCount: importBatches.publishedCount,
      createdByUserEmail: importBatches.createdByUserEmail,
      createdAt: importBatches.createdAt,
      updatedAt: importBatches.updatedAt,
      levelCode: academicLevels.code,
      levelName: academicLevels.name,
      versionName: curriculumVersions.name,
      subjectName: subjects.name,
    })
    .from(importBatches)
    .innerJoin(academicLevels, eq(importBatches.academicLevelId, academicLevels.id))
    .innerJoin(curriculumVersions, eq(importBatches.curriculumVersionId, curriculumVersions.id))
    .leftJoin(subjects, eq(importBatches.subjectId, subjects.id))
    .where(eq(importBatches.id, batchId))
    .limit(1);

  if (!batch) return null;

  // Fetch recent audit logs for this batch
  const audits = await db
    .select()
    .from(importAuditEvents)
    .where(eq(importAuditEvents.batchId, batchId))
    .orderBy(desc(importAuditEvents.createdAt))
    .limit(10);

  return { batch, audits };
}

/**
 * Fetches imported questions for a batch with filters and question index list for quick navigation.
 */
export async function getBatchQuestionsList(params: {
  batchId: string;
  statusFilter?: string;
  mappingFilter?: string;
  duplicateFilter?: string;
}) {
  const whereClauses = [eq(importedQuestions.batchId, params.batchId)];

  if (params.statusFilter && params.statusFilter !== "ALL") {
    whereClauses.push(eq(importedQuestions.status, params.statusFilter));
  }
  if (params.mappingFilter && params.mappingFilter !== "ALL") {
    whereClauses.push(eq(importedQuestions.curriculumMappingStatus, params.mappingFilter));
  }
  if (params.duplicateFilter && params.duplicateFilter !== "ALL") {
    whereClauses.push(eq(importedQuestions.duplicateStatus, params.duplicateFilter));
  }

  const items = await db
    .select({
      id: importedQuestions.id,
      questionIndex: importedQuestions.questionIndex,
      questionTextPreview: importedQuestions.questionTextPreview,
      questionType: importedQuestions.questionType,
      difficulty: importedQuestions.difficulty,
      status: importedQuestions.status,
      validationStatus: importedQuestions.validationStatus,
      curriculumMappingStatus: importedQuestions.curriculumMappingStatus,
      duplicateStatus: importedQuestions.duplicateStatus,
      duplicateSimilarityScore: importedQuestions.duplicateSimilarityScore,
      subjectId: importedQuestions.subjectId,
      curriculumNodeId: importedQuestions.curriculumNodeId,
      subjectName: subjects.name,
      nodeName: curriculumNodes.name,
      nodeCode: curriculumNodes.code,
    })
    .from(importedQuestions)
    .leftJoin(subjects, eq(importedQuestions.subjectId, subjects.id))
    .leftJoin(curriculumNodes, eq(importedQuestions.curriculumNodeId, curriculumNodes.id))
    .where(and(...whereClauses))
    .orderBy(asc(importedQuestions.questionIndex));

  return items;
}

/**
 * Fetches detailed review information for a single imported question,
 * including raw/edited payloads, duplicate candidate details, and sibling IDs.
 */
export async function getImportedQuestionReviewDetail(
  batchId: string,
  questionId?: string,
  questionIndex?: number
) {
  // If specific questionId is provided, lookup by ID, otherwise by index or default to first
  const query = db
    .select()
    .from(importedQuestions)
    .where(
      questionId
        ? and(eq(importedQuestions.batchId, batchId), eq(importedQuestions.id, questionId))
        : and(
            eq(importedQuestions.batchId, batchId),
            eq(importedQuestions.questionIndex, questionIndex || 1)
          )
    )
    .limit(1);

  const [question] = await query;
  if (!question) return null;

  // 1. Fetch Duplicate Candidate Preview if exists
  let candidateDetail = null;
  if (question.duplicateCandidateVersionId) {
    const [cand] = await db
      .select({
        questionId: questions.id,
        versionId: questionVersions.id,
        questionText: questionVersions.questionText,
        correctAnswer: questionVersions.correctAnswer,
        explanation: questionVersions.explanation,
        difficulty: questions.difficulty,
        subjectName: subjects.name,
        nodeName: curriculumNodes.name,
      })
      .from(questionVersions)
      .innerJoin(questions, eq(questionVersions.questionId, questions.id))
      .leftJoin(subjects, eq(questions.subjectId, subjects.id))
      .leftJoin(curriculumNodes, eq(questions.curriculumNodeId, curriculumNodes.id))
      .where(eq(questionVersions.id, question.duplicateCandidateVersionId))
      .limit(1);

    if (cand) {
      const options = await db
        .select()
        .from(questionOptions)
        .where(eq(questionOptions.questionVersionId, cand.versionId));
      candidateDetail = { ...cand, options };
    }
  }

  // 2. Fetch Resolved Node & Breadcrumbs
  let breadcrumbs = null;
  if (question.curriculumNodeId) {
    const [node] = await db
      .select({
        nodeId: curriculumNodes.id,
        nodeName: curriculumNodes.name,
        nodeCode: curriculumNodes.code,
        nodeType: curriculumNodes.type,
        subjectName: subjects.name,
        versionName: curriculumVersions.name,
        levelName: academicLevels.name,
      })
      .from(curriculumNodes)
      .innerJoin(curriculumVersions, eq(curriculumNodes.curriculumVersionId, curriculumVersions.id))
      .innerJoin(academicLevels, eq(curriculumVersions.academicLevelId, academicLevels.id))
      .leftJoin(subjects, eq(curriculumNodes.subjectId, subjects.id))
      .where(eq(curriculumNodes.id, question.curriculumNodeId))
      .limit(1);
    breadcrumbs = node;
  }

  // 3. Fetch All Available Curriculum Nodes for Manual Selection in Target Version
  const availableNodes = await db
    .select({
      id: curriculumNodes.id,
      code: curriculumNodes.code,
      name: curriculumNodes.name,
      type: curriculumNodes.type,
      subjectId: curriculumNodes.subjectId,
      subjectName: subjects.name,
    })
    .from(curriculumNodes)
    .innerJoin(subjects, eq(curriculumNodes.subjectId, subjects.id))
    .where(
      and(
        eq(curriculumNodes.curriculumVersionId, question.curriculumVersionId),
        eq(curriculumNodes.isActive, true)
      )
    )
    .orderBy(asc(subjects.sortOrder), asc(curriculumNodes.sortOrder));

  // 4. Fetch All Sibling Question Indexes for navigation strip
  const siblings = await db
    .select({
      id: importedQuestions.id,
      questionIndex: importedQuestions.questionIndex,
      status: importedQuestions.status,
      validationStatus: importedQuestions.validationStatus,
      duplicateStatus: importedQuestions.duplicateStatus,
    })
    .from(importedQuestions)
    .where(eq(importedQuestions.batchId, batchId))
    .orderBy(asc(importedQuestions.questionIndex));

  const currentIndex = siblings.findIndex((s) => s.id === question.id);
  const prevQuestion = currentIndex > 0 ? siblings[currentIndex - 1] : null;
  const nextQuestion = currentIndex < siblings.length - 1 ? siblings[currentIndex + 1] : null;

  return {
    question,
    candidateDetail,
    breadcrumbs,
    availableNodes,
    navigation: {
      total: siblings.length,
      currentIndex: currentIndex + 1,
      prevId: prevQuestion?.id || null,
      nextId: nextQuestion?.id || null,
      siblings,
    },
  };
}

/**
 * Approves an imported question.
 * Throws if question is structurally invalid, missing curriculum mapping, or if concurrent modification is detected.
 */
export async function approveImportedQuestion(
  importedQuestionId: string,
  adminEmail: string,
  expectedUpdatedAt?: Date | string
) {
  const [q] = await db
    .select()
    .from(importedQuestions)
    .where(eq(importedQuestions.id, importedQuestionId))
    .limit(1);

  if (!q) {
    throw new Error("Imported question not found.");
  }

  // 1. Optimistic Concurrency Check
  if (expectedUpdatedAt) {
    const expectedTime = new Date(expectedUpdatedAt).getTime();
    const actualTime = new Date(q.updatedAt).getTime();
    if (Math.abs(expectedTime - actualTime) > 1000) {
      throw new Error(
        `This question was modified by another administrator (${q.reviewedBy || "another reviewer"} at ${new Date(q.updatedAt).toLocaleTimeString()}). Please refresh the question before saving.`
      );
    }
  }

  // 2. Published Immutability Guard
  if (q.status === "PUBLISHED") {
    throw new Error("This question has already been published to the live Question Bank and cannot be modified.");
  }

  // 3. Validation Guard
  if (q.validationStatus === "INVALID") {
    throw new Error("Cannot approve an invalid question. Please edit and resolve validation errors first.");
  }

  // 4. Curriculum Mapping Guard
  if (
    !q.curriculumNodeId ||
    q.curriculumMappingStatus === "UNMAPPED" ||
    q.curriculumMappingStatus === "AMBIGUOUS_MATCH"
  ) {
    throw new Error("Cannot approve an unmapped question. Please assign a valid Chapter or Topic first.");
  }

  // 5. Active Node Guard
  const [node] = await db
    .select({ id: curriculumNodes.id, isActive: curriculumNodes.isActive })
    .from(curriculumNodes)
    .where(eq(curriculumNodes.id, q.curriculumNodeId))
    .limit(1);

  if (!node || !node.isActive) {
    throw new Error("The assigned curriculum node is inactive or no longer exists. Please re-assign to an active node.");
  }

  // 6. Idempotency Check
  if (q.status === "APPROVED") {
    return { success: true, alreadyApproved: true };
  }

  // Update status & clear rejection fields if re-approving
  await db
    .update(importedQuestions)
    .set({
      status: "APPROVED",
      rejectionReason: null,
      rejectionNotes: null,
      reviewedBy: adminEmail,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(importedQuestions.id, importedQuestionId));

  // Update batch statistics
  await recalculateBatchCounts(q.batchId);

  // Record audit
  await db.insert(importAuditEvents).values({
    batchId: q.batchId,
    importedQuestionId: q.id,
    action: "QUESTION_APPROVED",
    performedBy: adminEmail,
    details: {
      previousStatus: q.status,
      curriculumNodeId: q.curriculumNodeId,
    },
  });

  return { success: true };
}

/**
 * Rejects an imported question with reason and notes.
 * Guards against concurrent edits and already-published questions.
 */
export async function rejectImportedQuestion(
  importedQuestionId: string,
  rejectionReason: RejectionReason,
  rejectionNotes: string | undefined,
  adminEmail: string,
  expectedUpdatedAt?: Date | string
) {
  const [q] = await db
    .select()
    .from(importedQuestions)
    .where(eq(importedQuestions.id, importedQuestionId))
    .limit(1);

  if (!q) {
    throw new Error("Imported question not found.");
  }

  // 1. Optimistic Concurrency Check
  if (expectedUpdatedAt) {
    const expectedTime = new Date(expectedUpdatedAt).getTime();
    const actualTime = new Date(q.updatedAt).getTime();
    if (Math.abs(expectedTime - actualTime) > 1000) {
      throw new Error(
        `This question was modified by another administrator (${q.reviewedBy || "another reviewer"} at ${new Date(q.updatedAt).toLocaleTimeString()}). Please refresh the question before saving.`
      );
    }
  }

  // 2. Published Immutability Guard
  if (q.status === "PUBLISHED") {
    throw new Error("This question has already been published to the live Question Bank and cannot be rejected in staging.");
  }

  // 3. Idempotency Check
  if (
    q.status === "REJECTED" &&
    q.rejectionReason === rejectionReason &&
    (q.rejectionNotes || "") === (rejectionNotes || "")
  ) {
    return { success: true, alreadyRejected: true };
  }

  await db
    .update(importedQuestions)
    .set({
      status: "REJECTED",
      rejectionReason,
      rejectionNotes: rejectionNotes || null,
      reviewedBy: adminEmail,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(importedQuestions.id, importedQuestionId));

  await recalculateBatchCounts(q.batchId);

  await db.insert(importAuditEvents).values({
    batchId: q.batchId,
    importedQuestionId: q.id,
    action: "QUESTION_REJECTED",
    performedBy: adminEmail,
    details: {
      rejectionReason,
      rejectionNotes,
      previousStatus: q.status,
    },
  });

  return { success: true };
}

/**
 * Saves human edits for an imported question.
 * Guards against concurrent edits, validates payload, and verifies curriculum node status.
 */
export async function editImportedQuestion(
  importedQuestionId: string,
  editData: EditQuestionPayload,
  adminEmail: string,
  expectedUpdatedAt?: Date | string
) {
  const [q] = await db
    .select()
    .from(importedQuestions)
    .where(eq(importedQuestions.id, importedQuestionId))
    .limit(1);

  if (!q) {
    throw new Error("Imported question not found.");
  }

  // 1. Optimistic Concurrency Check
  if (expectedUpdatedAt) {
    const expectedTime = new Date(expectedUpdatedAt).getTime();
    const actualTime = new Date(q.updatedAt).getTime();
    if (Math.abs(expectedTime - actualTime) > 1000) {
      throw new Error(
        `This question was modified by another administrator (${q.reviewedBy || "another reviewer"} at ${new Date(q.updatedAt).toLocaleTimeString()}). Please refresh the question before saving.`
      );
    }
  }

  // 2. Published Immutability Guard
  if (q.status === "PUBLISHED") {
    throw new Error("This question has already been published to the live Question Bank and cannot be edited in staging.");
  }

  const effectiveCaseStudy =
    editData.caseStudy || ((q.rawPayload as { caseStudy?: { title: string; scenarioText: string } })?.caseStudy);

  // 3. Validate edited data
  const valResult = validateImportQuestion(
    {
      questionType: editData.questionType,
      questionText: editData.questionText,
      difficulty: editData.difficulty,
      options: editData.options,
      correctAnswer: editData.correctAnswer,
      explanation: editData.explanation,
      caseStudy: effectiveCaseStudy,
    },
    q.questionIndex
  );

  if (!valResult.isValid) {
    throw new Error(`Validation failed on edited data: ${valResult.errors.map((e) => e.message).join("; ")}`);
  }

  const mergedEditPayload = {
    ...editData,
    caseStudy: effectiveCaseStudy,
  };

  let newCurriculumNodeId = q.curriculumNodeId;
  let newSubjectId = q.subjectId;
  let newMappingStatus = q.curriculumMappingStatus;

  if (editData.curriculumNodeId) {
    newCurriculumNodeId = editData.curriculumNodeId;
    const [node] = await db
      .select({ subjectId: curriculumNodes.subjectId, isActive: curriculumNodes.isActive })
      .from(curriculumNodes)
      .where(eq(curriculumNodes.id, editData.curriculumNodeId))
      .limit(1);
    if (!node || !node.isActive) {
      throw new Error("Selected curriculum node is inactive or no longer exists.");
    }
    newSubjectId = node.subjectId;
    newMappingStatus = "MATCHED_DATABASE_ID";
  }

  await db
    .update(importedQuestions)
    .set({
      editedPayload: mergedEditPayload,
      questionTextPreview: editData.questionText.slice(0, 300),
      questionType: editData.questionType,
      difficulty: editData.difficulty,
      curriculumNodeId: newCurriculumNodeId,
      subjectId: newSubjectId,
      curriculumMappingStatus: newMappingStatus,
      validationStatus: valResult.hasWarnings ? "WARNING" : "VALID",
      validationErrors: null,
      validationWarnings: valResult.warnings.length > 0 ? valResult.warnings : null,
      reviewedBy: adminEmail,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(importedQuestions.id, importedQuestionId));

  await recalculateBatchCounts(q.batchId);

  await db.insert(importAuditEvents).values({
    batchId: q.batchId,
    importedQuestionId: q.id,
    action: "QUESTION_EDITED",
    performedBy: adminEmail,
    details: {
      editedFields: Object.keys(editData),
      previousStatus: q.status,
    },
  });

  return { success: true };
}

/**
 * Publishes all APPROVED questions in a batch to the live Question Bank.
 * 
 * Enforces:
 * 1. Idempotent re-run safety (skips already published items, zero duplicates).
 * 2. Pre-Publication Integrity Gate (in-memory curriculum & duplicate checks across all questions before live writes).
 * 3. Live duplicate collision prevention.
 * 4. Exact batch count synchronization.
 */
export async function publishApprovedQuestions(batchId: string, adminEmail: string) {
  const [batch] = await db
    .select()
    .from(importBatches)
    .where(eq(importBatches.id, batchId))
    .limit(1);

  if (!batch) {
    throw new Error("Import batch not found.");
  }

  if (batch.status === "COMPLETED") {
    return { publishedCount: 0, message: "Batch has already been fully published." };
  }

  // 1. Fetch all APPROVED questions that are NOT YET published
  const approvedList = await db
    .select()
    .from(importedQuestions)
    .where(
      and(
        eq(importedQuestions.batchId, batchId),
        eq(importedQuestions.status, "APPROVED"),
        isNull(importedQuestions.publishedQuestionId)
      )
    )
    .orderBy(asc(importedQuestions.questionIndex));

  if (approvedList.length === 0) {
    if (batch.publishedCount > 0) {
      return { publishedCount: 0, message: "All approved questions in this batch have already been published." };
    }
    throw new Error("No approved questions found in this batch to publish.");
  }

  // 2. Pre-Publication Integrity Gate (Active Curriculum Node Verification)
  const activeNodes = await db
    .select({
      id: curriculumNodes.id,
      name: curriculumNodes.name,
      code: curriculumNodes.code,
      isActive: curriculumNodes.isActive,
      subjectId: curriculumNodes.subjectId,
      curriculumVersionId: curriculumNodes.curriculumVersionId,
    })
    .from(curriculumNodes)
    .where(
      and(
        eq(curriculumNodes.curriculumVersionId, batch.curriculumVersionId),
        eq(curriculumNodes.isActive, true)
      )
    );

  const activeNodeMap = new Map(activeNodes.map((n) => [n.id, n]));

  // 3. Pre-Publication Interim Duplicate Detection Gate
  const liveDuplicateCandidates = await fetchDuplicateCandidates(batch.academicLevelId, batch.subjectId || null);

  // Validate ALL questions in-memory BEFORE touching any live database tables
  for (const item of approvedList) {
    if (!item.curriculumNodeId || !activeNodeMap.has(item.curriculumNodeId)) {
      throw new Error(
        `Publication blocked: Question #${item.questionIndex} references a Chapter/Topic that is inactive or no longer in the active syllabus version. Please re-map the question before publishing.`
      );
    }

    const node = activeNodeMap.get(item.curriculumNodeId)!;
    if (item.subjectId && item.subjectId !== node.subjectId) {
      throw new Error(
        `Publication blocked: Question #${item.questionIndex} has a subject mismatch with its mapped node (${node.code}). Please update mapping before publishing.`
      );
    }

    const effectivePayload = (item.editedPayload || item.rawPayload) as RawImportQuestionJson;
    const dupCheck = checkQuestionDuplicate(effectivePayload, liveDuplicateCandidates);
    if (dupCheck.status === "EXACT_DUPLICATE") {
      // Revert question to pending review with collision diagnostic
      await db
        .update(importedQuestions)
        .set({
          duplicateStatus: "EXACT_DUPLICATE",
          duplicateCandidateQuestionId: dupCheck.candidateQuestionId,
          duplicateCandidateVersionId: dupCheck.candidateVersionId,
          duplicateSimilarityScore: 100,
          duplicateMatchReason: "Interim Live Duplicate Collision at Publish Time",
          status: "PENDING_REVIEW",
          updatedAt: new Date(),
        })
        .where(eq(importedQuestions.id, item.id));

      await recalculateBatchCounts(batchId);

      throw new Error(
        `Publication blocked: Question #${item.questionIndex} collides with a live question version recently published in the Question Bank. It has been reverted to Pending Review for inspection.`
      );
    }
  }

  // 4. Sequential Idempotent Publication
  let publishedCount = 0;
  const caseStudyCache = new Map<string, string>();

  // Ensure batch question source exists if batch has sourceTitle
  let batchSourceId: string | null = null;
  if (batch.sourceTitle || batch.sourceType) {
    const [qs] = await db
      .insert(questionSources)
      .values({
        sourceType: batch.sourceType,
        sourceTitle: batch.sourceTitle || `${batch.sourceType} Reference`,
        sourceYear: batch.sourceYear,
        sourceMonth: batch.sourceMonth,
        importBatchId: batch.id,
      })
      .returning();
    batchSourceId = qs?.id || null;
  }

  for (const item of approvedList) {
    const effectivePayload = (item.editedPayload || item.rawPayload) as import("./types").CanonicalQuestionJson;
    const node = activeNodeMap.get(item.curriculumNodeId!)!;

    // Resolve or reuse Case Study if applicable
    let caseStudyId: string | null = null;
    if (item.questionType === "CASE_STUDY" && effectivePayload.caseStudy) {
      const csKey = effectivePayload.caseStudyRef || effectivePayload.caseStudy.title.trim();
      if (caseStudyCache.has(csKey)) {
        caseStudyId = caseStudyCache.get(csKey)!;
      } else {
        const [cs] = await db
          .insert(caseStudies)
          .values({
            academicLevelId: item.academicLevelId,
            subjectId: node.subjectId,
            title: effectivePayload.caseStudy.title,
            scenarioText: effectivePayload.caseStudy.scenarioText,
          })
          .returning();
        caseStudyId = cs.id;
        caseStudyCache.set(csKey, cs.id);
      }
    }

    // Insert live Question
    const [q] = await db
      .insert(questions)
      .values({
        academicLevelId: item.academicLevelId,
        subjectId: node.subjectId,
        curriculumNodeId: node.id,
        caseStudyId: caseStudyId,
        difficulty: item.difficulty,
        questionType: item.questionType,
        isAiGenerated: batch.sourceType === "AI_GENERATED",
      })
      .returning();

    // Prepare source metadata JSON
    const sourceMeta: Record<string, unknown> = {};
    if (effectivePayload.externalId) sourceMeta.externalId = effectivePayload.externalId;
    if (effectivePayload.source?.sourceAttempt) sourceMeta.sourceAttempt = effectivePayload.source.sourceAttempt;
    if (effectivePayload.source?.applicability) sourceMeta.applicability = effectivePayload.source.applicability;
    if (effectivePayload.source?.pageNumber || effectivePayload.pageNumber) {
      sourceMeta.pageNumber = effectivePayload.source?.pageNumber || effectivePayload.pageNumber;
    }
    if (effectivePayload.source?.sourceReference || effectivePayload.sourceReference) {
      sourceMeta.sourceReference = effectivePayload.source?.sourceReference || effectivePayload.sourceReference;
    }

    // Insert live Question Version
    const [qv] = await db
      .insert(questionVersions)
      .values({
        questionId: q.id,
        versionNumber: 1,
        questionText: effectivePayload.questionText,
        correctAnswer: effectivePayload.correctAnswer,
        explanation: effectivePayload.explanation || null,
        sourceId: batchSourceId,
        sourceMetadata: Object.keys(sourceMeta).length > 0 ? sourceMeta : null,
        isActive: true,
      })
      .returning();

    // Insert live Question Options
    if (Array.isArray(effectivePayload.options) && effectivePayload.options.length > 0) {
      await db.insert(questionOptions).values(
        effectivePayload.options.map((opt) => ({
          questionVersionId: qv.id,
          optionLetter: opt.letter.toUpperCase(),
          optionText: opt.text,
        }))
      );
    }

    // Mark staged question as PUBLISHED
    await db
      .update(importedQuestions)
      .set({
        status: "PUBLISHED",
        publishedQuestionId: q.id,
        publishedQuestionVersionId: qv.id,
        updatedAt: new Date(),
      })
      .where(eq(importedQuestions.id, item.id));

    publishedCount++;
  }

  // 5. Final Batch Count Synchronization
  await recalculateBatchCounts(batchId);

  // 6. Record Publication Audit Event
  await db.insert(importAuditEvents).values({
    batchId,
    action: "BATCH_PUBLISHED",
    performedBy: adminEmail,
    details: {
      publishedQuestionsCount: publishedCount,
    },
  });

  return { publishedCount };
}

/**
 * Bulk approves all valid and mapped questions in an import batch.
 * Skips invalid or unmapped questions so human review remains required for anomalies.
 */
export async function bulkApproveBatchQuestions(
  batchId: string,
  adminEmail: string
): Promise<{ approvedCount: number; newlyApprovedCount: number }> {
  const [batch] = await db
    .select()
    .from(importBatches)
    .where(eq(importBatches.id, batchId))
    .limit(1);

  if (!batch) {
    throw new Error("Import batch not found.");
  }

  if (batch.status === "COMPLETED") {
    throw new Error("This batch has already been completed and published.");
  }

  // Find all questions in PENDING_REVIEW that are valid and mapped
  const eligibleQuestions = await db
    .select({ id: importedQuestions.id })
    .from(importedQuestions)
    .where(
      and(
        eq(importedQuestions.batchId, batchId),
        eq(importedQuestions.status, "PENDING_REVIEW"),
        ne(importedQuestions.validationStatus, "INVALID"),
        ne(importedQuestions.curriculumMappingStatus, "UNMAPPED"),
        ne(importedQuestions.curriculumMappingStatus, "AMBIGUOUS_MATCH")
      )
    );

  const newlyApprovedCount = eligibleQuestions.length;

  if (newlyApprovedCount > 0) {
    await db
      .update(importedQuestions)
      .set({
        status: "APPROVED",
        rejectionReason: null,
        rejectionNotes: null,
        reviewedBy: adminEmail,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(importedQuestions.batchId, batchId),
          eq(importedQuestions.status, "PENDING_REVIEW"),
          ne(importedQuestions.validationStatus, "INVALID"),
          ne(importedQuestions.curriculumMappingStatus, "UNMAPPED"),
          ne(importedQuestions.curriculumMappingStatus, "AMBIGUOUS_MATCH")
        )
      );

    await recalculateBatchCounts(batchId);

    await db.insert(importAuditEvents).values({
      batchId,
      action: "BATCH_BULK_APPROVED",
      performedBy: adminEmail,
      details: {
        newlyApprovedCount,
      },
    });
  }

  const [updatedBatch] = await db
    .select({ approvedCount: importBatches.approvedCount })
    .from(importBatches)
    .where(eq(importBatches.id, batchId))
    .limit(1);

  return {
    approvedCount: updatedBatch?.approvedCount || 0,
    newlyApprovedCount,
  };
}

/**
 * Re-computes and syncs counts for an import batch.
 */
export async function recalculateBatchCounts(batchId: string) {
  const allQuestions = await db
    .select({
      status: importedQuestions.status,
      validationStatus: importedQuestions.validationStatus,
      duplicateStatus: importedQuestions.duplicateStatus,
    })
    .from(importedQuestions)
    .where(eq(importedQuestions.batchId, batchId));

  const total = allQuestions.length;
  const validCount = allQuestions.filter((q) => q.validationStatus !== "INVALID").length;
  const invalidCount = allQuestions.filter((q) => q.validationStatus === "INVALID").length;
  const duplicateCount = allQuestions.filter((q) => q.duplicateStatus !== "NO_DUPLICATE").length;
  const approvedCount = allQuestions.filter((q) => q.status === "APPROVED").length;
  const rejectedCount = allQuestions.filter((q) => q.status === "REJECTED").length;
  const publishedCount = allQuestions.filter((q) => q.status === "PUBLISHED").length;
  const pendingReviewCount = allQuestions.filter(
    (q) => q.status === "PENDING_REVIEW" || q.status === "VALIDATION_FAILED"
  ).length;

  let batchStatus = "PENDING_REVIEW";
  if (publishedCount > 0 && publishedCount === total) {
    batchStatus = "COMPLETED";
  } else if (publishedCount > 0 || approvedCount > 0) {
    batchStatus = "PARTIALLY_APPROVED";
  }

  await db
    .update(importBatches)
    .set({
      totalQuestions: total,
      validQuestionsCount: validCount,
      invalidQuestionsCount: invalidCount,
      duplicateCandidatesCount: duplicateCount,
      approvedCount,
      rejectedCount,
      publishedCount,
      pendingReviewCount,
      status: batchStatus,
      updatedAt: new Date(),
    })
    .where(eq(importBatches.id, batchId));
}

