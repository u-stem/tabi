# Loading UX Unification Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate loading/skeleton behavioral inconsistencies by introducing `<LoadingBoundary>` and a unified cache strategy.

**Architecture:** `LoadingBoundary` encapsulates delay logic, skeleton display, and 150ms fade-in animation. Custom hooks (`use-home-trips`, `use-bookmark-lists`, `use-friends-page`) stop exporting `showSkeleton` since that responsibility moves to `LoadingBoundary`. Cache strategy is centralized in `query-config.ts`.

**Tech Stack:** React 19, TanStack Query, Tailwind CSS + `tailwindcss-animate` (already installed via shadcn/ui), Vitest, @testing-library/react

---

## Task 1: Create query-config.ts

**Files:**
- Create: `apps/web/lib/query-config.ts`

**Step 1: Create the file**

```ts
// Centralized cache configuration for TanStack Query.
// dynamic: trips, schedules, polls — changes with user actions
// stable:  profile, friends, notification settings — changes infrequently
// static:  FAQs, announcements — rarely changes
export const QUERY_CONFIG = {
  dynamic: { staleTime: 15_000, gcTime: 60_000 },
  stable: { staleTime: 60_000, gcTime: 5 * 60_000 },
  static: { staleTime: 5 * 60_000, gcTime: 30 * 60_000 },
} as const;
```

**Step 2: Run type check**

```bash
bun run check-types
```

Expected: no errors

**Step 3: Commit**

```bash
git add apps/web/lib/query-config.ts
git commit -m "feat: キャッシュ設定定数を追加"
```

---

## Task 2: Update query-client.ts defaults

**Files:**
- Modify: `apps/web/lib/query-client.ts`

Current file has `staleTime: 30 * 1000` and no `gcTime`. Change to:

```ts
import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import { QUERY_CONFIG } from "@/lib/query-config";

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: QUERY_CONFIG.dynamic.staleTime,
        gcTime: QUERY_CONFIG.dynamic.gcTime,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          // Never retry on 401 (session expired)
          if (error instanceof ApiError && error.status === 401) return false;
          return failureCount < 3;
        },
      },
    },
  });
}
```

**Step: Run type check**

```bash
bun run check-types
```

**Step: Commit**

```bash
git add apps/web/lib/query-client.ts
git commit -m "feat: QueryClientのデフォルトをQUERY_CONFIGに統一"
```

---

## Task 3: Create LoadingBoundary component

**Files:**
- Create: `apps/web/components/ui/loading-boundary.test.tsx`
- Create: `apps/web/components/ui/loading-boundary.tsx`

**Step 1: Write the failing tests**

```tsx
// apps/web/components/ui/loading-boundary.test.tsx
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LoadingBoundary } from "./loading-boundary";

describe("LoadingBoundary", () => {
  afterEach(cleanup);

  it("renders nothing during fast load (before 200ms delay)", () => {
    vi.useFakeTimers();
    const { container } = render(
      <LoadingBoundary isLoading skeleton={<div>skeleton</div>}>
        <div>content</div>
      </LoadingBoundary>,
    );
    expect(container.firstChild).toBeNull();
    vi.useRealTimers();
  });

  it("renders skeleton after 200ms delay elapses", async () => {
    vi.useFakeTimers();
    render(
      <LoadingBoundary isLoading skeleton={<div>skeleton</div>}>
        <div>content</div>
      </LoadingBoundary>,
    );
    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.getByText("skeleton")).toBeDefined();
    vi.useRealTimers();
  });

  it("renders children when not loading", () => {
    render(
      <LoadingBoundary isLoading={false} skeleton={<div>skeleton</div>}>
        <div>content</div>
      </LoadingBoundary>,
    );
    expect(screen.getByText("content")).toBeDefined();
    expect(screen.queryByText("skeleton")).toBeNull();
  });

  it("renders errorFallback when error is provided and not loading", () => {
    render(
      <LoadingBoundary
        isLoading={false}
        skeleton={<div>skeleton</div>}
        error={new Error("fail")}
        errorFallback={<div>error ui</div>}
      >
        <div>content</div>
      </LoadingBoundary>,
    );
    expect(screen.getByText("error ui")).toBeDefined();
    expect(screen.queryByText("content")).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
bun run --filter @sugara/web test components/ui/loading-boundary.test.tsx
```

Expected: FAIL with module not found error

**Step 3: Implement LoadingBoundary**

```tsx
// apps/web/components/ui/loading-boundary.tsx
"use client";

import type { ReactNode } from "react";
import { useDelayedLoading } from "@/lib/hooks/use-delayed-loading";
import { cn } from "@/lib/utils";

interface LoadingBoundaryProps {
  isLoading: boolean;
  skeleton: ReactNode;
  error?: Error | null;
  errorFallback?: ReactNode;
  children: ReactNode;
  // Forwarded to the wrapper div around children — use when the parent
  // is a flex/grid container and the wrapper needs specific sizing (e.g. "h-full").
  className?: string;
  delay?: number;
}

export function LoadingBoundary({
  isLoading,
  skeleton,
  error,
  errorFallback,
  children,
  className,
  delay = 200,
}: LoadingBoundaryProps) {
  const showSkeleton = useDelayedLoading(isLoading, delay);

  if (isLoading && !showSkeleton) return null;
  if (showSkeleton) return <>{skeleton}</>;
  if (error) return errorFallback ? <>{errorFallback}</> : null;

  return (
    <div className={cn("animate-in fade-in duration-150", className)}>
      {children}
    </div>
  );
}
```

**Step 4: Run tests to verify they pass**

```bash
bun run --filter @sugara/web test components/ui/loading-boundary.test.tsx
```

Expected: 4 tests PASS

**Step 5: Verify `animate-in` class is available**

Check `apps/web/tailwind.config.ts` (or `globals.css`) — `tailwindcss-animate` plugin must be present. If it is, `animate-in fade-in duration-150` will work. shadcn/ui depends on it, so it should already be there.

**Step 6: Run type check and lint**

```bash
bun run check-types && bun run --filter @sugara/web check
```

**Step 7: Commit**

```bash
git add apps/web/components/ui/loading-boundary.tsx apps/web/components/ui/loading-boundary.test.tsx
git commit -m "feat: LoadingBoundaryコンポーネントを追加"
```

---

## Task 4: Migrate use-home-trips hook

**Files:**
- Modify: `apps/web/lib/hooks/use-home-trips.ts`
- Modify: `apps/web/app/(authenticated)/home/page.tsx`
- Modify: `apps/web/app/(sp)/home/page.tsx` (if it uses useHomeTrips)

**Context:** `use-home-trips.ts` currently calls `useDelayedLoading` internally and returns `showSkeleton`. With `LoadingBoundary`, the hook should only return `isLoading`. The pages handle the skeleton display.

**Step 1: Remove showSkeleton from use-home-trips.ts**

In `apps/web/lib/hooks/use-home-trips.ts`:
1. Remove `import { useDelayedLoading }` line
2. Remove `showSkeleton: boolean` from `UseHomeTripsReturn` type
3. Remove `const showSkeleton = useDelayedLoading(isLoading)` line
4. Remove `showSkeleton` from the returned object

**Step 2: Update home/page.tsx**

Find the skeleton JSX that was returned when `showSkeleton` was true. Extract it into a local variable (or inline it).

In `apps/web/app/(authenticated)/home/page.tsx`:
1. Remove `showSkeleton` from the destructured hook return
2. Remove `if (isLoading && !showSkeleton) return <div />`
3. Remove `if (showSkeleton) return <SkeletonJSX />`
4. Wrap the page return in `<LoadingBoundary isLoading={isLoading} skeleton={<HomeSkeleton />}>`

The skeleton JSX (previously returned early) becomes:

```tsx
function HomeSkeleton() {
  return (
    // copy the skeleton JSX that was previously in the early return
  );
}
```

Place `HomeSkeleton` above the page component. Then:

```tsx
import { LoadingBoundary } from "@/components/ui/loading-boundary";

export default function HomePage() {
  const { isLoading, error, ... } = useHomeTrips(); // removed showSkeleton

  // ... hotkeys, etc.

  return (
    <LoadingBoundary isLoading={isLoading} skeleton={<HomeSkeleton />}>
      {/* existing page content */}
    </LoadingBoundary>
  );
}
```

**Step 3: Check SP home page**

Open `apps/web/app/(sp)/home/page.tsx`. If it also uses `useHomeTrips` and reads `showSkeleton`, apply the same change. If it uses its own loading pattern, migrate separately (see Task 7).

**Step 4: Run type check**

```bash
bun run check-types
```

Expected: no errors related to `showSkeleton`

**Step 5: Run tests**

```bash
bun run test
```

**Step 6: Commit**

```bash
git add apps/web/lib/hooks/use-home-trips.ts apps/web/app/(authenticated)/home/page.tsx
git commit -m "refactor: ホームページをLoadingBoundaryに移行"
```

---

## Task 5: Migrate use-bookmark-lists and bookmarks page

**Files:**
- Modify: `apps/web/lib/hooks/use-bookmark-lists.ts`
- Modify: `apps/web/app/(authenticated)/bookmarks/[listId]/page.tsx`
- Modify: SP bookmarks page if applicable

Same pattern as Task 4:
1. Remove `useDelayedLoading` + `showSkeleton` from `use-bookmark-lists.ts`
2. Extract skeleton JSX into `BookmarksSkeleton` function above page component
3. Wrap page content in `<LoadingBoundary isLoading={isLoading} skeleton={<BookmarksSkeleton />}>`

**Step: Run type check + commit**

```bash
bun run check-types
git add apps/web/lib/hooks/use-bookmark-lists.ts apps/web/app/(authenticated)/bookmarks/
git commit -m "refactor: ブックマークページをLoadingBoundaryに移行"
```

---

## Task 6: Migrate use-friends-page and friends page

**Files:**
- Modify: `apps/web/lib/hooks/use-friends-page.ts`
- Modify: `apps/web/app/(authenticated)/friends/page.tsx`
- Modify: SP friends page if applicable

Same pattern as Task 4.

**Step: Run type check + commit**

```bash
bun run check-types
git add apps/web/lib/hooks/use-friends-page.ts apps/web/app/(authenticated)/friends/
git commit -m "refactor: フレンドページをLoadingBoundaryに移行"
```

---

## Task 7: Migrate simple pages

These pages call `useDelayedLoading` directly. Migration pattern for each:

**Remove:**
```tsx
import { useDelayedLoading } from "@/lib/hooks/use-delayed-loading";
// ...
const showSkeleton = useDelayedLoading(isLoading);
if (isLoading && !showSkeleton) return <div />;
if (showSkeleton) return <PageSkeleton />;
```

**Add:**
```tsx
import { LoadingBoundary } from "@/components/ui/loading-boundary";
// ...
// Extract skeleton JSX into a function above the page component:
function PageSkeleton() { return ...; }

// Wrap return in LoadingBoundary:
return (
  <LoadingBoundary isLoading={isLoading} skeleton={<PageSkeleton />}>
    {/* existing content */}
  </LoadingBoundary>
);
```

**Files to migrate:**

| File | Notes |
|---|---|
| `apps/web/app/admin/page.tsx` | Main skeleton wraps the Tabs. Users tab has its own inline skeleton (`usersData ? ... : <Skeleton/>`) — leave that as-is, it's not top-level loading |
| `apps/web/app/(authenticated)/trips/[id]/export/page.tsx` | Simple single-query page |
| `apps/web/app/(authenticated)/trips/[id]/print/page.tsx` | Simple single-query page |
| `apps/web/app/polls/shared/[token]/page.tsx` | Simple single-query page |
| `apps/web/app/users/[userId]/page.tsx` | Uses `ProfileSkeletonContent` function |

For `admin/page.tsx`, the content returned by `LoadingBoundary` is the full page including `<div className="min-h-screen">`. The error check for 403/401 must happen before `LoadingBoundary`, since `notFound()` must not be inside a component tree:

```tsx
// Keep these BEFORE LoadingBoundary:
if (error instanceof ApiError && (error.status === 403 || error.status === 401)) {
  notFound();
}

return (
  <LoadingBoundary isLoading={isLoading} skeleton={<AdminSkeleton />}>
    <div className="min-h-screen">
      {/* ... */}
    </div>
  </LoadingBoundary>
);
```

**Step: Run type check after all 5 files**

```bash
bun run check-types
```

**Step: Commit**

```bash
git add apps/web/app/admin/page.tsx \
  "apps/web/app/(authenticated)/trips/[id]/export/page.tsx" \
  "apps/web/app/(authenticated)/trips/[id]/print/page.tsx" \
  apps/web/app/polls/shared/ \
  apps/web/app/users/
git commit -m "refactor: シンプルなページをLoadingBoundaryに移行"
```

---

## Task 8: Migrate medium pages

**Files:**
- `apps/web/app/(authenticated)/my/page.tsx`
- `apps/web/app/shared/[token]/_components/shared-trip-client.tsx`

Same pattern as Task 7. For `my/page.tsx`, there may be multiple loading states (profile + bookmark lists). If they're combined into one `isLoading`, the pattern is:

```tsx
const isLoading = profileLoading || bookmarkLoading;
// ...
<LoadingBoundary isLoading={isLoading} skeleton={<MySkeleton />}>
  {/* content */}
</LoadingBoundary>
```

**Step: Run type check + tests**

```bash
bun run check-types && bun run test
```

**Step: Commit**

```bash
git add "apps/web/app/(authenticated)/my/" apps/web/app/shared/
git commit -m "refactor: MyページとSharedページをLoadingBoundaryに移行"
```

---

## Task 9: Migrate panel components

Panel components live inside the right-side panel or dialog. They may be flex children, so pass `className` to `LoadingBoundary` when needed.

**Files:**
- `apps/web/components/souvenir-panel.tsx`
- `apps/web/components/bookmark-panel.tsx`
- `apps/web/components/expense-panel.tsx`
- `apps/web/components/member-dialog.tsx`
- `apps/web/components/activity-log.tsx`

**Same pattern** as Task 7, but note that panel content root divs often have `h-full` or `flex flex-col`. Pass those classes to `LoadingBoundary`:

```tsx
// If the panel's content is:
return (
  <div className="flex flex-col h-full overflow-hidden">
    {/* ... */}
  </div>
);

// Then with LoadingBoundary, pass className to match:
return (
  <LoadingBoundary
    isLoading={isLoading}
    skeleton={<PanelSkeleton />}
    className="flex flex-col h-full overflow-hidden"
  >
    <div className="flex flex-col h-full overflow-hidden">
      {/* ... */}
    </div>
  </LoadingBoundary>
);
```

Wait — this duplicates the class. Instead, keep the outer div on the children and only pass `className` if the panel itself IS the flex child. Inspect the parent to determine if this is needed.

For `activity-log.tsx`: it uses `useInfiniteQuery`. The top-level `isLoading` (initial load) maps to `LoadingBoundary`. The `isFetchingNextPage` (pagination) stays separate and should show a bottom spinner — leave that for now as it is out of scope.

**Step: Run type check**

```bash
bun run check-types
```

**Step: Commit**

```bash
git add apps/web/components/souvenir-panel.tsx \
  apps/web/components/bookmark-panel.tsx \
  apps/web/components/expense-panel.tsx \
  apps/web/components/member-dialog.tsx \
  apps/web/components/activity-log.tsx
git commit -m "refactor: パネルコンポーネントをLoadingBoundaryに移行"
```

---

## Task 10: Migrate trips/[id]/page.tsx (complex)

**File:** `apps/web/app/(authenticated)/trips/[id]/page.tsx`

This is the most complex page (1082 lines). It has:
- Combined loading: `const showSkeleton = useDelayedLoading(isLoading || (!!pollId && isPollLoading))`
- Two separate queries (trip + poll)
- Large skeleton JSX (lines 538–646)

**Step 1: Extract skeleton JSX into a function**

Move the skeleton JSX (currently in the early return) into a named function above the page component:

```tsx
function TripDetailSkeleton() {
  return (
    // the large skeleton JSX from lines 538-646
  );
}
```

**Step 2: Compute combined isLoading**

```tsx
const combinedLoading = isLoading || (!!pollId && isPollLoading);
```

**Step 3: Wrap content in LoadingBoundary**

Remove `useDelayedLoading` call and early returns. Add:

```tsx
return (
  <LoadingBoundary isLoading={combinedLoading} skeleton={<TripDetailSkeleton />}>
    {/* existing content — currently inside `return (...)` */}
  </LoadingBoundary>
);
```

**Step 4: Run type check**

```bash
bun run check-types
```

**Step 5: Commit**

```bash
git add "apps/web/app/(authenticated)/trips/"
git commit -m "refactor: 旅行詳細ページをLoadingBoundaryに移行"
```

---

## Task 11: Apply QUERY_CONFIG to individual queries

Now that all pages are migrated, apply explicit cache configs to queries that need non-default settings.

**Search for all useQuery/useInfiniteQuery calls:**

```bash
grep -r "staleTime" apps/web/app apps/web/components apps/web/lib
```

**Apply QUERY_CONFIG by data category:**

| Data | Config | File examples |
|---|---|---|
| Trips, schedules, polls, candidates, souvenirs, expenses | `...QUERY_CONFIG.dynamic` | `trips/[id]/page.tsx`, home, panels |
| Profile, friends, groups, notification prefs, members | `...QUERY_CONFIG.stable` | `users/[userId]/page.tsx`, `friends/page.tsx`, `my/page.tsx` |
| FAQs, announcements | `...QUERY_CONFIG.static` | `faq/`, admin announcement |
| Admin stats | Keep existing `5 * 60 * 1000` or use `QUERY_CONFIG.static` | `admin/page.tsx` |
| Bookmark lists (was 60s) | `...QUERY_CONFIG.stable` | `trips/[id]/page.tsx` line 128 |

**Pattern for each query:**

```tsx
// Before
const { data } = useQuery({
  queryKey: queryKeys.trips.detail(id),
  queryFn: () => api<TripResponse>(`/api/trips/${id}`),
});

// After
import { QUERY_CONFIG } from "@/lib/query-config";

const { data } = useQuery({
  queryKey: queryKeys.trips.detail(id),
  queryFn: () => api<TripResponse>(`/api/trips/${id}`),
  ...QUERY_CONFIG.dynamic,
});
```

**Step: Run type check**

```bash
bun run check-types
```

**Step: Run all tests**

```bash
bun run test
```

**Step: Commit**

```bash
git add -p  # stage all modified query files
git commit -m "feat: 全クエリにQUERY_CONFIGキャッシュ設定を適用"
```

---

## Task 12: Verify useDelayedLoading is no longer used outside LoadingBoundary

After all migrations, `useDelayedLoading` should only be called from inside `loading-boundary.tsx`.

**Step: Verify**

```bash
grep -r "useDelayedLoading" apps/web --include="*.tsx" --include="*.ts" -l
```

Expected output: only `loading-boundary.tsx` and `use-delayed-loading.ts` (the definition).

If any other files still import `useDelayedLoading`, migrate them.

**Step: Run full test suite**

```bash
bun run test
```

**Step: Run type check and lint**

```bash
bun run check-types && bun run check
```

Expected: no errors

**Step: Commit (if any final fixes)**

```bash
git commit -m "refactor: useDelayedLoadingの直接使用をすべてLoadingBoundaryに置き換え"
```

---

## Task 13: Skeleton shape audit

After migration, visually inspect each page's skeleton against the actual UI. Open the app in dev mode:

```bash
bun run --filter @sugara/web dev
```

Use browser DevTools to throttle network to "Slow 3G" and check each page:

- [ ] Home — card grid skeleton matches actual TripCard dimensions
- [ ] Trips detail — skeleton matches tab headers + timeline layout
- [ ] Friends — list skeleton matches FriendCard height
- [ ] My page — profile header skeleton matches avatar + name layout
- [ ] Bookmarks — list skeleton matches BookmarkCard dimensions
- [ ] Admin — row skeletons match StatCard height
- [ ] Users profile — skeleton matches profile layout
- [ ] Panels (souvenir, bookmark, expense) — skeleton fills panel correctly

For each mismatch: adjust the skeleton's `className` values (`h-`, `w-`, `rounded-`) to match the actual element dimensions.

**Commit per page:**

```bash
git commit -m "fix: <page>のスケルトン形状を実UIに合わせて修正"
```

---

## Completion Checklist

- [ ] `LoadingBoundary` has tests covering all 4 behaviors
- [ ] `grep -r "useDelayedLoading"` returns only `use-delayed-loading.ts` and `loading-boundary.tsx`
- [ ] `grep -r "return <div />"` returns no loading-state empty divs
- [ ] `QUERY_CONFIG` applied to all queries
- [ ] `bun run test` passes
- [ ] `bun run check-types` passes
- [ ] `bun run check` passes
- [ ] Visual smoke test on all pages with Slow 3G throttling confirms no skeleton flash
