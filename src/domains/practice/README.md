# Practice Domain (`src/domains/practice`)

## Purpose
Orchestrates active learning practice sessions, custom study filters, dynamic quiz generation, and option-level feedback during student study workflows.

## Boundaries & Constraints
*   **Types**: Governs both standard MCQ solving and complex Case-Study practice modules.
*   **State Management**: Tracks ongoing session parameters (questions answered, time spent, selected answers, and session status) on the server side.
*   **Free Practice**: MCQ and Case-Study practice modules remain accessible on the FREE plan as part of the core student preparation experience.
*   **Data Integrity**: Session performance maps directly to the student's progress and analytics history on submission.
