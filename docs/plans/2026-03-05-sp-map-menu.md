# SP版地図メニュー Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** SP版（モバイル）の三点リーダーメニューに「地図」を追加し、`mapsEnabled` な旅行の全メンバーが地図を閲覧できるようにする。

**Architecture:** `MobileContentTab` に `"map"` を追加し、bookmarks/activity と同じ「隠しタブ」パターンで実装する。`allSchedules` と `currentDaySchedules` は既存の `trip.days` から直接計算できるため新規クエリは不要。`mapsEnabled` が false の旅行ではメニュー項目ごと非表示。

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, `@vis.gl/react-google-maps`, Tailwind CSS v4

---

### Task 1: `MobileContentTab` に `"map"` を追加

**Files:**
- Modify: `apps/web/components/mobile-content-tabs.tsx`

**Step 1: 型に `"map"` を追加**

```ts
export type MobileContentTab =
  | "schedule"
  | "candidates"
  | "expenses"
  | "bookmarks"
  | "activity"
  | "souvenirs"
  | "map";
```

`BASE_TABS` と `getMobileTabIds()` は変更不要（スワイプ対象外の隠しタブとして扱う）。

**Step 2: 型チェックで exhaustive check が通ることを確認**

```bash
bun run check-types
```

Expected: エラーなし（`renderTabContent` が switch で全ケースを扱っているため `"map"` 追加後はビルドエラーが出る → Task 3 で解消する）

---

### Task 2: `TripActions` に `mapsEnabled` と `onOpenMap` を追加

**Files:**
- Modify: `apps/web/components/trip-actions.tsx`

**Step 1: props に追加**

```ts
type TripActionsProps = {
  // ... 既存 props ...
  mapsEnabled?: boolean;       // 追加
  onOpenMap?: () => void;      // 追加
};
```

**Step 2: import に `Map as MapIcon` を追加**

lucide-react の既存 import 行に `Map as MapIcon` を追加する。

**Step 3: `sheetActions` に「地図」を追加**

ブックマークの直前に追加する（ナビゲーション系アクションをまとめるため）:

```ts
const sheetActions = [
  ...(onOpenMap
    ? [
        {
          label: "地図",
          icon: <MapIcon className="h-4 w-4" />,
          onClick: onOpenMap,
        },
      ]
    : []),
  ...(onOpenBookmarks ? [{ label: "ブックマーク", ... }] : []),
  // ... 以下既存 ...
];
```

**Step 4: 型チェック**

```bash
bun run check-types
```

---

### Task 3: `TripHeader` に `onOpenMap` を追加

**Files:**
- Modify: `apps/web/app/(authenticated)/trips/[id]/_components/trip-header.tsx`

**Step 1: props に追加し TripActions へ転送**

```ts
export function TripHeader({
  // ... 既存 props ...
  onOpenMap,
}: {
  // ... 既存型 ...
  onOpenMap?: () => void;
}) {
  const tripActionsProps = {
    // ... 既存 ...
    onOpenMap,
  } as const;
  // ...
}
```

**Step 2: 型チェック**

```bash
bun run check-types
```

---

### Task 4: `page.tsx` に "map" ケースの追加と配線

**Files:**
- Modify: `apps/web/app/(authenticated)/trips/[id]/page.tsx`

**Step 1: `renderTabContent` に `case "map":` を追加**

```tsx
case "map":
  return (
    <div className="h-[calc(100svh-14rem)]">
      <MapPanel
        tripId={tripId}
        currentDaySchedules={currentPattern?.schedules ?? []}
        allSchedules={tripData.days.flatMap((day, dayIndex) =>
          day.patterns.flatMap((p) =>
            p.schedules.map((s) => ({ ...s, dayIndex })),
          ),
        )}
        online={online}
      />
    </div>
  );
```

`MapPanel` は既に import 済み（right-panel 経由ではなく直接 import が必要なら追加する）。

**Step 2: `TripHeader` への `onOpenMap` 渡し**

```tsx
<TripHeader
  // ... 既存 props ...
  onOpenMap={
    trip.mapsEnabled
      ? () => handleMobileTabChange("map", "tap")
      : undefined
  }
/>
```

**Step 3: `TripActions` への `mapsEnabled` 渡し（compact 版のみ）**

`TripHeader` 内では `TripActions` に `onOpenMap` が渡るため自動で表示条件が制御される（`onOpenMap` が undefined なら非表示）。

**Step 4: 型チェック**

```bash
bun run check-types
```

Expected: エラーなし

**Step 5: テスト実行**

```bash
bun run test
```

Expected: 全テスト通過

**Step 6: コミット**

```bash
git add apps/web/components/mobile-content-tabs.tsx \
        apps/web/components/trip-actions.tsx \
        apps/web/app/\(authenticated\)/trips/\[id\]/_components/trip-header.tsx \
        apps/web/app/\(authenticated\)/trips/\[id\]/page.tsx
git commit -m "feat: SP版三点リーダーメニューに地図を追加"
```

---

## 動作確認ポイント

- `mapsEnabled: true` の旅行: 三点リーダー → 「地図」が表示される
- 「地図」タップ → 地図が表示される（当日モードデフォルト）
- `mapsEnabled: false` の旅行: 三点リーダーに「地図」が出ない
- デスクトップ版の既存動作に影響しないこと
