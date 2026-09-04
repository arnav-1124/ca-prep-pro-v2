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

interface LevelQuestionPayload {
  caseStudies: Array<{ caseStudyRef: string; title: string; scenarioText: string }>;
  questions: Array<{
    externalId?: string;
    questionType?: string;
    difficulty?: string;
    curriculum: {
      subjectCode?: string;
      chapterCode?: string;
      nodeCode?: string;
      _subjectTitle?: string;
      _chapterTitle?: string;
    };
    questionText: string;
    options: Array<{ letter: string; text: string }>;
    correctAnswer: string;
    explanation?: string;
    caseStudyRef?: string;
    caseStudy?: { title: string; scenarioText: string };
    source?: {
      sourceType: string;
      sourceTitle: string;
      sourceAttempt: string;
      applicability: string[];
      paperNumber?: string;
      pageNumber?: number;
    };
  }>;
}

/**
 * Returns level-specific ICAI questions that perfectly match the curriculum of that course level.
 */
function getLevelSpecificQuestions(
  levelCode: "FOUNDATION" | "INTERMEDIATE" | "FINAL",
  subjectMap: Map<string, string>,
  primaryCode: string,
  secondaryCode: string,
  sampleChapterCode: string,
  sampleChapterName: string
): LevelQuestionPayload {
  if (levelCode === "FOUNDATION") {
    const p1Title = subjectMap.get("PAPER_1") || "Accounting";
    const p2Title = subjectMap.get("PAPER_2") || "Business Laws";
    const p4Title = subjectMap.get("PAPER_4") || "Business Economics";

    return {
      caseStudies: [
        {
          caseStudyRef: "CS_FND_LAW_01",
          title: "Formation and Legal Validity of Partnership Agreement of M/s GreenTech Traders",
          scenarioText:
            "Aman (aged 24), Bharat (aged 22), and Chetan (aged 17, a minor) entered into a written agreement on 1st November 2025 to run an electronics retail business under the name of M/s GreenTech Traders. Under the agreement, Aman and Bharat contributed ₹ 5 Lakhs each as capital, while Chetan was admitted with the consent of all partners to the benefits of the partnership with a 20% share in profits without contributing capital. The deed stipulated that Chetan would not bear any business losses. On 10th February 2026, the firm suffered heavy business liabilities of ₹ 18 Lakhs towards creditors for inventory supplied on credit. The creditors filed a suit against all three partners including minor Chetan for personal attachment of their personal assets to recover the outstanding debt.",
        },
      ],
      questions: [
        {
          externalId: "FND-LAW-EX-001",
          questionType: "MCQ",
          difficulty: "MEDIUM",
          curriculum: {
            subjectCode: "PAPER_2",
            chapterCode: "FND_P2_CH2",
            nodeCode: "FND_P2_CH2",
            _subjectTitle: p2Title,
            _chapterTitle: "Chapter 2: The Indian Contract Act, 1872",
          },
          questionText:
            "Under the Indian Contract Act, 1872, what is the legal effect of an agreement entered into with or by a minor?",
          options: [
            { letter: "A", text: "It is voidable at the option of the minor upon attaining the age of majority." },
            { letter: "B", text: "It is void ab initio (completely void from the very beginning)." },
            { letter: "C", text: "It is valid provided it is ratified in writing by the minor within 6 months of turning 18." },
            { letter: "D", text: "It is valid if entered into for the educational benefit or training of the minor." },
          ],
          correctAnswer: "B",
          explanation:
            "In the landmark Privy Council judgment of Mohori Bibee v. Dharmodas Ghose (1903), it was authoritatively established that a minor's agreement is void ab initio. Under Section 11 of the Indian Contract Act, 1872, competency of parties is an essential condition for contract validity.",
          source: {
            sourceType: "STUDY_MATERIAL",
            sourceTitle: "ICAI Study Material — Business Laws",
            sourceAttempt: "MAY_2026",
            applicability: ["MAY_2026", "NOV_2026", "MAY_2027"],
            paperNumber: "PAPER_2",
            pageNumber: 28,
          },
        },
        {
          curriculum: {
            subjectCode: "PAPER_1",
            _subjectTitle: p1Title,
          },
          questionText:
            "Which accounting convention requires that anticipated losses should be recorded in the books of accounts, but unrealized gains should not be anticipated until realized?",
          options: [
            { letter: "A", text: "Convention of Materiality" },
            { letter: "B", text: "Convention of Conservatism (Prudence)" },
            { letter: "C", text: "Convention of Consistency" },
            { letter: "D", text: "Going Concern Concept" },
          ],
          correctAnswer: "B",
          explanation:
            "The Convention of Prudence or Conservatism dictates: 'Do not anticipate profits, but provide for all foreseeable losses.' This ensures assets and income are not overstated and liabilities are not understated.",
        },
        {
          externalId: "FND-CS01-Q1",
          questionType: "CASE_STUDY",
          caseStudyRef: "CS_FND_LAW_01",
          difficulty: "MEDIUM",
          curriculum: {
            subjectCode: "PAPER_2",
            chapterCode: "FND_P2_CH4",
            _subjectTitle: p2Title,
            _chapterTitle: "Chapter 4: The Indian Partnership Act, 1932",
          },
          questionText:
            "Regarding the legal liability of minor Chetan for the debts of ₹ 18 Lakhs incurred by M/s GreenTech Traders, which of the following statements is legally correct under Section 30 of the Indian Partnership Act, 1932?",
          options: [
            { letter: "A", text: "Chetan is personally liable to the creditors and his private estate can be attached." },
            { letter: "B", text: "Chetan's share in the property and profits of the firm is liable, but he is not personally liable." },
            { letter: "C", text: "Chetan's admission to benefits of partnership is void ab initio and creditors cannot recover any funds from the firm." },
            { letter: "D", text: "Chetan is jointly and severally liable along with Aman and Bharat up to ₹ 5 Lakhs." },
          ],
          correctAnswer: "B",
          explanation:
            "Under Section 30(3) of the Indian Partnership Act, 1932, a minor admitted to the benefits of partnership is not personally liable for the acts of the firm. Only his share in the property and profits of the firm is liable.",
        },
        {
          externalId: "FND-CS01-Q2",
          questionType: "CASE_STUDY",
          caseStudyRef: "CS_FND_LAW_01",
          difficulty: "MEDIUM",
          curriculum: {
            subjectCode: "PAPER_2",
            chapterCode: "FND_P2_CH4",
            _subjectTitle: p2Title,
            _chapterTitle: "Chapter 4: The Indian Partnership Act, 1932",
          },
          questionText:
            "Under Section 30(5) of the Indian Partnership Act, 1932, what is the statutory requirement for minor Chetan upon attaining majority if he wishes to decide whether to continue as a partner?",
          options: [
            { letter: "A", text: "He must obtain a decree from the civil court within 30 days of attaining majority." },
            { letter: "B", text: "He must give public notice within 6 months of attaining majority or of obtaining knowledge of his admission to benefits, whichever is later." },
            { letter: "C", text: "He is automatically deemed to have retired unless he signs a fresh partnership deed within 90 days." },
            { letter: "D", text: "He must contribute equal capital within 60 days to continue as a partner." },
          ],
          correctAnswer: "B",
          explanation:
            "Under Section 30(5), at any time within 6 months of attaining majority or of obtaining knowledge that he had been admitted to the benefits of partnership (whichever is later), the person may give public notice that he has elected to become or not become a partner.",
        },
        {
          externalId: "FND-ECO-EX-005",
          questionType: "CASE_STUDY",
          difficulty: "MEDIUM",
          curriculum: {
            subjectCode: "PAPER_4",
            _subjectTitle: p4Title,
          },
          caseStudy: {
            title: "Total Outlay and Elasticity of Demand for Essential Beverage",
            scenarioText:
              "A household spends exactly ₹ 2,400 per month on organic green tea when the price is ₹ 120 per kg (purchasing 20 kg). Due to supply shortages, the price rises to ₹ 150 per kg. Following the price increase, the household curtails its consumption to 16 kg, thereby continuing to spend exactly ₹ 2,400 per month on green tea.",
          },
          questionText:
            "According to the Total Outlay (Expenditure) method formulated by Alfred Marshall, what is the price elasticity of demand for green tea in this scenario?",
          options: [
            { letter: "A", text: "Price elasticity of demand is greater than 1 (Elastic demand)." },
            { letter: "B", text: "Price elasticity of demand is equal to 1 (Unitary elastic demand)." },
            { letter: "C", text: "Price elasticity of demand is less than 1 (Inelastic demand)." },
            { letter: "D", text: "Price elasticity of demand is zero (Perfectly inelastic demand)." },
          ],
          correctAnswer: "B",
          explanation:
            "Under Marshall's Total Outlay Method, when total expenditure remains constant whether price rises or falls, the price elasticity of demand is equal to unity (Ep = 1).",
        },
      ],
    };
  }

  if (levelCode === "FINAL") {
    const p1Title = subjectMap.get("PAPER_1") || "Financial Reporting";
    const p2Title = subjectMap.get("PAPER_2") || "Advanced Financial Management";
    const p3Title = subjectMap.get("PAPER_3") || "Advanced Auditing, Assurance and Professional Ethics";
    const p4Title = subjectMap.get("PAPER_4") || "Direct Tax Laws and International Taxation";

    return {
      caseStudies: [
        {
          caseStudyRef: "CS_FINAL_IBS_01",
          title: "Cross-Border Acquisition and Ind AS Restructuring of Solaris Technologies Ltd",
          scenarioText:
            "Solaris Technologies Ltd (an Indian listed entity) acquired 100% equity shares of NexaCloud Inc (incorporated in Delaware, USA) on 1st April 2025 for a cash consideration of USD 50 Million (₹ 420 Crores). NexaCloud Inc owns proprietary cloud artificial intelligence patents with an assessed fair value of USD 30 Million, while its net identifiable tangible assets have a book value of USD 10 Million and fair value of USD 12 Million. Solaris financed the acquisition partly through internal accruals and partly by issuing USD 25 Million 5-year Foreign Currency Convertible Bonds (FCCBs) at a coupon of 4% p.a. Concurrently, Solaris entered into an inter-company software licensing agreement charging NexaCloud an annual royalty of 8% of global revenues, which the Indian Transfer Pricing Officer (TPO) contends exceeds the Arm's Length Price (ALP) determined under the Transactional Net Margin Method (TNMM).",
        },
      ],
      questions: [
        {
          externalId: "FIN-FR-EX-001",
          questionType: "MCQ",
          difficulty: "HARD",
          curriculum: {
            subjectCode: "PAPER_1",
            chapterCode: "FIN_P1_CH4",
            nodeCode: "FIN_P1_CH4",
            _subjectTitle: p1Title,
            _chapterTitle: "Chapter 4: Ind AS on Revenue from Contracts with Customers (Ind AS 115)",
          },
          questionText:
            "Under Step 3 of Ind AS 115, when determining the transaction price containing variable consideration (such as performance bonuses or volume discounts), which principle governs whether and to what extent variable consideration may be recognized in revenue?",
          options: [
            { letter: "A", text: "Variable consideration must be recognized immediately upon contract signing based on the maximum potential consideration." },
            { letter: "B", text: "It is included in transaction price only to the extent it is highly probable that a significant reversal in cumulative revenue recognized will not occur when uncertainty resolves." },
            { letter: "C", text: "Recognition of variable consideration is strictly prohibited until cash is realized and verified by statutory auditors." },
            { letter: "D", text: "It must be amortized straight-line over the full legal term of the customer relationship." },
          ],
          correctAnswer: "B",
          explanation:
            "Under paragraph 56 of Ind AS 115 (the Variable Consideration Constraint), an entity shall include in the transaction price some or all of an amount of variable consideration estimated only to the extent that it is highly probable that a significant reversal in the amount of cumulative revenue recognized will not occur when the uncertainty associated with the variable consideration is subsequently resolved.",
          source: {
            sourceType: "STUDY_MATERIAL",
            sourceTitle: "ICAI Study Material — Financial Reporting",
            sourceAttempt: "MAY_2026",
            applicability: ["MAY_2026", "NOV_2026", "MAY_2027"],
            paperNumber: "PAPER_1",
            pageNumber: 154,
          },
        },
        {
          curriculum: {
            subjectCode: "PAPER_2",
            _subjectTitle: p2Title,
          },
          questionText:
            "Under the Interest Rate Parity (IRP) theorem in international finance, if the 1-year nominal risk-free interest rate in India is 7.00% and in the USA is 4.00%, the 1-year forward exchange rate for the USD/INR pair will exhibit:",
          options: [
            { letter: "A", text: "A forward premium for the Indian Rupee (INR)." },
            { letter: "B", text: "A forward discount for the US Dollar (USD)." },
            { letter: "C", text: "A forward premium for the US Dollar (USD) approximately equal to the 3.00% interest differential." },
            { letter: "D", text: "Parity at the exact spot rate with zero forward differential." },
          ],
          correctAnswer: "C",
          explanation:
            "Under Interest Rate Parity, the currency with the lower nominal interest rate (USD @ 4%) trades at a forward premium relative to the currency with the higher interest rate (INR @ 7%). The forward premium compensates for the lower interest yield.",
        },
        {
          externalId: "FIN-CS01-Q1",
          questionType: "CASE_STUDY",
          caseStudyRef: "CS_FINAL_IBS_01",
          difficulty: "HARD",
          curriculum: {
            subjectCode: "PAPER_1",
            chapterCode: "FIN_P1_CH6",
            _subjectTitle: p1Title,
            _chapterTitle: "Chapter 6: Business Combinations and Corporate Restructuring (Ind AS 103)",
          },
          questionText:
            "In accounting for the acquisition of NexaCloud Inc under Ind AS 103, what is the amount of Goodwill that Solaris Technologies Ltd must recognize on the acquisition date (1st April 2025)?",
          options: [
            { letter: "A", text: "USD 40 Million (Purchase Consideration USD 50M minus Book Value of Net Tangible Assets USD 10M)" },
            { letter: "B", text: "USD 8 Million (Purchase Consideration USD 50M minus Fair Value of Net Identifiable Assets of USD 42M [USD 12M tangible + USD 30M patents])" },
            { letter: "C", text: "USD 38 Million (Purchase Consideration USD 50M minus Fair Value of Tangibles USD 12M)" },
            { letter: "D", text: "Nil, because intangible assets must be written off to Profit & Loss immediately on acquisition date." },
          ],
          correctAnswer: "B",
          explanation:
            "Under Ind AS 103 paragraph 32, Goodwill is calculated as Consideration transferred (USD 50M) minus the net of the acquisition-date fair value of identifiable assets acquired and liabilities assumed (USD 12M tangible + USD 30M intangible = USD 42M). Hence, Goodwill = USD 50M - USD 42M = USD 8 Million.",
        },
        {
          externalId: "FIN-CS01-Q2",
          questionType: "CASE_STUDY",
          caseStudyRef: "CS_FINAL_IBS_01",
          difficulty: "HARD",
          curriculum: {
            subjectCode: "PAPER_4",
            chapterCode: "FIN_P4_CH5",
            _subjectTitle: p4Title,
            _chapterTitle: "Chapter 5: Transfer Pricing and Other Anti-Avoidance Measures (GAAR)",
          },
          questionText:
            "Regarding the 8% inter-company software royalty charged by Solaris to NexaCloud Inc, which statutory dispute prevention mechanism under the Income-tax Act, 1961 allows Solaris to determine the Arm's Length Price in advance and eliminate double taxation across both India and the USA?",
          options: [
            { letter: "A", text: "Unilateral ruling from the Board for Advance Rulings (BAR) under Section 245-OB." },
            { letter: "B", text: "Bilateral Advance Pricing Agreement (BAPA) entered into with the CBDT under Section 92CC read with the Mutual Agreement Procedure (MAP) of the India-USA DTAA." },
            { letter: "C", text: "Filing a revision application under Section 264 before the Principal Chief Commissioner." },
            { letter: "D", text: "Filing a unilateral transfer pricing safe harbour return under Section 92CB." },
          ],
          correctAnswer: "B",
          explanation:
            "Under Section 92CC(10) of the Income-tax Act, 1961, a Bilateral Advance Pricing Agreement (BAPA) involves the CBDT and the competent authority of the USA under the MAP article of the DTAA, providing binding and bilateral certainty against transfer pricing adjustments and double taxation.",
        },
        {
          externalId: "FIN-AUD-EX-005",
          questionType: "CASE_STUDY",
          difficulty: "HARD",
          curriculum: {
            subjectCode: "PAPER_3",
            _subjectTitle: p3Title,
          },
          caseStudy: {
            title: "Auditor Independence and Relative Shareholding in Audit Client",
            scenarioText:
              "CA. Ananya is the engagement partner for the statutory audit of Horizon Infotech Ltd (a listed public company). Her real brother, who is a software engineer living in the same family residence, holds 1,000 equity shares in Horizon Infotech Ltd with a market value of ₹ 1,80,000. The face value of the shares held is ₹ 10 per share (total face value of ₹ 10,000).",
          },
          questionText:
            "Under Section 141(3)(d)(i) of the Companies Act, 2013 and the ICAI Code of Ethics, is CA. Ananya disqualified from acting as the statutory auditor of Horizon Infotech Ltd?",
          options: [
            { letter: "A", text: "Yes, because any relative holding any securities immediately and irrevocably disqualifies the auditor." },
            { letter: "B", text: "No, because the proviso to Section 141(3)(d)(i) permits a relative to hold securities in the company of face value not exceeding ₹ 1,00,000 (face value here is ₹ 10,000)." },
            { letter: "C", text: "Yes, because the market value of the shares (₹ 1,80,000) exceeds the statutory threshold of ₹ 1,00,000." },
            { letter: "D", text: "No, but only on the condition that her brother disposes of the shares within 10 days of appointment." },
          ],
          correctAnswer: "B",
          explanation:
            "Under the proviso to Section 141(3)(d)(i) of the Companies Act, 2013 read with Rule 10 of the Companies (Audit and Auditors) Rules, 2014, a relative of an auditor may hold security or interest in the company of face value not exceeding ₹ 1,00,000. Since the statutory test applies to face value (₹ 10,000) and not market value, CA. Ananya is not disqualified.",
        },
      ],
    };
  }

  // DEFAULT: INTERMEDIATE
  const p1Title = subjectMap.get("PAPER_1") || "Advanced Accounting";
  const p2Title = subjectMap.get("PAPER_2") || "Corporate and Other Laws";
  const p3Title = subjectMap.get("PAPER_3") || "Taxation";

  return {
    caseStudies: [
      {
        caseStudyRef: "CS_INTER_LAW_01",
        title: "Incorporation and Regulatory Compliance of Zenox Logistics Ltd",
        scenarioText:
          "Zenox Logistics Private Limited was incorporated under the Companies Act, 2013 with a paid-up share capital of ₹ 4.50 Crores and an annual turnover of ₹ 18 Crores for the preceding financial year. The company has three individual shareholders: Mr. Rohan (40%), Mrs. Priya (35%), and Mr. Sameer (25%). On 15th January 2026, Alpha Commercial Holdings Limited (an unlisted public company) acquired 55% of the equity voting shares of Zenox Logistics Private Limited. The Board of Zenox contends that since its Articles of Association still restrict share transferability and limit membership to under 200, it continues to enjoy the status and exemptions of a Private Company. Concurrently, the Board proposes to issue private placement securities to 120 selected friends and 90 Qualified Institutional Buyers (QIBs) within the same financial year.",
      },
    ],
    questions: [
      {
        externalId: "INT-LAW-EX-001",
        questionType: "MCQ",
        difficulty: "MEDIUM",
        curriculum: {
          subjectCode: "PAPER_2",
          chapterCode: sampleChapterCode || "INT_P2_MOD1_CH1",
          nodeCode: sampleChapterCode || "INT_P2_MOD1_CH1",
          _subjectTitle: p2Title,
          _chapterTitle: sampleChapterName || "Chapter 1: Preliminary Concepts & Definitions",
        },
        questionText:
          "Under Section 2(71) of the Companies Act, 2013, when an unlisted public company acquires a controlling equity interest (more than 50% voting power) in a private company, what is the statutory status of the acquired private company?",
        options: [
          { letter: "A", text: "It continues to remain a private company for all statutory and regulatory purposes because its Articles retain private company restrictions." },
          { letter: "B", text: "It is deemed to be a public company for the purposes of the Companies Act, 2013, even if its Articles continue to retain the restrictions mentioned in Section 2(68)." },
          { letter: "C", text: "It becomes a statutory joint venture requiring a fresh certificate of incorporation from the Registrar of Companies." },
          { letter: "D", text: "It ceases to exist as a separate legal entity and automatically merges into the holding public company." },
        ],
        correctAnswer: "B",
        explanation:
          "As per the proviso to Section 2(71) of the Companies Act, 2013, a company which is a subsidiary of a company that is not a private company shall be deemed to be a public company for the purposes of this Act even where such subsidiary company continues to be a private company in its articles.",
        source: {
          sourceType: "STUDY_MATERIAL",
          sourceTitle: "ICAI Study Material — Corporate and Other Laws",
          sourceAttempt: "MAY_2026",
          applicability: ["MAY_2026", "NOV_2026", "MAY_2027", "NOV_2027"],
          paperNumber: "PAPER_2",
          pageNumber: 14,
        },
      },
      {
        curriculum: {
          subjectCode: "PAPER_1",
          _subjectTitle: p1Title,
        },
        questionText:
          "Which of the following accounting concepts dictates that revenue must be recognized in the financial statements only when realized or reasonably certain of realization, and all anticipated expenses/losses must be provided for?",
        options: [
          { letter: "A", text: "Materiality Concept" },
          { letter: "B", text: "Prudence (Conservatism) Concept" },
          { letter: "C", text: "Consistency Concept" },
          { letter: "D", text: "Accrual Concept" },
        ],
        correctAnswer: "B",
        explanation:
          "The Prudence (Conservatism) concept requires that accountants anticipate no profit and provide for all possible losses.",
      },
      {
        externalId: "INT-CS01-Q1",
        questionType: "CASE_STUDY",
        caseStudyRef: "CS_INTER_LAW_01",
        difficulty: "MEDIUM",
        curriculum: {
          subjectCode: "PAPER_2",
          chapterCode: sampleChapterCode || "INT_P2_MOD1_CH1",
          _subjectTitle: p2Title,
          _chapterTitle: sampleChapterName || "Chapter 1: Preliminary Concepts & Definitions",
        },
        questionText:
          "Is the contention of the Board of Zenox Logistics Private Limited legally tenable regarding retaining its private company exemptions following Alpha Commercial Holdings Limited's acquisition?",
        options: [
          { letter: "A", text: "Yes, because the company has not formally altered its Articles of Association under Section 14." },
          { letter: "B", text: "No, by virtue of the proviso to Section 2(71), Zenox is a deemed public company and forfeits private company privileges (such as relaxations under Section 73 and Section 185)." },
          { letter: "C", text: "Yes, provided the company pays a compounding fine of ₹ 50,000 to the Regional Director." },
          { letter: "D", text: "No, because Zenox's annual turnover exceeds ₹ 10 Crores, which independently triggers public company classification." },
        ],
        correctAnswer: "B",
        explanation:
          "The proviso to Section 2(71) operates as an overriding statutory deeming fiction. Once a private company becomes a subsidiary of a public company, it is treated as a deemed public company for all compliance obligations under the Act.",
      },
      {
        externalId: "INT-CS01-Q2",
        questionType: "CASE_STUDY",
        caseStudyRef: "CS_INTER_LAW_01",
        difficulty: "MEDIUM",
        curriculum: {
          subjectCode: "PAPER_2",
          chapterCode: sampleChapterCode || "INT_P2_MOD1_CH1",
          _subjectTitle: p2Title,
          _chapterTitle: sampleChapterName || "Chapter 1: Preliminary Concepts & Definitions",
        },
        questionText:
          "Regarding the proposed private placement offer to 120 selected friends and 90 Qualified Institutional Buyers (QIBs), does this offer comply with the statutory limit under Section 42 of the Companies Act, 2013?",
        options: [
          { letter: "A", text: "No, because the total number of invitees is 210 (120 + 90), which exceeds the statutory ceiling of 200 persons in a financial year." },
          { letter: "B", text: "Yes, because Section 42(2) explicitly excludes Qualified Institutional Buyers (QIBs) and employees offered securities under ESOP from the 200-person ceiling." },
          { letter: "C", text: "No, because private placement cannot be made to more than 50 persons without approval from SEBI." },
          { letter: "D", text: "Yes, but only if approved by unanimous resolution of the Board of Directors." },
        ],
        correctAnswer: "B",
        explanation:
          "Under Section 42 read with Rule 14 of the Companies (Prospectus and Allotment of Securities) Rules, 2014, an offer of private placement shall not exceed 200 persons in the aggregate in a financial year, excluding Qualified Institutional Buyers (QIBs) and employees offered securities under ESOP.",
      },
      {
        externalId: "INT-TAX-EX-005",
        questionType: "CASE_STUDY",
        difficulty: "MEDIUM",
        curriculum: {
          subjectCode: "PAPER_3",
          _subjectTitle: p3Title,
        },
        caseStudy: {
          title: "GST Input Tax Credit on Capital Goods",
          scenarioText:
            "M/s Apex Manufacturing Pvt Ltd acquired a specialized CNC milling machine valued at ₹ 50,00,000 on which IGST of ₹ 9,00,000 (18%) was charged by the vendor on 10th August 2025. While preparing its income tax return for FY 2025-26 under the Income-tax Act, 1961, Apex capitalized the full invoice value of ₹ 59,00,000 to the plant asset block and claimed Section 32 depreciation on the IGST component of ₹ 9,00,000.",
        },
        questionText:
          "Under Section 16(10) of the CGST Act, 2017, what is the consequence of Apex Manufacturing claiming depreciation on the GST tax component under the Income-tax Act?",
        options: [
          { letter: "A", text: "Apex can claim both 100% Input Tax Credit under GST and 100% depreciation under Income Tax." },
          { letter: "B", text: "Input Tax Credit on the tax component of ₹ 9,00,000 shall be strictly denied under the CGST Act." },
          { letter: "C", text: "Input Tax Credit is restricted to 50% of the GST paid." },
          { letter: "D", text: "Input Tax Credit is allowable provided the Assessing Officer issues a no-objection certificate." },
        ],
        correctAnswer: "B",
        explanation:
          "Section 16(10) of the CGST Act explicitly provides that where the registered person has claimed depreciation on the tax component of the cost of capital goods and plant and machinery under the provisions of the Income-tax Act, 1961, the Input Tax Credit on the said tax component shall not be allowed.",
      },
    ],
  };
}

/**
 * Generates an authoritative, self-documenting Canonical Import Schema v2.0 template JSON.
 * Specifically crafted for AI agents and human content managers to extract questions from
 * ICAI Study Material, RTP, MTP, and PYQ PDFs into a 100% valid import payload.
 *
 * Dynamically conforms to the active curriculum and subjects of the targeted level.
 */
export async function generateCanonicalImportTemplate(
  options: GenerateTemplateOptions = {}
): Promise<CanonicalImportTemplateResult> {
  const levelCode = (options.levelCode || "INTERMEDIATE").toUpperCase() as "FOUNDATION" | "INTERMEDIATE" | "FINAL";

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

  const subjectMap = new Map<string, string>();
  for (const s of activeSubjects) {
    subjectMap.set(s.code, s.name);
  }

  // Fetch a sample chapter node from active version
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

  const primarySubjectCode = activeSubjects[1]?.code || activeSubjects[0]?.code || "PAPER_1";
  const secondarySubjectCode = activeSubjects[0]?.code || "PAPER_1";

  const sampleChapterCode = sampleNodes[0]?.code || `${levelCode}_P1_CH1`;
  const sampleChapterName = sampleNodes[0]?.name || "Chapter 1: Theoretical Framework";

  // Build level-specific sample questions and case studies
  const levelData = getLevelSpecificQuestions(
    levelCode,
    subjectMap,
    primarySubjectCode,
    secondarySubjectCode,
    sampleChapterCode,
    sampleChapterName
  );

  // Comprehensive self-documenting JSON contract
  const templatePayload = {
    $schema_documentation: {
      specification_name: `CA Prep Pro Authoritative Canonical Question Schema (Version 2.0) — CA ${levelCode}`,
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
            current_level: levelCode,
            description: "The targeted CA exam course level.",
          },
          curriculumVersionId: {
            requirement: "OPTIONAL (Auto-resolved if omitted)",
            type: "string (UUID)",
            active_version_id: activeVersion?.id,
            description: "Target syllabus version UUID. If omitted, server resolves the active version automatically.",
          },
          curriculumVersionName: {
            requirement: "OPTIONAL",
            type: "string",
            active_version_name: activeVersion?.name || "2026-2027 Scheme of Education and Training",
            description: "Descriptive syllabus version title.",
          },
          batchName: {
            requirement: "COMPULSORY",
            type: "string",
            description: "Human-readable label for the import container (e.g. 'ICAI May 2026 Paper 2 MCQs').",
          },
          questions: {
            requirement: "COMPULSORY",
            type: "array of Question objects",
            description: "List of MCQ and Case Study questions to import.",
          },
          caseStudies: {
            requirement: "OPTIONAL",
            type: "array of CaseStudy objects",
            description: "Reusable case study scenarios referenced by multiple child questions via 'caseStudyRef'.",
          },
        },
        question_level: {
          questionText: {
            requirement: "COMPULSORY",
            type: "string",
            constraints: "10 to 10,000 characters",
            description: "The full text of the question or prompt.",
          },
          options: {
            requirement: "COMPULSORY",
            type: "array of Option objects",
            constraints: "Must contain 2 to 6 options. Each option must have 'letter' and 'text'.",
            description: "The multiple choice alternatives.",
          },
          correctAnswer: {
            requirement: "COMPULSORY",
            type: "string",
            constraints: "Must exactly match one option letter (e.g. 'A', 'B', 'C', or 'D').",
            description: "The single correct answer option letter.",
          },
          curriculum: {
            requirement: "OPTIONAL (Recommended)",
            type: "object",
            description:
              "Curriculum mapping metadata. Assigns question to subject and syllabus node in the active curriculum.",
            fields: {
              subjectCode: {
                requirement: "OPTIONAL (Recommended)",
                type: "string",
                permitted_values_for_this_level: activeSubjects.map((s) => `${s.code} (${s.name})`),
                description: `Must match an active paper code for CA ${levelCode}.`,
              },
              chapterCode: {
                requirement: "OPTIONAL",
                type: "string",
                description: "Canonical chapter code if known.",
              },
              nodeCode: {
                requirement: "OPTIONAL",
                type: "string",
                description: "Full canonical node code if known.",
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
            description: "Unique identifier for deduplication and tracking.",
          },
          source: {
            requirement: "OPTIONAL",
            type: "object",
            description:
              "Source publication details. Can include 'sourceAttempt' (e.g. 'MAY_2026'), 'applicability' array, 'pageNumber', and 'paperNumber'.",
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
        curriculumVersionName: activeVersion?.name || "2026-2027 Scheme of Education and Training",
        available_subject_codes: activeSubjects.map((s) => ({
          code: s.code,
          name: s.name,
        })),
      },
      ai_agent_extraction_prompt: `Extract all MCQs and Case Study questions from the attached ICAI CA ${levelCode} document into this exact JSON structure. Preserve question wording, legal citations, and numerical values with 100% accuracy. Never truncate text. Ensure every question has valid options (A, B, C, D) and a matching correctAnswer letter. Use valid subject codes: ${activeSubjects.map((s) => `${s.code} for ${s.name}`).join(", ")}.`,
    },

    // Authoritative Envelope
    schemaVersion: "2.0",
    batchName: `ICAI CA ${level?.name || levelCode} Master Extraction Batch`,
    academicLevelCode: levelCode,
    curriculumVersionName: activeVersion?.name || "2026-2027 Scheme of Education and Training",
    sourceType: "STUDY_MATERIAL",
    sourceTitle: `ICAI Official Study Material — CA ${level?.name || levelCode}`,
    sourceYear: new Date().getFullYear(),
    sourceMonth: 5,

    // Level-specific shared case studies
    caseStudies: levelData.caseStudies,

    // Level-specific illustrative questions covering real ICAI syllabus
    questions: levelData.questions,
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
