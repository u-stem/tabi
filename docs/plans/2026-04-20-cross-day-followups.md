# 日をまたぐ予定まわりの残課題フォローアップ 計画

> **For agentic workers:** 各 Phase は独立して PR 化可能。Phase 1 が最小で最大効果、Phase 4 が最大スコープ。チェックボックス (`- [ ]`) は executing-plans の進捗追跡で使う。

**Goal:** PR #29 で残っている「日をまたぐ予定」周辺の UX / 仕様課題を段階的に解消する。

**Architecture:** 4 Phase に分割し、各 Phase を独立した PR として実装する。低リスク・即効性のある改修から順に進め、DB スキーマ変更を伴う最大スコープは最後に配置する。

**Tech Stack:** Next.js 16 / React 19 / dnd-kit / Drizzle ORM / PostgreSQL / Vitest

---

## 前提

- PR #29 (`fix/cross-day-drag-drop`) がマージされた状態から着手する
- main ブランチ起点で各 Phase の feature branch を切る
- 仕様判断で「修正不要」としたもの (旅行期間超過 endDayOffset / 最終日翌日跨ぎ) はスコープ外

## Phase 概要

| # | 名前 | 変更範囲 | リスク | ユーザー体感 |
|---|---|---|---|---|
| 1 | Collision detection を closestCorners に切替 | 1 行 | 低 | 高 |
| 2 | 並列 pattern の crossDay 分離 | cross-day.ts + 呼び出し 4 箇所 | 中 | 中 |
| 3 | batch-shift の日跨ぎスキップ拡張 | schedules.ts 数行 | 低 | 低 |
| 4 | 手動 anchor で schedule ↔ crossDay 相対位置を永続 | DB スキーマ + merge + drag | 高 | 高 |

---

## Phase 1: Collision detection を closestCorners に切替

**Why:** `pointerWithin` は要素の内側にポインタが入らないと over を検出しない。隣接カード間の隙間で over=null になり、drop 位置が意図から外れる（ユーザー観察の「奥多摩駅から奥多摩湖の後に入った」現象の主因）。`closestCorners` は vertical sortable list の推奨 collision で、ポインタに最も近い要素の角を持つ item を選び、常に target が確定する。

**Files:**
- Modify: `apps/web/lib/hooks/use-trip-drag-and-drop.ts:80` (`collisionDetection` 定義)
- Test: `apps/web/lib/__tests__/drop-position.test.ts` (既存、変更不要を確認)

### Task 1.1: ブランチ作成

- [ ] **Step 1: main の最新を取り込む**

```bash
git checkout main
git pull --ff-only
git checkout -b fix/dnd-collision-closest-corners
```

### Task 1.2: 既存テストを走らせて現状 Green を確認

- [ ] **Step 1: drop-position のテストを実行**

```bash
bun run --filter @sugara/web test -- drop-position
```

Expected: 33 passed

- [ ] **Step 2: use-trip-drag-and-drop のテストを実行**

```bash
bun run --filter @sugara/web test -- use-trip-drag-and-drop
```

Expected: 5 passed

### Task 1.3: import と collisionDetection 定義の置き換え

- [ ] **Step 1: use-trip-drag-and-drop.ts の import を書き換え**

変更前:
```ts
import {
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  MouseSensor,
  pointerWithin,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
```

変更後:
```ts
import {
  closestCorners,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
```

- [ ] **Step 2: collisionDetection の代入を変更**

`apps/web/lib/hooks/use-trip-drag-and-drop.ts` 内の:

```ts
const collisionDetection = pointerWithin;
```

を:

```ts
const collisionDetection = closestCorners;
```

に置き換える（ファイル内で 1 箇所のみ）。

### Task 1.4: ユニットテストが通ることを確認

- [ ] **Step 1: drop-position のテストを実行**

```bash
bun run --filter @sugara/web test -- drop-position
```

Expected: 33 passed（collisionDetection は drop-position に依存しないため壊れない）

- [ ] **Step 2: use-trip-drag-and-drop のテストを実行**

```bash
bun run --filter @sugara/web test -- use-trip-drag-and-drop
```

Expected: 5 passed（dnd-kit の core モジュールをモックしているため collision 変更の影響を受けない）

- [ ] **Step 3: web 全テスト**

```bash
bun run --filter @sugara/web test
```

Expected: all pass

### Task 1.5: 実機確認

- [ ] **Step 1: dev サーバー起動**

```bash
bun run --filter @sugara/web dev
```

- [ ] **Step 2: Chrome DevTools で Kyoto trip を開き、以下を確認**
  - 京都タワーホテル に endDayOffset=1, endTime='11:00' を設定した状態
  - Day2 を開く
  - 候補「鳩ノ巣渓谷」(時刻なし) を crossDay チェックアウトの上半分にドラッグ
  - Drop 後、鳩ノ巣渓谷が crossDay の前に配置されること

  - 候補を crossDay の下半分にドラッグ → 次の時刻あり schedule の前 (= crossDay の直後) に配置されること

- [ ] **Step 3: ゾーン境界テスト（closestCorners 特有の副作用検証）**

closestCorners は全 droppable の角距離で判定するため、タイムライン↔候補エリアの境界付近でゾーンが誤判定されないかを確認する:
  - schedule カードをタイムラインと候補パネルの境界付近 (= 候補エリア寄りの空白) にドラッグ
  - `handleDragOver` の `overType` が意図通りに切り替わることを確認（insert indicator の出現位置で判別可能）
  - 候補→タイムライン も同様に境界をまたがせて意図通り切り替わるか
  - `lastOverZone` (`savedLastOverZone`) のフォールバックが pointerWithin 時代と同じように効くかも確認

### Task 1.6: check / type-check / commit / push

- [ ] **Step 1: check 実行**

```bash
bun run --filter @sugara/web check
bun run --filter @sugara/web check-types
```

Expected: exit 0

- [ ] **Step 2: commit**

```bash
git add apps/web/lib/hooks/use-trip-drag-and-drop.ts
git commit -m "$(cat <<'EOF'
fix(web): ドロップ位置検出を closestCorners に変更

pointerWithin は要素の内側にポインタが入らないと over を検出しないため、隣接カード間の隙間で drop target が決まらず意図と違う位置に挿入される問題があった。closestCorners に切り替えて常に近接要素を target として選ぶようにする。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 3: push + PR 作成**

```bash
git push -u origin fix/dnd-collision-closest-corners
```

PR body テンプレート:

```markdown
## Summary

- dnd-kit の collisionDetection を `pointerWithin` から `closestCorners` に変更
- 隣接カード間の隙間でも drop target が確定するようになり、意図した位置にドロップできる

## Why

`pointerWithin` はポインタが要素の内側に入らないと over を検出しないため、カードとカードの隙間で over=null になり drop 位置が外れることが多かった。ユーザー観察では crossDay を狙ったのに奥多摩湖が拾われる現象として表面化した。`closestCorners` は vertical sortable list の推奨で、ポインタに最も近い要素を常に target として選ぶ。

## Test plan

- [ ] 候補から schedule への drag で、crossDay の上半分/下半分を狙った通りに挿入できる
- [ ] schedule の並び替えで、狭いカード間隙間でも drop 位置が確定する
- [ ] タイムラインと候補エリアの境界付近でもゾーン判定が意図通り切り替わる

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

---

## Phase 2: 並列 pattern の crossDay 分離

**Why:** 並列候補 pattern (例: 晴れ / 雨) がある状況で、Day1 の晴れ pattern に宿泊ホテル (endDayOffset=1) があると、Day2 の雨 pattern を見ていても晴れ pattern のホテル crossDay が表示される。仕様（並列候補 = 独立したプラン）と矛盾する。

**設計方針:** `getCrossDayEntries` に `currentPattern` の `sortOrder` を渡し、以下のルールで crossDay を抽出する:
- source day に pattern が 1 つだけ: その pattern の crossDay を viewing pattern 全部に表示（分岐前の共通予定扱い）
- source day に複数 pattern あり: viewing pattern の `sortOrder` と一致する source pattern の crossDay のみ表示
- 該当 sortOrder の pattern が source day になければ `is_default=true` の pattern から fall back

**仕様確認事項（着手前に合意必須）:**
- 上記 fall-back ルールで「sortOrder 不一致 → default pattern」という挙動は、ユーザー視点で「雨プランを見ているのにデフォルトプランのホテルが出てくる」とも解釈できる。「pattern 数が一致しない日をまたぐ予定は表示しない」という別解もある。Task 2.0 でユーザーに確認してから着手する。

**Files:**
- Modify: `apps/web/lib/cross-day.ts`
- Modify: `apps/web/lib/__tests__/cross-day.test.ts`
- Modify: `apps/web/app/(authenticated)/trips/[id]/page.tsx:596` (呼び出し元)
- Modify: `apps/web/app/(sp)/sp/trips/[id]/page.tsx:222` (呼び出し元)
- Modify: `apps/web/app/(authenticated)/trips/[id]/print/page.tsx:110` (pattern ごとに crossDayEntries を計算するよう構造変更)
- Modify: `apps/web/app/(sp)/sp/trips/[id]/print/page.tsx:119` (同上)
- Modify: `apps/web/app/shared/[token]/_components/shared-trip-client.tsx:225`

**型名の注意:** Shared 型は `DayPatternResponse` (not `PatternResponse`)。`PatternResponse` という型は存在しない。

### Task 2.0: 仕様確認

- [ ] **Step 1: fall-back ルールの合意**

ユーザーに以下を確認する:
- 「viewing pattern の sortOrder と一致する source pattern が source day にない時、default pattern から拾って表示する (提案 A)」
- 「一致する pattern がない時は何も表示しない (提案 B)」
- どちらが UX として自然か

結果を本ドキュメントに追記してから着手する。

### Task 2.1: ブランチ作成

- [ ] **Step 1**

```bash
git checkout main
git pull --ff-only
git checkout -b fix/cross-day-pattern-filter
```

### Task 2.2: Red: 並列 pattern のフィルタテストを追加

- [ ] **Step 1: `apps/web/lib/__tests__/cross-day.test.ts` に以下を末尾追加**

```ts
describe("getCrossDayEntries with parallel patterns", () => {
  it("filters source patterns by viewing pattern sortOrder when source day has multiple patterns", () => {
    const days: DayResponse[] = [
      {
        id: "day-1",
        dayNumber: 1,
        date: "2025-04-01",
        patterns: [
          {
            id: "p1a",
            label: "晴れ",
            isDefault: true,
            sortOrder: 0,
            schedules: [
              makeSchedule({ id: "hotel-sunny", category: "hotel", endTime: "10:00", endDayOffset: 1 }),
            ],
          },
          {
            id: "p1b",
            label: "雨",
            isDefault: false,
            sortOrder: 1,
            schedules: [
              makeSchedule({ id: "hotel-rainy", category: "hotel", endTime: "11:00", endDayOffset: 1 }),
            ],
          },
        ],
      },
      {
        id: "day-2",
        dayNumber: 2,
        date: "2025-04-02",
        patterns: [
          { id: "p2a", label: "晴れ", isDefault: true, sortOrder: 0, schedules: [] },
          { id: "p2b", label: "雨", isDefault: false, sortOrder: 1, schedules: [] },
        ],
      },
    ];

    const sunnyEntries = getCrossDayEntries(days, 2, 0);
    expect(sunnyEntries.map((e) => e.schedule.id)).toEqual(["hotel-sunny"]);

    const rainyEntries = getCrossDayEntries(days, 2, 1);
    expect(rainyEntries.map((e) => e.schedule.id)).toEqual(["hotel-rainy"]);
  });

  it("includes all patterns' crossDays when source day has exactly one pattern (pre-branch)", () => {
    const days: DayResponse[] = [
      {
        id: "day-1",
        dayNumber: 1,
        date: "2025-04-01",
        patterns: [
          {
            id: "p1",
            label: "Default",
            isDefault: true,
            sortOrder: 0,
            schedules: [
              makeSchedule({ id: "shared-hotel", category: "hotel", endTime: "10:00", endDayOffset: 1 }),
            ],
          },
        ],
      },
      {
        id: "day-2",
        dayNumber: 2,
        date: "2025-04-02",
        patterns: [
          { id: "p2a", label: "晴れ", isDefault: true, sortOrder: 0, schedules: [] },
          { id: "p2b", label: "雨", isDefault: false, sortOrder: 1, schedules: [] },
        ],
      },
    ];

    expect(getCrossDayEntries(days, 2, 0).map((e) => e.schedule.id)).toEqual(["shared-hotel"]);
    expect(getCrossDayEntries(days, 2, 1).map((e) => e.schedule.id)).toEqual(["shared-hotel"]);
  });

  it("falls back to default pattern when viewing pattern sortOrder is absent in source day", () => {
    const days: DayResponse[] = [
      {
        id: "day-1",
        dayNumber: 1,
        date: "2025-04-01",
        patterns: [
          {
            id: "p1",
            label: "Default",
            isDefault: true,
            sortOrder: 0,
            schedules: [
              makeSchedule({ id: "hotel", category: "hotel", endTime: "10:00", endDayOffset: 1 }),
            ],
          },
        ],
      },
      {
        id: "day-2",
        dayNumber: 2,
        date: "2025-04-02",
        patterns: [
          { id: "p2a", label: "Default", isDefault: true, sortOrder: 0, schedules: [] },
          { id: "p2b", label: "雨", isDefault: false, sortOrder: 1, schedules: [] },
        ],
      },
    ];

    // viewing pattern sortOrder=1 ("雨"), source day has only sortOrder=0 → fall back to default
    expect(getCrossDayEntries(days, 2, 1).map((e) => e.schedule.id)).toEqual(["hotel"]);
  });
});
```

- [ ] **Step 2: Red 確認**

```bash
bun run --filter @sugara/web test -- cross-day
```

Expected: 3 failed（getCrossDayEntries は第 3 引数を受け付けない）

### Task 2.3: Green: getCrossDayEntries に viewing sortOrder を追加

- [ ] **Step 1: `apps/web/lib/cross-day.ts` を書き換える**

```ts
import type { CrossDayEntry, DayPatternResponse, DayResponse } from "@sugara/shared";

export function getCrossDayEntries(
  days: DayResponse[],
  targetDayNumber: number,
  viewingPatternSortOrder?: number,
): CrossDayEntry[] {
  const entries: CrossDayEntry[] = [];

  for (const day of days) {
    if (day.dayNumber >= targetDayNumber) continue;
    const patterns = selectSourcePatterns(day.patterns, viewingPatternSortOrder);
    for (const pattern of patterns) {
      for (const schedule of pattern.schedules) {
        if (
          schedule.endDayOffset != null &&
          schedule.endDayOffset > 0 &&
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

/**
 * Pick which patterns of a source day contribute cross-day entries when the
 * viewer is looking at a specific pattern.
 *
 * - If the source day has only one pattern, share its cross-days with every
 *   viewing pattern (treat it as a pre-branch common plan).
 * - If the source day has multiple patterns, show only the pattern whose
 *   sortOrder matches the viewing pattern. If no match, fall back according
 *   to the rule decided in Task 2.0 (default: is_default=true).
 */
function selectSourcePatterns(
  patterns: DayPatternResponse[],
  viewingSortOrder: number | undefined,
): DayPatternResponse[] {
  if (patterns.length <= 1) return patterns;
  if (viewingSortOrder == null) return patterns;

  const matching = patterns.filter((p) => p.sortOrder === viewingSortOrder);
  if (matching.length > 0) return matching;
  // Fall-back behavior (confirmed in Task 2.0):
  return patterns.filter((p) => p.isDefault);
}
```

**注意:** 既存の `cross-day.test.ts` の `makeDays` ヘルパーは 1 日 1 pattern しか生成しない。複数 pattern のケースは Task 2.2 で追加したテストのみがカバーする。Task 2.2 のテストが Green になれば新仕様は検証されている。既存テストの Green 維持は「1 pattern の Day における現状維持」を確認する意味しかないので、Task 2.2 で **複数 pattern のフィルタ・fall-back を両方含めたテストケース** を網羅する必要がある。

- [ ] **Step 2: Green 確認**

```bash
bun run --filter @sugara/web test -- cross-day
```

Expected: all pass

### Task 2.4: 呼び出し元を全箇所更新

- [ ] **Step 1: `apps/web/app/(authenticated)/trips/[id]/page.tsx:596` を書き換え**

```tsx
const dndCrossDayEntries = useMemo(
  () =>
    currentDay && trip
      ? getCrossDayEntries(trip.days, currentDay.dayNumber, currentPattern?.sortOrder)
      : undefined,
  [currentDay?.dayNumber, trip?.days, currentPattern?.sortOrder],
);
```

- [ ] **Step 2: `apps/web/app/(sp)/sp/trips/[id]/page.tsx:222` を同様に書き換え**

- [ ] **Step 3: print ページ (`apps/web/app/(authenticated)/trips/[id]/print/page.tsx` と `apps/web/app/(sp)/sp/trips/[id]/print/page.tsx`) を更新**

現行 (`print/page.tsx:108-113`):
```tsx
{trip.days.map((day) => {
  const crossDayEntries = getCrossDayEntries(trip.days, day.dayNumber);
  return <DaySection key={day.id} day={day} crossDayEntries={crossDayEntries} />;
})}
```

DaySection 内 (`:141-145`):
```tsx
{day.patterns.map((pattern, i) => {
  const merged = buildMergedTimeline(
    pattern.schedules,
    i === 0 ? crossDayEntries : undefined,
  );
  ...
})}
```

問題: 現行は「全 crossDay を最初の pattern にだけ」寄せているので、他 pattern の crossDay は print に出ない or 重複する。

変更方針:
- `getCrossDayEntries` 呼び出しを DaySection 内に移動し、pattern ごとに呼ぶ
- `crossDayEntries` prop を廃止し、DaySection は `day` と `days` を受け取って内部で解決する

```tsx
// page.tsx
{trip.days.map((day) => (
  <DaySection key={day.id} day={day} days={trip.days} />
))}

// DaySection
function DaySection({ day, days }: { day: DayResponse; days: DayResponse[] }) {
  ...
  return (
    <section>
      ...
      {day.patterns.map((pattern) => {
        const crossDayEntries = getCrossDayEntries(days, day.dayNumber, pattern.sortOrder);
        const merged = buildMergedTimeline(pattern.schedules, crossDayEntries);
        ...
      })}
    </section>
  );
}
```

SP 版 print (`apps/web/app/(sp)/sp/trips/[id]/print/page.tsx`) も同じ構造。実施時は両方の DaySection を揃える。

- [ ] **Step 4: `apps/web/app/shared/[token]/_components/shared-trip-client.tsx:225` を更新**

現行: 各 Day の render 内で `const crossDayEntries = getCrossDayEntries(trip.days ?? [], day.dayNumber);` を全 pattern まとめて計算。

この共有ビューは pattern 切替 UI を持つかを Read で確認してから判断する:
- pattern 切替あり → currentPattern の sortOrder を渡す
- pattern 切替なし (全 pattern 並列表示) → print と同じく pattern ごとに呼び分ける
- どちらでもないなら `undefined` を明示的に渡し、従来通り全 pattern の crossDay を表示するコメントを付ける

- [ ] **Step 5: 全テスト実行**

```bash
bun run --filter @sugara/web check-types
bun run --filter @sugara/web test
```

Expected: all pass

### Task 2.5: 実機確認

- [ ] **Step 1: 検証対象 Trip の ID と Day1/Day2 の trip_day_id を動的に取得**

UUID は seed 実行ごとに変わるので、trip 名で検索してから使う:

```bash
docker exec supabase_db_sugara psql -U postgres <<'SQL'
SELECT t.id AS trip_id, td.id AS trip_day_id, td.day_number, dp.id AS pattern_id
  FROM trips t
  JOIN trip_days td ON td.trip_id = t.id
  JOIN day_patterns dp ON dp.trip_day_id = td.id
  WHERE t.name LIKE '%Kyoto%' AND td.day_number IN (1, 2)
  ORDER BY td.day_number;
SQL
```

- [ ] **Step 2: 取得した Day1 trip_day_id を使って「雨」pattern を追加、Day1 default pattern の既存ホテルを日跨ぎ化**

```bash
DAY1_ID="<上で取得した Day1 trip_day_id>"
DAY2_ID="<上で取得した Day2 trip_day_id>"
docker exec supabase_db_sugara psql -U postgres <<SQL
INSERT INTO day_patterns (trip_day_id, label, is_default, sort_order) VALUES ('$DAY1_ID', '雨', false, 1);
INSERT INTO day_patterns (trip_day_id, label, is_default, sort_order) VALUES ('$DAY2_ID', '雨', false, 1);
UPDATE schedules SET end_day_offset=1, end_time='11:00' WHERE name='京都タワーホテル';
SQL
```

- [ ] **Step 3: Day2「デフォルト」(sortOrder=0) を開いて京都タワーホテル crossDay が**表示される**ことを確認**
- [ ] **Step 4: Day2「雨」(sortOrder=1) を開いて京都タワーホテル crossDay が**表示されない**ことを確認** (fall-back ルールに従う)
- [ ] **Step 5: SP 版 (`/sp/trips/...`) でも同様に確認**
- [ ] **Step 6: print ページ (`/trips/.../print`) で、各 pattern にそれぞれの crossDay が出ていることを確認**
- [ ] **Step 7: 検証データを元に戻す** (雨 pattern 2 件を DELETE、京都タワーホテルの end_day_offset=NULL, end_time=NULL)

### Task 2.6: commit / push / PR

```bash
git add -p
git commit -m "fix(web): 並列 pattern の crossDay を viewing pattern の sortOrder で分離"
git push -u origin fix/cross-day-pattern-filter
```

PR body テンプレート:

```markdown
## Summary

- `getCrossDayEntries` に viewing pattern の sortOrder を追加
- source day に複数 pattern がある場合、viewing pattern の sortOrder と一致する source pattern の crossDay のみを抽出
- source day が 1 pattern のみ (分岐前) の場合は全 viewing pattern に共有
- print / shared-trip / SP 版の呼び出し元も pattern ごとに crossDay を計算するよう更新

## Why

並列候補 pattern (例: 晴れ/雨) がある場合、Day2 の雨 pattern を見ていても Day1 の晴れ pattern のホテル crossDay が表示されていた。並列候補は独立したプランという仕様と矛盾する。

## Test plan

- [ ] Day1 に 晴れ/雨 pattern、各々にホテル (endDayOffset=1) を設定
- [ ] Day2 の晴れ pattern で晴れのホテルのみ crossDay 表示
- [ ] Day2 の雨 pattern で雨のホテルのみ crossDay 表示
- [ ] Day1 が 1 pattern のみなら Day2 の全 pattern に crossDay が共有される
- [ ] print ページで各 pattern にそれぞれの crossDay が出る

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

---

## Phase 3: batch-shift の日跨ぎスキップを全カテゴリに拡張

**Why:** 現在は hotel + endDayOffset>0 のみをシフト対象外にしている。しかし transport (夜行バス)、activity (ナイトクルーズ) など hotel 以外の日跨ぎ予定も、batch-shift の endTime 据え置き分岐で所要時間が狂う。`category === "hotel"` を外して `endDayOffset > 0` 全般をシフト対象外にする。

**Files:**
- Modify: `apps/api/src/routes/schedules.ts:199-204`
- Modify: `apps/api/src/__tests__/integration/schedules.integration.test.ts` (既存 integration テストに追加)

### Task 3.1: ブランチ作成

- [ ] **Step 1**

```bash
git checkout main
git pull --ff-only
git checkout -b fix/batch-shift-crossday-skip
```

### Task 3.2: Red: 日跨ぎ transport がスキップされるテストを追加

- [ ] **Step 1: integration test 末尾に追加**

`apps/api/src/__tests__/integration/schedules.integration.test.ts`:

実施時は既存の setup/teardown と createSchedule ヘルパーを確認して合わせる。以下はイメージ:

```ts
describe("batch-shift skips non-hotel cross-day schedules", () => {
  it("skips endDayOffset>0 transport and shifts only regular schedules", async () => {
    const { tripId, dayId, patternId } = await setupTrip();
    // 夜行バス 22:00 → 翌 06:00 (endDayOffset=1)
    const bus = await createSchedule(tripId, dayId, patternId, {
      name: "夜行バス",
      category: "transport",
      startTime: "22:00",
      endTime: "06:00",
      endDayOffset: 1,
    });
    const daytime = await createSchedule(tripId, dayId, patternId, {
      name: "昼観光",
      category: "sightseeing",
      startTime: "10:00",
      endTime: "12:00",
    });

    const res = await app.request(
      `/api/trips/${tripId}/days/${dayId}/patterns/${patternId}/schedules/batch-shift`,
      {
        method: "POST",
        body: JSON.stringify({ scheduleIds: [bus.id, daytime.id], deltaMinutes: 30 }),
      },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.updatedCount).toBe(1);
    expect(body.skippedCount).toBe(1);

    // 夜行バスは skip されて据え置き（所要時間歪みを防ぐため）
    const fetchedBus = await getSchedule(bus.id);
    expect(fetchedBus.startTime).toBe("22:00:00");
    expect(fetchedBus.endTime).toBe("06:00:00");

    // 昼観光は startTime と endTime が両方 30 分後ろにずれる
    const fetchedDaytime = await getSchedule(daytime.id);
    expect(fetchedDaytime.startTime).toBe("10:30:00");
    expect(fetchedDaytime.endTime).toBe("12:30:00");
  });

  it("skips endDayOffset>0 activity as well (e.g. overnight cruise)", async () => {
    const { tripId, dayId, patternId } = await setupTrip();
    const cruise = await createSchedule(tripId, dayId, patternId, {
      name: "ナイトクルーズ",
      category: "activity",
      startTime: "22:00",
      endTime: "02:00",
      endDayOffset: 1,
    });

    const res = await app.request(
      `/api/trips/${tripId}/days/${dayId}/patterns/${patternId}/schedules/batch-shift`,
      {
        method: "POST",
        body: JSON.stringify({ scheduleIds: [cruise.id], deltaMinutes: -15 }),
      },
    );
    const body = await res.json();
    expect(body.updatedCount).toBe(0);
    expect(body.skippedCount).toBe(1);
    const fetched = await getSchedule(cruise.id);
    expect(fetched.startTime).toBe("22:00:00");
    expect(fetched.endTime).toBe("02:00:00");
  });
});
```

- [ ] **Step 2: Red 確認**

```bash
bun run --filter @sugara/api test:integration -- batch-shift
```

Expected: fail（現在は transport がシフトされて startTime=22:30 になる）

### Task 3.3: Green: 判定条件を拡張 + デッドコード除去

- [ ] **Step 1: `apps/api/src/routes/schedules.ts:199-204` の hotel 限定スキップを拡張**

変更前:
```ts
// Skip hotels spanning multiple days
if (schedule.category === "hotel" && schedule.endDayOffset && schedule.endDayOffset > 0) {
  skippedCount++;
  continue;
}
```

変更後:
```ts
// Skip any schedule that spans multiple days. Shifting only startTime would
// leave endTime fixed and silently shorten/lengthen the duration.
if (schedule.endDayOffset && schedule.endDayOffset > 0) {
  skippedCount++;
  continue;
}
```

- [ ] **Step 2: `apps/api/src/routes/schedules.ts:225-237` の endTime 据え置き分岐がデッドコードになるため削除**

現行は上記 skip 判定が hotel 限定だったため、transport/activity の日跨ぎは skip されずこのブロックに到達して「endTime だけ据え置き」していた。Task 3.3 Step 1 で全 endDayOffset>0 が skip されるようになると、このブロックの `endDayOffset > 0` 分岐は到達不能になる。

変更前 (`:225-237`):
```ts
if (!shouldSkip && schedule.endTime) {
  // Don't shift endTime for cross-day schedules
  if (schedule.endDayOffset && schedule.endDayOffset > 0) {
    // Keep endTime as-is
  } else {
    const shifted = shiftTime(schedule.endTime, deltaMinutes);
    if (shifted === null) {
      shouldSkip = true;
    } else {
      newEndTime = shifted;
    }
  }
}
```

変更後:
```ts
if (!shouldSkip && schedule.endTime) {
  const shifted = shiftTime(schedule.endTime, deltaMinutes);
  if (shifted === null) {
    shouldSkip = true;
  } else {
    newEndTime = shifted;
  }
}
```

- [ ] **Step 3: Green 確認**

```bash
bun run --filter @sugara/api test:integration -- batch-shift
```

Expected: pass

- [ ] **Step 4: 全テスト**

```bash
bun run test
bun run check-types
```

Expected: all pass

### Task 3.4: FAQ 更新検討

- [ ] **Step 1: `apps/api/src/db/seed-faqs.ts` を読み、batch-shift に関する FAQ があるか確認**

- [ ] **Step 2: あれば挙動変化 (夜行バスも skip) を反映して ja/en 両方更新、なければ skip**

- [ ] **Step 3: 更新した場合は `bun run --filter @sugara/api db:seed-faqs` でローカル DB に反映**

### Task 3.5: commit / push / PR

```bash
git add apps/api/src/routes/schedules.ts apps/api/src/__tests__/integration/schedules.integration.test.ts
# FAQ 更新がある場合は seed-faqs.ts も追加
git commit -m "fix(api): batch-shift の日跨ぎスキップを全カテゴリに拡張"
git push -u origin fix/batch-shift-crossday-skip
```

PR body テンプレート:

```markdown
## Summary

- batch-shift が hotel 限定で日跨ぎをスキップしていたのを `endDayOffset > 0` 全般に拡張
- 夜行バスやナイトクルーズなど transport/activity の日跨ぎ予定でも所要時間が歪まない
- デッドコードとなった endTime 据え置き分岐を削除
- integration test で transport/activity 両方の skip を検証

## Why

shift 操作は startTime と endTime を同量ずらすが、日跨ぎ予定は endTime が翌日に属するため endTime を据え置いて startTime のみシフトする実装になっていた。しかし skip 判定が hotel 限定だったため、transport/activity の日跨ぎでは endTime だけ据え置かれ所要時間が勝手に短縮/延長される問題があった。

## Test plan

- [ ] 夜行バス (transport, endDayOffset=1) を含む選択で batch-shift → 夜行バスがスキップ
- [ ] ナイトクルーズ (activity, endDayOffset=1) でも同様に skip
- [ ] 通常の schedule は従来通り startTime/endTime が両方シフト

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

---

## Phase 4: schedule に cross_day_anchor を追加し手動優先にする

**Why:** 現状 schedule ↔ schedule は手動並び替え (sortOrder) が永続するが、時刻あり schedule ↔ crossDay の前後だけは時刻比較で固定される。これは sugara の「手動優先」方針と矛盾する。ユーザーが drag で crossDay の前後を指定した場合はそれを永続し、時刻だけ後から編集しても手動配置を壊さないようにする。

**設計方針:** schedule テーブルに optional な anchor カラムを追加する。

```sql
alter table schedules
  add column cross_day_anchor text -- 'before' | 'after' | null
  check (cross_day_anchor in ('before', 'after') or cross_day_anchor is null);

alter table schedules
  add column cross_day_anchor_schedule_id uuid references schedules(id) on delete set null;
```

- `null`: 時刻ベース自動（現行動作）
- `before`: 指定した crossDay source schedule より**前**
- `after`: 指定した crossDay source schedule より**後**
- `anchor_schedule_id`: どの crossDay（= source schedule）に対する anchor か

### Task 4.1: 事前ブレスト

Phase 4 は影響が広いため、実装着手前に別途 brainstorm → 別 plan に分割する。本 plan では方向性と必要なタスクリストのみを記録する。

- [ ] **Step 1: brainstorm 実施**
  - anchor セマンティクスの詳細（複数 crossDay がある場合の振る舞い、anchor が指す schedule が削除された場合、etc.）
  - **複数日跨ぎ (endDayOffset>1) の anchor の扱い**: 3 泊ホテルが Day2/Day3/Day4 で crossDay として現れる場合、anchor が指すのは「特定の表示日の crossDay」か「source schedule そのもの」か
  - 既存データのマイグレーション（全 row で null）
  - 「時刻順」ボタンで anchor をリセットするかの仕様判断
  - drag-end のどの時点で anchor をセットするか
  - anchor を持つ schedule の時刻を後から編集した時の扱い（anchor 維持 vs リセット）
  - merge-timeline の新アルゴリズム擬似コード
  - 既存 33 件の drop-position テストへの影響
  - Phase 2 の pattern フィルタとの相互作用（anchor が別 pattern の crossDay を指す場合の不整合）

**必ずカバーすべきユーザーシナリオ（鳩ノ巣渓谷ケース）:**

現状:
```
[鳩ノ巣渓谷] (時刻なし)
[crossDay] 玉翠荘 チェックアウト ~08:50
[奥多摩駅から奥多摩湖] 09:00-09:15
```

期待 (Phase 4 で実現したい):
```
[crossDay] 玉翠荘 チェックアウト ~08:50
[鳩ノ巣渓谷] (時刻なし)        ← 手動で配置
[奥多摩駅から奥多摩湖] 09:00-09:15
```

このケースは時刻ベース merge では表現不可能で、`cross_day_anchor = 'after'` + `cross_day_anchor_schedule_id = 玉翠荘source` を鳩ノ巣渓谷に保存することで解決する。Phase 4 のコア要件。

- [ ] **Step 2: 別 plan ドキュメントを作成** `docs/plans/YYYY-MM-DD-cross-day-anchor.md`

Phase 4 の実装は別 plan で管理。本 plan では Phase 4 の開始地点までを合意する。

---

## Self-Review

### 1. Spec coverage

- Phase 1: `closestCorners` 置換 → Task 1.3 ✅
- Phase 2: pattern フィルタ → Task 2.3 ✅
- Phase 3: batch-shift 拡張 → Task 3.3 ✅
- Phase 4: 手動 anchor → Task 4.1 で別 plan に繰り延べ（明示）

### 2. Placeholder scan

- Task 1.6 / Task 2.6 の PR body を "..." で省略している → 実施時に本 plan を参照して本文を書き起こす想定。実施者向けに `PR body 例` を残すか検討。
- Task 2.4 Step 3-4 で print / shared-trip の更新手順が簡略。実施時に該当ファイルを Read して、各 pattern への呼び出し箇所を確認のうえ修正する。

### 3. Type consistency

- `getCrossDayEntries` の第 3 引数は `viewingPatternSortOrder: number | undefined` で統一。呼び出し元 4 箇所でも `currentPattern?.sortOrder` (number | undefined) を渡す → 一致。
- `PatternResponse.sortOrder` は既存の shared 型に存在（cross-day.test.ts の `makeDays` でも使用済み）→ 追加インポートのみで足りる。

---

## 実装順序・推奨

1. **Phase 1 → Phase 3 → Phase 2 → Phase 4** の順で PR を出す
   - Phase 1 は最小で即効果
   - Phase 3 は独立（api のみ、web 影響なし）
   - Phase 2 は中規模（frontend 複数箇所）
   - Phase 4 は最大（別 plan 化）
2. 各 Phase は独立に merge 可能なため、並行作業も可能（ただし Phase 2 と Phase 4 は merge-timeline / cross-day 付近で競合する可能性）

## スコープ外（別 issue 推奨）

以下の DnD UX 調整は本 plan に含めない。いずれも軽微な調整で、実機での比較検証が必要なため別 issue で扱う:

- **Touch delay 短縮** (現状 200ms): 誤ドラッグとトレードオフ。100-150ms との比較が必要
- **`MeasuringStrategy.Always` 明示**: スクロール中の drop 位置ずれを予防するが、現状で問題報告がないなら後回しでよい
- **`dropAnimation` カスタマイズ**: 着地位置へフェードするキーフレームに変更すると因果が視覚的に伝わる
- **自動スクロール調整**: 長いタイムラインでの drag 時に画面端のスクロールが追いつかない場合に `autoScroll` オプションを調整
- **最終日の `maxEndDayOffset`**: 「最終日でも翌日跨ぎを選べる」は仕様通り（旅行最終日の夜行移動・ホテル翌朝チェックアウト等）。修正不要
