# sugara Architecture Overview

## System Architecture

```mermaid
graph TB
    subgraph Client
        Web[Web Browser<br/>Next.js SSR + SPA]
        Desktop[Desktop App<br/>Tauri WebView]
    end

    subgraph Vercel
        NextJS[Next.js 15<br/>App Router]
        HonoAPI[Hono API<br/>Route Handler]
        NextJS --> HonoAPI
    end

    subgraph Supabase
        PG[(PostgreSQL)]
        Realtime[Realtime<br/>Broadcast + Presence]
        Storage[Storage<br/>Cover Images]
    end

    subgraph External
        EdgeConfig[Vercel Edge Config<br/>Announcements / Feature Flags]
        GoogleMaps[Google Maps API<br/>Routes / Places]
        GitHub[GitHub API<br/>Feedback Issues]
    end

    Web -->|HTTPS| NextJS
    Desktop -->|HTTPS| NextJS
    Web <-->|WebSocket| Realtime
    HonoAPI -->|SQL| PG
    HonoAPI -->|REST| Storage
    HonoAPI -->|REST| EdgeConfig
    HonoAPI -->|REST| GoogleMaps
    HonoAPI -->|REST| GitHub
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router), React 19, Tailwind CSS v4, shadcn/ui |
| API | Hono (Next.js Route Handler として統合) |
| Database | Supabase PostgreSQL + Drizzle ORM |
| Realtime | Supabase Realtime (Broadcast + Presence) |
| Auth | Better Auth (email/password, invite-only) |
| Validation | Zod (shared package) |
| Desktop | Tauri (macOS + Windows) |
| CI/CD | GitHub Actions, Vercel, Dependabot |
| Linter | Biome |
| Test | Vitest (unit/integration), Playwright (E2E) |

## Monorepo Structure

```
sugara/
  apps/
    web/          Next.js frontend + API route handler
    api/          Hono API routes, DB schema, auth
    desktop/      Tauri desktop app (WebView wrapper)
  packages/
    shared/       Zod schemas, types, constants
```

`apps/web` is the deployment target. `apps/api` is imported by `apps/web` as a Route Handler at `apps/web/app/api/[[...route]]/route.ts`. They share types and validation schemas via `packages/shared`.

## Request Flow

```mermaid
sequenceDiagram
    participant B as Browser
    participant M as Next.js Middleware<br/>(proxy.ts)
    participant P as Next.js Page<br/>(SSR/CSR)
    participant H as Hono API<br/>(Route Handler)
    participant DB as PostgreSQL

    B->>M: GET /home
    M->>M: Session check via /api/auth/get-session
    M->>P: Authenticated -> render page
    P->>B: HTML + JS

    B->>H: GET /api/trips
    H->>H: requireAuth middleware
    H->>DB: SELECT trips...
    DB-->>H: rows
    H-->>B: JSON response
```

## Realtime Communication

Two channel types isolate authenticated members from shared-link viewers:

```mermaid
graph LR
    subgraph "Authenticated Users"
        M1[Member A] <-->|Presence + Broadcast| CH1["trip:{tripId}"]
        M2[Member B] <-->|Presence + Broadcast| CH1
    end

    subgraph "Shared Viewers"
        SV[Shared Link Viewer] -->|Broadcast receive only| CH2["trip-shared:{shareToken}"]
    end

    M1 -.->|broadcastChange| CH2
```

- `trip:{tripId}` -- Members-only channel for Presence (who's online) and mutual broadcast
- `trip-shared:{shareToken}` -- Shared viewers receive update notifications without accessing tripId

## Auth Model

- **Better Auth** with email/password credentials
- Signup is invite-only (admin-controlled toggle via Edge Config)
- Guest accounts: limited to 1 trip, no friends/bookmarks/groups
- Admin: identified by `ADMIN_USER_ID` env var

## Deployment

```mermaid
graph LR
    Push[git push main] --> CI[GitHub Actions<br/>lint + types + test]
    Push --> Vercel[Vercel Build<br/>migrate + seed-faqs + next build]
    Push --> Tag{tauri.conf.json<br/>version changed?}
    Tag -->|yes| TagCI[desktop-tag.yml<br/>create tag]
    TagCI --> Build[desktop-build.yml<br/>Tauri build]
    Build --> Release[GitHub Release<br/>public repo]
```

- Web: Vercel auto-deploy on push to main. `turbo-ignore` skips if no relevant changes.
- Desktop: Version bump in `tauri.conf.json` triggers tag -> build -> release pipeline.
- DB migrations run automatically during Vercel build via `MIGRATION_URL` (direct connection).
