# Day Patterns Design

## Overview

Add condition-based plan branching at the day level. Each trip_day can have multiple "patterns" (e.g., "sunny", "rainy"), each with its own set of spots. Users switch between patterns via tabs.

## Data Model

### New table: `day_patterns`

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | PK |
| tripDayId | UUID | FK -> trip_days.id (cascade delete) |
| label | text | User-defined label (e.g., "sunny", "rainy") |
| isDefault | boolean | Default pattern shown on load |
| sortOrder | integer | Display order |
| createdAt | timestamp | Created at |

### Modified table: `spots`

- Replace `tripDayId` (FK -> trip_days) with `dayPatternId` (FK -> day_patterns)
- All other columns unchanged

### Relationship

```
trips (1) --< trip_days (N) --< day_patterns (N) --< spots (N)
```

### Migration strategy

1. Create `day_patterns` table
2. For each existing trip_day, insert a default pattern (label: "default", isDefault: true)
3. Add `dayPatternId` column to spots, populate from the new default patterns
4. Drop `tripDayId` column from spots

## API

### New endpoints (day_patterns CRUD)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/trips/:tripId/days/:dayId/patterns` | List patterns |
| POST | `/trips/:tripId/days/:dayId/patterns` | Create pattern |
| PATCH | `/trips/:tripId/days/:dayId/patterns/:patternId` | Update label/order |
| DELETE | `/trips/:tripId/days/:dayId/patterns/:patternId` | Delete (default cannot be deleted) |
| POST | `/trips/:tripId/days/:dayId/patterns/:patternId/duplicate` | Duplicate with spots |

### Modified endpoints (spots)

URL path changes:
```
Old: /trips/:tripId/days/:dayId/spots
New: /trips/:tripId/days/:dayId/patterns/:patternId/spots

Old: /trips/:tripId/days/:dayId/spots/:spotId
New: /trips/:tripId/days/:dayId/patterns/:patternId/spots/:spotId

Old: /trips/:tripId/days/:dayId/spots/reorder
New: /trips/:tripId/days/:dayId/patterns/:patternId/spots/reorder
```

### Response types

```typescript
DayPatternResponse {
  id: string
  label: string
  isDefault: boolean
  sortOrder: number
  spots: SpotResponse[]
}

DayResponse {
  id: string
  dayNumber: number
  date: string
  memo: string | null
  patterns: DayPatternResponse[]  // replaces spots: SpotResponse[]
}
```

### Authorization

Existing trip_members roles apply to patterns (editor+ for CRUD).

## UI

### Trip detail page

```
[Day 1] [Day 2] [Day 3]        <- Day tabs (unchanged)
----------------------------
[Sunny] [Rainy] [+ Add]        <- Pattern tabs (shown only when 2+ patterns exist)
----------------------------
SpotList (selected pattern's spots)
```

- Days with only one pattern: no pattern tabs shown (existing UI preserved)
- Days with 2+ patterns: pattern tabs appear below day tabs
- "+ Add" button: creates empty pattern with user-specified label
- Long press / right click on pattern tab: "Duplicate", "Rename", "Delete" menu
- Duplicate copies all spots from the source pattern
- Default pattern cannot be deleted

### Shared view

All patterns visible with tab switching (same as authenticated view, but read-only).

## Schemas (packages/shared)

### New schemas

```typescript
// day-pattern.ts
createDayPatternSchema: { label: string }
updateDayPatternSchema: { label?: string, isDefault?: boolean, sortOrder?: number }
```

### Modified schemas

No changes to existing spot schemas (they remain the same, just the API path changes).

## Scope

### In scope
- day_patterns CRUD (API + UI)
- Pattern tab switching in trip detail page
- Pattern duplication (with spots)
- Migration of existing data
- Shared view support

### Out of scope
- Spot-level alternatives within a pattern (use separate patterns instead)
- Automatic pattern selection based on conditions (manual tab switch only)
- Pattern comparison side-by-side view
