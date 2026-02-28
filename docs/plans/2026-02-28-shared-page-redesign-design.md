# Shared Page Redesign Design

## Overview

Redesign the shared trip page (`/shared/[token]`) to improve visual quality and information richness. The current page is a minimal flat list; this redesign introduces a hero section, a timeline-style day view, and richer schedule cards. OGP/SNS link card support is planned as a follow-up phase.

## Scope

**Phase 1 (this plan):** Visual redesign — hero section, timeline layout, schedule cards, day memos.

**Phase 2 (future):** OGP meta tags + dynamic og:image generation for SNS link card previews.

## Design

### Hero Section

Replace the current minimal header area with a visually distinct hero block.

- Background: `bg-card border-b` to separate from day list
- Status badge moved to top
- Trip title: `text-3xl font-bold`
- Destination and date range displayed with icons in a row

```
[status badge]
Trip title (large)
📍 Destination  📅 Mar 15 – Mar 18  4 days
```

### Day Timeline

Replace the flat `divide-y` list with a vertical timeline layout.

- Day card header: `bg-muted/50` with left border accent (colored by day number mod palette)
- Left vertical line connecting schedule items within a day
- Each schedule item has a dot marker on the left edge
- Day memo displayed at the bottom of each day card if present

```
1日目  March 15 (Sun)
│
●  09:00  Shin-Chitose Airport   [icon]
│         → Sapporo (train)
│
●  12:00  Susukino Lunch         [icon]
│         📍 address...
│
[day memo]
```

### Schedule Cards

Replace bare rows with lightly styled cards.

- Each schedule: `rounded-md bg-background shadow-sm` with padding
- Category icon: rounded square instead of circle (visual refresh)
- Time: `tabular-nums text-muted-foreground`
- Spot name: `font-medium`
- Detail rows (address, URL, memo) shown without expand/collapse, same as current

### Data Requirements

No backend changes required. All data is already returned by `GET /api/shared/:token`:

- `trip.title`, `trip.destination`, `trip.startDate`, `trip.endDate`, `trip.status`
- `day.dayNumber`, `day.date`, `day.memo` (already in `DayResponse`)
- `pattern.schedules[].{name, startTime, endTime, category, color, address, urls, memo, ...}`

### Files to Change

- `apps/web/app/shared/[token]/page.tsx` — full redesign of layout and components

### What Does Not Change

- API endpoint and response shape
- Real-time update banner (keep as-is)
- Error and loading states (keep structure, minor style polish acceptable)
- Routing and authentication behavior

## Phase 2: OGP / SNS Link Card (Future)

When implemented:

- Convert `/shared/[token]/page.tsx` from `"use client"` to a split Server + Client Component architecture
- Add `generateMetadata()` to set `og:title`, `og:description` per token
- Add `/api/og` endpoint using `@vercel/og` for dynamic og:image generation
- Image content: trip title, destination, date range on a branded background
