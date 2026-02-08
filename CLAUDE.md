# tabi - Travel Planning App

## Project Overview

Travel planning web app. Monorepo with Turborepo + bun workspaces.

## Structure

```
apps/web/         Next.js 15 (App Router) + Tailwind CSS v4 + shadcn/ui
apps/api/         Hono API server (bun runtime)
packages/shared/  Shared Zod schemas and types
```

## Commands

All commands run from project root with `bun run`:

```bash
bun run dev          # Start all dev servers (turbo)
bun run build        # Build all packages
bun run test         # Run all tests (vitest)
bun run lint         # Lint all packages (Biome via turbo)
bun run format       # Format all packages (Biome via turbo)
bun run check        # Lint + format + import sort (Biome via turbo)
bun run check-types  # TypeScript type checking
bun run db:push      # Push DB schema
bun run db:generate  # Generate migrations
bun run db:migrate   # Run migrations
bun run db:studio    # Open Drizzle Studio
bun run db:seed      # Seed dev data
```

Package-specific commands use `--filter`:

```bash
bun run --filter @tabi/api test
bun run --filter @tabi/web lint
bun run --filter @tabi/shared check-types
```

**NEVER use `cd <dir> && ...` pattern. Always use `bun run` or `bun run --filter`.**
**NEVER use `bunx`. All tools have package.json scripts.**

## Tech Stack

- Runtime: bun
- Frontend: Next.js 15, React 19, Tailwind CSS v4, shadcn/ui (New York, Zinc)
- Backend: Hono on bun
- DB: PostgreSQL + Drizzle ORM
- Auth: Better Auth (email/password, `advanced.database.generateId: "uuid"`)
- Validation: Zod (shared schemas in packages/shared)
- Linter/Formatter: Biome (root biome.json, each package has lint/format/check scripts)
- Test: Vitest
- Map: Leaflet + react-leaflet

## Key Patterns

- All API routes require `requireAuth` middleware (except health check and shared trip view)
- Zod schemas in `packages/shared/src/schemas/` are used for both API and frontend validation
- API client at `apps/web/lib/api.ts` handles auth cookies automatically (`ApiError` class with status code)
- DB schema at `apps/api/src/db/schema.ts` includes Better Auth tables
- Spots belong to trip_days, trip_days belong to trips
- Trip creation auto-generates trip_days from date range and adds owner as trip_member
- Spot/trip ownership verified through full chain (dayId -> tripId -> userId)

## Development

- PostgreSQL required: `docker compose up -d`
- API: http://localhost:3001
- Web: http://localhost:3000
- DB push: `bun run db:push`
- Seed: `bun run db:seed`

## Conventions

- Conventional Commits: `<type>: <Japanese description>`
- TDD: Red -> Green -> Refactor
- Language in code: English (comments explain Why, not What)
- No dead code, no TODO without issue
- No `biome-ignore` for lint suppression; fix the root cause
