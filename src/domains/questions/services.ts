import { db } from "@/db";
import {
  academicLevels,
  curriculumVersions,
  subjects,
  curriculumNodes,
  questions,
  questionVersions,
  questionOptions,
  questionSources,
  caseStudies,
  practiceAttempts,
  testQuestions,
  aiConversations,
} from "@/db/schema";
import { eq, and, desc, asc, sql, inArray, ilike, or } from "drizzle-orm";

export interface QuestionBankFilterParams {
  levelCode?: string;
  curriculumVersionId?: string;
  subjectId?: string;
  curriculumNodeId?: string;
  questionType?: string; // 'ALL' | 'MCQ' | 'CASE_STUDY'
  difficulty?: string; // 'ALL' | 'EASY' | 'MEDIUM' | 'HARD'
  sourceType?: string; // 'ALL' | 'STUDY_MATERIAL' | 'RTP' | 'MTP' | 'PYQ' | 'OTHER_OFFICIAL' | 'AI_GENERATED'
  status?: string; // 'ALL' | 'ACTIVE' | 'INACTIVE'
  searchQuery?: string;
  sortBy?: "content" | "curriculum" | "difficulty" | "type" | "status" | "created";
  sortOrder?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export interface QuestionListItem {
  id: string;
  academicLevelId: string;
  academicLevelCode: string;
  academicLevelName: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  curriculumVersionId: string;
  curriculumVersionName: string;
  curriculumNodeId: string;
  curriculumNodeCode: string;
  curriculumNodeName: string;
  curriculumNodeType: string;
  hierarchyPath: string; // e.g. "Paper 5 > Chapter 1 > Nature & Scope"
  caseStudyId: string | null;
  caseStudyTitle: string | null;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  questionType: "MCQ" | "CASE_STUDY";
  isAiGenerated: boolean;
  activeVersionId: string;
  versionNumber: number;
  questionTextPreview: string;
  correctAnswer: string;
  isActive: boolean;
  sourceType: string | null;
  sourceTitle: string | null;
  optionsCount: number;
  createdAt: Date;
}

export interface QuestionDetailView {
  id: string;
  academicLevel: { id: string; code: string; name: string };
  subject: { id: string; code: string; name: string };
  curriculumVersion: { id: string; name: string; isActive: boolean };
  curriculumNode: { id: string; code: string; name: string; type: string };
  hierarchyBreadcrumbs: { id: string; name: string; code: string; type: string }[];
  caseStudy: { id: string; title: string; scenarioText: string } | null;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  questionType: "MCQ" | "CASE_STUDY";
  isAiGenerated: boolean;
  aiMetadata: unknown;
  createdAt: Date;
  versions: {
    id: string;
    versionNumber: number;
    questionText: string;
    correctAnswer: string;
    explanation: string | null;
    isActive: boolean;
    source: {
      id: string;
      sourceType: string;
      sourceTitle: string;
      sourceYear: number | null;
      sourceMonth: number | null;
      paperNumber: string | null;
    } | null;
    sourceMetadata: unknown;
    options: {
      id: string;
      optionLetter: string;
      optionText: string;
    }[];
    createdAt: Date;
  }[];
  references: {
    practiceAttemptsCount: number;
    testQuestionsCount: number;
    aiConversationsCount: number;
  };
}

export interface QuestionBankResponse {
  questions: QuestionListItem[];
  pagination: {
    totalCount: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
  filterOptions: {
    levels: { id: string; code: string; name: string }[];
    versions: { id: string; name: string; isActive: boolean }[];
    subjects: { id: string; code: string; name: string }[];
    nodes: { id: string; code: string; name: string; type: string }[];
    selectedLevelCode: string;
    selectedVersionId: string | null;
  };
  metrics: {
    totalQuestions: number;
    mcqCount: number;
    caseStudyCount: number;
    activeCount: number;
    easyCount: number;
    mediumCount: number;
    hardCount: number;
  };
}

interface NodeHierarchyInfo {
  id: string;
  name: string;
  code: string;
  type: string;
  parentId: string | null;
}

/**
 * Builds breadcrumb path for a curriculum node within a version's node map.
 */
function buildNodeHierarchyPath(
  nodeId: string,
  nodeMap: Map<string, NodeHierarchyInfo>
): { pathString: string; breadcrumbs: { id: string; name: string; code: string; type: string }[] } {
  const breadcrumbs: { id: string; name: string; code: string; type: string }[] = [];
  let currentId: string | null = nodeId;

  while (currentId && nodeMap.has(currentId)) {
    const nodeItem: NodeHierarchyInfo | undefined = nodeMap.get(currentId);
    if (!nodeItem) break;
    breadcrumbs.unshift({
      id: nodeItem.id,
      name: nodeItem.name,
      code: nodeItem.code,
      type: nodeItem.type,
    });
    currentId = nodeItem.parentId;
  }

  const pathString = breadcrumbs.map((b) => b.name).join(" → ");
  return { pathString: pathString || "General Syllabus", breadcrumbs };
}

/**
 * Authoritative administrative query for the Question Bank explorer with server-side pagination,
 * multi-dimensional filtering, and hierarchy breadcrumb resolution.
 */
export async function getAdminQuestionBankData(
  params: QuestionBankFilterParams = {}
): Promise<QuestionBankResponse> {
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(params.pageSize) || 20));
  const offset = (page - 1) * pageSize;

  // 1. Resolve Academic Levels
  const allLevels = await db
    .select({
      id: academicLevels.id,
      code: academicLevels.code,
      name: academicLevels.name,
    })
    .from(academicLevels)
    .orderBy(academicLevels.code);

  const selectedLevel = (params.levelCode
    ? allLevels.find((l) => l.code.toUpperCase() === params.levelCode?.toUpperCase())
    : allLevels.find((l) => l.code === "INTERMEDIATE") || allLevels[0]) || allLevels[0];

  const levelId = selectedLevel?.id;

  // 2. Fetch Versions for target level
  const versions = levelId
    ? await db
        .select({
          id: curriculumVersions.id,
          name: curriculumVersions.name,
          isActive: curriculumVersions.isActive,
        })
        .from(curriculumVersions)
        .where(eq(curriculumVersions.academicLevelId, levelId))
        .orderBy(desc(curriculumVersions.createdAt))
    : [];

  const activeVersion = versions.find((v) => v.isActive) || versions[0] || null;
  const targetVersionId = params.curriculumVersionId || activeVersion?.id || null;

  // 3. Fetch Subjects for target level
  const dbSubjects = levelId
    ? await db
        .select({
          id: subjects.id,
          code: subjects.code,
          name: subjects.name,
        })
        .from(subjects)
        .where(and(eq(subjects.academicLevelId, levelId), eq(subjects.isActive, true)))
        .orderBy(subjects.sortOrder)
    : [];

  // 4. Fetch Nodes for target version (if version selected)
  const dbNodes = targetVersionId
    ? await db
        .select({
          id: curriculumNodes.id,
          name: curriculumNodes.name,
          code: curriculumNodes.code,
          type: curriculumNodes.type,
          parentId: curriculumNodes.parentId,
          subjectId: curriculumNodes.subjectId,
        })
        .from(curriculumNodes)
        .where(
          and(
            eq(curriculumNodes.curriculumVersionId, targetVersionId),
            params.subjectId ? eq(curriculumNodes.subjectId, params.subjectId) : eq(curriculumNodes.isActive, true)
          )
        )
        .orderBy(curriculumNodes.sortOrder)
    : [];

  const nodeMap = new Map(dbNodes.map((n) => [n.id, n]));

  // 5. Build Dynamic SQL Filter Conditions
  const conditions = [];

  if (levelId) {
    conditions.push(eq(questions.academicLevelId, levelId));
  }

  if (params.subjectId && params.subjectId !== "ALL") {
    conditions.push(eq(questions.subjectId, params.subjectId));
  }

  if (params.curriculumNodeId && params.curriculumNodeId !== "ALL") {
    conditions.push(eq(questions.curriculumNodeId, params.curriculumNodeId));
  }

  if (params.questionType && params.questionType !== "ALL") {
    conditions.push(eq(questions.questionType, params.questionType));
  }

  if (params.difficulty && params.difficulty !== "ALL") {
    conditions.push(eq(questions.difficulty, params.difficulty));
  }

  if (params.status && params.status !== "ALL") {
    const isAct = params.status === "ACTIVE";
    conditions.push(eq(questionVersions.isActive, isAct));
  }

  if (params.sourceType && params.sourceType !== "ALL") {
    conditions.push(eq(questionSources.sourceType, params.sourceType));
  }

  if (params.searchQuery && params.searchQuery.trim()) {
    const q = `%${params.searchQuery.trim()}%`;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.searchQuery.trim());
    if (isUuid) {
      conditions.push(or(eq(questions.id, params.searchQuery.trim()), ilike(questionVersions.questionText, q)));
    } else {
      conditions.push(
        or(
          ilike(questionVersions.questionText, q),
          ilike(curriculumNodes.name, q),
          ilike(curriculumNodes.code, q),
          ilike(subjects.name, q)
        )
      );
    }
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // 6. Execute Count Query
  const countResult = await db
    .select({ total: sql<number>`count(distinct ${questions.id})::int` })
    .from(questions)
    .innerJoin(questionVersions, eq(questionVersions.questionId, questions.id))
    .innerJoin(subjects, eq(questions.subjectId, subjects.id))
    .innerJoin(curriculumNodes, eq(questions.curriculumNodeId, curriculumNodes.id))
    .leftJoin(questionSources, eq(questionVersions.sourceId, questionSources.id))
    .where(whereClause);

  const totalCount = Number(countResult[0]?.total) || 0;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  // Construct Stable Sort Order
  let orderByClause = [desc(questions.createdAt)];

  if (params.sortBy === "content") {
    orderByClause = params.sortOrder === "asc"
      ? [asc(questionVersions.questionText), desc(questions.createdAt)]
      : [desc(questionVersions.questionText), desc(questions.createdAt)];
  } else if (params.sortBy === "curriculum") {
    orderByClause = params.sortOrder === "asc"
      ? [asc(subjects.sortOrder), asc(curriculumNodes.sortOrder), desc(questions.createdAt)]
      : [desc(subjects.sortOrder), desc(curriculumNodes.sortOrder), desc(questions.createdAt)];
  } else if (params.sortBy === "difficulty") {
    const diffScore = sql`CASE 
      WHEN ${questions.difficulty} = 'EASY' THEN 1 
      WHEN ${questions.difficulty} = 'MEDIUM' THEN 2 
      WHEN ${questions.difficulty} = 'HARD' THEN 3 
      ELSE 4 END`;
    orderByClause = params.sortOrder === "asc"
      ? [asc(diffScore), desc(questions.createdAt)]
      : [desc(diffScore), desc(questions.createdAt)];
  } else if (params.sortBy === "type") {
    orderByClause = params.sortOrder === "asc"
      ? [asc(questions.questionType), desc(questions.createdAt)]
      : [desc(questions.questionType), desc(questions.createdAt)];
  } else if (params.sortBy === "status") {
    orderByClause = params.sortOrder === "asc"
      ? [asc(questionVersions.isActive), desc(questions.createdAt)]
      : [desc(questionVersions.isActive), desc(questions.createdAt)];
  } else if (params.sortBy === "created") {
    orderByClause = params.sortOrder === "asc"
      ? [asc(questions.createdAt)]
      : [desc(questions.createdAt)];
  }

  const rows = await db
    .select({
      id: questions.id,
      academicLevelId: questions.academicLevelId,
      academicLevelCode: academicLevels.code,
      academicLevelName: academicLevels.name,
      subjectId: questions.subjectId,
      subjectCode: subjects.code,
      subjectName: subjects.name,
      curriculumVersionId: curriculumNodes.curriculumVersionId,
      curriculumNodeId: questions.curriculumNodeId,
      curriculumNodeCode: curriculumNodes.code,
      curriculumNodeName: curriculumNodes.name,
      curriculumNodeType: curriculumNodes.type,
      caseStudyId: questions.caseStudyId,
      caseStudyTitle: caseStudies.title,
      difficulty: questions.difficulty,
      questionType: questions.questionType,
      isAiGenerated: questions.isAiGenerated,
      activeVersionId: questionVersions.id,
      versionNumber: questionVersions.versionNumber,
      questionText: questionVersions.questionText,
      correctAnswer: questionVersions.correctAnswer,
      isActive: questionVersions.isActive,
      sourceType: questionSources.sourceType,
      sourceTitle: questionSources.sourceTitle,
      createdAt: questions.createdAt,
    })
    .from(questions)
    .innerJoin(academicLevels, eq(questions.academicLevelId, academicLevels.id))
    .innerJoin(subjects, eq(questions.subjectId, subjects.id))
    .innerJoin(curriculumNodes, eq(questions.curriculumNodeId, curriculumNodes.id))
    .innerJoin(questionVersions, eq(questionVersions.questionId, questions.id))
    .leftJoin(caseStudies, eq(questions.caseStudyId, caseStudies.id))
    .leftJoin(questionSources, eq(questionVersions.sourceId, questionSources.id))
    .where(whereClause)
    .orderBy(...orderByClause)
    .limit(pageSize)
    .offset(offset);

  // 8. Fetch option counts for retrieved versions in batch
  const versionIds = rows.map((r) => r.activeVersionId);
  const optionCountsMap = new Map<string, number>();

  if (versionIds.length > 0) {
    const optCounts = await db
      .select({
        versionId: questionOptions.questionVersionId,
        count: sql<number>`count(*)::int`,
      })
      .from(questionOptions)
      .where(inArray(questionOptions.questionVersionId, versionIds))
      .groupBy(questionOptions.questionVersionId);

    for (const oc of optCounts) {
      optionCountsMap.set(oc.versionId, Number(oc.count));
    }
  }

  // 9. Fetch version names in batch
  const distinctVersionIds = Array.from(new Set(rows.map((r) => r.curriculumVersionId)));
  const versionNamesMap = new Map<string, string>();

  if (distinctVersionIds.length > 0) {
    const vers = await db
      .select({ id: curriculumVersions.id, name: curriculumVersions.name })
      .from(curriculumVersions)
      .where(inArray(curriculumVersions.id, distinctVersionIds));

    for (const v of vers) {
      versionNamesMap.set(v.id, v.name);
    }
  }

  // 10. Map list items with hierarchy breadcrumbs
  const questionItems: QuestionListItem[] = rows.map((r) => {
    const { pathString } = buildNodeHierarchyPath(r.curriculumNodeId, nodeMap);
    return {
      id: r.id,
      academicLevelId: r.academicLevelId,
      academicLevelCode: r.academicLevelCode,
      academicLevelName: r.academicLevelName,
      subjectId: r.subjectId,
      subjectCode: r.subjectCode,
      subjectName: r.subjectName,
      curriculumVersionId: r.curriculumVersionId,
      curriculumVersionName: versionNamesMap.get(r.curriculumVersionId) || "Syllabus Version",
      curriculumNodeId: r.curriculumNodeId,
      curriculumNodeCode: r.curriculumNodeCode,
      curriculumNodeName: r.curriculumNodeName,
      curriculumNodeType: r.curriculumNodeType,
      hierarchyPath: pathString,
      caseStudyId: r.caseStudyId,
      caseStudyTitle: r.caseStudyTitle,
      difficulty: r.difficulty as "EASY" | "MEDIUM" | "HARD",
      questionType: r.questionType as "MCQ" | "CASE_STUDY",
      isAiGenerated: r.isAiGenerated,
      activeVersionId: r.activeVersionId,
      versionNumber: r.versionNumber,
      questionTextPreview: r.questionText.slice(0, 140) + (r.questionText.length > 140 ? "..." : ""),
      correctAnswer: r.correctAnswer,
      isActive: r.isActive,
      sourceType: r.sourceType,
      sourceTitle: r.sourceTitle,
      optionsCount: optionCountsMap.get(r.activeVersionId) || 0,
      createdAt: r.createdAt,
    };
  });

  // 11. Fetch metrics summary for this level
  const metricsResult = await db
    .select({
      total: sql<number>`count(distinct ${questions.id})::int`,
      mcq: sql<number>`count(distinct case when ${questions.questionType} = 'MCQ' then ${questions.id} end)::int`,
      caseStudy: sql<number>`count(distinct case when ${questions.questionType} = 'CASE_STUDY' then ${questions.id} end)::int`,
      active: sql<number>`count(distinct case when ${questionVersions.isActive} = true then ${questions.id} end)::int`,
      easy: sql<number>`count(distinct case when ${questions.difficulty} = 'EASY' then ${questions.id} end)::int`,
      medium: sql<number>`count(distinct case when ${questions.difficulty} = 'MEDIUM' then ${questions.id} end)::int`,
      hard: sql<number>`count(distinct case when ${questions.difficulty} = 'HARD' then ${questions.id} end)::int`,
    })
    .from(questions)
    .innerJoin(questionVersions, eq(questionVersions.questionId, questions.id))
    .where(levelId ? eq(questions.academicLevelId, levelId) : undefined);

  const metrics = {
    totalQuestions: Number(metricsResult[0]?.total) || 0,
    mcqCount: Number(metricsResult[0]?.mcq) || 0,
    caseStudyCount: Number(metricsResult[0]?.caseStudy) || 0,
    activeCount: Number(metricsResult[0]?.active) || 0,
    easyCount: Number(metricsResult[0]?.easy) || 0,
    mediumCount: Number(metricsResult[0]?.medium) || 0,
    hardCount: Number(metricsResult[0]?.hard) || 0,
  };

  return {
    questions: questionItems,
    pagination: {
      totalCount,
      page,
      pageSize,
      totalPages,
    },
    filterOptions: {
      levels: allLevels,
      versions,
      subjects: dbSubjects,
      nodes: dbNodes.map((n) => ({ id: n.id, code: n.code, name: n.name, type: n.type })),
      selectedLevelCode: selectedLevel?.code || "INTERMEDIATE",
      selectedVersionId: targetVersionId,
    },
    metrics,
  };
}

/**
 * Retrieves full question details by ID including complete version history,
 * options, source metadata, case study scenario, and relational usage counts.
 */
export async function getAdminQuestionDetail(questionId: string): Promise<QuestionDetailView | null> {
  const [q] = await db
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
      curriculumVersionId: curriculumNodes.curriculumVersionId,
      caseStudyId: questions.caseStudyId,
      difficulty: questions.difficulty,
      questionType: questions.questionType,
      isAiGenerated: questions.isAiGenerated,
      aiMetadata: questions.aiMetadata,
      createdAt: questions.createdAt,
    })
    .from(questions)
    .innerJoin(academicLevels, eq(questions.academicLevelId, academicLevels.id))
    .innerJoin(subjects, eq(questions.subjectId, subjects.id))
    .innerJoin(curriculumNodes, eq(questions.curriculumNodeId, curriculumNodes.id))
    .where(eq(questions.id, questionId))
    .limit(1);

  if (!q) return null;

  // 1. Fetch Curriculum Version metadata
  const [ver] = await db
    .select({
      id: curriculumVersions.id,
      name: curriculumVersions.name,
      isActive: curriculumVersions.isActive,
    })
    .from(curriculumVersions)
    .where(eq(curriculumVersions.id, q.curriculumVersionId))
    .limit(1);

  // 2. Fetch all nodes for this version to construct complete breadcrumbs
  const allVersionNodes = await db
    .select({
      id: curriculumNodes.id,
      name: curriculumNodes.name,
      code: curriculumNodes.code,
      type: curriculumNodes.type,
      parentId: curriculumNodes.parentId,
    })
    .from(curriculumNodes)
    .where(eq(curriculumNodes.curriculumVersionId, q.curriculumVersionId));

  const nodeMap = new Map(allVersionNodes.map((n) => [n.id, n]));
  const { breadcrumbs } = buildNodeHierarchyPath(q.curriculumNodeId, nodeMap);

  // 3. Fetch Case Study if attached
  let caseStudyObj = null;
  if (q.caseStudyId) {
    const [cs] = await db
      .select({
        id: caseStudies.id,
        title: caseStudies.title,
        scenarioText: caseStudies.scenarioText,
      })
      .from(caseStudies)
      .where(eq(caseStudies.id, q.caseStudyId))
      .limit(1);
    if (cs) caseStudyObj = cs;
  }

  // 4. Fetch Question Versions with Sources
  const vers = await db
    .select({
      id: questionVersions.id,
      versionNumber: questionVersions.versionNumber,
      questionText: questionVersions.questionText,
      correctAnswer: questionVersions.correctAnswer,
      explanation: questionVersions.explanation,
      isActive: questionVersions.isActive,
      sourceId: questionVersions.sourceId,
      sourceMetadata: questionVersions.sourceMetadata,
      sourceType: questionSources.sourceType,
      sourceTitle: questionSources.sourceTitle,
      sourceYear: questionSources.sourceYear,
      sourceMonth: questionSources.sourceMonth,
      paperNumber: questionSources.paperNumber,
      createdAt: questionVersions.createdAt,
    })
    .from(questionVersions)
    .leftJoin(questionSources, eq(questionVersions.sourceId, questionSources.id))
    .where(eq(questionVersions.questionId, questionId))
    .orderBy(desc(questionVersions.versionNumber));

  const versionIds = vers.map((v) => v.id);

  // 5. Fetch Options for all versions
  const allOptions = versionIds.length > 0
    ? await db
        .select()
        .from(questionOptions)
        .where(inArray(questionOptions.questionVersionId, versionIds))
        .orderBy(questionOptions.optionLetter)
    : [];

  const optionsMap = new Map<string, typeof allOptions>();
  for (const opt of allOptions) {
    const list = optionsMap.get(opt.questionVersionId) || [];
    list.push(opt);
    optionsMap.set(opt.questionVersionId, list);
  }

  // 6. Fetch Reference counts (historical usage across practice, tests, AI)
  const [practiceCount] = versionIds.length > 0
    ? await db
        .select({ count: sql<number>`count(*)::int` })
        .from(practiceAttempts)
        .where(inArray(practiceAttempts.questionVersionId, versionIds))
    : [{ count: 0 }];

  const [tQCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(testQuestions)
    .where(eq(testQuestions.questionId, questionId));

  const [aiCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(aiConversations)
    .where(eq(aiConversations.questionId, questionId));

  return {
    id: q.id,
    academicLevel: { id: q.academicLevelId, code: q.academicLevelCode, name: q.academicLevelName },
    subject: { id: q.subjectId, code: q.subjectCode, name: q.subjectName },
    curriculumVersion: {
      id: ver?.id || q.curriculumVersionId,
      name: ver?.name || "Standard Curriculum",
      isActive: ver?.isActive ?? true,
    },
    curriculumNode: {
      id: q.curriculumNodeId,
      code: q.curriculumNodeCode,
      name: q.curriculumNodeName,
      type: q.curriculumNodeType,
    },
    hierarchyBreadcrumbs: breadcrumbs,
    caseStudy: caseStudyObj,
    difficulty: q.difficulty as "EASY" | "MEDIUM" | "HARD",
    questionType: q.questionType as "MCQ" | "CASE_STUDY",
    isAiGenerated: q.isAiGenerated,
    aiMetadata: q.aiMetadata,
    createdAt: q.createdAt,
    versions: vers.map((v) => ({
      id: v.id,
      versionNumber: v.versionNumber,
      questionText: v.questionText,
      correctAnswer: v.correctAnswer,
      explanation: v.explanation,
      isActive: v.isActive,
      source: v.sourceId
        ? {
            id: v.sourceId,
            sourceType: v.sourceType || "OFFICIAL",
            sourceTitle: v.sourceTitle || "ICAI Material",
            sourceYear: v.sourceYear,
            sourceMonth: v.sourceMonth,
            paperNumber: v.paperNumber,
          }
        : null,
      sourceMetadata: v.sourceMetadata,
      options: (optionsMap.get(v.id) || []).map((o) => ({
        id: o.id,
        optionLetter: o.optionLetter,
        optionText: o.optionText,
      })),
      createdAt: v.createdAt,
    })),
    references: {
      practiceAttemptsCount: Number(practiceCount?.count) || 0,
      testQuestionsCount: Number(tQCount?.count) || 0,
      aiConversationsCount: Number(aiCount?.count) || 0,
    },
  };
}
