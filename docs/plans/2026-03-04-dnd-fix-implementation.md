# DnD Bug Fix & Performance Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix a race-condition bug where a concurrent drag's optimistic UI update is wiped by a server refetch, and eliminate unnecessary re-computation in `DayTimeline` during drag.

**Architecture:** Four targeted changes across two files. No new files except one test file. No API or schema changes. Each task is independently committable.

**Tech Stack:** React 19, dnd-kit v6/v10, Vitest, @testing-library/react, Tailwind CSS, TypeScript

---

## Overview

| Task | File | Change |
|---|---|---|
| 1 | `use-trip-drag-and-drop.ts` | Test + Fix 1: skip sync during drag |
| 2 | `use-trip-drag-and-drop.ts` | Fix 4: sensor option constants |
| 3 | `day-timeline.tsx` | Fix 2 + 3: useMemo + O(n) lookup |

Design doc: `docs/plans/2026-03-04-dnd-fix-design.md`

---

## Task 1: Race Condition Guard — Test + Fix

**Files:**
- Create: `apps/web/lib/hooks/use-trip-drag-and-drop.test.ts`
- Modify: `apps/web/lib/hooks/use-trip-drag-and-drop.ts:71-87`

### Step 1: Write the failing test

```ts
// apps/web/lib/hooks/use-trip-drag-and-drop.test.ts
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTripDragAndDrop } from "./use-trip-drag-and-drop";

vi.mock("@/lib/api", () => ({
  api: vi.fn().mockResolvedValue(undefined),
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@dnd-kit/core", () => ({
  useSensor: vi.fn(() => ({})),
  useSensors: vi.fn((...sensors: unknown[]) => sensors),
  PointerSensor: class {},
  TouchSensor: class {},
  pointerWithin: vi.fn(),
}));

vi.mock("@dnd-kit/sortable", () => ({
  arrayMove: vi.fn((arr: unknown[], from: number, to: number) => {
    const result = [...arr];
    result.splice(to, 0, result.splice(from, 1)[0]);
    return result;
  }),
}));

vi.mock("@/lib/merge-timeline", () => ({
  buildMergedTimeline: vi.fn((schedules: unknown[]) =>
    schedules.map((s) => ({ type: "schedule", schedule: s })),
  ),
  timelineSortableIds: vi.fn((items: Array<{ schedule: { id: string } }>) =>
    items.map((i) => i.schedule.id),
  ),
  timelineScheduleOrder: vi.fn((items: Array<{ type: string; schedule: unknown }>) =>
    items.filter((i) => i.type === "schedule").map((i) => i.schedule),
  ),
}));

// Minimal schedule shape needed for hook initialization
function makeSchedule(id: string) {
  return {
    id,
    name: `Schedule ${id}`,
    category: "sightseeing" as const,
    color: "blue" as const,
    address: null,
    startTime: null,
    endTime: null,
    sortOrder: 0,
    memo: null,
    urls: [],
    departurePlace: null,
    arrivalPlace: null,
    transportMethod: null,
    endDayOffset: 0,
    updatedAt: "2024-01-01T00:00:00Z",
  };
}

const s1 = makeSchedule("s1");
const s2 = makeSchedule("s2");
const s3 = makeSchedule("s3");

describe("useTripDragAndDrop — localSchedules sync guard", () => {
  afterEach(() => vi.clearAllMocks());

  it("updates localSchedules when schedules prop changes while NOT dragging", () => {
    const { result, rerender } = renderHook(
      ({ schedules }) =>
        useTripDragAndDrop({
          tripId: "trip1",
          currentDayId: null,
          currentPatternId: null,
          schedules,
          candidates: [],
          onDone: vi.fn(),
        }),
      { initialProps: { schedules: [s1, s2] } },
    );

    expect(result.current.localSchedules).toHaveLength(2);

    rerender({ schedules: [s1, s2, s3] });

    expect(result.current.localSchedules).toHaveLength(3);
  });

  it("does NOT update localSchedules when schedules prop changes while dragging", async () => {
    const { result, rerender } = renderHook(
      ({ schedules }) =>
        useTripDragAndDrop({
          tripId: "trip1",
          currentDayId: null,
          currentPatternId: null,
          schedules,
          candidates: [],
          onDone: vi.fn(),
        }),
      { initialProps: { schedules: [s1, s2] } },
    );

    // Simulate drag start — sets activeDragItem to non-null
    act(() => {
      result.current.handleDragStart({
        active: {
          id: "s1",
          data: { current: { type: "schedule" } },
          rect: { current: { initial: null, translated: null } },
        } as Parameters<typeof result.current.handleDragStart>[0],
      });
    });

    // Schedules prop changes while drag is in progress
    rerender({ schedules: [s1, s2, s3] });

    // localSchedules must remain unchanged during drag
    expect(result.current.localSchedules).toHaveLength(2);

    // Simulate drag end (currentPatternId is null → returns early, no API call)
    await act(async () => {
      await result.current.handleDragEnd({
        active: {
          id: "s1",
          data: { current: { type: "schedule" } },
        } as Parameters<typeof result.current.handleDragEnd>[0],
        over: null,
        delta: { x: 0, y: 0 },
        activatorEvent: new PointerEvent("pointerup"),
        collisions: null,
      });
    });

    // After drag ends, sync resumes on next prop change
    rerender({ schedules: [s1, s2, s3] });
    expect(result.current.localSchedules).toHaveLength(3);
  });
});
```

### Step 2: Run the test to verify it fails

```bash
bun run --filter @sugara/web test lib/hooks/use-trip-drag-and-drop.test.ts
```

Expected: the second test ("does NOT update localSchedules while dragging") **FAILS** because currently the guard is missing and `localSchedules` updates immediately.

### Step 3: Implement the fix

In `apps/web/lib/hooks/use-trip-drag-and-drop.ts`, add `if (activeDragItem !== null) return;` at the top of each `useEffect`.

**Current (lines 71–87):**
```ts
useEffect(() => {
  setLocalSchedules((prev) => {
    if (prev.length === schedules.length && prev.every((s, i) => s === schedules[i])) {
      return prev;
    }
    return schedules;
  });
}, [schedules]);

useEffect(() => {
  setLocalCandidates((prev) => {
    if (prev.length === candidates.length && prev.every((c, i) => c === candidates[i])) {
      return prev;
    }
    return candidates;
  });
}, [candidates]);
```

**After:**
```ts
useEffect(() => {
  if (activeDragItem !== null) return;
  setLocalSchedules((prev) => {
    if (prev.length === schedules.length && prev.every((s, i) => s === schedules[i])) {
      return prev;
    }
    return schedules;
  });
}, [schedules, activeDragItem]);

useEffect(() => {
  if (activeDragItem !== null) return;
  setLocalCandidates((prev) => {
    if (prev.length === candidates.length && prev.every((c, i) => c === candidates[i])) {
      return prev;
    }
    return candidates;
  });
}, [candidates, activeDragItem]);
```

### Step 4: Run the test to verify it passes

```bash
bun run --filter @sugara/web test lib/hooks/use-trip-drag-and-drop.test.ts
```

Expected: both tests **PASS**

### Step 5: Run type check

```bash
bun run check-types
```

Expected: no errors

### Step 6: Commit

```bash
git add apps/web/lib/hooks/use-trip-drag-and-drop.test.ts apps/web/lib/hooks/use-trip-drag-and-drop.ts
git commit -m "fix: ドラッグ中のサーバー同期をスキップしてオプティミスティック更新の競合を解消"
```

---

## Task 2: Sensor Option Constants

**File:**
- Modify: `apps/web/lib/hooks/use-trip-drag-and-drop.ts:64-67`

No test needed — this is a pure refactor (object identity change only, same values).

### Step 1: Extract constants to module scope

Find the `useSensors` call (lines 64-67):

```ts
// Current (inside the hook function body):
const sensors = useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
);
```

Add two constants **above** the `useTripDragAndDrop` function definition (at module scope, before line 47):

```ts
const POINTER_SENSOR_OPTIONS = { activationConstraint: { distance: 8 } } as const;
const TOUCH_SENSOR_OPTIONS = {
  activationConstraint: { delay: 200, tolerance: 5 },
} as const;
```

Replace the inline objects in `useSensors`:

```ts
const sensors = useSensors(
  useSensor(PointerSensor, POINTER_SENSOR_OPTIONS),
  useSensor(TouchSensor, TOUCH_SENSOR_OPTIONS),
);
```

### Step 2: Run type check

```bash
bun run check-types
```

### Step 3: Run tests

```bash
bun run --filter @sugara/web test lib/hooks/use-trip-drag-and-drop.test.ts
```

Expected: both tests still **PASS**

### Step 4: Commit

```bash
git add apps/web/lib/hooks/use-trip-drag-and-drop.ts
git commit -m "perf: センサーオプションをモジュールスコープ定数に移動"
```

---

## Task 3: DayTimeline — useMemo + O(n) Lookup

**File:**
- Modify: `apps/web/components/day-timeline.tsx`

This task rewrites the IIFE (lines 356–491) by:
1. Extracting `merged` and `sortableIds` to the component body with `useMemo`
2. Moving `renderItem` to the component body
3. Replacing the O(n²) lookups with a precomputed `Map`
4. Collapsing the IIFE into clean conditional JSX

No behavior changes. Verify with type check + existing tests.

### Step 1: Add imports

In `day-timeline.tsx`, add `useMemo` to the React import. Currently line 20:

```ts
// Current:
import { useState } from "react";

// After:
import { useMemo, useState } from "react";
```

### Step 2: Add `scheduleIndexById` memo before the return

Immediately before the `return (` statement (currently at line 192), insert:

```ts
const merged = useMemo(
  () => buildMergedTimeline(schedules, crossDayEntries),
  [schedules, crossDayEntries],
);
const sortableIds = useMemo(() => timelineSortableIds(merged), [merged]);
const scheduleIndexById = useMemo(
  () => new Map(schedules.map((s, i) => [s.id, i])),
  [schedules],
);
```

### Step 3: Move `renderItem` to the component body

The `renderItem` function is currently defined inside the IIFE. Move it to the component body, between the new memo declarations and the `return`.

The function uses:
- `merged` (now in component scope ✓)
- `schedules`, `isMobile`, `reorderMode`, `disabled` (already in component scope ✓)
- `overScheduleId` (prop, already in scope ✓)
- `overlayIndicator`, `inlineIndicator` — currently local to the IIFE; define them alongside

Add the following between the `useMemo` declarations and the `return`:

```ts
const overlayIndicator = <DndInsertIndicator overlay />;
const inlineIndicator = <DndInsertIndicator />;

function renderItem(item: TimelineItem, i: number, opts?: { selectable?: boolean }) {
  const isFirst = i === 0;
  const isLast = i === merged.length - 1;

  const sortableId =
    item.type === "crossDay" ? `cross-${item.entry.schedule.id}` : item.schedule.id;
  const showInsertIndicator = overScheduleId != null && sortableId === overScheduleId;

  if (item.type === "crossDay") {
    const {
      schedule: s,
      sourceDayId,
      sourcePatternId,
      sourceDayNumber,
      crossDayPosition,
    } = item.entry;
    const sourceMaxEndDayOffset =
      totalDays != null ? totalDays - sourceDayNumber : maxEndDayOffset;
    return (
      <div key={`cross-${s.id}`} className="relative">
        {showInsertIndicator && overlayIndicator}
        <ScheduleItem
          {...s}
          tripId={tripId}
          dayId={sourceDayId}
          patternId={sourcePatternId}
          date={date}
          isFirst={isFirst}
          isLast={isLast}
          onDelete={() => handleDelete(s.id, sourceDayId, sourcePatternId)}
          onUpdate={onRefresh}
          onUnassign={
            !disabled && !opts?.selectable ? () => handleUnassign(s.id) : undefined
          }
          disabled={disabled}
          timeStatus={isToday ? getCrossDayTimeStatus(now, s.endTime) : null}
          maxEndDayOffset={sourceMaxEndDayOffset}
          crossDayDisplay
          crossDaySourceDayNumber={sourceDayNumber}
          crossDayPosition={crossDayPosition}
        />
      </div>
    );
  }

  const { schedule } = item;
  // O(1) lookup via precomputed Map; previously O(n) findIndex
  const scheduleIdx = scheduleIndexById.get(schedule.id) ?? -1;
  // slice is O(n-k) instead of filter O(n); valid because schedules is in sortOrder order
  const schedulesAfter = scheduleIdx >= 0 ? schedules.slice(scheduleIdx + 1) : [];
  const isReorderable = isMobile && reorderMode && !disabled;
  const reorderFirst = scheduleIdx === 0;
  const reorderLast = scheduleIdx === schedules.length - 1;

  return (
    <div key={schedule.id} className="relative">
      {showInsertIndicator && overlayIndicator}
      <ScheduleItem
        {...schedule}
        tripId={tripId}
        dayId={dayId}
        patternId={patternId}
        date={date}
        isFirst={isReorderable ? reorderFirst : isFirst}
        isLast={isReorderable ? reorderLast : isLast}
        onDelete={() => handleDelete(schedule.id)}
        onUpdate={onRefresh}
        onUnassign={
          !disabled && !opts?.selectable ? () => handleUnassign(schedule.id) : undefined
        }
        disabled={disabled}
        timeStatus={getScheduleTimeStatus(schedule)}
        maxEndDayOffset={maxEndDayOffset}
        selectable={opts?.selectable}
        selected={opts?.selectable ? selectedIds?.has(schedule.id) : undefined}
        onSelect={opts?.selectable ? sel.toggle : undefined}
        siblingSchedules={schedulesAfter}
        onSaveToBookmark={
          onSaveToBookmark ? () => onSaveToBookmark([schedule.id]) : undefined
        }
        draggable={!isMobile}
        reorderable={isReorderable}
        onMoveUp={isReorderable ? () => onReorderSchedule?.(schedule.id, "up") : undefined}
        onMoveDown={
          isReorderable ? () => onReorderSchedule?.(schedule.id, "down") : undefined
        }
      />
    </div>
  );
}
```

### Step 4: Replace the IIFE in the return statement

The current `return` block contains the IIFE starting at line 356. Replace the entire IIFE block with explicit conditionals:

```tsx
// Before (inside the outer <div>):
{(() => {
  const merged = buildMergedTimeline(schedules, crossDayEntries);
  const total = merged.length;
  if (total === 0) { ... }
  ...
  return selectionMode ? (...) : (...);
})()}

// After:
{merged.length === 0 ? (
  <div
    ref={selectionMode ? undefined : setDroppableRef}
    className={cn(
      "rounded-md border border-dashed p-6 text-center transition-colors",
      isOverTimeline && DROP_ZONE_ACTIVE,
    )}
  >
    <p className="text-sm text-muted-foreground">{MSG.EMPTY_SCHEDULE}</p>
  </div>
) : selectionMode ? (
  <div className="space-y-1.5">
    {merged.map((item, i) => renderItem(item, i, { selectable: true }))}
  </div>
) : (
  <div ref={setDroppableRef}>
    <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
      <div className="space-y-1.5">
        {merged.map((item, i) => renderItem(item, i))}
        {isOverTimeline && overScheduleId === null && inlineIndicator}
      </div>
    </SortableContext>
  </div>
)}
```

### Step 5: Run type check

```bash
bun run check-types
```

Expected: no errors. If TypeScript complains about `renderItem` referencing variables not yet declared (hoisting), move the function after the variable declarations.

### Step 6: Run lint

```bash
bun run --filter @sugara/web check
```

Expected: no errors (may auto-fix formatting)

### Step 7: Run all tests

```bash
bun run test
```

Expected: all tests pass (no behavior change)

### Step 8: Commit

```bash
git add apps/web/components/day-timeline.tsx
git commit -m "perf: DayTimelineのbuildMergedTimelineをメモ化、O(n²)ルックアップをO(n)に改善"
```

---

## Final Verification

### Step 1: Run full test suite

```bash
bun run test
```

Expected: all tests pass

### Step 2: Run type check

```bash
bun run check-types
```

Expected: no errors

### Step 3: Manual smoke test

Start dev server:

```bash
bun run --filter @sugara/web dev
```

Open a trip with multiple schedules. With browser DevTools → Network → throttle to "Slow 3G":

- [ ] Drag schedule to a new position → correct position, no revert after API returns
- [ ] Drag candidate to timeline → appears at correct position
- [ ] Drag schedule to candidate panel → schedule removed, candidate appears in panel
- [ ] Drag candidate within candidate list → correct reorder
- [ ] Drag two schedules in quick succession (start second before first API returns) → both end up in their correct positions, no unexpected revert
- [ ] Mobile: tap 並び替え → up/down buttons work, correct positions

---

## Completion Checklist

- [ ] `use-trip-drag-and-drop.test.ts` has 2 passing tests
- [ ] Race condition guard: `activeDragItem !== null` check in both `useEffect`s
- [ ] Sensor constants at module scope in `use-trip-drag-and-drop.ts`
- [ ] `buildMergedTimeline` wrapped in `useMemo` in `day-timeline.tsx`
- [ ] `timelineSortableIds` wrapped in `useMemo` in `day-timeline.tsx`
- [ ] `scheduleIndexById` Map used for O(1) lookup
- [ ] `schedulesAfter` uses `slice` not `filter`
- [ ] IIFE removed from `day-timeline.tsx` return
- [ ] `bun run test` passes
- [ ] `bun run check-types` passes
