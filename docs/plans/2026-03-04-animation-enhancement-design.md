# Animation Enhancement Design

**Goal:** Add smooth animations to DnD list operations — item position changes, mount/unmount, and DragOverlay drop.

---

## Background

The app's core interaction is drag-and-drop scheduling (schedules ↔ candidates). Recent work:
- `LoadingBoundary` added 150ms fade-in on content transitions
- Approach B (null-based local state) replaced `useEffect` sync: `localSchedules: ScheduleResponse[] | null`, rendered as `localSchedules ?? schedules`

With approach B, when the API resolves, `localSchedules` resets to `null` and the display falls back to server state. Without `animateLayoutChanges`, items jump to their new positions during this transition.

---

## Change 1: `animateLayoutChanges` on sortable items

**Files:** `apps/web/components/schedule-item.tsx`, `apps/web/components/candidate-item.tsx`

### Root cause

`useSortable` accepts an `animateLayoutChanges` function that controls FLIP animations when the items array changes (items added, removed, or reordered outside of an active drag). Currently not set — items jump.

Key trigger: when approach B resets `localSchedules = null`, other items shift to fill the gap. Without `animateLayoutChanges`, this is instantaneous.

### Fix

Add `animateLayoutChanges: defaultAnimateLayoutChanges` to both sortable items:

```tsx
import { defaultAnimateLayoutChanges, useSortable } from "@dnd-kit/sortable";

const { ... } = useSortable({
  id: sortableId,
  animateLayoutChanges: defaultAnimateLayoutChanges,
  // ... existing options unchanged
});
```

`defaultAnimateLayoutChanges` returns `true` when not sorting and `false` during active sort (avoids double-animating during drag). This matches dnd-kit's recommended usage.

Effect: after a successful drop (B resets to server state) or on error rollback, surrounding items smoothly slide to their new positions via FLIP instead of jumping.

---

## Change 2: Mount animation on list items

**Files:** `apps/web/components/schedule-item.tsx`, `apps/web/components/candidate-item.tsx`

### Root cause

When a new item appears in the timeline (candidate → timeline drop) or candidate panel (timeline → candidates drop), it pops in instantly with no visual feedback.

### Fix

Add `animate-in fade-in-0 slide-in-from-top-1 duration-200` to the outermost wrapper div of each item's sortable render path. The `animate-in` class (from `tailwindcss-animate`, already used in `LoadingBoundary`) fires once on mount.

With approach B, React reconciles by item ID. A successfully dropped item that was already present (same ID) stays mounted — the animation only fires for genuinely new items. Initial page load also benefits (items fade in after `LoadingBoundary` reveals them).

The animation must not apply when `isDragging` (the source item is hidden during drag). Exclude with a conditional class:

```tsx
<div
  ref={setNodeRef}
  style={style}
  className={cn(
    "animate-in fade-in-0 slide-in-from-top-1 duration-200",
    isDragging && "opacity-0",
    // ... existing classes
  )}
>
```

---

## Change 3: DragOverlay drop animation

**File:** `apps/web/app/(authenticated)/trips/[id]/page.tsx`

### Root cause

`<DragOverlay>` has no `dropAnimation` prop set. The default dnd-kit behavior fades out the overlay at the cursor position. With an explicit `dropAnimation`, the overlay can animate to the drop target instead.

### Fix

Pass `defaultDropAnimation` explicitly (confirms intentional use and allows future customization):

```tsx
import { defaultDropAnimation } from "@dnd-kit/core";

<DragOverlay dropAnimation={defaultDropAnimation}>
```

`defaultDropAnimation` animates the overlay to the drop target's position over 250ms with `ease` easing — the overlay "flies" to where the item lands, giving clear feedback about where the item was placed.

---

## Files Changed

| File | Change |
|---|---|
| `apps/web/components/schedule-item.tsx` | `animateLayoutChanges`, mount animation class |
| `apps/web/components/candidate-item.tsx` | `animateLayoutChanges`, mount animation class |
| `apps/web/app/(authenticated)/trips/[id]/page.tsx` | `dropAnimation` on DragOverlay |

No new dependencies. No API changes. No schema changes.

---

## Testing

Visual smoke test — run with Slow 3G throttling:

- [ ] Drag schedule within timeline → other items slide to make room during drag, settle smoothly on drop
- [ ] Drop schedule onto candidates → schedule fades out of timeline, slides in to candidate panel
- [ ] Drop candidate onto timeline → candidate fades out of panel, slides in to timeline
- [ ] Cancel drag (Escape) → DragOverlay animates back
- [ ] API error → items roll back with smooth FLIP animation
- [ ] Initial page load → items fade in after skeleton

```bash
bun run --filter @sugara/web test
bun run check-types
```
