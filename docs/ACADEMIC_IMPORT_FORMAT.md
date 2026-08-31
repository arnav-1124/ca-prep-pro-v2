# CA Prep Pro — Academic Syllabus Import Format Spec

This document defines the structured JSON interchange contract for importing versioned ICAI Chartered Accountancy (CA) curriculum syllabi into CA Prep Pro.

---

## 1. Document Schema (v1.0)

Curriculum structures are authored as structured, deeply nested JSON files containing version declarations and recursive node trees.

```json
{
  "levelCode": "INTERMEDIATE",
  "schemaVersion": "1.0",
  "curriculumVersion": {
    "name": "May 2027 Syllabus Scheme",
    "applicableFrom": "2027-05-01T00:00:00.000Z",
    "applicableTo": null
  },
  "subjects": [
    {
      "code": "PAPER_4",
      "name": "Taxation",
      "sortOrder": 4,
      "nodes": [
        {
          "type": "MODULE",
          "name": "Module 1: Income Tax Law",
          "code": "TAX_M1",
          "sortOrder": 1,
          "children": [
            {
              "type": "CHAPTER",
              "name": "Basic Concepts",
              "code": "TAX_M1_CH1",
              "sortOrder": 1,
              "children": [
                {
                  "type": "TOPIC",
                  "name": "Concept of Income and Tax Rates",
                  "code": "TAX_M1_CH1_T1",
                  "sortOrder": 1
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

---

## 2. Field Specifications & Validation Rules

### Root Level
- `levelCode` (string, REQUIRED): Must be one of `FOUNDATION`, `INTERMEDIATE`, or `FINAL`. Matches `academic_levels.code`.
- `schemaVersion` (string, REQUIRED): Semantic representation of the JSON contract. Must be `"1.0"`.
- `curriculumVersion` (object, REQUIRED): Metadata for version identity.
  - `name` (string, REQUIRED): Unique name representing the scheme (e.g. `"May 2027 Syllabus Scheme"`).
  - `applicableFrom` (string, REQUIRED): ISO 8601 timestamp when this syllabus becomes active.
  - `applicableTo` (string, OPTIONAL): ISO 8601 timestamp when this syllabus becomes superseded.

### Subjects
- `code` (string, REQUIRED): Unique paper code within the level (e.g. `"PAPER_4"`).
- `name` (string, REQUIRED): User-facing paper name (e.g. `"Taxation"`).
- `sortOrder` (integer, REQUIRED): Non-negative integer for ordering papers in navigation and UI.

### Nodes (Recursive Tree)
- `type` (string, REQUIRED): Must be one of `MODULE`, `SECTION`, `CHAPTER`, `UNIT`, or `TOPIC`.
- `name` (string, REQUIRED): User-facing label of the syllabus node.
- `code` (string, REQUIRED): **Globally unique identifier** for the node (e.g. `TAX_M1_CH1_T1`). Used to achieve idempotent upserts.
- `sortOrder` (integer, REQUIRED): Non-negative integer for sibling node display ordering.
- `children` (array, OPTIONAL): List of nested child node objects.

---

## 3. Data Integrity & Safety Model

Due to connectionless HTTP transport constraints of the serverless driver (`drizzle-orm/neon-http`), interactive multiple-request database transaction blocks (`db.transaction`) are not supported. To prevent partial writes or database corruption, CA Prep Pro relies on a two-layer safety model:

### 1. Pre-Write Validation (Upfront Integrity)
Before initiating any database writes, the import service parses the JSON payload and validates all constraints in-memory:
- Verifies that the resolved `levelCode` exists in the database.
- Checks that all subject nodes contain required properties and correct ordering formats.
- Recursively inspects the entire node tree structure to ensure all node types are valid and no duplicate `code` strings exist in the payload.
If any validation rule fails, the service throws an error immediately before any database inserts/updates occur, keeping the existing database state clean.

### 2. Idempotent Upserts (In-Place Modifications)
Re-running the import for an existing `curriculumVersion.name` will **NOT** create duplicate nodes or delete and recreate records:
- Nodes matching an existing `code` in the database will have their `name`, `type`, `sortOrder`, and parent assignments updated in-place.
- This preserves existing database foreign key relationships (such as students' practice sessions or question versions referencing `curriculumNodeId`).
