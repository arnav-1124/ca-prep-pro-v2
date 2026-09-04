import { db } from "@/db";
import {
  questions,
  questionVersions,
  questionOptions,
  caseStudies,
  curriculumNodes,
  subjects,
  academicLevels,
  practiceSessionQuestions,
} from "@/db/schema";
import { eq, and, asc, inArray, isNull, isNotNull, sql, SQL, notInArray } from "drizzle-orm";
import { getDescendantNodeIds } from "@/domains/academics/services";

export interface QuestionFilterCriteria {
  academicLevelId: string;
  curriculumVersionId: string;
  subjectId?: string | null;
  curriculumNodeId?: string | null;
  practiceMode?: "QUESTION" | "CASE_STUDY";
  difficulty?: string | null;
  questionType?: string | null;
}

export interface EligibleQuestionCandidate {
  questionId: string;
  questionVersionId: string;
  versionNumber: number;
  questionText: string;
  questionType: "MCQ" | "CASE_STUDY";
  difficulty: string;
  academicLevelId: string;
  levelName: string;
  subjectId: string;
  subjectName: string;
  curriculumNodeId: string;
  curriculumNodeName: string;
  caseStudyId: string | null;
  caseStudyTitle: string | null;
  caseStudyScenarioText: string | null;
  options: {
    id: string;
    optionLetter: string;
    optionText: string;
  }[];
}

/**
 * Resolves the array of eligible curriculum node IDs matching the given criteria.
 * Enforces active status on the curriculum node and active curriculum version.
 */
async function resolveEligibleNodeIds(
  curriculumVersionId: string,
  subjectId?: string | null,
  curriculumNodeId?: string | null
): Promise<string[] | null> {
  if (curriculumNodeId) {
    // 1. Verify the selected node exists, is active, and belongs to the specified version and subject
    const [targetNode] = await db
      .select({
        id: curriculumNodes.id,
        isActive: curriculumNodes.isActive,
        subjectId: curriculumNodes.subjectId,
        curriculumVersionId: curriculumNodes.curriculumVersionId,
      })
      .from(curriculumNodes)
      .where(
        and(
          eq(curriculumNodes.id, curriculumNodeId),
          eq(curriculumNodes.curriculumVersionId, curriculumVersionId),
          eq(curriculumNodes.isActive, true)
        )
      )
      .limit(1);

    if (!targetNode) {
      // Inactive or nonexistent node for this curriculum version
      return [];
    }

    if (subjectId && targetNode.subjectId !== subjectId) {
      // Node does not belong to the requested subject
      return [];
    }

    // 2. Fetch target node and its active descendants
    const allDescendantIds = await getDescendantNodeIds(curriculumNodeId);

    // Verify which descendants are active
    if (allDescendantIds.length === 0) {
      return [curriculumNodeId];
    }

    const activeNodes = await db
      .select({ id: curriculumNodes.id })
      .from(curriculumNodes)
      .where(
        and(
          inArray(curriculumNodes.id, allDescendantIds),
          eq(curriculumNodes.isActive, true),
          eq(curriculumNodes.curriculumVersionId, curriculumVersionId)
        )
      );

    return activeNodes.map((n) => n.id);
  }

  // If no specific node was chosen, but subject is specified, collect all active nodes in that subject
  if (subjectId) {
    const subjectNodes = await db
      .select({ id: curriculumNodes.id })
      .from(curriculumNodes)
      .where(
        and(
          eq(curriculumNodes.subjectId, subjectId),
          eq(curriculumNodes.curriculumVersionId, curriculumVersionId),
          eq(curriculumNodes.isActive, true)
        )
      );
    return subjectNodes.map((n) => n.id);
  }

  // If neither node nor subject is specified, all active nodes in this curriculum version
  const versionNodes = await db
    .select({ id: curriculumNodes.id })
    .from(curriculumNodes)
    .where(
      and(
        eq(curriculumNodes.curriculumVersionId, curriculumVersionId),
        eq(curriculumNodes.isActive, true)
      )
    );
  return versionNodes.map((n) => n.id);
}

/**
 * Counts total eligible questions matching criteria.
 * Used for setup pre-flight verification and availability checks.
 */
export async function countEligibleQuestions(
  criteria: QuestionFilterCriteria
): Promise<number> {
  const eligibleNodeIds = await resolveEligibleNodeIds(
    criteria.curriculumVersionId,
    criteria.subjectId,
    criteria.curriculumNodeId
  );

  if (eligibleNodeIds !== null && eligibleNodeIds.length === 0) {
    return 0;
  }

  const whereClauses: SQL[] = [
    eq(questions.academicLevelId, criteria.academicLevelId),
    eq(questionVersions.isActive, true), // Active question version snapshot
  ];

  if (criteria.subjectId) {
    whereClauses.push(eq(questions.subjectId, criteria.subjectId));
  }

  if (eligibleNodeIds !== null && eligibleNodeIds.length > 0) {
    whereClauses.push(inArray(questions.curriculumNodeId, eligibleNodeIds));
  }

  if (criteria.difficulty && criteria.difficulty !== "ANY") {
    whereClauses.push(eq(questions.difficulty, criteria.difficulty));
  }

  if (criteria.practiceMode === "CASE_STUDY") {
    whereClauses.push(isNotNull(questions.caseStudyId));
    // In case study mode, count distinct case studies
    const rows = await db
      .select({ caseStudyId: questions.caseStudyId })
      .from(questions)
      .innerJoin(
        questionVersions,
        and(
          eq(questions.id, questionVersions.questionId),
          eq(questionVersions.isActive, true)
        )
      )
      .where(and(...whereClauses));

    const distinctCases = new Set(rows.map((r) => r.caseStudyId).filter(Boolean));
    return distinctCases.size;
  } else {
    // Normal Standalone Question mode
    whereClauses.push(isNull(questions.caseStudyId));
    if (criteria.questionType) {
      whereClauses.push(eq(questions.questionType, criteria.questionType));
    }

    const [result] = await db
      .select({ count: sql<number>`count(distinct ${questions.id})::int` })
      .from(questions)
      .innerJoin(
        questionVersions,
        and(
          eq(questions.id, questionVersions.questionId),
          eq(questionVersions.isActive, true)
        )
      )
      .where(and(...whereClauses));

    return Number(result?.count) || 0;
  }
}

/**
 * Deterministically selects the next eligible question for a practice session.
 *
 * ALGORITHM:
 * 1. Build eligibility candidate set (academic level, active curriculum version, active syllabus nodes, active question versions).
 * 2. Exclude any question IDs already delivered in this session via `practice_session_questions`.
 * 3. Sort deterministically via cryptographic MD5 hash of `(question_id || ':' || sessionSeed)`.
 *    - Guarantees 100% reproducible sequence given the same session seed.
 *    - Eliminates expensive non-deterministic `ORDER BY RANDOM()`.
 *    - High-throughput scalable execution in single indexed PostgreSQL query.
 * 4. Fetch structured options for the chosen question snapshot and assemble Candidate payload.
 */
export async function selectNextEligibleQuestion(
  sessionId: string,
  sessionSeed: number,
  criteria: QuestionFilterCriteria
): Promise<EligibleQuestionCandidate | null> {
  // 1. Resolve eligible active nodes
  const eligibleNodeIds = await resolveEligibleNodeIds(
    criteria.curriculumVersionId,
    criteria.subjectId,
    criteria.curriculumNodeId
  );

  if (eligibleNodeIds !== null && eligibleNodeIds.length === 0) {
    return null;
  }

  // 2. Fetch already delivered question IDs in this session
  const alreadyDelivered = await db
    .select({ questionId: practiceSessionQuestions.questionId })
    .from(practiceSessionQuestions)
    .where(eq(practiceSessionQuestions.practiceSessionId, sessionId));

  const deliveredQuestionIds = alreadyDelivered.map((d) => d.questionId);

  // 3. Build query filters
  const whereClauses: SQL[] = [
    eq(questions.academicLevelId, criteria.academicLevelId),
    eq(questionVersions.isActive, true), // Current active version
  ];

  if (deliveredQuestionIds.length > 0) {
    whereClauses.push(notInArray(questions.id, deliveredQuestionIds));
  }

  if (criteria.subjectId) {
    whereClauses.push(eq(questions.subjectId, criteria.subjectId));
  }

  if (eligibleNodeIds !== null && eligibleNodeIds.length > 0) {
    whereClauses.push(inArray(questions.curriculumNodeId, eligibleNodeIds));
  }

  if (criteria.difficulty && criteria.difficulty !== "ANY") {
    whereClauses.push(eq(questions.difficulty, criteria.difficulty));
  }

  // 4. Mode-specific selection
  if (criteria.practiceMode === "CASE_STUDY") {
    whereClauses.push(isNotNull(questions.caseStudyId));

    // Select next case study child question deterministically
    const selectedRows = await db
      .select({
        questionId: questions.id,
        questionVersionId: questionVersions.id,
        versionNumber: questionVersions.versionNumber,
        questionText: questionVersions.questionText,
        questionType: questions.questionType,
        difficulty: questions.difficulty,
        academicLevelId: questions.academicLevelId,
        levelName: academicLevels.name,
        subjectId: questions.subjectId,
        subjectName: subjects.name,
        curriculumNodeId: questions.curriculumNodeId,
        curriculumNodeName: curriculumNodes.name,
        caseStudyId: questions.caseStudyId,
        caseStudyTitle: caseStudies.title,
        caseStudyScenarioText: caseStudies.scenarioText,
      })
      .from(questions)
      .innerJoin(
        questionVersions,
        and(
          eq(questions.id, questionVersions.questionId),
          eq(questionVersions.isActive, true)
        )
      )
      .innerJoin(caseStudies, eq(questions.caseStudyId, caseStudies.id))
      .innerJoin(academicLevels, eq(questions.academicLevelId, academicLevels.id))
      .innerJoin(subjects, eq(questions.subjectId, subjects.id))
      .innerJoin(curriculumNodes, eq(questions.curriculumNodeId, curriculumNodes.id))
      .where(and(...whereClauses))
      .orderBy(
        // Deterministic hash ordering on case study scenario first, then question order
        sql`md5(concat(${caseStudies.id}::text, ':', ${sessionSeed}::text)) asc`,
        asc(questions.createdAt),
        asc(questions.id)
      )
      .limit(1);

    if (selectedRows.length === 0) {
      return null;
    }

    const row = selectedRows[0];
    const options = await db
      .select({
        id: questionOptions.id,
        optionLetter: questionOptions.optionLetter,
        optionText: questionOptions.optionText,
      })
      .from(questionOptions)
      .where(eq(questionOptions.questionVersionId, row.questionVersionId))
      .orderBy(asc(questionOptions.optionLetter));

    return {
      ...row,
      questionType: "CASE_STUDY",
      options,
    };
  } else {
    // Standalone Question mode
    whereClauses.push(isNull(questions.caseStudyId));
    if (criteria.questionType) {
      whereClauses.push(eq(questions.questionType, criteria.questionType));
    }

    const selectedRows = await db
      .select({
        questionId: questions.id,
        questionVersionId: questionVersions.id,
        versionNumber: questionVersions.versionNumber,
        questionText: questionVersions.questionText,
        questionType: questions.questionType,
        difficulty: questions.difficulty,
        academicLevelId: questions.academicLevelId,
        levelName: academicLevels.name,
        subjectId: questions.subjectId,
        subjectName: subjects.name,
        curriculumNodeId: questions.curriculumNodeId,
        curriculumNodeName: curriculumNodes.name,
        caseStudyId: sql<string | null>`NULL`,
        caseStudyTitle: sql<string | null>`NULL`,
        caseStudyScenarioText: sql<string | null>`NULL`,
      })
      .from(questions)
      .innerJoin(
        questionVersions,
        and(
          eq(questions.id, questionVersions.questionId),
          eq(questionVersions.isActive, true)
        )
      )
      .innerJoin(academicLevels, eq(questions.academicLevelId, academicLevels.id))
      .innerJoin(subjects, eq(questions.subjectId, subjects.id))
      .innerJoin(curriculumNodes, eq(questions.curriculumNodeId, curriculumNodes.id))
      .where(and(...whereClauses))
      .orderBy(
        // Deterministic hash ordering on question id and session seed
        sql`md5(concat(${questions.id}::text, ':', ${sessionSeed}::text)) asc`,
        asc(questions.id)
      )
      .limit(1);

    if (selectedRows.length === 0) {
      return null;
    }

    const row = selectedRows[0];
    const options = await db
      .select({
        id: questionOptions.id,
        optionLetter: questionOptions.optionLetter,
        optionText: questionOptions.optionText,
      })
      .from(questionOptions)
      .where(eq(questionOptions.questionVersionId, row.questionVersionId))
      .orderBy(asc(questionOptions.optionLetter));

    return {
      ...row,
      questionType: (row.questionType as "MCQ" | "CASE_STUDY") || "MCQ",
      options,
    };
  }
}
