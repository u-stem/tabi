# tabi

Travel planning web application.

## Tech Stack

- **Monorepo**: Turborepo + bun workspaces
- **Frontend**: Next.js 15 (App Router) + Tailwind CSS v4 + shadcn/ui
- **API**: Hono (bun runtime)
- **Database**: PostgreSQL + Drizzle ORM
- **Auth**: Better Auth (email/password)
- **Validation**: Zod (shared schemas)
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

### Run Migrations

```bash
cp apps/api/.env.example apps/api/.env
bun run --filter @tabi/api db:push
```

### Development

```bash
bun run dev
```

- Web: http://localhost:3000
- API: http://localhost:3001

### Testing

```bash
bun run test
```

### Type Check

```bash
bun run check-types
```

## Project Structure

```
tabi/
├── apps/
│   ├── web/        # Next.js frontend
│   └── api/        # Hono API server
├── packages/
│   └── shared/     # Shared Zod schemas & types
├── docs/plans/     # Design & implementation docs
└── docker-compose.yml
```
