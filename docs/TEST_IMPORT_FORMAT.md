# Custom Test Import Format Contract (Schema Version 1.0)

This document defines the strict versioned JSON schema required for importing admin-authored assessments (Tests) into CA Prep Pro.

Assessment sets are authored externally and ingested server-side.

---

## 1. Import Types & Configurations

A test can be configured in one of three curriculum scopes:

### A. Chapter-Specific Test
- **Scope**: Questions belong exclusively to one subject and one curriculum node (e.g. Chapter 1 of Taxation).
- **Format Requirements**: `subjectCode` and `nodeCode` must both be defined.
- **Validation**: Every question must belong to the specified curriculum node or any of its descendant nodes.

### B. Subject-Wide / Mixed-Chapter Test
- **Scope**: Questions belong to one subject, but span multiple chapters (e.g. general Taxation practice).
- **Format Requirements**: `subjectCode` must be defined; `nodeCode` must be set to `null` or omitted.
- **Validation**: Every question must belong to the specified subject.

### C. Level-Wide / Mixed-Subject Test
- **Scope**: Questions span multiple subjects within the same academic level (e.g. CA Intermediate Comprehensive mock).
- **Format Requirements**: `subjectCode` and `nodeCode` must both be set to `null` or omitted.
- **Validation**: Every question must belong to the academic level compatible with the test version.

---

## 2. Complete Schema Example

```json
{
  "schemaVersion": "1.0",
  "levelCode": "INTERMEDIATE",
  "test": {
    "code": "TAX-INCOME-001",
    "title": "Income Tax - Basic Concepts & Deductions",
    "description": "Curated chapter assessment covering gross total income calculations and deductions.",
    "durationMinutes": 30,
    "totalMarks": 20,
    "curriculum": {
      "subjectCode": "PAPER_3",
      "nodeCode": "TAX_M1_CH1"
    },
    "questions": [
      {
        "order": 1,
        "questionId": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d"
      },
      {
        "order": 2,
        "caseStudyId": "f1e2d3c4-b5a6-7a8b-9c0d-1e2f3a4b5c6d",
        "questions": [
          {
            "order": 1,
            "questionId": "b2c3d4e5-f6a7-7a8b-9c0d-1e2f3a4b5c6d"
          },
          {
            "order": 2,
            "questionId": "c3d4e5f6-a7b8-7a8b-9c0d-1e2f3a4b5c6d"
          }
        ]
      }
    ]
  }
}
```

---

## 3. Field Definitions & Types

| JSON Path | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `schemaVersion` | `string` | **Yes** | Must be exactly `"1.0"`. |
| `levelCode` | `string` | **Yes** | Target level matching: `"FOUNDATION"`, `"INTERMEDIATE"`, or `"FINAL"`. |
| `test.code` | `string` | **Yes** | Stable unique alphanumeric slug representing the test (used for idempotency). |
| `test.title` | `string` | **Yes** | Student-facing title of the test. |
| `test.description` | `string` | No | Markdown-supported description of topics covered. |
| `test.durationMinutes`| `number` | **Yes** | Duration budget. Must be $> 0$. |
| `test.totalMarks` | `number` | **Yes** | Total marks assigned to the test. Must be $> 0$. |
| `test.curriculum` | `object` | **Yes** | Target scope constraints. |
| `test.curriculum.subjectCode` | `string` | No | Code of the target subject (nullable). |
| `test.curriculum.nodeCode` | `string` | No | Code of the target curriculum chapter/node (nullable). |
| `test.questions` | `array` | **Yes** | Ordered array of question items. |

### Question Item Schema (MCQ or Case Study)
Each item in the `test.questions` array must contain exactly one of:

#### A. Standalone Question Item
- `order`: `number` (1-indexed sequence order)
- `questionId`: `string` (Matches unique `id` of an existing question record)

#### B. Case Study Item
- `order`: `number` (1-indexed sequence order)
- `caseStudyId`: `string` (Matches unique `id` of an existing case study record)
- `questions`: `array` containing case-based questions:
  - `order`: `number` (1-indexed order within case study)
  - `questionId`: `string` (Matches unique `id` of an existing question record)

---

## 4. Ingestion Validation Rules

The import engine performs full validation check sweeps in memory before executing database writes. Any failure rolls back the entire payload operation:

1.  **Format Verification**: Verifies `schemaVersion` is compatible and all required attributes are present.
2.  **Level Integrity**: Checks `levelCode` exists in the database.
3.  **Scope Verification**:
    - If `subjectCode` is specified, verifies the subject exists and belongs to the level.
    - If `nodeCode` is specified, verifies the node exists under the selected subject in the current active curriculum version.
4.  **Reference Verification**:
    - Verifies every `questionId` and `caseStudyId` is mapped to an active question/case study in the database.
    - Verifies all questions belong to the same level.
    - If `subjectCode` is set, verifies every question belongs to that subject.
    - If `nodeCode` is set, verifies every question belongs to that node or any of its recursive sub-nodes.
5.  **Ordering Verification**:
    - Verifies `order` numbers are unique, sequential, and start at 1.
    - Verifies no orphan case study questions are mapped.
6.  **Idempotency & Safety**:
    - Matches on `test.code`. If the test already exists, updates mutable metadata (`title`, `description`, `durationMinutes`, `totalMarks`).
    - Updates `testQuestions` links while preserving student attempt history (`test_attempts`).
    - Historic student results remain intact.

---

## 5. System Distinction Summary

- **Academic Ingestion** (`docs/ACADEMIC_IMPORT_FORMAT.md`): Initializes/updates the recursive curriculum trees and syllabus paths.
- **Question Ingestion**: Loads question banks, versions, options, and shared case scenario facts.
- **Test Ingestion**: Assembles existing questions into admin-curated assessments. Does not duplicate question text or option entries.
