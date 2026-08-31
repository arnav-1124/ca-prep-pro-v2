# Academics Domain (`src/domains/academics`)

## Purpose
Establishes the educational hierarchy (Academic Level → Subject → Chapter → Topic/Concept) and tracks attempt-aware preparation timelines.

## Boundaries & Constraints
*   **Three Levels**: Covers `FOUNDATION`, `INTERMEDIATE`, and `FINAL` exams.
*   **Persistent Level History**: Academic history is persistent across levels. When a student transitions from `FOUNDATION` to `INTERMEDIATE`, their foundation progress and attempts history must be fully preserved rather than overwritten.
*   **Selected Exam Attempt**: The student can select a target exam attempt (e.g., "CA Intermediate - May 2027"). This attempt context is globally tracked and influences study recommendations, preparation timelines, and AI context.
*   **Level-Aware Association**: Subject, chapter, topic, question history, and test attempts are explicitly linked to their corresponding academic level in the schema.

## Curriculum Architecture & Invariants

### 1. Curriculum Versions & Activation Invariant
*   **Entity**: `curriculum_versions` represents cycle-specific syllabus schemes (e.g., "New Scheme 2026").
*   **Single-Active Invariant**: At any given time, an academic level (`academic_levels`) can have **at most one active curriculum version** (`isActive = true`).
*   **Engine-Level Guarantee**: Enforced by a PostgreSQL partial unique index on `(academic_level_id) WHERE is_active = true`.
*   **Orphan Protection**: Deactivation of the active version is blocked if dependent content or attempts exist without another active version ready.

### 2. Subjects Management
*   **Entity**: `subjects` represents academic papers under each level.
*   **Deterministic Ordering**: Sibling ordering is maintained using `sortOrder` integers and swapped sequentially.
*   **Deletion Guard**: Deletion is blocked if dependent curriculum nodes or questions exist.

### 3. Hierarchical Curriculum Nodes
*   **Entity**: `curriculum_nodes` provides a self-referential tree (`parentId`) supporting arbitrary syllabus depths (`MODULE`, `SECTION`, `CHAPTER`, `UNIT`, `TOPIC`).
*   **Hierarchy Safety**:
    - **Self-Parenting Prevention**: A node cannot be assigned as its own parent.
    - **Circular Hierarchy Prevention**: Moving a node verifies against all recursive descendants to prevent circular parent-child loops.
    - **Cross-Boundary Protection**: Nodes cannot be moved outside their subject container or curriculum version.
*   **Dependency Diagnostics & Safe Deletion**:
    - `checkNodeDependencies` queries referencing child nodes, `questions`, `practice_sessions`, `tests`, and `ai_conversations`.
    - If references exist, hard deletion is blocked by system guardrails, prompting the administrator to deactivate the node instead.

### 4. Enterprise Integrity Matrix & Mutation Contracts

*   **Relational Integrity**: Foreign keys ensure zero orphaned records.
*   **Semantic Integrity**: Human-readable names (`"Chapter 1: Nature, Objective and Scope of Audit"`) are mutable metadata within a curriculum version, updating dynamically across all referencing features without breaking links.
*   **Historical Integrity**: Student test attempts and practice results point to immutable `question_versions`. Past scores and answer records remain permanently unchanged even if active syllabus trees evolve.
*   **Canonical Node Code Contract**: Node codes (e.g. `INT_P5_CH1`) serve as the integration and import contract. Renaming a human title does not change the code; modifying a code requires caution to preserve external JSON interchange idempotency.
*   **Curriculum Versioning Strategy**: Major syllabus updates (e.g. ICAI New Scheme replacing Old Scheme) create a new `curriculum_version`. The retired version's nodes become frozen historical anchors, ensuring past student attempt analytics remain 100% intact.
