# tabi - Travel Planning App

## Project Overview

Travel planning web app. Monorepo with Turborepo + bun workspaces.

## Structure

```
apps/web/    Next.js 15 (App Router) + Tailwind CSS v4 + shadcn/ui
apps/api/    Hono API server (bun runtime)
packages/shared/  Shared Zod schemas and types
```

## Commands

All commands run from project root with `bun run`:

```bash
bun run dev          # Start all dev servers (turbo)
bun run build        # Build all packages
bun run test         # Run all tests (vitest)
bun run check-types  # TypeScript type checking
```

Package-specific commands use `--filter`:

```bash
bun run --filter @tabi/api test       # API tests only
bun run --filter @tabi/web dev        # Web dev server only
bun run --filter @tabi/shared test    # Shared package tests only
bun run --filter @tabi/api db:push    # Push DB schema
bun run --filter @tabi/api db:generate # Generate migrations
```

**NEVER use `cd <dir> && ...` pattern. Always use `bun run` or `bun run --filter`.**

## Tech Stack

- Runtime: bun
- Frontend: Next.js 15, React 19, Tailwind CSS v4, shadcn/ui (New York, Zinc)
- Backend: Hono on bun
- DB: PostgreSQL + Drizzle ORM
- Auth: Better Auth (email/password)
- Validation: Zod (shared schemas in packages/shared)
- Test: Vitest

## Key Patterns

- All API routes require `requireAuth` middleware (except health check and shared trip view)
- Zod schemas in `packages/shared/src/schemas/` are used for both API and frontend validation
- API client at `apps/web/lib/api.ts` handles auth cookies automatically
- DB schema at `apps/api/src/db/schema.ts` includes Better Auth tables
- Spots belong to trip_days, trip_days belong to trips
- Trip creation auto-generates trip_days from date range

## Development

- PostgreSQL required: `docker compose up -d`
- API: http://localhost:3001
- Web: http://localhost:3000
- DB push: `bun run --filter @tabi/api db:push`

## Conventions

- Conventional Commits: `<type>: <Japanese description>`
- TDD: Red -> Green -> Refactor
- Language in code: English (comments explain Why, not What)
- No dead code, no TODO without issue
