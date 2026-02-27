# SP版 候補→予定追加時のDay選択UX改善

## 背景

SP版で候補を予定に追加する際、「予定に追加」ボタンは現在選択中のDayに即座に追加する動作になっている。
別のDayに追加したい場合、scheduleタブに移動してDayを切り替えてからcandidatesタブに戻る迂回が必要で、UXが悪い。

## 目標

SP版の「予定に追加」を押した時点でDay+Patternを選択できるようにし、タブ間の往復を不要にする。

## スコープ

- SP版のみ対象
- デスクトップ版は変更なし（左右パネル並列表示で現在のPatternが常に見えているため不要）

## 設計

### ユーザーフロー（改善後）

```
候補タブ → 候補カードの「予定に追加」クリック
    ↓
DayPickerDrawer が開く「どの日に追加しますか？」
  - 1日目 2/1 (土)
  - 2日目 2/2 (日)  ← デフォルト: 現在選択中のDay
  - 3日目 2/3 (月)
  + パターン選択（複数パターン存在時のみ）
    ↓「追加する」ボタン
楽観的更新 → API POST → (失敗時ロールバック)
タブ遷移なし、candidatesタブのまま継続操作可能
```

### 変更ファイル

#### `apps/web/components/candidate-panel.tsx`

- `days` prop を追加（Day+Pattern情報の一覧）
- `handleAssign(spotId, dayId?, patternId?)` に変更
  - `dayId`/`patternId` 未指定時は既存の `currentDayId`/`currentPatternId` にフォールバック（デスクトップ版の動作を維持）
- SP版 (`days` prop あり) の場合:
  - 「予定に追加」クリック → 対象spotIdをstateに保持 → DayPickerDrawer を開く
  - ドロワー確定後に `handleAssign(spotId, selectedDayId, selectedPatternId)` を呼ぶ
- 楽観的更新・エラーハンドリングロジックはそのまま `candidate-panel.tsx` 内に留める

#### `apps/web/app/(sp)/sp/trips/[id]/page.tsx`

- `candidates` ケースの `CandidatePanel` に `days={tripData.days}` を渡す

### 変更なし

- `apps/web/components/day-picker-drawer.tsx`（そのまま流用）
- デスクトップ版ページ
- API層

## 型定義

```ts
// CandidatePanel に追加する props
days?: {
  id: string;
  dayIndex: number;
  date: string | null;
  patterns: { id: string; label: string }[];
}[];
```

`TripDay` 型がすでにこの構造を満たしているため、`tripData.days` をそのまま渡せる。

## 考慮事項

- DayPickerDrawer のデフォルト選択を `currentDayId`（schedule タブで最後に選択した Day）にすることで、同じDayに連続追加する場合はワンタップ確定できる
- パターン選択は `DayPickerDrawer` の既存実装（複数パターン時のみ表示）をそのまま利用
