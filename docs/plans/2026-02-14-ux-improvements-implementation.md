# UX改善 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** パターン操作性改善、日またぎ予定ラベル、印刷テーブル化、共有リンクコンパクト化の4つのUX改善を実装する

**Architecture:** 4つの独立した改善を順番に実装。改善2(日またぎラベル)は改善3,4の前提となるため先に実装する。共有型 `CrossDayEntry` を拡張して中間日/最終日を区別する `crossDayPosition` フィールドを追加。

**Tech Stack:** Next.js 15, React 19, Tailwind CSS v4, shadcn/ui, Zod, Vitest

---

### Task 1: パターンアクションボタンの改善

`ChevronDown` (12px) を `MoreHorizontal` (16px) に変更し、タップターゲットを拡大する。

**Files:**
- Modify: `apps/web/app/(authenticated)/trips/[id]/page.tsx:736-774`
- Modify: `apps/web/e2e/patterns.spec.ts`

**Step 1: パターンドロップダウンのアイコンとサイズを変更**

`apps/web/app/(authenticated)/trips/[id]/page.tsx` の行736-774:

Before:
```tsx
{canEdit && (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <button
        type="button"
        className="py-1.5 pr-2 pl-0.5 text-xs focus:outline-none"
      >
        <ChevronDown className="h-3 w-3" />
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start">
      <DropdownMenuItem
        onClick={() => {
          setRenamePattern(pattern);
          setRenameLabel(pattern.label);
        }}
      >
        <Pencil className="mr-2 h-3 w-3" />
        名前変更
      </DropdownMenuItem>
      <DropdownMenuItem
        onClick={() => handleDuplicatePattern(pattern.id)}
        disabled={currentDay.patterns.length >= MAX_PATTERNS_PER_DAY}
      >
        <Copy className="mr-2 h-3 w-3" />
        複製
      </DropdownMenuItem>
      {!pattern.isDefault && (
        <DropdownMenuItem
          className="text-destructive"
          onClick={() => setDeletePatternTarget(pattern)}
        >
          <Trash2 className="mr-2 h-3 w-3" />
          削除
        </DropdownMenuItem>
      )}
    </DropdownMenuContent>
  </DropdownMenu>
)}
```

After:
```tsx
{canEdit && (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <button
        type="button"
        className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none sm:h-6 sm:w-6"
        aria-label={`${pattern.label}のメニュー`}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start">
      <DropdownMenuItem
        onClick={() => {
          setRenamePattern(pattern);
          setRenameLabel(pattern.label);
        }}
      >
        <Pencil className="mr-2 h-4 w-4" />
        名前変更
      </DropdownMenuItem>
      <DropdownMenuItem
        onClick={() => handleDuplicatePattern(pattern.id)}
        disabled={currentDay.patterns.length >= MAX_PATTERNS_PER_DAY}
      >
        <Copy className="mr-2 h-4 w-4" />
        複製
      </DropdownMenuItem>
      {!pattern.isDefault && (
        <DropdownMenuItem
          className="text-destructive"
          onClick={() => setDeletePatternTarget(pattern)}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          削除
        </DropdownMenuItem>
      )}
    </DropdownMenuContent>
  </DropdownMenu>
)}
```

Changes:
- `ChevronDown` → `MoreHorizontal` (import 追加は不要、`MoreHorizontal` は未使用 import を確認)
- ボタン: padding ベース → 固定サイズ `h-7 w-7 sm:h-6 sm:w-6` + `flex items-center justify-center`
- `aria-label` 追加
- アイコン: `h-3 w-3` → `h-4 w-4` (トリガー・メニュー内すべて)

`ChevronDown` import を削除し、`MoreHorizontal` import を確認する。

**Step 2: パターンタブのパディング調整**

ボタンが丸くなったので、タブの `pr-1` パディングを調整:

Before (行729-732):
```tsx
className={cn(
  "py-1.5 text-xs font-medium focus:outline-none",
  canEdit ? "pl-3 pr-1" : "px-3",
)}
```

After:
```tsx
className={cn(
  "py-1.5 text-xs font-medium focus:outline-none",
  canEdit ? "pl-3 pr-0.5" : "px-3",
)}
```

**Step 3: E2E テストのセレクタ更新**

`apps/web/e2e/patterns.spec.ts` のパターンメニューオープン方法を変更:

Before (行33-36, 63-66):
```typescript
await page
  .getByRole("button", { name: "晴れの日プラン" })
  .locator(".. >> button:last-child")
  .click();
```

After:
```typescript
await page
  .getByRole("button", { name: "晴れの日プランのメニュー" })
  .click();
```

`aria-label` を使ってメニューボタンを直接取得する。rename と delete の両方のテストで更新。

**Step 4: ビルド確認**

Run: `bun run --filter @sugara/web build`
Expected: ビルド成功

**Step 5: コミット**

```
feat: パターンアクションボタンの操作性改善
```

---

### Task 2: 日またぎ予定の役割ラベル - 共有型の拡張

`CrossDayEntry` 型に `crossDayPosition` フィールドを追加し、`getCrossDayEntries` を中間日にも対応させる。

**Files:**
- Modify: `packages/shared/src/types.ts:70-75`
- Modify: `apps/web/lib/cross-day.ts`
- Create: `apps/web/lib/__tests__/cross-day.test.ts`

**Step 1: テストを書く**

`apps/web/lib/__tests__/cross-day.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import type { DayResponse } from "@sugara/shared";
import { getCrossDayEntries } from "../cross-day";

function makeDay(dayNumber: number, schedules: Array<{
  id: string;
  name: string;
  category: string;
  endDayOffset?: number | null;
  endTime?: string | null;
}>): DayResponse {
  return {
    id: `day-${dayNumber}`,
    dayNumber,
    date: `2026-01-0${dayNumber}`,
    patterns: [
      {
        id: `pattern-${dayNumber}`,
        label: "default",
        isDefault: true,
        sortOrder: 0,
        schedules: schedules.map((s, i) => ({
          sortOrder: i,
          color: "blue" as const,
          updatedAt: "2026-01-01T00:00:00Z",
          ...s,
        })),
      },
    ],
  } as DayResponse;
}

describe("getCrossDayEntries", () => {
  const days = [
    makeDay(1, [
      { id: "hotel-1", name: "Hotel A", category: "hotel", endDayOffset: 3, endTime: "10:00" },
      { id: "spot-1", name: "Spot A", category: "sightseeing" },
    ]),
    makeDay(2, [
      { id: "spot-2", name: "Spot B", category: "sightseeing" },
    ]),
    makeDay(3, [
      { id: "spot-3", name: "Spot C", category: "sightseeing" },
    ]),
    makeDay(4, [
      { id: "spot-4", name: "Spot D", category: "sightseeing" },
    ]),
  ];

  it("returns nothing for the source day itself", () => {
    const entries = getCrossDayEntries(days, 1);
    expect(entries).toEqual([]);
  });

  it("returns intermediate entry for day 2", () => {
    const entries = getCrossDayEntries(days, 2);
    expect(entries).toHaveLength(1);
    expect(entries[0].schedule.id).toBe("hotel-1");
    expect(entries[0].crossDayPosition).toBe("intermediate");
    expect(entries[0].sourceDayNumber).toBe(1);
  });

  it("returns intermediate entry for day 3", () => {
    const entries = getCrossDayEntries(days, 3);
    expect(entries).toHaveLength(1);
    expect(entries[0].crossDayPosition).toBe("intermediate");
  });

  it("returns final entry for day 4 (last day)", () => {
    const entries = getCrossDayEntries(days, 4);
    expect(entries).toHaveLength(1);
    expect(entries[0].crossDayPosition).toBe("final");
  });

  it("ignores schedules without endDayOffset", () => {
    const entries = getCrossDayEntries(days, 2);
    const ids = entries.map((e) => e.schedule.id);
    expect(ids).not.toContain("spot-1");
  });
});
```

**Step 2: テストが失敗することを確認**

Run: `bun run --filter @sugara/web test -- apps/web/lib/__tests__/cross-day.test.ts`
Expected: FAIL - `crossDayPosition` が存在しない、中間日のエントリが返されない

**Step 3: `CrossDayEntry` 型に `crossDayPosition` を追加**

`packages/shared/src/types.ts` の `CrossDayEntry`:

Before:
```typescript
export type CrossDayEntry = {
  schedule: ScheduleResponse;
  sourceDayId: string;
  sourcePatternId: string;
  sourceDayNumber: number;
};
```

After:
```typescript
export type CrossDayEntry = {
  schedule: ScheduleResponse;
  sourceDayId: string;
  sourcePatternId: string;
  sourceDayNumber: number;
  crossDayPosition: "intermediate" | "final";
};
```

**Step 4: `getCrossDayEntries` を中間日にも対応させる**

`apps/web/lib/cross-day.ts`:

Before:
```typescript
import type { CrossDayEntry, DayResponse } from "@sugara/shared";

export function getCrossDayEntries(days: DayResponse[], targetDayNumber: number): CrossDayEntry[] {
  const entries: CrossDayEntry[] = [];

  for (const day of days) {
    for (const pattern of day.patterns) {
      for (const schedule of pattern.schedules) {
        if (
          schedule.endDayOffset != null &&
          schedule.endDayOffset > 0 &&
          day.dayNumber + schedule.endDayOffset === targetDayNumber
        ) {
          entries.push({
            schedule,
            sourceDayId: day.id,
            sourcePatternId: pattern.id,
            sourceDayNumber: day.dayNumber,
          });
        }
      }
    }
  }

  return entries;
}
```

After:
```typescript
import type { CrossDayEntry, DayResponse } from "@sugara/shared";

export function getCrossDayEntries(days: DayResponse[], targetDayNumber: number): CrossDayEntry[] {
  const entries: CrossDayEntry[] = [];

  for (const day of days) {
    for (const pattern of day.patterns) {
      for (const schedule of pattern.schedules) {
        if (
          schedule.endDayOffset != null &&
          schedule.endDayOffset > 0 &&
          day.dayNumber < targetDayNumber &&
          day.dayNumber + schedule.endDayOffset >= targetDayNumber
        ) {
          const isFinal = day.dayNumber + schedule.endDayOffset === targetDayNumber;
          entries.push({
            schedule,
            sourceDayId: day.id,
            sourcePatternId: pattern.id,
            sourceDayNumber: day.dayNumber,
            crossDayPosition: isFinal ? "final" : "intermediate",
          });
        }
      }
    }
  }

  return entries;
}
```

**Step 5: テストが通ることを確認**

Run: `bun run --filter @sugara/web test -- apps/web/lib/__tests__/cross-day.test.ts`
Expected: PASS

**Step 6: 型エラー修正 - 既存コードに `crossDayPosition` を追加**

既存の `CrossDayEntry` を生成している箇所はこのファイルのみなので、型チェックを実行して他に問題がないか確認。

Run: `bun run check-types`
Expected: PASS (型エラーなし)

**Step 7: コミット**

```
feat: CrossDayEntry に中間日/最終日の区別を追加
```

---

### Task 3: 日またぎ予定の役割ラベル - ラベル算出ユーティリティ

カテゴリと `crossDayPosition` から表示ラベルを算出する関数を追加する。

**Files:**
- Create: `apps/web/lib/cross-day-label.ts`
- Create: `apps/web/lib/__tests__/cross-day-label.test.ts`

**Step 1: テストを書く**

`apps/web/lib/__tests__/cross-day-label.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { getCrossDayLabel, getStartDayLabel } from "../cross-day-label";

describe("getStartDayLabel", () => {
  it("returns check-in for hotel", () => {
    expect(getStartDayLabel("hotel")).toBe("チェックイン");
  });

  it("returns null for transport", () => {
    expect(getStartDayLabel("transport")).toBeNull();
  });

  it("returns generic start for other categories", () => {
    expect(getStartDayLabel("sightseeing")).toBe("開始");
    expect(getStartDayLabel("restaurant")).toBe("開始");
    expect(getStartDayLabel("activity")).toBe("開始");
    expect(getStartDayLabel("other")).toBe("開始");
  });
});

describe("getCrossDayLabel", () => {
  it("returns check-out for hotel final day", () => {
    expect(getCrossDayLabel("hotel", "final")).toBe("チェックアウト");
  });

  it("returns staying for hotel intermediate day", () => {
    expect(getCrossDayLabel("hotel", "intermediate")).toBe("滞在中");
  });

  it("returns null for transport (uses existing route display)", () => {
    expect(getCrossDayLabel("transport", "final")).toBeNull();
    expect(getCrossDayLabel("transport", "intermediate")).toBeNull();
  });

  it("returns generic labels for other categories", () => {
    expect(getCrossDayLabel("sightseeing", "final")).toBe("終了");
    expect(getCrossDayLabel("sightseeing", "intermediate")).toBe("継続中");
  });
});
```

**Step 2: テストが失敗することを確認**

Run: `bun run --filter @sugara/web test -- apps/web/lib/__tests__/cross-day-label.test.ts`
Expected: FAIL - モジュールが存在しない

**Step 3: 実装**

`apps/web/lib/cross-day-label.ts`:

```typescript
import type { ScheduleCategory } from "@sugara/shared";

type CrossDayPosition = "intermediate" | "final";

const START_LABELS: Partial<Record<ScheduleCategory, string>> = {
  hotel: "チェックイン",
};

const CROSS_DAY_LABELS: Partial<Record<ScheduleCategory, Record<CrossDayPosition, string>>> = {
  hotel: { intermediate: "滞在中", final: "チェックアウト" },
};

const GENERIC_START = "開始";
const GENERIC_LABELS: Record<CrossDayPosition, string> = {
  intermediate: "継続中",
  final: "終了",
};

/** Label for the start day of a multi-day schedule (e.g. "チェックイン"). Null for transport. */
export function getStartDayLabel(category: ScheduleCategory): string | null {
  if (category === "transport") return null;
  return START_LABELS[category] ?? GENERIC_START;
}

/** Label for a cross-day entry (e.g. "チェックアウト", "滞在中"). Null for transport. */
export function getCrossDayLabel(
  category: ScheduleCategory,
  position: CrossDayPosition,
): string | null {
  if (category === "transport") return null;
  return CROSS_DAY_LABELS[category]?.[position] ?? GENERIC_LABELS[position];
}
```

**Step 4: テストが通ることを確認**

Run: `bun run --filter @sugara/web test -- apps/web/lib/__tests__/cross-day-label.test.ts`
Expected: PASS

**Step 5: コミット**

```
feat: 日またぎ予定の役割ラベル算出ユーティリティを追加
```

---

### Task 4: 日またぎ予定の役割ラベル - UI 表示

`schedule-item.tsx`、`day-timeline.tsx`、共有ページ、印刷ページにラベルを反映する。

**Files:**
- Modify: `apps/web/components/schedule-item.tsx`
- Modify: `apps/web/components/day-timeline.tsx`
- Modify: `apps/web/app/shared/[token]/page.tsx`
- Modify: `apps/web/app/(authenticated)/trips/[id]/print/page.tsx`

**Step 1: `ScheduleItemProps` に `crossDayPosition` を追加**

`apps/web/components/schedule-item.tsx` の型定義:

`crossDaySourceDayNumber` の下に追加:
```typescript
/** Position within multi-day span: "intermediate" or "final" */
crossDayPosition?: "intermediate" | "final";
```

**Step 2: `PlaceCard` でラベル表示**

`schedule-item.tsx` の `PlaceCard` を変更:

import 追加:
```typescript
import { getCrossDayLabel, getStartDayLabel } from "@/lib/cross-day-label";
```

既存の `crossDayDisplay && crossDaySourceDayNumber` バッジ (行310-313) を変更:

Before:
```tsx
{crossDayDisplay && crossDaySourceDayNumber && (
  <span className="mb-1.5 inline-block rounded-sm bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
    {crossDaySourceDayNumber}日目から継続
  </span>
)}
```

After:
```tsx
{crossDayDisplay && crossDayPosition && (
  <span className="mb-1.5 inline-block rounded-sm bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
    {getCrossDayLabel(category, crossDayPosition) ?? `${crossDaySourceDayNumber}日目から継続`}
  </span>
)}
```

開始日側のラベル: 名前の下に追加 (行322 `<span className="text-sm font-medium">{name}</span>` の後):

```tsx
{!crossDayDisplay && endDayOffset != null && endDayOffset > 0 && (
  (() => {
    const label = getStartDayLabel(category);
    return label ? (
      <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
        {label}
      </span>
    ) : null;
  })()
)}
```

`aria-label` も更新 (行306):

Before:
```tsx
"aria-label": `${crossDaySourceDayNumber}日目から継続: ${name}`,
```

After:
```tsx
"aria-label": `${getCrossDayLabel(category, crossDayPosition!) ?? `${crossDaySourceDayNumber}日目から継続`}: ${name}`,
```

**Step 3: `TransportConnector` のラベル更新**

`TransportConnector` の既存バッジ (行541-544) を変更:

Before:
```tsx
{crossDayDisplay && crossDaySourceDayNumber && (
  <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
    {crossDaySourceDayNumber}日目から
  </span>
)}
```

transport は `getCrossDayLabel` が null を返すので、既存の「N日目から」テキストをそのまま維持:

After:
```tsx
{crossDayDisplay && crossDaySourceDayNumber && (
  <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
    {getCrossDayLabel(category, crossDayPosition!) ?? `${crossDaySourceDayNumber}日目から`}
  </span>
)}
```

**Step 4: `day-timeline.tsx` から `crossDayPosition` を渡す**

`apps/web/components/day-timeline.tsx` の cross-day レンダリング (行301付近):

```tsx
<ScheduleItem
  key={`cross-${s.id}`}
  {...s}
  ...
  crossDayDisplay
  crossDaySourceDayNumber={sourceDayNumber}
/>
```

に `crossDayPosition={item.entry.crossDayPosition}` を追加:

```tsx
crossDayPosition={item.entry.crossDayPosition}
```

**Step 5: 共有ページの `ScheduleCard` にラベル追加**

`apps/web/app/shared/[token]/page.tsx`:

- `PatternSection` で `ScheduleCard` に `crossDayPosition` を渡す (行274付近):

```tsx
<ScheduleCard
  key={`cross-${item.entry.schedule.id}`}
  schedule={item.entry.schedule}
  crossDayDisplay
  crossDayPosition={item.entry.crossDayPosition}
/>
```

- `ScheduleCard` の props に `crossDayPosition` を追加
- ScheduleCard 内で名前の横にラベルバッジを表示:
  - crossDayDisplay 時: `getCrossDayLabel(category, position)` を表示
  - 開始日 (endDayOffset > 0) 時: `getStartDayLabel(category)` を表示

**Step 6: 印刷ページの `PrintScheduleCard` にラベル追加**

`apps/web/app/(authenticated)/trips/[id]/print/page.tsx`:

同様に `PrintPatternSection` → `PrintScheduleCard` に `crossDayPosition` を渡し、名前の横にラベルを表示。

**Step 7: 型チェック・ビルド確認**

Run: `bun run check-types && bun run --filter @sugara/web build`
Expected: PASS

**Step 8: コミット**

```
feat: 日またぎ予定に役割ラベルを自動表示
```

---

### Task 5: PDF/印刷の表形式レイアウト

カード形式を廃止し、テーブルレイアウトに全面書き換え。

**Files:**
- Modify: `apps/web/app/(authenticated)/trips/[id]/print/page.tsx`

**Step 1: 印刷ページをテーブル形式に書き換え**

`PrintPatternSection` と `PrintScheduleCard` を削除し、テーブルベースの `PrintPatternTable` に置換。

`PrintPatternTable` の構造:

```tsx
function PrintPatternTable({
  pattern,
  showLabel,
  crossDayEntries,
}: {
  pattern: DayPatternResponse;
  showLabel: boolean;
  crossDayEntries?: CrossDayEntry[];
}) {
  const merged = buildMergedTimeline(pattern.schedules, crossDayEntries);

  if (merged.length === 0) {
    return (
      <div className={showLabel ? "mt-3" : ""}>
        {showLabel && (
          <p className="mb-2 text-sm font-medium print:font-normal text-muted-foreground">
            {pattern.label}
          </p>
        )}
        <p className="py-2 text-center text-sm text-muted-foreground">まだ予定がありません</p>
      </div>
    );
  }

  return (
    <div className={showLabel ? "mt-3" : ""}>
      {showLabel && (
        <p className="mb-2 text-sm font-medium print:font-normal text-muted-foreground">
          {pattern.label}
        </p>
      )}
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="py-1.5 pr-2 font-medium w-[100px]">時間</th>
            <th className="py-1.5 pr-2 font-medium">名前</th>
            <th className="py-1.5 pr-2 font-medium w-[60px]">種別</th>
            <th className="py-1.5 pr-2 font-medium">住所</th>
            <th className="py-1.5 font-medium">メモ</th>
          </tr>
        </thead>
        <tbody>
          {merged.map((item) => (
            <PrintTableRow
              key={item.type === "crossDay" ? `cross-${item.entry.schedule.id}` : item.schedule.id}
              schedule={item.type === "crossDay" ? item.entry.schedule : item.schedule}
              crossDayDisplay={item.type === "crossDay"}
              crossDayPosition={item.type === "crossDay" ? item.entry.crossDayPosition : undefined}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

`PrintTableRow`:

```tsx
function PrintTableRow({
  schedule,
  crossDayDisplay,
  crossDayPosition,
}: {
  schedule: ScheduleResponse;
  crossDayDisplay?: boolean;
  crossDayPosition?: "intermediate" | "final";
}) {
  const displayTime = crossDayDisplay ? schedule.endTime : schedule.startTime;
  const showEndTime = !crossDayDisplay && !schedule.endDayOffset && schedule.endTime;
  const timeStr = displayTime
    ? `${crossDayDisplay ? "~ " : ""}${displayTime.slice(0, 5)}${showEndTime ? ` - ${schedule.endTime!.slice(0, 5)}` : ""}${!crossDayDisplay && schedule.endDayOffset ? " ~" : ""}`
    : "";

  const roleLabel = crossDayDisplay && crossDayPosition
    ? getCrossDayLabel(schedule.category, crossDayPosition)
    : !crossDayDisplay && schedule.endDayOffset
      ? getStartDayLabel(schedule.category)
      : null;

  const nameWithLabel = roleLabel ? `${schedule.name} (${roleLabel})` : schedule.name;

  // Transport: show route info instead of address
  const transportLabel =
    schedule.transportMethod && schedule.transportMethod in TRANSPORT_METHOD_LABELS
      ? TRANSPORT_METHOD_LABELS[schedule.transportMethod as TransportMethod]
      : schedule.transportMethod;
  const routeInfo =
    schedule.category === "transport"
      ? [
          crossDayDisplay
            ? schedule.arrivalPlace && `→ ${schedule.arrivalPlace}`
            : schedule.departurePlace && schedule.arrivalPlace
              ? `${schedule.departurePlace} → ${schedule.arrivalPlace}`
              : schedule.departurePlace || schedule.arrivalPlace,
          transportLabel && `(${transportLabel})`,
        ]
          .filter(Boolean)
          .join(" ")
      : null;

  return (
    <tr className={cn(
      "border-b last:border-b-0",
      crossDayDisplay && "border-dashed text-muted-foreground",
    )}>
      <td className="py-1.5 pr-2 align-top whitespace-nowrap">{timeStr}</td>
      <td className="py-1.5 pr-2 align-top font-medium print:font-normal">{nameWithLabel}</td>
      <td className="py-1.5 pr-2 align-top text-xs text-muted-foreground">
        {CATEGORY_LABELS[schedule.category]}
      </td>
      <td className="py-1.5 pr-2 align-top text-xs">
        {routeInfo || schedule.address || ""}
      </td>
      <td className="py-1.5 align-top text-xs text-muted-foreground">
        {schedule.memo || ""}
      </td>
    </tr>
  );
}
```

**Step 2: `DaySection` のテーブル使用に更新**

`DaySection` 内の `PrintPatternSection` を `PrintPatternTable` に変更。

**Step 3: import の整理**

- 追加: `getCrossDayLabel`, `getStartDayLabel` from `@/lib/cross-day-label`
- 削除: `Clock`, `MapPin` (テーブルではアイコン不要)
- `CATEGORY_ICONS` 削除

**Step 4: ビルド確認**

Run: `bun run --filter @sugara/web build`
Expected: PASS

**Step 5: コミット**

```
feat: 印刷ページを表形式レイアウトに変更
```

---

### Task 6: 共有リンクのコンパクトリスト形式

カード形式の余白を削り、情報密度を上げたコンパクトリスト形式にする。

**Files:**
- Modify: `apps/web/app/shared/[token]/page.tsx`

**Step 1: `ScheduleCard` をコンパクトリスト形式に書き換え**

`ScheduleCard` を全面的にリデザイン:

```tsx
function ScheduleCard({
  schedule,
  crossDayDisplay,
  crossDayPosition,
}: {
  schedule: ScheduleResponse;
  crossDayDisplay?: boolean;
  crossDayPosition?: "intermediate" | "final";
}) {
  const CategoryIcon = CATEGORY_ICONS[schedule.category];
  const colorClasses = SCHEDULE_COLOR_CLASSES[schedule.color ?? "blue"];
  const transportLabel =
    schedule.transportMethod && schedule.transportMethod in TRANSPORT_METHOD_LABELS
      ? TRANSPORT_METHOD_LABELS[schedule.transportMethod as TransportMethod]
      : schedule.transportMethod;

  const displayTime = crossDayDisplay ? schedule.endTime : schedule.startTime;
  const showEndTime = !crossDayDisplay && !schedule.endDayOffset && schedule.endTime;

  const roleLabel = crossDayDisplay && crossDayPosition
    ? getCrossDayLabel(schedule.category, crossDayPosition)
    : !crossDayDisplay && schedule.endDayOffset
      ? getStartDayLabel(schedule.category)
      : null;

  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded px-2 py-1.5",
        crossDayDisplay && "bg-muted/30",
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white",
          colorClasses.bg,
        )}
      >
        <CategoryIcon className="h-3 w-3" />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        {/* Line 1: time + name + role label */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          {displayTime && (
            <span className="shrink-0 text-xs text-muted-foreground">
              {crossDayDisplay ? "~" : ""}{displayTime.slice(0, 5)}
              {showEndTime && `-${schedule.endTime!.slice(0, 5)}`}
              {!crossDayDisplay && schedule.endDayOffset ? "~" : ""}
            </span>
          )}
          <span className="text-sm font-medium">{schedule.name}</span>
          {roleLabel && (
            <span className="rounded-sm bg-muted px-1 py-0.5 text-[10px] text-muted-foreground">
              {roleLabel}
            </span>
          )}
        </div>

        {/* Line 2: transport route / address / memo */}
        {(schedule.category === "transport" || schedule.address || schedule.memo) && (
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            {schedule.category === "transport" && (
              <span>
                {crossDayDisplay
                  ? schedule.arrivalPlace && `→ ${schedule.arrivalPlace}`
                  : schedule.departurePlace && schedule.arrivalPlace
                    ? `${schedule.departurePlace} → ${schedule.arrivalPlace}`
                    : schedule.departurePlace || schedule.arrivalPlace}
                {transportLabel && ` (${transportLabel})`}
              </span>
            )}
            {schedule.address && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(schedule.address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-blue-600 hover:underline dark:text-blue-400"
              >
                {schedule.address}
              </a>
            )}
            {schedule.memo && <span className="truncate">{schedule.memo}</span>}
          </div>
        )}
      </div>

      {/* URL link icon */}
      {schedule.url && (
        <a
          href={schedule.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-0.5 shrink-0 text-blue-600 hover:text-blue-800 dark:text-blue-400"
          aria-label="リンクを開く"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
    </div>
  );
}
```

**Step 2: PatternSection の gap を縮小**

Before:
```tsx
<div className="space-y-2">
```

After:
```tsx
<div className="divide-y">
```

カード間ボーダーで区切り、gap を廃止。

**Step 3: import の追加・整理**

- 追加: `ExternalLink` from lucide-react
- 追加: `getCrossDayLabel`, `getStartDayLabel` from `@/lib/cross-day-label`
- 削除: `Clock` (時計アイコン不要)

**Step 4: ビルド確認**

Run: `bun run --filter @sugara/web build`
Expected: PASS

**Step 5: コミット**

```
feat: 共有リンクをコンパクトリスト形式に変更
```

---

### Task 7: 最終確認

**Step 1: 全テスト実行**

Run: `bun run test`
Expected: PASS

**Step 2: lint + format**

Run: `bun run check`
Expected: PASS

**Step 3: 型チェック**

Run: `bun run check-types`
Expected: PASS
