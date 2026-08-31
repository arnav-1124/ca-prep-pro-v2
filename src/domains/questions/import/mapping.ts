import { db } from "@/db";
import { academicLevels, curriculumVersions, subjects, curriculumNodes } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  RawImportQuestionJson,
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
 * Resolves the curriculum mapping for an individual question.
 */
export function resolveQuestionCurriculum(
  q: RawImportQuestionJson,
  ctx: VersionCurriculumContext,
  defaultSubjectId?: string | null
): CurriculumResolutionResult {
  const levelName = ctx.academicLevel.name;
  const versionName = ctx.curriculumVersion.name;

  // 1. Tier 1: Canonical Code Match (Highest Precedence)
  if (q.curriculumNodeCode) {
    const codeKey = q.curriculumNodeCode.trim().toUpperCase();
    const matchedNode = ctx.codeToNode.get(codeKey);
    if (matchedNode) {
      const subject = ctx.subjects.find((s) => s.id === matchedNode.subjectId);
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
  if (q.curriculumNodeId) {
    const matchedNode = ctx.idToNode.get(q.curriculumNodeId.trim());
    if (matchedNode) {
      const subject = ctx.subjects.find((s) => s.id === matchedNode.subjectId);
      return {
        status: "MATCHED_DATABASE_ID",
        academicLevelId: ctx.academicLevel.id,
        curriculumVersionId: ctx.curriculumVersion.id,
        subjectId: matchedNode.subjectId,
        curriculumNodeId: matchedNode.id,
        matchDescription: `Matched exact curriculum node UUID.`,
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

  // 3. Tier 3: Subject Resolution from Hint
  let matchedSubjectId = defaultSubjectId || null;
  if (q.subjectCode) {
    const s = ctx.subjectCodeToSubject.get(q.subjectCode.trim().toUpperCase());
    if (s) matchedSubjectId = s.id;
  }

  // 4. Tier 4: Exact Name Matching (Topic or Chapter)
  const nameCandidate = q.topicName || q.chapterName;
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

  // 5. Tier 5: Fallback Unmapped (With or without subject)
  const subject = ctx.subjects.find((s) => s.id === matchedSubjectId);
  return {
    status: "UNMAPPED",
    academicLevelId: ctx.academicLevel.id,
    curriculumVersionId: ctx.curriculumVersion.id,
    subjectId: matchedSubjectId,
    curriculumNodeId: null,
    matchDescription: matchedSubjectId
      ? `Subject identified (${subject?.name}), but specific Chapter/Topic mapping is required.`
      : "No curriculum mapping hints matched. Full assignment required.",
    breadcrumbs: {
      levelName,
      versionName,
      subjectName: subject?.name,
    },
  };
}
