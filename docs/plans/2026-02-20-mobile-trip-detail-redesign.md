# Mobile Trip Detail Redesign (v2)

## Context

The trip detail page currently adapts desktop UI for mobile by hiding the right panel and exposing it via a centered Dialog (`MobileCandidateDialog`). This results in poor mobile UX: cramped dialogs, small touch targets, no native-feeling gestures, and the right panel (candidates/bookmarks/expenses/history) being inaccessible without opening a modal.

This redesign creates a proper smartphone-app-like experience for the trip detail page while leaving the desktop layout unchanged.

## Design Principles

- Follow smartphone app de facto patterns (bottom sheets, swipe actions, FAB)
- Each section gets full viewport space (no modals for primary content)
- Thumb-reachable interactions (bottom-aligned controls)
- Desktop UI remains unchanged (`lg:` breakpoint separates layouts)
- Maximize content area: minimize fixed chrome, use collapsible/contextual UI

## Vertical Space Budget

Target devices and viewport heights:

| Device | Viewport Height |
|--------|----------------|
| iPhone SE | 667px |
| iPhone 14 | 844px |
| iPhone 16 Pro Max | 932px |
| Android small (Galaxy A) | 760px |

### Fixed Chrome (always visible)

| Element | Height | Notes |
|---------|--------|-------|
| App header | 56px | `h-14` |
| Content tabs | 40px | Schedule/Candidates/Expenses |
| Bottom nav | 48px + safe area (~34px) | `h-12` + env(safe-area-inset-bottom) |
| **Total fixed** | **~178px** | |

### Contextual Chrome (Schedule tab only)

| Element | Height | Notes |
|---------|--------|-------|
| Day tabs | 37px | Horizontal scroll tabs |
| **Total with day tabs** | **~215px** | |

### Available Content Area

| Device | Schedule tab | Candidates/Expenses tab |
|--------|-------------|------------------------|
| iPhone SE | **452px** | **489px** |
| iPhone 14 | **629px** | **666px** |
| Android small | **545px** | **582px** |

iPhone SE on Schedule tab: 452px. Timeline card ~80px each = 5-6 cards visible. Acceptable.

### Space Optimization: Compact Trip Header

Current TripHeader uses ~128px (title + subtitle + action buttons + mb-6). On mobile, this must be compressed:

```
+-----------------------------+
| <- Trip Title          ...  |  1 line: back + title + menu (44px)
+-----------------------------+
```

- Back button (arrow-left) + trip title (truncated) + "..." menu in a single row
- Subtitle (destination/dates) moved into the "..." menu or shown as a subtitle under the title if short
- TripActions (status, members, share) moved into "..." dropdown menu
- Presence avatars shown as small overlay on title row
- Total height: **44px** (down from ~128px)

This saves ~84px, making the Schedule tab content area:
- iPhone SE: **536px** (6-7 cards)
- iPhone 14: **713px** (8-9 cards)

## 1. Trip Detail Page Layout (Mobile)

Replace the current "left panel + dialog" pattern with a tab-based layout.

```
+-----------------------------+
| <- Trip Title          ...  |  Compact header (44px)
+-----------------------------+
| [予定]   [候補]    [費用]   |  Content tabs (40px)
+-----------------------------+
| [1日目] [2日目] [3日目] ->  |  Day tabs (Schedule tab only, 37px)
+-----------------------------+
|                             |
|  Full-screen content        |
|  (scrollable)               |
|                             |
|                             |
|                        [+]  |  FAB (overlay)
+-----------------------------+
| [Home] [Bookmarks] [Friends]|  Bottom nav (48px + safe area)
+-----------------------------+
```

### Content Tabs

Three tabs at the trip level, visible only on mobile (`lg:hidden`):

| Tab | Label | Content |
|-----|-------|---------|
| Schedule | 予定 | Day tabs + DayTimeline |
| Candidates | 候補 | CandidatePanel (full screen) |
| Expenses | 費用 | ExpensePanel (full screen) |

- Bookmarks and Activity log accessible from the "..." menu in compact header
- Day tabs appear **only** when Schedule tab is active
- Each tab preserves scroll position independently (see Section 10)

### Pattern Tabs (Schedule Tab)

Problem: adding pattern tabs creates a 3rd layer of tabs (Content → Day → Pattern), consuming space and causing cognitive overload.

Solution: pattern tabs are shown **inline with the day timeline toolbar**, not as a separate row.

- If only 1 pattern (most common): no pattern UI shown at all
- If 2+ patterns: a dropdown button in the toolbar shows current pattern name
  - Tapping opens a compact Drawer with pattern list + add/rename/delete actions
  - Example: `[11/3 (月)] [メインプラン v] ... [+]`

This eliminates the 3rd tab row entirely.

### Candidate-to-Schedule Assignment

When tapping "予定に追加" on a candidate:

**Fast path (single pattern + last viewed day is clear):**
- Add directly to last viewed day/pattern
- Show undo toast: "2日目に追加しました [取消]"
- No Drawer, no extra taps

**Full path (multiple patterns or no clear default):**
- Drawer opens with day picker:

```
+-----------------------------+
|  === (Drawer handle)        |
|                             |
|  どの日に追加しますか？      |
|                             |
|  o 1日目 (11/3 月)         |
|  * 2日目 (11/4 火)  <- last |
|  o 3日目 (11/5 水)         |
|                             |
|  Pattern: [Main Plan v]    |
|                             |
|  [追加する]                  |
+-----------------------------+
```

**Long press on "予定に追加":** always opens the Drawer (for users who want to choose a different day).

## 2. Dialogs -> Drawers (Bottom Sheet)

All form dialogs use `Drawer` (bottom sheet) on mobile, `Dialog` on desktop.

### Responsive Dialog Component

Create `ResponsiveDialog` that switches rendering based on device:

```tsx
// useIsMobile() = true  → Drawer (slides up, swipe down to close)
// useIsMobile() = false → Dialog (centered modal, unchanged)
```

Uses `useIsMobile()` hook (media query `max-width: 768px`, SSR-safe with `useEffect`).

### Drawer Size Strategy

| Type | Snap Points | Use Case |
|------|-------------|----------|
| Compact | [0.4, 0] | Confirmations, simple inputs (AlertDialog, AddPattern, Rename) |
| Standard | [0.7, 0] | Short forms (Share, day picker) |
| Full | [0.92, 0.5, 0] | Long forms (AddSchedule, Expense, Member). Opens at 92%, can be pulled down to 50% to peek at content behind |

### Keyboard Handling

When a text input inside a Drawer receives focus and the mobile keyboard appears:

- Drawer snaps to max height (92vh) automatically
- Submit/save button is sticky at the Drawer bottom (`sticky bottom-0`)
- `visualViewport` API detects keyboard height for precise positioning
- Input auto-scrolls into view within the Drawer's scroll container

### Safe Area

All Drawers add `pb-[env(safe-area-inset-bottom)]` to their content area to avoid the iPhone home indicator overlapping interactive elements.

### Target Dialogs

| Dialog | Drawer Type | Notes |
|--------|-------------|-------|
| AddScheduleDialog | Full | Many fields, keyboard interaction |
| EditScheduleDialog | Full | Same as Add |
| AddCandidateDialog | Full | Same as Add |
| EditCandidateDialog | Full | Same as Add |
| ExpenseDialog | Full | Amount input + member checkboxes |
| MemberDialog | Full | Member list + add section |
| CreateTripDialog | Full | Title + date range |
| EditTripDialog | Full | Title + date range |
| ShareDialog | Standard | QR code + link copy |
| AlertDialogs | Compact | Confirmation with 2 buttons |
| AddPatternDialog | Compact | Single text input |
| RenamePatternDialog | Compact | Single text input |
| DeletePatternDialog | Compact | Confirmation |

### Action Sheet Pattern

Context menus (currently DropdownMenu with "..." button) become Drawer-based action sheets on mobile:

```
+-----------------------------+
|  === (Drawer handle)        |
|                             |
|  [  編集               ]    |  h-12 (48px) each
|  [  候補に戻す          ]    |  full-width buttons
|  [  ブックマークに保存   ]    |
|  [  削除 (red)          ]    |
|                             |
|  [  キャンセル           ]    |
|                             |
|  (safe area padding)        |
+-----------------------------+
```

- Each action button: `h-12` (48px) for comfortable touch
- Destructive actions at bottom in red
- Cancel button separated with extra margin

### Offline Handling in Drawers

- Drawer forms disable the submit button when offline
- If connection drops while Drawer is open: show inline warning banner at top of Drawer
- Form submission errors show inline error message (not a separate toast), with retry button
- Swipe-to-close remains available regardless of connection state

## 3. Swipe Actions on Cards

Add swipe-to-reveal actions on schedule and candidate cards using `@use-gesture/react`.

### Schedule Card (PlaceCard)

Left swipe reveals:

| Action | Color | Icon |
|--------|-------|------|
| Edit | Blue | Pencil |
| Delete | Red | Trash |

### Candidate Card

Left swipe reveals:

| Action | Color | Icon |
|--------|-------|------|
| Add to schedule | Blue | Plus |
| Delete | Red | Trash |

### Gesture Conflict Prevention

- **Edge exclusion**: Swipe gestures are ignored if touch starts within 20px of screen edges (prevents conflict with iOS Safari back gesture)
- **Angle threshold**: Only register as horizontal swipe if initial movement angle is within 20 degrees of horizontal; steeper angles pass through to vertical scroll
- **Day tabs isolation**: Swipe detection is only active within the scrollable content area, not in the tab bar regions
- **Single active swipe**: Only one card can be in "revealed" state at a time. Opening a new card's actions auto-closes the previous one (iOS Mail behavior)
- **Scroll cancel**: If vertical scroll begins during a horizontal swipe attempt, cancel the swipe

### Swipe Behavior

- **Partial swipe (> 80px)**: Reveal action buttons, card stays open until tapped elsewhere or another card is swiped
- **Full swipe is NOT supported**: All actions require explicit button tap after reveal. This prevents accidental destructive actions
- **Touch action**: `pan-y` on the card to preserve vertical scrolling
- **Reset**: Tapping anywhere outside the revealed card closes it
- Haptic feedback via `navigator.vibrate()` when action buttons are revealed

### Accessibility

- Swipe actions are a convenience shortcut only
- The "..." menu button remains on every card as the accessible alternative
- On mobile, "..." opens ActionSheet (Drawer); on desktop, opens DropdownMenu (unchanged)
- Screen reader users access actions exclusively through the "..." menu

## 4. Schedule Reorder (Mobile)

Replace drag-and-drop (desktop-only effective) with explicit reorder mode on mobile.

### Reorder Mode

Triggered by toolbar "並び替え" button:

```
+---------------------------------+
|  並び替え中              [完了] |
+---------------------------------+
|  = Tokyo Tower        [^] [v]  |
|  = Senso-ji           [^] [v]  |
|  = Skytree            [^] [v]  |
+---------------------------------+
```

- **Primary method**: Touch drag via dnd-kit `TouchSensor` with `activationConstraint: { delay: 200, tolerance: 5 }` (prevents accidental drags during scroll)
- **Secondary method**: Up/Down arrow buttons for precise one-position moves (also serves as accessibility fallback)
- Grip handle (=) as visual drag indicator
- "完了" button exits reorder mode
- Swipe actions are disabled during reorder mode
- Haptic feedback on each position change

## 5. FAB (Floating Action Button)

Context-aware fixed button, mobile only (`lg:hidden`):

```
Position: fixed, right-4, bottom = bottom-nav height + safe area + 16px
Size: 56px circle (meets 44px minimum with margin)
Shadow: shadow-lg for elevated appearance
z-index: z-30 (below bottom nav z-40, below drawers z-50)
```

| Active Tab | FAB Action | Icon |
|-----------|------------|------|
| Schedule | Add schedule | Plus |
| Candidates | Add candidate | Plus |
| Expenses | Add expense | Plus |

- Hidden when: no edit permission, offline, at item limit, in reorder mode, in selection mode
- Opens corresponding Drawer form on tap
- Haptic feedback on tap (Android)
- Animation: scale-in on tab switch, scale-out when hidden

## 6. Touch-Friendly Selects

Replace Radix Select with Drawer-based list picker on mobile for visual consistency:

```
+-----------------------------+
|  === (Drawer handle)        |
|                             |
|  カテゴリを選択              |
|                             |
|    観光                     |
|  * レストラン        <- selected
|    ホテル                    |
|    交通                     |
|    その他                    |
|                             |
+-----------------------------+
```

| Component | Mobile | Desktop |
|-----------|--------|---------|
| Status select | Drawer list picker | Radix Select (unchanged) |
| Category select | Drawer list picker | Radix Select (unchanged) |
| Role select | Drawer list picker | Radix Select (unchanged) |
| Transport method | Drawer list picker | Radix Select (unchanged) |

Drawer list picker maintains visual consistency with the app's design system (unlike native `<select>` which uses OS-specific styling that clashes with shadcn/ui theme).

For complex selections (member picker, bookmark list), use Drawer + Command (cmdk) pattern.

### Responsive Select Component

Create `ResponsiveSelect` that switches between Radix Select (desktop) and Drawer list picker (mobile), with the same API surface.

## 7. Date Picker Mobile Optimization

Current: Popover + Calendar (small touch targets).
Mobile: Drawer + Calendar (full-width, larger targets).

```
+-----------------------------+
|  === (Drawer handle)        |
|                             |
|       < 2026年 2月 >        |
|  月  火  水  木  金  土  日  |
|  ..  ..   1   2   3   4   5 |  min-h-[44px] per row
|   6   7   8   9  10  11  12 |  for touch targets
|  13  14  15  16  17  18  19 |
|  20  21  22  23  24  25  26 |
|  27  28                      |
+-----------------------------+
```

Calendar cells get `min-h-[44px] min-w-[44px]` to meet touch target requirements.

## 8. Haptic Feedback

Utility for vibration feedback (Android only; iOS does not support Web Vibration API):

```tsx
// lib/haptics.ts
export const haptics = {
  light: () => navigator?.vibrate?.(10),
  medium: () => navigator?.vibrate?.(20),
  heavy: () => navigator?.vibrate?.([30, 10, 30]),
  success: () => navigator?.vibrate?.([10, 50, 10]),
  error: () => navigator?.vibrate?.([50, 30, 50, 30, 50]),
};
```

Trigger points:
- Swipe action buttons revealed (light)
- FAB tap (light)
- Destructive action confirmation (heavy)
- Reorder item position change (light)
- Undo toast shown (success)

Note: iOS users get no haptic feedback from this API. Visual feedback (animations, color changes) must be sufficient on its own. Haptics are an enhancement, not a requirement.

## 9. Tab Switching

### Animation

Tab content switches with a **horizontal slide** animation:
- Moving to a tab on the right: content slides in from right
- Moving to a tab on the left: content slides in from left
- Duration: 200ms, ease-out
- Implemented with CSS transform + transition (no animation library needed)

### Empty States

Each tab shows a contextual empty state when no content exists:

| Tab | Empty State |
|-----|-------------|
| Schedule (no schedules on selected day) | Illustration + "まだ予定がありません" + "予定を追加" button |
| Candidates (no candidates) | Illustration + "候補がありません" + "候補を追加" button |
| Expenses (no expenses) | Illustration + "費用が登録されていません" + "費用を追加" button |

Empty state buttons serve as an alternative to FAB for discoverability.

### Loading States

- Tab switch within already-loaded data: instant (no loading state)
- Initial page load: skeleton matching the active tab's layout
- Data refetch (e.g., after mutation): content remains visible, subtle loading indicator in tab badge

## 10. Scroll Position Preservation

Each tab maintains its own scroll position independently:

```tsx
// Store scroll position per tab
const scrollPositions = useRef<Record<string, number>>({});

// On tab switch: save current, restore target
function handleTabChange(newTab: string) {
  scrollPositions.current[currentTab] = scrollRef.current?.scrollTop ?? 0;
  setCurrentTab(newTab);
  // After render, restore scroll position
  requestAnimationFrame(() => {
    scrollRef.current?.scrollTo(0, scrollPositions.current[newTab] ?? 0);
  });
}
```

Within the Schedule tab, scroll position is also preserved per day:
- Switching from Day 1 to Day 2 saves Day 1's scroll position
- Returning to Day 1 restores it

## 11. Landscape Orientation

Minimal treatment to prevent breakage:

- Content tabs and bottom nav remain visible (no auto-hide)
- Content area will be small (~250-300px on landscape iPhone SE) but functional
- No landscape-specific layout changes in v1
- Future consideration: auto-hide header on scroll in landscape

## New Dependencies

| Package | Purpose | Size |
|---------|---------|------|
| `@use-gesture/react` | Swipe gestures, touch interactions | ~12KB (tree-shakeable) |

shadcn/ui `Drawer` component (vaul) needs to be added via `bunx shadcn@latest add drawer`. Other features use existing libraries or custom implementations.

### vaul Maintenance Note

vaul (Drawer's underlying library) has reduced maintenance as of late 2024. Mitigation:
- `ResponsiveDialog` provides an abstraction layer; if vaul needs replacement, only this component changes
- shadcn/ui's adoption of vaul provides community pressure for continued maintenance or forking
- Current vaul v1.1.2 is stable for our use case (basic bottom sheet with snap points)

## New Components / Hooks

| File | Type | Purpose |
|------|------|---------|
| `hooks/use-is-mobile.ts` | Hook | Media query based device detection (768px) |
| `components/ui/responsive-dialog.tsx` | Component | Dialog (desktop) / Drawer (mobile) switcher |
| `components/ui/responsive-select.tsx` | Component | Select (desktop) / Drawer list picker (mobile) |
| `components/action-sheet.tsx` | Component | iOS-style action menu using Drawer |
| `components/swipeable-card.tsx` | Component | Card wrapper with swipe-to-reveal actions |
| `components/fab.tsx` | Component | Floating action button |
| `components/mobile-content-tabs.tsx` | Component | Schedule/Candidates/Expenses tab bar |
| `components/day-picker-drawer.tsx` | Component | Day selection Drawer for candidate assignment |
| `components/pattern-picker-drawer.tsx` | Component | Pattern selection Drawer (for 2+ patterns) |
| `components/undo-toast.tsx` | Component | Undo action toast notification |
| `lib/haptics.ts` | Utility | Vibration feedback helpers |

## Files to Modify

| File | Changes |
|------|---------|
| `trips/[id]/page.tsx` | Mobile content tabs, FAB, tab state, scroll preservation, compact header |
| `trips/[id]/_components/trip-header.tsx` | Compact mobile variant (1-line), move actions to menu |
| `trips/[id]/_components/trip-dialogs.tsx` | Remove `MobileCandidateDialog` |
| `trips/[id]/_components/right-panel.tsx` | Extract tab content for reuse by both desktop panel and mobile tabs |
| `trips/[id]/_components/pattern-tabs.tsx` | Mobile: dropdown in toolbar instead of tab row |
| `components/day-timeline.tsx` | Reorder mode, swipeable cards, pattern dropdown |
| `components/schedule-item.tsx` | Wrap in SwipeableCard on mobile |
| `components/candidate-panel.tsx` | Swipeable cards, fast-path assignment + undo |
| `components/candidate-card.tsx` | Swipeable wrapper |
| `components/expense-panel.tsx` | Mobile layout adjustments |
| `components/add-schedule-dialog.tsx` | Use ResponsiveDialog |
| `components/add-candidate-dialog.tsx` | Use ResponsiveDialog |
| `components/expense-dialog.tsx` | Use ResponsiveDialog |
| `components/member-dialog.tsx` | Use ResponsiveDialog |
| `components/create-trip-dialog.tsx` | Use ResponsiveDialog |
| `components/edit-trip-dialog.tsx` | Use ResponsiveDialog |
| `components/share-dialog.tsx` | Use ResponsiveDialog |
| Various form selects | Use ResponsiveSelect |

## Implementation Order

### Phase 1: Foundation
1. Add `@use-gesture/react` dependency
2. Add shadcn/ui Drawer component (`bunx shadcn@latest add drawer`)
3. Create `useIsMobile` hook
4. Create `ResponsiveDialog` component
5. Create `ResponsiveSelect` component
6. Create `haptics` utility
7. Create `UndoToast` component

### Phase 2: Layout Restructure
8. Create compact mobile TripHeader variant
9. Create mobile content tabs (Schedule/Candidates/Expenses) with scroll preservation
10. Create pattern picker Drawer (replaces pattern tab row on mobile)
11. Restructure trip detail page for mobile tab layout
12. Remove `MobileCandidateDialog`
13. Create FAB component
14. Create day picker Drawer for candidate assignment with fast-path

### Phase 3: Dialog Migration
15. Migrate AddScheduleDialog -> ResponsiveDialog (Full Drawer)
16. Migrate EditScheduleDialog -> ResponsiveDialog (Full Drawer)
17. Migrate AddCandidateDialog -> ResponsiveDialog (Full Drawer)
18. Migrate ExpenseDialog -> ResponsiveDialog (Full Drawer)
19. Migrate MemberDialog -> ResponsiveDialog (Full Drawer)
20. Migrate remaining dialogs (CreateTrip, EditTrip, Share, AlertDialogs)

### Phase 4: Touch Interactions
21. Create SwipeableCard component with gesture conflict prevention
22. Add swipe actions to schedule cards (PlaceCard)
23. Add swipe actions to candidate cards
24. Create ActionSheet component (Drawer-based context menu)
25. Replace DropdownMenu with ActionSheet on mobile

### Phase 5: Reorder & Polish
26. Add reorder mode to DayTimeline (mobile) with TouchSensor
27. Replace Radix Select with ResponsiveSelect in all forms
28. Mobile date picker (Drawer + Calendar with 44px cells)
29. Haptic feedback integration at all trigger points
30. Touch target size audit (44px minimum)
31. Tab switch animation (horizontal slide)
32. Empty state designs for each tab
33. Real device testing (iPhone SE, iPhone 14+, Android)
