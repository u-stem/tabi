# Loading UX Unification Design

**Goal:** Eliminate behavioral inconsistencies in loading states and transitions across the entire app.

---

## Background

The app has accumulated several loading/skeleton inconsistencies:

- `BookmarkListCard` uses `isLoading && <Skeleton>` directly, without `useDelayedLoading`, causing flash on fast loads.
- Skeleton → Content transition is instantaneous (no animation). Only tab switches have a 150ms fade-in.
- `staleTime` is globally set to 30s; `gcTime` is never configured explicitly.
- When `isLoading && !showSkeleton`, pages return `<div />` (height 0), causing layout shifts.
- 23 files repeat the same `useDelayedLoading + Skeleton` boilerplate manually.

Research data: A 150ms fade-in between skeleton and content reduces perceived load time by 33% and improves CLS score by 92%.

---

## Approach: LoadingBoundary Component

Consolidate `useDelayedLoading + Skeleton + fade transition` into a single `<LoadingBoundary>` component. All pages migrate to this component.

This replaces the per-page pattern:
```tsx
// Before (repeated in 23 files)
const showSkeleton = useDelayedLoading(isLoading);
if (isLoading && !showSkeleton) return <div />;
if (showSkeleton) return <MySkeleton />;
```

With:
```tsx
// After
<LoadingBoundary isLoading={isLoading} skeleton={<MySkeleton />}>
  <Content data={data} />
</LoadingBoundary>
```

---

## Component Design

### `<LoadingBoundary>`

**Location:** `apps/web/components/ui/loading-boundary.tsx`

```tsx
interface LoadingBoundaryProps {
  isLoading: boolean;
  skeleton: React.ReactNode;
  error?: Error | null;
  errorFallback?: React.ReactNode;
  children: React.ReactNode;
  delay?: number; // default 200ms
}
```

**State machine:**

| Condition | Output |
|---|---|
| `isLoading && !showSkeleton` | `null` (fast load, no flicker) |
| `showSkeleton` | `skeleton` prop |
| `error` | `errorFallback` or default error UI |
| Otherwise | `children` wrapped in `animate-in fade-in duration-150` |

**Implementation notes:**
- Encapsulates `useDelayedLoading` internally.
- Content always fades in when first rendered (covers both slow and fast load paths).
- Does NOT fade out the skeleton — fade-in on content only. Reason: skeleton fade-out requires `position: absolute` overlap and adds complexity without meaningful UX gain.
- Returns `null` (not `<div />`) during the pre-skeleton phase to avoid height-0 layout shifts.

---

## Animation Strategy

Uses `tailwindcss-animate` (already installed via shadcn/ui).

| Transition | Animation | Duration |
|---|---|---|
| Skeleton → Content | `animate-in fade-in` | 150ms |
| null → Content (fast load) | same | 150ms |
| Skeleton → EmptyState | same (EmptyState is children) | 150ms |
| Tab switch | unchanged (`tab-fade-in`) | 150ms |

No new animation libraries required.

---

## Cache Strategy

**Location:** `apps/web/lib/query-config.ts`

```ts
export const QUERY_CONFIG = {
  // Trips, schedules, polls, bookmarks — data that changes with user actions
  dynamic: { staleTime: 15_000, gcTime: 60_000 },
  // Profile, friends, notification settings — changes infrequently
  stable: { staleTime: 60_000, gcTime: 5 * 60_000 },
  // FAQs, announcements — rarely changes
  static: { staleTime: 5 * 60_000, gcTime: 30 * 60_000 },
} as const;
```

**Global default** in `query-client.ts`: `dynamic` values.

**Per-query overrides:**
- Trips, trip days, schedules, polls, candidates: `dynamic`
- User profile, friends, groups, notification preferences: `stable`
- FAQ, announcements: `static`
- Bookmark lists: `stable` (was inconsistently set to 60s in one place)

---

## Migration Scope

### Phase 1: Foundation

1. Create `apps/web/lib/query-config.ts`
2. Update `apps/web/lib/query-client.ts` to use `dynamic` as default
3. Create `apps/web/components/ui/loading-boundary.tsx`

### Phase 2: Page Migration

Migrate all 23 files currently using `useDelayedLoading` to `<LoadingBoundary>`. Apply `QUERY_CONFIG` to individual queries.

Files grouped by complexity:

**Simple (single query, straightforward skeleton):**
- `admin/page.tsx`
- `trips/[id]/export/page.tsx`
- `trips/[id]/print/page.tsx`
- `polls/shared/[token]/page.tsx`
- `app/users/[userId]/page.tsx`

**Medium (multiple queries or existing skeleton complexity):**
- `home/page.tsx`
- `my/page.tsx`
- `bookmarks/[listId]/page.tsx`
- `friends/page.tsx`
- `app/shared/[token]/_components/shared-trip-client.tsx`

**Complex (combined loading states, panel components):**
- `trips/[id]/page.tsx` (trip + poll)
- `components/souvenir-panel.tsx`
- `components/bookmark-panel.tsx`
- `components/expense-panel.tsx`
- `components/member-dialog.tsx`
- `components/activity-log.tsx`

### Phase 3: Skeleton Shape Audit

After migration, review each skeleton against the actual UI. Fix mismatches where skeleton dimensions or layout diverge from real content. Focus on:
- `trips/[id]/page.tsx` — large, complex skeleton; verify against all tabs
- `home/page.tsx` — card grid skeleton
- `friends/page.tsx` — list skeleton

### Also Fixed (as side effect of LoadingBoundary migration)

- `BookmarkListCard` (`useDelayedLoading` missing) → fixed by adopting `LoadingBoundary`
- All `return <div />` patterns → replaced by `return null` inside `LoadingBoundary`

---

## Non-Goals

- Skeleton fade-out (content fade-in is sufficient per research)
- React Suspense migration (too much risk for current benefit)
- Shared skeleton primitives (each page keeps its own skeleton; forced sharing causes over-engineering)
- Infinite scroll next-page loading indicator (out of scope for this iteration)

---

## Success Criteria

- All pages use `<LoadingBoundary>` — no manual `useDelayedLoading` calls outside the component
- Content always fades in (no instant pop-in)
- No `return <div />` anywhere for loading states
- `QUERY_CONFIG` applied to all queries — no ad-hoc `staleTime` values
- No regressions in existing functionality or tests
