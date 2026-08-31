# Content Ingestion Domain (`src/domains/content`)

## Purpose
Establishes the structured content import schema, validates hierarchical question JSON data, and handles internal imports processing.

## Boundaries & Constraints
*   **Decoupled Ingestion**: CA Prep Pro is not an OCR, crawler, or scraping engine. It consumes pre-structured, validated content. Crawlers, PDF download managers, and OCR pipelines are prohibited.
*   **Canonical Format**: Hierarchical structured JSON is the authoritative exchange format. The schema contains headers for metadata versioning, academic level contexts, and content tables (Level → Exam → Attempt → Subject → Chapter → Topic → Source → Question → Options → Answer → Explanation → Versions).
*   **Database Safety**: Ingestion runs inside database transactions. Partial or corrupt imports must rollback completely without contaminating the database.
