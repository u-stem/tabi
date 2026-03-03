# User Menu UX Redesign

## Problem

The SP user menu uses a right-side Sheet drawer, which is an outdated pattern. Modern mobile apps (Instagram, TikTok, Twitter/X) place account access in the bottom navigation bar. The desktop dropdown also feels cramped due to default shadcn/ui sizing.

## Goals

- SP: Align with 2026 de facto mobile UX — account tab in bottom nav, bottom sheet for menu content
- Desktop: Improve readability and perceived quality by adding spacing and a richer user info header

## SP Changes

### Bottom Navigation

Add a fourth tab to `SpBottomNav` displaying the user's `UserAvatar`. The tab appears after Friends. Guest users see no avatar tab (consistent with existing guest handling).

```
[Home] [Bookmarks] [Friends] [Avatar]
```

### User Menu Trigger

Remove the avatar button from `SpHeader`. The header becomes: Logo + NotificationBell + ThemeToggle only.

Tapping the avatar tab opens a bottom sheet (`Sheet` with `side="bottom"`). The sheet content is identical to the current right-side sheet — no menu items are added or removed.

### Sheet Direction

Change `side="right"` to `side="bottom"` on the `SheetContent`. The sheet state (`mobileMenuOpen`) moves from `SpHeader` into `SpBottomNav` (or a shared context/prop if cleaner).

## Desktop Changes

All changes are scoped to `header.tsx`. The shared `dropdown-menu.tsx` component is not modified.

### Menu Width

Add `w-56` to `DropdownMenuContent` className to override the default `min-w-[8rem]`.

### Item Spacing

Pass `className="py-2"` to each `DropdownMenuItem` to increase vertical padding from 6 px to 8 px.

### User Info Header

Replace the plain `DropdownMenuLabel` with a richer header showing:
- `UserAvatar` (same size as the trigger button, h-8 w-8)
- Name (bold, truncated)
- Username with `@` prefix (muted, truncated)

## Out of Scope

- Menu item content changes (no items added or removed)
- Desktop navigation structure
- Animation or transition customization beyond what Sheet provides
