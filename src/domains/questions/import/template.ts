import { db } from "@/db";
import { academicLevels, subjects, curriculumVersions, curriculumNodes } from "@/db/schema/academics";
import { eq, and } from "drizzle-orm";

export interface GenerateTemplateOptions {
  levelCode?: string; // "FOUNDATION" | "INTERMEDIATE" | "FINAL"
}

export interface CanonicalImportTemplateResult {
  fileName: string;
  jsonContent: string;
  schemaVersion: string;
  academicLevelCode: string;
  sampleQuestionCount: number;
}

/**
 * Generates an authoritative, self-documenting Canonical Import Schema v2.0 template JSON.
 * Specifically crafted for AI agents and human content managers to extract questions from
 * ICAI Study Material, RTP, MTP, and PYQ PDFs into a 100% valid import payload.
 */
export async function generateCanonicalImportTemplate(
  options: GenerateTemplateOptions = {}
): Promise<CanonicalImportTemplateResult> {
  const levelCode = (options.levelCode || "INTERMEDIATE").toUpperCase();

  // Fetch Academic Level details
  const [level] = await db
    .select()
    .from(academicLevels)
    .where(eq(academicLevels.code, levelCode))
    .limit(1);

  // Fetch active curriculum version
  const [activeVersion] = level
    ? await db
        .select()
        .from(curriculumVersions)
        .where(and(eq(curriculumVersions.academicLevelId, level.id), eq(curriculumVersions.isActive, true)))
        .limit(1)
    : [];

  // Fetch active subjects for this level
  const activeSubjects = level
    ? await db
        .select({
          code: subjects.code,
          name: subjects.name,
        })
        .from(subjects)
        .where(and(eq(subjects.academicLevelId, level.id), eq(subjects.isActive, true)))
        .orderBy(subjects.sortOrder)
    : [];

  // Fetch a few sample chapter nodes
  const sampleNodes = activeVersion
    ? await db
        .select({
          code: curriculumNodes.code,
          name: curriculumNodes.name,
          subjectId: curriculumNodes.subjectId,
        })
        .from(curriculumNodes)
        .where(and(eq(curriculumNodes.curriculumVersionId, activeVersion.id), eq(curriculumNodes.type, "CHAPTER")))
        .limit(6)
    : [];

  const subjectCodeList = activeSubjects.length > 0
    ? activeSubjects.map((s) => `${s.code} (${s.name})`)
    : ["PAPER_1 (Advanced Accounting)", "PAPER_2 (Corporate and Other Laws)", "PAPER_3 (Taxation)"];

  const primarySubjectCode = activeSubjects[0]?.code || "PAPER_2";
  const primarySubjectName = activeSubjects[0]?.name || "Corporate and Other Laws";
  const secondarySubjectCode = activeSubjects[1]?.code || "PAPER_3";
  const secondarySubjectName = activeSubjects[1]?.name || "Taxation";

  const sampleChapterCode = sampleNodes[0]?.code || `${levelCode}_P2_CH1`;
  const sampleChapterName = sampleNodes[0]?.name || "Chapter 1: Preliminary & Core Definitions";

  // Comprehensive self-documenting JSON contract
  const templatePayload = {
    $schema_documentation: {
      specification_name: "CA Prep Pro Authoritative Canonical Question Schema (Version 2.0)",
      purpose:
        "Master template for AI extraction agents and editors. Feed this template alongside ICAI Study Material, RTP, MTP, or PYQ PDFs to output clean, structured, production-ready question batches.",
      field_requirements: {
        envelope_level: {
          schemaVersion: {
            requirement: "COMPULSORY",
            type: "string",
            permitted_values: ["2.0", "1.0"],
            default: "2.0",
            description: "Must be '2.0' for modern canonical imports.",
          },
          academicLevelCode: {
            requirement: "COMPULSORY",
            type: "string",
            permitted_values: ["FOUNDATION", "INTERMEDIATE", "FINAL"],
            description: "The targeted CA exam course level.",
          },
          questions: {
            requirement: "COMPULSORY",
            type: "array of objects",
            min_items: 1,
            max_items: 500,
            description: "List of question objects to be imported.",
          },
          batchName: {
            requirement: "OPTIONAL (Recommended)",
            type: "string",
            description: "Human-readable label for the batch (e.g. 'ICAI Inter Law RTP May 2026 Chapter 1').",
          },
          sourceType: {
            requirement: "OPTIONAL (Recommended)",
            type: "string",
            permitted_values: [
              "STUDY_MATERIAL",
              "RTP",
              "MTP",
              "PYQ",
              "REVISION_MATERIAL",
              "MOCK_TEST",
              "OTHER_OFFICIAL",
              "AI_GENERATED",
            ],
            default: "STUDY_MATERIAL",
            description: "Official publication category from ICAI.",
          },
          sourceTitle: {
            requirement: "OPTIONAL",
            type: "string",
            description: "Source publication title (e.g. 'ICAI Study Material September 2025 Edition').",
          },
          sourceYear: {
            requirement: "OPTIONAL",
            type: "integer",
            description: "Four-digit publication year (e.g. 2026).",
          },
          sourceMonth: {
            requirement: "OPTIONAL",
            type: "integer",
            description: "Publication month (e.g. 5 for May, 11 for November).",
          },
          caseStudies: {
            requirement: "OPTIONAL (Compulsory if shared case study questions reference caseStudyRef)",
            type: "array of objects",
            description:
              "Batch-level declared case study scenarios shared across multiple child questions. Each item must contain 'caseStudyRef', 'title', and 'scenarioText'.",
          },
        },
        question_level: {
          questionText: {
            requirement: "COMPULSORY",
            type: "string",
            min_length: 10,
            max_length: 10000,
            description:
              "Complete, un-truncated question statement. Must end with proper punctuation (?, ., :).",
          },
          options: {
            requirement: "COMPULSORY",
            type: "array of objects",
            min_items: 2,
            max_items: 6,
            description:
              "Options array. Each item MUST have 'letter' ('A', 'B', 'C', 'D'...) and 'text' (non-empty string).",
          },
          correctAnswer: {
            requirement: "COMPULSORY",
            type: "string",
            description:
              "Exactly one uppercase letter corresponding to the correct option (e.g. 'A', 'B', 'C', 'D').",
          },
          curriculum: {
            requirement: "COMPULSORY OBJECT",
            type: "object",
            description: "Syllabus coordinates mapping this question to the curriculum tree.",
            properties: {
              subjectCode: {
                requirement: "COMPULSORY",
                type: "string",
                description: `Valid subject code. For ${levelCode}, choose from: ${subjectCodeList.join(", ")}.`,
              },
              chapterCode: {
                requirement: "OPTIONAL (Recommended)",
                type: "string",
                description: "Canonical chapter code or identifier.",
              },
              unitCode: {
                requirement: "OPTIONAL",
                type: "string",
                description: "Unit code if the chapter is split into units.",
              },
              topicCode: {
                requirement: "OPTIONAL",
                type: "string",
                description: "Topic code if known.",
              },
              nodeCode: {
                requirement: "OPTIONAL",
                type: "string",
                description: "Full canonical node code if known (e.g. 'INT_P2_MOD1_CH2_T1').",
              },
              _subjectTitle: {
                requirement: "OPTIONAL",
                type: "string",
                description: "Human-readable subject name for display/logging.",
              },
              _chapterTitle: {
                requirement: "OPTIONAL",
                type: "string",
                description: "Human-readable chapter name for display/logging.",
              },
            },
          },
          questionType: {
            requirement: "OPTIONAL",
            type: "string",
            permitted_values: ["MCQ", "CASE_STUDY"],
            default: "MCQ",
            description: "'MCQ' for standalone questions, 'CASE_STUDY' for scenario-linked questions.",
          },
          difficulty: {
            requirement: "OPTIONAL",
            type: "string",
            permitted_values: ["EASY", "MEDIUM", "HARD"],
            default: "MEDIUM",
            description: "Estimated ICAI difficulty rating.",
          },
          explanation: {
            requirement: "OPTIONAL (Highly Recommended)",
            type: "string",
            description:
              "Academic explanation and statutory/accounting standard rationale explaining why the correct answer is correct and why other options are incorrect.",
          },
          externalId: {
            requirement: "OPTIONAL (Recommended)",
            type: "string",
            description: "Unique identifier for deduplication and tracking (e.g. 'LAW-CH1-001').",
          },
          source: {
            requirement: "OPTIONAL",
            type: "object",
            description:
              "Source publication details. Can include 'sourceAttempt' (e.g. 'MAY_2026'), 'applicability' array (e.g. ['MAY_2026', 'NOV_2026', 'MAY_2027']), 'pageNumber', and 'paperNumber'.",
          },
          caseStudyRef: {
            requirement: "OPTIONAL (Compulsory if linking to a batch-level case study)",
            type: "string",
            description: "Matches a 'caseStudyRef' defined in the batch envelope 'caseStudies' array.",
          },
          caseStudy: {
            requirement: "OPTIONAL",
            type: "object",
            description:
              "Inline case study scenario containing 'title' and 'scenarioText' if the scenario is not declared at batch level.",
          },
        },
      },
      active_curriculum_targets: {
        academicLevelCode: levelCode,
        academicLevelName: level?.name || `CA ${levelCode}`,
        curriculumVersionName: activeVersion?.name || "2024 Scheme of Education and Training",
        available_subject_codes: activeSubjects.map((s) => ({
          code: s.code,
          name: s.name,
        })),
      },
      ai_agent_extraction_prompt:
        "Extract all MCQs and Case Study questions from the attached ICAI document into this exact JSON structure. Preserve question wording, legal citations, and numerical values with 100% accuracy. Never truncate text. Ensure every question has valid options (A, B, C, D) and a matching correctAnswer letter. Reference valid subjectCode for each question.",
    },

    // Authoritative Envelope
    schemaVersion: "2.0",
    batchName: `ICAI ${level?.name || levelCode} Master Extraction Batch`,
    academicLevelCode: levelCode,
    curriculumVersionName: activeVersion?.name || "2024 Scheme of Education and Training",
    sourceType: "STUDY_MATERIAL",
    sourceTitle: "ICAI Official Study Material & Revision Publications",
    sourceYear: new Date().getFullYear(),
    sourceMonth: 5,

    // Sample Shared Case Studies (declared once, referenced by multiple child questions)
    caseStudies: [
      {
        caseStudyRef: "CS_INTER_LAW_01",
        title: "Incorporation and Regulatory Compliance of Zenox Logistics Ltd",
        scenarioText:
          "Zenox Logistics Private Limited was incorporated under the Companies Act, 2013 with a paid-up share capital of ₹ 4.50 Crores and an annual turnover of ₹ 18 Crores for the preceding financial year. The company has three individual shareholders: Mr. Rohan (40%), Mrs. Priya (35%), and Mr. Sameer (25%). On 15th January 2026, Alpha Commercial Holdings Limited (an unlisted public company) acquired 55% of the equity voting shares of Zenox Logistics Private Limited. The Board of Zenox contends that since its Articles of Association still restrict share transferability and limit membership to under 200, it continues to enjoy the status and exemptions of a Private Company. Concurrently, the Board proposes to issue private placement securities to 120 selected friends and 90 Qualified Institutional Buyers (QIBs) within the same financial year.",
      },
    ],

    // Illustrative Questions covering all real-world ICAI patterns
    questions: [
      {
        // -------------------------------------------------------------
        // EXAMPLE 1: Comprehensive Standalone MCQ (All Fields Included)
        // -------------------------------------------------------------
        externalId: `${levelCode}-EX-001`,
        questionType: "MCQ",
        difficulty: "MEDIUM",
        curriculum: {
          subjectCode: primarySubjectCode,
          chapterCode: sampleChapterCode,
          nodeCode: sampleChapterCode,
          _subjectTitle: primarySubjectName,
          _chapterTitle: sampleChapterName,
        },
        questionText:
          "Under Section 2(71) of the Companies Act, 2013, when an unlisted public company acquires a controlling equity interest (more than 50% voting power) in a private company, what is the statutory status of the acquired private company?",
        options: [
          {
            letter: "A",
            text: "It continues to remain a private company for all statutory and regulatory purposes because its Articles of Association retain private company restrictions.",
          },
          {
            letter: "B",
            text: "It is deemed to be a public company for the purposes of the Companies Act, 2013, even if its Articles continue to retain the restrictions mentioned in Section 2(68).",
          },
          {
            letter: "C",
            text: "It becomes a statutory joint venture enterprise requiring fresh certificate of incorporation from the Registrar of Companies.",
          },
          {
            letter: "D",
            text: "It ceases to exist as a separate legal entity and automatically merges into the holding public company.",
          },
        ],
        correctAnswer: "B",
        explanation:
          "As per the proviso to Section 2(71) of the Companies Act, 2013, a company which is a subsidiary of a company that is not a private company shall be deemed to be a public company for the purposes of this Act even where such subsidiary company continues to be a private company in its articles.",
        source: {
          sourceType: "STUDY_MATERIAL",
          sourceTitle: "ICAI Study Material — Corporate and Other Laws",
          sourceAttempt: "MAY_2026",
          applicability: ["MAY_2026", "NOV_2026", "MAY_2027", "NOV_2027"],
          paperNumber: primarySubjectCode,
          pageNumber: 14,
        },
      },

      {
        // -------------------------------------------------------------
        // EXAMPLE 2: Minimal Standalone MCQ (Only Compulsory Fields)
        // -------------------------------------------------------------
        curriculum: {
          subjectCode: secondarySubjectCode,
        },
        questionText:
          "Which of the following accounting concepts dictates that revenue must be recognized in the financial statements only when realized or reasonably certain of realization, and all anticipated expenses/losses must be provided for?",
        options: [
          { letter: "A", text: "Going Concern Concept" },
          { letter: "B", text: "Prudence (Conservatism) Principle" },
          { letter: "C", text: "Consistency Principle" },
          { letter: "D", text: "Money Measurement Concept" },
        ],
        correctAnswer: "B",
      },

      {
        // -------------------------------------------------------------
        // EXAMPLE 3: Shared Case Study Child Question 1 (Referencing CS_INTER_LAW_01)
        // -------------------------------------------------------------
        externalId: `${levelCode}-CS01-Q1`,
        questionType: "CASE_STUDY",
        caseStudyRef: "CS_INTER_LAW_01",
        difficulty: "HARD",
        curriculum: {
          subjectCode: primarySubjectCode,
          chapterCode: sampleChapterCode,
          _subjectTitle: primarySubjectName,
          _chapterTitle: sampleChapterName,
        },
        questionText:
          "Based on the scenario of Zenox Logistics, is the contention of the Board of Directors legally sustainable regarding maintaining private company exemptions after Alpha Commercial Holdings Ltd acquired 55% voting equity?",
        options: [
          {
            letter: "A",
            text: "Yes, because Section 2(68) grants absolute sanctity to the restrictive covenants in the company's Articles of Association.",
          },
          {
            letter: "B",
            text: "No, by virtue of the proviso to Section 2(71), Zenox is a deemed public company and forfeits private company privileges (such as exemption from Section 185 and relaxations under Section 73).",
          },
          {
            letter: "C",
            text: "Yes, provided the company pays a compounding fine of ₹ 50,000 to the Regional Director.",
          },
          {
            letter: "D",
            text: "No, because Zenox's annual turnover exceeds ₹ 10 Crores, which independently triggers public company classification.",
          },
        ],
        correctAnswer: "B",
        explanation:
          "The proviso to Section 2(71) operates as an overriding deeming fiction. Once a private company becomes a subsidiary of a public company, it is treated as a deemed public company for all compliance and statutory obligations under the Act.",
      },

      {
        // -------------------------------------------------------------
        // EXAMPLE 4: Shared Case Study Child Question 2 (Referencing CS_INTER_LAW_01)
        // -------------------------------------------------------------
        externalId: `${levelCode}-CS01-Q2`,
        questionType: "CASE_STUDY",
        caseStudyRef: "CS_INTER_LAW_01",
        difficulty: "MEDIUM",
        curriculum: {
          subjectCode: primarySubjectCode,
          chapterCode: sampleChapterCode,
          _subjectTitle: primarySubjectName,
          _chapterTitle: sampleChapterName,
        },
        questionText:
          "Regarding the proposed private placement offer to 120 selected friends and 90 Qualified Institutional Buyers (QIBs), does this offer comply with the statutory limit under Section 42 of the Companies Act, 2013?",
        options: [
          {
            letter: "A",
            text: "No, because the total number of invitees is 210 (120 + 90), which exceeds the statutory ceiling of 200 persons in a financial year.",
          },
          {
            letter: "B",
            text: "Yes, because Section 42(2) explicitly excludes Qualified Institutional Buyers (QIBs) and employees offered securities under ESOP from the 200-person ceiling.",
          },
          {
            letter: "C",
            text: "No, because private placement cannot be made to more than 50 persons without approval from SEBI.",
          },
          {
            letter: "D",
            text: "Yes, but only if approved by unanimous resolution of the Board of Directors.",
          },
        ],
        correctAnswer: "B",
        explanation:
          "Under Section 42 read with Rule 14 of the Companies (Prospectus and Allotment of Securities) Rules, 2014, an offer of private placement shall not exceed 200 persons in the aggregate in a financial year, excluding Qualified Institutional Buyers (QIBs) and employees offered securities under ESOP.",
      },

      {
        // -------------------------------------------------------------
        // EXAMPLE 5: Inline Case Study Question (Scenario Defined Inside Question)
        // -------------------------------------------------------------
        externalId: `${levelCode}-EX-005`,
        questionType: "CASE_STUDY",
        difficulty: "MEDIUM",
        curriculum: {
          subjectCode: secondarySubjectCode,
          _subjectTitle: secondarySubjectName,
        },
        caseStudy: {
          title: "GST Input Tax Credit on Capital Goods",
          scenarioText:
            "M/s Apex Manufacturing Pvt Ltd acquired a specialized CNC milling machine valued at ₹ 50,00,000 on which IGST of ₹ 9,00,000 (18%) was charged by the vendor on 10th August 2025. While preparing its income tax return for FY 2025-26 under the Income-tax Act, 1961, Apex capitalized the full invoice value of ₹ 59,00,000 to the plant asset block and claimed Section 32 depreciation on the IGST component of ₹ 9,00,000.",
        },
        questionText:
          "Under Section 16(10) of the CGST Act, 2017, what is the consequence of Apex Manufacturing claiming depreciation on the GST tax component under the Income-tax Act?",
        options: [
          {
            letter: "A",
            text: "Apex can claim both 100% Input Tax Credit under GST and 100% depreciation under Income Tax.",
          },
          {
            letter: "B",
            text: "Input Tax Credit on the tax component of ₹ 9,00,000 shall be strictly denied under the CGST Act.",
          },
          {
            letter: "C",
            text: "Input Tax Credit is restricted to 50% of the GST paid.",
          },
          {
            letter: "D",
            text: "Input Tax Credit is allowable provided the Assessing Officer issues a no-objection certificate.",
          },
        ],
        correctAnswer: "B",
        explanation:
          "Section 16(10) of the CGST Act explicitly provides that where the registered person has claimed depreciation on the tax component of the cost of capital goods and plant and machinery under the provisions of the Income-tax Act, 1961, the Input Tax Credit on the said tax component shall not be allowed.",
      },
    ],
  };

  const fileName = `ca-prep-pro-import-template-${levelCode.toLowerCase()}-v2.json`;

  return {
    fileName,
    jsonContent: JSON.stringify(templatePayload, null, 2),
    schemaVersion: "2.0",
    academicLevelCode: levelCode,
    sampleQuestionCount: templatePayload.questions.length,
  };
}
