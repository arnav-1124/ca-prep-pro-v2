import { db } from "@/db";
import {
  studentAttempts,
  academicLevels,
  examAttempts,
  practiceSessions,
  practiceAttempts,
  questions,
  questionVersions,
  curriculumNodes,
  subjects,
  curriculumVersions
} from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";

export interface SubjectProgress {
  id: string;
  code: string;
  name: string;
  coverage: number; // Percentage (0-100)
  accuracy: number; // Percentage (0-100)
  totalAttempted: number;
  totalAvailable: number;
}

export interface RecentActivity {
  id: string;
  startedAt: Date;
  subjectName: string;
  practiceMode: "QUESTION" | "CASE_STUDY";
  questionsCount: number;
  accuracy: number;
  status: string;
}

export interface ProgressInsight {
  nodeId: string;
  nodeName: string;
  subjectName: string;
  accuracy: number;
  totalAttempts: number;
}

export interface OverallProgressState {
  academicLevelName: string;
  targetAttemptName: string | null;
  targetDate: Date | null;
  daysRemaining: number | null;
  totalSessions: number;
  totalAttemptedQuestions: number;
  totalCorrectAnswers: number;
  overallAccuracy: number;
  overallSyllabusCoverage: number;
  subjectsProgress: SubjectProgress[];
  strongestAreas: ProgressInsight[];
  weakestAreas: ProgressInsight[];
  recentActivity: RecentActivity[];
}

export interface CurriculumProgressNode {
  id: string;
  parentId: string | null;
  name: string;
  type: string;
  status: "Not Started" | "Practicing" | "Covered";
  availableQuestions: number;
  attemptedQuestions: number;
  accuracy: number;
  children: CurriculumProgressNode[];
}

/**
 * Resolves recursive children IDs for a given node.
 */
function getDescendants(nodeId: string, allNodes: { id: string; parentId: string | null }[]): string[] {
  const childIds = allNodes.filter((n) => n.parentId === nodeId).map((n) => n.id);
  const descendants = [...childIds];
  for (const cid of childIds) {
    descendants.push(...getDescendants(cid, allNodes));
  }
  return descendants;
}

/**
 * Calculates overall progress and stats for a student.
 */
export async function getOverallProgress(studentProfileId: string): Promise<OverallProgressState | null> {
  // 1. Fetch active student attempt
  const [activeAttempt] = await db
    .select({
      id: studentAttempts.id,
      academicLevelId: studentAttempts.academicLevelId,
      examAttemptId: studentAttempts.examAttemptId,
      targetDate: studentAttempts.targetDate,
    })
    .from(studentAttempts)
    .where(and(eq(studentAttempts.studentProfileId, studentProfileId), eq(studentAttempts.isActive, true)))
    .limit(1);

  if (!activeAttempt) {
    return null;
  }

  // Fetch Level metadata
  const [level] = await db
    .select({ name: academicLevels.name })
    .from(academicLevels)
    .where(eq(academicLevels.id, activeAttempt.academicLevelId))
    .limit(1);

  const academicLevelName = level?.name || "CA Candidate";

  // Fetch Exam Attempt target metadata
  let targetAttemptName: string | null = null;
  let targetDate: Date | null = activeAttempt.targetDate;

  if (activeAttempt.examAttemptId) {
    const [exam] = await db
      .select({ name: examAttempts.name, targetDate: examAttempts.targetDate })
      .from(examAttempts)
      .where(eq(examAttempts.id, activeAttempt.examAttemptId))
      .limit(1);
    if (exam) {
      targetAttemptName = exam.name;
      if (!targetDate && exam.targetDate) {
        targetDate = exam.targetDate;
      }
    }
  }

  // Calculate days remaining
  let daysRemaining: number | null = null;
  if (targetDate) {
    const diffTime = targetDate.getTime() - Date.now();
    daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  }

  // 2. Fetch Practice Sessions started by student
  const sessions = await db
    .select({
      id: practiceSessions.id,
      startedAt: practiceSessions.startedAt,
      practiceMode: practiceSessions.practiceMode,
      status: practiceSessions.status,
      subjectId: practiceSessions.subjectId,
    })
    .from(practiceSessions)
    .where(eq(practiceSessions.studentProfileId, studentProfileId))
    .orderBy(desc(practiceSessions.startedAt));

  const totalSessions = sessions.length;

  // 3. Fetch all Practice Attempts for performance evaluation
  // Fetch attempt logs joined with question version data to match curriculum node context
  const attemptsList = await db
    .select({
      id: practiceAttempts.id,
      isCorrect: practiceAttempts.isCorrect,
      questionId: questions.id,
      subjectId: questions.subjectId,
      curriculumNodeId: questions.curriculumNodeId,
      practiceSessionId: practiceAttempts.practiceSessionId,
    })
    .from(practiceAttempts)
    .innerJoin(practiceSessions, eq(practiceAttempts.practiceSessionId, practiceSessions.id))
    .innerJoin(questionVersions, eq(practiceAttempts.questionVersionId, questionVersions.id))
    .innerJoin(questions, eq(questionVersions.questionId, questions.id))
    .where(eq(practiceSessions.studentProfileId, studentProfileId));

  const totalAttemptedQuestions = attemptsList.length;
  const totalCorrectAnswers = attemptsList.filter((a) => a.isCorrect).length;
  const overallAccuracy = totalAttemptedQuestions > 0
    ? Math.round((totalCorrectAnswers / totalAttemptedQuestions) * 100)
    : 0;

  // 4. Fetch Subjects for active level
  const activeSubjects = await db
    .select({
      id: subjects.id,
      code: subjects.code,
      name: subjects.name,
    })
    .from(subjects)
    .where(and(eq(subjects.academicLevelId, activeAttempt.academicLevelId), eq(subjects.isActive, true)));

  // Resolve current active curriculum version for this level
  const [curriculumVer] = await db
    .select({ id: curriculumVersions.id })
    .from(curriculumVersions)
    .where(and(eq(curriculumVersions.academicLevelId, activeAttempt.academicLevelId), eq(curriculumVersions.isActive, true)))
    .limit(1);

  const activeVersionId = curriculumVer?.id || null;

  // 5. Subject Progress Calculation
  const subjectsProgress: SubjectProgress[] = [];
  let leafNodesCoveredCount = 0;
  let leafNodesTotalCount = 0;

  // Map database questions list to memory for quick counts
  const allQuestions = await db
    .select({
      id: questions.id,
      subjectId: questions.subjectId,
      curriculumNodeId: questions.curriculumNodeId,
    })
    .from(questions)
    .where(eq(questions.academicLevelId, activeAttempt.academicLevelId));

  // Compute stats for each subject
  for (const sub of activeSubjects) {
    // Fetch nodes belonging to the subject in active version
    const nodes = activeVersionId
      ? await db
          .select({
            id: curriculumNodes.id,
            parentId: curriculumNodes.parentId,
            name: curriculumNodes.name,
            type: curriculumNodes.type,
          })
          .from(curriculumNodes)
          .where(
            and(
              eq(curriculumNodes.curriculumVersionId, activeVersionId),
              eq(curriculumNodes.subjectId, sub.id),
              eq(curriculumNodes.isActive, true)
            )
          )
      : [];

    const parentIds = new Set(nodes.map((n) => n.parentId).filter(Boolean));
    const leafNodes = nodes.filter((n) => !parentIds.has(n.id));

    // Filter attempts list for this subject
    const subAttempts = attemptsList.filter((a) => a.subjectId === sub.id);
    const subCorrect = subAttempts.filter((a) => a.isCorrect).length;
    const subAccuracy = subAttempts.length > 0 ? Math.round((subCorrect / subAttempts.length) * 100) : 0;

    let totalLeafWithQuestions = 0;
    let coveredLeafCount = 0;

    // Evaluate each leaf node
    for (const leaf of leafNodes) {
      const descendants = [leaf.id, ...getDescendants(leaf.id, nodes)];
      
      const leafQuestions = allQuestions.filter((q) => descendants.includes(q.curriculumNodeId));
      if (leafQuestions.length === 0) {
        continue; // Skip leaf node if it has no questions in DB
      }

      totalLeafWithQuestions++;
      leafNodesTotalCount++;

      // Count unique questions attempted under this leaf scope
      const leafQuestionIds = leafQuestions.map((q) => q.id);
      const leafAttempts = subAttempts.filter((a) => leafQuestionIds.includes(a.questionId));
      const uniqueAttempted = new Set(leafAttempts.map((a) => a.questionId)).size;

      // Status conditions: covered if attempted all available or at least 3
      const isCovered = uniqueAttempted >= 3 || (uniqueAttempted === leafQuestions.length && leafQuestions.length > 0);
      if (isCovered) {
        coveredLeafCount++;
        leafNodesCoveredCount++;
      }
    }

    const subCoverage = totalLeafWithQuestions > 0
      ? Math.round((coveredLeafCount / totalLeafWithQuestions) * 100)
      : 0;

    subjectsProgress.push({
      id: sub.id,
      code: sub.code,
      name: sub.name,
      coverage: subCoverage,
      accuracy: subAccuracy,
      totalAttempted: subAttempts.length,
      totalAvailable: allQuestions.filter((q) => q.subjectId === sub.id).length,
    });
  }

  const overallSyllabusCoverage = leafNodesTotalCount > 0
    ? Math.round((leafNodesCoveredCount / leafNodesTotalCount) * 100)
    : 0;

  // 6. Resolve Strongest / Weakest Areas (based on node stats)
  // Fetch active curriculum nodes to match titles
  const activeNodes = activeVersionId
    ? await db
        .select({
          id: curriculumNodes.id,
          name: curriculumNodes.name,
          subjectId: curriculumNodes.subjectId,
        })
        .from(curriculumNodes)
        .where(and(eq(curriculumNodes.curriculumVersionId, activeVersionId), eq(curriculumNodes.isActive, true)))
    : [];

  const nodeStatsMap: Record<string, { correct: number; total: number }> = {};
  for (const a of attemptsList) {
    if (!a.curriculumNodeId) continue;
    if (!nodeStatsMap[a.curriculumNodeId]) {
      nodeStatsMap[a.curriculumNodeId] = { correct: 0, total: 0 };
    }
    nodeStatsMap[a.curriculumNodeId].total++;
    if (a.isCorrect) {
      nodeStatsMap[a.curriculumNodeId].correct++;
    }
  }

  const nodeInsights: ProgressInsight[] = Object.entries(nodeStatsMap).map(([nodeId, stats]) => {
    const nodeObj = activeNodes.find((n) => n.id === nodeId);
    const subObj = activeSubjects.find((s) => s.id === nodeObj?.subjectId);
    return {
      nodeId,
      nodeName: nodeObj?.name || "Topic Section",
      subjectName: subObj?.name || "General Paper",
      accuracy: Math.round((stats.correct / stats.total) * 100),
      totalAttempts: stats.total,
    };
  });

  const strongestAreas = nodeInsights
    .filter((n) => n.totalAttempts >= 3 && n.accuracy >= 70)
    .sort((a, b) => b.accuracy - a.accuracy || b.totalAttempts - a.totalAttempts)
    .slice(0, 3);

  const weakestAreas = nodeInsights
    .filter((n) => n.totalAttempts >= 2 && n.accuracy < 50)
    .sort((a, b) => a.accuracy - b.accuracy || b.totalAttempts - a.totalAttempts)
    .slice(0, 3);

  // 7. Recent Activity logs (last 5 sessions)
  const recentSessions = sessions.slice(0, 5);
  const recentActivity: RecentActivity[] = [];

  for (const s of recentSessions) {
    const sub = activeSubjects.find((x) => x.id === s.subjectId);
    const sessionAttempts = attemptsList.filter((a) => a.practiceSessionId === s.id);
    const sCorrect = sessionAttempts.filter((a) => a.isCorrect).length;
    const sAccuracy = sessionAttempts.length > 0 ? Math.round((sCorrect / sessionAttempts.length) * 100) : 0;

    recentActivity.push({
      id: s.id,
      startedAt: s.startedAt,
      subjectName: sub?.name || "Comprehensive Practice",
      practiceMode: s.practiceMode as "QUESTION" | "CASE_STUDY",
      questionsCount: sessionAttempts.length,
      accuracy: sAccuracy,
      status: s.status,
    });
  }

  return {
    academicLevelName,
    targetAttemptName,
    targetDate,
    daysRemaining,
    totalSessions,
    totalAttemptedQuestions,
    totalCorrectAnswers,
    overallAccuracy,
    overallSyllabusCoverage,
    subjectsProgress,
    strongestAreas,
    weakestAreas,
    recentActivity,
  };
}

/**
 * Builds a recursive tree representing the progress of a specific subject's syllabus nodes.
 */
export async function getSubjectDrillDown(
  studentProfileId: string,
  subjectId: string
): Promise<CurriculumProgressNode[]> {
  // 1. Fetch current active attempt
  const [activeAttempt] = await db
    .select({ academicLevelId: studentAttempts.academicLevelId })
    .from(studentAttempts)
    .where(and(eq(studentAttempts.studentProfileId, studentProfileId), eq(studentAttempts.isActive, true)))
    .limit(1);

  if (!activeAttempt) return [];

  // 2. Fetch current active version
  const [curriculumVer] = await db
    .select({ id: curriculumVersions.id })
    .from(curriculumVersions)
    .where(and(eq(curriculumVersions.academicLevelId, activeAttempt.academicLevelId), eq(curriculumVersions.isActive, true)))
    .limit(1);

  if (!curriculumVer) return [];

  // 3. Fetch nodes belonging to the subject in active version
  const nodes = await db
    .select({
      id: curriculumNodes.id,
      parentId: curriculumNodes.parentId,
      name: curriculumNodes.name,
      type: curriculumNodes.type,
      sortOrder: curriculumNodes.sortOrder,
    })
    .from(curriculumNodes)
    .where(
      and(
        eq(curriculumNodes.curriculumVersionId, curriculumVer.id),
        eq(curriculumNodes.subjectId, subjectId),
        eq(curriculumNodes.isActive, true)
      )
    )
    .orderBy(curriculumNodes.sortOrder);

  // 4. Fetch all questions under this subject
  const allQuestions = await db
    .select({
      id: questions.id,
      curriculumNodeId: questions.curriculumNodeId,
    })
    .from(questions)
    .where(eq(questions.subjectId, subjectId));

  // 5. Fetch all attempts by student
  const attemptsList = await db
    .select({
      questionId: questions.id,
      isCorrect: practiceAttempts.isCorrect,
    })
    .from(practiceAttempts)
    .innerJoin(practiceSessions, eq(practiceAttempts.practiceSessionId, practiceSessions.id))
    .innerJoin(questionVersions, eq(practiceAttempts.questionVersionId, questionVersions.id))
    .innerJoin(questions, eq(questionVersions.questionId, questions.id))
    .where(and(eq(practiceSessions.studentProfileId, studentProfileId), eq(questions.subjectId, subjectId)));

  // Build unique attempts log map
  const questionAttemptsMap: Record<string, { correct: number; total: number }> = {};
  for (const a of attemptsList) {
    if (!questionAttemptsMap[a.questionId]) {
      questionAttemptsMap[a.questionId] = { correct: 0, total: 0 };
    }
    questionAttemptsMap[a.questionId].total++;
    if (a.isCorrect) {
      questionAttemptsMap[a.questionId].correct++;
    }
  }

  // Recursive formatter
  const formatNode = (node: typeof nodes[0]): CurriculumProgressNode => {
    const descendants = [node.id, ...getDescendants(node.id, nodes)];

    // Fetch questions inside this sub-tree
    const nodeQuestions = allQuestions.filter((q) => descendants.includes(q.curriculumNodeId));
    const availableQuestions = nodeQuestions.length;

    // Filter attempts matching this sub-tree
    const nodeQuestionIds = nodeQuestions.map((q) => q.id);
    const nodeAttempts = attemptsList.filter((a) => nodeQuestionIds.includes(a.questionId));
    
    // Count unique questions attempted
    const attemptedQuestions = new Set(nodeAttempts.map((a) => a.questionId)).size;
    const correctCount = nodeAttempts.filter((a) => a.isCorrect).length;
    const accuracy = nodeAttempts.length > 0 ? Math.round((correctCount / nodeAttempts.length) * 100) : 0;

    // Status: Covered if attempted all or >= 3
    let status: "Not Started" | "Practicing" | "Covered" = "Not Started";
    if (attemptedQuestions >= 3 || (attemptedQuestions === availableQuestions && availableQuestions > 0)) {
      status = "Covered";
    } else if (attemptedQuestions > 0) {
      status = "Practicing";
    }

    // Recursively resolve children nodes
    const children = nodes
      .filter((n) => n.parentId === node.id)
      .map((n) => formatNode(n));

    return {
      id: node.id,
      parentId: node.parentId,
      name: node.name,
      type: node.type,
      status,
      availableQuestions,
      attemptedQuestions,
      accuracy,
      children,
    };
  };

  // Build tree from root level nodes (where parentId is null)
  return nodes.filter((n) => n.parentId === null).map((n) => formatNode(n));
}
