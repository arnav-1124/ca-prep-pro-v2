# CA Prep Pro — Canonical Question Import/Export Schema Specification
**Authoritative Contract: Schema Version `2.0`**

---

## 1. Architectural Purpose & Scope

The CA Prep Pro Question Import/Export format is **curriculum-aware, not curriculum-duplicating**. It provides an authoritative, structured JSON exchange contract designed to ingest and export questions originating from official ICAI Study Material, Revision Test Papers (RTP), Mock Test Papers (MTP), Past Year Questions (PYQ), revision publications, and custom question banks.

### Core Architectural Invariants:
1. **Curriculum as Source of Truth**: Questions reference existing curriculum nodes via stable canonical codes (e.g. `INT_P1_CH1_T1`) or hierarchical coordinates (`{ subjectCode, chapterCode, unitCode, topicCode }`). The import schema never creates, renames, or mutates syllabus entities.
2. **Explicit Curriculum Versioning**: Questions are imported into an explicit, target `curriculumVersionId` / `academicLevelCode`. The curriculum version is never guessed or assumed from display names.
3. **Flexible Hierarchy**: Questions may be mapped at **Subject**, **Chapter**, **Unit**, or **Topic** levels. A question is never rejected simply because a topic code was omitted when higher-level coordinates are valid.
4. **Source Origin vs Applicability**: The originating publication/attempt (e.g. `RTP May 2026`) is explicitly separated from the student exam cycles to which the question applies (e.g. `["MAY_2026", "NOV_2026", "MAY_2027"]`).
5. **Shared Case Study Scenarios**: Shared case studies are declared once (via batch-level `caseStudies` or inline) and referenced by child questions via `caseStudyRef`, preventing scenario duplication while preserving independent question metadata and grading.
6. **Round-Trip Fidelity**: Every question exported from CA Prep Pro produces valid canonical JSON that can be imported back into the system with zero loss of curriculum coordinates, option structures, or source metadata.

---

## 2. Schema Versions & Backward Compatibility

- **`schemaVersion: "2.0"` (Current Canonical)**: Fully structured envelope with dedicated `curriculum`, `source`, and `caseStudies` objects.
- **`schemaVersion: "1.0"` (Legacy Compatible)**: Flat format where curriculum and source fields reside directly on the question object. The importer accepts v1.0 files seamlessly and maps them into canonical staging rows.

---

## 3. Complete JSON Schema Specification

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "CAPrepProCanonicalBatchJson",
  "type": "object",
  "required": ["schemaVersion", "academicLevelCode", "questions"],
  "properties": {
    "schemaVersion": {
      "type": "string",
      "enum": ["2.0", "1.0"],
      "default": "2.0"
    },
    "batchName": { "type": "string" },
    "academicLevelCode": {
      "type": "string",
      "enum": ["FOUNDATION", "INTERMEDIATE", "FINAL"]
    },
    "curriculumVersionId": { "type": "string" },
    "curriculumVersionCode": { "type": "string" },
    "curriculumVersionName": { "type": "string" },
    "sourceType": {
      "type": "string",
      "enum": [
        "STUDY_MATERIAL",
        "RTP",
        "MTP",
        "PYQ",
        "REVISION_MATERIAL",
        "MOCK_TEST",
        "OTHER_OFFICIAL",
        "AI_GENERATED",
        "OTHER"
      ]
    },
    "sourceTitle": { "type": "string" },
    "sourceYear": { "type": "integer" },
    "sourceMonth": { "type": "integer" },
    "exportedAt": { "type": "string", "format": "date-time" },
    "caseStudies": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["title", "scenarioText"],
        "properties": {
          "caseStudyRef": { "type": "string" },
          "title": { "type": "string" },
          "scenarioText": { "type": "string", "minLength": 20 }
        }
      }
    },
    "questions": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["questionText", "options", "correctAnswer", "curriculum"],
        "properties": {
          "externalId": { "type": "string" },
          "questionType": {
            "type": "string",
            "enum": ["MCQ", "CASE_STUDY"],
            "default": "MCQ"
          },
          "difficulty": {
            "type": "string",
            "enum": ["EASY", "MEDIUM", "HARD"],
            "default": "MEDIUM"
          },
          "curriculum": {
            "type": "object",
            "required": ["subjectCode"],
            "properties": {
              "subjectCode": { "type": "string" },
              "chapterCode": { "type": "string" },
              "unitCode": { "type": "string" },
              "topicCode": { "type": "string" },
              "nodeCode": { "type": "string" },
              "curriculumNodeId": { "type": "string" },
              "_subjectTitle": { "type": "string" },
              "_chapterTitle": { "type": "string" },
              "_unitTitle": { "type": "string" },
              "_topicTitle": { "type": "string" }
            }
          },
          "questionText": { "type": "string", "minLength": 10 },
          "options": {
            "type": "array",
            "minItems": 2,
            "maxItems": 6,
            "items": {
              "type": "object",
              "required": ["letter", "text"],
              "properties": {
                "letter": { "type": "string", "pattern": "^[A-F]$" },
                "text": { "type": "string", "minLength": 1 }
              }
            }
          },
          "correctAnswer": { "type": "string", "pattern": "^[A-F]$" },
          "explanation": { "type": "string" },
          "caseStudyRef": { "type": "string" },
          "caseStudy": {
            "type": "object",
            "required": ["title", "scenarioText"],
            "properties": {
              "caseStudyRef": { "type": "string" },
              "title": { "type": "string" },
              "scenarioText": { "type": "string", "minLength": 20 }
            }
          },
          "source": {
            "type": "object",
            "properties": {
              "sourceType": { "type": "string" },
              "sourceTitle": { "type": "string" },
              "sourceYear": { "type": "integer" },
              "sourceMonth": { "type": "integer" },
              "sourceAttempt": { "type": "string" },
              "applicability": {
                "type": "array",
                "items": { "type": "string" }
              },
              "paperNumber": { "type": "string" },
              "pageNumber": { "type": "integer" },
              "questionNumber": { "type": "string" },
              "sourceReference": { "type": "string" },
              "externalId": { "type": "string" }
            }
          }
        }
      }
    }
  }
}
```

---

## 4. Comprehensive Field Reference Table

### Envelope Level (`Root`)

| Field | Type | Requirement | Description |
| :--- | :--- | :--- | :--- |
| `schemaVersion` | `string` | **REQUIRED** | Must be `"2.0"` (canonical) or `"1.0"` (legacy). |
| `academicLevelCode` | `string` | **REQUIRED** | `"FOUNDATION"`, `"INTERMEDIATE"`, or `"FINAL"`. |
| `questions` | `array` | **REQUIRED** | Array of question objects (0 to 500 items). |
| `batchName` | `string` | **OPTIONAL** | Human-readable batch title. |
| `curriculumVersionId` | `string` | **OPTIONAL** | Target curriculum version UUID. |
| `curriculumVersionCode` | `string` | **OPTIONAL** | Target curriculum version canonical code (e.g. `INT-2027`). |
| `sourceType` | `string` | **OPTIONAL** | Default source type applied to questions in batch. |
| `sourceTitle` | `string` | **OPTIONAL** | Default source title applied to questions in batch. |
| `sourceYear` | `integer` | **OPTIONAL** | Default publication year (e.g. `2026`). |
| `sourceMonth` | `integer` | **OPTIONAL** | Default publication month (`5` for May, `11` for Nov). |
| `caseStudies` | `array` | **OPTIONAL** | Shared case studies referenced by `caseStudyRef`. |

### Question Object (`questions[]`)

| Field | Type | Requirement | Description |
| :--- | :--- | :--- | :--- |
| `questionText` | `string` | **REQUIRED** | Complete problem statement (10 to 10,000 characters). |
| `options` | `array` | **REQUIRED** | 2 to 6 options with non-empty letters (`A`-`F`) and texts. |
| `correctAnswer` | `string` | **REQUIRED** | Letter of correct option (`A`, `B`, `C`, etc.). Must match an option letter. |
| `curriculum` | `object` | **REQUIRED** | Hierarchical syllabus coordinates. |
| `curriculum.subjectCode` | `string` | **REQUIRED** | Canonical subject code (e.g. `PAPER_1`, `TAX`). |
| `curriculum.chapterCode` | `string` | **OPTIONAL** | Chapter coordinate code within subject. |
| `curriculum.unitCode` | `string` | **OPTIONAL** | Unit coordinate code within chapter. |
| `curriculum.topicCode` | `string` | **OPTIONAL** | Topic coordinate code within unit/chapter. |
| `curriculum.nodeCode` | `string` | **OPTIONAL** | Direct canonical node key (e.g. `INT_P1_CH1_T1`). |
| `curriculum._*Title` | `string` | **OPTIONAL** | Display title hints (informational only; non-authoritative). |
| `questionType` | `string` | **OPTIONAL** | `"MCQ"` (default) or `"CASE_STUDY"`. |
| `difficulty` | `string` | **OPTIONAL** | `"EASY"`, `"MEDIUM"` (default), or `"HARD"`. |
| `explanation` | `string` | **OPTIONAL** | Step-by-step academic rationale or statutory reference. |
| `externalId` | `string` | **OPTIONAL** | Unique question identifier (e.g. `RTP-MAY26-TAX-001`). |
| `caseStudyRef` | `string` | **CONDITIONAL** | Required for `CASE_STUDY` if referencing batch-level case study. |
| `caseStudy` | `object` | **CONDITIONAL** | Required for `CASE_STUDY` if declared inline. |
| `source` | `object` | **OPTIONAL** | Question-specific origin, attempt, and applicability metadata. |
| `source.sourceAttempt` | `string` | **OPTIONAL** | Originating exam cycle (e.g. `"MAY_2026"`). |
| `source.applicability` | `string[]` | **OPTIONAL** | Applicable exam cycles (e.g. `["MAY_2026", "NOV_2026", "MAY_2027"]`). |

---

## 5. Source Attempt vs Question Applicability

| Dimension | Concept | Example Values | Purpose |
| :--- | :--- | :--- | :--- |
| **`sourceAttempt`** | **Where did the question come from?** | `"MAY_2026"`, `"NOV_2025"`, `"MAY_2024"` | Records historical publication origin (e.g. RTP May 2026, Past Exam Nov 2025). |
| **`applicability`** | **Which exams can this question be used for?** | `["MAY_2026", "NOV_2026", "MAY_2027"]` | Defines syllabus relevance window. If law changes in Nov 2027, the question is excluded from Nov 2027 practice. |

---

## 6. Shared Case Study Architecture

```
Batch Envelope
  ├── caseStudies: [
  │     { caseStudyRef: "CS_TAX_01", title: "Residential Status of Expatriate", scenarioText: "Mr. John..." }
  │   ]
  └── questions: [
        { externalId: "Q_01", questionType: "CASE_STUDY", caseStudyRef: "CS_TAX_01", ... },
        { externalId: "Q_02", questionType: "CASE_STUDY", caseStudyRef: "CS_TAX_01", ... },
        { externalId: "Q_03", questionType: "CASE_STUDY", caseStudyRef: "CS_TAX_01", ... }
      ]
```

---

## 7. Master AI Generation Prompt

Use the following master prompt when asking any LLM (Gemini, Claude, GPT) to extract or generate question import batches from ICAI PDFs, RTPs, MTPs, or study notes:

````markdown
You are an expert Chartered Accountancy (CA) academic data engineer. Your task is to extract/generate practice questions and output ONLY a strictly valid JSON payload conforming to CA Prep Pro Canonical Schema Version 2.0.

### INSTRUCTIONS:
1. Output ONLY valid, parseable JSON. Do not include markdown preamble, postamble, or conversational explanations.
2. The root object MUST contain `schemaVersion: "2.0"`, `academicLevelCode` ("FOUNDATION", "INTERMEDIATE", or "FINAL"), and a `questions` array.
3. Every question MUST have `questionText` (min 10 chars), structured `options` array with distinct letters ("A", "B", "C", "D") and non-empty text, a valid `correctAnswer` matching an option letter, and a `curriculum` object.
4. Set `curriculum.subjectCode` using only approved canonical codes (e.g. "PAPER_1", "TAX", "AUDIT", "LAW", "ADV_ACC").
5. Map questions hierarchically using `chapterCode`, `unitCode`, and `topicCode` where known. If topic is unknown, map at chapter or subject level. DO NOT invent fake topic codes.
6. For Case Study questions, set `questionType: "CASE_STUDY"`. For shared scenarios, declare the scenario once in the root `caseStudies` array with a `caseStudyRef` (e.g. "CS_01") and reference it on child questions using `caseStudyRef: "CS_01"`.
7. Distinguish `sourceAttempt` (originating attempt, e.g. "MAY_2026") from `applicability` (list of applicable attempts, e.g. ["MAY_2026", "NOV_2026", "MAY_2027"]).
8. Provide detailed academic explanations referencing relevant Sections, Standards on Auditing (SAs), or Accounting Standards (AS/Ind AS) where possible.
9. Assign realistic `difficulty` ("EASY", "MEDIUM", "HARD").
10. Ensure each question has a unique, descriptive `externalId` (e.g. "RTP-MAY26-TAX-001").

### OUTPUT FORMAT:
```json
{
  "schemaVersion": "2.0",
  "batchName": "RTP May 2026 — Taxation",
  "academicLevelCode": "INTERMEDIATE",
  "sourceType": "RTP",
  "sourceTitle": "ICAI Revision Test Paper May 2026",
  "sourceYear": 2026,
  "sourceMonth": 5,
  "questions": [ ... ]
}
```
````

---

## 8. Canonical Examples (12 Scenarios)

### Scenario 1: Normal Study Material MCQ
```json
{
  "schemaVersion": "2.0",
  "batchName": "ICAI Study Material Module 1 — Income Tax",
  "academicLevelCode": "INTERMEDIATE",
  "sourceType": "STUDY_MATERIAL",
  "sourceTitle": "ICAI Study Material 2026 Edition",
  "questions": [
    {
      "externalId": "SM-INT-TAX-CH1-001",
      "questionType": "MCQ",
      "difficulty": "EASY",
      "curriculum": {
        "subjectCode": "PAPER_3",
        "chapterCode": "INT_P3_CH1",
        "topicCode": "INT_P3_CH1_T1",
        "_subjectTitle": "Taxation",
        "_chapterTitle": "Basic Concepts of Income Tax",
        "_topicTitle": "Rates of Tax"
      },
      "questionText": "What is the basic exemption limit for an individual resident in India who is 65 years of age under the default tax regime (Section 115BAC)?",
      "options": [
        { "letter": "A", "text": "₹ 2,50,000" },
        { "letter": "B", "text": "₹ 3,00,000" },
        { "letter": "C", "text": "₹ 5,00,000" },
        { "letter": "D", "text": "₹ 7,00,000" }
      ],
      "correctAnswer": "B",
      "explanation": "Under the default new tax regime under Section 115BAC(1A), the basic exemption limit is ₹ 3,00,000 uniformly for all individual assessees irrespective of age.",
      "source": {
        "sourceType": "STUDY_MATERIAL",
        "pageNumber": 14,
        "sourceReference": "Module 1, Chapter 1, Illustration 3"
      }
    }
  ]
}
```

### Scenario 2: RTP MCQ with Originating Attempt
```json
{
  "schemaVersion": "2.0",
  "batchName": "RTP May 2026 — Advanced Accounting",
  "academicLevelCode": "INTERMEDIATE",
  "sourceType": "RTP",
  "questions": [
    {
      "externalId": "RTP-MAY26-ACC-012",
      "questionType": "MCQ",
      "difficulty": "MEDIUM",
      "curriculum": {
        "subjectCode": "PAPER_1",
        "chapterCode": "INT_P1_CH4",
        "nodeCode": "INT_P1_CH4_AS10"
      },
      "questionText": "Under AS 10 (Property, Plant and Equipment), which of the following costs is NOT included in the carrying amount of an item of PPE?",
      "options": [
        { "letter": "A", "text": "Costs of site preparation" },
        { "letter": "B", "text": "Initial delivery and handling costs" },
        { "letter": "C", "text": "Costs of opening a new facility or introducing a new product" },
        { "letter": "D", "text": "Professional fees directly attributable to bringing asset to working condition" }
      ],
      "correctAnswer": "C",
      "explanation": "AS 10 explicitly excludes costs of opening a new facility, costs of introducing a new product or service, and general administrative overheads from the initial cost of PPE.",
      "source": {
        "sourceType": "RTP",
        "sourceTitle": "Revision Test Paper May 2026",
        "sourceAttempt": "MAY_2026",
        "applicability": ["MAY_2026", "NOV_2026", "MAY_2027"]
      }
    }
  ]
}
```

### Scenario 3: MTP MCQ
```json
{
  "schemaVersion": "2.0",
  "batchName": "MTP Series 1 Nov 2026 — Corporate Law",
  "academicLevelCode": "INTERMEDIATE",
  "sourceType": "MTP",
  "questions": [
    {
      "externalId": "MTP-NOV26-LAW-005",
      "questionType": "MCQ",
      "difficulty": "MEDIUM",
      "curriculum": {
        "subjectCode": "PAPER_2",
        "chapterCode": "INT_P2_CH7",
        "_chapterTitle": "Management and Administration"
      },
      "questionText": "What is the statutory quorum for an Annual General Meeting of a public company having 850 members as on the date of meeting?",
      "options": [
        { "letter": "A", "text": "2 members personally present" },
        { "letter": "B", "text": "5 members personally present" },
        { "letter": "C", "text": "15 members personally present" },
        { "letter": "D", "text": "30 members personally present" }
      ],
      "correctAnswer": "B",
      "explanation": "As per Section 103(1)(a)(i) of the Companies Act 2013, if the number of members is not more than 1000, the quorum is 5 members personally present.",
      "source": {
        "sourceType": "MTP",
        "sourceTitle": "Mock Test Paper Series 1 — Nov 2026",
        "sourceYear": 2026,
        "sourceMonth": 11
      }
    }
  ]
}
```

### Scenario 4: Past Year Question (PYQ)
```json
{
  "schemaVersion": "2.0",
  "batchName": "PYQ May 2025 Exam Paper",
  "academicLevelCode": "FINAL",
  "sourceType": "PYQ",
  "questions": [
    {
      "externalId": "PYQ-MAY25-FR-Q1A",
      "questionType": "MCQ",
      "difficulty": "HARD",
      "curriculum": {
        "subjectCode": "FINAL_P1",
        "chapterCode": "FIN_P1_CH3",
        "topicCode": "FIN_P1_CH3_INDAS115"
      },
      "questionText": "Under Ind AS 115 (Revenue from Contracts with Customers), a contract modification is treated as a separate contract if the scope increases due to distinct goods and:",
      "options": [
        { "letter": "A", "text": "The contract price increases by an amount reflecting the standalone selling price." },
        { "letter": "B", "text": "The existing contract is cancelled." },
        { "letter": "C", "text": "The remaining goods are not distinct." },
        { "letter": "D", "text": "The payment terms are extended beyond 12 months." }
      ],
      "correctAnswer": "A",
      "explanation": "Ind AS 115 paragraph 20 stipulates that a contract modification is accounted for as a separate contract if both the scope increases because of distinct promised goods and the price increases by standalone selling prices.",
      "source": {
        "sourceType": "PYQ",
        "sourceTitle": "Final Examination May 2025",
        "sourceYear": 2025,
        "sourceMonth": 5,
        "sourceAttempt": "MAY_2025",
        "questionNumber": "Q1(a)"
      }
    }
  ]
}
```

### Scenario 5: Subject-Only Mapped Question
```json
{
  "schemaVersion": "2.0",
  "batchName": "General Jurisprudence Overview",
  "academicLevelCode": "FOUNDATION",
  "questions": [
    {
      "externalId": "FND-LAW-GEN-001",
      "questionType": "MCQ",
      "difficulty": "EASY",
      "curriculum": {
        "subjectCode": "FND_PAPER_2",
        "_subjectTitle": "Business Laws"
      },
      "questionText": "Which of the following is an essential element of a valid contract under Section 10 of the Indian Contract Act, 1872?",
      "options": [
        { "letter": "A", "text": "Free consent of parties competent to contract" },
        { "letter": "B", "text": "Registration in all cases" },
        { "letter": "C", "text": "Attestation by two witnesses in all cases" },
        { "letter": "D", "text": "Payment in foreign currency" }
      ],
      "correctAnswer": "A",
      "explanation": "Section 10 requires agreement made by free consent of parties competent to contract, for lawful consideration and with a lawful object."
    }
  ]
}
```

### Scenario 6: Subject + Chapter Mapped Question
```json
{
  "schemaVersion": "2.0",
  "batchName": "Intermediate Costing Chapter 3",
  "academicLevelCode": "INTERMEDIATE",
  "questions": [
    {
      "externalId": "INT-COST-CH3-004",
      "questionType": "MCQ",
      "difficulty": "MEDIUM",
      "curriculum": {
        "subjectCode": "PAPER_4",
        "chapterCode": "INT_P4_CH3",
        "_chapterTitle": "Overheads: Absorption Costing Method"
      },
      "questionText": "When actual overheads incurred are less than the absorbed overheads, the difference is termed as:",
      "options": [
        { "letter": "A", "text": "Under-absorption of overheads" },
        { "letter": "B", "text": "Over-absorption of overheads" },
        { "letter": "C", "text": "Abnormal overhead loss" },
        { "letter": "D", "text": "Standard overhead variance" }
      ],
      "correctAnswer": "B",
      "explanation": "Over-absorption arises when the overhead absorbed in production exceeds actual overhead incurred during the period."
    }
  ]
}
```

### Scenario 7: Subject + Chapter + Unit Mapped Question
```json
{
  "schemaVersion": "2.0",
  "batchName": "Corporate Law Securities Regulation",
  "academicLevelCode": "INTERMEDIATE",
  "questions": [
    {
      "externalId": "INT-LAW-CH3-U2-001",
      "questionType": "MCQ",
      "difficulty": "HARD",
      "curriculum": {
        "subjectCode": "PAPER_2",
        "chapterCode": "INT_P2_CH3",
        "unitCode": "INT_P2_CH3_U2",
        "_chapterTitle": "Prospectus and Allotment of Securities",
        "_unitTitle": "Private Placement"
      },
      "questionText": "What is the maximum number of persons to whom an offer of private placement can be made in a financial year under Section 42 (excluding QIBs and employees)?",
      "options": [
        { "letter": "A", "text": "50 persons" },
        { "letter": "B", "text": "100 persons" },
        { "letter": "C", "text": "200 persons" },
        { "letter": "D", "text": "500 persons" }
      ],
      "correctAnswer": "C",
      "explanation": "Section 42 read with Rule 14 of PAS Rules restricts private placement offers to not more than 200 persons in the aggregate in a financial year."
    }
  ]
}
```

### Scenario 8: Subject + Chapter + Unit + Topic Mapped Question
```json
{
  "schemaVersion": "2.0",
  "batchName": "Taxation PGBP Deep Dive",
  "academicLevelCode": "INTERMEDIATE",
  "questions": [
    {
      "externalId": "INT-TAX-CH4-U3-T1",
      "questionType": "MCQ",
      "difficulty": "HARD",
      "curriculum": {
        "subjectCode": "PAPER_3",
        "chapterCode": "INT_P3_CH4",
        "unitCode": "INT_P3_CH4_U3",
        "topicCode": "INT_P3_CH4_U3_T1",
        "nodeCode": "INT_P3_CH4_U3_T1",
        "_chapterTitle": "Heads of Income",
        "_unitTitle": "Profits and Gains of Business or Profession",
        "_topicTitle": "Depreciation under Section 32"
      },
      "questionText": "Additional depreciation under Section 32(1)(iia) on new plant and machinery acquired and installed for power generation is allowable at the rate of:",
      "options": [
        { "letter": "A", "text": "10%" },
        { "letter": "B", "text": "15%" },
        { "letter": "C", "text": "20%" },
        { "letter": "D", "text": "25%" }
      ],
      "correctAnswer": "C",
      "explanation": "Section 32(1)(iia) provides additional depreciation of 20% on actual cost of eligible new plant and machinery."
    }
  ]
}
```

### Scenario 9: Question Without Optional Explanation
```json
{
  "schemaVersion": "2.0",
  "batchName": "Rapid Practice Quiz",
  "academicLevelCode": "FOUNDATION",
  "questions": [
    {
      "externalId": "FND-ACC-QUIZ-010",
      "questionType": "MCQ",
      "difficulty": "EASY",
      "curriculum": {
        "subjectCode": "FND_PAPER_1",
        "chapterCode": "FND_P1_CH2"
      },
      "questionText": "Which accounting principle states that revenue is recognized when realized and expenses are recognized when incurred, regardless of cash receipt or payment?",
      "options": [
        { "letter": "A", "text": "Cash Basis" },
        { "letter": "B", "text": "Accrual Basis" },
        { "letter": "C", "text": "Prudence Principle" },
        { "letter": "D", "text": "Materiality Principle" }
      ],
      "correctAnswer": "B"
    }
  ]
}
```

### Scenario 10: Case Study with Single Child Question
```json
{
  "schemaVersion": "2.0",
  "batchName": "Standalone Case Study Scenario",
  "academicLevelCode": "FINAL",
  "questions": [
    {
      "externalId": "FIN-AUD-CS-001",
      "questionType": "CASE_STUDY",
      "difficulty": "HARD",
      "curriculum": {
        "subjectCode": "FINAL_P3",
        "chapterCode": "FIN_P3_CH5",
        "_chapterTitle": "Specialised Areas of Audit"
      },
      "caseStudy": {
        "title": "Audit of NBFC Prudential Norms",
        "scenarioText": "M/s Alpha Finance Ltd is a Systemically Important Non-Deposit taking NBFC registered with RBI. During the statutory audit for FY 2025-26, the audit team observes that standard assets have been classified without provisioning for ECL model under Ind AS 109."
      },
      "questionText": "As the engagement partner, what is your primary reporting responsibility regarding the non-provisioning under RBI master directions?",
      "options": [
        { "letter": "A", "text": "Issue an unmodified report with an Emphasis of Matter paragraph." },
        { "letter": "B", "text": "Issue a qualified or adverse opinion depending on materiality and pervasiveness." },
        { "letter": "C", "text": "Resign from the audit engagement immediately without reporting." },
        { "letter": "D", "text": "Report only in internal management letter without modifying the auditor's report." }
      ],
      "correctAnswer": "B",
      "explanation": "Under SA 705 (Modifications to the Opinion in the Independent Auditor's Report), material misstatement in compliance with applicable financial reporting frameworks and regulatory master directions requires a qualified or adverse opinion."
    }
  ]
}
```

### Scenario 11: Case Study with Multiple Child Questions (Shared Scenario)
```json
{
  "schemaVersion": "2.0",
  "batchName": "Comprehensive Integrated Case Study — Direct Taxation",
  "academicLevelCode": "INTERMEDIATE",
  "caseStudies": [
    {
      "caseStudyRef": "CS_INT_TAX_CASE01",
      "title": "Tax Liability of Rajesh Kumar (Resident Individual)",
      "scenarioText": "Mr. Rajesh Kumar, aged 42 years, is a resident individual engaged in manufacturing garments. For AY 2026-27, his turnover was ₹ 1.80 Crores. He earned gross profit of ₹ 22 Lakhs and paid ₹ 1.50 Lakhs as life insurance premium for his spouse. He wishes to compare his tax liability under the default tax regime (Section 115BAC) and normal provisions."
    }
  ],
  "questions": [
    {
      "externalId": "INT-TAX-CS01-Q1",
      "questionType": "CASE_STUDY",
      "caseStudyRef": "CS_INT_TAX_CASE01",
      "difficulty": "MEDIUM",
      "curriculum": {
        "subjectCode": "PAPER_3",
        "chapterCode": "INT_P3_CH4"
      },
      "questionText": "If Mr. Rajesh opts for presumptive taxation under Section 44AD and receives 100% of receipts via account payee bank drafts, what is his presumptive business income?",
      "options": [
        { "letter": "A", "text": "₹ 10.80 Lakhs (6%)" },
        { "letter": "B", "text": "₹ 14.40 Lakhs (8%)" },
        { "letter": "C", "text": "₹ 22.00 Lakhs (Actual GP)" },
        { "letter": "D", "text": "₹ 9.00 Lakhs (5%)" }
      ],
      "correctAnswer": "A",
      "explanation": "Under Section 44AD(1), the presumptive income is computed at 6% of total turnover when the turnover is received through account payee bank draft or electronic clearing systems."
    },
    {
      "externalId": "INT-TAX-CS01-Q2",
      "questionType": "CASE_STUDY",
      "caseStudyRef": "CS_INT_TAX_CASE01",
      "difficulty": "EASY",
      "curriculum": {
        "subjectCode": "PAPER_3",
        "chapterCode": "INT_P3_CH8"
      },
      "questionText": "Can Mr. Rajesh claim deduction of ₹ 1.50 Lakhs under Section 80C if he pays tax under the default regime (Section 115BAC)?",
      "options": [
        { "letter": "A", "text": "Yes, Section 80C deduction is allowable up to ₹ 1.5 Lakhs under all regimes." },
        { "letter": "B", "text": "No, Chapter VI-A deductions (except Section 80CCD(2) and 80JJAA) are not allowable under Section 115BAC." },
        { "letter": "C", "text": "Yes, subject to a 50% limit." },
        { "letter": "D", "text": "Allowable only if approved by the Assessing Officer." }
      ],
      "correctAnswer": "B",
      "explanation": "Section 115BAC(2) disallows deductions under Chapter VI-A (such as Section 80C) other than Section 80CCD(2), Section 80CCH(2), and Section 80JJAA."
    }
  ]
}
```

### Scenario 12: Question Applicable to Multiple Exam Attempts
```json
{
  "schemaVersion": "2.0",
  "batchName": "Corporate Law Long-Cycle Question",
  "academicLevelCode": "INTERMEDIATE",
  "questions": [
    {
      "externalId": "INT-LAW-PERM-008",
      "questionType": "MCQ",
      "difficulty": "MEDIUM",
      "curriculum": {
        "subjectCode": "PAPER_2",
        "chapterCode": "INT_P2_CH1"
      },
      "questionText": "Under Section 2(71) of the Companies Act 2013, a private company which is a subsidiary of a public company shall be deemed to be:",
      "options": [
        { "letter": "A", "text": "A private company for all statutory purposes" },
        { "letter": "B", "text": "A public company for the purposes of this Act" },
        { "letter": "C", "text": "A joint venture enterprise" },
        { "letter": "D", "text": "A statutory corporation" }
      ],
      "correctAnswer": "B",
      "explanation": "The proviso to Section 2(71) states that a company which is a subsidiary of a company, not being a private company, shall be deemed to be a public company for the purposes of this Act even where such subsidiary company continues to be a private company in its articles.",
      "source": {
        "sourceType": "STUDY_MATERIAL",
        "sourceTitle": "Companies Act 2013 Core Provisions",
        "sourceAttempt": "MAY_2024",
        "applicability": ["MAY_2026", "NOV_2026", "MAY_2027", "NOV_2027", "MAY_2028"]
      }
    }
  ]
}
```

---

## 9. Common Mistakes & Anti-Patterns

1. **Anti-Pattern: Hardcoded Subject Names for Identity**:
   - ❌ `"subject": "Taxation"`
   - ✅ `"curriculum": { "subjectCode": "PAPER_3", "_subjectTitle": "Taxation" }`
2. **Anti-Pattern: Truncated Problem Statements**:
   - ❌ `"questionText": "What is Section 135?"`
   - ✅ Ensure complete, self-contained questions with at least 10 characters and proper punctuation.
3. **Anti-Pattern: Mismatched Correct Answer Letters**:
   - ❌ Options: `A`, `B`, `C`, `D` with `correctAnswer: "E"` or `correctAnswer: "Option A"`.
   - ✅ `correctAnswer: "A"` (single uppercase letter matching one option).
4. **Anti-Pattern: Orphaned Case Study Questions**:
   - ❌ `questionType: "CASE_STUDY"` without declaring `caseStudy` object or matching `caseStudyRef`.
   - ✅ Declare `caseStudies` in the envelope and assign `caseStudyRef`.
5. **Anti-Pattern: Conflating Publication Origin and Applicability**:
   - ❌ Setting only `"year": 2026` for a question published in 2024 that remains valid in 2026.
   - ✅ Set `sourceAttempt: "MAY_2024"` and `applicability: ["MAY_2026", "NOV_2026", "MAY_2027"]`.

---

## 10. Import / Export Round-Trip Fidelity Guarantee

CA Prep Pro guarantees full round-trip fidelity:

$$\text{Live Question Bank} \xrightarrow{\text{Export}} \text{Canonical JSON (v2.0)} \xrightarrow{\text{Import}} \text{Staging} \xrightarrow{\text{Publish}} \text{Live Question Bank}$$

Exported payloads preserve:
- Un-truncated question text and explanation
- Exact option letters and text
- Full curriculum coordinates (`subjectCode`, `chapterCode`, `unitCode`, `topicCode`, `nodeCode`)
- Deduplicated shared case studies
- Source metadata and attempt applicability
- Zero loss of educational data.
