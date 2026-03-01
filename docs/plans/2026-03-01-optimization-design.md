# Optimization Design

**Goal:** Improve code structure, performance, type safety, and UX across the sugara web app in four sequential phases.

---

## Phase 1: Code Structure

### 1a. EmptyState Component

Create `apps/web/components/ui/empty-state.tsx` with three variants matching existing inline patterns exactly — no visual change.

```tsx
<EmptyState message={MSG.EMPTY_SOUVENIR} variant="box" />     // border-dashed box
<EmptyState message={MSG.EMPTY_TRIP} variant="page" />         // mt-8 centered text
<EmptyState message={MSG.EMPTY_BOOKMARK_LIST} variant="inline" /> // py-8 centered
```

Affects ~15 files. Replace all inline empty state JSX with the component.

### 1b. Custom Hooks for Desktop/SP Logic Sharing

Extract shared page logic into `apps/web/lib/hooks/`. SP-specific logic (swipe, ActionSheet) stays in each file. UI files remain separate.

| Hook | Pages | Contents |
|---|---|---|
| `use-home-trips.ts` | home × 2 | trips queries, tab state, filter, selection, CRUD |
| `use-bookmark-lists.ts` | bookmarks × 2 | list query, filter, selection, CRUD |
| `use-friends-page.ts` | friends × 2 | friends/groups queries, tab state |

### 1c. Type Deduplication

Move `ExpensesResponse`, `Settlement`, and `Transfer` from `expense-panel.tsx` and `export/page.tsx` into `packages/shared/src/types.ts`. Remove both local definitions.

---

## Phase 2: Performance

### 2a. Large File Splitting

| File | Lines | Strategy |
|---|---|---|
| `trips/[id]/page.tsx` | 1082 | Extract per-tab components (`ScheduleTab`, `PollTab`, etc.) into `_components/` |
| `schedule-item.tsx` | 957 | Split by schedule type (`HotelItem`, `TransportItem`, etc.) |
| `candidate-panel.tsx` | 846 | Extract `CandidateList` and `CandidateItem` |

### 2b. React.memo

Apply `memo` to pure display leaf components only:

- `EmptyState` (created in Phase 1)
- Split sub-components from Phase 2a (`HotelItem`, `TransportItem`, etc.)

No additional `useMemo`/`useCallback` — TanStack Query cache is sufficient.

---

## Phase 3: Type Safety

### 3a. Move Local Types to Shared

| Type | Current Location | Notes |
|---|---|---|
| `Notification` | `notification-bell.tsx` | `NotificationType` exists in shared; Response type does not |
| `SharedTripResponse` | `shared-trip-client.tsx` | Subset of `TripResponse`; can be added to shared |
| `LogsResponse` | `activity-log.tsx` | Pagination wrapper |

Add all to `packages/shared/src/types.ts`.

### 3b. Unify Duplicate Member Type

Replace local `Member` type in `expense-dialog.tsx` with shared `MemberResponse`. Fix `role: string` → `role: MemberRole`.

```ts
// Before (local)
type Member = { userId: string; name: string; role: string; image: string | null };

// After: use MemberResponse from @sugara/shared
```

---

## Phase 4: UX

### 4a. Add Skeleton to Remaining Pages

Apply `useDelayedLoading` + Skeleton pattern (consistent with all other pages) to:

| File | Current | Skeleton Shape |
|---|---|---|
| `trips/[id]/print/page.tsx` | `<p>読み込み中...</p>` | Table rows |
| `trips/[id]/export/page.tsx` | `<p>読み込み中...</p>` | Sheet + column list |
| `admin/page.tsx` | `<p>読み込み中...</p>` | Simple rows |

### 4b. Segment-level error.tsx

Add `error.tsx` to authenticated and SP route segments to complement the root-level handler:

```
app/(authenticated)/error.tsx
app/(sp)/error.tsx
```

Content: error message + retry button, styled consistently with the existing root `app/error.tsx`.

### 4c. Normalize Loading Pattern in Trip Pages

Remove duplicate `isLoading` checks in `trips/[id]/page.tsx` and `sp/trips/[id]/page.tsx`. Align with the single `useDelayedLoading` pattern used across all other pages.
