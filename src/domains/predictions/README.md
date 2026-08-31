# Predictions Domain (`src/domains/predictions`)

## Purpose
Manages AI-driven exam question predictions, likelihood estimation scoring, and historical accuracy tracking.

## Boundaries & Constraints
*   **Plan Allocation**: Prediction is a global capability available to both `FREE` and `PAID` users.
*   **Version History Preservation**: The system maintains a complete audit trail of predictions over time. If a prediction is updated (e.g. from version 1 to version 2), previous records are preserved instead of overwritten.
*   **Explanation Data**: Each prediction record retains descriptive context explaining what was predicted, when, the confidence score, the model/provider used, and the academic attempt context.
