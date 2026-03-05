# DnD Bug Fix & Performance Design

**Goal:** Fix one confirmed race-condition bug and eliminate unnecessary re-computation during drag interactions.

---

## Background

Full investigation findings:

| # | Severity | Type | Issue |
|---|---|---|---|
| 1 | HIGH | Bug | Concurrent drag race — second drag's optimistic update wiped by first drag's refetch |
| 2 | LOW | Bug | `lastOverZone` not cleared when pointer leaves all zones (intentional behavior, no fix needed) |
| 3 | MEDIUM | Perf | `buildMergedTimeline` recalculated on every drag-hover re-render (no `useMemo`) |
| 4 | LOW | Perf | O(n²) schedule lookup — `filter` + `findIndex` called per item inside render |
| 5 | LOW | Perf | Sensor option objects recreated on every render in `use-trip-drag-and-drop.ts` |

Item 2 (`lastOverZone`) is intentional: once the pointer enters a zone, releasing anywhere (including outside the browser) completes the move. Cancelling requires Escape. No change needed.

---

## Fix 1: Concurrent Drag Race Condition

**File:** `apps/web/lib/hooks/use-trip-drag-and-drop.ts`

### Root Cause

`useTripDragAndDrop` syncs `localSchedules` and `localCandidates` from server state via `useEffect`:

```ts
useEffect(() => {
  setLocalSchedules((prev) => {
    if (prev.length === schedules.length && prev.every((s, i) => s === schedules[i])) {
      return prev;
    }
    return schedules; // overwrites local state with server state
  });
}, [schedules]);
```

When drag #1 completes and calls `onDone()` → `invalidateQueries` → server refetch → `schedules` prop changes → this `useEffect` runs. If drag #2 is in progress at this point, its optimistic update in `localSchedules` gets overwritten by the server state from drag #1's refetch. The user sees the UI revert unexpectedly.

### Fix

Skip the sync while a drag is active. `activeDragItem` is non-null during an active drag and reset to null in `handleDragEnd` before any async work.

```ts
// schedules sync
useEffect(() => {
  if (activeDragItem !== null) return;
  setLocalSchedules((prev) => {
    if (prev.length === schedules.length && prev.every((s, i) => s === schedules[i])) {
      return prev;
    }
    return schedules;
  });
}, [schedules, activeDragItem]);

// candidates sync (same pattern)
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

**Why this is safe:**
- `activeDragItem` is set in `handleDragStart` and cleared at the very start of `handleDragEnd` (line 135), before any `await`. So by the time any API call resolves, `activeDragItem` is already null and the next server sync will go through normally.
- Error rollbacks (`setLocalSchedules(schedules)` in `catch` blocks) are direct state calls, not routed through `useEffect`. They are unaffected by this change.
- Real-time updates from other users that arrive during a drag will be deferred until the drag ends and the next `invalidateQueries` cycle applies them. This is acceptable — applying a collaborator's change mid-drag would be disorienting.

**Change size:** +2 lines each in the two `useEffect` hooks = 4 lines total.

---

## Fix 2: `buildMergedTimeline` Memoization

**File:** `apps/web/components/day-timeline.tsx`

### Root Cause

`buildMergedTimeline` is called inside an IIFE in the JSX, with no memoization:

```tsx
{(() => {
  const merged = buildMergedTimeline(schedules, crossDayEntries); // runs every render
  ...
})()}
```

During a drag, `overScheduleId` prop changes every time the pointer enters a new schedule element. Each change re-renders `DayTimeline`, re-running `buildMergedTimeline`. With cross-day entries and sorting logic, this is O(n log n) per pointer-enter event.

### Fix

Extract `merged` and `sortableIds` to the component body with `useMemo`. The IIFE must be decomposed into explicit conditional branches.

```tsx
// Before the return statement:
const merged = useMemo(
  () => buildMergedTimeline(schedules, crossDayEntries),
  [schedules, crossDayEntries],
);
const sortableIds = useMemo(() => timelineSortableIds(merged), [merged]);
```

The IIFE currently handles the empty-list case with an early return. After extracting `merged`, rewrite as explicit conditionals:

```tsx
if (merged.length === 0) {
  return (
    <div ref={...} className={...}>
      <p ...>{MSG.EMPTY_SCHEDULE}</p>
    </div>
  );
}

return (
  <div>
    {/* header */}
    {selectionMode ? (
      <div className="space-y-1.5">
        {merged.map((item, i) => renderItem(item, i, { selectable: true }))}
      </div>
    ) : (
      <div ref={setDroppableRef}>
        <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
          ...
        </SortableContext>
      </div>
    )}
  </div>
);
```

---

## Fix 3: O(n²) → O(n) Schedule Lookup

**File:** `apps/web/components/day-timeline.tsx`

### Root Cause

Inside `renderItem`, two O(n) operations run per schedule item:

```tsx
// line 428 — O(n) per item → O(n²) total
const schedulesAfter = schedules.filter((s) => s.sortOrder > schedule.sortOrder);

// line 430 — O(n) per item → O(n²) total
const scheduleIdx = schedules.findIndex((s) => s.id === schedule.id);
```

`scheduleIdx` is used only for `reorderFirst`/`reorderLast` (mobile reorder mode). `schedulesAfter` is passed as `siblingSchedules` for the batch time-shift feature — it contains all schedules that follow the current one.

The `schedules` array is returned from the server in `sortOrder` order (the reorder API writes `sortOrder` sequentially). So `schedulesAfter` is equivalent to `schedules.slice(scheduleIdx + 1)`.

### Fix

Precompute a `Map<id, index>` with `useMemo`, then use `slice` for siblings:

```tsx
// Before the return statement:
const scheduleIndexById = useMemo(
  () => new Map(schedules.map((s, i) => [s.id, i])),
  [schedules],
);
```

Inside `renderItem`:

```tsx
// Before:
const schedulesAfter = schedules.filter((s) => s.sortOrder > schedule.sortOrder);
const scheduleIdx = schedules.findIndex((s) => s.id === schedule.id);

// After:
const scheduleIdx = scheduleIndexById.get(schedule.id) ?? -1;
const schedulesAfter = scheduleIdx >= 0 ? schedules.slice(scheduleIdx + 1) : [];
```

**Assumption:** `schedules` is ordered by `sortOrder` (guaranteed by the server response). This is the same assumption the existing `filter(s.sortOrder > ...)` relies on implicitly.

---

## Fix 4: Sensor Option Constants

**File:** `apps/web/lib/hooks/use-trip-drag-and-drop.ts`

### Root Cause

Sensor option objects are object literals created inline inside `useSensors`:

```ts
const sensors = useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),    // new object each render
  useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }), // new object each render
);
```

dnd-kit's `useSensor` stores the options in a ref and compares by reference. New object references on every render may cause sensor reconfiguration on every render.

### Fix

Move to module-level constants (outside the hook function):

```ts
// At the top of the file, before the hook:
const POINTER_SENSOR_OPTIONS = { activationConstraint: { distance: 8 } } as const;
const TOUCH_SENSOR_OPTIONS = {
  activationConstraint: { delay: 200, tolerance: 5 },
} as const;

// Inside the hook:
const sensors = useSensors(
  useSensor(PointerSensor, POINTER_SENSOR_OPTIONS),
  useSensor(TouchSensor, TOUCH_SENSOR_OPTIONS),
);
```

---

## Files Changed

| File | Changes |
|---|---|
| `apps/web/lib/hooks/use-trip-drag-and-drop.ts` | Fix 1 (race condition), Fix 4 (sensor constants) |
| `apps/web/components/day-timeline.tsx` | Fix 2 (memo), Fix 3 (O(n²) → O(n)) |

No new files. No API changes. No schema changes. No test infrastructure changes needed — existing E2E tests cover DnD behavior.

---

## Testing

### Manual regression checklist

Run with Slow 3G or artificial `setTimeout` on the API to make races observable:

- [ ] Schedule reorder (drag within timeline) → correct position, no revert
- [ ] Candidate → timeline (drag candidate to schedule) → appears at correct position
- [ ] Schedule → candidate panel (drag schedule to candidate panel) → schedule removed, candidate appears
- [ ] Candidate → candidate reorder → correct position, no revert
- [ ] Rapid successive drags (two drags before first API returns) → second drag is not reverted
- [ ] Mobile reorder (up/down buttons) → correct position, first/last correctly disabled
- [ ] Cross-day entry: drag schedule past cross-day entry → lands after cross-day block

### Automated

```bash
bun run --filter @sugara/web test
```

No unit test changes required — the logic is unchanged, only guard conditions and memoization are added.

E2E tests that cover DnD are in `apps/web/e2e/`. Run after changes:

```bash
bun run --filter @sugara/web e2e
```
