# CA Prep Pro - Internal Guide

This guide covers operational infrastructure, third-party services, deployment settings, billing accounts, and secrets management plans for CA Prep Pro.

## Project Infrastructure

The platform is designed for a Serverless Next.js deployment.
- **Frontend Hosting**: Vercel (recommended for Next.js App Router and optimized caching/routing).
- **Domain DNS**: Managed via Cloudflare or Vercel DNS.

## Production Services & Providers

1. **Authentication**: **Clerk** Next.js SDK. Clerk manages user passwords, social sign-ins, and session tokens. The application maps Clerk identities to local `student_profiles` records and `admin_roles`.
2. **Database**: **Neon PostgreSQL**. Serverless PostgreSQL with Drizzle ORM. Holds application profiles, attempt contexts, academic syllabus hierarchy, questions bank, test responses, progress analytics, and billing records.
3. **Payments**: **Razorpay**. Payment gateway for subscriptions. Webhooks sync subscription purchases and entitlements directly to Neon, supported by server-side verification and manual sync fallbacks.
4. **File Storage**: **Cloudflare R2**. S3-compatible object storage used to store uploaded student files, source reference documents, and static content assets.
5. **Email**: **Resend**. Handles transactional email dispatches, password updates, billing notices, and notification alerts.
6. **AI Orchestration**: **Gemini & OpenRouter**. Exposes reasoning, predictive analysis, and mock question generation through internal provider adapters.

## Database Constraints & Invariants

- **Curriculum Single-Active Version Index**:
  ```sql
  CREATE UNIQUE INDEX "curriculum_versions_single_active_per_level_idx" 
  ON "curriculum_versions" ("academic_level_id") 
  WHERE "is_active" = true;
  ```
  Guarantees that no concurrent activation request can ever produce more than one active curriculum version per academic level.

## Environment Variables & Secrets

All API keys, database credentials, and payment secrets are stored in `.env.local` (for development) and Vercel environment variables (for production).

Key variables:
- `DATABASE_URL` (Neon DB connection string)
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` (Clerk credentials)
- `BOOTSTRAP_ADMIN_EMAIL` (Initial superadmin email authorization)
- `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET` (Payment gateway credentials)
- `RESEND_API_KEY` (Transactional email dispatcher)
- `GEMINI_API_KEY` / `OPENROUTER_API_KEY` (AI provider credentials)
