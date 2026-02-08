# tabi

Travel planning web application.

## Tech Stack

- **Monorepo**: Turborepo + bun workspaces
- **Frontend**: Next.js 15 (App Router) + Tailwind CSS v4 + shadcn/ui
- **API**: Hono (bun runtime)
- **Database**: PostgreSQL + Drizzle ORM
- **Auth**: Better Auth (email/password)
- **Validation**: Zod (shared schemas)
- **Linter/Formatter**: Biome
- **Map**: Leaflet + react-leaflet

## Setup

### Prerequisites

- [bun](https://bun.sh/) >= 1.0
- [Docker](https://www.docker.com/) (for PostgreSQL)

### Install

```bash
bun install
```

### Start Database

```bash
docker compose up -d
```

### Run Migrations & Seed

```bash
cp apps/api/.env.example apps/api/.env
bun run db:push
bun run db:seed
```

### Development

```bash
bun run dev
```

- Web: http://localhost:3000
- API: http://localhost:3001

## Scripts

All commands run from project root:

```bash
bun run dev          # Start all dev servers
bun run build        # Build all packages
bun run test         # Run all tests (Vitest)
bun run lint         # Lint all packages (Biome)
bun run format       # Format all packages (Biome)
bun run check        # Lint + format + import sort (Biome)
bun run check-types  # TypeScript type checking
bun run db:push      # Push DB schema
bun run db:generate  # Generate migrations
bun run db:migrate   # Run migrations
bun run db:studio    # Open Drizzle Studio
bun run db:seed      # Seed dev data
```

Package-specific:

```bash
bun run --filter @tabi/api test
bun run --filter @tabi/web lint
bun run --filter @tabi/shared check-types
```

## Project Structure

```
tabi/
├── apps/
│   ├── web/          # Next.js frontend
│   └── api/          # Hono API server
├── packages/
│   └── shared/       # Shared Zod schemas & types
├── biome.json        # Biome config (lint/format)
├── turbo.json        # Turborepo config
└── docker-compose.yml
```
