# Animation Enhancement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add smooth FLIP layout animations, mount animations, and DragOverlay drop animation to the DnD list components.

**Architecture:** Three independent changes to four files. No new libraries. All changes build on existing dnd-kit and tailwindcss-animate primitives already in the codebase.

**Tech Stack:** dnd-kit/sortable (`defaultAnimateLayoutChanges`), dnd-kit/core (`defaultDropAnimation`), tailwindcss-animate (`animate-in fade-in-0 slide-in-from-top-1`)

---

## Task 1: `animateLayoutChanges` on sortable items

When items are added/removed from the list (especially on approach-B null reset), surrounding items jump to their new positions. `animateLayoutChanges` enables FLIP animations so items slide instead of jump.

**Files:**
- Modify: `apps/web/components/schedule-item.tsx:19-25`
- Modify: `apps/web/components/candidate-item.tsx:95-99`

**Step 1: Update `schedule-item.tsx`**

Current `useSortable` call (lines 19-25):

```tsx
const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
  id: sortableId,
  disabled: disabled || selectable || reorderable || draggable === false,
  data: { type: "schedule" },
});
```

Change to:

```tsx
import { defaultAnimateLayoutChanges, useSortable } from "@dnd-kit/sortable";

const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
  id: sortableId,
  animateLayoutChanges: defaultAnimateLayoutChanges,
  disabled: disabled || selectable || reorderable || draggable === false,
  data: { type: "schedule" },
});
```

Note: `defaultAnimateLayoutChanges` is already exported from `@dnd-kit/sortable` (same package already imported). Only the import line and the `animateLayoutChanges` line change.

**Step 2: Update `candidate-item.tsx`**

Current `useSortable` call (lines 95-99):

```tsx
const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
  id: spot.id,
  disabled: !draggable || disabled || selectable || reorderable,
  data: { type: "candidate" },
});
```

Change to:

```tsx
import { defaultAnimateLayoutChanges, useSortable } from "@dnd-kit/sortable";

const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
  id: spot.id,
  animateLayoutChanges: defaultAnimateLayoutChanges,
  disabled: !draggable || disabled || selectable || reorderable,
  data: { type: "candidate" },
});
```

**Step 3: Run type check**

```bash
bun run check-types
```

Expected: no errors

**Step 4: Commit**

```bash
git add apps/web/components/schedule-item.tsx apps/web/components/candidate-item.tsx
git commit -m "feat: sortableアイテムにanimateLayoutChangesを追加"
```

---

## Task 2: Mount animation on list items

When a new item appears (candidate → timeline, or timeline → candidates), it should fade+slide in instead of popping instantly.

**Files:**
- Modify: `apps/web/components/schedule-items/place-item.tsx:153-158`
- Modify: `apps/web/components/schedule-items/transport-item.tsx:192-197`
- Modify: `apps/web/components/candidate-item.tsx:110-120`

The class `animate-in fade-in-0 slide-in-from-top-1 duration-200` is from `tailwindcss-animate` (already used in `LoadingBoundary`). It runs once on mount, does not repeat, and does not conflict with the dnd-kit `transition` inline style (CSS `animation` and CSS `transition` are separate properties).

**Step 1: Update `place-item.tsx`**

Current root div (line 153-158):

```tsx
<div
  ref={sortable.nodeRef}
  style={sortable.style}
  className={cn("flex gap-3 py-1.5", sortable.isDragging && "opacity-50")}
>
```

Change to:

```tsx
<div
  ref={sortable.nodeRef}
  style={sortable.style}
  className={cn(
    "animate-in fade-in-0 slide-in-from-top-1 duration-200",
    "flex gap-3 py-1.5",
    sortable.isDragging && "opacity-50",
  )}
>
```

**Step 2: Update `transport-item.tsx`**

Current root div (line 192-197):

```tsx
<div
  ref={sortable.nodeRef}
  style={sortable.style}
  className={cn("flex gap-3 py-0.5", sortable.isDragging && "opacity-50")}
>
```

Change to:

```tsx
<div
  ref={sortable.nodeRef}
  style={sortable.style}
  className={cn(
    "animate-in fade-in-0 slide-in-from-top-1 duration-200",
    "flex gap-3 py-0.5",
    sortable.isDragging && "opacity-50",
  )}
>
```

**Step 3: Update `candidate-item.tsx`**

Current root div (lines 110-120):

```tsx
const cardElement = (
  <div
    ref={setNodeRef}
    style={style}
    className={cn(
      "flex items-center gap-2 rounded-md border p-3",
      isDragging && "opacity-50",
      selectable &&
        "cursor-pointer transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      selectable && selected && SELECTED_RING,
    )}
```

Change to:

```tsx
const cardElement = (
  <div
    ref={setNodeRef}
    style={style}
    className={cn(
      "animate-in fade-in-0 slide-in-from-top-1 duration-200",
      "flex items-center gap-2 rounded-md border p-3",
      isDragging && "opacity-50",
      selectable &&
        "cursor-pointer transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      selectable && selected && SELECTED_RING,
    )}
```

**Step 4: Run type check and lint**

```bash
bun run check-types && bun run --filter @sugara/web check
```

Expected: no errors

**Step 5: Commit**

```bash
git add apps/web/components/schedule-items/place-item.tsx \
  apps/web/components/schedule-items/transport-item.tsx \
  apps/web/components/candidate-item.tsx
git commit -m "feat: リストアイテムにマウントアニメーションを追加"
```

---

## Task 3: DragOverlay drop animation

When a drag completes, the DragOverlay should animate to the drop target's position instead of disappearing at the cursor.

**File:**
- Modify: `apps/web/app/(authenticated)/trips/[id]/page.tsx`

**Step 1: Locate the DragOverlay import**

Find the import line for `DragOverlay` in the file. It looks like:

```tsx
import {
  DndContext,
  DragOverlay,
  ...
} from "@dnd-kit/core";
```

Add `defaultDropAnimation` to this import:

```tsx
import {
  defaultDropAnimation,
  DndContext,
  DragOverlay,
  ...
} from "@dnd-kit/core";
```

**Step 2: Add `dropAnimation` prop to DragOverlay**

Find the `<DragOverlay>` tag in the file. It currently has no `dropAnimation` prop:

```tsx
<DragOverlay>
  {dnd.activeDragItem && ...}
</DragOverlay>
```

Change to:

```tsx
<DragOverlay dropAnimation={defaultDropAnimation}>
  {dnd.activeDragItem && ...}
</DragOverlay>
```

**Step 3: Run type check**

```bash
bun run check-types
```

Expected: no errors

**Step 4: Commit**

```bash
git add "apps/web/app/(authenticated)/trips/[id]/page.tsx"
git commit -m "feat: DragOverlayにドロップアニメーションを追加"
```

---

## Visual smoke test (after all tasks)

Open the app in dev mode and test with a real browser:

```bash
bun run --filter @sugara/web dev
```

Verify each scenario:

- [ ] **Drag schedule within timeline**: while hovering, other items smoothly slide to make room (not jump)
- [ ] **Drop schedule onto candidates**: schedule slides out of timeline, new candidate slides into the panel
- [ ] **Drop candidate onto timeline**: candidate slides out of panel, new schedule slides into the timeline
- [ ] **Cancel drag (Escape key)**: DragOverlay animates back (if visible)
- [ ] **Successful drop**: DragOverlay flies to the drop position before disappearing
- [ ] **API error (simulate with DevTools → block network request)**: items roll back with smooth FLIP, no jump
- [ ] **Initial page load**: after skeleton fades out, schedule items fade+slide in
