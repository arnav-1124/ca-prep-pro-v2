import { db } from "@/db";
import {
  questions,
  questionVersions,
  questionOptions,
  caseStudies,
  curriculumNodes,
  academicLevels,
  curriculumVersions,
  practiceAttempts,
  testQuestions,
  aiConversations,
} from "@/db/schema";
import { eq, and, desc, inArray, sql } from "drizzle-orm";
import { validateImportQuestion } from "../import/validation";
import { RawImportBatchJson, RawImportQuestionJson } from "../import/types";
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

  const [testCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(testQuestions)
    .where(eq(testQuestions.questionId, input.questionId));

  const [aiCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(aiConversations)
    .where(eq(aiConversations.questionId, input.questionId));

  const pCount = Number(practiceCount?.count) || 0;
  const tCount = Number(testCount?.count) || 0;
  const aCount = Number(aiCount?.count) || 0;

  if (pCount > 0 || tCount > 0 || aCount > 0) {
    throw new Error(
      `Cannot hard delete question: This question has ${pCount} student practice attempts, ${tCount} mock test questions, and ${aCount} AI conversations. Please deactivate or retire it instead to preserve student preparation history.`
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
 * Exports Question Bank questions into canonical interchange JSON compatible with the Step 18 Question Importer.
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

  // Retrieve academic level details
  const [level] = await db
    .select()
    .from(academicLevels)
    .where(eq(academicLevels.code, filterParams.levelCode || "INTERMEDIATE"))
    .limit(1);

  // Retrieve active curriculum version details
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

  // Fetch full details for each question version (options, full explanation, case study)
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

  const caseStudyIds = questionsList.map((q) => q.caseStudyId).filter((id): id is string => id !== null);
  const csList = caseStudyIds.length > 0
    ? await db
        .select()
        .from(caseStudies)
        .where(inArray(caseStudies.id, caseStudyIds))
    : [];

  const csMap = new Map(csList.map((cs) => [cs.id, cs]));

  // Retrieve full explanations
  const fullVersions = versionIds.length > 0
    ? await db
        .select({
          id: questionVersions.id,
          explanation: questionVersions.explanation,
        })
        .from(questionVersions)
        .where(inArray(questionVersions.id, versionIds))
    : [];

  const explanationMap = new Map(fullVersions.map((fv) => [fv.id, fv.explanation]));

  const canonicalQuestions: RawImportQuestionJson[] = questionsList.map((q) => {
    const qOptions = optionsMap.get(q.activeVersionId) || [];
    const cs = q.caseStudyId ? csMap.get(q.caseStudyId) : null;
    const explanation = explanationMap.get(q.activeVersionId) || undefined;

    return {
      curriculumNodeCode: q.curriculumNodeCode,
      chapterName: q.curriculumNodeName,
      questionType: q.questionType,
      difficulty: q.difficulty,
      questionText: q.questionTextPreview,
      options: qOptions,
      correctAnswer: q.correctAnswer,
      explanation: explanation || undefined,
      caseStudy: cs ? { title: cs.title, scenarioText: cs.scenarioText } : undefined,
    };
  });

  const levelCode = filterParams.levelCode || "INTERMEDIATE";
  const dateStr = new Date().toISOString().slice(0, 10);
  const fileName = `ca-prep-pro-questions-${levelCode}-${dateStr}.json`;

  const canonicalBatchPayload: RawImportBatchJson = {
    schemaVersion: "1.0",
    batchName: `Export — ${level?.name || levelCode} (${dateStr})`,
    academicLevelCode: levelCode as "FOUNDATION" | "INTERMEDIATE" | "FINAL",
    curriculumVersionId: ver?.id,
    sourceType: "STUDY_MATERIAL",
    questions: canonicalQuestions,
  };

  return {
    fileName,
    jsonContent: JSON.stringify(canonicalBatchPayload, null, 2),
    questionCount: canonicalQuestions.length,
  };
}
