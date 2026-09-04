import { db } from "@/db";
import {
  academicLevels,
  examAttempts,
  studentAttempts,
  subjects,
  curriculumVersions,
  curriculumNodes,
  questions,
  practiceSessions,
  tests,
  aiConversations,
} from "@/db/schema";
import { eq, and, count, ne, isNull } from "drizzle-orm";

/**
 * Fetches the active student attempt context (CA level and exam date target) for a profile ID.
 */
export async function getActiveStudentAttempt(studentProfileId: string) {
  if (!studentProfileId) return null;

  const results = await db
    .select({
      studentAttemptId: studentAttempts.id,
      examAttemptId: studentAttempts.examAttemptId,
      targetDate: studentAttempts.targetDate,
      levelId: academicLevels.id,
      levelCode: academicLevels.code,
      levelName: academicLevels.name,
      officialAttemptName: examAttempts.name,
    })
    .from(studentAttempts)
    .innerJoin(academicLevels, eq(studentAttempts.academicLevelId, academicLevels.id))
    .leftJoin(examAttempts, eq(studentAttempts.examAttemptId, examAttempts.id))
    .where(
      and(
        eq(studentAttempts.studentProfileId, studentProfileId),
        eq(studentAttempts.isActive, true)
      )
    )
    .limit(1);

  return results[0] || null;
}

/**
 * Retrieves all academic levels (CA Foundation, CA Intermediate, CA Final) from the database.
 */
export async function getAvailableAcademicLevels() {
  return db
    .select()
    .from(academicLevels)
    .orderBy(academicLevels.code);
}

/**
 * Retrieves active exam attempts mapped to a specific academic level.
 */
export async function getAvailableExamAttempts(academicLevelId: string) {
  if (!academicLevelId) return [];
  return db
    .select()
    .from(examAttempts)
    .where(
      and(
        eq(examAttempts.academicLevelId, academicLevelId),
        eq(examAttempts.isActive, true)
      )
    )
    .orderBy(examAttempts.year, examAttempts.month);
}

/**
 * Idempotently assigns or updates a student's active preparation context.
 */
export async function createStudentAttempt(
  studentProfileId: string,
  academicLevelId: string,
  targetDate: Date | null,
  examAttemptId: string | null = null
) {
  if (!studentProfileId || !academicLevelId) {
    throw new Error("Student Profile ID and Academic Level ID are required");
  }

  // Deactivate any currently active attempts to ensure only one active attempt exists
  await db
    .update(studentAttempts)
    .set({ isActive: false })
    .where(eq(studentAttempts.studentProfileId, studentProfileId));

  // Insert the new active attempt context
  const [newAttempt] = await db
    .insert(studentAttempts)
    .values({
      studentProfileId,
      academicLevelId,
      examAttemptId,
      targetDate,
      isActive: true,
    })
    .returning();

  return newAttempt;
}

/**
 * Retrieves the active curriculum version for an academic level.
 */
export async function getActiveCurriculumVersion(levelId: string) {
  if (!levelId) return null;
  const versions = await db
    .select()
    .from(curriculumVersions)
    .where(
      and(
        eq(curriculumVersions.academicLevelId, levelId),
        eq(curriculumVersions.isActive, true)
      )
    )
    .limit(1);
  return versions[0] || null;
}

/**
 * Retrieves active subjects associated with a curriculum version's level.
 */
export async function getCurriculumSubjects(curriculumVersionId: string) {
  if (!curriculumVersionId) return [];
  
  const version = await db
    .select()
    .from(curriculumVersions)
    .where(eq(curriculumVersions.id, curriculumVersionId))
    .limit(1);
    
  if (!version[0]) return [];

  return db
    .select()
    .from(subjects)
    .where(
      and(
        eq(subjects.academicLevelId, version[0].academicLevelId),
        eq(subjects.isActive, true)
      )
    )
    .orderBy(subjects.sortOrder);
}

export interface CurriculumTreeNode {
  id: string;
  parentId: string | null;
  type: string;
  name: string;
  code: string;
  sortOrder: number;
  children: CurriculumTreeNode[];
}

/**
 * Resolves the nested curriculum tree for a specific subject and version.
 */
export async function getCurriculumTree(
  subjectId: string,
  curriculumVersionId: string
): Promise<CurriculumTreeNode[]> {
  if (!subjectId || !curriculumVersionId) return [];

  const nodes = await db
    .select()
    .from(curriculumNodes)
    .where(
      and(
        eq(curriculumNodes.subjectId, subjectId),
        eq(curriculumNodes.curriculumVersionId, curriculumVersionId),
        eq(curriculumNodes.isActive, true)
      )
    )
    .orderBy(curriculumNodes.sortOrder);

  const nodeMap = new Map<string, CurriculumTreeNode>();
  const rootNodes: CurriculumTreeNode[] = [];

  for (const node of nodes) {
    nodeMap.set(node.id, {
      id: node.id,
      parentId: node.parentId,
      type: node.type,
      name: node.name,
      code: node.code,
      sortOrder: node.sortOrder,
      children: [],
    });
  }

  for (const node of nodes) {
    const treeNode = nodeMap.get(node.id)!;
    if (node.parentId && nodeMap.has(node.parentId)) {
      nodeMap.get(node.parentId)!.children.push(treeNode);
    } else {
      rootNodes.push(treeNode);
    }
  }

  const sortTree = (list: CurriculumTreeNode[]) => {
    list.sort((a, b) => a.sortOrder - b.sortOrder);
    for (const item of list) {
      sortTree(item.children);
    }
  };
  sortTree(rootNodes);

  return rootNodes;
}

// Allowed academic nodes validation set
const VALID_NODE_TYPES = new Set(["MODULE", "SECTION", "CHAPTER", "UNIT", "TOPIC"]);

interface ImportNode {
  type: string;
  name: string;
  code: string;
  sortOrder: number;
  children?: ImportNode[];
}

/**
 * Parses and imports/upserts curriculum from the specified JSON contract.
 * Note: Performs full upfront validation in-memory to safely prevent database corruption
 * without requiring interactive session transactions (not supported by stateless HTTP drivers).
 */
export async function importCurriculumJson(jsonString: string): Promise<{ success: boolean; versionId: string }> {
  const payload = JSON.parse(jsonString);

  // Validate root structure
  if (!payload.levelCode || !payload.curriculumVersion || !payload.subjects) {
    throw new Error("Missing required root properties: levelCode, curriculumVersion, subjects");
  }

  const levelCode = payload.levelCode;
  const versionData = payload.curriculumVersion;

  if (!versionData.name || !versionData.applicableFrom) {
    throw new Error("Missing curriculumVersion metadata properties: name, applicableFrom");
  }

  // Pre-validate all node structures and verify uniqueness of codes in payload in-memory
  const seenCodes = new Set<string>();

  const validateNodesRecursive = (nodeList: ImportNode[]) => {
    for (const node of nodeList) {
      if (!node.type || !node.name || !node.code || typeof node.sortOrder !== "number") {
        throw new Error(`Invalid node properties on code '${node.code || "unknown"}': name, type, code, and sortOrder are required`);
      }

      if (!VALID_NODE_TYPES.has(node.type.toUpperCase())) {
        throw new Error(`Invalid node type '${node.type}' on code '${node.code}'; must be one of: MODULE, SECTION, CHAPTER, UNIT, TOPIC`);
      }

      if (seenCodes.has(node.code)) {
        throw new Error(`Duplicate node code detected in payload: '${node.code}'`);
      }
      seenCodes.add(node.code);

      if (node.children && Array.isArray(node.children)) {
        validateNodesRecursive(node.children);
      }
    }
  };

  // Perform validation on all subjects and child nodes first
  for (const sub of payload.subjects) {
    if (!sub.code || !sub.name || typeof sub.sortOrder !== "number") {
      throw new Error("Invalid subject properties: code, name, and sortOrder are required");
    }
    if (sub.nodes && Array.isArray(sub.nodes)) {
      validateNodesRecursive(sub.nodes);
    }
  }

  // 1. Resolve Academic Level
  const levels = await db
    .select()
    .from(academicLevels)
    .where(eq(academicLevels.code, levelCode))
    .limit(1);

  if (!levels[0]) {
    throw new Error(`Academic Level code '${levelCode}' not found in database`);
  }
  const academicLevelId = levels[0].id;

  // 2. Idempotent version creation/retrieval
  let versionId: string;
  const existingVersions = await db
    .select()
    .from(curriculumVersions)
    .where(
      and(
        eq(curriculumVersions.academicLevelId, academicLevelId),
        eq(curriculumVersions.name, versionData.name)
      )
    )
    .limit(1);

  if (existingVersions[0]) {
    versionId = existingVersions[0].id;
    // Ensure the version is active and applicable dates match
    await db
      .update(curriculumVersions)
      .set({
        applicableFrom: new Date(versionData.applicableFrom),
        applicableTo: versionData.applicableTo ? new Date(versionData.applicableTo) : null,
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(curriculumVersions.id, versionId));
  } else {
    // Deactivate any currently active versions for this level to enforce single active model
    await db
      .update(curriculumVersions)
      .set({ isActive: false })
      .where(eq(curriculumVersions.academicLevelId, academicLevelId));

    const [newVersion] = await db
      .insert(curriculumVersions)
      .values({
        academicLevelId,
        name: versionData.name,
        applicableFrom: new Date(versionData.applicableFrom),
        applicableTo: versionData.applicableTo ? new Date(versionData.applicableTo) : null,
        isActive: true,
      })
      .returning();
    versionId = newVersion.id;
  }

  // 3. Process Subjects and Nodes
  for (const sub of payload.subjects) {
    let subjectId: string;
    const existingSubjects = await db
      .select()
      .from(subjects)
      .where(
        and(
          eq(subjects.academicLevelId, academicLevelId),
          eq(subjects.code, sub.code)
        )
      )
      .limit(1);

    if (existingSubjects[0]) {
      subjectId = existingSubjects[0].id;
      await db
        .update(subjects)
        .set({
          name: sub.name,
          sortOrder: sub.sortOrder,
          isActive: true,
        })
        .where(eq(subjects.id, subjectId));
    } else {
      const [newSub] = await db
        .insert(subjects)
        .values({
          academicLevelId,
          code: sub.code,
          name: sub.name,
          sortOrder: sub.sortOrder,
          isActive: true,
        })
        .returning();
      subjectId = newSub.id;
    }

    // Recursively process child nodes
    const importNodesRecursive = async (nodeList: ImportNode[], parentId: string | null = null) => {
      for (const node of nodeList) {
        const [upserted] = await db
          .insert(curriculumNodes)
          .values({
            curriculumVersionId: versionId,
            parentId,
            subjectId,
            type: node.type.toUpperCase(),
            name: node.name,
            code: node.code,
            sortOrder: node.sortOrder,
            isActive: true,
          })
          .onConflictDoUpdate({
            target: curriculumNodes.code,
            set: {
              curriculumVersionId: versionId,
              subjectId,
              name: node.name,
              type: node.type.toUpperCase(),
              sortOrder: node.sortOrder,
              parentId,
              isActive: true,
              updatedAt: new Date(),
            },
          })
          .returning({ id: curriculumNodes.id });

        const nodeId = upserted.id;

        if (node.children && Array.isArray(node.children)) {
          await importNodesRecursive(node.children, nodeId);
        }
      }
    };

    if (sub.nodes && Array.isArray(sub.nodes)) {
      await importNodesRecursive(sub.nodes, null);
    }
  }

  return { success: true, versionId };
}

/**
 * Recursively resolves all descendant curriculum node IDs under a specific parent node.
 * Uses targeted version filtering and an O(N) adjacency map for high-performance scalability.
 */
export async function getDescendantNodeIds(nodeId: string): Promise<string[]> {
  const targetNode = await db
    .select({ curriculumVersionId: curriculumNodes.curriculumVersionId })
    .from(curriculumNodes)
    .where(eq(curriculumNodes.id, nodeId))
    .limit(1);

  if (!targetNode[0]) return [nodeId];

  const versionNodes = await db
    .select({
      id: curriculumNodes.id,
      parentId: curriculumNodes.parentId,
    })
    .from(curriculumNodes)
    .where(eq(curriculumNodes.curriculumVersionId, targetNode[0].curriculumVersionId));

  const descendants: string[] = [];
  const queue: string[] = [nodeId];

  // Build O(N) adjacency list
  const childrenMap = new Map<string, string[]>();
  for (const n of versionNodes) {
    if (n.parentId) {
      const existing = childrenMap.get(n.parentId) || [];
      existing.push(n.id);
      childrenMap.set(n.parentId, existing);
    }
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    descendants.push(current);

    const children = childrenMap.get(current);
    if (children) {
      queue.push(...children);
    }
  }

  return descendants;
}

/**
 * Fetches flat active curriculum nodes for a subject and version.
 */
export async function getCurriculumNodes(subjectId: string, versionId: string) {
  return db
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
        eq(curriculumNodes.subjectId, subjectId),
        eq(curriculumNodes.curriculumVersionId, versionId),
        eq(curriculumNodes.isActive, true)
      )
    )
    .orderBy(curriculumNodes.sortOrder);
}

export interface AdminCurriculumNodeDetail {
  id: string;
  parentId: string | null;
  curriculumVersionId: string;
  subjectId: string;
  type: string;
  name: string;
  code: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  directChildrenCount: number;
  totalDescendantsCount: number;
  children: AdminCurriculumNodeDetail[];
}

export interface AdminSubjectSummary {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  nodesCount: number;
  rootNodes: AdminCurriculumNodeDetail[];
}

export interface AdminLevelSummary {
  id: string;
  code: string;
  name: string;
  versions: {
    id: string;
    name: string;
    isActive: boolean;
    applicableFrom: Date;
    applicableTo: Date | null;
    createdAt: Date;
  }[];
  activeVersion: {
    id: string;
    name: string;
    applicableFrom: Date;
    applicableTo: Date | null;
  } | null;
  subjects: AdminSubjectSummary[];
  totalNodesCount: number;
}

/**
 * Authoritative administrative service to retrieve the complete curriculum hierarchy
 * across academic levels, versions, subjects, and granular node trees.
 */
export async function getAdminCurriculumData(selectedLevelCode?: string): Promise<{
  levels: { id: string; code: string; name: string }[];
  selectedLevel: AdminLevelSummary | null;
}> {
  // 1. Fetch all academic levels
  const allLevels = await db
    .select({
      id: academicLevels.id,
      code: academicLevels.code,
      name: academicLevels.name,
    })
    .from(academicLevels)
    .orderBy(academicLevels.code);

  if (allLevels.length === 0) {
    return { levels: [], selectedLevel: null };
  }

  // 2. Resolve active level (default to INTERMEDIATE or first level)
  const targetLevel = (selectedLevelCode 
    ? allLevels.find((l) => l.code.toUpperCase() === selectedLevelCode.toUpperCase())
    : allLevels.find((l) => l.code === "INTERMEDIATE") || allLevels[0]) || allLevels[0];

  // 3. Fetch all versions for target level
  const versions = await db
    .select()
    .from(curriculumVersions)
    .where(eq(curriculumVersions.academicLevelId, targetLevel.id))
    .orderBy(curriculumVersions.createdAt);

  const activeVersion = versions.find((v) => v.isActive) || versions[0] || null;

  // 4. Fetch all subjects for target level
  const levelSubjects = await db
    .select()
    .from(subjects)
    .where(eq(subjects.academicLevelId, targetLevel.id))
    .orderBy(subjects.sortOrder);

  // 5. Fetch all nodes for active version if version exists
  const allNodes = activeVersion
    ? await db
        .select()
        .from(curriculumNodes)
        .where(eq(curriculumNodes.curriculumVersionId, activeVersion.id))
        .orderBy(curriculumNodes.sortOrder)
    : [];

  // 6. Build hierarchical tree per subject
  const subjectMap = new Map<string, AdminSubjectSummary>();

  for (const sub of levelSubjects) {
    subjectMap.set(sub.id, {
      id: sub.id,
      code: sub.code,
      name: sub.name,
      sortOrder: sub.sortOrder,
      isActive: sub.isActive,
      nodesCount: 0,
      rootNodes: [],
    });
  }

  // Group nodes by subject and compute descendant counts
  for (const sub of levelSubjects) {
    const subNodes = allNodes.filter((n) => n.subjectId === sub.id);
    const subSummary = subjectMap.get(sub.id)!;
    subSummary.nodesCount = subNodes.length;

    const nodeMap = new Map<string, AdminCurriculumNodeDetail>();
    const rootNodes: AdminCurriculumNodeDetail[] = [];

    for (const node of subNodes) {
      nodeMap.set(node.id, {
        id: node.id,
        parentId: node.parentId,
        curriculumVersionId: node.curriculumVersionId,
        subjectId: node.subjectId,
        type: node.type,
        name: node.name,
        code: node.code,
        sortOrder: node.sortOrder,
        isActive: node.isActive,
        createdAt: node.createdAt,
        updatedAt: node.updatedAt,
        directChildrenCount: 0,
        totalDescendantsCount: 0,
        children: [],
      });
    }

    for (const node of subNodes) {
      const treeNode = nodeMap.get(node.id)!;
      if (node.parentId && nodeMap.has(node.parentId)) {
        const parent = nodeMap.get(node.parentId)!;
        parent.children.push(treeNode);
        parent.directChildrenCount += 1;
      } else {
        rootNodes.push(treeNode);
      }
    }

    // Recursively count total descendants and sort
    const processTree = (list: AdminCurriculumNodeDetail[]): number => {
      list.sort((a, b) => a.sortOrder - b.sortOrder);
      let total = 0;
      for (const item of list) {
        const childDescendants = processTree(item.children);
        item.totalDescendantsCount = item.children.length + childDescendants;
        total += 1 + item.totalDescendantsCount;
      }
      return total;
    };

    processTree(rootNodes);
    subSummary.rootNodes = rootNodes;
  }

  const selectedLevelSummary: AdminLevelSummary = {
    id: targetLevel.id,
    code: targetLevel.code,
    name: targetLevel.name,
    versions: versions.map((v) => ({
      id: v.id,
      name: v.name,
      isActive: v.isActive,
      applicableFrom: v.applicableFrom,
      applicableTo: v.applicableTo,
      createdAt: v.createdAt,
    })),
    activeVersion: activeVersion
      ? {
          id: activeVersion.id,
          name: activeVersion.name,
          applicableFrom: activeVersion.applicableFrom,
          applicableTo: activeVersion.applicableTo,
        }
      : null,
    subjects: Array.from(subjectMap.values()),
    totalNodesCount: allNodes.length,
  };

  return {
    levels: allLevels,
    selectedLevel: selectedLevelSummary,
  };
}

export interface AdminVersionItem {
  id: string;
  academicLevelId: string;
  levelCode: string;
  levelName: string;
  name: string;
  applicableFrom: Date;
  applicableTo: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  subjectsCount: number;
  nodesCount: number;
}

/**
 * Retrieves all curriculum versions enriched with node and subject counts.
 */
export async function getAdminCurriculumVersionsData(selectedLevelCode?: string): Promise<{
  levels: { id: string; code: string; name: string }[];
  versions: AdminVersionItem[];
  selectedLevelCode: string;
}> {
  const allLevels = await db
    .select({
      id: academicLevels.id,
      code: academicLevels.code,
      name: academicLevels.name,
    })
    .from(academicLevels)
    .orderBy(academicLevels.code);

  const targetLevel = (selectedLevelCode
    ? allLevels.find((l) => l.code.toUpperCase() === selectedLevelCode.toUpperCase())
    : allLevels.find((l) => l.code === "INTERMEDIATE") || allLevels[0]) || allLevels[0];

  // Fetch all versions with level info
  const versionsQuery = targetLevel
    ? await db
        .select({
          id: curriculumVersions.id,
          academicLevelId: curriculumVersions.academicLevelId,
          levelCode: academicLevels.code,
          levelName: academicLevels.name,
          name: curriculumVersions.name,
          applicableFrom: curriculumVersions.applicableFrom,
          applicableTo: curriculumVersions.applicableTo,
          isActive: curriculumVersions.isActive,
          createdAt: curriculumVersions.createdAt,
          updatedAt: curriculumVersions.updatedAt,
        })
        .from(curriculumVersions)
        .innerJoin(academicLevels, eq(curriculumVersions.academicLevelId, academicLevels.id))
        .where(eq(curriculumVersions.academicLevelId, targetLevel.id))
        .orderBy(curriculumVersions.createdAt)
    : [];

  // Fetch node counts per version
  const nodeCounts = await db
    .select({
      versionId: curriculumNodes.curriculumVersionId,
      count: count(),
    })
    .from(curriculumNodes)
    .groupBy(curriculumNodes.curriculumVersionId);

  const nodeCountMap = new Map(nodeCounts.map((nc) => [nc.versionId, nc.count]));

  // Fetch subjects count per level
  const subjectCounts = await db
    .select({
      academicLevelId: subjects.academicLevelId,
      count: count(),
    })
    .from(subjects)
    .where(eq(subjects.isActive, true))
    .groupBy(subjects.academicLevelId);

  const subjectCountMap = new Map(subjectCounts.map((sc) => [sc.academicLevelId, sc.count]));

  const enrichedVersions: AdminVersionItem[] = versionsQuery.map((v) => ({
    id: v.id,
    academicLevelId: v.academicLevelId,
    levelCode: v.levelCode,
    levelName: v.levelName,
    name: v.name,
    applicableFrom: v.applicableFrom,
    applicableTo: v.applicableTo,
    isActive: v.isActive,
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
    subjectsCount: subjectCountMap.get(v.academicLevelId) || 0,
    nodesCount: nodeCountMap.get(v.id) || 0,
  }));

  return {
    levels: allLevels,
    versions: enrichedVersions,
    selectedLevelCode: targetLevel?.code || "INTERMEDIATE",
  };
}

/**
 * Creates a new curriculum version for a specific academic level.
 */
export async function createCurriculumVersion(data: {
  academicLevelId: string;
  name: string;
  applicableFrom: Date;
  applicableTo?: Date | null;
  isActive?: boolean;
}): Promise<typeof curriculumVersions.$inferSelect> {
  const trimmedName = data.name.trim();
  if (!trimmedName) {
    throw new Error("Version name cannot be empty.");
  }

  const [level] = await db
    .select()
    .from(academicLevels)
    .where(eq(academicLevels.id, data.academicLevelId))
    .limit(1);

  if (!level) {
    throw new Error("Specified academic level was not found.");
  }

  const now = new Date();

  // If marked active on creation, deactivate all other versions for this level
  if (data.isActive) {
    await db
      .update(curriculumVersions)
      .set({ isActive: false, updatedAt: now })
      .where(eq(curriculumVersions.academicLevelId, data.academicLevelId));
  }

  const [newVersion] = await db
    .insert(curriculumVersions)
    .values({
      academicLevelId: data.academicLevelId,
      name: trimmedName,
      applicableFrom: data.applicableFrom,
      applicableTo: data.applicableTo || null,
      isActive: data.isActive ?? false,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return newVersion;
}

/**
 * Updates mutable metadata (name, date range) of an existing curriculum version.
 */
export async function updateCurriculumVersion(data: {
  id: string;
  name: string;
  applicableFrom: Date;
  applicableTo?: Date | null;
}): Promise<typeof curriculumVersions.$inferSelect> {
  const trimmedName = data.name.trim();
  if (!trimmedName) {
    throw new Error("Version name cannot be empty.");
  }

  const [existing] = await db
    .select()
    .from(curriculumVersions)
    .where(eq(curriculumVersions.id, data.id))
    .limit(1);

  if (!existing) {
    throw new Error("Curriculum version not found.");
  }

  const now = new Date();

  const [updated] = await db
    .update(curriculumVersions)
    .set({
      name: trimmedName,
      applicableFrom: data.applicableFrom,
      applicableTo: data.applicableTo || null,
      updatedAt: now,
    })
    .where(eq(curriculumVersions.id, data.id))
    .returning();

  return updated;
}

/**
 * Activates a curriculum version and deactivates all other versions for that academic level.
 */
export async function activateCurriculumVersion(versionId: string): Promise<{ success: boolean; activeVersionId: string }> {
  const [target] = await db
    .select()
    .from(curriculumVersions)
    .where(eq(curriculumVersions.id, versionId))
    .limit(1);

  if (!target) {
    throw new Error("Target curriculum version not found.");
  }

  const now = new Date();

  // 1. Deactivate other versions for the same academic level
  await db
    .update(curriculumVersions)
    .set({ isActive: false, updatedAt: now })
    .where(
      and(
        eq(curriculumVersions.academicLevelId, target.academicLevelId),
        eq(curriculumVersions.isActive, true)
      )
    );

  // 2. Activate the target version
  await db
    .update(curriculumVersions)
    .set({ isActive: true, updatedAt: now })
    .where(eq(curriculumVersions.id, versionId));

  return { success: true, activeVersionId: versionId };
}

/**
 * Deactivates a curriculum version, ensuring it is not the sole active version.
 */
export async function deactivateCurriculumVersion(versionId: string): Promise<{ success: boolean }> {
  const [target] = await db
    .select()
    .from(curriculumVersions)
    .where(eq(curriculumVersions.id, versionId))
    .limit(1);

  if (!target) {
    throw new Error("Curriculum version not found.");
  }

  if (!target.isActive) {
    return { success: true };
  }

  // Count active versions for this level
  const [activeCount] = await db
    .select({ count: count() })
    .from(curriculumVersions)
    .where(
      and(
        eq(curriculumVersions.academicLevelId, target.academicLevelId),
        eq(curriculumVersions.isActive, true)
      )
    );

  if (activeCount && activeCount.count <= 1) {
    throw new Error(
      "Cannot deactivate the only active curriculum version for this academic level. To switch versions, please activate an alternative version instead."
    );
  }

  const now = new Date();
  await db
    .update(curriculumVersions)
    .set({ isActive: false, updatedAt: now })
    .where(eq(curriculumVersions.id, versionId));

  return { success: true };
}

/**
 * Creates a new curriculum node in the syllabus tree.
 */
export async function createCurriculumNode(data: {
  curriculumVersionId: string;
  subjectId: string;
  parentId?: string | null;
  type: string;
  name: string;
  code: string;
  sortOrder?: number;
  isActive?: boolean;
}): Promise<typeof curriculumNodes.$inferSelect> {
  const trimmedName = data.name.trim();
  const trimmedCode = data.code.trim();

  if (!trimmedName) {
    throw new Error("Node name is required.");
  }
  if (!trimmedCode) {
    throw new Error("Node unique code is required.");
  }

  const normalizedType = data.type.toUpperCase();
  if (!VALID_NODE_TYPES.has(normalizedType)) {
    throw new Error(`Invalid node type '${data.type}'. Must be one of: MODULE, SECTION, CHAPTER, UNIT, TOPIC`);
  }

  // 1. Verify Curriculum Version and Subject exist
  const [version] = await db
    .select()
    .from(curriculumVersions)
    .where(eq(curriculumVersions.id, data.curriculumVersionId))
    .limit(1);

  if (!version) {
    throw new Error("Target curriculum version does not exist.");
  }

  const [subject] = await db
    .select()
    .from(subjects)
    .where(eq(subjects.id, data.subjectId))
    .limit(1);

  if (!subject) {
    throw new Error("Target subject does not exist.");
  }

  // 2. If parentId is specified, verify parent exists and belongs to same version & subject
  if (data.parentId) {
    const [parent] = await db
      .select()
      .from(curriculumNodes)
      .where(eq(curriculumNodes.id, data.parentId))
      .limit(1);

    if (!parent) {
      throw new Error("Target parent node was not found.");
    }
    if (parent.curriculumVersionId !== data.curriculumVersionId) {
      throw new Error("Parent node belongs to a different curriculum version.");
    }
    if (parent.subjectId !== data.subjectId) {
      throw new Error("Parent node belongs to a different subject.");
    }
  }

  // 3. Verify Code Uniqueness
  const [existingCode] = await db
    .select({ id: curriculumNodes.id })
    .from(curriculumNodes)
    .where(eq(curriculumNodes.code, trimmedCode))
    .limit(1);

  if (existingCode) {
    throw new Error(`A curriculum node with code '${trimmedCode}' already exists.`);
  }

  // 4. Calculate sort order if not specified
  let sortOrder = data.sortOrder;
  if (typeof sortOrder !== "number") {
    const siblingCondition = data.parentId
      ? and(
          eq(curriculumNodes.curriculumVersionId, data.curriculumVersionId),
          eq(curriculumNodes.subjectId, data.subjectId),
          eq(curriculumNodes.parentId, data.parentId)
        )
      : and(
          eq(curriculumNodes.curriculumVersionId, data.curriculumVersionId),
          eq(curriculumNodes.subjectId, data.subjectId),
          isNull(curriculumNodes.parentId)
        );

    const [siblingCount] = await db
      .select({ count: count() })
      .from(curriculumNodes)
      .where(siblingCondition);

    sortOrder = (siblingCount?.count || 0) + 1;
  }

  const now = new Date();
  const [newNode] = await db
    .insert(curriculumNodes)
    .values({
      curriculumVersionId: data.curriculumVersionId,
      subjectId: data.subjectId,
      parentId: data.parentId || null,
      type: normalizedType,
      name: trimmedName,
      code: trimmedCode,
      sortOrder,
      isActive: data.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return newNode;
}

/**
 * Updates mutable metadata of an existing curriculum node.
 */
export async function updateCurriculumNode(data: {
  id: string;
  name: string;
  code: string;
  type: string;
  sortOrder: number;
  isActive: boolean;
}): Promise<typeof curriculumNodes.$inferSelect> {
  const trimmedName = data.name.trim();
  const trimmedCode = data.code.trim();

  if (!trimmedName) {
    throw new Error("Node name cannot be empty.");
  }
  if (!trimmedCode) {
    throw new Error("Node code cannot be empty.");
  }

  const normalizedType = data.type.toUpperCase();
  if (!VALID_NODE_TYPES.has(normalizedType)) {
    throw new Error(`Invalid node type '${data.type}'. Must be one of: MODULE, SECTION, CHAPTER, UNIT, TOPIC`);
  }

  const [existing] = await db
    .select()
    .from(curriculumNodes)
    .where(eq(curriculumNodes.id, data.id))
    .limit(1);

  if (!existing) {
    throw new Error("Curriculum node not found.");
  }

  // Check code uniqueness across other nodes
  const [codeConflict] = await db
    .select({ id: curriculumNodes.id })
    .from(curriculumNodes)
    .where(and(eq(curriculumNodes.code, trimmedCode), ne(curriculumNodes.id, data.id)))
    .limit(1);

  if (codeConflict) {
    throw new Error(`Another curriculum node with code '${trimmedCode}' already exists.`);
  }

  const now = new Date();
  const [updated] = await db
    .update(curriculumNodes)
    .set({
      name: trimmedName,
      code: trimmedCode,
      type: normalizedType,
      sortOrder: data.sortOrder,
      isActive: data.isActive,
      updatedAt: now,
    })
    .where(eq(curriculumNodes.id, data.id))
    .returning();

  return updated;
}

/**
 * Moves/re-parents a curriculum node to a new parent or to root level,
 * strictly preventing circular hierarchies and cross-version/cross-subject moves.
 */
export async function moveCurriculumNode(
  nodeId: string,
  targetParentId: string | null
): Promise<{ success: boolean; node: typeof curriculumNodes.$inferSelect }> {
  const [node] = await db
    .select()
    .from(curriculumNodes)
    .where(eq(curriculumNodes.id, nodeId))
    .limit(1);

  if (!node) {
    throw new Error("Curriculum node not found.");
  }

  if (targetParentId === nodeId) {
    throw new Error("A node cannot be its own parent.");
  }

  // If moving under a parent, perform strict safety validations
  if (targetParentId) {
    const [targetParent] = await db
      .select()
      .from(curriculumNodes)
      .where(eq(curriculumNodes.id, targetParentId))
      .limit(1);

    if (!targetParent) {
      throw new Error("Target parent node not found.");
    }

    if (targetParent.curriculumVersionId !== node.curriculumVersionId) {
      throw new Error("Cannot move a node across different curriculum versions.");
    }

    if (targetParent.subjectId !== node.subjectId) {
      throw new Error("Cannot move a node across different subjects.");
    }

    // Circular Hierarchy Check: Target parent cannot be a descendant of this node
    const descendants = await getDescendantNodeIds(nodeId);
    if (descendants.includes(targetParentId)) {
      throw new Error("Circular hierarchy prevented: Cannot move a node underneath one of its own descendants.");
    }
  }

  // Calculate new sortOrder at target location
  const siblingCondition = targetParentId
    ? and(
        eq(curriculumNodes.curriculumVersionId, node.curriculumVersionId),
        eq(curriculumNodes.subjectId, node.subjectId),
        eq(curriculumNodes.parentId, targetParentId)
      )
    : and(
        eq(curriculumNodes.curriculumVersionId, node.curriculumVersionId),
        eq(curriculumNodes.subjectId, node.subjectId),
        isNull(curriculumNodes.parentId)
      );

  const [siblingCount] = await db
    .select({ count: count() })
    .from(curriculumNodes)
    .where(siblingCondition);

  const newSortOrder = (siblingCount?.count || 0) + 1;
  const now = new Date();

  const [updatedNode] = await db
    .update(curriculumNodes)
    .set({
      parentId: targetParentId || null,
      sortOrder: newSortOrder,
      updatedAt: now,
    })
    .where(eq(curriculumNodes.id, nodeId))
    .returning();

  return { success: true, node: updatedNode };
}

/**
 * Reorders a curriculum node relative to its immediate siblings (UP or DOWN).
 */
export async function reorderCurriculumNode(
  nodeId: string,
  direction: "UP" | "DOWN"
): Promise<{ success: boolean }> {
  const [node] = await db
    .select()
    .from(curriculumNodes)
    .where(eq(curriculumNodes.id, nodeId))
    .limit(1);

  if (!node) {
    throw new Error("Curriculum node not found.");
  }

  const siblingCondition = node.parentId
    ? and(
        eq(curriculumNodes.curriculumVersionId, node.curriculumVersionId),
        eq(curriculumNodes.subjectId, node.subjectId),
        eq(curriculumNodes.parentId, node.parentId)
      )
    : and(
        eq(curriculumNodes.curriculumVersionId, node.curriculumVersionId),
        eq(curriculumNodes.subjectId, node.subjectId),
        isNull(curriculumNodes.parentId)
      );

  const siblings = await db
    .select()
    .from(curriculumNodes)
    .where(siblingCondition)
    .orderBy(curriculumNodes.sortOrder);

  const currentIndex = siblings.findIndex((s) => s.id === nodeId);
  if (currentIndex === -1) {
    throw new Error("Node not found among siblings.");
  }

  const targetIndex = direction === "UP" ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= siblings.length) {
    // Already at the boundary
    return { success: true };
  }

  const currentSibling = siblings[currentIndex];
  const targetSibling = siblings[targetIndex];

  const now = new Date();

  // Swap sortOrder
  await db
    .update(curriculumNodes)
    .set({ sortOrder: targetSibling.sortOrder, updatedAt: now })
    .where(eq(curriculumNodes.id, currentSibling.id));

  await db
    .update(curriculumNodes)
    .set({ sortOrder: currentSibling.sortOrder, updatedAt: now })
    .where(eq(curriculumNodes.id, targetSibling.id));

  return { success: true };
}

/**
 * Checks all dependencies for a node before deletion.
 */
export async function checkNodeDependencies(nodeId: string): Promise<{
  hasChildren: boolean;
  childCount: number;
  questionsCount: number;
  practiceSessionsCount: number;
  customTestsCount: number;
  aiConversationsCount: number;
  isSafeToDelete: boolean;
  blockReason?: string;
}> {
  const [children] = await db
    .select({ count: count() })
    .from(curriculumNodes)
    .where(eq(curriculumNodes.parentId, nodeId));

  const childCount = children?.count || 0;
  if (childCount > 0) {
    return {
      hasChildren: true,
      childCount,
      questionsCount: 0,
      practiceSessionsCount: 0,
      customTestsCount: 0,
      aiConversationsCount: 0,
      isSafeToDelete: false,
      blockReason: `This node contains ${childCount} child sub-nodes. Remove or re-parent child nodes first, or deactivate this node instead.`,
    };
  }

  const [qCount] = await db
    .select({ count: count() })
    .from(questions)
    .where(eq(questions.curriculumNodeId, nodeId));

  const [pCount] = await db
    .select({ count: count() })
    .from(practiceSessions)
    .where(eq(practiceSessions.curriculumNodeId, nodeId));

  const [tCount] = await db
    .select({ count: count() })
    .from(tests)
    .where(eq(tests.curriculumNodeId, nodeId));

  const [aiCount] = await db
    .select({ count: count() })
    .from(aiConversations)
    .where(eq(aiConversations.curriculumNodeId, nodeId));

  const questionsCount = qCount?.count || 0;
  const practiceSessionsCount = pCount?.count || 0;
  const customTestsCount = tCount?.count || 0;
  const aiConversationsCount = aiCount?.count || 0;

  const totalReferences = questionsCount + practiceSessionsCount + customTestsCount + aiConversationsCount;

  if (totalReferences > 0) {
    return {
      hasChildren: false,
      childCount: 0,
      questionsCount,
      practiceSessionsCount,
      customTestsCount,
      aiConversationsCount,
      isSafeToDelete: false,
      blockReason: `This node is referenced by ${questionsCount} questions, ${practiceSessionsCount} practice sessions, and ${customTestsCount} tests. Deactivate this node instead to preserve student learning records.`,
    };
  }

  return {
    hasChildren: false,
    childCount: 0,
    questionsCount: 0,
    practiceSessionsCount: 0,
    customTestsCount: 0,
    aiConversationsCount: 0,
    isSafeToDelete: true,
  };
}

/**
 * Safely deletes a curriculum node, ensuring zero child nodes and zero external foreign key references.
 */
export async function deleteCurriculumNode(nodeId: string): Promise<{ success: boolean }> {
  const dep = await checkNodeDependencies(nodeId);
  if (!dep.isSafeToDelete) {
    throw new Error(dep.blockReason || "Cannot delete node due to existing dependencies.");
  }

  await db.delete(curriculumNodes).where(eq(curriculumNodes.id, nodeId));
  return { success: true };
}

/**
 * Creates a new subject for an academic level.
 */
export async function createSubject(data: {
  academicLevelId: string;
  code: string;
  name: string;
  sortOrder?: number;
  isActive?: boolean;
}): Promise<typeof subjects.$inferSelect> {
  const trimmedName = data.name.trim();
  const trimmedCode = data.code.trim().toUpperCase();

  if (!trimmedName) {
    throw new Error("Subject name is required.");
  }
  if (!trimmedCode) {
    throw new Error("Subject code is required (e.g. PAPER_1).");
  }

  const [level] = await db
    .select()
    .from(academicLevels)
    .where(eq(academicLevels.id, data.academicLevelId))
    .limit(1);

  if (!level) {
    throw new Error("Academic level not found.");
  }

  // Check code uniqueness per academic level
  const [existingSubject] = await db
    .select({ id: subjects.id })
    .from(subjects)
    .where(
      and(
        eq(subjects.academicLevelId, data.academicLevelId),
        eq(subjects.code, trimmedCode)
      )
    )
    .limit(1);

  if (existingSubject) {
    throw new Error(`A subject with code '${trimmedCode}' already exists for this academic level.`);
  }

  let sortOrder = data.sortOrder;
  if (typeof sortOrder !== "number") {
    const [existingCount] = await db
      .select({ count: count() })
      .from(subjects)
      .where(eq(subjects.academicLevelId, data.academicLevelId));

    sortOrder = (existingCount?.count || 0) + 1;
  }

  const [newSub] = await db
    .insert(subjects)
    .values({
      academicLevelId: data.academicLevelId,
      code: trimmedCode,
      name: trimmedName,
      sortOrder,
      isActive: data.isActive ?? true,
    })
    .returning();

  return newSub;
}

/**
 * Updates metadata of an existing subject.
 */
export async function updateSubject(data: {
  id: string;
  name: string;
  code: string;
  sortOrder: number;
  isActive: boolean;
}): Promise<typeof subjects.$inferSelect> {
  const trimmedName = data.name.trim();
  const trimmedCode = data.code.trim().toUpperCase();

  if (!trimmedName) {
    throw new Error("Subject name cannot be empty.");
  }
  if (!trimmedCode) {
    throw new Error("Subject code cannot be empty.");
  }

  const [existing] = await db
    .select()
    .from(subjects)
    .where(eq(subjects.id, data.id))
    .limit(1);

  if (!existing) {
    throw new Error("Subject not found.");
  }

  // Check code uniqueness across other subjects in this level
  const [codeConflict] = await db
    .select({ id: subjects.id })
    .from(subjects)
    .where(
      and(
        eq(subjects.academicLevelId, existing.academicLevelId),
        eq(subjects.code, trimmedCode),
        ne(subjects.id, data.id)
      )
    )
    .limit(1);

  if (codeConflict) {
    throw new Error(`Another subject with code '${trimmedCode}' already exists for this academic level.`);
  }

  const [updated] = await db
    .update(subjects)
    .set({
      name: trimmedName,
      code: trimmedCode,
      sortOrder: data.sortOrder,
      isActive: data.isActive,
    })
    .where(eq(subjects.id, data.id))
    .returning();

  return updated;
}

/**
 * Reorders a subject relative to other subjects for the same academic level.
 */
export async function reorderSubject(
  subjectId: string,
  direction: "UP" | "DOWN"
): Promise<{ success: boolean }> {
  const [sub] = await db
    .select()
    .from(subjects)
    .where(eq(subjects.id, subjectId))
    .limit(1);

  if (!sub) {
    throw new Error("Subject not found.");
  }

  const allSubjects = await db
    .select()
    .from(subjects)
    .where(eq(subjects.academicLevelId, sub.academicLevelId))
    .orderBy(subjects.sortOrder);

  const currentIndex = allSubjects.findIndex((s) => s.id === subjectId);
  if (currentIndex === -1) {
    throw new Error("Subject index error.");
  }

  const targetIndex = direction === "UP" ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= allSubjects.length) {
    return { success: true };
  }

  const currentSub = allSubjects[currentIndex];
  const targetSub = allSubjects[targetIndex];

  await db
    .update(subjects)
    .set({ sortOrder: targetSub.sortOrder })
    .where(eq(subjects.id, currentSub.id));

  await db
    .update(subjects)
    .set({ sortOrder: currentSub.sortOrder })
    .where(eq(subjects.id, targetSub.id));

  return { success: true };
}

/**
 * Deletes a subject if it contains zero curriculum nodes and zero questions.
 */
export async function deleteSubject(subjectId: string): Promise<{ success: boolean }> {
  const [nodes] = await db
    .select({ count: count() })
    .from(curriculumNodes)
    .where(eq(curriculumNodes.subjectId, subjectId));

  if (nodes && nodes.count > 0) {
    throw new Error(`Cannot delete subject containing ${nodes.count} curriculum nodes. Deactivate the subject instead.`);
  }

  const [qCount] = await db
    .select({ count: count() })
    .from(questions)
    .where(eq(questions.subjectId, subjectId));

  if (qCount && qCount.count > 0) {
    throw new Error(`Cannot delete subject referenced by ${qCount.count} questions. Deactivate the subject instead.`);
  }

  await db.delete(subjects).where(eq(subjects.id, subjectId));
  return { success: true };
}





