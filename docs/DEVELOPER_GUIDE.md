# CA Prep Pro - Developer Guide

Welcome to the CA Prep Pro codebase! This guide covers our technical stack, conventions, directory structure, and development workflows.

## Technology Stack

The project runs on a modern, high-performance web stack:
- **Framework**: [Next.js 16 (App Router)](file:///c:/Users/Arnav112/OneDrive/Desktop/ca-prep-pro/node_modules/next/dist/docs/index.md)
- **Library**: React 19
- **Styling**: Tailwind CSS v4 (with `@theme` inline directive) & shadcn/ui
- **Language**: TypeScript ^5
- **Linter**: ESLint ^9
- **Database & ORM**: Neon PostgreSQL with Drizzle ORM (`@neondatabase/serverless` HTTP driver)
- **Authentication**: Clerk SDK with server-side identity mapping & RBAC

## Project Structure

The codebase is structured as a modular monolith. Directories are organized to keep UI components, domain logic, and routes completely separated:

```text
ca-prep-pro/
├── docs/                      # Technical guides and internal specifications
│   ├── DEVELOPER_GUIDE.md
│   ├── INTERNAL_GUIDE.md
│   ├── ACADEMIC_IMPORT_FORMAT.md
│   └── TEST_IMPORT_FORMAT.md
├── src/
│   ├── app/                   # App Router pages, layouts, and global styles
│   │   ├── (marketing)/       # Public routes (landing, pricing, features)
│   │   ├── (auth)/            # Auth routes (sign-in, sign-up)
│   │   ├── (app)/             # Authenticated student portal (dashboard, practice, tests, progress)
│   │   ├── (admin)/           # Admin Console (admin/curriculum, versions, structure)
│   │   ├── api/               # API route handlers (webhooks, etc.)
│   │   ├── actions/           # Next.js Server Actions (admin-curriculum, etc.)
│   │   ├── globals.css        # Core design-token variables (tweakcn source of truth)
│   │   ├── layout.tsx         # Root layout with SEO, theme provider, and fonts
│   │   ├── error.tsx          # Global error boundary
│   │   └── not-found.tsx      # Global not-found page
│   ├── components/            # UI components
│   │   ├── ui/                # shadcn/ui components (Button, Dialog, Popover, Calendar, Checkbox, Tooltip, DatePicker)
│   │   ├── marketing/         # Public landing page layout blocks
│   │   └── ModeToggle.tsx
│   ├── db/                    # Database connection & Drizzle schemas
│   │   ├── index.ts           # Neon serverless HTTP client initialization
│   │   └── schema/            # Modular schemas (academics, auth, billing, questions, tests, etc.)
│   ├── domains/               # Core domain boundaries (Business logic)
│   │   ├── auth/              # Clerk mapping, admin RBAC & bootstrap provisioning
│   │   ├── students/          # Entitlements & free/paid plans
│   │   ├── academics/         # CA levels, curriculum versions, subjects & hierarchical nodes
│   │   ├── questions/         # Question bank catalog & versioning
│   │   ├── practice/          # Quiz and practice sessions
│   │   ├── tests/             # Mock test enforcements
│   │   ├── progress/          # Time-series student progress metrics
│   │   ├── predictions/       # Prediction audit histories
│   │   ├── ai/                # LLM provider adapter abstracts
│   │   ├── content/           # JSON Ingestion contracts
│   │   ├── billing/           # Razorpay subscription & webhook processing
│   │   └── analytics/         # System events & drill-down metrics
│   ├── lib/                   # Utility functions and shared library code
│   │   └── utils.ts           # Tailwind merge helper (cn)
│   └── proxy.ts               # Request proxying and Clerk route protection
├── AGENTS.md                  # Strict rules and context for AI coding agents
├── components.json            # shadcn/ui configuration
├── eslint.config.mjs          # ESLint configuration
├── next.config.ts             # Next.js configuration
├── package.json               # Dependencies and scripts
└── tsconfig.json              # TypeScript compilation setup
```

## Architectural Boundaries

1. **Modular Monolith**: CA Prep Pro runs as a single Next.js application managing server rendering, client interaction, and database queries. Business logic resides strictly in `src/domains/`.
2. **Provider Abstractions**: Domain features never invoke provider SDKs directly (e.g., Clerk, Neon, Gemini, Razorpay). Provider integrations use internal adapters in `src/domains/`.
3. **Data Access Boundaries**: UI components and route handlers must never make direct SQL queries. Data access is channeled via domain services and repositories.
4. **Server Actions with Role Enforcement**: All administrative mutations are executed via Server Actions in `src/app/actions/` that enforce `requireAdmin()`.
5. **Component Standards**:
   - Always prioritize shadcn/ui primitives (`src/components/ui/`).
   - Use custom `Tooltip` (`TooltipTrigger asChild`, `TooltipContent`), `Checkbox` (Radix primitive), and `DatePicker` (`Popover` + `Calendar`) instead of browser-native controls.
6. **Modal & Feedback Pattern**:
   - Destructive dialogs must close immediately on submission/error, restoring page interaction and presenting error or success feedback in the main page notification banner so diagnostics are never hidden behind backdrops.

## Theming & Design Tokens

The visual system uses CSS variables mapped under Tailwind v4. The single source of truth is [globals.css](file:///c:/Users/Arnav112/OneDrive/Desktop/ca-prep-pro/src/app/globals.css).

- **Design Tokens**: Use semantic classes (`bg-background`, `text-foreground`, `text-primary`, `border-border`, `bg-card`, `text-muted-foreground`).
- **Interactive Elements**: Every interactive element must have `cursor-pointer`, accessible aria labels, and distinct focus/hover/active states.
- **Theme Provider**: Global dark/light theme transitions managed via `next-themes`.

## Core Commands

Run the following commands in the project root:

- **Run Dev Server**: `npm run dev`
- **Lint Codebase**: `npm run lint` or `npx eslint src`
- **Type Check**: `npx tsc --noEmit`
- **Build Production**: `npm run build`

## Database & Migration Workflow

We use **Drizzle ORM** with **Neon PostgreSQL** as our primary datastore. All schemas are defined in TypeScript under `src/db/schema/`.

### 1. Modifying the Schema
1. Update table definitions in `src/db/schema/`.
2. Ensure tables and relations are exported in `src/db/schema/index.ts`.

### 2. Migration Execution
```bash
npx drizzle-kit generate
npx drizzle-kit migrate
```

## Admin Console & Curriculum Management

### 1. Authorization
- **Bootstrap Admin**: Configured via `BOOTSTRAP_ADMIN_EMAIL` in `.env.local`.
- **RBAC**: Database roles are mapped in `admin_roles` table.
- **Access Guard**: `/admin/*` routes verify admin privileges using `requireAdmin()` on both server page rendering and server actions.

### 2. Curriculum Version Management (`/admin/curriculum/versions`)
- Displays all syllabus versions grouped by academic level.
- **Single-Active Invariant**: Enforces that only one version per level can be active at any time, backed by a PostgreSQL partial unique index `curriculum_versions_single_active_per_level_idx`.

### 3. Curriculum Structure Management (`/admin/curriculum`)
- **3-Column Interactive Editor**: Subjects, hierarchical node tree, and entity inspector.
- **Node & Subject CRUD**: Create, edit, reorder siblings (`UP`/`DOWN`), and delete where safe.
- **Hierarchy Safety**: Blocks self-parenting, circular hierarchy loops (descendant checks), and cross-subject moves.
- **Dependency Diagnostics**: Before deleting a node or subject, deep relational checks verify 0 referencing child nodes, questions, mock tests, or student practice sessions.

### 4. Question Bank Explorer (`/admin/questions`)
- **Multi-Filter Explorer**: Server-side paginated queries with filters across Academic Levels, Curriculum Versions, Subjects, Chapters/Topics, Types (`MCQ`/`CASE_STUDY`), Difficulties, and Sources.
- **Question Inspector**: Visual curriculum breadcrumb mapping (`Level → Version → Subject → Node`), option analysis, academic explanations, case study scenarios, and relational usage metrics.

### 5. Question Bank Import & Human Review Workflow (`/admin/questions/imports`)
- **Staging & Non-Direct Publication**: Uploaded JSON batches are staged in `imported_questions` and `import_batches` without writing unverified questions directly to live Question Bank tables.
- **Server-Side Validation**: Enforces strict structural rules (non-empty texts, 2-6 options, answer key letter matching, complete case studies).
- **Canonical Curriculum Mapping**: Resolves syllabus nodes via canonical codes (`INT_P1_CH1_T1`), UUIDs, or unique names in the selected curriculum version.
- **Deterministic Duplicate Detection**: Exact normalized text hashing and token Jaccard similarity comparison against live questions.
- **One-By-One Review Workspace (`/admin/questions/imports/[batchId]`)**: Enables keyboard-friendly inspection (`A` for Approve & Next, `R` for Reject with reason, `E` for Edit).
- **Optimistic Concurrency Control (OCC)**: Validates `expectedUpdatedAt` timestamps across concurrent reviewer actions, preventing stale overwrites.
- **Pre-Publication Integrity Gate**: Re-validates active curriculum nodes, subjects, and versions and executes an interim live duplicate collision check prior to inserting any live questions.
- **Idempotent Resumable Publication**: Staged items link directly to live `publishedQuestionId`; retries safely skip already-published rows with zero duplication.


## Production-Grade Scalability & Engineering Standards

1. **Query Optimization**: Every foreign key is explicitly indexed in schema files. Avoid unscoped table queries.
2. **Algorithmic Complexity**: In-memory tree and graph transformations must use hash map adjacency lists for $O(N)$ linear time.
3. **Immutability of Audit & Practice Records**: Administrative mutations must never cascade-delete or corrupt student progress, question banks, or test answers.
4. **Shadcn Component Discipline**: Never use browser-native fallback controls (such as `<input type="date">` or native `title="..."` tooltips) when standardized shadcn/Radix components are available.
5. **Theme Parity**: Verify contrast in both Light and Dark modes using CSS variables from `globals.css`.
6. **Immediate Asynchronous Feedback**: All server actions, navigations, and filter transitions must use React `useTransition` or immediate pending states with context-preserving skeletons and `aria-busy` attributes to guarantee sub-millisecond interaction feedback.
