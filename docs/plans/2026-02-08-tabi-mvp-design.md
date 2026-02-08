# tabi MVP Design

## Vision

tabi is an all-in-one travel planning platform targeting individual travelers, couples, families, and groups. The app covers the entire travel lifecycle from inspiration through trip management to memories.

### Competitive Advantages

1. **Reliable AI itinerary suggestions** (Phase 2) - Real locations with realistic travel times
2. **Real-time collaborative editing + expense splitting** (Phase 2/3) - Integrated "plan together" experience
3. **Japanese-native** - Optimized UX for Japanese travelers

### Phased Roadmap

| Phase | Scope |
|-------|-------|
| 1 (MVP) | Auth, trip CRUD, daily schedule, spots, map view, sharing (read-only) |
| 2 | AI itinerary suggestions, real-time collaborative editing |
| 3 | Expense management, split billing, booking integrations |
| 4 | Offline support, photo management, mobile app |

## Architecture

```
[Browser]
    |
    v
[Next.js App Router] -- Frontend (React + Tailwind CSS + shadcn/ui)
    |
    v
[Hono API Server] -- Backend API (REST)
    |
    ├── Better Auth -- Authentication & session management
    ├── Drizzle ORM -- Data access
    |
    v
[PostgreSQL] -- Data persistence
```

### Tech Stack

| Layer | Technology | Reason |
|-------|-----------|--------|
| Monorepo | Turborepo + bun workspaces | Shared code with type safety |
| Frontend | Next.js (App Router) | SSR/SSG, file-based routing |
| UI | Tailwind CSS + shadcn/ui | Customizable, owned components |
| API | Hono | Fast on bun, type-safe routing |
| ORM | Drizzle | Type-safe, lightweight |
| DB | PostgreSQL | Relational, robust for complex travel data |
| Auth | Better Auth | TypeScript-first, self-hosted, flexible |
| Validation | Zod | Shared schemas across front/back |

### Directory Structure

```
tabi/
├── apps/
│   ├── web/                # Next.js frontend
│   │   ├── app/            # App Router pages
│   │   ├── components/     # UI components
│   │   └── lib/            # Frontend utilities
│   └── api/                # Hono API server
│       ├── routes/         # API route handlers
│       ├── db/             # Drizzle schema & migrations
│       └── lib/            # Backend utilities
├── packages/
│   └── shared/             # Shared types & Zod schemas
├── package.json            # bun workspace root
└── turbo.json              # Turborepo config
```

## Data Model

### users

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| name | varchar | |
| email | varchar | unique |
| avatar_url | varchar | nullable |
| created_at | timestamp | |
| updated_at | timestamp | |

### trips

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| owner_id | uuid | FK -> users |
| title | varchar | e.g. "Kyoto 3-day trip" |
| destination | varchar | e.g. "Kyoto" |
| start_date | date | |
| end_date | date | |
| status | enum | draft, planned, active, completed |
| cover_image_url | varchar | nullable |
| created_at | timestamp | |
| updated_at | timestamp | |

### trip_members

| Column | Type | Notes |
|--------|------|-------|
| trip_id | uuid | FK -> trips, composite PK |
| user_id | uuid | FK -> users, composite PK |
| role | enum | owner, editor, viewer |

### trip_days

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| trip_id | uuid | FK -> trips |
| date | date | |
| day_number | integer | 1, 2, 3... |
| memo | text | nullable |

### spots

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| trip_day_id | uuid | FK -> trip_days |
| name | varchar | e.g. "Kinkaku-ji" |
| category | enum | sightseeing, restaurant, hotel, transport, activity, other |
| address | varchar | nullable |
| latitude | decimal | nullable |
| longitude | decimal | nullable |
| start_time | time | nullable |
| end_time | time | nullable |
| sort_order | integer | for drag & drop reordering |
| memo | text | nullable |
| url | varchar | nullable, booking URL etc. |
| created_at | timestamp | |
| updated_at | timestamp | |

## Screens

| Screen | Path | Description |
|--------|------|-------------|
| Landing page | `/` | App introduction, sign-up CTA |
| Login/Signup | `/auth/login`, `/auth/signup` | Email + Google auth |
| Dashboard | `/dashboard` | Trip list (by status), create button |
| Create trip | `/trips/new` | Title, destination, dates input |
| Trip detail | `/trips/[id]` | Main screen: daily timeline + map |
| Add spot | `/trips/[id]` (modal) | Spot name, category, time, memo |
| Trip settings | `/trips/[id]/settings` | Member management, delete trip |
| Share view | `/trips/[id]/share` | Read-only, no login required |

### Trip Detail Layout

```
+---------------------------------------------+
|  Header: Trip title / dates / share button   |
+----------------------+-----------------------+
|                      |                       |
|  Daily Timeline      |  Map View             |
|                      |                       |
|  [Day 1] 2025/3/15  |  (spots shown         |
|   09:00 Kinkaku-ji   |   as pins)            |
|   12:00 Lunch        |                       |
|   14:00 Arashiyama   |                       |
|                      |                       |
|  [Day 2] 2025/3/16  |                       |
|   ...                |                       |
|                      |                       |
|  [+ Add spot]        |                       |
+----------------------+-----------------------+
```

## User Flow

1. Sign up / Login -> Dashboard
2. "Create new trip" -> Input title/dates -> Trip detail screen
3. Add spots per day -> Drag & drop to reorder
4. View spot locations on map -> Visualize routes
5. Generate share link -> Send to friends

## API Endpoints (MVP)

### Auth
- `POST /api/auth/signup` - Sign up
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/session` - Get current session

### Trips
- `GET /api/trips` - List user's trips
- `POST /api/trips` - Create trip
- `GET /api/trips/:id` - Get trip detail
- `PATCH /api/trips/:id` - Update trip
- `DELETE /api/trips/:id` - Delete trip

### Trip Days
- `GET /api/trips/:id/days` - List days for a trip
- `POST /api/trips/:id/days` - Add a day
- `PATCH /api/trips/:id/days/:dayId` - Update day
- `DELETE /api/trips/:id/days/:dayId` - Delete day

### Spots
- `GET /api/trips/:id/days/:dayId/spots` - List spots for a day
- `POST /api/trips/:id/days/:dayId/spots` - Add spot
- `PATCH /api/trips/:id/days/:dayId/spots/:spotId` - Update spot
- `DELETE /api/trips/:id/days/:dayId/spots/:spotId` - Delete spot
- `PATCH /api/trips/:id/days/:dayId/spots/reorder` - Reorder spots

### Sharing
- `POST /api/trips/:id/share` - Generate share link
- `GET /api/shared/:token` - Get shared trip (no auth required)
