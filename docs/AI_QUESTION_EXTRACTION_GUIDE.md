# AI Question Extraction Guide for CA Prep Pro
**Authoritative Protocol for Extracting Questions from ICAI Study Material, RTP, MTP & PYQ PDFs**

---

## 1. Objective

This guide enables anyone to extract multiple-choice questions (MCQs) and integrated case-study questions from official ICAI study materials or PDFs using any state-of-the-art AI agent (ChatGPT, Claude 3.5 Sonnet, Gemini 1.5 Pro).

When the AI agent follows this protocol and outputs JSON matching **Canonical Schema v2.0**, the resulting JSON file can be uploaded directly into the **CA Prep Pro Admin Console** (`/admin/questions/imports`) and will validate with **0 errors**.

---

## 2. Field Requirements (Compulsory vs. Optional)

Every question file must follow this exact contract:

### Envelope Level (`CanonicalBatchJson`)

| Field | Requirement | Type | Permitted Values / Description |
| :--- | :--- | :--- | :--- |
| `schemaVersion` | **COMPULSORY** | `string` | Must be `"2.0"`. |
| `academicLevelCode` | **COMPULSORY** | `string` | `"FOUNDATION"` \| `"INTERMEDIATE"` \| `"FINAL"` |
| `questions` | **COMPULSORY** | `array` | Array of 1 to 500 question objects. |
| `batchName` | *Optional* | `string` | e.g. `"CA Intermediate Law RTP May 2026"` |
| `sourceType` | *Optional* | `string` | `"STUDY_MATERIAL"` \| `"RTP"` \| `"MTP"` \| `"PYQ"` \| `"OTHER_OFFICIAL"` \| `"AI_GENERATED"` |
| `sourceTitle` | *Optional* | `string` | e.g. `"ICAI Study Material September 2025 Edition"` |
| `sourceYear` | *Optional* | `integer` | 4-digit publication year (e.g. `2026`). |
| `sourceMonth` | *Optional* | `integer` | Month number (e.g. `5` for May, `11` for November). |
| `caseStudies` | *Optional* | `array` | Array of shared scenario objects: `[{ "caseStudyRef": "CS_01", "title": "...", "scenarioText": "..." }]` |

---

### Question Level (`CanonicalQuestionJson`)

| Field | Requirement | Type | Permitted Values / Description |
| :--- | :--- | :--- | :--- |
| `questionText` | **COMPULSORY** | `string` | Full, un-truncated question statement. Minimum 10 characters. Must end with punctuation (`?`, `.`, `:`). |
| `options` | **COMPULSORY** | `array` | Array of 2 to 6 option objects: `[{ "letter": "A", "text": "..." }, { "letter": "B", "text": "..." }]`. |
| `options[i].letter` | **COMPULSORY** | `string` | Unique uppercase letter (`"A"`, `"B"`, `"C"`, `"D"`, `"E"`, `"F"`). |
| `options[i].text` | **COMPULSORY** | `string` | Option statement. Cannot be empty. |
| `correctAnswer` | **COMPULSORY** | `string` | Exactly one uppercase letter matching one of the options (e.g. `"A"` or `"B"`). |
| `curriculum` | **COMPULSORY** | `object` | Curriculum coordinates object (must have `subjectCode`). |
| `curriculum.subjectCode` | **COMPULSORY** | `string` | Target subject code: `"PAPER_1"`, `"PAPER_2"`, `"PAPER_3"`, `"PAPER_4"`, `"PAPER_5"`, `"PAPER_6"`. |
| `curriculum.chapterCode` | *Optional* | `string` | Canonical chapter code (e.g. `"INT_P2_MOD1_CH2"`). |
| `curriculum.unitCode` | *Optional* | `string` | Canonical unit code if chapter is divided into units. |
| `curriculum.topicCode` | *Optional* | `string` | Canonical topic code if known. |
| `curriculum.nodeCode` | *Optional* | `string` | Direct syllabus node code if known. |
| `curriculum._subjectTitle` | *Optional* | `string` | Subject display name for reference (e.g. `"Corporate and Other Laws"`). |
| `curriculum._chapterTitle` | *Optional* | `string` | Chapter display name for reference (e.g. `"Share Capital and Debentures"`). |
| `questionType` | *Optional* | `string` | `"MCQ"` (default for standalone) or `"CASE_STUDY"`. |
| `difficulty` | *Optional* | `string` | `"EASY"` \| `"MEDIUM"` (default) \| `"HARD"`. |
| `explanation` | *Optional (Recommended)* | `string` | Statutory section, standard reference, or detailed working note explaining why the answer is correct. |
| `externalId` | *Optional (Recommended)* | `string` | Unique identifier within batch (e.g. `"LAW-CH1-001"`). |
| `source` | *Optional* | `object` | Source origin (`sourceAttempt`, `applicability: ["MAY_2026", "NOV_2026"]`, `pageNumber`). |
| `caseStudyRef` | *Optional* | `string` | References a scenario declared in `caseStudies` array (e.g. `"CS_01"`). |
| `caseStudy` | *Optional* | `object` | Inline scenario `{ "title": "...", "scenarioText": "..." }` if not shared at batch level. |

---

## 3. CA Intermediate Active Subject Codes

When extracting questions for **CA Intermediate**, use these exact `subjectCode` values:

| Subject Code | Official ICAI Subject Name |
| :--- | :--- |
| `PAPER_1` | **Advanced Accounting** |
| `PAPER_2` | **Corporate and Other Laws** |
| `PAPER_3` | **Taxation** (Direct Tax & Indirect Tax / GST) |
| `PAPER_4` | **Cost and Management Accounting** |
| `PAPER_5` | **Auditing and Ethics** |
| `PAPER_6` | **Financial Management and Strategic Management** |

---

## 4. Master AI Prompt to Copy-Paste to ChatGPT / Claude / Gemini

Copy and paste the following prompt to your AI model:

```text
You are an expert Chartered Accountant and academic content digitization specialist for CA Prep Pro.
I have attached an official ICAI document (Study Material / RTP / MTP / PYQ PDF or text).

Your task is to extract all Multiple Choice Questions (MCQs) and Case Studies from the document into a strict, validated JSON file following the CA Prep Pro Canonical Schema v2.0.

RULES FOR EXTRACTION:
1. OUTPUT ONLY PURE JSON: Do not include markdown preamble, chit-chat, or conversational text. Output only a valid, parsable JSON object.
2. PRESERVE ACADEMIC RIGOR: Retain statutory section numbers, legal clauses, tax rates, accounting standards (AS/Ind AS), and numerical values with 100% fidelity. Do NOT summarize or truncate questions.
3. PUNCTUATION & LENGTH: Every questionText must be complete (at least 10 characters) and end with standard punctuation (?, ., :).
4. STRUCTURED OPTIONS: Every question must contain between 2 and 4 options (up to 6 if present). Each option MUST have an uppercase "letter" ("A", "B", "C", "D") and non-empty "text".
5. CORRECT ANSWER MATCH: The "correctAnswer" must be exactly one uppercase letter that matches one of the option letters.
6. EXPLANATIONS: Provide an authoritative explanation referencing the applicable Section, Rule, Accounting Standard, or Case Law wherever available.
7. CASE STUDIES:
   - For integrated case scenarios having multiple sub-questions, declare the scenario once in the "caseStudies" array with a unique "caseStudyRef" (e.g. "CS_01").
   - Link each child question to the scenario by setting "questionType": "CASE_STUDY" and "caseStudyRef": "CS_01".
8. CURRICULUM COORDINATES: Assign the correct "subjectCode" (choose from: PAPER_1, PAPER_2, PAPER_3, PAPER_4, PAPER_5, PAPER_6). Include "_chapterTitle" if the chapter is clear from the document.

TARGET JSON STRUCTURE:
{
  "schemaVersion": "2.0",
  "batchName": "<Descriptive Batch Title, e.g. ICAI Intermediate Law RTP May 2026>",
  "academicLevelCode": "INTERMEDIATE",
  "sourceType": "RTP",
  "sourceYear": 2026,
  "sourceMonth": 5,
  "caseStudies": [
    {
      "caseStudyRef": "CS_01",
      "title": "<Case Study Title>",
      "scenarioText": "<Full un-truncated scenario text, minimum 20 characters>"
    }
  ],
  "questions": [
    {
      "externalId": "EXT-001",
      "questionType": "MCQ",
      "difficulty": "MEDIUM",
      "curriculum": {
        "subjectCode": "PAPER_2",
        "_subjectTitle": "Corporate and Other Laws",
        "_chapterTitle": "Incorporation of Company"
      },
      "questionText": "<Full question statement>?",
      "options": [
        { "letter": "A", "text": "<Option A text>" },
        { "letter": "B", "text": "<Option B text>" },
        { "letter": "C", "text": "<Option C text>" },
        { "letter": "D", "text": "<Option D text>" }
      ],
      "correctAnswer": "A",
      "explanation": "<Academic explanation referencing ICAI provisions>",
      "source": {
        "sourceType": "RTP",
        "sourceAttempt": "MAY_2026",
        "applicability": ["MAY_2026", "NOV_2026", "MAY_2027"]
      }
    }
  ]
}

Now, extract all questions from the provided document into this exact JSON format.
```

---

## 5. How to Import the Extracted JSON

1. Save the AI-generated output as a `.json` file (e.g. `ca-inter-law-ch1.json`).
2. Navigate to **CA Prep Pro Admin Console** $\rightarrow$ **Question Bank** $\rightarrow$ **Import & Review** (`/admin/questions/imports`).
3. Click **"Upload Question Batch"**.
4. Select the target **Academic Level** (e.g. `CA Intermediate`) and active **Curriculum Version**.
5. Choose your `.json` file and click **"Upload & Validate Batch"**.
6. The system automatically validates schema constraints, checks duplicate similarity, and opens the **One-by-One Review Workspace** where you can review, approve, and publish the questions to the live question pool!
