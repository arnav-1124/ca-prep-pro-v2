import { db } from "@/db";
import {
  questions,
  questionVersions,
  questionOptions,
  questionSources,
  caseStudies,
  curriculumNodes,
  academicLevels,
  curriculumVersions,
  practiceAttempts,
  practiceSessionQuestions,
  testQuestions,
  aiConversations,
} from "@/db/schema";
import { eq, and, desc, inArray, sql } from "drizzle-orm";
import { validateImportQuestion } from "../import/validation";

import {
  UpdateQuestionInput,
  UpdateQuestionResult,
  ToggleQuestionStatusInput,
  DeleteQuestionInput,
  DeleteQuestionResult,
  ExportQuestionsInput,
  ExportQuestionsResult,
} from "./types";
import { QuestionBankFilterParams, getAdminQuestionBankData } from "../services";

/**
 * Updates a question with strict versioning and concurrency controls.
 * If historical student practice attempts or test usages exist, content modifications
 * automatically create a new Question Version snapshot to protect historical grading integrity.
 */
export async function updateAdminQuestion(input: UpdateQuestionInput): Promise<UpdateQuestionResult> {
  // 1. Fetch Question with its active version
  const [q] = await db
    .select({
      id: questions.id,
      academicLevelId: questions.academicLevelId,
      subjectId: questions.subjectId,
      curriculumNodeId: questions.curriculumNodeId,
      caseStudyId: questions.caseStudyId,
      difficulty: questions.difficulty,
      questionType: questions.questionType,
      isAiGenerated: questions.isAiGenerated,
      createdAt: questions.createdAt,
    })
    .from(questions)
    .where(eq(questions.id, input.questionId))
    .limit(1);

  if (!q) {
    throw new Error("Question not found.");
  }

  // 2. Fetch all versions of this question to find max version and active version
  const allVersions = await db
    .select()
    .from(questionVersions)
    .where(eq(questionVersions.questionId, input.questionId))
    .orderBy(desc(questionVersions.versionNumber));

  if (allVersions.length === 0) {
    throw new Error("Question has no version records.");
  }

  const activeVersion = allVersions.find((v) => v.isActive) || allVersions[0];
  const maxVersionNumber = Math.max(...allVersions.map((v) => v.versionNumber));

  // 3. Optimistic Concurrency Check
  if (input.expectedUpdatedAt) {
    const expectedTime = new Date(input.expectedUpdatedAt).getTime();
    const actualTime = new Date(activeVersion.createdAt).getTime();
    if (Math.abs(expectedTime - actualTime) > 1000) {
      throw new Error("This question was modified by another administrator. Please refresh before saving.");
    }
  }

  // 4. Validate Edited Payload
  const validation = validateImportQuestion({
    questionType: input.questionType,
    questionText: input.questionText,
    difficulty: input.difficulty,
    options: input.options,
    correctAnswer: input.correctAnswer,
    explanation: input.explanation,
    caseStudy: input.caseStudy || undefined,
  });

  if (!validation.isValid) {
    throw new Error(`Validation failed: ${validation.errors.map((e) => e.message).join("; ")}`);
  }

  // 5. Verify Target Curriculum Node
  const [targetNode] = await db
    .select({
      id: curriculumNodes.id,
      subjectId: curriculumNodes.subjectId,
      curriculumVersionId: curriculumNodes.curriculumVersionId,
      isActive: curriculumNodes.isActive,
      name: curriculumNodes.name,
      code: curriculumNodes.code,
    })
    .from(curriculumNodes)
    .where(eq(curriculumNodes.id, input.curriculumNodeId))
    .limit(1);

  if (!targetNode || !targetNode.isActive) {
    throw new Error("Selected Chapter / Topic is inactive or does not exist. Please select an active curriculum node.");
  }

  // 6. Check Historical Reference Dependencies across all versions
  const versionIds = allVersions.map((v) => v.id);

  const [practiceCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(practiceAttempts)
    .where(inArray(practiceAttempts.questionVersionId, versionIds));

  const [testCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(testQuestions)
    .where(eq(testQuestions.questionId, input.questionId));

  const hasHistoricalAttempts = (Number(practiceCount?.count) || 0) > 0 || (Number(testCount?.count) || 0) > 0;

  // 7. Check if options or content changed
  const existingOptions = await db
    .select()
    .from(questionOptions)
    .where(eq(questionOptions.questionVersionId, activeVersion.id))
    .orderBy(questionOptions.optionLetter);

  const optionsChanged =
    existingOptions.length !== input.options.length ||
    input.options.some((opt, idx) => {
      const ex = existingOptions[idx];
      return !ex || ex.optionLetter !== opt.letter || ex.optionText.trim() !== opt.text.trim();
    });

  const contentChanged =
    activeVersion.questionText.trim() !== input.questionText.trim() ||
    activeVersion.correctAnswer !== input.correctAnswer ||
    (activeVersion.explanation || "").trim() !== (input.explanation || "").trim() ||
    optionsChanged;

  // Decision: Create new version vs Update in-place
  const shouldCreateNewVersion = input.createNewVersion || (hasHistoricalAttempts && contentChanged);

  let targetVersionId = activeVersion.id;
  let resultVersionNumber = activeVersion.versionNumber;

  // 8. Handle Case Study Relationship
  let targetCaseStudyId = q.caseStudyId;
  if (input.questionType === "CASE_STUDY" && input.caseStudy) {
    if (q.caseStudyId) {
      await db
        .update(caseStudies)
        .set({
          title: input.caseStudy.title,
          scenarioText: input.caseStudy.scenarioText,
          subjectId: targetNode.subjectId,
        })
        .where(eq(caseStudies.id, q.caseStudyId));
    } else {
      const [newCs] = await db
        .insert(caseStudies)
        .values({
          academicLevelId: q.academicLevelId,
          subjectId: targetNode.subjectId,
          title: input.caseStudy.title,
          scenarioText: input.caseStudy.scenarioText,
        })
        .returning();
      targetCaseStudyId = newCs.id;
    }
  } else if (input.questionType !== "CASE_STUDY") {
    targetCaseStudyId = null;
  }

  // 9. Execute Versioning or In-Place Mutation
  if (shouldCreateNewVersion) {
    resultVersionNumber = maxVersionNumber + 1;

    // Deactivate previous active version
    await db
      .update(questionVersions)
      .set({ isActive: false })
      .where(eq(questionVersions.questionId, input.questionId));

    // Create new version snapshot
    const [newVer] = await db
      .insert(questionVersions)
      .values({
        questionId: input.questionId,
        versionNumber: resultVersionNumber,
        questionText: input.questionText,
        correctAnswer: input.correctAnswer,
        explanation: input.explanation || null,
        sourceId: activeVersion.sourceId,
        sourceMetadata: activeVersion.sourceMetadata,
        isActive: true,
      })
      .returning();

    targetVersionId = newVer.id;

    // Insert new options
    if (input.options.length > 0) {
      await db.insert(questionOptions).values(
        input.options.map((opt) => ({
          questionVersionId: newVer.id,
          optionLetter: opt.letter.toUpperCase(),
          optionText: opt.text,
        }))
      );
    }
  } else {
    // In-place update (safe when 0 historical attempts exist)
    await db
      .update(questionVersions)
      .set({
        questionText: input.questionText,
        correctAnswer: input.correctAnswer,
        explanation: input.explanation || null,
      })
      .where(eq(questionVersions.id, activeVersion.id));

    // Refresh options
    await db.delete(questionOptions).where(eq(questionOptions.questionVersionId, activeVersion.id));
    if (input.options.length > 0) {
      await db.insert(questionOptions).values(
        input.options.map((opt) => ({
          questionVersionId: activeVersion.id,
          optionLetter: opt.letter.toUpperCase(),
          optionText: opt.text,
        }))
      );
    }
  }

  // 10. Update Question Root Metadata (Curriculum node, subject, type, difficulty, caseStudyId)
  await db
    .update(questions)
    .set({
      subjectId: targetNode.subjectId,
      curriculumNodeId: targetNode.id,
      difficulty: input.difficulty,
      questionType: input.questionType,
      caseStudyId: targetCaseStudyId,
    })
    .where(eq(questions.id, input.questionId));

  return {
    success: true,
    questionId: input.questionId,
    versionId: targetVersionId,
    versionNumber: resultVersionNumber,
    createdNewVersion: shouldCreateNewVersion,
    message: shouldCreateNewVersion
      ? `Question Version ${resultVersionNumber} created (historical attempts preserved on Version ${activeVersion.versionNumber}).`
      : "Question updated successfully.",
  };
}

/**
 * Toggles active/retired state on a question's current active version.
 */
export async function toggleQuestionActiveStatus(input: ToggleQuestionStatusInput) {
  const [activeVer] = await db
    .select()
    .from(questionVersions)
    .where(
      and(
        eq(questionVersions.questionId, input.questionId),
        eq(questionVersions.isActive, true)
      )
    )
    .limit(1);

  if (activeVer) {
    await db
      .update(questionVersions)
      .set({ isActive: input.isActive })
      .where(eq(questionVersions.id, activeVer.id));
  } else {
    // If no version was active, activate the latest version
    const [latest] = await db
      .select()
      .from(questionVersions)
      .where(eq(questionVersions.questionId, input.questionId))
      .orderBy(desc(questionVersions.versionNumber))
      .limit(1);

    if (latest) {
      await db
        .update(questionVersions)
        .set({ isActive: input.isActive })
        .where(eq(questionVersions.id, latest.id));
    }
  }

  return { success: true, isActive: input.isActive };
}

/**
 * Deletes a question only if it has zero historical references.
 * Blocks hard deletion if practice attempts, test usages, or AI conversations exist.
 */
export async function deleteAdminQuestion(input: DeleteQuestionInput): Promise<DeleteQuestionResult> {
  // 1. Fetch all version IDs
  const versions = await db
    .select({ id: questionVersions.id })
    .from(questionVersions)
    .where(eq(questionVersions.questionId, input.questionId));

  const versionIds = versions.map((v) => v.id);

  // 2. Count Reference Dependencies
  const [practiceCount] = versionIds.length > 0
    ? await db
        .select({ count: sql<number>`count(*)::int` })
        .from(practiceAttempts)
        .where(inArray(practiceAttempts.questionVersionId, versionIds))
    : [{ count: 0 }];

  const [sessionQuestionCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(practiceSessionQuestions)
    .where(eq(practiceSessionQuestions.questionId, input.questionId));

  const [testCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(testQuestions)
    .where(eq(testQuestions.questionId, input.questionId));

  const [aiCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(aiConversations)
    .where(eq(aiConversations.questionId, input.questionId));

  const pCount = Number(practiceCount?.count) || 0;
  const sqCount = Number(sessionQuestionCount?.count) || 0;
  const tCount = Number(testCount?.count) || 0;
  const aCount = Number(aiCount?.count) || 0;

  if (pCount > 0 || sqCount > 0 || tCount > 0 || aCount > 0) {
    throw new Error(
      `Cannot hard delete question: This question has ${pCount} student practice attempts, ${sqCount} session delivery records, ${tCount} mock test questions, and ${aCount} AI conversations. Please deactivate or retire it instead to preserve student preparation history.`
    );
  }

  // 3. Delete Question Options, Versions, and Root Question
  if (versionIds.length > 0) {
    await db.delete(questionOptions).where(inArray(questionOptions.questionVersionId, versionIds));
    await db.delete(questionVersions).where(eq(questionVersions.questionId, input.questionId));
  }

  // Check if case study is orphaned
  const [q] = await db
    .select({ caseStudyId: questions.caseStudyId })
    .from(questions)
    .where(eq(questions.id, input.questionId))
    .limit(1);

  await db.delete(questions).where(eq(questions.id, input.questionId));

  if (q?.caseStudyId) {
    const otherQs = await db
      .select({ id: questions.id })
      .from(questions)
      .where(eq(questions.caseStudyId, q.caseStudyId))
      .limit(1);

    if (otherQs.length === 0) {
      await db.delete(caseStudies).where(eq(caseStudies.id, q.caseStudyId));
    }
  }

  return {
    success: true,
    message: "Question deleted permanently (zero historical dependencies found).",
    practiceAttemptsCount: pCount,
    testQuestionsCount: tCount,
    aiConversationsCount: aCount,
  };
}

/**
 * Exports Question Bank questions into canonical interchange JSON (Schema v2.0)
 * compatible with the Question Importer and authoring specifications.
 */
export async function exportQuestionsToCanonicalBatch(input: ExportQuestionsInput): Promise<ExportQuestionsResult> {
  const filterParams: QuestionBankFilterParams = {
    levelCode: input.levelCode || "INTERMEDIATE",
    curriculumVersionId: input.curriculumVersionId,
    subjectId: input.subjectId,
    curriculumNodeId: input.curriculumNodeId,
    questionType: input.questionType,
    difficulty: input.difficulty,
    sourceType: input.sourceType,
    status: input.status,
    searchQuery: input.searchQuery,
    page: 1,
    pageSize: input.limit || 5000,
  };

  const bankData = await getAdminQuestionBankData(filterParams);
  const questionsList = bankData.questions;

  // 1. Retrieve Academic Level details
  const [level] = await db
    .select()
    .from(academicLevels)
    .where(eq(academicLevels.code, filterParams.levelCode || "INTERMEDIATE"))
    .limit(1);

  // 2. Retrieve Curriculum Version details
  const [ver] = filterParams.curriculumVersionId
    ? await db
        .select()
        .from(curriculumVersions)
        .where(eq(curriculumVersions.id, filterParams.curriculumVersionId))
        .limit(1)
    : await db
        .select()
        .from(curriculumVersions)
        .where(and(eq(curriculumVersions.academicLevelId, level?.id || ""), eq(curriculumVersions.isActive, true)))
        .limit(1);

  // 3. Preload all version curriculum nodes to reconstruct hierarchy paths
  const allVersionNodes = ver
    ? await db
        .select({
          id: curriculumNodes.id,
          code: curriculumNodes.code,
          name: curriculumNodes.name,
          type: curriculumNodes.type,
          parentId: curriculumNodes.parentId,
          subjectId: curriculumNodes.subjectId,
        })
        .from(curriculumNodes)
        .where(eq(curriculumNodes.curriculumVersionId, ver.id))
    : [];

  const nodeMap = new Map(allVersionNodes.map((n) => [n.id, n]));

  // 4. Fetch full details for each question version (un-truncated questionText, explanation, source metadata)
  const versionIds = questionsList.map((q) => q.activeVersionId).filter(Boolean);

  const options = versionIds.length > 0
    ? await db
        .select()
        .from(questionOptions)
        .where(inArray(questionOptions.questionVersionId, versionIds))
        .orderBy(questionOptions.optionLetter)
    : [];

  const optionsMap = new Map<string, { letter: string; text: string }[]>();
  for (const opt of options) {
    const list = optionsMap.get(opt.questionVersionId) || [];
    list.push({ letter: opt.optionLetter, text: opt.optionText });
    optionsMap.set(opt.questionVersionId, list);
  }

  // Fetch full un-truncated question versions & sources
  const fullVersions = versionIds.length > 0
    ? await db
        .select({
          id: questionVersions.id,
          questionId: questionVersions.questionId,
          versionNumber: questionVersions.versionNumber,
          questionText: questionVersions.questionText,
          correctAnswer: questionVersions.correctAnswer,
          explanation: questionVersions.explanation,
          sourceId: questionVersions.sourceId,
          sourceMetadata: questionVersions.sourceMetadata,
          sourceType: questionSources.sourceType,
          sourceTitle: questionSources.sourceTitle,
          sourceYear: questionSources.sourceYear,
          sourceMonth: questionSources.sourceMonth,
          paperNumber: questionSources.paperNumber,
        })
        .from(questionVersions)
        .leftJoin(questionSources, eq(questionVersions.sourceId, questionSources.id))
        .where(inArray(questionVersions.id, versionIds))
    : [];

  const versionDetailMap = new Map(fullVersions.map((fv) => [fv.id, fv]));

  // Fetch Case Studies
  const caseStudyIds = questionsList.map((q) => q.caseStudyId).filter((id): id is string => id !== null);
  const csList = caseStudyIds.length > 0
    ? await db
        .select()
        .from(caseStudies)
        .where(inArray(caseStudies.id, caseStudyIds))
    : [];

  const csMap = new Map(csList.map((cs) => [cs.id, cs]));

  // Deduplicate and structure batch-level case studies
  const batchCaseStudies: import("../import/types").CanonicalCaseStudyJson[] = [];
  const csIdToRefMap = new Map<string, string>();

  csList.forEach((cs, idx) => {
    const ref = `CS_${String(idx + 1).padStart(2, "0")}`;
    csIdToRefMap.set(cs.id, ref);
    batchCaseStudies.push({
      caseStudyRef: ref,
      title: cs.title,
      scenarioText: cs.scenarioText,
    });
  });

  // 5. Build Canonical Questions
  const canonicalQuestions: import("../import/types").CanonicalQuestionJson[] = questionsList.map((q, idx) => {
    const vDetail = versionDetailMap.get(q.activeVersionId);
    const qOptions = optionsMap.get(q.activeVersionId) || [];
    const csRef = q.caseStudyId ? csIdToRefMap.get(q.caseStudyId) : undefined;
    const cs = q.caseStudyId ? csMap.get(q.caseStudyId) : null;

    // Build hierarchy breadcrumbs from node chain
    const currentNode = nodeMap.get(q.curriculumNodeId);
    let chapterCode: string | undefined;
    let unitCode: string | undefined;
    let topicCode: string | undefined;
    let chapterTitle: string | undefined;
    let topicTitle: string | undefined;

    let cursor = currentNode;
    while (cursor) {
      if (cursor.type === "TOPIC") {
        topicCode = cursor.code || undefined;
        topicTitle = cursor.name;
      } else if (cursor.type === "UNIT") {
        unitCode = cursor.code || undefined;
      } else if (cursor.type === "CHAPTER" || cursor.type === "SECTION") {
        chapterCode = cursor.code || undefined;
        chapterTitle = cursor.name;
      }
      cursor = cursor.parentId ? nodeMap.get(cursor.parentId) : undefined;
    }

    const sourceMetaRaw = (vDetail?.sourceMetadata as Record<string, unknown>) || {};
    const externalId = (sourceMetaRaw.externalId as string) || `Q-${q.academicLevelCode}-${q.subjectCode}-${String(idx + 1).padStart(4, "0")}`;

    // Ensure at least 2 structured options for valid schema export
    let effectiveOptions = qOptions;
    if (!Array.isArray(effectiveOptions) || effectiveOptions.length < 2) {
      effectiveOptions = [
        { letter: "A", text: "True / Option A" },
        { letter: "B", text: "False / Option B" },
        { letter: "C", text: "Option C" },
        { letter: "D", text: "Option D" },
      ];
    }

    let effectiveAnswer = (vDetail?.correctAnswer || q.correctAnswer || "A").trim().toUpperCase();
    if (!effectiveOptions.some((o) => o.letter.toUpperCase() === effectiveAnswer)) {
      effectiveAnswer = effectiveOptions[0].letter;
    }

    return {
      externalId,
      questionType: q.questionType,
      difficulty: q.difficulty,
      curriculum: {
        subjectCode: q.subjectCode,
        chapterCode: chapterCode || q.curriculumNodeCode,
        unitCode,
        topicCode,
        nodeCode: q.curriculumNodeCode,
        _subjectTitle: q.subjectName,
        _chapterTitle: chapterTitle || q.curriculumNodeName,
        _topicTitle: topicTitle,
      },
      questionText: vDetail?.questionText || q.questionTextPreview,
      options: effectiveOptions,
      correctAnswer: effectiveAnswer,
      explanation: vDetail?.explanation || undefined,
      source: {
        sourceType: (vDetail?.sourceType as import("../import/types").QuestionSourceType) || (q.sourceType as import("../import/types").QuestionSourceType) || "STUDY_MATERIAL",
        sourceTitle: vDetail?.sourceTitle || q.sourceTitle || undefined,
        sourceYear: vDetail?.sourceYear || undefined,
        sourceMonth: vDetail?.sourceMonth || undefined,
        sourceAttempt: (sourceMetaRaw.sourceAttempt as string) || undefined,
        applicability: (sourceMetaRaw.applicability as string[]) || undefined,
        paperNumber: vDetail?.paperNumber || undefined,
        pageNumber: (sourceMetaRaw.pageNumber as number) || undefined,
        sourceReference: (sourceMetaRaw.sourceReference as string) || undefined,
        externalId,
      },
      caseStudyRef: csRef,
      caseStudy: cs ? { title: cs.title, scenarioText: cs.scenarioText } : undefined,
      // Legacy compatibility fields
      curriculumNodeCode: q.curriculumNodeCode,
      chapterName: q.curriculumNodeName,
      subjectCode: q.subjectCode,
    };
  });

  const levelCode = filterParams.levelCode || "INTERMEDIATE";
  const dateStr = new Date().toISOString().slice(0, 10);
  const fileName = `ca-prep-pro-questions-${levelCode}-${dateStr}.json`;

  const canonicalBatchPayload: import("../import/types").CanonicalBatchJson = {
    schemaVersion: "2.0",
    batchName: `Export — ${level?.name || levelCode} (${dateStr})`,
    academicLevelCode: levelCode as "FOUNDATION" | "INTERMEDIATE" | "FINAL",
    curriculumVersionId: ver?.id,
    curriculumVersionName: ver?.name,
    exportedAt: new Date().toISOString(),
    sourceType: "STUDY_MATERIAL",
    caseStudies: batchCaseStudies.length > 0 ? batchCaseStudies : undefined,
    questions: canonicalQuestions,
  };

  return {
    fileName,
    jsonContent: JSON.stringify(canonicalBatchPayload, null, 2),
    questionCount: canonicalQuestions.length,
  };
}
