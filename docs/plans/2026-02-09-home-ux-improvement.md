# Home UX Improvement Design

## Overview

Enhance the dashboard (home page) with search, status filter, sort, and bulk delete via selection mode. All filtering/sorting is client-side. No API changes required.

## Layout

```
[Home]                                    [New Trip]
[Search...] [All|Draft|Planned|Active|Completed] [Sort ▼] [Select]
[Card] [Card] [Card]
[Card] [Card]
```

### Toolbar (1 row below header)

- Left: Search input (instant filter on title + destination)
- Center: Status filter toggle group (single select, "All" default)
- Right: Sort select (updatedAt / createdAt / startDate, asc/desc toggle) + "Select" button

### Selection Mode

Activated by the "Select" button. Toolbar switches to:

```
[3 selected] [Select All] [Deselect] [Delete] [Cancel]
```

- Checkboxes appear on each card (top-left)
- Card click toggles selection instead of navigation
- "New Trip" button hidden during selection mode
- Filter/sort remain operable (filter then bulk delete)
- AlertDialog confirms before deletion
- Uses existing `DELETE /api/trips/:id` per trip via `Promise.allSettled`
- Partial failures reported via toast

## Components

### dashboard/page.tsx (modified)

State management:
- `trips` - raw data from API
- `search` - search query string
- `statusFilter` - "all" | TripStatus
- `sortKey` - "updatedAt" | "createdAt" | "startDate"
- `sortOrder` - "asc" | "desc"
- `selectionMode` - boolean
- `selectedIds` - Set<string>
- `filteredTrips` - derived via `useMemo` (filter + sort)

### trip-toolbar.tsx (new)

Props:
- search, onSearchChange
- statusFilter, onStatusFilterChange
- sortKey, onSortKeyChange
- sortOrder, onSortOrderChange
- selectionMode, onSelectionModeChange
- selectedCount, totalCount
- onSelectAll, onDeselectAll, onDeleteSelected

Renders normal toolbar or selection action bar based on `selectionMode`.

### trip-card.tsx (modified)

Additional props:
- `selectable: boolean` - whether selection mode is active
- `selected: boolean` - whether this card is selected
- `onSelect: (id: string) => void` - toggle selection callback

When `selectable`:
- Show checkbox in top-left corner
- Click toggles selection instead of navigating
- Selected state shown with ring/highlight

## File Changes

| File | Change |
|------|--------|
| `apps/web/app/(authenticated)/dashboard/page.tsx` | Add filter/sort/search/selection state |
| `apps/web/components/trip-toolbar.tsx` | New: toolbar UI |
| `apps/web/components/trip-card.tsx` | Add selection mode support |

## Constraints

- Client-side only (no API changes)
- Trip count is small enough for client filtering
- Owner-only delete enforced by existing API (404 for non-owners)
