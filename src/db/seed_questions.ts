import { db } from "./index";
import {
  curriculumVersions,
  subjects,
  curriculumNodes,
  questions,
  questionVersions,
  questionOptions,
  caseStudies
} from "./schema";
import { eq, and } from "drizzle-orm";

async function main() {
  console.log("Seeding test questions database...");

  // 1. Resolve CA Intermediate active curriculum version
  const [activeVersion] = await db
    .select()
    .from(curriculumVersions)
    .where(eq(curriculumVersions.isActive, true))
    .limit(1);

  if (!activeVersion) {
    throw new Error("No active curriculum version found. Please run academic levels seed first.");
  }

  const versionId = activeVersion.id;
  const levelId = activeVersion.academicLevelId;

  // 2. Fetch subjects for the level
  const dbSubjects = await db
    .select()
    .from(subjects)
    .where(and(eq(subjects.academicLevelId, levelId), eq(subjects.isActive, true)));

  if (dbSubjects.length === 0) {
    throw new Error("No subjects found for CA Intermediate level.");
  }

  // 3. For each subject, seed sample questions linked to its nodes
  for (const sub of dbSubjects) {
    console.log(`Seeding questions for subject: ${sub.name} (${sub.code})`);

    // Fetch curriculum nodes for this subject
    const nodes = await db
      .select()
      .from(curriculumNodes)
      .where(
        and(
          eq(curriculumNodes.subjectId, sub.id),
          eq(curriculumNodes.curriculumVersionId, versionId),
          eq(curriculumNodes.isActive, true)
        )
      )
      .limit(3);

    if (nodes.length === 0) {
      console.log(`No curriculum nodes found for subject ${sub.name}. Skipping questions seed.`);
      continue;
    }

    // Node 1 Question
    const node = nodes[0];

    // Seed Question 1: MCQ (Easy)
    const [q1] = await db
      .insert(questions)
      .values({
        academicLevelId: levelId,
        subjectId: sub.id,
        curriculumNodeId: node.id,
        difficulty: "EASY",
        questionType: "MCQ",
        isAiGenerated: false,
      })
      .returning();

    const [qv1] = await db
      .insert(questionVersions)
      .values({
        questionId: q1.id,
        versionNumber: 1,
        questionText: `[Development Sample — Not Official ICAI Content]
Under the CA Intermediate syllabus for ${sub.name}, what is the primary purpose of ${node.name}?
Select the most appropriate option based on general standards.`,
        correctAnswer: "A",
        explanation: "Option A is correct because it aligns directly with the core academic definition and standard parameters of the study block.",
        isActive: true,
      })
      .returning();

    await db.insert(questionOptions).values([
      { questionVersionId: qv1.id, optionLetter: "A", optionText: "To establish a structured regulatory reporting frame of standards." },
      { questionVersionId: qv1.id, optionLetter: "B", optionText: "To compute voluntary operational parameters for secondary markets." },
      { questionVersionId: qv1.id, optionLetter: "C", optionText: "To bypass statutory filing constraints for micro-enterprises." },
      { questionVersionId: qv1.id, optionLetter: "D", optionText: "To delegate internal audit duties solely to external management consultants." },
    ]);

    // Seed Question 2: MCQ (Medium)
    const [q2] = await db
      .insert(questions)
      .values({
        academicLevelId: levelId,
        subjectId: sub.id,
        curriculumNodeId: node.id,
        difficulty: "MEDIUM",
        questionType: "MCQ",
        isAiGenerated: false,
      })
      .returning();

    const [qv2] = await db
      .insert(questionVersions)
      .values({
        questionId: q2.id,
        versionNumber: 1,
        questionText: `[Development Sample — Not Official ICAI Content]
Which of the following describes a critical operational challenge when applying the parameters of ${node.name}?`,
        correctAnswer: "C",
        explanation: "Option C is correct because the computational constraints require strict reconciliation of transaction offsets under standard guidelines.",
        isActive: true,
      })
      .returning();

    await db.insert(questionOptions).values([
      { questionVersionId: qv2.id, optionLetter: "A", optionText: "Complete absence of reporting requirements across intermediate cycles." },
      { questionVersionId: qv2.id, optionLetter: "B", optionText: "Automatic exemption from standard GST audits." },
      { questionVersionId: qv2.id, optionLetter: "C", optionText: "Reconciliation offsets between double entry ledger inputs and statutory limits." },
      { questionVersionId: qv2.id, optionLetter: "D", optionText: "Direct submission of draft reports to the Ministry of Finance without internal review." },
    ]);

    console.log(`Successfully seeded 2 questions for ${sub.name}`);
  }

  // 4. Seed a sample Case Study for testing
  const advAcc = dbSubjects.find((s) => s.code === "PAPER_1");
  if (advAcc) {
    console.log(`Seeding Case Study for Advanced Accounting (${advAcc.name})...`);

    const nodes = await db
      .select()
      .from(curriculumNodes)
      .where(
        and(
          eq(curriculumNodes.subjectId, advAcc.id),
          eq(curriculumNodes.curriculumVersionId, versionId),
          eq(curriculumNodes.isActive, true)
        )
      )
      .limit(1);

    if (nodes.length > 0) {
      const node = nodes[0];

      // 4.1 Insert Case Study
      const [caseStudy] = await db
        .insert(caseStudies)
        .values({
          academicLevelId: levelId,
          subjectId: advAcc.id,
          title: "Apex Ltd. Financial Reconstruction",
          scenarioText: `[Development Sample — Not Official ICAI Content]
Apex Ltd., a listed public company operating in the manufacturing sector, is undergoing a financial reconstruction scheme under Section 230-232 of the Companies Act, 2013. The company's paid-up equity share capital consists of 10,00,000 equity shares of Rs. 10 each fully paid up. Due to continuous operating losses of Rs. 45,00,000 accumulated over the last three financial years, the company has proposed a capital reduction of 40% on equity shares.

Additionally, the company has Rs. 15,00,000 in 12% Debentures, and debenture holders have agreed to waive 20% of their outstanding interest dues amounting to Rs. 3,00,000, and accept new 10% Debentures of the face value of Rs. 12,00,000 in exchange for their existing principal. Trade payables amounting to Rs. 8,00,000 have agreed to a discount of 15% on their outstanding balances. The scheme has been approved by the NCLT. All asset values (except land) are to be reduced by 10%. Land values are estimated to have appreciated by Rs. 5,00,000.`,
        })
        .returning();

      // Case Question 1
      const [qC1] = await db
        .insert(questions)
        .values({
          academicLevelId: levelId,
          subjectId: advAcc.id,
          curriculumNodeId: node.id,
          caseStudyId: caseStudy.id,
          difficulty: "MEDIUM",
          questionType: "CASE_STUDY",
          isAiGenerated: false,
        })
        .returning();

      const [qvC1] = await db
        .insert(questionVersions)
        .values({
          questionId: qC1.id,
          versionNumber: 1,
          questionText: "What is the net amount credited to the 'Capital Reduction Account' as a result of the equity share capital reduction?",
          correctAnswer: "A",
          explanation: "Equity Share Capital reduction amount = 10,00,000 shares * Rs. 10 * 40% = Rs. 4,00,000, which is credited to the Capital Reduction Account.",
          isActive: true,
        })
        .returning();

      await db.insert(questionOptions).values([
        { questionVersionId: qvC1.id, optionLetter: "A", optionText: "Rs. 4,00,000" },
        { questionVersionId: qvC1.id, optionLetter: "B", optionText: "Rs. 6,00,000" },
        { questionVersionId: qvC1.id, optionLetter: "C", optionText: "Rs. 10,00,000" },
        { questionVersionId: qvC1.id, optionLetter: "D", optionText: "Rs. 2,00,000" },
      ]);

      // Case Question 2
      const [qC2] = await db
        .insert(questions)
        .values({
          academicLevelId: levelId,
          subjectId: advAcc.id,
          curriculumNodeId: node.id,
          caseStudyId: caseStudy.id,
          difficulty: "MEDIUM",
          questionType: "CASE_STUDY",
          isAiGenerated: false,
        })
        .returning();

      const [qvC2] = await db
        .insert(questionVersions)
        .values({
          questionId: qC2.id,
          versionNumber: 1,
          questionText: "What is the total value of interest waived by the 12% debenture holders that will be credited to the Capital Reduction Account?",
          correctAnswer: "A",
          explanation: "The debenture holders agreed to waive interest dues of Rs. 3,00,000. This is a gain for the company and is credited in full to the Capital Reduction Account.",
          isActive: true,
        })
        .returning();

      await db.insert(questionOptions).values([
        { questionVersionId: qvC2.id, optionLetter: "A", optionText: "Rs. 3,00,000" },
        { questionVersionId: qvC2.id, optionLetter: "B", optionText: "Rs. 1,50,000" },
        { questionVersionId: qvC2.id, optionLetter: "C", optionText: "Rs. 12,00,000" },
        { questionVersionId: qvC2.id, optionLetter: "D", optionText: "Rs. 0" },
      ]);

      // Case Question 3
      const [qC3] = await db
        .insert(questions)
        .values({
          academicLevelId: levelId,
          subjectId: advAcc.id,
          curriculumNodeId: node.id,
          caseStudyId: caseStudy.id,
          difficulty: "HARD",
          questionType: "CASE_STUDY",
          isAiGenerated: false,
        })
        .returning();

      const [qvC3] = await db
        .insert(questionVersions)
        .values({
          questionId: qC3.id,
          versionNumber: 1,
          questionText: "What is the entry to record the settlement of trade payables under the approved reconstruction scheme?",
          correctAnswer: "A",
          explanation: "Debit Trade Payables Rs. 8,00,000, Credit Capital Reduction Rs. 1,20,000 (15% discount), and Credit Payables (Settlement) Rs. 6,80,000.",
          isActive: true,
        })
        .returning();

      await db.insert(questionOptions).values([
        { questionVersionId: qvC3.id, optionLetter: "A", optionText: "Debit Trade Payables Rs. 8,00,000; Credit Capital Reduction Rs. 1,20,000, Credit Payables/Bank Rs. 6,80,000." },
        { questionVersionId: qvC3.id, optionLetter: "B", optionText: "Debit Trade Payables Rs. 8,00,000; Credit Capital Reduction Rs. 8,00,000." },
        { questionVersionId: qvC3.id, optionLetter: "C", optionText: "Debit Trade Payables Rs. 8,00,000; Credit Cash Rs. 8,00,000." },
        { questionVersionId: qvC3.id, optionLetter: "D", optionText: "Debit Capital Reduction Rs. 1,20,000; Credit Trade Payables Rs. 1,20,000." },
      ]);

      // Case Question 4
      const [qC4] = await db
        .insert(questions)
        .values({
          academicLevelId: levelId,
          subjectId: advAcc.id,
          curriculumNodeId: node.id,
          caseStudyId: caseStudy.id,
          difficulty: "EASY",
          questionType: "CASE_STUDY",
          isAiGenerated: false,
        })
        .returning();

      const [qvC4] = await db
        .insert(questionVersions)
        .values({
          questionId: qC4.id,
          versionNumber: 1,
          questionText: "Which account is debited to record the appreciation in the value of Land by Rs. 5,00,000?",
          correctAnswer: "A",
          explanation: "To record the appreciation, the asset (Land) is debited by Rs. 5,00,000 and the Capital Reduction Account is credited by Rs. 5,00,000.",
          isActive: true,
        })
        .returning();

      await db.insert(questionOptions).values([
        { questionVersionId: qvC4.id, optionLetter: "A", optionText: "Land Account" },
        { questionVersionId: qvC4.id, optionLetter: "B", optionText: "Capital Reduction Account" },
        { questionVersionId: qvC4.id, optionLetter: "C", optionText: "Revaluation Reserve Account" },
        { questionVersionId: qvC4.id, optionLetter: "D", optionText: "Profit and Loss Account" },
      ]);

      console.log("Successfully seeded 1 Case Study with 4 questions.");
    }
  }

  console.log("Questions seeding completed successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Questions seeding failed:", err);
    process.exit(1);
  });
