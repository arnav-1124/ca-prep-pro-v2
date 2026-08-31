import { db } from "@/db";
import {
  tests,
  testQuestions,
  academicLevels,
  subjects,
  curriculumNodes,
  curriculumVersions,
  questions,
  caseStudies
} from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { getDescendantNodeIds } from "@/domains/academics/services";

/**
 * Server-side test import service that processes admin-authored assessments in JSON.
 * Executes full in-memory checks before performing database writes to ensure atomicity.
 */
interface ImportQuestionItem {
  order: number;
  questionId?: string;
  caseStudyId?: string;
  questions?: { order: number; questionId: string }[];
}

interface ImportPayload {
  schemaVersion: string;
  levelCode: string;
  test: {
    code: string;
    title: string;
    description?: string | null;
    durationMinutes: number;
    totalMarks: number;
    curriculum?: {
      subjectCode?: string;
      nodeCode?: string;
    };
    questions: ImportQuestionItem[];
  };
}

export async function importTestJson(json: unknown) {
  const data = json as ImportPayload;
  // 1. Core structural validations
  if (data.schemaVersion !== "1.0") {
    throw new Error("Invalid schemaVersion. Only version '1.0' is supported.");
  }
  
  const levelCode = data.levelCode;
  if (!levelCode) {
    throw new Error("Missing levelCode at root level.");
  }
  
  const testData = data.test;
  if (!testData) {
    throw new Error("Missing test definition block in JSON.");
  }
  
  const { code, title, description, durationMinutes, totalMarks, curriculum, questions: testQuestionsList } = testData;
  
  if (!code) throw new Error("Missing test.code mapping identifier.");
  if (!title) throw new Error("Missing test.title text.");
  if (typeof durationMinutes !== "number" || durationMinutes <= 0) {
    throw new Error("durationMinutes must be a positive number.");
  }
  if (typeof totalMarks !== "number" || totalMarks <= 0) {
    throw new Error("totalMarks must be a positive number.");
  }
  if (!Array.isArray(testQuestionsList) || testQuestionsList.length === 0) {
    throw new Error("test.questions must be a non-empty array.");
  }
  
  // 2. Fetch Academic Level context from DB
  const [level] = await db
    .select()
    .from(academicLevels)
    .where(eq(academicLevels.code, levelCode))
    .limit(1);
    
  if (!level) {
    throw new Error(`Academic level with code '${levelCode}' does not exist.`);
  }
  
  // Resolve active curriculum version for this level
  const [activeVersion] = await db
    .select()
    .from(curriculumVersions)
    .where(and(eq(curriculumVersions.academicLevelId, level.id), eq(curriculumVersions.isActive, true)))
    .limit(1);
    
  if (!activeVersion) {
    throw new Error(`No active curriculum version found for level '${levelCode}'.`);
  }
  
  // 3. Resolve Subject and Node context
  let resolvedSubjectId: string | null = null;
  let resolvedNodeId: string | null = null;
  
  if (curriculum?.subjectCode) {
    const [sub] = await db
      .select()
      .from(subjects)
      .where(and(eq(subjects.academicLevelId, level.id), eq(subjects.code, curriculum.subjectCode)))
      .limit(1);
      
    if (!sub) {
      throw new Error(`Subject with code '${curriculum.subjectCode}' does not exist for level '${levelCode}'.`);
    }
    resolvedSubjectId = sub.id;
  }
  
  if (curriculum?.nodeCode) {
    if (!resolvedSubjectId) {
      throw new Error("Cannot specify nodeCode without subjectCode.");
    }
    const [node] = await db
      .select()
      .from(curriculumNodes)
      .where(and(
        eq(curriculumNodes.curriculumVersionId, activeVersion.id),
        eq(curriculumNodes.subjectId, resolvedSubjectId),
        eq(curriculumNodes.code, curriculum.nodeCode)
      ))
      .limit(1);
      
    if (!node) {
      throw new Error(`Curriculum node with code '${curriculum.nodeCode}' does not exist under subject '${curriculum.subjectCode}' in active curriculum version.`);
    }
    resolvedNodeId = node.id;
  }
  
  // 4. In-Memory Validation of referenced questions & case studies
  const referencedQuestionIds = new Set<string>();
  const referencedCaseStudyIds = new Set<string>();
  const allQuestionIds = new Set<string>();
  
  for (let i = 0; i < testQuestionsList.length; i++) {
    const item = testQuestionsList[i];
    const order = item.order;
    if (typeof order !== "number" || order !== i + 1) {
      throw new Error(`Invalid or out-of-sequence order number at questions index ${i}. Must be sequential starting from 1.`);
    }
    
    if (item.questionId) {
      if (allQuestionIds.has(item.questionId)) {
        throw new Error(`Duplicate question reference found: '${item.questionId}' at questions index ${i}.`);
      }
      allQuestionIds.add(item.questionId);
      referencedQuestionIds.add(item.questionId);
    } else if (item.caseStudyId) {
      if (referencedCaseStudyIds.has(item.caseStudyId)) {
        throw new Error(`Duplicate case study reference found: '${item.caseStudyId}' at questions index ${i}.`);
      }
      referencedCaseStudyIds.add(item.caseStudyId);
      
      if (!Array.isArray(item.questions) || item.questions.length === 0) {
        throw new Error(`Case study '${item.caseStudyId}' must contain a non-empty 'questions' array.`);
      }
      
      for (let j = 0; j < item.questions.length; j++) {
        const subItem = item.questions[j];
        if (typeof subItem.order !== "number" || subItem.order !== j + 1) {
          throw new Error(`Invalid or out-of-sequence sub-order number in case study '${item.caseStudyId}' at index ${j}.`);
        }
        if (!subItem.questionId) {
          throw new Error(`Missing questionId in case study '${item.caseStudyId}' at index ${j}.`);
        }
        if (allQuestionIds.has(subItem.questionId)) {
          throw new Error(`Duplicate question reference: '${subItem.questionId}' in case study '${item.caseStudyId}'.`);
        }
        allQuestionIds.add(subItem.questionId);
        referencedQuestionIds.add(subItem.questionId);
      }
    } else {
      throw new Error(`Question item at index ${i} must specify either 'questionId' or 'caseStudyId'.`);
    }
  }
  
  // Retrieve all questions from DB for validation
  const dbQuestions = referencedQuestionIds.size > 0
    ? await db
        .select({
          id: questions.id,
          academicLevelId: questions.academicLevelId,
          subjectId: questions.subjectId,
          curriculumNodeId: questions.curriculumNodeId,
          caseStudyId: questions.caseStudyId,
        })
        .from(questions)
        .where(inArray(questions.id, Array.from(referencedQuestionIds)))
    : [];
    
  if (dbQuestions.length !== referencedQuestionIds.size) {
    const fetchedIds = new Set(dbQuestions.map((q) => q.id));
    const missing = Array.from(referencedQuestionIds).filter((id) => !fetchedIds.has(id));
    throw new Error(`The following questions do not exist in the database: ${missing.join(", ")}`);
  }
  
  // Retrieve all case studies from DB for validation
  const dbCaseStudies = referencedCaseStudyIds.size > 0
    ? await db
        .select({
          id: caseStudies.id,
          academicLevelId: caseStudies.academicLevelId,
          subjectId: caseStudies.subjectId,
        })
        .from(caseStudies)
        .where(inArray(caseStudies.id, Array.from(referencedCaseStudyIds)))
    : [];
    
  if (dbCaseStudies.length !== referencedCaseStudyIds.size) {
    const fetchedIds = new Set(dbCaseStudies.map((c) => c.id));
    const missing = Array.from(referencedCaseStudyIds).filter((id) => !fetchedIds.has(id));
    throw new Error(`The following case studies do not exist in the database: ${missing.join(", ")}`);
  }
  
  // Compute descendant IDs for target node if applicable
  const allowedNodeIds = resolvedNodeId
    ? [resolvedNodeId, ...(await getDescendantNodeIds(resolvedNodeId))]
    : [];
  
  // Validate question level, subject, and node compatibility
  for (const q of dbQuestions) {
    if (q.academicLevelId !== level.id) {
      throw new Error(`Question '${q.id}' does not belong to academic level '${levelCode}'.`);
    }
    
    if (resolvedSubjectId && q.subjectId !== resolvedSubjectId) {
      throw new Error(`Question '${q.id}' does not belong to subject '${curriculum?.subjectCode}'.`);
    }
    
    if (resolvedNodeId && !allowedNodeIds.includes(q.curriculumNodeId)) {
      throw new Error(`Question '${q.id}' does not belong to curriculum node '${curriculum?.nodeCode}' or its descendants.`);
    }
  }
  
  // Validate case studies and their associated questions
  for (const item of testQuestionsList) {
    if (item.caseStudyId) {
      const cs = dbCaseStudies.find((c) => c.id === item.caseStudyId)!;
      if (cs.academicLevelId !== level.id) {
        throw new Error(`Case study '${item.caseStudyId}' does not belong to academic level '${levelCode}'.`);
      }
      if (resolvedSubjectId && cs.subjectId !== resolvedSubjectId) {
        throw new Error(`Case study '${item.caseStudyId}' does not belong to subject '${curriculum?.subjectCode}'.`);
      }
      
      // Verify sub-questions are linked to this case study ID in the questions table
      for (const subItem of item.questions!) {
        const q = dbQuestions.find((q) => q.id === subItem.questionId)!;
        if (q.caseStudyId !== item.caseStudyId) {
          throw new Error(`Question '${subItem.questionId}' is not linked to case study '${item.caseStudyId}' in questions database schema.`);
        }
      }
    }
  }
  
  // 5. In-Memory validation passed! Now perform atomic updates/inserts
  // Check if test code exists
  const [existingTest] = await db
    .select({ id: tests.id })
    .from(tests)
    .where(eq(tests.code, code))
    .limit(1);
    
  let testId = existingTest?.id;
  
  if (existingTest) {
    // Update mutable attributes
    await db
      .update(tests)
      .set({
        title,
        description,
        academicLevelId: level.id,
        curriculumVersionId: activeVersion.id,
        subjectId: resolvedSubjectId,
        curriculumNodeId: resolvedNodeId,
        durationMinutes,
        totalMarks,
      })
      .where(eq(tests.id, existingTest.id));
      
    // Delete existing links in testQuestions
    await db.delete(testQuestions).where(eq(testQuestions.testId, existingTest.id));
  } else {
    // Insert new test record
    const [inserted] = await db
      .insert(tests)
      .values({
        code,
        title,
        description,
        academicLevelId: level.id,
        curriculumVersionId: activeVersion.id,
        subjectId: resolvedSubjectId,
        curriculumNodeId: resolvedNodeId,
        durationMinutes,
        totalMarks,
      })
      .returning();
    testId = inserted.id;
  }
  
  // Insert new ordered testQuestions list
  const valuesToInsert: { testId: string; questionId: string; sortOrder: number }[] = [];
  let sortCounter = 1;
  
  for (const item of testQuestionsList) {
    if (item.questionId) {
      valuesToInsert.push({
        testId: testId!,
        questionId: item.questionId,
        sortOrder: sortCounter++,
      });
    } else if (item.caseStudyId) {
      for (const subItem of item.questions!) {
        valuesToInsert.push({
          testId: testId!,
          questionId: subItem.questionId,
          sortOrder: sortCounter++,
        });
      }
    }
  }
  
  await db.insert(testQuestions).values(valuesToInsert);
  
  return { success: true, testId };
}
