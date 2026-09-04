import { db } from "@/db";
import {
  questions,
  questionVersions,
  questionOptions,
  curriculumNodes,
  curriculumVersions,
  academicLevels,
  subjects,
  practiceAttempts,
  studentProfiles,
  practiceSessions,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  updateAdminQuestion,
  toggleQuestionActiveStatus,
  deleteAdminQuestion,
  exportQuestionsToCanonicalBatch,
} from "../management/services";
import { createImportBatch } from "../import/services";

/**
 * Step 19 Automated Test Suite:
 * Tests Question Bank Management Lifecycle, Versioning Semantics, Curriculum Reassignment,
 * Deactivation vs Dependency-Guarded Deletion, and Canonical Export-Import Round-Trip.
 */
async function runManagementLifecycleTests() {
  console.log("==================================================");
  console.log("RUNNING STEP 19 QUESTION BANK MANAGEMENT TEST SUITE");
  console.log("==================================================");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${testName}${detail ? ` - ${detail}` : ""}`);
      failed++;
    }
  }

  // 0. Setup Context
  const [level] = await db
    .select()
    .from(academicLevels)
    .where(eq(academicLevels.code, "INTERMEDIATE"))
    .limit(1);

  const [activeVer] = await db
    .select()
    .from(curriculumVersions)
    .where(and(eq(curriculumVersions.academicLevelId, level.id), eq(curriculumVersions.isActive, true)))
    .limit(1);

  console.log(`Context found: Level=${level?.code} (${level?.id}), Version=${activeVer?.name} (${activeVer?.id})`);

  let nodes = activeVer
    ? await db
        .select()
        .from(curriculumNodes)
        .where(eq(curriculumNodes.curriculumVersionId, activeVer.id))
        .limit(5)
    : [];

  if (nodes.length < 2 && activeVer) {
    // If no nodes, find any active subjects and create test nodes
    const [sub] = await db.select().from(subjects).where(eq(subjects.academicLevelId, level.id)).limit(1);
    if (sub) {
      const [n1] = await db.insert(curriculumNodes).values({
        curriculumVersionId: activeVer.id,
        subjectId: sub.id,
        code: `TEST_NODE_A_${Date.now()}`,
        name: "Test Topic A",
        type: "TOPIC",
        isActive: true,
      }).returning();
      const [n2] = await db.insert(curriculumNodes).values({
        curriculumVersionId: activeVer.id,
        subjectId: sub.id,
        code: `TEST_NODE_B_${Date.now()}`,
        name: "Test Topic B",
        type: "TOPIC",
        isActive: true,
      }).returning();
      nodes = [n1, n2];
    }
  }

  if (!level || !activeVer || nodes.length < 2) {
    console.error(`Missing test curriculum fixtures. Level: ${!!level}, Version: ${!!activeVer}, Nodes count: ${nodes.length}`);
    process.exit(1);
  }

  const nodeA = nodes[0];
  const nodeB = nodes[1];

  console.log("\n[1/6] Testing Unattempted Question In-Place Mutation...");
  // Create a brand new question with 0 attempts
  const [q1] = await db
    .insert(questions)
    .values({
      academicLevelId: level.id,
      subjectId: nodeA.subjectId,
      curriculumNodeId: nodeA.id,
      difficulty: "MEDIUM",
      questionType: "MCQ",
    })
    .returning();

  const [q1v1] = await db
    .insert(questionVersions)
    .values({
      questionId: q1.id,
      versionNumber: 1,
      questionText: "What is the primary role of the Accounting Standards Board in India?",
      correctAnswer: "A",
      explanation: "ASB formulates accounting standards.",
      isActive: true,
    })
    .returning();

  await db.insert(questionOptions).values([
    { questionVersionId: q1v1.id, optionLetter: "A", optionText: "Formulate Accounting Standards" },
    { questionVersionId: q1v1.id, optionLetter: "B", optionText: "Enforce Tax Collection" },
    { questionVersionId: q1v1.id, optionLetter: "C", optionText: "Audit Companies" },
    { questionVersionId: q1v1.id, optionLetter: "D", optionText: "Issue Passports" },
  ]);

  // Perform an in-place update
  const editResult1 = await updateAdminQuestion({
    questionId: q1.id,
    questionText: "What is the primary role of the Accounting Standards Board (ASB) in India?",
    difficulty: "EASY",
    questionType: "MCQ",
    options: [
      { letter: "A", text: "Formulate Accounting Standards under ICAI" },
      { letter: "B", text: "Enforce Tax Collection" },
      { letter: "C", text: "Audit Companies" },
      { letter: "D", text: "Issue Passports" },
    ],
    correctAnswer: "A",
    explanation: "ASB of ICAI formulates accounting standards.",
    curriculumNodeId: nodeA.id,
    adminEmail: "admin@caprep.pro",
  });

  assert(editResult1.success, "In-place edit returns success");
  assert(!editResult1.createdNewVersion, "Did not create new version when 0 attempts exist");
  assert(editResult1.versionNumber === 1, "Remains at Version 1");

  const [updatedQ1v1] = await db
    .select()
    .from(questionVersions)
    .where(eq(questionVersions.id, q1v1.id));

  assert(
    updatedQ1v1.questionText === "What is the primary role of the Accounting Standards Board (ASB) in India?",
    "Question text was updated in place"
  );

  console.log("\n[2/6] Testing Automatic Versioning on Attempted Questions...");
  // Simulate a student attempt on q1v1
  const [student] = await db
    .insert(studentProfiles)
    .values({
      clerkUserId: `test_clerk_${Date.now()}`,
      email: `test_${Date.now()}@example.com`,
    })
    .returning();

  const [session] = await db
    .insert(practiceSessions)
    .values({
      studentProfileId: student.id,
      academicLevelId: level.id,
      subjectId: nodeA.subjectId,
      practiceMode: "QUESTION",
      status: "COMPLETED",
      questionCount: 1,
    })
    .returning();

  await db.insert(practiceAttempts).values({
    practiceSessionId: session.id,
    questionVersionId: q1v1.id,
    selectedAnswer: "A",
    isCorrect: true,
    timeSpentSeconds: 20,
  });

  // Now update question content when historical attempt exists
  const editResult2 = await updateAdminQuestion({
    questionId: q1.id,
    questionText: "What is the primary role of the ASB under ICAI (Revised Question)?",
    difficulty: "HARD",
    questionType: "MCQ",
    options: [
      { letter: "A", text: "Formulation of Ind AS & AS" },
      { letter: "B", text: "Enforce Tax Collection" },
      { letter: "C", text: "Company Law Compliance" },
      { letter: "D", text: "Stock Market Regulation" },
    ],
    correctAnswer: "A",
    explanation: "Revised explanation for version 2.",
    curriculumNodeId: nodeA.id,
    adminEmail: "admin@caprep.pro",
  });

  assert(editResult2.success, "Edit returns success on attempted question");
  assert(editResult2.createdNewVersion, "Automatically generated a new question version snapshot");
  assert(editResult2.versionNumber === 2, "Incremented to Version 2");

  // Verify historical version 1 was deactivated and preserved
  const [oldVer] = await db
    .select()
    .from(questionVersions)
    .where(eq(questionVersions.id, q1v1.id));

  assert(oldVer.isActive === false, "Historical Version 1 is marked inactive for new attempts");
  assert(
    oldVer.questionText === "What is the primary role of the Accounting Standards Board (ASB) in India?",
    "Historical Version 1 text preserved for past student grading"
  );

  // Verify new version 2 is active
  const [newVer] = await db
    .select()
    .from(questionVersions)
    .where(eq(questionVersions.id, editResult2.versionId));

  assert(newVer.isActive === true, "New Version 2 is marked active");
  assert(newVer.versionNumber === 2, "New Version has versionNumber = 2");

  console.log("\n[3/6] Testing Curriculum Reassignment...");
  // Reassign q1 to nodeB
  const reassignResult = await updateAdminQuestion({
    questionId: q1.id,
    questionText: newVer.questionText,
    difficulty: "HARD",
    questionType: "MCQ",
    options: [
      { letter: "A", text: "Formulation of Ind AS & AS" },
      { letter: "B", text: "Enforce Tax Collection" },
      { letter: "C", text: "Company Law Compliance" },
      { letter: "D", text: "Stock Market Regulation" },
    ],
    correctAnswer: "A",
    explanation: "Revised explanation for version 2.",
    curriculumNodeId: nodeB.id,
    adminEmail: "admin@caprep.pro",
  });

  assert(reassignResult.success, "Curriculum node reassignment succeeded");

  const [reassignedQ] = await db
    .select()
    .from(questions)
    .where(eq(questions.id, q1.id));

  assert(reassignedQ.curriculumNodeId === nodeB.id, "Question curriculumNodeId updated to nodeB");
  assert(reassignedQ.subjectId === nodeB.subjectId, "Question subjectId updated to nodeB.subjectId");

  console.log("\n[4/6] Testing Safe Deactivation vs Dependency-Guarded Deletion...");
  // Toggle status to inactive (retired)
  const toggleResult = await toggleQuestionActiveStatus({
    questionId: q1.id,
    isActive: false,
    adminEmail: "admin@caprep.pro",
  });

  assert(toggleResult.success, "Deactivation toggle succeeded");
  assert(!toggleResult.isActive, "Question status is now inactive");

  // Attempt hard delete on q1 (should FAIL because student attempt exists)
  let deleteBlocked = false;
  let blockMessage = "";
  try {
    await deleteAdminQuestion({
      questionId: q1.id,
      adminEmail: "admin@caprep.pro",
    });
  } catch (err: unknown) {
    deleteBlocked = true;
    blockMessage = err instanceof Error ? err.message : "";
  }

  assert(deleteBlocked, "Hard delete was blocked by dependency guardrail");
  assert(
    blockMessage.includes("student practice attempts"),
    `Block message explains practice dependencies (${blockMessage})`
  );

  // Create an unattempted question and verify hard delete works
  const [q2] = await db
    .insert(questions)
    .values({
      academicLevelId: level.id,
      subjectId: nodeA.subjectId,
      curriculumNodeId: nodeA.id,
      difficulty: "EASY",
      questionType: "MCQ",
    })
    .returning();

  const [q2v1] = await db
    .insert(questionVersions)
    .values({
      questionId: q2.id,
      versionNumber: 1,
      questionText: "Temporary unattempted question to test clean deletion.",
      correctAnswer: "A",
      isActive: true,
    })
    .returning();

  await db.insert(questionOptions).values([
    { questionVersionId: q2v1.id, optionLetter: "A", optionText: "Option 1" },
    { questionVersionId: q2v1.id, optionLetter: "B", optionText: "Option 2" },
  ]);

  const deleteQ2Result = await deleteAdminQuestion({
    questionId: q2.id,
    adminEmail: "admin@caprep.pro",
  });

  assert(deleteQ2Result.success, "Clean deletion succeeded on unattempted question");

  const [deletedQ2] = await db
    .select()
    .from(questions)
    .where(eq(questions.id, q2.id));

  assert(!deletedQ2, "Question q2 was deleted from database");

  console.log("\n[5/6] Testing Canonical Question Export...");
  const exportResult = await exportQuestionsToCanonicalBatch({
    levelCode: "INTERMEDIATE",
    limit: 50,
  });

  assert(exportResult.questionCount > 0, `Exported ${exportResult.questionCount} questions`);
  assert(exportResult.fileName.startsWith("ca-prep-pro-questions-INTERMEDIATE-"), "Filename has standard format");
  assert(exportResult.jsonContent.length > 0, "JSON payload generated");

  const parsedExport = JSON.parse(exportResult.jsonContent);
  assert(parsedExport.schemaVersion === "2.0" || parsedExport.schemaVersion === "1.0", "Export payload has valid schemaVersion");
  assert(Array.isArray(parsedExport.questions), "Export payload contains questions array");
  assert(parsedExport.questions[0].curriculumNodeCode !== undefined || parsedExport.questions[0].curriculum !== undefined, "Exported question has curriculum reference");
  assert(parsedExport.questions[0].options.length >= 2, "Exported question has structured options array");

  console.log("\n[6/6] Testing Importer Round-Trip Compatibility...");
  // Pass the exported JSON directly into the Step 18 Import Pipeline
  const importResult = await createImportBatch({
    rawJsonString: exportResult.jsonContent,
    academicLevelId: level.id,
    curriculumVersionId: activeVer.id,
    adminEmail: "admin@caprep.pro",
  });

  assert(!!importResult.batchId, "Exported JSON was successfully uploaded & parsed by Step 18 Importer");
  assert(importResult.totalQuestions === exportResult.questionCount, "Importer processed exact question count");
  assert(importResult.validCount === exportResult.questionCount, "100% of exported questions passed structural validation");

  console.log("\n==================================================");
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runManagementLifecycleTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
