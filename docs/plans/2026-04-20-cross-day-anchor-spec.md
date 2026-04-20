# 手動 anchor による schedule ↔ crossDay 相対位置の永続化 — 設計

**ステータス:** Draft → writing-plans へ渡す前の合意文書

## 目的

旅行計画アプリ sugara で、日をまたぐ予定（crossDay）と普通の予定の相対位置をユーザーがドラッグで指定した場合、その並びを後から時刻編集しても維持する。

sugara の設計方針「手動操作優先 (Last write wins)」と、現状「schedule ↔ crossDay の前後だけは時刻で強制」というズレを解消する。

## 代表ユースケース

Day1 にホテル（`endDayOffset=1`, endTime=`08:50`）があり、Day2 に以下の並びで配置したい:

```
[玉翠荘 チェックアウト ~08:50]   ← crossDay（Day1 由来）
[鳩ノ巣渓谷]                   ← 時刻なし、手動で crossDay の後に配置
[奥多摩駅から奥多摩湖 09:00-09:15]
```

現状の merge は時刻なし予定を「時刻あり予定の前 or 後」にしか置けず、`crossDay → 時刻なし → 時刻あり` の並びは表現不可能。

## データモデル

`schedules` テーブルに 2 カラム追加:

```sql
alter table schedules
  add column cross_day_anchor text
  check (cross_day_anchor in ('before', 'after'));

alter table schedules
  add column cross_day_anchor_source_id uuid
  references schedules(id) on delete set null;
```

| カラム | 意味 | 値 |
|---|---|---|
| `cross_day_anchor` | anchor 相手の **前** に置くか **後** に置くか | `'before'` / `'after'` / `null` |
| `cross_day_anchor_source_id` | anchor 相手の source schedule (Day1 側のホテル本体の `schedules.id`) | uuid / `null` |

**両方 null**: 時刻ベース自動配置（現行動作）  
**両方セット**: 手動で配置した状態

### 設計判断

- **anchor target の表現**: source schedule の id を直接参照。複数日跨ぎ（3 泊など）でも同じ source id が Day2/Day3/Day4 の crossDay として現れるため、どの表示日でも同じ相対位置が保たれる。
- **ON DELETE SET NULL**: anchor 元のホテルが削除されたら anchor_source_id は null になる。アプリ側で `anchor != null && anchor_source_id == null` を検出したら anchor も null にする（後述の正規化）。

## 振る舞い仕様

### 時刻編集後の挙動

ユーザーが anchor 付き schedule の startTime を後から編集しても、**anchor は保持される**。手動配置が時刻編集で勝手に壊れないようにする（Last write wins）。

### 「時刻順」ボタンの動作

既存の「時刻順」ボタン押下時:
1. 全 schedule の `cross_day_anchor` と `cross_day_anchor_source_id` を null にクリア
2. sortOrder を時刻順に再割当

「手動配置を全部捨てて時刻ベースに戻す」明示的操作として動く。

### ドラッグの挙動

drop-position の `target.kind === "schedule"` で `target.overId` が crossDay（`cross-<id>` 形式）の場合:

- **upper half 到達**: active schedule に `anchor='before'`, `anchor_source_id=crossDay の source schedule id` をセット
- **lower half 到達**: active schedule に `anchor='after'`, `anchor_source_id=crossDay の source schedule id` をセット
- **通常 schedule に drop / timeline zone に drop**: anchor・anchor_source_id を null クリア（時刻ベースに戻す）

API 呼び出しは reorder PATCH に anchor 情報を乗せる（下記 API 設計）。

### merge アルゴリズム

`buildMergedTimeline` を拡張。

```
入力: schedules[], crossDayEntries[]
出力: TimelineItem[]

// anchor 付き schedule を分離
anchoredBefore = schedules.filter(s => s.anchor === 'before')
anchoredAfter  = schedules.filter(s => s.anchor === 'after')
plainSchedules = schedules.filter(s => s.anchor == null)

// 従来の時刻ベース merge を plainSchedules と crossDayEntries で行う
merged = existingMerge(plainSchedules, crossDayEntries)

// anchor 付きを差し込む
for each entry in crossDayEntries:
  sourceId = entry.schedule.id
  entryPosInMerged = merged.indexOf(entry)

  beforeSet = anchoredBefore.filter(s => s.anchor_source_id === sourceId)
                           .sort(by sortOrder)
  afterSet  = anchoredAfter.filter(s => s.anchor_source_id === sourceId)
                           .sort(by sortOrder)

  merged.insertAt(entryPosInMerged,     beforeSet)
  merged.insertAt(entryPosInMerged + len(beforeSet) + 1, afterSet)

return merged
```

### anchor_source_id が null になった schedule の扱い

`ON DELETE SET NULL` により anchor 相手のホテルが削除されると `anchor_source_id = null` になるが `anchor` 側は残る。merge ロジックは **両方セットされている場合のみ anchor 処理**、片方 null なら「通常の schedule」として扱う（時刻ベース merge へ合流）。

加えて、API 側の schedule 更新で `anchor` と `anchor_source_id` の不整合（片方のみセット）を弾く validate を追加。

### Phase 2（pattern フィルタ）との相互作用

anchor_source_id が指す source schedule が viewing pattern と違う pattern にある場合:
- `getCrossDayEntries` は source pattern 違いで crossDay を返さない
- merge で該当 crossDay が見つからない → anchor 付き schedule は「相手不在」として時刻ベース merge へ fallback
- 結果: pattern 切替で anchor は無効化される（pattern-local な手動配置としては期待通り）

### 「時刻あり schedule を crossDay の前に drag」（例: 朝食 08:00 を crossDay 08:50 より前に置きたい）

時刻あり schedule を crossDay の upper half に drop した場合も同様に `anchor='before'` をセット。この場合、時刻ベースでも同じ位置になるので anchor の有無に関わらず同じ結果。ただしユーザーが後から朝食を 09:30 に変更しても anchor により crossDay の前に保持される。

### 時刻あり schedule の crossDay より後への手動配置

これが本設計の肝。例: 朝食 07:00 を crossDay 11:00 の後に置きたい（時刻的には矛盾するが、ユーザーが強く希望する場合）。

- 現状: 時刻順で朝食が crossDay より前に固定され、動かせない
- 本設計: drag で lower half に置けば `anchor='after'` がセットされ、時刻矛盾を承知で crossDay の後に表示される

時刻順に戻したいユーザーは「時刻順」ボタンで anchor クリア。

## API 設計

### reorder エンドポイント拡張

既存 `PATCH /api/trips/:tripId/days/:dayId/patterns/:patternId/schedules/reorder` は `scheduleIds: string[]` のみだが、anchor を扱えるよう拡張。

```ts
// packages/shared/src/schemas/schedule.ts
export const reorderSchedulesSchema = z.object({
  scheduleIds: z.array(z.string().check(z.guid())).max(MAX_SCHEDULES_PER_TRIP),
  anchors: z
    .array(
      z.object({
        scheduleId: z.string().check(z.guid()),
        anchor: z.enum(["before", "after"]).nullable(),
        anchorSourceId: z.string().check(z.guid()).nullable(),
      }),
    )
    .optional(),
});
```

リクエスト例:
```json
{
  "scheduleIds": ["s1", "s2", "s3"],
  "anchors": [
    { "scheduleId": "s2", "anchor": "after", "anchorSourceId": "hotel-day1" }
  ]
}
```

- `anchors` が指定された schedule のみ anchor を更新、その他は現状維持
- `anchor: null, anchorSourceId: null` で明示的にクリア

### validate

API 側で以下を拒否:
- `anchor` と `anchor_source_id` の片方のみセット
- `anchor_source_id` が同じ trip に属さない schedule を指す
- `anchor_source_id` が指す schedule の `endDayOffset` が 0 or null（= crossDay を生成しない schedule を anchor にできない）

### update / create エンドポイント

- `POST .../schedules`（create）: anchor 2 列は受け付けず null 固定
- `PATCH .../schedules/:id`（update）: anchor を更新可能。ただし上記 validate 適用

### assign エンドポイント

候補→schedule の assign は anchor を設定しない（null のまま）。drag で「crossDay の前後」に drop した場合は、assign API 直後に reorder API で anchor を設定する（drag-and-drop 側で 2 段階呼び出し）。

### 「時刻順」エンドポイント

既存の reorder に `clearAnchors: true` optional flag を追加、または別エンドポイント `POST .../schedules/sort-by-time`。clearAnchors flag のほうが差分が少ない。

## 影響範囲

| 層 | 変更内容 |
|---|---|
| DB migration | 1 件追加（列追加 + check 制約 + FK） |
| `apps/api/src/db/schema.ts` | schedules に 2 カラム |
| `packages/shared/src/types.ts` | ScheduleResponse に 2 フィールド |
| `packages/shared/src/schemas/schedule.ts` | reorderSchedulesSchema 拡張、create/update に anchor 追加（optional） |
| `apps/api/src/routes/schedules.ts` | reorder / update で anchor を書き込み、validate 追加 |
| `apps/web/lib/merge-timeline.ts` | anchor 考慮 merge に再設計、既存 24 ケースに影響 |
| `apps/web/lib/drop-position.ts` | computeScheduleReorderIndex / computeCandidateInsertIndex が anchor 情報も返すように拡張、または別関数に分離 |
| `apps/web/lib/hooks/use-trip-drag-and-drop.ts` | drop-end で anchor を API に送る |
| `apps/web/components/day-timeline.tsx` | handleSortByTime で clearAnchors=true を送る |
| tests | merge-timeline / drop-position / integration に anchor ケース追加 |

## 実装段階

1. **4a DB schema** — migration + schema.ts + shared 型
2. **4b API validate & reorder 拡張** — anchor を受理する API、validate 実装、integration test
3. **4c merge ロジック** — buildMergedTimeline の anchor 対応、網羅テスト
4. **4d drop-position 拡張** — computeXxxInsertIndex が anchor 情報を返す、drop-position.test.ts 更新
5. **4e drag-and-drop 配線** — use-trip-drag-and-drop で anchor 送信
6. **4f 時刻順ボタン** — handleSortByTime で clearAnchors 送信
7. **4g 実機確認** — 鳩ノ巣渓谷シナリオの確認 + pattern 切替時の anchor 無効化確認

4a→4b→4c→4d→4e→4f→4g の順。Phase 4 全体を 1 PR にするか、途中で分割するかは writing-plans で決める（目安: 4a–4b を 1 PR、4c–4e を 1 PR、4f–4g を 1 PR の 3 PR 構成）。

## 既存 PR との関係

- PR #30（closestCorners）: 独立
- PR #31（batch-shift 拡張）: 独立
- PR #32（pattern フィルタ）: 4c の merge 拡張および 4e の pattern フォールバック仕様に前提として依存

本 spec は PR #30/#31/#32 がすべて main にマージされた状態を前提とする。

## 設計判断サマリ（合意事項）

- **anchor target**: schedule.id 参照（案 A-1）
- **時刻編集時**: anchor 維持（案 B-1, Last write wins）
- **「時刻順」ボタン**: anchor 全クリア + 時刻順再割当（案 C-1）
- **drag 時**: upper=before / lower=after / 通常 schedule drop=null クリア
- **複数 anchor**: sortOrder 順に crossDay 前後に並べる
- **anchor_source 消滅**: anchor_source_id を null に、merge は時刻ベース fallback
- **Pattern フィルタ**: anchor 相手が別 pattern なら fallback

---

## Spec Self-Review

- **Placeholder scan**: TBD / TODO なし。「writing-plans で決める」の箇所は意図的（Plan フェーズの分割判断）。
- **Internal consistency**: データモデル → 振る舞い → API → 影響範囲で矛盾なし。`anchor_source_id` の FK 先は schedules（Day1 のホテル本体）で一貫。
- **Scope check**: 1 spec だが実装は 3 PR 程度に分割想定。それを writing-plans で具体化する。
- **Ambiguity check**: `sort-by-time` を別エンドポイントにするか既存 reorder の flag にするかは writing-plans で確定（現状: flag 案を推奨）。
