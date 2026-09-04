# CA Prep Pro

CA Prep Pro is a serious, production-grade SaaS platform for Chartered Accountancy (CA) exam preparation covering **CA Foundation**, **CA Intermediate**, and **CA Final**.

## Tech Stack

- **Framework**: [Next.js 16 (App Router)](https://nextjs.org)
- **Library**: React 19
- **Styling**: Tailwind CSS v4 + shadcn/ui
- **Language**: TypeScript ^5
- **Database**: Neon Serverless PostgreSQL with Drizzle ORM
- **Auth**: Clerk with server-side identity synchronization and Admin RBAC
- **Payments**: Razorpay billing integration with webhook synchronization
- **AI Engine**: Flexible provider adapter layer supporting Gemini and OpenRouter

## Key Features

### Student Experience
- **Attempt-Aware Curriculum**: Level-specific syllabus tree dynamically loaded from active curriculum versions.
- **MCQ & Case-Study Practice**: Practice sessions with deterministic seed-hashed question selection, active curriculum version pinning, delivered-question tracking, and zero-answer client security.
- **Answer Submission & Immutable Grading**: Pure deterministic server-side grading, idempotent attempt recording locked to delivered question versions, post-submission academic explanations, real-time progress, and comprehensive session scoring.
- **Exam-Style Mock Tests**: Timed, attempt-specific test simulations with comprehensive diagnostics.
- **Detailed Progress Analytics**: Preparation insights mapped across Level → Subject → Chapter → Topic.

### Admin Console (`/admin`)
- **Admin Authorization**: Role-based access control with bootstrap administrator provisioning (`BOOTSTRAP_ADMIN_EMAIL`).
- **Curriculum Version Management** (`/admin/curriculum/versions`): Manage version scheme lifecycles with single-active syllabus invariants enforced at both the database (PostgreSQL partial unique index) and application levels.
- **Curriculum Structure Editor** (`/admin/curriculum`): 3-column hierarchical syllabus manager supporting Subject and Node CRUD, deterministic sibling reordering, circular hierarchy protection, and relational dependency diagnostics before deletion.

## Getting Started

### 1. Prerequisites
- Node.js 20+
- PostgreSQL database (e.g. Neon)
- Clerk account
- Razorpay account (for billing)

### 2. Setup Environment
Copy `.env.example` to `.env.local` and populate the required keys:
```bash
cp .env.example .env.local
```

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the application.

## Verification & Quality Checks

Run the standard verification commands:
```bash
# Type check
npx tsc --noEmit

# Lint check
npx eslint src

# Production build
npm run build
```
