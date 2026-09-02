# Questions Domain (`src/domains/questions`)

## Purpose
Manages the question bank, option variations, answer keys, explanations, case studies, question version snapshots, and curriculum mappings.

## Boundaries & Constraints
*   **Traceability**: Every question must be traceable to its specific source (e.g. Study Material, RTP, MTP, PYQ, or AI-generated) and its academic hierarchy coordinates (`academic_level_id` → `subject_id` → `curriculum_node_id`).
*   **Question Versioning**: Separate logical question identity (`questions`) from version state (`question_versions`). If a question wording, explanation, or option layout is updated for a new syllabus cycle, historical student attempts remain tied to older version snapshots (`question_version_id`), ensuring 100% grading and analytics immutability for past tests.
*   **Reusability**: Support cases where a single question is used across multiple mock tests, case studies, or student practice sessions without duplicating question records.

---

## Question ↔ Curriculum Relationship Architecture

1. **Resolution Path**:
   `questions` → `curriculum_nodes` (Node) → `curriculum_nodes` (Parent chain up to Root) → `curriculum_versions` (Version) & `subjects` (Paper) & `academic_levels` (Level).
2. **Denormalized Foreign Keys for High-Scale Indexing**:
   - In addition to `curriculum_node_id`, `questions` stores `academic_level_id` and `subject_id`.
   - B-Tree indexes on `questions (academic_level_id, subject_id, curriculum_node_id, difficulty, question_type)` enable single-digit millisecond filtered queries across hundreds of thousands of questions.

---

## Admin Question Bank Explorer (`/admin/questions`)

*   **Authorization**: Strict server-side `requireAdmin()` on page render and server actions.
*   **Scalable Server-Side Pagination**: Uses SQL `COUNT(DISTINCT)` with bounded `LIMIT` and `OFFSET` queries. No unbounded full-table scans.
*   **Multi-Dimensional Filtering**: Filter by Level, Curriculum Version, Subject, Chapter/Topic, Question Type (`MCQ`, `CASE_STUDY`), Difficulty (`EASY`, `MEDIUM`, `HARD`), Status (`ACTIVE`, `INACTIVE`), and Source Type.
*   **Question Inspector**: Provides full question text, option breakdown, correct answer highlight, academic explanation, case study scenario text, visual breadcrumbs, and relational reference usage diagnostics (practice attempts count, test question usages, AI doubt chats).

---

---

## Question Bank Import & Human Review Architecture (`/admin/questions/imports`)

*Implemented in Step 18 as a permanent, non-destructive staging and review workflow.*

### 1. Ingestion Pipeline & Non-Direct Publication
```
JSON Upload (File or Raw Text)
       ↓
Server-Side Structural Validation (schemaVersion, 2-6 options, answer keys)
       ↓
Version-Aware Curriculum Mapping (Canonical Code → UUID → Unique Name)
       ↓
Deterministic Duplicate Detection (Exact normalized hash + Token Jaccard >= 85%)
       ↓
Staging Database (`import_batches` + `imported_questions`)
       ↓
One-By-One Human Review Workspace (`/admin/questions/imports/[batchId]`)
       ↓
Admin Actions (Approve & Next, Reject with Reason, Edit, Quick Map)
       ↓
Atomic Publication → Live Question Bank (`questions`, `question_versions`, `question_options`)
```

### 2. Canonical Curriculum Mapping Precedence
1. **Canonical Code Match** (`INT_P1_CH1_T1`) $\rightarrow$ `MATCHED_CANONICAL` (Highest precedence)
2. **Database UUID Match** $\rightarrow$ `MATCHED_DATABASE_ID`
3. **Unique Title within Version** $\rightarrow$ `MATCHED_EXACT_NAME`
4. **Ambiguous or Missing Match** $\rightarrow$ `AMBIGUOUS_MATCH` or `UNMAPPED` (Blocking: question cannot be approved until manually mapped)

### 3. Review Workspace Standards
* **One-By-One Review**: Detailed inspection of question text, case scenarios, options, correct answers, and academic explanations.
* **Side-by-Side Duplicate Inspector**: Direct comparison against live Question Bank candidates with similarity score pill.
* **Keyboard-Friendly Efficiency**: `A` (Approve & Next), `R` (Reject with reason), `E` (Edit), `ArrowLeft`/`ArrowRight` (Navigate).
* **Auditable Immutability**: All decisions recorded in `import_audit_events`.

### 4. Hardening & Integrity Invariants
* **Optimistic Concurrency Control (OCC)**: Every review action verifies `expectedUpdatedAt` timestamps, rejecting stale concurrent submissions with clear feedback.
* **Pre-Publication Integrity Gate**: At publish time, all approved questions undergo in-memory revalidation against active curriculum nodes and subjects, plus an interim collision scan against live `question_versions`.
* **Idempotent Resumable Publication**: Publications link `publishedQuestionId` directly to staging rows; repeated calls or retries skip already-published questions without creating duplicates.
* **State Machine Invariants**: Unmapped, invalid, or duplicate-collided questions are strictly blocked from approval; published questions are immutable in staging.

---

## Question Bank Management & Canonical Export (`/admin/questions`)

*Implemented in Step 19 as the administrative mutation, versioning, and export layer.*

### 1. In-Place vs New Version Decision Matrix
* **0 Historical Attempts**: If a question has 0 practice attempts and 0 test usages, edits update active `question_versions` in-place.
* **>0 Historical Attempts**: If students have attempted the question, material content modifications automatically generate a new `question_versions` snapshot (`versionNumber = max + 1`), deactivating the old version while keeping it in the database for historical test review integrity.

### 2. Dependency-Guarded Deletion
* Deletion audits `practice_attempts`, `test_questions`, and `ai_conversations`.
* If any dependency exists, deletion is strictly blocked and the admin is guided to deactivate/retire the question.
* If zero dependencies exist, the question, options, versions, and unshared case study records are permanently deleted.

### 3. Canonical Export & Round-Trip Interchange
* The Question Bank Explorer provides an **Export Questions** tool generating canonical `RawImportBatchJson`.
* Preserves canonical node codes (`INT_P1_CH1_T1`), difficulty, options, answer keys, explanations, and case studies.
* Exported JSON files can be directly uploaded back to `/admin/questions/imports` for full round-trip staging, validation, duplicate checking, and publication.

### 4. ICAI Amendment Lifecycle & AI Governance Boundary
* **Legal Changes & Amendments**: If tax rates, corporate laws, or accounting standards change, questions are version-bumped (`v2`) with new explanations and answer keys. Past versions (`v1`) remain intact for students reviewing historical mock tests taken under prior law.
* **Deterministic Decision Authority**: AI is never used for automated deletions, duplicate mergers, or publication barriers. AI assistance is strictly confined to non-destructive advisory tasks (e.g. suggesting curriculum node aliases or flagging ambiguous semantic overlaps for human reviewer judgment).

---

## Question Bank Operational Intelligence & Review Workflow (`/admin/questions/review`)

*Implemented in Step 20 as an explainable, deterministic review queue and quality control cockpit.*

### 1. Deterministic Attention Reason Taxonomy
The operational intelligence engine flags live questions across 11 deterministic conditions:

| Attention Reason | Severity | Trigger Condition |
| :--- | :--- | :--- |
| `INACTIVE_NODE` | `CRITICAL` | Question is mapped to an inactive syllabus node. |
| `OBSOLETE_CURRICULUM` | `HIGH` | Question is associated with an inactive curriculum version. |
| `FEW_OPTIONS` | `HIGH` | MCQ has fewer than 4 options. |
| `POTENTIAL_DUPLICATE` | `HIGH` | Staging or candidate similarity score $\ge 80\%$ with another live question. |
| `NEEDS_CHANGES` | `HIGH` | Human reviewer previously recorded a `NEEDS_CHANGES` decision. |
| `RETIRED_QUESTION` | `MEDIUM` | Question version is inactive/retired. |
| `WEAK_EXPLANATION` | `MEDIUM` | Explanation is null or shorter than 20 characters. |
| `NEVER_REVIEWED` | `LOW` | Question has never had an entry recorded in `question_reviews`. |
| `ZERO_USAGE` | `INFO` | Question has 0 practice attempts and 0 mock test usages. |
| `HEAVY_USAGE` | `INFO` | High-traffic question (>20 attempts or multiple test appearances). |
| `MULTI_VERSIONED` | `INFO` | Question has $> 1$ version snapshots. |

### 2. Review Decision Entity & History Audit Trail
* **Table**: `question_reviews`
* **Fields**: `id`, `question_id`, `question_version_id`, `reviewed_by` (email), `decision` (`REVIEWED`, `ACCEPTED`, `NEEDS_CHANGES`, `DISMISSED`), `notes`, `created_at`.
* **Immutability Guarantee**: Recording review decisions never modifies student practice attempts, mock test answers, or past scorecards.
* **Audit Timeline**: The review drawer presents a chronological timeline of all review decisions, reviewer identity, version snapshots, and reviewer notes.

### 3. Review Workspace Cockpit
* **Operational KPI Cards**: Displays Needing Attention count, Critical/High Priority count, Obsolete Syllabus count, Weak Explanations count, and Unreviewed Questions count.
* **Server-Side Queue Filtering**: Instant filtering by Attention Reason, Severity Rank, Subject, Review Decision Status, Usage State, and Search Query.
* **Interactive Review Drawer**: Inspects full content, version history, usage analytics, attention flags, and provides an operational decision form with in-drawer status toggling and editing.


