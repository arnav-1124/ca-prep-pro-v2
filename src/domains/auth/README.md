# Authentication Domain (`src/domains/auth`)

## Purpose
Manages user identity mapping, session verification, onboarding flows, and account profiles.

## Boundaries & Constraints
*   **Provider**: Clerk is used for identity verification.
*   **Decoupled UI**: Do not tightly couple pages/layouts to Clerk's visual components. Sign-in, sign-up, onboarding, and profile pages should be built using native elements or custom shadcn layouts mapped via Clerk Next.js SDK APIs.
*   **User Mapping**: The local database maintains a profile record containing local system settings, academic history reference, and entitlements, keyed directly to the external Clerk User ID (`clerk_user_id`).
*   **Responsibility Split**:
    *   *Clerk*: Responsible for answering "Who is this user?" (identity, email verification, passwords, social log-in).
    *   *CA Prep Pro*: Responsible for answering "What can this user do?" (academic permissions, subscriptions, usage rates, and access controls).
