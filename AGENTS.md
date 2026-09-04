<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# CA Prep Pro - AI Agent Guidelines & Architecture Rules

This document outlines the strict guidelines, coding conventions, and product direction for CA Prep Pro. All AI agents working on this repository must read and adhere to these rules without exception.

---

## 1. Product Vision & Direction

CA Prep Pro is a serious SaaS platform for Chartered Accountancy (CA) exam preparation, covering:
- CA Foundation
- CA Intermediate
- CA Final

### Core Student Experience (Planned):
- MCQ and case-study practice.
- Exam-style mock tests.
- Attempt-aware preparation history.
- Detailed progress analytics mapped at Level → Subject → Chapter → Topic levels.
- AI-assisted learning (predictive questions, automated mock tests, AI chat).

### Membership and Access:
- **Only two plans**: Free and Paid.
- **No guest users** (all users must register/authenticate).
- Core MCQ and case-study practice, plus AI question prediction, are available to Free users.

---

## 2. Technical Stack (Latest Verified)

- **Framework**: Next.js 16.3.3 (App Router)
- **Library**: React 19.2.8
- **Styling**: Tailwind CSS v4 + shadcn/ui (using Radix UI primitives)
- **Language**: TypeScript ^5
- **Linter**: ESLint ^9

---

## 3. Strict Coding & Architecture Rules

### Framework & API Correctness:
- **No Stale API Memory**: Do not rely on training memory for Next.js, React, or Tailwind CSS v4 APIs. Always consult official documentation or the offline docs in `node_modules/next/dist/docs/` first.
- **RSC by Default**: Use React Server Components by default. Keep components server-rendered and only mark leaf nodes with `"use client"` when DOM events (such as click handlers or react state/effects) are required.
- **Hydration Warnings**: Do not use `suppressHydrationWarning` to cover up code errors. Browser extension injections during local development are expected and should be documented rather than patched with hacks.

### Clean Code & Domain Boundaries:
- **No Premature Abstraction**: Avoid creating premature services or microservices. Keep logic direct.
- **Separate Business Logic**: Do not mix core domain/business logic with UI layout/components.
- **Semantic HTML**: Always use semantic tags (`<header>`, `<nav>`, `<main>`, `<section>`, `<article>`, `<footer>`) instead of generic nested `<div>` containers.

### Design System & Theme:
- **Single Source of Truth**: The global CSS variables in `src/app/globals.css` (managed via tweakcn) are the only source of truth for colors, border radii, shadows, and fonts.
- **No Arbitrary Tokens**: Do not write custom hex colors, margins, shadows, or border radii directly in files. Use Tailwind utility classes mapping to variables (e.g. `bg-background`, `text-primary`, `rounded-md`).
- **Interaction Cues**: Every clickable element (buttons, cards, links, tabs) must have a `cursor-pointer` class and appropriate hover/active states.
- **Component Restraint**: Do not build custom UI components when shadcn/ui already provides the required primitives (e.g. use shadcn components first).
- **Theme Provider**: Use `next-themes` with `attribute="class"` for light/dark mode transitions to interact cleanly with `globals.css` variables. Use `suppressHydrationWarning` on `<html>` as recommended for theme initialization.

### SEO & Accessibility:
- **SEO First Class**: Set up correct page and route metadata using Next.js `Metadata` APIs (OpenGraph, Twitter, canonical references, robots settings).
- **Accessibility (A11y)**: Build accessible markup. Buttons and inputs must have accessible names, proper keyboard navigation, and semantic attributes.

### Dependency Discipline:
- Do not install additional packages (databases, auth, AI, charts, payments, state management) unless explicitly requested or architecture-approved. Keep dependencies minimal.

---

## 4. Permanent Architectural & Domain Rules

### Modular Monolith Structure:
- CA Prep Pro is a modular monolith built on Next.js. Next.js owns all server-side logic, routing, auth mapping, database queries, and AI orchestration. Do not introduce microservices or separate backend repositories.
- Keep business logic encapsulated within `src/domains/` (auth, students, academics, questions, practice, tests, progress, predictions, ai, content, billing, analytics). DOMAIN LOGIC MUST NOT BE SCATTERED THROUGH UI COMPONENTS.

### Route-Group Architecture:
The Next.js App Router must be logically partitioned using route groups that do not leak into public URLs:
- `(marketing)/` -> Public landing pages (`/`, `/features`, `/pricing`, `/product`)
- `(auth)/` -> Authentication pages (`/sign-in`, `/sign-up`)
- `(app)/` -> Authenticated student experience (`/dashboard`, `/practice`, `/tests`, `/questions`, `/ai`, `/predictions`, `/progress`, `/tracker`, `/profile`)
- `(admin)/` -> Administrative console (`/admin/dashboard`, `/admin/content`, `/admin/questions`, `/admin/imports`, `/admin/users`)
- `api/` -> Dedicated HTTP API route handlers. Place all core logic in domain services; do not write business logic inside route handlers.
- **Route Protection**: Managed via the Next.js 16 file convention [`src/proxy.ts`](file:///c:/Users/Arnav112/OneDrive/Desktop/ca-prep-pro/src/proxy.ts) exporting the `clerkMiddleware` handler. The homepage (`/`) determines authentication state on the server to conditionally show sign-in/get-started or dashboard links and prevent hydration mismatching.

### Content Ingestion Boundaries:
- **No Crawler/Scraper Code**: CA Prep Pro consumes only clean, structured data. PDF downloading, OCR pipelines, scrapers, or SSRF scanners are strictly prohibited.
- **Canonical Interchange Contract**: Structured JSON is the authoritative exchange format. Imports must be schema-versioned and validated before database insertion to prevent partial corruption.

### AI Adapter Strategy:
- Core domain features must not import AI provider SDKs directly.
- All interactions route through `src/domains/ai` wrappers, supporting interchangeable Gemini and OpenRouter adapters.

### Entitlements & Level Contexts:
- **Two-Plan Model**: Only `FREE` and `PAID` plans are supported. A user must authenticate to access study features (no guest state). Check entitlements via a centralized service (`canUseFeature(student, FEATURE)`).
- **Level-Aware History**: Student progress and results history are level-specific (`FOUNDATION`, `INTERMEDIATE`, `FINAL`) and must be preserved when students transition between levels.
- **Exam Attempt Context**: Tracks the student's selected CA target exam attempt context (e.g. May 2027) to customize dashboards, mock tests, and preparation timelines.
- **Identity Mapping & Provisioning**: Clerk verifies identity ("who are you"). A profile record in our database is mapped to the Clerk User ID. When a student enters the authenticated layout in [`src/app/(app)/layout.tsx`](file:///c:/Users/Arnav112/OneDrive/Desktop/ca-prep-pro/src/app/(app)/layout.tsx), we resolve their details and idempotently provision their profile in Neon.


---

## 5. Permanent User-Facing Language Rule

The user-facing product must NEVER expose technical, engineering, developer, or infrastructure terminology unless it is genuinely meaningful to the student. Translate internal technical terms into student-focused learning concepts:

| Technical / Internal Term | Permitted Student-Facing Language |
| :--- | :--- |
| Clerk / Auth Provider | Sign in / Account |
| Neon / Database | Study records / System storage |
| R2 / Storage | Uploaded resources / Attachments |
| Resend / Email Service | Message delivery / Notifications |
| Razorpay / Billing | Subscriptions / Enrollment |
| Gemini / OpenRouter / AI Model | AI assistant / Study tutor |
| API / Route Handler / Status Code | Connection issue / Request failed |
| Rate Limit Exceeded | AI usage limit reached (refreshes daily) |
| Ingestion / Crawling | Importing practice content |
| Database ID / UUID | Practice ID / Reference ID |

Never expose raw exceptions, stack traces, database keys, or HTTP codes to the user. Show simple descriptions of what happened, validation statuses, and what the student can do next.

---

## 6. Database & Core Schema Rules

### ORM & Driver Stack:
- **Drizzle ORM + Kit**: Use Drizzle ORM to build all schemas. Schemas are modularized inside `src/db/schema/` and exported via `src/db/schema/index.ts`.
- **Neon HTTP Serverless Driver**: Always use `@neondatabase/serverless` using HTTP connections (`drizzle-orm/neon-http`) for serverless safety and connection optimization.
- **Server-Side Boundary**: Database operations must remain strictly server-side. Never import `src/db/index.ts` or any schema objects into client-side components (`"use client"`).

### Design Rules:
- **Relational Integrity**: Use foreign keys, unique indexes, and appropriate indexes for foreign key lookups. Avoid using generic JSON blobs to represent relations.
- **Question Versioning**: Questions are split into `questions` (logical identity) and `question_versions` (content revision snapshots). Practice attempts and mock test responses must reference a specific `question_version_id` to maintain grade history integrity.
- **Academic Attempt Contexts**: Tracks `student_attempts` mapping to target exam dates and years, allowing students to have multiple attempts historically.
- **Audit Trails**: Never overwrite or delete billing events (`billing_events`), prediction audits (`predictions`), test answers (`test_answers`), or historical attempt profiles.
- **Environment Variables**: Local database setup uses `DATABASE_URL` stored in `.env.local` (never committed). `.env.example` must contain the exact same environment names.

---

## 7. Global Development & Design Rules

### Shadcn-First UI Rule:
- Always use shadcn/ui components first for generic elements (buttons, popovers, calendars, date pickers, sheets, sidebars, tooltips, dialogs, inputs, forms). Customize them using existing design tokens in `globals.css` rather than writing custom custom divs.

### Global CSS / Design Token Rule:
- Do not write custom inline hex codes, radii, shadows, or spacing measurements. Use Tailwind variables mapping to tokens defined in `src/app/globals.css`.

### Responsive Design:
- Responsiveness is a first-class requirement. All views must support desktop, tablet, and mobile configurations seamlessly from initial build.

### Data Integrity & Honest Empty States:
- Do not generate fake question metrics, streaks, or completion percentages. If no history is found in the database, show clean, user-friendly empty states.


---

## 8. Versioned Academic Curriculum Rules

### Curriculum Versioning:
- Never hardcode papers, subjects, or chapter/topic lists inside React code or constants. All curriculum nodes must be dynamically retrieved from the database based on the student's active level and current active version.

### Hierarchical Flex:
- Do not assume a rigid two-level `Subject → Topic` structure. The syllabus must support arbitrary tree depth configurations (e.g. Modules containing Sections containing Chapters containing Topics) using a self-referential parent-child design.

### Idempotency Enforcement:
- Imports must be idempotent. Perform updates or inserts (upserts) in-place matching on unique node codes to ensure re-running imports does not create duplicate entries or break foreign key references from student practice records.

### Stateless Driver Constraints:
- Interactive multi-request transaction blocks (`db.transaction`) are not supported by the HTTP database driver (`drizzle-orm/neon-http`). Perform all structure, type, and uniqueness validations in-memory upfront before executing sequential database writes to prevent partial writes or corrupt database states.

---

## 9. Production-Grade SaaS, Scalability & Engineering Excellence Rules

CA Prep Pro is engineered as an enterprise-ready, high-throughput SaaS platform intended for tens of thousands of active students and multi-developer collaboration. Every contribution must meet these scalability and architectural benchmarks:

### 1. High-Scale Query & Algorithmic Efficiency
- **Foreign Key Indexing**: Every foreign key and frequently filtered column in PostgreSQL (e.g., `curriculum_version_id`, `subject_id`, `parent_id`, `student_profile_id`, `is_active`) must have an explicit database index.
- **Zero Full-Table Scans**: Never perform un-scoped `select().from(table)` queries. Always scope by version, tenant, level, or user context.
- **Linear $O(N)$ Data Structures**: In-memory tree reconstructions, descendant lookups, and hierarchy traversals must use hash-map adjacency lists rather than nested array lookups to guarantee $O(N)$ linear complexity.

### 2. Relational Integrity & Non-Destructive Guardrails
- **Historical Immutability**: Student practice attempts, test results, and question history must never be corrupted or cascade-deleted by administrative changes.
- **Dependency Diagnosis Before Deletion**: All destructive deletion actions must audit referencing child nodes, questions, tests, and student sessions. If references exist, hard deletion is blocked by system guardrails, prompting the administrator to deactivate the entity instead.
- **Engine-Level Invariant Enforcement**: Critical domain invariants (such as single active curriculum version per level) must be enforced directly at the database engine level (e.g. partial unique indexes) in addition to application-layer guards.

### 3. Server Action & Mutation Standards
- **Strict Authorization**: Every administrative Server Action must invoke `requireAdmin()` before parsing or executing mutations.
- **Standard Result Contract**: Server Actions must uniformly return `Promise<{ success: boolean; data?: T; error?: string }>` without throwing uncaught exceptions to the client.
- **Cache Revalidation Discipline**: Every mutation must trigger targeted Next.js cache revalidation across both admin surfaces and affected student portals.

### 4. UI/UX, Theming & Accessibility Standards
- **Zero Browser-Native Control Fallbacks**: Standardize on custom shadcn/Radix components (`Tooltip`, `Checkbox`, `DatePicker`, `Dialog`, `Popover`, `Button`) styled with CSS variables from `globals.css`.
- **Theme Contrast Parity**: All components must be designed and verified for high-contrast readability in both Light and Dark themes.
- **Fail-Safe Dialog UX**: Modals and confirmation dialogs must close immediately upon action execution, routing error and success diagnostics to page-level feedback banners so users are never trapped behind backdrop overlays.

### 5. Asynchronous UI Transitions, Loading Feedback & Stale-Data Prevention
- **Immediate Interaction Feedback**: Every user interaction triggering server or database operations (filtering, sorting, searching, pagination, level switching, mutations) must provide immediate visual feedback using React `useTransition()` or localized pending state.
- **Context-Preserving Loading Patterns**:
  - Use `loading.tsx` skeletons for route navigations to avoid layout shifts.
  - Use pending opacity (`opacity-50 pointer-events-none`) with progress bars and `aria-busy="true"` for in-place table/tree filter transitions.
  - Use high-fidelity modal skeletons for inspector drawers rather than blank overlays.
  - Disable buttons during mutations and render inline spinners to strictly prevent duplicate submissions.
- **Honest Feedback over Fake Optimism**: Never fabricate optimistic data rows or metrics. Data displayed must be authoritatively resolved from the server.

---

## 10. Question Bank Ingestion, Staging & Human Review Architecture

### 1. Non-Direct Publication Invariant
- Imported questions are **never** inserted directly into live `questions` or `question_versions` tables.
- All imported payloads are staged in `imported_questions` under an explicit `import_batches` container.
- Questions remain staged until an authorized administrator performs one-by-one review and issues explicit publication.

### 2. Server-Side Validation Pipeline
- Client-side validation is strictly untrusted.
- Server-side validation enforces non-empty question texts (10 to 10,000 chars), valid options arrays (2 to 6 options with non-empty letters and texts), exact match between `correctAnswer` and option letters, and complete `caseStudy` payloads for `CASE_STUDY` questions.

### 3. Version-Aware Curriculum Mapping
- Questions must be mapped to syllabus nodes within the explicit target `curriculum_version_id`.
- Precedence: (1) Canonical Node Code (`INT_P1_CH1_T1`), (2) Database UUID, (3) Unique Title within Version.
- If mapping is ambiguous or unmapped, questions enter `AMBIGUOUS_MATCH` or `UNMAPPED` and cannot be approved until manually assigned to a valid existing node.
- **Zero Auto-Creation**: Question import must NEVER create new curriculum nodes or subjects.

### 4. Deterministic Duplicate Detection
- Duplicate detection runs deterministically: normalized text fingerprinting + token Jaccard similarity against existing live questions.
- Duplicates are flagged as candidates for human comparison; AI is never used as an uncontrolled integrity barrier.

### 5. Auditable Immutability
- Raw import payloads, human edits, rejection reasons, and reviewer actions are permanently recorded in `import_audit_events`.

### 6. Optimistic Concurrency Control (OCC)
- Staged question mutations (`approveImportedQuestion`, `rejectImportedQuestion`, `editImportedQuestion`) require an `expectedUpdatedAt` timestamp.
- If a question was modified or reviewed concurrently by another administrator, the server rejects stale submissions with an actionable conflict error, preventing silent last-write-wins collisions.

### 7. Pre-Publication Integrity Gate & Interim Duplicate Collision Check
- Before writing to live tables (`questions`, `question_versions`, `question_options`, `case_studies`), the system performs an in-memory pre-flight validation of all approved questions:
  - Re-verifies that assigned curriculum nodes and subjects exist, are active, and belong to the active curriculum version.
  - Re-scans live question versions for exact duplicates published in the interim between initial import and final publication.
  - If a collision or inactive node is discovered, publication is blocked before live table insertion, and the affected question is reverted to `PENDING_REVIEW` with diagnostics.

### 8. Publication Idempotency & Resumable Pipeline
- Publication is strictly idempotent. Already published questions (`published_question_id IS NOT NULL`) are automatically skipped on retries, producing zero duplicate live questions upon network timeout or repeated trigger.
- Once published, staging question rows become immutable.

### 9. State Machine Invariants
- `PENDING_REVIEW` $\rightarrow$ `APPROVED`: Allowed ONLY if structurally valid (`validation_status !== 'INVALID'`), mapped to an active node (`curriculum_mapping_status !== 'UNMAPPED'`), and not duplicate-collided.
- `PENDING_REVIEW` $\rightarrow$ `REJECTED`: Requires a structured `rejection_reason` code.
- `PUBLISHED` $\rightarrow$ `APPROVED` / `REJECTED` / `EDITED`: Strictly BLOCKED. Live questions must be managed via versioning rather than staging mutation.
- `APPROVED` $\rightarrow$ `APPROVED`: Idempotent no-op without duplicate audit event creation.

---

## 11. Question Bank Management, Lifecycle Invariants & Canonical Export

### 1. Versioning vs Historical Student Attempts Invariant
- **Unattempted Questions ($0$ Practice Attempts & $0$ Mock Tests)**: Content edits safely update active `question_versions` in-place.
- **Attempted Questions ($>0$ Practice Attempts or Test Usages)**: Material content modifications (`questionText`, `options`, `correctAnswer`, `explanation`) **strictly create a new Question Version snapshot** (`v2`, `v3`) while preserving historical versions (`v1`) in deactivated archive state.
- **Grading & Analytics Immutability**: Historical student practice attempts and test results remain permanently tied to their original version ID (`question_version_id`), guaranteeing 100% past test review accuracy and analytics integrity.

### 2. Dependency-Guarded Deletion & Safe Retirement
- **Hard Deletion Block**: Hard deletion of a question is strictly blocked if referencing records exist in `practice_attempts`, `test_questions`, or `ai_conversations`.
- **Actionable Diagnostic**: When deletion is blocked, the system reports exact dependency metrics and prompts the administrator to deactivate or retire the question instead.
- **Safe Retirement**: Toggling a question's status to `INACTIVE` / `RETIRED` deactivates the current version, excluding it from future practice pools and test generators while preserving past student records.

### 3. Canonical Export & Importer Round-Trip Contract
- **Export Format Standard**: Question Bank exports generate standard `RawImportBatchJson` containing canonical syllabus node codes (`INT_P1_CH1_T1`), difficulty ratings, structured options, answer keys, explanations, and case study scenarios.
- **Round-Trip Guarantee**: Exported JSON files are 100% compatible with the Step 18 Question Importer, allowing seamless export $\rightarrow$ external review/amendment $\rightarrow$ import $\rightarrow$ staging $\rightarrow$ publication workflows.
- **Zero Sensitive Exposure**: Exports contain only educational question content; internal database user IDs, billing information, and security tokens are excluded.

---

## 12. Question Lifecycle Governance, Amendment Management & AI Boundaries

### 1. Operation Governance Matrix
| Scenario | Permitted Operation | Data & Historical Grading Effect |
| :--- | :--- | :--- |
| **New / Unattempted Question Typo / Option Fix** | **In-Place Update** | Active `question_versions` and options updated directly; remains `v1`. |
| **ICAI Law / Amendment / AS Change** (Attempted Question) | **Version Creation (`v2`)** | `v1` deactivated and archived for past student review; `v2` activated with new answer key/law. Past grades untouched. |
| **Obsolete Question** (Repealed Law / Discontinued Topic) | **Safe Retirement (`isActive=false`)** | Deactivates active version snapshot. Question excluded from future mock tests/practice pools; historical attempts preserved. |
| **Syllabus Hierarchy Restructuring / Topic Move** | **Curriculum Reassignment** | Reassigns `questions.curriculum_node_id` & `subject_id`. `practice_sessions` historical context preserved. |
| **Shared Case Study Deletion** | **Dependency-Guarded Child Deletion** | Child question deleted only if unattempted ($0$ refs). Shared scenario preserved until $0$ sibling questions remain. |
| **Corrupted Draft / Zero-Attempt Test Question** | **Hard Deletion** | Allowed ONLY when `practice_attempts=0`, `test_questions=0`, and `ai_conversations=0`. |

### 2. Legal & Amendment Invariant: Immutability of Past Grading
- Under no circumstances may an administrative update alter the `correct_answer`, `options`, or `question_text` of an attempted `question_version_id`.
- If a law change causes an answer to change from "A" to "B", students who took the test under the old law were graded on the old standard. Overwriting their version would retroactively fail students who answered correctly at that time.

### 3. Deterministic-First AI Boundary
- **Deterministic Authority**: All critical decisions (curriculum mapping, duplicate prevention, pre-publication validation, version creation, status toggling) are executed via deterministic algorithms and explicit SQL constraints.
- **AI Limited Role**: AI semantic assistance is strictly confined to non-destructive suggestions (e.g. suggesting canonical node matches for ambiguous chapter titles or highlighting semantic duplicates for human review). AI must NEVER execute automated deletions, approvals, or publications.

---

## 13. Question Bank Operational Intelligence & Review Queue Invariants

### 1. Deterministic Attention Flag Taxonomy
The operational review engine systematically tags live questions using 11 explainable, deterministic attention rules:
- `INACTIVE_NODE` (Severity: `CRITICAL`): Question mapped to an inactive syllabus node.
- `OBSOLETE_CURRICULUM` (Severity: `HIGH`): Question mapped to an inactive/superseded curriculum version.
- `FEW_OPTIONS` (Severity: `HIGH`): MCQ has fewer than 4 structured options.
- `POTENTIAL_DUPLICATE` (Severity: `HIGH`): Duplicate similarity score $\ge 80\%$ with another live question.
- `NEEDS_CHANGES` (Severity: `HIGH`): Human reviewer previously flagged the question for amendment.
- `RETIRED_QUESTION` (Severity: `MEDIUM`): Active question version marked inactive/retired.
- `WEAK_EXPLANATION` (Severity: `MEDIUM`): Missing or trivial explanation ($< 20$ characters).
- `NEVER_REVIEWED` (Severity: `LOW`): Question published into Question Bank but never audited by a human reviewer.
- `ZERO_USAGE` (Severity: `INFO`): $0$ student practice attempts and $0$ mock test usages.
- `HEAVY_USAGE` (Severity: `INFO`): High-traffic question ($> 20$ practice attempts or multiple test appearances).
- `MULTI_VERSIONED` (Severity: `INFO`): Question has undergone multiple amendments ($> 1$ versions).

### 2. Review Decision Entity & Audit Log
- All operational reviews are recorded in `question_reviews` capturing `question_id`, `question_version_id`, `reviewed_by` (admin email), `decision` (`REVIEWED`, `ACCEPTED`, `NEEDS_CHANGES`, `DISMISSED`), `notes`, and `created_at`.
- Review actions **never** mutate historical student practice attempts, test answers, or grading accuracy.
- Review queue queries provide server-side filtering by attention reason, severity rank, syllabus subject, review decision status, and usage traffic.

---

## 14. Canonical Curriculum-Aware Question Import/Export Schema (Schema v2.0)

### 1. Curriculum-Aware, Not Curriculum-Duplicating Invariant
- Question files and import/export payloads are **curriculum-aware references**, not curriculum owners.
- Questions reference subjects, chapters, units, and topics via canonical codes (`subjectCode`, `chapterCode`, `unitCode`, `topicCode`, `nodeCode`) and display titles prefixed with an underscore (`_subjectTitle`, `_chapterTitle`, `_topicTitle`).
- **Zero Auto-Creation**: Question Bank import pipelines must **never** create new curriculum nodes, subjects, or chapters. The Curriculum Admin is the sole authority for curriculum structure.

### 2. Hierarchical Flexibility & Flexible Mapping Levels
- The minimal required curriculum coordinate is `subjectCode`.
- Questions mapped to Subject-only, Subject + Chapter, Subject + Chapter + Unit, or Subject + Chapter + Unit + Topic are all valid.
- A question **must never be rejected** merely because it lacks a topic-level classification.

### 3. Source Origin vs Target Exam Applicability
- `sourceAttempt`: Originating publication/attempt context (e.g., `RTP May 2026`).
- `applicability`: Target exam cycles for which the question is relevant (e.g., `["MAY_2026", "NOV_2026", "MAY_2027"]`).

### 4. Shared Case Study Deduplication
- Shared case study scenarios are declared once at the batch level (`caseStudies: [...]`) and linked to child questions via `caseStudyRef`.
- Live publication deduplicates identical case study texts into a single live `case_studies` database record, sharing foreign key references across sibling questions.

### 5. Export/Import Round-Trip Guarantee
- `exportQuestionsToCanonicalBatch` generates authoritative Canonical Schema v2.0 JSON.
- The pipeline guarantees 100% round-trip fidelity: `EXPORT` $\rightarrow$ `IMPORT` $\rightarrow$ `VALIDATE` $\rightarrow$ `STAGE` $\rightarrow$ `PUBLISH` without schema loss or duplicate creation.
- Backward compatibility is maintained for legacy Schema v1.0 payloads.

---

## 15. Student Practice Session & Deterministic Question Delivery Engine

### 1. Authenticated Student Isolation & Ownership
- Practice sessions are strictly authenticated. Client-provided user IDs are never trusted; user identity is derived server-side from Clerk session tokens (`currentUser()`).
- Cross-student access is strictly forbidden: a student cannot inspect, advance, or modify another student's practice session.

### 2. Historical Curriculum & Version Invariance
- At session creation, the student's active `curriculum_version_id` is permanently locked onto `practice_sessions`.
- Sessions do not silently switch to a new curriculum version if an administrator subsequently publishes or activates a new syllabus scheme.
- Inactive curriculum nodes or subjects cannot be selected for new practice sessions.

### 3. Immutable Delivered Question Snapshots
- When a question is delivered to a student session, the exact `question_version_id` is recorded in `practice_session_questions`.
- Subsequent question edits or version increments (`v1` $\rightarrow$ `v2`) or retirement do not alter or delete what was previously delivered to the student session.
- System guardrails in `deleteAdminQuestion` audit `practice_session_questions` and block hard deletion if question delivery records exist.

### 4. Zero Answer Exposure Delivery Contract
- The student delivery payload (`StudentPracticeQuestionDto`) strictly omits `correctAnswer`, `explanation`, `isCorrect` option flags, admin review notes, AI prompts, and duplicate-detection metadata.
- Serialized ORM rows must never be returned directly to the client without passing through the sanitized DTO layer.

### 5. Deterministic Selection & Concurrency Guardrails
- Question selection operates deterministically using a server-side `session_seed` hashed against eligible question IDs:
  `ORDER BY md5(concat(questions.id::text, ':', session_seed::text)) ASC, questions.id ASC`.
  Expensive non-deterministic `ORDER BY RANDOM()` is strictly forbidden in production.
- Duplicate question delivery within a session is prevented via the database unique index `UNIQUE (practice_session_id, question_id)`.
- Concurrent sequence collisions are prevented via `UNIQUE (practice_session_id, sequence_number)`. Concurrent requests that race on delivery catch the collision and safely return the delivered item without creating duplicates.

---

## 16. Student Answer Submission, Immutable Grading & Session Scoring

### 1. Deterministic Grading Engine & Zero AI Involvement
- All practice MCQ grading is executed strictly via deterministic rules comparing student-selected option letters against the version's registered `correctAnswer` in `src/domains/practice/services/grading.ts`.
- AI, LLMs, or non-deterministic heuristics are strictly prohibited from MCQ grading or generating synthetic answer keys.
- Normalization (trim, uppercase) and option existence checks are strictly enforced before comparison.

### 2. The Golden Historical Invariant: Immutability of Graded Attempts
- Grading must strictly resolve against the exact, immutable `question_version_id` locked in `practice_session_questions` at question delivery time.
- If an amendment creates a newer question version (`v2`) with an altered answer key or revised explanation, past student attempts graded against `v1` must remain 100% frozen and untouched.
- Under no circumstances may an administrative update retroactively change the grading, marks awarded, or review display of an existing student attempt record.

### 3. Attempt Uniqueness, Idempotency & Double-Click Guardrails
- Exactly one final attempt record is permitted per delivered question (`practice_session_question_id`). Retrying individual questions within the same session is strictly forbidden.
- Enforced at the database level via the unique index `practice_attempts_session_question_unique_idx` on `practice_attempts (practice_session_question_id)`.
- Concurrent submission collisions or network retries catch unique constraint violations gracefully, returning the existing attempt record without throwing unhandled exceptions or corrupting session progress.
- UI elements must disable the submit button immediately upon click and render a localized pending spinner.

### 4. Post-Submission Reveal Boundary & Security Contract
- Prior to submission, `correctAnswer` and `explanation` are strictly withheld from client-side payloads.
- Correctness status, the official correct option letter, and the academic explanation are revealed **only after** a valid attempt is recorded in PostgreSQL.
- Session summary screens (`PracticeSessionSummaryDto`) authoritatively resolve the final score, accuracy percentage, and comprehensive review items strictly from persisted database attempts.
