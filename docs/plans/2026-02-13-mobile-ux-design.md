# Mobile UX Design: App-like Experience

## Context

Current mobile navigation uses a hamburger menu in the header. All screen transitions require two taps (open menu, select destination). This design adds a bottom tab bar for primary navigation and applies additional mobile-native patterns to improve the app-like feel.

## Scope

1. Bottom tab bar for primary navigation
2. Header simplification on mobile
3. Safe area inset support (iPhone notch/home bar)
4. Pull-to-refresh on list pages
5. Long-press context menu on trip cards
6. Touch target size improvements
7. Active/tap state feedback on interactive elements

## 1. Bottom Tab Bar

New `BottomNav` component, visible only on mobile (`sm:hidden`) for authenticated users.

**Tabs** (reuse existing `NAV_LINKS`):

| Tab | Icon | Path |
|-----|------|------|
| Home | `Home` | `/home` |
| Shared trips | `Users` | `/shared-trips` |
| Friends | `UserPlus` | `/friends` |

**Behavior:**
- Fixed to bottom of viewport (`fixed bottom-0 inset-x-0`)
- Height: `h-14` (56px) plus safe area padding
- Active tab: primary color icon + label. Inactive: muted color icon + label
- Friend request badge on Friends tab (same as current header badge)
- Hidden on trip detail page print view (`print:hidden`)

**Files:** New `components/bottom-nav.tsx`, modify `app/(authenticated)/layout.tsx`

## 2. Header Changes on Mobile

Replace hamburger button with avatar button on mobile. Tapping avatar opens a Sheet with auxiliary items only (no nav links since bottom tab handles navigation).

**Mobile sheet contents** (reduced):
- User name + username header
- Settings link
- Feedback button
- Install app button (conditional)
- Logout button

**Desktop remains unchanged.**

**Files:** Modify `components/header.tsx`

## 3. Safe Area Insets

Support iPhone notch and home indicator bar.

**Changes:**
- `layout.tsx`: Add `viewport` metadata with `viewport-fit=cover`
- `globals.css`: Add `padding-bottom: env(safe-area-inset-bottom)` to bottom nav
- Bottom nav uses `pb-[env(safe-area-inset-bottom)]` via inline style

**Files:** Modify `app/layout.tsx`, `app/globals.css`

## 4. Pull-to-Refresh

Add pull-to-refresh gesture on Home and Shared Trips pages. Uses a lightweight custom hook that detects overscroll pull gesture at the top of the page and triggers TanStack Query invalidation.

**Implementation:**
- New hook `lib/hooks/use-pull-to-refresh.ts`
- Detects touchstart/touchmove/touchend when `scrollY === 0` and pulling down
- Shows a small spinner indicator at top of page
- On release past threshold (60px): calls `onRefresh` callback
- Callback invalidates relevant TanStack Query

**Files:** New `lib/hooks/use-pull-to-refresh.ts`, new `components/pull-to-refresh.tsx`, modify Home and Shared Trips pages

## 5. Long-Press Context Menu on Trip Cards

Long-press (500ms) on a trip card shows a context menu with quick actions, instead of requiring navigation to the detail page.

**Menu items:**
- Open (navigate to trip)
- Duplicate
- Delete (with confirmation)

**Implementation:**
- New hook `lib/hooks/use-long-press.ts` - returns touch event handlers
- Context menu uses `DropdownMenu` from shadcn/ui, positioned at touch point
- Only on mobile (desktop keeps hover-based interaction)

**Files:** New `lib/hooks/use-long-press.ts`, modify `components/trip-card.tsx`

## 6. Touch Target Sizes

Ensure all interactive elements meet 44px minimum tap target on mobile.

**Key areas:**
- `scroll-to-top.tsx`: `h-8 w-8` (32px) -> `h-10 w-10` on mobile
- Trip toolbar filter dropdowns: ensure `min-h-[44px]` on mobile
- Bottom nav tabs: each tab spans equal width with 44px+ height

**Files:** Modify `components/scroll-to-top.tsx`, `components/trip-toolbar.tsx`

## 7. Active State Feedback

Add `active:` states for touch feedback on mobile.

**Changes:**
- Trip cards: Add `active:scale-[0.98]` for press feedback
- Bottom nav tabs: Add `active:bg-accent` for tap feedback
- Buttons in bottom sheet: Add `active:bg-accent` states

**Files:** Modify `components/trip-card.tsx`, new `components/bottom-nav.tsx`

## Layout Changes

### `app/(authenticated)/layout.tsx`

Add bottom padding on mobile to prevent content from being hidden behind the bottom nav:

```tsx
<main className="container py-4 pb-20 sm:py-8 sm:pb-8">{children}</main>
```

The `pb-20` (80px) accounts for the 56px tab bar plus safe area.

### Print Mode

Bottom nav hidden via `print:hidden`. No changes to print page layout.

## Implementation Order

1. Safe area insets + viewport metadata (foundation)
2. Bottom tab bar + layout padding
3. Header mobile simplification
4. Active state feedback on cards/buttons
5. Touch target size improvements
6. Pull-to-refresh
7. Long-press context menu on trip cards
