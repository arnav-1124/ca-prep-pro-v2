import { db } from "@/db";
import { academicLevels, curriculumVersions, subjects, curriculumNodes } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  CanonicalQuestionJson,
  CurriculumResolutionResult,
} from "./types";

export interface VersionCurriculumContext {
  academicLevel: { id: string; code: string; name: string };
  curriculumVersion: { id: string; name: string; isActive: boolean };
  subjects: { id: string; code: string; name: string }[];
  nodes: {
    id: string;
    code: string | null;
    name: string;
    type: string;
    subjectId: string;
    parentId: string | null;
  }[];
  // Fast Lookup Indexes
  codeToNode: Map<string, { id: string; code: string; name: string; type: string; subjectId: string; parentId: string | null }>;
  idToNode: Map<string, { id: string; code: string | null; name: string; type: string; subjectId: string; parentId: string | null }>;
  subjectCodeToSubject: Map<string, { id: string; code: string; name: string }>;
  nameToNodes: Map<string, { id: string; code: string | null; name: string; type: string; subjectId: string; parentId: string | null }[]>;
}

/**
 * Pre-fetches and indexes in-memory curriculum hierarchy for a version context.
 * Guarantees O(1) resolution per question across large batches.
 */
export async function buildVersionCurriculumContext(
  academicLevelId: string,
  curriculumVersionId: string
): Promise<VersionCurriculumContext | null> {
  // 1. Fetch level and version
  const [level] = await db
    .select()
    .from(academicLevels)
    .where(eq(academicLevels.id, academicLevelId))
    .limit(1);

  const [version] = await db
    .select()
    .from(curriculumVersions)
    .where(and(eq(curriculumVersions.id, curriculumVersionId), eq(curriculumVersions.academicLevelId, academicLevelId)))
    .limit(1);

  if (!level || !version) {
    return null;
  }

  // 2. Fetch subjects for level
  const dbSubjects = await db
    .select({
      id: subjects.id,
      code: subjects.code,
      name: subjects.name,
    })
    .from(subjects)
    .where(and(eq(subjects.academicLevelId, academicLevelId), eq(subjects.isActive, true)));

  // 3. Fetch nodes for this version
  const dbNodes = await db
    .select({
      id: curriculumNodes.id,
      code: curriculumNodes.code,
      name: curriculumNodes.name,
      type: curriculumNodes.type,
      subjectId: curriculumNodes.subjectId,
      parentId: curriculumNodes.parentId,
    })
    .from(curriculumNodes)
    .where(and(eq(curriculumNodes.curriculumVersionId, curriculumVersionId), eq(curriculumNodes.isActive, true)));

  // Build Fast In-Memory Lookup Hash Maps
  const codeToNode = new Map<string, typeof dbNodes[0]>();
  const idToNode = new Map<string, typeof dbNodes[0]>();
  const nameToNodes = new Map<string, typeof dbNodes[0][]>();
  const subjectCodeToSubject = new Map<string, typeof dbSubjects[0]>();

  for (const s of dbSubjects) {
    subjectCodeToSubject.set(s.code.toUpperCase(), s);
  }

  for (const n of dbNodes) {
    idToNode.set(n.id, n);
    if (n.code) {
      codeToNode.set(n.code.trim().toUpperCase(), n);
    }
    const normName = n.name.trim().toLowerCase();
    const existing = nameToNodes.get(normName) || [];
    existing.push(n);
    nameToNodes.set(normName, existing);
  }

  return {
    academicLevel: level,
    curriculumVersion: version,
    subjects: dbSubjects,
    nodes: dbNodes,
    codeToNode,
    idToNode,
    subjectCodeToSubject,
    nameToNodes,
  };
}

/**
 * Resolves curriculum mapping for an individual question with hierarchical validation.
 */
export function resolveQuestionCurriculum(
  q: CanonicalQuestionJson,
  ctx: VersionCurriculumContext,
  defaultSubjectId?: string | null
): CurriculumResolutionResult {
  const levelName = ctx.academicLevel.name;
  const versionName = ctx.curriculumVersion.name;

  // Extract explicit or nested curriculum references
  const nodeCode = q.curriculum?.nodeCode || q.curriculumNodeCode;
  const nodeId = q.curriculum?.curriculumNodeId || q.curriculumNodeId;
  const subjectCode = q.curriculum?.subjectCode || q.subjectCode;
  const chapterCode = q.curriculum?.chapterCode;
  const unitCode = q.curriculum?.unitCode;
  const topicCode = q.curriculum?.topicCode;

  // 1. Tier 1: Direct Canonical Code Match (Highest Precedence)
  if (nodeCode) {
    const codeKey = nodeCode.trim().toUpperCase();
    const matchedNode = ctx.codeToNode.get(codeKey);
    if (matchedNode) {
      const subject = ctx.subjects.find((s) => s.id === matchedNode.subjectId);

      // Validate subject consistency if subjectCode was also supplied
      if (subjectCode) {
        const expectedSubject = ctx.subjectCodeToSubject.get(subjectCode.trim().toUpperCase());
        if (expectedSubject && expectedSubject.id !== matchedNode.subjectId) {
          return {
            status: "UNMAPPED",
            academicLevelId: ctx.academicLevel.id,
            curriculumVersionId: ctx.curriculumVersion.id,
            subjectId: expectedSubject.id,
            curriculumNodeId: null,
            matchDescription: `Mismatch: Node "${nodeCode}" belongs to subject "${subject?.name}" but question declared subjectCode "${subjectCode}".`,
            breadcrumbs: { levelName, versionName, subjectName: expectedSubject.name },
          };
        }
      }

      return {
        status: "MATCHED_CANONICAL",
        academicLevelId: ctx.academicLevel.id,
        curriculumVersionId: ctx.curriculumVersion.id,
        subjectId: matchedNode.subjectId,
        curriculumNodeId: matchedNode.id,
        matchDescription: `Matched canonical node code "${matchedNode.code}".`,
        breadcrumbs: {
          levelName,
          versionName,
          subjectName: subject?.name,
          nodeName: matchedNode.name,
          nodeCode: matchedNode.code || undefined,
        },
      };
    }
  }

  // 2. Tier 2: Explicit Database UUID Match
  if (nodeId) {
    const matchedNode = ctx.idToNode.get(nodeId.trim());
    if (matchedNode) {
      const subject = ctx.subjects.find((s) => s.id === matchedNode.subjectId);
      return {
        status: "MATCHED_DATABASE_ID",
        academicLevelId: ctx.academicLevel.id,
        curriculumVersionId: ctx.curriculumVersion.id,
        subjectId: matchedNode.subjectId,
        curriculumNodeId: matchedNode.id,
        matchDescription: "Matched exact curriculum node UUID.",
        breadcrumbs: {
          levelName,
          versionName,
          subjectName: subject?.name,
          nodeName: matchedNode.name,
          nodeCode: matchedNode.code || undefined,
        },
      };
    }
  }

  // 3. Tier 3: Hierarchical Coordinates ({ subjectCode, chapterCode, unitCode, topicCode })
  let matchedSubjectId = defaultSubjectId || null;
  if (subjectCode) {
    const s = ctx.subjectCodeToSubject.get(subjectCode.trim().toUpperCase());
    if (s) {
      matchedSubjectId = s.id;
    } else {
      return {
        status: "UNMAPPED",
        academicLevelId: ctx.academicLevel.id,
        curriculumVersionId: ctx.curriculumVersion.id,
        subjectId: null,
        curriculumNodeId: null,
        matchDescription: `Subject code "${subjectCode}" does not exist in curriculum version "${versionName}".`,
        breadcrumbs: { levelName, versionName },
      };
    }
  }

  // Hierarchical Node Matching: Topic -> Unit -> Chapter -> Subject
  const targetCode = topicCode || unitCode || chapterCode;
  if (targetCode) {
    const codeKey = targetCode.trim().toUpperCase();
    const matchedNode = ctx.codeToNode.get(codeKey);

    if (matchedNode) {
      const nodeSubject = ctx.subjects.find((s) => s.id === matchedNode.subjectId);

      // Validate hierarchy relationship: Node MUST belong to declared subject
      if (matchedSubjectId && matchedNode.subjectId !== matchedSubjectId) {
        const declaredSubject = ctx.subjects.find((s) => s.id === matchedSubjectId);
        return {
          status: "UNMAPPED",
          academicLevelId: ctx.academicLevel.id,
          curriculumVersionId: ctx.curriculumVersion.id,
          subjectId: matchedSubjectId,
          curriculumNodeId: null,
          matchDescription: `Hierarchy violation: Node code "${targetCode}" belongs to subject "${nodeSubject?.name}", not declared subject "${declaredSubject?.name}".`,
          breadcrumbs: { levelName, versionName, subjectName: declaredSubject?.name },
        };
      }

      // If unitCode or chapterCode is also declared, validate parent relationships
      if (unitCode && topicCode && matchedNode.parentId) {
        const parentNode = ctx.idToNode.get(matchedNode.parentId);
        if (parentNode && parentNode.code?.toUpperCase() !== unitCode.trim().toUpperCase()) {
          return {
            status: "UNMAPPED",
            academicLevelId: ctx.academicLevel.id,
            curriculumVersionId: ctx.curriculumVersion.id,
            subjectId: matchedNode.subjectId,
            curriculumNodeId: null,
            matchDescription: `Hierarchy violation: Topic "${topicCode}" is not a child of unit "${unitCode}".`,
            breadcrumbs: { levelName, versionName, subjectName: nodeSubject?.name },
          };
        }
      }

      return {
        status: "MATCHED_CANONICAL",
        academicLevelId: ctx.academicLevel.id,
        curriculumVersionId: ctx.curriculumVersion.id,
        subjectId: matchedNode.subjectId,
        curriculumNodeId: matchedNode.id,
        matchDescription: `Matched hierarchical node code "${matchedNode.code}".`,
        breadcrumbs: {
          levelName,
          versionName,
          subjectName: nodeSubject?.name,
          nodeName: matchedNode.name,
          nodeCode: matchedNode.code || undefined,
        },
      };
    } else {
      const subject = ctx.subjects.find((s) => s.id === matchedSubjectId);
      return {
        status: "UNMAPPED",
        academicLevelId: ctx.academicLevel.id,
        curriculumVersionId: ctx.curriculumVersion.id,
        subjectId: matchedSubjectId,
        curriculumNodeId: null,
        matchDescription: `Curriculum code "${targetCode}" was not found in curriculum version "${versionName}".`,
        breadcrumbs: { levelName, versionName, subjectName: subject?.name },
      };
    }
  }

  // 4. Tier 4: Exact Title Matching (Topic or Chapter display name fallback)
  const nameCandidate =
    q.curriculum?._topicTitle ||
    q.curriculum?._chapterTitle ||
    q.curriculum?._subjectTitle ||
    q.topicName ||
    q.chapterName;

  if (nameCandidate) {
    const normName = nameCandidate.trim().toLowerCase();
    const candidates = ctx.nameToNodes.get(normName) || [];

    // Filter by matched subject if known
    const filteredCandidates = matchedSubjectId
      ? candidates.filter((c) => c.subjectId === matchedSubjectId)
      : candidates;

    if (filteredCandidates.length === 1) {
      const matchedNode = filteredCandidates[0];
      const subject = ctx.subjects.find((s) => s.id === matchedNode.subjectId);
      return {
        status: "MATCHED_EXACT_NAME",
        academicLevelId: ctx.academicLevel.id,
        curriculumVersionId: ctx.curriculumVersion.id,
        subjectId: matchedNode.subjectId,
        curriculumNodeId: matchedNode.id,
        matchDescription: `Matched unique title "${matchedNode.name}".`,
        breadcrumbs: {
          levelName,
          versionName,
          subjectName: subject?.name,
          nodeName: matchedNode.name,
          nodeCode: matchedNode.code || undefined,
        },
      };
    } else if (filteredCandidates.length > 1) {
      const subject = ctx.subjects.find((s) => s.id === matchedSubjectId);
      return {
        status: "AMBIGUOUS_MATCH",
        academicLevelId: ctx.academicLevel.id,
        curriculumVersionId: ctx.curriculumVersion.id,
        subjectId: matchedSubjectId,
        curriculumNodeId: null,
        matchDescription: `Ambiguous: Multiple (${filteredCandidates.length}) nodes match title "${nameCandidate}". Human selection required.`,
        breadcrumbs: {
          levelName,
          versionName,
          subjectName: subject?.name,
        },
      };
    }
  }

  // 5. Tier 5: Subject-Only Mapping Fallback
  if (matchedSubjectId) {
    const subject = ctx.subjects.find((s) => s.id === matchedSubjectId);
    return {
      status: "UNMAPPED",
      academicLevelId: ctx.academicLevel.id,
      curriculumVersionId: ctx.curriculumVersion.id,
      subjectId: matchedSubjectId,
      curriculumNodeId: null,
      matchDescription: `Subject identified (${subject?.name}), but specific Chapter or Topic assignment is required before approval.`,
      breadcrumbs: {
        levelName,
        versionName,
        subjectName: subject?.name,
      },
    };
  }

  // 6. Tier 6: Full Fallback Unmapped
  return {
    status: "UNMAPPED",
    academicLevelId: ctx.academicLevel.id,
    curriculumVersionId: ctx.curriculumVersion.id,
    subjectId: null,
    curriculumNodeId: null,
    matchDescription: "No curriculum mapping hints matched. Full assignment required.",
    breadcrumbs: {
      levelName,
      versionName,
    },
  };
}
