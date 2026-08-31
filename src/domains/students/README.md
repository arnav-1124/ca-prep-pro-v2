# Students & Plan Entitlements Domain (`src/domains/students`)

## Purpose
Manages student application profiles, plan allocations, rate limits, and access entitlements.

## Boundaries & Constraints
*   **Plans**: There are only two user plans: `FREE` and `PAID`.
*   **No Guests**: Access to study experiences, analytics, and AI assistance requires authentication. There is no guest state.
*   **Centralized Entitlements**: Feature availability must be evaluated through a centralized entitlement service (e.g., `canUseFeature(student, FEATURE)`). Do not hardcode checks like `if (pathname === '/ai')` or button visibility flags inside UI files.
*   **Rate Limits**: Free tier users may be subject to monthly or daily limits on AI predictions and question generation, evaluated dynamically here.
