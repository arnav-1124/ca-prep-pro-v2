# Billing Domain (`src/domains/billing`)

## Purpose
Manages payments sync, billing history, subscription entitlements, and payment provider webhook integrations.

## Boundaries & Constraints
*   **Provider**: Razorpay is the primary payment processor for the India-focused product.
*   **Server Reconciliation**: Entitlement state must reside in the local database. The client state is never trusted to determine whether a user is active or paid.
*   **Webhook Verification**: State changes (activations, renewals, cancellations) are managed via authenticated webhooks.
