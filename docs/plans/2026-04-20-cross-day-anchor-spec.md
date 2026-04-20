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
  check (cross_day_anchor in ('before', 'after')),
  add column cross_day_anchor_source_id uuid
  references schedules(id) on delete set null,
  add constraint schedules_anchor_consistency
    check ((cross_day_anchor is null) = (cross_day_anchor_source_id is null));
```

`schedules_anchor_consistency` の check 制約で「両方 null か両方 not null」を DB レベルで強制する。`ON DELETE SET NULL` との整合: PostgreSQL の FK `SET NULL` action は**対象行の FK カラムのみ** null にするため、制約違反を避けるには参照側 column を列挙した `ON DELETE SET NULL (cross_day_anchor_source_id, cross_day_anchor)` 構文を使い、両カラムを同時に null にする。Drizzle 側で直接サポートされない場合は raw SQL migration で記述する。

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

**重要な実装注意:** crossDay を複数含む merged 配列に対して順次 insert すると 1 回目の insert で配列が伸長し、後続の `merged.indexOf(entry)` が変動する。擬似コードの素直な読み方で実装するとインデックスがズレるため、**ループ内で `merged.indexOf(entry)` を毎回再計算する**こと（crossDay 件数は少ないので O(n²) 相当でも実害なし）。

また、有効な anchor（crossDayEntries の source id と一致する `anchor_source_id`）のみを anchor 処理に回し、**一致しない anchor（source が crossDay を生成しない、pattern フィルタで除外、source 削除で null など）は plain schedule に含めて時刻ベース merge へ fallback**させる。

```
入力: schedules[], crossDayEntries[]
出力: TimelineItem[]

validSourceIds = Set(crossDayEntries.map(e => e.schedule.id))

// anchor 付き schedule を分離、有効なものだけを anchor 処理対象に
anchoredBefore = schedules.filter(s =>
  s.cross_day_anchor === 'before' &&
  s.cross_day_anchor_source_id != null &&
  validSourceIds.has(s.cross_day_anchor_source_id)
)
anchoredAfter  = schedules.filter(s =>
  s.cross_day_anchor === 'after' &&
  s.cross_day_anchor_source_id != null &&
  validSourceIds.has(s.cross_day_anchor_source_id)
)
anchoredIds = Set([...anchoredBefore, ...anchoredAfter].map(s => s.id))
plainSchedules = schedules.filter(s => !anchoredIds.has(s.id))

// 従来の時刻ベース merge を plainSchedules と crossDayEntries で行う
merged = existingMerge(plainSchedules, crossDayEntries)

// anchor 付きを差し込む
for each entry in crossDayEntries:
  sourceId = entry.schedule.id

  beforeSet = anchoredBefore.filter(s => s.cross_day_anchor_source_id === sourceId)
                           .sort((a, b) => a.sortOrder - b.sortOrder)
  afterSet  = anchoredAfter.filter(s => s.cross_day_anchor_source_id === sourceId)
                           .sort((a, b) => a.sortOrder - b.sortOrder)

  // crossDay の直前に beforeSet を差し込む。indexOf はこのタイミングで必ず再計算。
  if (beforeSet.length > 0) {
    const posBefore = merged.indexOf(entry)
    merged.splice(posBefore, 0, ...beforeSet.map(s => ({ type: "schedule", schedule: s })))
  }
  // beforeSet 挿入で entry の位置がズレたので再度 indexOf。afterSet を entry の直後に。
  if (afterSet.length > 0) {
    const posAfter = merged.indexOf(entry) + 1
    merged.splice(posAfter, 0, ...afterSet.map(s => ({ type: "schedule", schedule: s })))
  }

return merged
```

`indexOf(entry)` はオブジェクト参照比較なので元の crossDayEntry オブジェクト参照を保持していればよい（`splice` は配列を破壊的に変更するが参照は残る）。

### anchor ライフサイクルと整合性

以下のイベントで anchor の扱いを明示する:

| イベント | 処理 |
|---|---|
| source schedule が **削除** される | `ON DELETE SET NULL` (cross_day_anchor_source_id, cross_day_anchor) で両カラムを同時に null にする |
| source schedule の `endDayOffset` が null/0 に **更新** される（= crossDay を生成しなくなる）| update API 側で「この schedule を anchor_source_id として参照しているすべての schedule」の anchor を null クリアする |
| source schedule の `endDayOffset` が再び 1 以上に変更される | 復活させない（既にクリア済み）。ユーザーが再度 drag で anchor 設定する |
| anchor 付き schedule が別 Day/別 pattern に `assign` される | anchor は残るが別 day の crossDay には該当 source が出現しないため自然 fallback。特別な処理なし |
| anchor 付き schedule が **候補に unassign** される | candidate は crossDay コンテキストがないため anchor は意味を失うが、再 assign 時に有効化される可能性を考え anchor は保持する |

加えて、API の schedule update / reorder で「`anchor` と `anchor_source_id` の片方のみセット」を **受け付けない**（validate エラー）。DB 側の check 制約でも同時条件を強制し、二重に担保。

**キーボード上下ボタン (reorderSchedule) での扱い:** drag 操作と整合させ、「通常 schedule の隣に移動したら anchor クリア」を適用するため、キーボード操作でも該当 schedule の anchor を null クリアする。これは `reorderSchedule` が呼ぶ reorder API に `anchors: [{scheduleId: moved.id, anchor: null, anchorSourceId: null}]` を同時送信することで実現する。

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
- `anchor` と `anchor_source_id` の片方のみセット（両方 null か両方 non-null のみ許可）
- anchor を書き込む schedule の `dayPatternId` が null（= candidate には anchor 設定不可）
- `anchor_source_id` が同じ trip に属さない schedule を指す
- `anchor_source_id` が指す schedule の `endDayOffset` が 0 or null（= crossDay を生成しない schedule を anchor にできない）
- `anchor_source_id` が自分自身を指す（schedule.id === anchor_source_id）

### update / create エンドポイント

- `POST .../schedules`（create）: anchor 2 列は受け付けず null 固定
- `PATCH .../schedules/:id`（update）: anchor を更新可能。ただし上記 validate 適用
- `PATCH .../schedules/:id` で `endDayOffset` を null/0 に更新する場合、その schedule を `anchor_source_id` として参照するすべての schedule の anchor を null クリアするトランザクション処理を加える

### assign エンドポイント

候補→schedule の assign は anchor を設定しない（null のまま）。drag で「crossDay の前後」に drop した場合は、assign API 直後に reorder API で anchor を設定する（drag-and-drop 側で 2 段階呼び出し）。

**非 atomic の影響:** assign 成功 → reorder 失敗の場合、schedule は assign されたが anchor 未設定で末尾に入る。ユーザーから見ると「drop 位置に入っていない」状態。この場合、use-trip-drag-and-drop の既存エラーハンドリング（`onDone()` で refetch してサーバー状態と同期 + toast でエラー通知）に従う。ユーザーは再度 drag すれば anchor を設定可能。assign + anchor を 1 API にする案もあるが、既存の assign/reorder 分離設計を変えるコストが高いため本 spec では採用しない。

### 「時刻順」ボタン → reorder に `clearAnchors` flag

既存の reorder エンドポイント (`PATCH .../schedules/reorder`) に optional flag を追加する:

```ts
export const reorderSchedulesSchema = z.object({
  scheduleIds: z.array(z.string().check(z.guid())).max(MAX_SCHEDULES_PER_TRIP),
  anchors: z.array(...).optional(),
  clearAnchors: z.boolean().optional(),
});
```

`clearAnchors: true` の場合、API は対象 pattern の全 schedule の anchor を null にクリアしてから sortOrder を再割当する。`anchors` と同時指定した場合は `clearAnchors` が優先。既存の `handleSortByTime` (day-timeline.tsx 行 174) がこの flag を使う。

別エンドポイントにしない理由: 既存の reorder が「順序を書き換える」責務を持っているため、anchor クリアも同じ責務範囲内で扱える。認証・権限チェックを重複させずに済む。

## 影響範囲

| 層 | 変更内容 |
|---|---|
| DB migration | 1 件追加（列追加 + check 制約 2 種 + FK with composite SET NULL） |
| `apps/api/src/db/schema.ts` | schedules に 2 カラム、anchor 整合性 check 制約 |
| `packages/shared/src/types.ts` | ScheduleResponse に `crossDayAnchor`, `crossDayAnchorSourceId` 2 フィールド追加（optional） |
| `packages/shared/src/schemas/schedule.ts` | reorderSchedulesSchema に `anchors`, `clearAnchors` 追加、updateScheduleSchema に anchor 2 フィールド追加 |
| `apps/api/src/routes/schedules.ts` | reorder / update で anchor を書き込み、validate 追加、endDayOffset 変更時の cascade クリア |
| `apps/web/lib/merge-timeline.ts` | anchor 考慮 merge に再設計、既存 24 ケースに影響 |
| `apps/web/lib/drop-position.ts` | computeScheduleReorderIndex / computeCandidateInsertIndex が anchor 情報（`{ anchor, anchorSourceId }` or null）も返すように拡張 |
| `apps/web/lib/hooks/use-trip-drag-and-drop.ts` | drop-end で anchor を API に送る、reorderSchedule (キーボード) でも anchor null クリアを送る |
| `apps/web/components/day-timeline.tsx` | handleSortByTime で `clearAnchors: true` を送る、isSorted の disable 判定を見直し |
| tests | merge-timeline / drop-position / integration に anchor ケース追加 |

**4a 単独マージの型影響:** `ScheduleResponse` に `crossDayAnchor`, `crossDayAnchorSourceId` を追加すると、この型を参照する全クライアントコード（web / shared trip client / print / SP 版）がビルド対象になる。どちらも **optional（`?`）+ nullable** にすることで、読み取り側は無視できるため 4a 単体で安全にビルド可能。4b 以降で段階的に活用する。

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
- **「時刻順」ボタン**: 既存 reorder エンドポイントに `clearAnchors: true` flag を追加、anchor 全クリア + 時刻順再割当
- **drag 時**: upper=before / lower=after / 通常 schedule drop=null クリア
- **キーボード上下操作 (reorderSchedule)**: drag と同じ扱いで anchor null クリアを同時送信
- **複数 anchor**: 有効な anchor だけを対象、sortOrder 順に crossDay 前後に並べる
- **anchor_source 削除**: FK composite SET NULL で両カラム同時 null、DB check で整合性保証
- **source の endDayOffset=null/0 更新**: 参照する全 schedule の anchor をトランザクション内でクリア
- **Pattern フィルタ**: anchor 相手が別 pattern なら自動 fallback（merge で有効 anchor 判定）
- **candidate**: anchor 設定不可（validate で拒否）
- **isSorted 判定**: 「時刻順ボタン」は anchor 存在時も有効化（anchor クリアの明示操作として）

---

## Spec Self-Review

- **Placeholder scan**: TBD / TODO なし。
- **Internal consistency**: データモデル（composite SET NULL + check 制約）→ 振る舞い（ライフサイクル表）→ API（validate 一覧）→ 影響範囲（4a の型 optional 化）→ merge 擬似コード（有効 anchor 判定、indexOf 再計算）で矛盾なし。
- **Scope check**: 1 spec で実装段階を 4a〜4g の 7 段階に分割。writing-plans で PR 単位を確定（3 PR 構成目安）。
- **Ambiguity check**: `sort-by-time` は既存 reorder の `clearAnchors: true` flag に確定（別エンドポイント案は廃棄）。anchor 整合性は DB check + API validate の 2 重で担保すると明示。

## レビュー反映履歴

- 2026-04-20 初版作成
- 2026-04-20 code-reviewer 指摘反映: (1) merge 擬似コードの indexOf 再計算と有効 anchor fallback を明示 (2) source の endDayOffset 更新時の cascade クリアを追記 (3) DB check 制約「両方 null か両方 not null」を追加 (4) reorderSchedule キーボード操作での anchor クリア挙動を明示 (5) assign + reorder 非 atomic の扱いを明記 (6) validate に candidate 禁止 / self-reference 禁止を追加 (7) isSorted / 時刻順ボタン有効化条件を追記 (8) 4a 単独 merge 時の型 optional 扱いを影響範囲に追記 (9) sort-by-time を flag に確定
