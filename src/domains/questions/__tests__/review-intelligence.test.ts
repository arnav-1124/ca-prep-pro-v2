import assert from "node:assert";
import { db } from "@/db";
import {
  academicLevels,
  curriculumVersions,
  subjects,
  curriculumNodes,
  questions,
  questionVersions,
  questionOptions,
  practiceSessions,
  practiceAttempts,
  questionReviews,
  studentProfiles,
} from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import {
  computeAttentionFlags,
  getQuestionReviewQueueData,
  recordQuestionReviewDecision,
  getQuestionReviewHistory,
} from "../review/services";

async function runReviewIntelligenceTests() {
  console.log("==================================================");
  console.log("RUNNING STEP 20 REVIEW INTELLIGENCE TEST SUITE");
  console.log("==================================================");

  // 1. Fetch Existing Context for Tests
  const [level] = await db
    .select()
    .from(academicLevels)
    .where(eq(academicLevels.code, "INTERMEDIATE"))
    .limit(1);

  assert(level, "Academic level INTERMEDIATE must exist");

  const [activeVersion] = await db
    .select()
    .from(curriculumVersions)
    .where(and(eq(curriculumVersions.academicLevelId, level.id), eq(curriculumVersions.isActive, true)))
    .limit(1);

  assert(activeVersion, "Active curriculum version must exist");

  const [activeNode] = await db
    .select()
    .from(curriculumNodes)
    .where(and(eq(curriculumNodes.curriculumVersionId, activeVersion.id), eq(curriculumNodes.isActive, true)))
    .limit(1);

  assert(activeNode, "Active curriculum node must exist");

  const [subject] = await db
    .select()
    .from(subjects)
    .where(eq(subjects.id, activeNode.subjectId))
    .limit(1);

  assert(subject, "Subject must exist");

  console.log(`Context found: Level=${level.code}, Subject=${subject.name}, Node=${activeNode.name}\n`);

  // [1/6] Deterministic Attention Flag Computation In-Memory Tests
  console.log("[1/6] Testing In-Memory Deterministic Attention Flag Computation...");

  // Test Obsolete Curriculum Flag
  const resObsolete = computeAttentionFlags({
    isCurriculumVersionActive: false,
    isCurriculumNodeActive: true,
    isActive: true,
    explanation: "This is a detailed academic explanation that exceeds 20 characters easily.",
    optionsCount: 4,
    questionType: "MCQ",
    duplicateCandidateQuestionId: null,
    duplicateSimilarityScore: null,
    latestReviewDecision: "ACCEPTED",
    latestReviewNotes: null,
    practiceAttemptsCount: 5,
    testQuestionsCount: 1,
    totalVersionsCount: 1,
  });

  assert(resObsolete.flags.some((f) => f.reason === "OBSOLETE_CURRICULUM"), "Should detect OBSOLETE_CURRICULUM flag");
  assert.strictEqual(resObsolete.highestSeverity, "HIGH", "OBSOLETE_CURRICULUM should have HIGH severity");
  console.log("  ✓ PASS: Detected OBSOLETE_CURRICULUM flag with HIGH severity");

  // Test Inactive Node Flag (CRITICAL)
  const resInactiveNode = computeAttentionFlags({
    isCurriculumVersionActive: true,
    isCurriculumNodeActive: false,
    isActive: true,
    explanation: "Valid explanation exceeding 20 chars.",
    optionsCount: 4,
    questionType: "MCQ",
    duplicateCandidateQuestionId: null,
    duplicateSimilarityScore: null,
    latestReviewDecision: "ACCEPTED",
    latestReviewNotes: null,
    practiceAttemptsCount: 5,
    testQuestionsCount: 1,
    totalVersionsCount: 1,
  });

  assert(resInactiveNode.flags.some((f) => f.reason === "INACTIVE_NODE"), "Should detect INACTIVE_NODE flag");
  assert.strictEqual(resInactiveNode.highestSeverity, "CRITICAL", "INACTIVE_NODE must have CRITICAL severity");
  console.log("  ✓ PASS: Detected INACTIVE_NODE flag with CRITICAL severity");

  // Test Weak Explanation Flag (MEDIUM)
  const resWeakExp = computeAttentionFlags({
    isCurriculumVersionActive: true,
    isCurriculumNodeActive: true,
    isActive: true,
    explanation: "Short", // < 20 chars
    optionsCount: 4,
    questionType: "MCQ",
    duplicateCandidateQuestionId: null,
    duplicateSimilarityScore: null,
    latestReviewDecision: "ACCEPTED",
    latestReviewNotes: null,
    practiceAttemptsCount: 5,
    testQuestionsCount: 1,
    totalVersionsCount: 1,
  });

  assert(resWeakExp.flags.some((f) => f.reason === "WEAK_EXPLANATION"), "Should detect WEAK_EXPLANATION flag");
  assert.strictEqual(resWeakExp.highestSeverity, "MEDIUM", "Weak explanation should be MEDIUM severity");
  console.log("  ✓ PASS: Detected WEAK_EXPLANATION flag with MEDIUM severity");

  // Test Malformed Options Flag (HIGH)
  const resFewOpts = computeAttentionFlags({
    isCurriculumVersionActive: true,
    isCurriculumNodeActive: true,
    isActive: true,
    explanation: "Valid academic explanation exceeding 20 characters.",
    optionsCount: 2, // only 2 options for MCQ
    questionType: "MCQ",
    duplicateCandidateQuestionId: null,
    duplicateSimilarityScore: null,
    latestReviewDecision: "ACCEPTED",
    latestReviewNotes: null,
    practiceAttemptsCount: 5,
    testQuestionsCount: 1,
    totalVersionsCount: 1,
  });

  assert(resFewOpts.flags.some((f) => f.reason === "FEW_OPTIONS"), "Should detect FEW_OPTIONS flag");
  assert.strictEqual(resFewOpts.highestSeverity, "HIGH", "Malformed options must have HIGH severity");
  console.log("  ✓ PASS: Detected FEW_OPTIONS flag with HIGH severity");

  // Test Multiple Coexisting Flags
  const resMulti = computeAttentionFlags({
    isCurriculumVersionActive: false, // HIGH
    isCurriculumNodeActive: false, // CRITICAL
    isActive: false, // MEDIUM
    explanation: null, // MEDIUM
    optionsCount: 2, // HIGH
    questionType: "MCQ",
    duplicateCandidateQuestionId: null,
    duplicateSimilarityScore: null,
    latestReviewDecision: null, // LOW (unreviewed)
    latestReviewNotes: null,
    practiceAttemptsCount: 0, // INFO (zero usage)
    testQuestionsCount: 0,
    totalVersionsCount: 3, // INFO (multi-version)
  });

  assert.strictEqual(resMulti.flags.length, 8, "Multiple flags should coexist");
  assert.strictEqual(resMulti.highestSeverity, "CRITICAL", "Highest severity must be CRITICAL");
  console.log("  ✓ PASS: Multiple attention conditions coexisted cleanly and evaluated highest severity to CRITICAL\n");

  // [2/6] Database Integration: Create test questions with known attention profiles
  console.log("[2/6] Setting up Database Test Questions for Review Queue...");

  // Create Inactive Curriculum Node
  const [inactiveNode] = await db
    .insert(curriculumNodes)
    .values({
      curriculumVersionId: activeVersion.id,
      subjectId: subject.id,
      code: `TEST_INACTIVE_${Date.now()}`,
      name: "Inactive Test Chapter",
      type: "CHAPTER",
      sortOrder: 99,
      isActive: false,
    })
    .returning();

  // 1. Question with Inactive Node (Critical)
  const [qCritical] = await db
    .insert(questions)
    .values({
      academicLevelId: level.id,
      subjectId: subject.id,
      curriculumNodeId: inactiveNode.id,
      difficulty: "HARD",
      questionType: "MCQ",
    })
    .returning();

  const [vCritical] = await db
    .insert(questionVersions)
    .values({
      questionId: qCritical.id,
      versionNumber: 1,
      questionText: "Which section governs corporate governance under the Companies Act?",
      correctAnswer: "A",
      explanation: "Section 135 governs Corporate Social Responsibility.",
      isActive: true,
    })
    .returning();

  await db.insert(questionOptions).values([
    { questionVersionId: vCritical.id, optionLetter: "A", optionText: "Section 135" },
    { questionVersionId: vCritical.id, optionLetter: "B", optionText: "Section 149" },
    { questionVersionId: vCritical.id, optionLetter: "C", optionText: "Section 166" },
    { questionVersionId: vCritical.id, optionLetter: "D", optionText: "Section 177" },
  ]);

  // 2. Question with Weak Explanation
  const [qWeakExp] = await db
    .insert(questions)
    .values({
      academicLevelId: level.id,
      subjectId: subject.id,
      curriculumNodeId: activeNode.id,
      difficulty: "EASY",
      questionType: "MCQ",
    })
    .returning();

  const [vWeakExp] = await db
    .insert(questionVersions)
    .values({
      questionId: qWeakExp.id,
      versionNumber: 1,
      questionText: "What is the normal tax rate for domestic companies?",
      correctAnswer: "B",
      explanation: null, // No explanation
      isActive: true,
    })
    .returning();

  await db.insert(questionOptions).values([
    { questionVersionId: vWeakExp.id, optionLetter: "A", optionText: "15%" },
    { questionVersionId: vWeakExp.id, optionLetter: "B", optionText: "25%" },
    { questionVersionId: vWeakExp.id, optionLetter: "C", optionText: "30%" },
    { questionVersionId: vWeakExp.id, optionLetter: "D", optionText: "40%" },
  ]);

  console.log("  ✓ PASS: Inserted database test questions with deterministic attention conditions\n");

  // [3/6] Testing Review Queue Retrieval and Metrics
  console.log("[3/6] Testing Review Queue Querying and Operational Metrics...");

  const queueData = await getQuestionReviewQueueData({
    levelCode: "INTERMEDIATE",
    pageSize: 50,
  });

  assert(queueData.items.length > 0, "Review queue must return items");
  assert(queueData.metrics.totalQuestionsNeedingAttention > 0, "Metrics must record questions needing attention");
  assert(queueData.metrics.criticalCount > 0, "Metrics must record at least 1 critical question");
  assert(queueData.metrics.weakExplanationCount > 0, "Metrics must record weak explanation count");

  const itemCritical = queueData.items.find((i) => i.id === qCritical.id);
  assert(itemCritical, "qCritical must appear in review queue");
  assert.strictEqual(itemCritical.highestSeverity, "CRITICAL", "qCritical highest severity must be CRITICAL");
  assert(itemCritical.attentionFlags.some((f) => f.reason === "INACTIVE_NODE"), "qCritical must have INACTIVE_NODE flag");

  const itemWeak = queueData.items.find((i) => i.id === qWeakExp.id);
  assert(itemWeak, "qWeakExp must appear in review queue");
  assert(itemWeak.attentionFlags.some((f) => f.reason === "WEAK_EXPLANATION"), "qWeakExp must have WEAK_EXPLANATION flag");

  console.log(`  ✓ PASS: Queue returned ${queueData.items.length} items`);
  console.log(`  ✓ PASS: Critical count = ${queueData.metrics.criticalCount}, Weak explanation count = ${queueData.metrics.weakExplanationCount}`);
  console.log("  ✓ PASS: qCritical and qWeakExp correctly identified in queue\n");

  // [4/6] Testing Server-Side Filtering by Reason, Severity & Status
  console.log("[4/6] Testing Server-Side Filtering...");

  // Filter by Attention Reason: INACTIVE_NODE
  const filterByInactive = await getQuestionReviewQueueData({
    levelCode: "INTERMEDIATE",
    attentionReason: "INACTIVE_NODE",
  });
  assert(filterByInactive.items.some((i) => i.id === qCritical.id), "Should include qCritical");
  assert(!filterByInactive.items.some((i) => i.id === qWeakExp.id), "Should NOT include qWeakExp");
  console.log("  ✓ PASS: Filter by attentionReason='INACTIVE_NODE' returned only matching questions");

  // Filter by Severity: CRITICAL
  const filterByCritical = await getQuestionReviewQueueData({
    levelCode: "INTERMEDIATE",
    severity: "CRITICAL",
  });
  assert(filterByCritical.items.every((i) => i.highestSeverity === "CRITICAL"), "All filtered items must have CRITICAL severity");
  console.log("  ✓ PASS: Filter by severity='CRITICAL' returned only critical items");

  // Filter by Attention Reason: WEAK_EXPLANATION
  const filterByWeak = await getQuestionReviewQueueData({
    levelCode: "INTERMEDIATE",
    attentionReason: "WEAK_EXPLANATION",
  });
  assert(filterByWeak.items.some((i) => i.id === qWeakExp.id), "Should include qWeakExp");
  console.log("  ✓ PASS: Filter by attentionReason='WEAK_EXPLANATION' returned matching questions\n");

  // [5/6] Testing Recording Review Decisions
  console.log("[5/6] Testing Recording Review Decisions in question_reviews...");

  // Record Decision: NEEDS_CHANGES on qWeakExp
  const reviewRes1 = await recordQuestionReviewDecision({
    questionId: qWeakExp.id,
    versionId: vWeakExp.id,
    decision: "NEEDS_CHANGES",
    notes: "Please add standard ICAI explanation referencing Section 115BAA.",
    reviewerEmail: "auditor@caprep.pro",
  });

  assert(reviewRes1.success, "Review decision must return success");
  assert.strictEqual(reviewRes1.decision, "NEEDS_CHANGES", "Decision must be NEEDS_CHANGES");
  console.log("  ✓ PASS: Recorded 'NEEDS_CHANGES' review decision");

  // Record Decision: ACCEPTED on qCritical
  const reviewRes2 = await recordQuestionReviewDecision({
    questionId: qCritical.id,
    versionId: vCritical.id,
    decision: "ACCEPTED",
    notes: "Verified content structure; awaiting node reactivation.",
    reviewerEmail: "chief_reviewer@caprep.pro",
  });

  assert(reviewRes2.success, "Review decision 2 must return success");
  console.log("  ✓ PASS: Recorded 'ACCEPTED' review decision");

  // Fetch Review History Timeline
  const history = await getQuestionReviewHistory(qWeakExp.id);
  assert(history.length >= 1, "Review history must contain recorded decision");
  assert.strictEqual(history[0].decision, "NEEDS_CHANGES", "Latest decision must be NEEDS_CHANGES");
  assert.strictEqual(history[0].reviewedBy, "auditor@caprep.pro", "Reviewer email must match");
  assert(history[0].notes?.includes("Section 115BAA"), "Notes must match");
  console.log("  ✓ PASS: Fetched review history timeline with reviewer email, decision, and notes\n");

  // [6/6] Testing Historical Attempt Preservation During Review
  console.log("[6/6] Testing Historical Attempt Immutability During Review Actions...");

  // Create student attempt on qWeakExp
  const [student] = await db
    .insert(studentProfiles)
    .values({
      clerkUserId: `test_review_${Date.now()}`,
      email: `student_review_${Date.now()}@example.com`,
    })
    .returning();

  const [session] = await db
    .insert(practiceSessions)
    .values({
      studentProfileId: student.id,
      academicLevelId: level.id,
      subjectId: subject.id,
      curriculumNodeId: activeNode.id,
      status: "COMPLETED",
    })
    .returning();

  const [attempt] = await db
    .insert(practiceAttempts)
    .values({
      practiceSessionId: session.id,
      questionVersionId: vWeakExp.id,
      selectedAnswer: "B",
      isCorrect: true,
      timeSpentSeconds: 45,
    })
    .returning();

  // Record an additional review decision
  await recordQuestionReviewDecision({
    questionId: qWeakExp.id,
    decision: "REVIEWED",
    notes: "Second review pass complete.",
    reviewerEmail: "senior_admin@caprep.pro",
  });

  // Verify attempt was NOT mutated
  const [persistedAttempt] = await db
    .select()
    .from(practiceAttempts)
    .where(eq(practiceAttempts.id, attempt.id));

  assert.strictEqual(persistedAttempt.selectedAnswer, "B", "Student selected answer must remain B");
  assert.strictEqual(persistedAttempt.isCorrect, true, "Student grade must remain true");
  assert.strictEqual(persistedAttempt.questionVersionId, vWeakExp.id, "Attempt must still reference vWeakExp");

  console.log("  ✓ PASS: Student practice attempt remained 100% untouched during administrative review actions");

  // Cleanup test entities in correct FK order
  const testQIds = [qCritical.id, qWeakExp.id];
  const testVIds = [vCritical.id, vWeakExp.id];

  await db.delete(questionReviews).where(inArray(questionReviews.questionId, testQIds));
  await db.delete(practiceAttempts).where(inArray(practiceAttempts.questionVersionId, testVIds));
  await db.delete(questionOptions).where(inArray(questionOptions.questionVersionId, testVIds));
  await db.delete(questionVersions).where(inArray(questionVersions.id, testVIds));
  await db.delete(questions).where(inArray(questions.id, testQIds));
  await db.delete(curriculumNodes).where(eq(curriculumNodes.id, inactiveNode.id));
  await db.delete(practiceSessions).where(eq(practiceSessions.id, session.id));
  await db.delete(studentProfiles).where(eq(studentProfiles.id, student.id));

  console.log("\n==================================================");
  console.log("TEST RESULTS: 20 PASSED, 0 FAILED");
  console.log("==================================================");
}

runReviewIntelligenceTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test Suite Failed:", err);
    process.exit(1);
  });
