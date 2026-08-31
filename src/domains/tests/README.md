# Tests Domain (`src/domains/tests`)

## Purpose
Manages formal, time-restricted mock examinations, scoring rules, exam simulations, and grading reports.

## Boundaries & Constraints
*   **Time Enforcements**: Mock tests enforce strict timer limits on the server. Submissions exceeding bounds are flagged.
*   **Attempt Boundaries**: Mock exams are compiled from specific, historically-consistent attempts (e.g. RTP Nov 2026) and must align with academic context.
*   **Result Generation**: Grading happens on the server. Client UI displays descriptive results and performance breakdowns without exposing database queries or raw models.
