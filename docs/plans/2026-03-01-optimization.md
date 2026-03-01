# Optimization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve code structure, performance, type safety, and UX across the sugara web app in four sequential phases.

**Architecture:** Phase 1 (code structure) establishes shared primitives; later phases build on them. Each phase is independently verifiable with type-check + tests. UI files for desktop and SP are never merged — only shared logic is extracted.

**Tech Stack:** TypeScript, Next.js 15 (App Router), React 19, TanStack Query, Vitest, Biome

---

## Phase 1a: EmptyState Component

**Files:**
- Create: `apps/web/components/ui/empty-state.tsx`
- Modify: `apps/web/components/souvenir-panel.tsx`
- Modify: `apps/web/components/candidate-panel.tsx` (non-DnD branch only)
- Modify: `apps/web/app/(authenticated)/home/page.tsx`
- Modify: `apps/web/app/(sp)/sp/home/page.tsx`
- Modify: `apps/web/app/(authenticated)/bookmarks/page.tsx`
- Modify: `apps/web/app/(sp)/sp/bookmarks/page.tsx`
- Modify: `apps/web/app/(authenticated)/bookmarks/[listId]/page.tsx`
- Modify: `apps/web/app/(sp)/sp/bookmarks/[listId]/page.tsx`
- Modify: `apps/web/components/bookmark-panel.tsx` (lists section only)

### Step 1: Create EmptyState component

Create `apps/web/components/ui/empty-state.tsx`:

```tsx
import { memo } from "react";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  message: string;
  variant: "box" | "page" | "inline";
  className?: string;
};

export const EmptyState = memo(function EmptyState({
  message,
  variant,
  className,
}: EmptyStateProps) {
  if (variant === "box") {
    return (
      <div
        className={cn(
          "flex min-h-24 items-center justify-center rounded-md border border-dashed text-center",
          className,
        )}
      >
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    );
  }
  if (variant === "page") {
    return (
      <p className={cn("mt-8 text-center text-muted-foreground", className)}>
        {message}
      </p>
    );
  }
  return (
    <div className={cn("py-8 text-center", className)}>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
});
```

### Step 2: Run type-check to verify

```bash
bun run check-types
```

Expected: no errors.

### Step 3: Replace inline patterns — variant="box" files

In `apps/web/components/souvenir-panel.tsx` (line ~257):

```tsx
// Before:
<div className="flex min-h-24 items-center justify-center rounded-md border border-dashed text-center">
  <p className="text-sm text-muted-foreground">{MSG.EMPTY_SOUVENIR}</p>
</div>

// After:
<EmptyState message={MSG.EMPTY_SOUVENIR} variant="box" />
```

In `apps/web/components/candidate-panel.tsx` (line ~749, the non-DnD branch only — leave the `cn()` + `DROP_ZONE_ACTIVE` branch as-is):

```tsx
// Before:
<div className="flex min-h-24 items-center justify-center rounded-md border border-dashed text-center">
  <p className="text-sm text-muted-foreground">{MSG.EMPTY_CANDIDATE}</p>
</div>

// After:
<EmptyState message={MSG.EMPTY_CANDIDATE} variant="box" />
```

Add import to both files: `import { EmptyState } from "@/components/ui/empty-state";`

### Step 4: Replace inline patterns — variant="page" files

In each of the following, replace `<p className="mt-8 text-center text-muted-foreground">…</p>` with `<EmptyState message={…} variant="page" />`:

- `apps/web/app/(authenticated)/home/page.tsx` (2 occurrences: EMPTY_TRIP_SHARED/EMPTY_TRIP and EMPTY_TRIP_FILTER)
- `apps/web/app/(sp)/sp/home/page.tsx` (same 2 patterns)
- `apps/web/app/(authenticated)/bookmarks/page.tsx` (EMPTY_BOOKMARK_LIST and EMPTY_BOOKMARK_LIST_FILTER)
- `apps/web/app/(sp)/sp/bookmarks/page.tsx` (same)
- `apps/web/app/(authenticated)/bookmarks/[listId]/page.tsx` (EMPTY_BOOKMARK)
- `apps/web/app/(sp)/sp/bookmarks/[listId]/page.tsx` (EMPTY_BOOKMARK)

For home pages the two messages are inside a ternary — wrap accordingly:

```tsx
// Before:
{baseTrips.length === 0 ? (
  <p className="mt-8 text-center text-muted-foreground">
    {tab === "shared" ? MSG.EMPTY_TRIP_SHARED : MSG.EMPTY_TRIP}
  </p>
) : filteredTrips.length === 0 ? (
  <p className="mt-8 text-center text-muted-foreground">{MSG.EMPTY_TRIP_FILTER}</p>
) : (

// After:
{baseTrips.length === 0 ? (
  <EmptyState
    message={tab === "shared" ? MSG.EMPTY_TRIP_SHARED : MSG.EMPTY_TRIP}
    variant="page"
  />
) : filteredTrips.length === 0 ? (
  <EmptyState message={MSG.EMPTY_TRIP_FILTER} variant="page" />
) : (
```

Add `import { EmptyState } from "@/components/ui/empty-state";` to each file.

### Step 5: Replace inline patterns — variant="inline" files

In `apps/web/components/bookmark-panel.tsx` (lists empty branch, line ~127):

```tsx
// Before:
<div className="py-8 text-center">
  <p className="text-sm text-muted-foreground">{MSG.EMPTY_BOOKMARK_LIST}</p>
</div>

// After:
<EmptyState message={MSG.EMPTY_BOOKMARK_LIST} variant="inline" />
```

### Step 6: Run type-check

```bash
bun run check-types
```

Expected: no errors.

### Step 7: Run tests

```bash
bun run test
```

Expected: all tests pass (347 tests).

### Step 8: Commit

```bash
git add apps/web/components/ui/empty-state.tsx \
  apps/web/components/souvenir-panel.tsx \
  apps/web/components/candidate-panel.tsx \
  "apps/web/app/(authenticated)/home/page.tsx" \
  "apps/web/app/(sp)/sp/home/page.tsx" \
  "apps/web/app/(authenticated)/bookmarks/page.tsx" \
  "apps/web/app/(sp)/sp/bookmarks/page.tsx" \
  "apps/web/app/(authenticated)/bookmarks/[listId]/page.tsx" \
  "apps/web/app/(sp)/sp/bookmarks/[listId]/page.tsx" \
  apps/web/components/bookmark-panel.tsx
git commit -m "refactor: EmptyState コンポーネントを作成し inline パターンを統一"
```

---

## Phase 1b: Custom Hook — useHomeTrips

**Files:**
- Create: `apps/web/lib/hooks/use-home-trips.ts`
- Modify: `apps/web/app/(authenticated)/home/page.tsx`
- Modify: `apps/web/app/(sp)/sp/home/page.tsx`

### Step 1: Read source files before writing hook

Read `apps/web/app/(authenticated)/home/page.tsx` fully to understand all state, queries, and handlers. The hook must include:

- `useQuery` for `queryKeys.trips.owned()` and `queryKeys.trips.shared()`
- `useAuthRedirect(error)`
- `useDelayedLoading(isLoading)`
- All state: `tab`, `search`, `statusFilter`, `sortKey`, `selectionMode`, `selectedIds`, `deleting`, `duplicating`, `createTripOpen`
- `useMemo` for `baseTrips` and `filteredTrips`
- Handlers: `handleDelete`, `handleDuplicate`, `handleSelect`, `handleDeleteSelected`, `handleDuplicateSelected`

SP-specific items that stay in the SP file (do NOT include in hook):
- `tabRef`, `contentRef`, `swipeRef`, `useSwipeTab`
- `searchInputRef`, `useHotkeys`, `useShortcutHelp`, `useRegisterShortcuts` (desktop-only)

Return type should be an object with all the above. Name it `UseHomeTripsReturn`.

Create `apps/web/lib/hooks/use-home-trips.ts` exporting `useHomeTrips()`.

### Step 2: Run type-check

```bash
bun run check-types
```

Expected: no errors.

### Step 3: Refactor authenticated home page

In `apps/web/app/(authenticated)/home/page.tsx`, replace all shared state/query/handler code with:

```tsx
const {
  ownedTrips, sharedTrips, isLoading, showSkeleton, error,
  tab, setTab, search, setSearch, statusFilter, setStatusFilter,
  sortKey, setSortKey, selectionMode, setSelectionMode,
  selectedIds, handleSelect, deleting, duplicating,
  handleDelete, handleDuplicate, handleDeleteSelected, handleDuplicateSelected,
  createTripOpen, setCreateTripOpen, baseTrips, filteredTrips,
} = useHomeTrips();
```

Keep desktop-only hooks (`useHotkeys`, `useRegisterShortcuts`, `searchInputRef`) in the page file.

### Step 4: Refactor SP home page

Same replacement in `apps/web/app/(sp)/sp/home/page.tsx`. Keep `useSwipeTab`, `tabRef`, `contentRef`, `swipeRef` in the SP file.

### Step 5: Run type-check and tests

```bash
bun run check-types && bun run test
```

Expected: no errors, all tests pass.

### Step 6: Commit

```bash
git add apps/web/lib/hooks/use-home-trips.ts \
  "apps/web/app/(authenticated)/home/page.tsx" \
  "apps/web/app/(sp)/sp/home/page.tsx"
git commit -m "refactor: useHomeTrips フックで home ページのロジックを共通化"
```

---

## Phase 1c: Custom Hook — useBookmarkLists

**Files:**
- Create: `apps/web/lib/hooks/use-bookmark-lists.ts`
- Modify: `apps/web/app/(authenticated)/bookmarks/page.tsx`
- Modify: `apps/web/app/(sp)/sp/bookmarks/page.tsx`

### Step 1: Read source files and create hook

Read both bookmark page files. Extract shared logic into `use-bookmark-lists.ts`:

- `useQuery` for bookmark lists
- All state: `search`, `visibilityFilter`, `selectionMode`, `selectedIds`, `deleting`, `duplicating`
- `useMemo` for `filteredBookmarkLists`
- Handlers: `handleDelete`, `handleDuplicate`, `handleDeleteSelected`, `handleDuplicateSelected`

SP-specific (leave in SP file): `ActionSheet`, bottom sheet interactions.
Desktop-specific (leave in desktop file): `DropdownMenu` interactions, hotkeys.

### Step 2: Refactor both pages and verify

Replace shared code in both page files. Run:

```bash
bun run check-types && bun run test
```

Expected: no errors, all tests pass.

### Step 3: Commit

```bash
git add apps/web/lib/hooks/use-bookmark-lists.ts \
  "apps/web/app/(authenticated)/bookmarks/page.tsx" \
  "apps/web/app/(sp)/sp/bookmarks/page.tsx"
git commit -m "refactor: useBookmarkLists フックで bookmarks ページのロジックを共通化"
```

---

## Phase 1d: Custom Hook — useFriendsPage

**Files:**
- Create: `apps/web/lib/hooks/use-friends-page.ts`
- Modify: `apps/web/app/(authenticated)/friends/page.tsx`
- Modify: `apps/web/app/(sp)/sp/friends/page.tsx`

### Step 1: Read source files and create hook

Read both friends page files. Extract:

- `useQuery` for friends and groups
- Tab state (`activeTab`)
- `useDelayedLoading`

SP-specific (leave in SP file): swipe tab refs, mobile-specific navigation.
Desktop-specific (leave in desktop file): hotkeys, UserIdSection visibility.

### Step 2: Refactor both pages and verify

```bash
bun run check-types && bun run test
```

Expected: no errors, all tests pass.

### Step 3: Commit

```bash
git add apps/web/lib/hooks/use-friends-page.ts \
  "apps/web/app/(authenticated)/friends/page.tsx" \
  "apps/web/app/(sp)/sp/friends/page.tsx"
git commit -m "refactor: useFriendsPage フックで friends ページのロジックを共通化"
```

---

## Phase 1e: Type Deduplication — ExpensesResponse

**Files:**
- Modify: `packages/shared/src/types.ts`
- Modify: `apps/web/components/expense-panel.tsx`
- Modify: `apps/web/app/(authenticated)/trips/[id]/export/page.tsx`

### Step 1: Add types to shared

In `packages/shared/src/types.ts`, append after the existing exports:

```ts
// Expense API response types

export type ExpenseSplit = {
  userId: string;
  amount: number;
  user: { id: string; name: string };
};

export type ExpenseItem = {
  id: string;
  title: string;
  amount: number;
  splitType: ExpenseSplitType;
  paidByUserId: string;
  paidByUser: { id: string; name: string };
  splits: ExpenseSplit[];
  createdAt: string;
};

export type Transfer = {
  from: { id: string; name: string };
  to: { id: string; name: string };
  amount: number;
};

export type Settlement = {
  totalAmount: number;
  balances: { userId: string; name: string; net: number }[];
  transfers: Transfer[];
};

export type ExpensesResponse = {
  expenses: ExpenseItem[];
  settlement: Settlement;
};
```

Note: use `ExpenseItem` (not `Expense`) to avoid collision with potential future `Expense` model type.

Also add `ExpenseSplitType` import — check if it's already in `packages/shared/src/schemas/expense.ts` and import from there. If not, define it inline.

### Step 2: Update expense-panel.tsx

Remove the local type definitions (lines ~36-68). Replace imports:

```ts
import type { ExpenseSplitType, ExpenseItem, ExpenseSplit, Transfer, Settlement, ExpensesResponse } from "@sugara/shared";
```

Update all usages of `Expense` → `ExpenseItem` within the file.

### Step 3: Update export/page.tsx

Same: remove local definitions, import from `@sugara/shared`.

### Step 4: Run type-check and tests

```bash
bun run check-types && bun run test
```

Expected: no errors, all tests pass.

### Step 5: Commit

```bash
git add packages/shared/src/types.ts \
  apps/web/components/expense-panel.tsx \
  "apps/web/app/(authenticated)/trips/[id]/export/page.tsx"
git commit -m "refactor: ExpensesResponse 型を @sugara/shared に移動して重複を解消"
```

---

## Phase 2a: Split trips/[id]/page.tsx

**Files:**
- Read: `apps/web/app/(authenticated)/trips/[id]/page.tsx` (1082 lines)
- Read: `apps/web/app/(authenticated)/trips/[id]/_components/` (existing components)
- Modify: `apps/web/app/(authenticated)/trips/[id]/page.tsx`
- Create: new files in `apps/web/app/(authenticated)/trips/[id]/_components/` as needed

### Step 1: Audit existing _components and inline tab content

Read `apps/web/app/(authenticated)/trips/[id]/page.tsx` and list which tab panels are inline vs already extracted. Note that `poll-tab.tsx` already exists.

Identify sections to extract (e.g., inline schedule/expense/souvenir/member tab content). For each section that is purely JSX with local props passed in, create a new `_components/<name>-tab.tsx`.

### Step 2: Extract one tab at a time

For each identified inline tab section:
1. Create `_components/<name>-tab.tsx` with the JSX and required props interface
2. Import and use it in `page.tsx`
3. Run `bun run check-types` after each extraction

### Step 3: Run tests

```bash
bun run test
```

Expected: all tests pass.

### Step 4: Commit

```bash
git add "apps/web/app/(authenticated)/trips/[id]/page.tsx" \
  "apps/web/app/(authenticated)/trips/[id]/_components/"
git commit -m "refactor: trips/[id]/page.tsx をタブ別コンポーネントに分割"
```

---

## Phase 2b: Split schedule-item.tsx

**Files:**
- Read: `apps/web/components/schedule-item.tsx` (957 lines)
- Create: `apps/web/components/schedule-items/hotel-item.tsx`
- Create: `apps/web/components/schedule-items/transport-item.tsx`
- Create: `apps/web/components/schedule-items/general-item.tsx`
- Modify: `apps/web/components/schedule-item.tsx` (becomes thin router)

### Step 1: Audit schedule-item.tsx

Read the file. Identify per-type rendering sections (hotel, transport, sightseeing, restaurant, activity, other).

### Step 2: Extract per-type components

For each schedule type with substantial JSX:
1. Create `apps/web/components/schedule-items/<type>-item.tsx`
2. Define props interface matching what the parent passes
3. Apply `memo` to each component
4. Run `bun run check-types`

### Step 3: Update schedule-item.tsx

Make it a thin router that renders the appropriate sub-component based on `schedule.category`.

### Step 4: Run type-check and tests

```bash
bun run check-types && bun run test
```

### Step 5: Commit

```bash
git add apps/web/components/schedule-item.tsx \
  apps/web/components/schedule-items/
git commit -m "refactor: schedule-item.tsx をカテゴリ別コンポーネントに分割"
```

---

## Phase 2c: Split candidate-panel.tsx

**Files:**
- Read: `apps/web/components/candidate-panel.tsx` (846 lines)
- Create: `apps/web/components/candidate-list.tsx`
- Create: `apps/web/components/candidate-item.tsx`
- Modify: `apps/web/components/candidate-panel.tsx`

### Step 1: Extract CandidateItem

Identify the per-candidate row JSX. Extract to `candidate-item.tsx` with `memo`. Props should mirror what `candidate-panel.tsx` currently passes inline.

### Step 2: Extract CandidateList

Identify the list rendering section. Extract to `candidate-list.tsx` with `memo`.

### Step 3: Update candidate-panel.tsx

Import and use the new components. Run:

```bash
bun run check-types && bun run test
```

### Step 4: Commit

```bash
git add apps/web/components/candidate-panel.tsx \
  apps/web/components/candidate-list.tsx \
  apps/web/components/candidate-item.tsx
git commit -m "refactor: candidate-panel.tsx を CandidateList / CandidateItem に分割"
```

---

## Phase 3a: Move Notification and SharedTripResponse types to shared

**Files:**
- Modify: `packages/shared/src/types.ts`
- Modify: `apps/web/components/notification-bell.tsx`
- Modify: `apps/web/app/shared/[token]/_components/shared-trip-client.tsx`
- Modify: `apps/web/components/activity-log.tsx`

### Step 1: Read local type definitions

Read the following to get exact type shapes:
- `apps/web/components/notification-bell.tsx` line ~21 (`Notification` type)
- `apps/web/app/shared/[token]/_components/shared-trip-client.tsx` line ~41 (`SharedTripResponse`)
- `apps/web/components/activity-log.tsx` line ~175 (`LogsResponse`)

### Step 2: Add to packages/shared/src/types.ts

Append the three types. For `Notification`, check if `NotificationType` from schemas can be reused in the definition. For `SharedTripResponse`, check overlap with existing `TripResponse`.

### Step 3: Update consumer files

In each file, remove the local type definition and import the type from `@sugara/shared`.

### Step 4: Run type-check and tests

```bash
bun run check-types && bun run test
```

Expected: no errors, all tests pass.

### Step 5: Commit

```bash
git add packages/shared/src/types.ts \
  apps/web/components/notification-bell.tsx \
  "apps/web/app/shared/[token]/_components/shared-trip-client.tsx" \
  apps/web/components/activity-log.tsx
git commit -m "refactor: Notification / SharedTripResponse / LogsResponse 型を @sugara/shared に移動"
```

---

## Phase 3b: Unify Member type in expense-dialog.tsx

**Files:**
- Modify: `apps/web/components/expense-dialog.tsx`

### Step 1: Read expense-dialog.tsx local Member type

Line ~34:

```ts
type Member = { userId: string; name: string; role: string; image: string | null };
```

### Step 2: Replace with MemberResponse from shared

`MemberResponse` in `packages/shared/src/types.ts`:

```ts
export type MemberResponse = {
  userId: string;
  role: MemberRole;
  name: string;
  image?: string | null;
  hasExpenses?: boolean;
};
```

In `expense-dialog.tsx`:
- Remove the local `Member` type
- Import `MemberResponse` from `@sugara/shared`
- Replace `Member` with `MemberResponse` throughout the file
- Fix `role: string` → `role: MemberRole` if used in comparisons

### Step 3: Run type-check

```bash
bun run check-types
```

Expected: no errors.

### Step 4: Commit

```bash
git add apps/web/components/expense-dialog.tsx
git commit -m "refactor: expense-dialog の Member 型を shared の MemberResponse に統一"
```

---

## Phase 4a: Add Skeleton to print/page.tsx

**Files:**
- Modify: `apps/web/app/(authenticated)/trips/[id]/print/page.tsx`

### Step 1: Read the file's current loading state (line ~56)

Current pattern:

```tsx
if (isLoading) {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-muted-foreground">読み込み中...</p>
    </div>
  );
}
```

### Step 2: Add useDelayedLoading and Skeleton

Replace the loading branch with `useDelayedLoading` + a table-row Skeleton matching the print layout:

```tsx
const showSkeleton = useDelayedLoading(isLoading);

if (isLoading && !showSkeleton) return <div />;
if (showSkeleton) {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-4xl space-y-8 p-8">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ))}
      </div>
    </div>
  );
}
```

Add imports: `useDelayedLoading` from `@/lib/hooks/use-delayed-loading`, `Skeleton` from `@/components/ui/skeleton`.

### Step 3: Run type-check

```bash
bun run check-types
```

### Step 4: Commit

```bash
git add "apps/web/app/(authenticated)/trips/[id]/print/page.tsx"
git commit -m "feat: print ページにスケルトンローディングを追加"
```

---

## Phase 4b: Add Skeleton to export/page.tsx

**Files:**
- Modify: `apps/web/app/(authenticated)/trips/[id]/export/page.tsx`

### Step 1: Replace loading state (line ~346)

Current:

```tsx
if (isLoading) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <p className="text-muted-foreground">読み込み中...</p>
    </div>
  );
}
```

Replace with `useDelayedLoading` + Skeleton matching the export layout (sheet tabs + column list):

```tsx
const showSkeleton = useDelayedLoading(isLoading);

if (isLoading && !showSkeleton) return <div />;
if (showSkeleton) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="w-full max-w-5xl space-y-4 p-6">
        <div className="flex gap-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-md" />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[...Array(9)].map((_, i) => (
            <Skeleton key={i} className="h-6 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
```

### Step 2: Run type-check and commit

```bash
bun run check-types
git add "apps/web/app/(authenticated)/trips/[id]/export/page.tsx"
git commit -m "feat: export ページにスケルトンローディングを追加"
```

---

## Phase 4c: Add Skeleton to admin/page.tsx

**Files:**
- Modify: `apps/web/app/admin/page.tsx`

### Step 1: Read the file's loading state

Find the `<p>読み込み中...</p>` pattern and replace with `useDelayedLoading` + simple row Skeletons:

```tsx
const showSkeleton = useDelayedLoading(isLoading);

if (isLoading && !showSkeleton) return <div />;
if (showSkeleton) {
  return (
    <div className="container py-8 space-y-4">
      {[...Array(5)].map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}
```

### Step 2: Run type-check and commit

```bash
bun run check-types
git add apps/web/app/admin/page.tsx
git commit -m "feat: admin ページにスケルトンローディングを追加"
```

---

## Phase 4d: Add segment-level error.tsx files

**Files:**
- Create: `apps/web/app/(authenticated)/error.tsx`
- Create: `apps/web/app/(sp)/error.tsx`

### Step 1: Create authenticated error boundary

`apps/web/app/(authenticated)/error.tsx` — copy the root `app/error.tsx` pattern, adjusting the home link to `/home`:

```tsx
"use client";

import { Home, RotateCcw } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function AuthenticatedError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-bold">エラーが発生しました</h1>
      <p className="text-muted-foreground">
        予期しないエラーが発生しました。もう一度お試しください。
      </p>
      <div className="flex gap-4">
        <Button onClick={reset}>
          <RotateCcw className="h-4 w-4" />
          再試行
        </Button>
        <Button variant="outline" asChild>
          <Link href="/home">
            <Home className="h-4 w-4" />
            ホームに戻る
          </Link>
        </Button>
      </div>
    </div>
  );
}
```

### Step 2: Create SP error boundary

`apps/web/app/(sp)/error.tsx` — same pattern, link to `/sp/home`:

```tsx
"use client";

import { Home, RotateCcw } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function SpError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-xl font-bold">エラーが発生しました</h1>
      <p className="text-sm text-muted-foreground">
        予期しないエラーが発生しました。もう一度お試しください。
      </p>
      <div className="flex gap-3">
        <Button size="sm" onClick={reset}>
          <RotateCcw className="h-4 w-4" />
          再試行
        </Button>
        <Button size="sm" variant="outline" asChild>
          <Link href="/sp/home">
            <Home className="h-4 w-4" />
            ホームへ
          </Link>
        </Button>
      </div>
    </div>
  );
}
```

### Step 3: Run type-check and commit

```bash
bun run check-types
git add "apps/web/app/(authenticated)/error.tsx" "apps/web/app/(sp)/error.tsx"
git commit -m "feat: 認証済みルートセグメントに error.tsx を追加"
```

---

## Phase 4e: Normalize loading pattern in trip pages

**Files:**
- Modify: `apps/web/app/(authenticated)/trips/[id]/page.tsx`
- Modify: `apps/web/app/(sp)/sp/trips/[id]/page.tsx`

### Step 1: Find duplicate isLoading checks

Read both files. Look for secondary `if (isLoading || isPollLoading) return null;` checks after the initial `useDelayedLoading` guard at the top. These are redundant.

### Step 2: Remove duplicate checks

Remove any `return null` or `return <div />` guarded by loading state that appear after the initial skeleton guard. The initial `useDelayedLoading` block should be the single source of truth.

### Step 3: Run type-check and tests

```bash
bun run check-types && bun run test
```

Expected: no errors, all tests pass.

### Step 4: Commit

```bash
git add "apps/web/app/(authenticated)/trips/[id]/page.tsx" \
  "apps/web/app/(sp)/sp/trips/[id]/page.tsx"
git commit -m "refactor: trips/[id] ページのローディングパターンを統一"
```

---

## Final Verification

```bash
bun run test
bun run check-types
bun run check
```

Expected: all tests pass, no type errors, cookie warning のみ (既知).
