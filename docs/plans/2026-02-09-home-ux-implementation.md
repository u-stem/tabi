# Home UX Improvement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add search, status filter, sort, and bulk delete (via selection mode) to the dashboard home page.

**Architecture:** Client-side only. All filtering/sorting computed via `useMemo` on the already-fetched trips array. Selection mode toggles card behavior between navigation and selection. Bulk delete calls existing `DELETE /api/trips/:id` per trip. New `TripToolbar` component handles all toolbar UI; `TripCard` gains selection props.

**Tech Stack:** React 19, Next.js 15, shadcn/ui (Button, Select, Input, AlertDialog, Badge), Tailwind CSS v4

---

## Task 1: Create Checkbox UI component

Checkbox is needed for card selection but not yet in the project. Create it manually (shadcn CLI hangs in non-interactive terminals).

**Files:**
- Create: `apps/web/components/ui/checkbox.tsx`

**Step 1: Install @radix-ui/react-checkbox**

Run: `bun add --filter @tabi/web @radix-ui/react-checkbox`

**Step 2: Create the component**

```tsx
// apps/web/components/ui/checkbox.tsx
"use client";

import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

const Checkbox = React.forwardRef<
  React.ComponentRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className={cn("flex items-center justify-center text-current")}>
      <Check className="h-3.5 w-3.5" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
```

**Step 3: Verify build**

Run: `bun run --filter @tabi/web lint`
Expected: No errors

**Step 4: Commit**

```
feat: Checkbox UIコンポーネントを追加
```

---

## Task 2: Create TripToolbar component

**Files:**
- Create: `apps/web/components/trip-toolbar.tsx`

**Step 1: Create the toolbar**

```tsx
// apps/web/components/trip-toolbar.tsx
"use client";

import type { TripStatus } from "@tabi/shared";
import { STATUS_LABELS } from "@tabi/shared";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type StatusFilter = "all" | TripStatus;
export type SortKey = "updatedAt" | "startDate";

type TripToolbarProps = {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (value: StatusFilter) => void;
  sortKey: SortKey;
  onSortKeyChange: (value: SortKey) => void;
  selectionMode: boolean;
  onSelectionModeChange: (value: boolean) => void;
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onDeleteSelected: () => void;
  deleting: boolean;
  disabled: boolean;
};

const statusFilters: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "すべて" },
  ...Object.entries(STATUS_LABELS).map(([value, label]) => ({
    value: value as TripStatus,
    label,
  })),
];

const sortOptions: { value: SortKey; label: string }[] = [
  { value: "updatedAt", label: "更新日" },
  { value: "startDate", label: "出発日" },
];

export function TripToolbar({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  sortKey,
  onSortKeyChange,
  selectionMode,
  onSelectionModeChange,
  selectedCount,
  totalCount,
  onSelectAll,
  onDeselectAll,
  onDeleteSelected,
  deleting,
  disabled,
}: TripToolbarProps) {
  if (selectionMode) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{selectedCount}件選択中</span>
        <Button variant="outline" size="sm" onClick={onSelectAll} disabled={deleting}>
          全選択
        </Button>
        <Button variant="outline" size="sm" onClick={onDeselectAll} disabled={deleting}>
          選択解除
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={selectedCount === 0 || deleting}>
                {deleting ? "削除中..." : "削除"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{selectedCount}件の旅行を削除しますか？</AlertDialogTitle>
                <AlertDialogDescription>
                  選択した旅行とすべてのスポットが削除されます。この操作は取り消せません。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>キャンセル</AlertDialogCancel>
                <AlertDialogAction onClick={onDeleteSelected}>削除する</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button variant="ghost" size="sm" onClick={() => onSelectionModeChange(false)} disabled={deleting}>
            キャンセル
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        type="search"
        placeholder="検索..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="h-8 w-40"
      />
      <Select
        value={statusFilter}
        onValueChange={(v) => onStatusFilterChange(v as StatusFilter)}
      >
        <SelectTrigger className="h-8 w-[120px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {statusFilters.map((f) => (
            <SelectItem key={f.value} value={f.value}>
              {f.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={sortKey} onValueChange={(v) => onSortKeyChange(v as SortKey)}>
        <SelectTrigger className="h-8 w-[100px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {sortOptions.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="ml-auto">
        <Button variant="outline" size="sm" onClick={() => onSelectionModeChange(true)} disabled={disabled || totalCount === 0}>
          選択
        </Button>
      </div>
    </div>
  );
}
```

**Step 2: Verify lint**

Run: `bun run --filter @tabi/web lint`
Expected: No errors

**Step 3: Commit**

```
feat: TripToolbarコンポーネントを追加
```

---

## Task 3: Add selection mode to TripCard

**Files:**
- Modify: `apps/web/components/trip-card.tsx`

**Step 1: Update TripCard with selection props**

The card should:
- Accept `selectable`, `selected`, `onSelect` props
- When `selectable`: show checkbox, click toggles selection, highlight when selected
- When not `selectable`: behave as before (link to trip detail)

```tsx
// apps/web/components/trip-card.tsx
import type { TripListItem } from "@tabi/shared";
import { STATUS_LABELS } from "@tabi/shared";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDateRange, getDayCount } from "@/lib/format";
import { cn } from "@/lib/utils";

type TripCardProps = TripListItem & {
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (id: string) => void;
};

export function TripCard({
  id,
  title,
  destination,
  startDate,
  endDate,
  status,
  totalSpots,
  selectable = false,
  selected = false,
  onSelect,
}: TripCardProps) {
  const dayCount = getDayCount(startDate, endDate);

  const cardContent = (
    <Card className={cn(
      "transition-colors hover:bg-accent/50",
      selected && "ring-2 ring-primary",
    )}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {selectable && (
              <Checkbox
                checked={selected}
                onClick={(e) => e.stopPropagation()}
                onCheckedChange={() => onSelect?.(id)}
                aria-label={`${title}を選択`}
              />
            )}
            <CardTitle className="text-lg">{title}</CardTitle>
          </div>
          <Badge variant="secondary">{STATUS_LABELS[status]}</Badge>
        </div>
        <CardDescription>{destination}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          {formatDateRange(startDate, endDate)} ({dayCount}日間)
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {totalSpots > 0 ? `${totalSpots}件のスポット` : "スポット未登録"}
        </p>
      </CardContent>
    </Card>
  );

  if (selectable) {
    return (
      <button
        type="button"
        onClick={() => onSelect?.(id)}
        className="block w-full rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {cardContent}
      </button>
    );
  }

  return (
    <Link
      href={`/trips/${id}`}
      className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {cardContent}
    </Link>
  );
}
```

**Step 2: Verify lint**

Run: `bun run --filter @tabi/web lint`
Expected: No errors

**Step 3: Commit**

```
feat: TripCardに選択モードを追加
```

---

## Task 4: Update dashboard page with all features

**Files:**
- Modify: `apps/web/app/(authenticated)/dashboard/page.tsx`

**Step 1: Rewrite dashboard with filter/sort/search/selection**

```tsx
// apps/web/app/(authenticated)/dashboard/page.tsx
"use client";

import type { TripListItem } from "@tabi/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { TripCard } from "@/components/trip-card";
import type { SortKey, StatusFilter } from "@/components/trip-toolbar";
import { TripToolbar } from "@/components/trip-toolbar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, api } from "@/lib/api";
import { useOnlineStatus } from "@/lib/hooks/use-online-status";

export default function DashboardPage() {
  const router = useRouter();
  const online = useOnlineStatus();
  const [trips, setTrips] = useState<TripListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter/sort state
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("updatedAt");

  // Selection mode state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    api<TripListItem[]>("/api/trips")
      .then(setTrips)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          router.push("/auth/login");
          return;
        }
        setError("旅行の取得に失敗しました");
      })
      .finally(() => setLoading(false));
  }, [router]);

  const filteredTrips = useMemo(() => {
    let result = trips;

    // Search filter
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (t) => t.title.toLowerCase().includes(q) || t.destination.toLowerCase().includes(q),
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter((t) => t.status === statusFilter);
    }

    // Sort
    result = [...result].sort((a, b) => {
      if (sortKey === "startDate") {
        return a.startDate < b.startDate ? 1 : a.startDate > b.startDate ? -1 : 0;
      }
      // updatedAt: already sorted desc from API
      return 0;
    });

    return result;
  }, [trips, search, statusFilter, sortKey]);

  function handleSelectionModeChange(mode: boolean) {
    setSelectionMode(mode);
    if (!mode) {
      setSelectedIds(new Set());
    }
  }

  function handleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleSelectAll() {
    setSelectedIds(new Set(filteredTrips.map((t) => t.id)));
  }

  function handleDeselectAll() {
    setSelectedIds(new Set());
  }

  const handleDeleteSelected = useCallback(async () => {
    const ids = [...selectedIds];
    setDeleting(true);
    const results = await Promise.allSettled(
      ids.map((id) => api(`/api/trips/${id}`, { method: "DELETE" })),
    );
    const failed = results.filter((r) => r.status === "rejected").length;
    const succeeded = results.filter((r) => r.status === "fulfilled").length;

    if (succeeded > 0) {
      setTrips((prev) => prev.filter((t) => !selectedIds.has(t.id) || failed > 0));
      // Re-fetch to get accurate state
      try {
        const fresh = await api<TripListItem[]>("/api/trips");
        setTrips(fresh);
      } catch {
        // Fallback: remove succeeded ones locally
      }
    }

    if (failed > 0) {
      toast.error(`${failed}件の削除に失敗しました`);
    } else {
      toast.success(`${succeeded}件の旅行を削除しました`);
    }

    setSelectedIds(new Set());
    setSelectionMode(false);
    setDeleting(false);
  }, [selectedIds]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">ホーム</h1>
        {!selectionMode &&
          (online ? (
            <Button asChild>
              <Link href="/trips/new">新しい旅行</Link>
            </Button>
          ) : (
            <Button disabled>新しい旅行</Button>
          ))}
      </div>
      {loading ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {["skeleton-1", "skeleton-2", "skeleton-3"].map((key) => (
            <div key={key} className="rounded-lg border p-6 space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-40" />
            </div>
          ))}
        </div>
      ) : error ? (
        <p className="mt-8 text-destructive">{error}</p>
      ) : trips.length === 0 ? (
        <div className="mt-12 flex flex-col items-center gap-4 text-center">
          <p className="text-lg text-muted-foreground">まだ旅行がありません</p>
          <p className="text-sm text-muted-foreground">最初の旅行プランを作成してみましょう</p>
          {online ? (
            <Button asChild>
              <Link href="/trips/new">旅行を作成</Link>
            </Button>
          ) : (
            <Button disabled>旅行を作成</Button>
          )}
        </div>
      ) : (
        <>
          <div className="mt-4">
            <TripToolbar
              search={search}
              onSearchChange={setSearch}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              sortKey={sortKey}
              onSortKeyChange={setSortKey}
              selectionMode={selectionMode}
              onSelectionModeChange={handleSelectionModeChange}
              selectedCount={selectedIds.size}
              totalCount={filteredTrips.length}
              onSelectAll={handleSelectAll}
              onDeselectAll={handleDeselectAll}
              onDeleteSelected={handleDeleteSelected}
              deleting={deleting}
              disabled={!online}
            />
          </div>
          {filteredTrips.length === 0 ? (
            <p className="mt-8 text-center text-muted-foreground">
              条件に一致する旅行がありません
            </p>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredTrips.map((trip) => (
                <TripCard
                  key={trip.id}
                  {...trip}
                  selectable={selectionMode}
                  selected={selectedIds.has(trip.id)}
                  onSelect={handleSelect}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

**Step 2: Verify lint + type check**

Run: `bun run --filter @tabi/web lint && bun run check-types`
Expected: No errors

**Step 3: Commit**

```
feat: ホームに検索・フィルタ・ソート・一括削除を追加
```

---

## Task 5: Verify all tests and lint

**Step 1: Run all tests**

Run: `bun run test`
Expected: All tests pass

**Step 2: Run type check**

Run: `bun run check-types`
Expected: No errors

**Step 3: Run lint**

Run: `bun run lint`
Expected: No errors

**Step 4: Manual verification checklist**

- [ ] Search filters by title and destination
- [ ] Status filter narrows card list
- [ ] Sort by updatedAt / startDate works
- [ ] "Select" button enters selection mode
- [ ] Checkboxes appear on cards in selection mode
- [ ] Card click toggles selection (not navigation)
- [ ] "Select All" selects all visible (filtered) cards
- [ ] "Delete" shows confirmation dialog
- [ ] Deletion updates card list
- [ ] "Cancel" exits selection mode
- [ ] "New Trip" button hidden in selection mode
- [ ] Empty filter result shows "条件に一致する旅行がありません"
