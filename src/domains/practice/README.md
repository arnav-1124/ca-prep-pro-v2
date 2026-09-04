# Practice Domain (`src/domains/practice`)

## Purpose
Orchestrates authenticated active learning practice sessions, deterministic question selection, safe question delivery without answer leakage, and student progression tracking across Chartered Accountancy exam levels.

---

## Architectural Principles (Step 22 & Step 23)

```
Student (Clerk Auth)
       ↓
Practice Context (Level, Subject, Optional Topic, Mode, Count)
       ↓
Session Creation (`practice_sessions` with `session_seed` & `curriculum_version_id`)
       ↓
Deterministic Selection Engine (Active Version + Lifecycle Filter + Seed Hash Order)
       ↓
Atomic Question Delivery (`practice_session_questions` with Unique Constraints)
       ↓
Sanitized Student Delivery DTO (Zero Answer Keys, Zero Explanations)
       ↓
Student Answer Selection (Option Letter: 'A' | 'B' | 'C' | 'D'...)
       ↓
Deterministic Grading Engine (`src/domains/practice/services/grading.ts`)
       ↓
Immutable Attempt Record (`practice_attempts` bound to Delivered `question_version_id`)
       ↓
Post-Submission Reveal DTO (Correctness, Correct Letter, Academic Explanation)
       ↓
Session Progress Tracking & Authoritative Summary (`getPracticeSessionSummary`)
```

### 1. Practice Session Architecture
* **Table**: `practice_sessions`
  * `id`: Unique UUID session identifier.
  * `studentProfileId`: Foreign key to `student_profiles.id` (strictly authenticated).
  * `academicLevelId`: CA Level (`FOUNDATION`, `INTERMEDIATE`, `FINAL`).
  * `curriculumVersionId`: Immutable foreign key to `curriculum_versions.id` locking the official syllabus scheme active at session creation time.
  * `subjectId`: Scoped subject reference.
  * `curriculumNodeId`: Optional deep curriculum node (chapter/unit/topic).
  * `status`: Minimal state machine (`ACTIVE`, `COMPLETED`, `ABANDONED`).
  * `practiceMode`: `QUESTION` (standalone MCQ) or `CASE_STUDY` (scenario-linked).
  * `sessionSeed`: Server-generated 32-bit positive integer used for deterministic permutation.
  * `questionCount`: Total requested/capped questions for the session.
  * `startedAt`, `completedAt`, `createdAt`, `updatedAt`.
* **Table**: `practice_session_questions`
  * Tracks each question delivered to a student session before answers are graded.
  * Columns: `id`, `practiceSessionId`, `questionId`, `questionVersionId`, `sequenceNumber`, `deliveredAt`.
  * Persists the exact, immutable `question_version_id` delivered to the student.

### 2. Question Eligibility Rules
To be eligible for delivery, a question must satisfy:
1. **Academic Level**: `questions.academicLevelId` matches the session level.
2. **Curriculum Version**: `questions.curriculumNodeId` belongs to the session's locked `curriculumVersionId`.
3. **Subject & Node Hierarchy**:
   * If a specific node is chosen, the question must map to that node or any of its active descendants (resolved in $O(N)$ via `getDescendantNodeIds`).
   * If inactive curriculum nodes exist, they are strictly rejected during session creation and question resolution.
4. **Question Lifecycle**:
   * Root question must be active.
   * Version snapshot must have `questionVersions.isActive = true`.
   * Retired/inactive questions and unpublished drafts are completely excluded.
   * Superseded versions (e.g. `v1` when `v2` was published for ICAI amendments) are never selected for new delivery.

### 3. Deterministic Selection Engine (`src/domains/practice/services/selector.ts`)
* **Zero `ORDER BY RANDOM()`**: Avoids expensive non-deterministic database random ordering.
* **Deterministic Hash Ordering**:
  ```sql
  ORDER BY md5(concat(questions.id::text, ':', session_seed::text)) ASC, questions.id ASC
  ```
* **Case Study Mode**: Groups questions by scenario using:
  ```sql
  ORDER BY md5(concat(case_studies.id::text, ':', session_seed::text)) ASC, questions.created_at ASC, questions.id ASC
  ```
* **Reproducibility**: For a given session context and server seed, the question sequence is 100% reproducible.
* **Exclusion of Delivered Questions**:
  ```sql
  WHERE questions.id NOT IN (
    SELECT question_id FROM practice_session_questions WHERE practice_session_id = :sessionId
  )
  ```
  Ensures no logical question is ever delivered twice in the same session.

### 4. Database-Backed Concurrency & Duplicate Prevention
* **Unique Constraints**:
  * `UNIQUE (practice_session_id, question_id)`: Prevents the same logical question from ever being delivered twice in a session.
  * `UNIQUE (practice_session_id, sequence_number)`: Guarantees strict 1, 2, 3... ordering without sequence collisions across concurrent requests.
* **Race Condition Mitigation**: If two browser tabs simultaneously request the next question, one write succeeds and the second catches the unique index collision, safely returning the newly delivered question without creating duplicates or desynchronizing session progression.

### 5. Authentication & Ownership Invariants
* Practice is authenticated-only via Clerk.
* Client-provided user IDs are strictly untrusted; identity is always derived from server session tokens (`currentUser()`).
* Every session creation, query, and delivery verifies `session.studentProfileId === student.id`. Cross-student session access is rejected with an unauthorized domain error.

### 6. Student Delivery DTO Boundary (`StudentPracticeQuestionDto`)
* **Zero Answer Leakage Guarantee**:
  * The student delivery DTO strictly omits: `correctAnswer`, `explanation`, `isCorrect` flags on options, administrative review notes, author metadata, and duplicate-detection scores.
  * Serialized ORM objects (`question_versions` rows) are never transmitted directly to the client.
* **Delivered Fields**: `sessionQuestionId`, `sessionId`, `questionId`, `questionVersionId`, `sequenceNumber`, `totalQuestions`, `questionType`, `difficulty`, `questionText`, `options` (`id`, `optionLetter`, `optionText`), optional `caseStudy` (`id`, `title`, `scenarioText`), and `curriculumContext`.

### 7. Historical Version Immutability
* Once a question is delivered, its exact `question_version_id` is permanently locked in `practice_session_questions`.
* Administrative changes (e.g. creating `v2` due to an ICAI amendment or retiring `v1`) do not mutate or invalidate past delivery records.
* **Deletion Guardrail**: `deleteAdminQuestion` audits `practice_session_questions`. If a question has delivery records, hard deletion is blocked, prompting administrators to deactivate or retire the question instead.

### 8. Cache & Dynamic Rendering Architecture
* `/practice`: Dynamic server component resolving active student attempt context.
* `/practice/[sessionId]`: Dynamic server component fetching personalized student session state.
* Personalized session data is never cached statically or shared across students.

---

## Answer Submission, Immutable Grading & Session Scoring (Step 23)

### 9. Deterministic Grading Engine (`src/domains/practice/services/grading.ts`)
* **Zero AI Involvement**: All grading is 100% deterministic and evaluated directly against official question version answer keys. No LLMs or heuristics are used for MCQ grading.
* **Pure Domain Evaluation (`gradeAnswer`)**:
  * Normalizes student input and answer keys (trimmed, uppercase).
  * Validates that the selected option letter exists within the version's registered `options` list.
  * Compares normalized `selectedOptionLetter` to `question_versions.correctAnswer`.
  * Standard marking: +1 mark for correct, 0 marks for incorrect. Negative marking is omitted for standard CA practice sessions.

### 10. The Golden Historical Invariant: Immutability of Graded Attempts
* **Strict Reference Chain**:
  `practice_session → practice_session_question → question_version → student_answer / attempt → grading_result`
* **Amended Questions (V2 vs V1)**:
  * When an ICAI amendment changes a law or accounting standard, an administrator publishes version `v2` with a new answer key and explanation.
  * Any student practice attempt created under `v1` is graded **strictly against `v1`**.
  * The existence or activation of `v2` does not modify `v1`'s attempt row, correctness flag, score, or past explanation review.
  * Verified hermetically in `src/domains/practice/__tests__/grading-integrity.test.ts`.

### 11. Idempotency, Concurrency & Attempt Uniqueness
* **Table**: `practice_attempts`
  * Added `practiceSessionQuestionId` with a unique index: `practice_attempts_session_question_unique_idx`.
  * Added `studentProfileId` foreign key and indexes on `practiceSessionId`, `studentProfileId`, and `questionVersionId`.
* **Single Attempt Rule**: Exactly one final attempt record is permitted per delivered question (`practice_session_question_id`). Retrying individual questions within the same session is strictly forbidden.
* **Double-Submission Protection**:
  * UI disables the submit button during mutation and renders a loading spinner.
  * In the database, concurrent racing requests hit `practice_attempts_session_question_unique_idx`.
  * `submitPracticeAnswer` catches database unique constraint collisions and gracefully returns the existing attempt record without throwing errors or corrupting session progress.

### 12. Security Boundary & Post-Submission Reveal Contract
* **Pre-Submission**: `StudentPracticeQuestionDto` completely redacts `correctAnswer`, `explanation`, and `isCorrect` flags from options.
* **Post-Submission (`SubmitAnswerResultDto`)**: Correct answer and academic explanations are revealed **only after** a valid attempt is recorded in the database:
  * `isCorrect`: Boolean indicating whether the student answered correctly.
  * `correctOptionLetter`: The official correct option letter for the delivered version.
  * `explanation`: The official academic rationale from the delivered version.
  * `marksAwarded`: Score awarded (1 or 0).
  * `progress`: Updated session counts (`answeredQuestions`, `totalQuestions`, `score`, `accuracyPercentage`).
* **Session Summary Screen (`PracticeSessionSummaryDto`)**:
  * Upon answering the final delivered question, `practice_sessions.status` transitions to `COMPLETED` and `completedAt` is stamped.
  * Authoritative summary displays overall score, accuracy %, question counts, and a comprehensive question review list detailing user choices, correct answers, and academic explanations.
