# Shared Page Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign `/shared/[token]` to have a hero section, vertical timeline layout, and richer schedule cards — improving visual quality without backend changes.

**Architecture:** All changes are confined to `apps/web/app/shared/[token]/page.tsx`. The API already returns all required data (`day.memo`, full schedule fields). The page is a single-file Client Component with internal sub-components; we refactor those sub-components in place.

**Tech Stack:** Next.js 15, React 19, Tailwind CSS v4, shadcn/ui, lucide-react

---

## Reference

- Target file: `apps/web/app/shared/[token]/page.tsx`
- Color utilities: `apps/web/lib/colors.ts` — `SCHEDULE_COLOR_CLASSES`, `STATUS_COLORS`
- Icon map: `apps/web/lib/icons.ts` — `CATEGORY_ICONS`
- Shared types: `packages/shared/src/types.ts` — `DayResponse`, `DayPatternResponse`, `ScheduleResponse`
- Run lint: `bun run --filter @sugara/web check`
- Run type check: `bun run check-types`

---

## Task 1: Hero Section

Replace the plain title/meta row with a visually distinct hero block.

**Files:**
- Modify: `apps/web/app/shared/[token]/page.tsx`

**Step 1: Read the current file**

Open `apps/web/app/shared/[token]/page.tsx` and locate the section starting at line ~190 (the `return` of `SharedTripPage`). The current hero markup looks like:

```tsx
<div className="mb-8">
  <div className="flex flex-wrap items-center gap-2">
    <h1 ...>{trip.title}</h1>
    <Badge ...>{STATUS_LABELS[trip.status]}</Badge>
  </div>
  <div className="mt-1 flex flex-wrap items-center gap-x-3 ...">
    <span>📍 {trip.destination}</span>
    <span>📅 {formatDateRange(...)}<span>({dayCount}日間)</span></span>
  </div>
  {trip.shareExpiresAt && <p>共有リンクの有効期限: ...</p>}
</div>
```

**Step 2: Replace the hero markup**

Replace the `<div className="mb-8">` block with:

```tsx
{/* Hero */}
<div className="mb-8 rounded-xl border bg-card px-6 py-6 shadow-sm">
  <Badge variant="outline" className={cn("mb-3 w-fit", STATUS_COLORS[trip.status])}>
    {STATUS_LABELS[trip.status]}
  </Badge>
  <h1 className="break-words text-2xl font-bold sm:text-3xl">{trip.title}</h1>
  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
    {trip.destination && (
      <span className="flex items-center gap-1.5">
        <MapPin className="h-4 w-4 shrink-0" />
        {trip.destination}
      </span>
    )}
    <span className="flex items-center gap-1.5">
      <Calendar className="h-4 w-4 shrink-0" />
      {formatDateRange(trip.startDate, trip.endDate)}
      <span className="text-xs">（{dayCount}日間）</span>
    </span>
  </div>
  {trip.shareExpiresAt && (
    <p className="mt-3 text-xs text-muted-foreground">
      共有リンクの有効期限: {formatDateFromISO(trip.shareExpiresAt)}
    </p>
  )}
</div>
```

Note: `Badge` is already imported. `STATUS_LABELS`, `STATUS_COLORS`, `MapPin`, `Calendar`, `formatDateRange`, `formatDateFromISO`, `getDayCount`, `cn` are already imported.

**Step 3: Lint and type check**

```bash
bun run --filter @sugara/web check
bun run check-types
```

Expected: no errors (1 existing warning about `document.cookie` in `lib/view-mode.ts` is pre-existing and unrelated).

**Step 4: Commit**

```bash
git add apps/web/app/shared/[token]/page.tsx
git commit -m "feat(shared): ヒーローセクションを追加"
```

---

## Task 2: Day Card Header Styling

Give each day's section header a stronger visual identity.

**Files:**
- Modify: `apps/web/app/shared/[token]/page.tsx` (the `SharedTripPage` component's day map)

**Step 1: Locate the day card markup**

Find the section starting around line ~232:

```tsx
<section key={day.id} className="rounded-lg border bg-card p-4 sm:p-5">
  <h3 className="mb-3 flex items-center gap-2 text-base font-semibold">
    {day.dayNumber}日目
    <span className="text-sm font-normal text-muted-foreground">
      {formatDate(day.date)}
    </span>
  </h3>
  {(day.patterns ?? []).map((pattern, i) => (
    <PatternSection ... />
  ))}
</section>
```

**Step 2: Replace the section and header**

```tsx
<section key={day.id} className="overflow-hidden rounded-xl border bg-card shadow-sm">
  <div className="border-b bg-muted/40 px-4 py-3 sm:px-5">
    <h3 className="flex items-center gap-2 text-sm font-semibold">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-foreground text-[11px] font-bold text-background">
        {day.dayNumber}
      </span>
      <span>{formatDate(day.date)}</span>
      <span className="text-muted-foreground">
        {(() => {
          const d = new Date(day.date);
          return ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
        })()}曜日
      </span>
    </h3>
  </div>
  <div className="p-4 sm:p-5">
    {(day.patterns ?? []).map((pattern, i) => (
      <PatternSection ... />
    ))}
  </div>
</section>
```

**Step 3: Lint and type check**

```bash
bun run --filter @sugara/web check
bun run check-types
```

**Step 4: Commit**

```bash
git add apps/web/app/shared/[token]/page.tsx
git commit -m "feat(shared): 日程カードヘッダーを改善"
```

---

## Task 3: Timeline Layout for Schedule Items

Add a vertical connecting line + dot markers to the schedule list within each day.

**Files:**
- Modify: `apps/web/app/shared/[token]/page.tsx` (the `PatternSection` component)

**Step 1: Locate `PatternSection`**

Find the `PatternSection` function. The relevant output is:

```tsx
<div className="divide-y">
  {merged.map((item) =>
    item.type === "crossDay" ? (
      <ScheduleCard key={...} ... crossDayDisplay crossDayPosition={...} />
    ) : (
      <ScheduleCard key={...} ... />
    ),
  )}
</div>
```

**Step 2: Wrap items in a timeline container**

Replace the `<div className="divide-y">` block with:

```tsx
<div className="relative space-y-1">
  {/* Vertical timeline line */}
  {merged.length > 1 && (
    <div className="absolute left-[11px] top-4 bottom-4 w-px bg-border" aria-hidden />
  )}
  {merged.map((item) =>
    item.type === "crossDay" ? (
      <ScheduleCard key={`cross-${item.entry.schedule.id}`} schedule={item.entry.schedule} dayDate={dayDate} crossDayDisplay crossDayPosition={item.entry.crossDayPosition} />
    ) : (
      <ScheduleCard key={item.schedule.id} schedule={item.schedule} dayDate={dayDate} />
    ),
  )}
</div>
```

Note: The dot itself will be added in Task 4 when we update `ScheduleCard`.

**Step 3: Lint and type check**

```bash
bun run --filter @sugara/web check
bun run check-types
```

**Step 4: Commit**

```bash
git add apps/web/app/shared/[token]/page.tsx
git commit -m "feat(shared): タイムライン縦線を追加"
```

---

## Task 4: Schedule Card Visual Refresh

Replace the circle icon with a dot marker aligned to the timeline line, and give each card a subtle card style.

**Files:**
- Modify: `apps/web/app/shared/[token]/page.tsx` (the `ScheduleCard` component)

**Step 1: Locate `ScheduleCard` return**

Find the `return (` of `ScheduleCard`. Current markup starts with:

```tsx
<div className={cn("flex items-start gap-2 px-3 py-2", crossDayDisplay && "bg-muted/30")}>
  <div
    className={cn(
      "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white",
      colorClasses.bg,
    )}
  >
    <CategoryIcon className="h-3 w-3" />
  </div>
  <div className="min-w-0 flex-1">
    ...
  </div>
</div>
```

**Step 2: Replace with timeline-aligned card style**

```tsx
<div
  className={cn(
    "relative flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors",
    crossDayDisplay ? "bg-muted/40" : "hover:bg-muted/30",
  )}
>
  {/* Dot marker — aligns with the vertical line in PatternSection */}
  <div
    className={cn(
      "relative z-10 mt-0.5 flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-md text-white",
      colorClasses.bg,
    )}
  >
    <CategoryIcon className="h-3 w-3" />
  </div>
  <div className="min-w-0 flex-1">
    ...
  </div>
</div>
```

Note: `h-5.5 w-5.5` is valid in Tailwind v4. If it doesn't render, fall back to `h-5 w-5`.

**Step 3: Lint and type check**

```bash
bun run --filter @sugara/web check
bun run check-types
```

**Step 4: Commit**

```bash
git add apps/web/app/shared/[token]/page.tsx
git commit -m "feat(shared): スケジュールカードを角丸+ホバースタイルに変更"
```

---

## Task 5: Day Memo Display

Show `day.memo` at the bottom of each day's content area.

**Files:**
- Modify: `apps/web/app/shared/[token]/page.tsx` (day map in `SharedTripPage`)

**Step 1: Locate where patterns are rendered**

In the day map inside `SharedTripPage`, find the inner `<div className="p-4 sm:p-5">` added in Task 2. It currently contains only the patterns map.

**Step 2: Add memo below the patterns**

```tsx
<div className="p-4 sm:p-5">
  {(day.patterns ?? []).map((pattern, i) => (
    <PatternSection
      key={pattern.id}
      pattern={pattern}
      dayDate={day.date}
      showLabel={(day.patterns ?? []).length > 1}
      crossDayEntries={i === 0 ? crossDayEntries : undefined}
    />
  ))}
  {day.memo && (
    <div className="mt-3 flex items-start gap-2 border-t pt-3 text-sm text-muted-foreground">
      <StickyNote className="mt-0.5 h-4 w-4 shrink-0" />
      <p className="whitespace-pre-line">{day.memo}</p>
    </div>
  )}
</div>
```

Note: `StickyNote` is already imported from `lucide-react`.

**Step 3: Lint and type check**

```bash
bun run --filter @sugara/web check
bun run check-types
```

**Step 4: Commit**

```bash
git add apps/web/app/shared/[token]/page.tsx
git commit -m "feat(shared): 日程メモを表示"
```

---

## Task 6: Skeleton Loading Update

Update the loading skeleton to roughly match the new hero + card layout so the loading state doesn't look jarring.

**Files:**
- Modify: `apps/web/app/shared/[token]/page.tsx` (the `showSkeleton` branch)

**Step 1: Locate the skeleton block**

Find the `if (showSkeleton)` branch. Current skeleton has a `<div className="mb-8">` block and `<div className="rounded-lg border bg-card p-4 sm:p-5">` day placeholders.

**Step 2: Update skeleton to match new layout**

```tsx
if (showSkeleton) {
  return (
    <div className="min-h-screen">
      <SharedHeader />
      <div className="container max-w-3xl py-8">
        {/* Hero skeleton */}
        <div className="mb-8 rounded-xl border bg-card px-6 py-6 shadow-sm">
          <Skeleton className="mb-3 h-5 w-16 rounded-full" />
          <Skeleton className="h-8 w-56" />
          <div className="mt-3 flex items-center gap-4">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-36" />
          </div>
        </div>
        {/* Day card skeletons */}
        <div className="space-y-6">
          {[1, 2].map((day) => (
            <div key={day} className="overflow-hidden rounded-xl border bg-card shadow-sm">
              <div className="border-b bg-muted/40 px-4 py-3 sm:px-5">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-6 w-6 rounded-full" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
              <div className="space-y-2 p-4 sm:p-5">
                {[1, 2].map((s) => (
                  <div key={s} className="flex items-start gap-3 rounded-lg px-3 py-2.5">
                    <Skeleton className="h-5 w-5 rounded-md" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-28" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

**Step 3: Lint and type check**

```bash
bun run --filter @sugara/web check
bun run check-types
```

**Step 4: Commit**

```bash
git add apps/web/app/shared/[token]/page.tsx
git commit -m "feat(shared): ローディングスケルトンを新レイアウトに合わせて更新"
```

---

## Verification

After all tasks:

1. Start the dev server: `bun run --filter @sugara/web dev`
2. Open a shared link: `http://localhost:3000/shared/<token>`
3. Visually verify:
   - Hero section shows title large, status badge, destination + date range with icons
   - Day cards have muted header with numbered circle + date + day-of-week
   - Schedule items have colored rounded-square icons with a vertical line connecting them
   - Day memos render below the schedule list when present
   - Loading skeleton matches the new layout roughly
4. Test on mobile viewport (375px width) — no horizontal overflow
