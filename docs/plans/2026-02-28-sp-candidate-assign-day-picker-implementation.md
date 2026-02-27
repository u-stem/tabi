# SP版 候補→予定追加 Day選択ドロワー 実装計画

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** SP版の「予定に追加」をタップした時に `DayPickerDrawer` が開き、Dayを選択してから予定に追加できるようにする。

**Architecture:** `CandidatePanel` に `days?: DayResponse[]` prop を追加し、`isMobile && days` の場合のみドロワーを表示。`handleAssign` は `dayId`/`patternId` を引数に取るよう変更してデスクトップ版の動作を維持。パターンは選択したDayの default/first を自動解決（ドロワー内のパターン選択UIは使わない）。

**Tech Stack:** React, TypeScript, `DayPickerDrawer`（既存）, `DayResponse` 型（`@sugara/shared`）

---

### Task 1: `handleAssign` のシグネチャを変更

**Files:**
- Modify: `apps/web/components/candidate-panel.tsx:459-480`

**Step 1: テストを実行して現状を把握**

```bash
bun run --filter @sugara/web test -- --run
```

Expected: 全パス（ベースラインの確認）

**Step 2: `handleAssign` を変更**

`apps/web/components/candidate-panel.tsx` の `handleAssign` を以下に変更:

```typescript
async function handleAssign(spotId: string, dayId?: string, patternId?: string) {
  const targetDayId = dayId ?? currentDayId;
  const targetPatternId = patternId ?? currentPatternId;
  await queryClient.cancelQueries({ queryKey: cacheKey });
  const prev = queryClient.getQueryData<TripResponse>(cacheKey);
  if (prev) {
    queryClient.setQueryData(
      cacheKey,
      moveCandidateToSchedule(prev, spotId, targetDayId, targetPatternId),
    );
  }
  toast.success(MSG.CANDIDATE_ASSIGNED);

  try {
    await api(`/api/trips/${tripId}/candidates/${spotId}/assign`, {
      method: "POST",
      body: JSON.stringify({ dayPatternId: targetPatternId }),
    });
    onRefresh();
  } catch {
    if (prev) queryClient.setQueryData(cacheKey, prev);
    toast.error(MSG.CANDIDATE_ASSIGN_FAILED);
  }
}
```

**Step 3: 型チェック**

```bash
bun run check-types
```

Expected: エラーなし

**Step 4: コミット**

```bash
git add apps/web/components/candidate-panel.tsx
git commit -m "refactor: handleAssignがdayId/patternIdを引数に取るよう変更"
```

---

### Task 2: `CandidatePanel` に `days` prop と DayPickerDrawer を組み込む

**Files:**
- Modify: `apps/web/components/candidate-panel.tsx`

**Step 1: `days` prop を型に追加**

`CandidatePanelProps` に以下を追加（`onReorderCandidate` の後）:

```typescript
import type { DayResponse } from "@sugara/shared";

// CandidatePanelProps に追加:
days?: DayResponse[];
```

`CandidatePanel` 関数の引数分割代入にも追加:

```typescript
export function CandidatePanel({
  // ...既存props...,
  days,
}: CandidatePanelProps) {
```

**Step 2: ドロワー用 state を追加**

`CandidatePanel` 内の state 定義部分（`reorderMode` の近く）に追加:

```typescript
const [dayPickerOpen, setDayPickerOpen] = useState(false);
const [assignPendingSpotId, setAssignPendingSpotId] = useState<string | null>(null);
```

**Step 3: `DayPickerDrawer` を dynamic import に追加**

ファイル上部の既存 dynamic imports（`AddCandidateDialog`, `EditCandidateDialog` の近く）に追加:

```typescript
const DayPickerDrawer = dynamic(() =>
  import("@/components/day-picker-drawer").then((mod) => mod.DayPickerDrawer),
);
```

**Step 4: `onAssign` の呼び出し箇所を変更**

`CandidateCard` に渡している `onAssign` の2箇所（line ~695 と ~745 付近）を変更:

```typescript
// 変更前
onAssign={() => handleAssign(spot.id)}

// 変更後（isMobile && days がある場合はドロワー、それ以外は即追加）
onAssign={
  isMobile && days
    ? () => {
        setAssignPendingSpotId(spot.id);
        setDayPickerOpen(true);
      }
    : () => handleAssign(spot.id)
}
```

2箇所とも同じ変更を適用する。

**Step 5: `DayPickerDrawer` JSX を追加**

`CandidatePanel` の return 文の末尾、`EditCandidateDialog` の後（閉じタグ `<>` の手前）に追加:

```typescript
{isMobile && days && days.length > 0 && (
  <DayPickerDrawer
    open={dayPickerOpen}
    onOpenChange={(open) => {
      setDayPickerOpen(open);
      if (!open) setAssignPendingSpotId(null);
    }}
    days={days.map((d, i) => ({
      id: d.id,
      date: d.date,
      dayIndex: i,
    }))}
    defaultDayIndex={Math.max(0, days.findIndex((d) => d.id === currentDayId))}
    onConfirm={(dayId) => {
      // 選択したDayのdefaultパターン、なければ最初のパターンを使用
      const targetDay = days.find((d) => d.id === dayId);
      const targetPatternId =
        targetDay?.patterns.find((p) => p.isDefault)?.id ??
        targetDay?.patterns[0]?.id ??
        currentPatternId;
      if (assignPendingSpotId) {
        handleAssign(assignPendingSpotId, dayId, targetPatternId);
      }
      setAssignPendingSpotId(null);
    }}
  />
)}
```

`patterns` を渡さないことで、パターン選択UIは非表示になる（Day選択のみ）。パターンは選択DayのisDefault/先頭から自動解決する。

**Step 6: 型チェック + lint**

```bash
bun run check-types && bun run --filter @sugara/web check
```

Expected: エラーなし（warning は無視可）

**Step 7: テスト実行**

```bash
bun run --filter @sugara/web test -- --run
```

Expected: 全パス

**Step 8: コミット**

```bash
git add apps/web/components/candidate-panel.tsx
git commit -m "feat: SP版候補パネルに予定追加用Day選択ドロワーを追加"
```

---

### Task 3: SP版ページに `days` prop を渡す

**Files:**
- Modify: `apps/web/app/(sp)/sp/trips/[id]/page.tsx:429-455`

**Step 1: `CandidatePanel` に `days` を渡す**

`candidates` ケースの `CandidatePanel`（line ~432付近）に `days={tripData.days}` を1行追加:

```typescript
<CandidatePanel
  tripId={tripId ?? ""}
  candidates={dnd.localCandidates}
  currentDayId={currentDay.id}
  currentPatternId={currentPattern.id}
  onRefresh={onMutate}
  disabled={!online || !canEdit}
  draggable={false}
  addDialogOpen={addCandidateOpen}
  onAddDialogOpenChange={setAddCandidateOpen}
  scheduleLimitReached={scheduleLimitReached}
  scheduleLimitMessage={scheduleLimitMessage}
  maxEndDayOffset={Math.max(0, tripData.days.length - 1)}
  onSaveToBookmark={canEdit && online ? handleSaveToBookmark : undefined}
  onReorderCandidate={dnd.reorderCandidate}
  days={tripData.days}
/>
```

**Step 2: 型チェック + lint + テスト**

```bash
bun run check-types && bun run --filter @sugara/web check && bun run --filter @sugara/web test -- --run
```

Expected: 全パス

**Step 3: コミット**

```bash
git add apps/web/app/(sp)/sp/trips/[id]/page.tsx
git commit -m "feat: SP版候補タブにDay選択ドロワーを有効化"
```

---

## 動作確認

```bash
bun run --filter @sugara/web dev
```

確認手順:
1. SP版（`/sp/trips/<id>`）を開く
2. 候補タブで候補カードの「予定に追加」をタップ
3. `DayPickerDrawer` が開き、全Dayが選択肢として表示されること
4. デフォルト選択が「schedule タブで最後に見ていたDay」になっていること
5. 別の日を選んで「追加する」→ 候補タブのままで、選択したDayに追加されること
6. デスクトップ版（`/trips/<id>`）で「予定に追加」→ 従来通り即追加されること

## 注意事項

- パターンが複数あるDayに追加する場合、ドロワーではパターン選択UIが出ない。isDefaultパターンが自動選択される（将来的にDayPickerDrawerのパターン対応を強化する余地あり）
- `days` prop は optional なのでデスクトップ版は未影響
