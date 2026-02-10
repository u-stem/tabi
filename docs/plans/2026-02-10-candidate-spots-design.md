# Candidate Spots Design

Trip-level shared list for spots not yet assigned to a specific day/pattern.

## Motivation

Users want to save spots they're considering without committing to a specific day. Currently all spots must belong to a day_pattern, so there's no way to keep "maybe" items.

## Approach

Make `dayPatternId` nullable on the existing `spots` table. A spot with `dayPatternId = NULL` is a candidate. Moving between candidate and timeline is a single UPDATE.

This is the standard pattern used by Jira (backlog = no sprint), Trello (cards move between columns), and travel planning apps like Wanderlog.

## Data Model

Changes to `spots` table:

```
+ tripId        UUID (FK -> trips, NOT NULL)
~ dayPatternId  UUID (FK -> day_patterns, NULLABLE)  -- was NOT NULL
```

- `tripId`: direct link to trip. Candidates have no dayPattern path to reach the trip, so this field is required. Also simplifies trip-level queries for all spots.
- Existing spots: backfill `tripId` from `dayPattern -> tripDay -> trip` in a migration.

## API Endpoints

### Candidate CRUD

```
GET    /api/trips/:tripId/candidates              -- list candidates
POST   /api/trips/:tripId/candidates              -- create candidate
PATCH  /api/trips/:tripId/candidates/:spotId      -- update candidate
DELETE /api/trips/:tripId/candidates/:spotId       -- delete candidate
PATCH  /api/trips/:tripId/candidates/reorder       -- reorder candidates
```

### Movement

```
POST   /api/trips/:tripId/candidates/:spotId/assign    -- candidate -> timeline
  body: { dayPatternId: string }

POST   /api/trips/:tripId/spots/:spotId/unassign        -- timeline -> candidate
```

### Auth

All endpoints require `requireAuth` + `checkTripAccess` (canEdit). Reuse existing trip membership verification.

### WebSocket

All operations broadcast to trip members:
- `candidate:created`, `candidate:updated`, `candidate:deleted`, `candidate:reordered`
- `spot:assigned`, `spot:unassigned`

## Frontend UI

### Layout

```
┌──────────────────────────────────────────────────┐
│  Trip header                                      │
├────────────────────────────────┬─────────────────┤
│  [Day1] [Day2] [Day3] ...     │  Candidates      │
│  Pattern switcher              │                  │
│                                │  [ Spot A ]      │
│  ┌ DayTimeline ──────────┐    │  [ Spot B ]      │
│  │ 09:00 Spot 1          │<-->│  [ Spot C ]      │
│  │ 12:00 Spot 2          │D&D │                  │
│  │ 15:00 Spot 3          │    │  [+ Add]         │
│  └───────────────────────┘    │                  │
├────────────────────────────────┴─────────────────┤
```

- Right side panel, always visible on desktop
- Mobile: collapsible panel with toggle button
- Candidate cards show name and category only (time and other details hidden)
- Drag & drop between timeline and candidate list (bidirectional)
- Drag & drop within candidate list for reordering

### Drag & Drop

Use the same DnD library as DayTimeline. Drop target detection:
- Drop on timeline -> call `assign` API (set sortOrder from drop position)
- Drop on candidate list -> call `unassign` API
- Drop within same area -> call `reorder` API

### Permissions

- viewer: read-only, no drag, no add/delete buttons
- editor/owner: full access

## Migration

1. Add `tripId` column to `spots` (nullable initially)
2. Backfill `tripId` from `dayPattern -> tripDay -> trip`
3. Set `tripId` to NOT NULL
4. Make `dayPatternId` nullable
5. Add index on `(tripId, dayPatternId)` for candidate queries
