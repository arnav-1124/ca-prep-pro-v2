# Progress Domain (`src/domains/progress`)

## Purpose
Aggregates historical student score data, tracks syllabus/subject coverage, and maps weak conceptual areas.

## Boundaries & Constraints
*   **Hierarchical Metrics**: Progress analytics must be mapped at Level → Subject → Chapter → Topic boundaries.
*   **Read Isolation**: The UI reads performance data through consolidated domain aggregates. Component code should never perform direct raw database queries or map relations.
*   **Time-Series Tracking**: Performance trends over time are tracked to assist target preparation timelines.
