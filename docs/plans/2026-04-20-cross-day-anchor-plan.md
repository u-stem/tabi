# Cross-Day Anchor 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** schedule に `cross_day_anchor` / `cross_day_anchor_source_id` 2 カラムを追加し、crossDay との前後関係をユーザーが手動で保持できるようにする。

**Architecture:** DB schema 追加 → API の reorder / update 拡張 → merge-timeline / drop-position に anchor 対応 → drag-and-drop / 時刻順ボタン配線 → 実機確認。Last write wins で時刻編集後も手動配置を維持、DB check 制約と API validate で整合性を二重担保する。

**Tech Stack:** PostgreSQL + Drizzle ORM / Hono + Zod / Next.js + React + dnd-kit / Vitest

---

## Prerequisites

- main ブランチが PR #32 までマージ済み
- `supabase start` で Supabase local が起動
- `bun install` 済み
- `bun run --filter @sugara/api db:migrate` が走る状態（MIGRATION_URL が 55322 を向く）

## 参考資料

- 設計仕様: `docs/plans/2026-04-20-cross-day-anchor-spec.md`
- 前身プラン: `docs/plans/2026-04-20-cross-day-followups.md`（Phase 1〜4 概要）

## PR 構成

- **PR A (Phase 4a + 4b)**: DB schema + shared 型 + API (reorder / update 拡張 + validate + endDayOffset cascade)
- **PR B (Phase 4c + 4d + 4e)**: merge-timeline / drop-position / use-trip-drag-and-drop
- **PR C (Phase 4f + 4g)**: 時刻順ボタン（`clearAnchors`）+ 実機確認 + FAQ/News 検討

各 PR はチェックボックスが全部埋まり、`bun run test` と `bun run check-types` が green、実装が spec 通り動いていれば merge 可能。

---

# PR A: DB schema + API (Phase 4a + 4b)

## Task A1: ブランチ作成 & migration 生成準備

**Files:**
- 生成: `apps/api/drizzle/XXXX_add_cross_day_anchor.sql` (drizzle-kit が自動採番)
- 生成: `apps/api/drizzle/XXXX_cross_day_anchor_trigger.sql` (trigger 用、手動作成)
- 変更: `apps/api/src/db/schema.ts`

- [ ] **Step 1: main 最新を取り込んで feature branch を切る**

```bash
git checkout main
git pull --ff-only
git checkout -b feat/cross-day-anchor-db-api
```

- [ ] **Step 2: schema.ts を Read して現状の import / table 定義を確認**

```
Read apps/api/src/db/schema.ts
```

確認事項:
- `drizzle-orm/pg-core` からの import に `check` / `index` / `text` / `uuid` / `integer` / `primaryKey` / `pgTable` があるか
- `drizzle-orm` からの import に `sql` があるか
- `schedules` テーブル定義の列順（`endDayOffset` の位置と現在の index/constraint 構造）

欠けている import は Step 3 の編集で同時に追記する。

- [ ] **Step 3: schema.ts に 2 カラム + index + check 制約を追加**

`apps/api/src/db/schema.ts` の import 追記（`check`, `sql` が未 import なら追加）:

```ts
// pg-core import に check を追加
import { check, index, integer, pgTable, /* 既存 */ ... } from "drizzle-orm/pg-core";
// drizzle-orm ルートから sql が未 import なら追加
import { sql } from "drizzle-orm";
```

`schedules` テーブル定義（L240 付近）の `endDayOffset` 行の直下に 2 列追加:

変更前:
```ts
endDayOffset: integer("end_day_offset"),
latitude: doublePrecision("latitude"),
```

変更後:
```ts
endDayOffset: integer("end_day_offset"),
crossDayAnchor: text("cross_day_anchor", { enum: ["before", "after"] }),
crossDayAnchorSourceId: uuid("cross_day_anchor_source_id").references(
  (): AnyPgColumn => schedules.id,
  { onDelete: "set null" },
),
latitude: doublePrecision("latitude"),
```

FK の自己参照には `AnyPgColumn` を返り値型として明示する必要がある。先頭 import に追記:

```ts
import { type AnyPgColumn, check, index, /* 既存 */ ... } from "drizzle-orm/pg-core";
```

同テーブル定義の末尾 `(table) => [ ... ]` を次に書き換え:

```ts
(table) => [
  index("schedules_trip_id_idx").on(table.tripId),
  index("schedules_day_pattern_id_idx").on(table.dayPatternId),
  index("schedules_anchor_source_idx").on(table.crossDayAnchorSourceId),
  check(
    "schedules_anchor_consistency",
    sql`(${table.crossDayAnchor} is null) = (${table.crossDayAnchorSourceId} is null)`,
  ),
],
```

- [ ] **Step 4: drizzle-kit で列追加分の migration を生成**

```bash
bun run --filter @sugara/api db:generate
```

Expected: `apps/api/drizzle/XXXX_add_cross_day_anchor.sql` が生成され、次の内容を含む:
- `ALTER TABLE "schedules" ADD COLUMN "cross_day_anchor" text`
- `ALTER TABLE "schedules" ADD COLUMN "cross_day_anchor_source_id" uuid`
- FK 制約 (`ON DELETE SET NULL`)
- `schedules_anchor_source_idx` インデックス
- check 制約 `schedules_anchor_consistency`

drizzle-kit が FK の `ON DELETE SET NULL` を生成しなかった場合のみ、生成された sql ファイルを手動編集して追加:

```sql
-- 既存の ADD COLUMN "cross_day_anchor_source_id" uuid の直後に
ALTER TABLE "schedules"
  ADD CONSTRAINT "schedules_cross_day_anchor_source_fk"
  FOREIGN KEY ("cross_day_anchor_source_id")
  REFERENCES "schedules"("id")
  ON DELETE SET NULL;
```

- [ ] **Step 5: trigger 用の migration を別ファイルで手動作成**

drizzle-kit は PostgreSQL の trigger を schema から追跡しないので、`db:generate` 実行時に trigger 定義が DROP される恐れがある。**trigger は drizzle schema とは独立した migration ファイルとして作成**し、`meta/_journal.json` に手動で登録する方式を取る。

ファイル名は Step 4 で生成された migration のタイムスタンプに +1 秒した値を使う。例えば `0042_add_cross_day_anchor.sql` が生成されたなら、`0043_cross_day_anchor_trigger.sql` として作る:

```bash
# Step 4 で生成された採番を確認
ls apps/api/drizzle/*.sql | sort | tail -1
```

該当番号 +1 で新規ファイル `apps/api/drizzle/XXXX_cross_day_anchor_trigger.sql` を作成:

```sql
-- BEFORE UPDATE trigger: FK ON DELETE SET NULL で source_id が null になった時、
-- cross_day_anchor enum も同時に null に揃え、check 制約違反を防ぐ。
CREATE OR REPLACE FUNCTION schedules_clear_anchor_enum_on_null()
RETURNS trigger AS $$
BEGIN
  IF NEW.cross_day_anchor_source_id IS NULL AND NEW.cross_day_anchor IS NOT NULL THEN
    NEW.cross_day_anchor := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS schedules_anchor_enum_sync ON schedules;
CREATE TRIGGER schedules_anchor_enum_sync
BEFORE UPDATE OF cross_day_anchor_source_id ON schedules
FOR EACH ROW
EXECUTE FUNCTION schedules_clear_anchor_enum_on_null();
```

`CREATE OR REPLACE FUNCTION` と `DROP TRIGGER IF EXISTS` で冪等化しているため、次回の `db:generate` で drizzle-kit が差分 SQL を生成しても、この trigger migration は DDL 順序上問題なく共存する。

- [ ] **Step 6: `meta/_journal.json` に trigger migration を登録**

`apps/api/drizzle/meta/_journal.json` を開いて、`entries` 配列末尾に Step 5 で作ったファイルを手動追加:

```json
{
  "idx": <採番>,
  "version": "<既存 entry と同じ version>",
  "when": <Unix epoch ms>,
  "tag": "XXXX_cross_day_anchor_trigger",
  "breakpoints": true
}
```

（既存 entry をコピーして `idx`, `tag`, `when` を更新するのが確実）

- [ ] **Step 7: 次回 `db:generate` で trigger が消えないことを確認**

```bash
bun run --filter @sugara/api db:generate
```

Expected: 変更なし（schema.ts を変えていないので新規 migration は生成されない）。`0043_cross_day_anchor_trigger.sql` は残っている。

これでトリガーが drizzle-kit の introspect 対象外でも migration 履歴に残り続ける。

- [ ] **Step 8: migration 適用**

```bash
bun run --filter @sugara/api db:migrate
```

Expected: `Migrations applied successfully`。

検証:
```bash
docker exec supabase_db_sugara psql -U postgres -d postgres -c "\d schedules" | grep -E "cross_day|anchor"
```
Expected:
- `cross_day_anchor` text 行
- `cross_day_anchor_source_id` uuid 行
- `schedules_anchor_consistency` check 制約
- `schedules_cross_day_anchor_source_fk` FK
- `schedules_anchor_enum_sync` trigger

trigger 検証:
```bash
docker exec supabase_db_sugara psql -U postgres -d postgres -c "\dft+"
```
Expected: `schedules_clear_anchor_enum_on_null` が一覧にある。

- [ ] **Step 9: trigger の動作確認**

手で SET NULL を起こして trigger が動くことを確認:

```bash
docker exec supabase_db_sugara psql -U postgres <<'SQL'
-- 一時的な schedule を 2 件作成して anchor をセット
-- （実環境を汚さないため別 trip を作る必要あり。この確認は integration test の方が適切）
-- ここでは trigger 存在確認のみで代用する
SELECT tgname FROM pg_trigger WHERE tgname = 'schedules_anchor_enum_sync';
SQL
```
Expected: 1 行返る。

- [ ] **Step 10: commit**

```bash
git add apps/api/src/db/schema.ts apps/api/drizzle/
git commit -m "feat(api): schedules に cross_day_anchor 2 カラムと整合性 trigger を追加"
```

---

## Task A2: shared 型と Zod schema の拡張

**Files:**
- 変更: `packages/shared/src/types.ts`
- 変更: `packages/shared/src/schemas/schedule.ts`

- [ ] **Step 1: `packages/shared/src/types.ts` の ScheduleResponse に 2 フィールド追加**

`ScheduleResponse` 型定義内の `endDayOffset` の直下に追加:

```ts
endDayOffset?: number | null;
crossDayAnchor?: "before" | "after" | null;
crossDayAnchorSourceId?: string | null;
```

`CandidateResponse` にも同じ 2 フィールドを追加する（候補は現状 anchor null だが、型として揃える。assign 後に反映される可能性を考慮）:

```ts
// CandidateResponse も同様
crossDayAnchor?: "before" | "after" | null;
crossDayAnchorSourceId?: string | null;
```

- [ ] **Step 2: `packages/shared/src/schemas/schedule.ts` の updateScheduleSchema 基底に 2 列を追加**

`createScheduleSchema` の `z.object({ ... })` 内、末尾 (`placeId: z.string()...` の直下) に追加:

```ts
crossDayAnchor: z.enum(["before", "after"]).nullable().optional(),
crossDayAnchorSourceId: z.string().check(z.guid()).nullable().optional(),
```

これで create/update 両方で受理される（create は別途 API で null 固定に落とす）。

- [ ] **Step 3: `reorderSchedulesSchema` に anchors と clearAnchors を追加**

同ファイル内、`reorderSchedulesSchema` を次のように書き換える:

```ts
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
  clearAnchors: z.boolean().optional(),
});
```

- [ ] **Step 4: shared の型チェック**

```bash
bun run --filter @sugara/shared check-types
```
Expected: exit 0

- [ ] **Step 5: commit**

```bash
git add packages/shared/src/
git commit -m "feat(shared): ScheduleResponse と reorder schema に anchor 追加"
```

---

## Task A3: reorder API で anchors を受理する - Red

**Files:**
- 変更: `apps/api/src/__tests__/integration/schedules.integration.test.ts`

- [ ] **Step 1: integration テストを追加**

ファイルの末尾の `});` (schedules Integration describe の閉じ) の直前に以下を追加:

```ts
  describe("reorder with anchors", () => {
    it("applies anchor fields to the specified schedule", async () => {
      // Day1 に endDayOffset>0 のホテルを作り、Day2 に anchor 対象 schedule を作る想定
      // setupTrip は Day1 のみ作るので同一 day で anchor を設定して validate を pass させるだけの最小ケース
      const hotel = await createSchedule(tripId, dayId, patternId, {
        name: "Hotel",
        category: "hotel",
        startTime: "15:00",
        endTime: "10:00",
        endDayOffset: 1,
      });
      const target = await createSchedule(tripId, dayId, patternId, {
        name: "Target",
        category: "sightseeing",
      });

      const res = await app.request(
        `/api/trips/${tripId}/days/${dayId}/patterns/${patternId}/schedules/reorder`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scheduleIds: [hotel.id, target.id],
            anchors: [
              { scheduleId: target.id, anchor: "after", anchorSourceId: hotel.id },
            ],
          }),
        },
      );
      expect(res.status).toBe(200);

      const listRes = await app.request(
        `/api/trips/${tripId}/days/${dayId}/patterns/${patternId}/schedules`,
      );
      const list = await listRes.json();
      const fetched = list.find((s: { id: string }) => s.id === target.id);
      expect(fetched.crossDayAnchor).toBe("after");
      expect(fetched.crossDayAnchorSourceId).toBe(hotel.id);
    });

    it("rejects anchor pointing to a schedule without endDayOffset", async () => {
      const plain = await createSchedule(tripId, dayId, patternId, {
        name: "Not a hotel",
        category: "sightseeing",
      });
      const target = await createSchedule(tripId, dayId, patternId, {
        name: "Target",
        category: "sightseeing",
      });

      const res = await app.request(
        `/api/trips/${tripId}/days/${dayId}/patterns/${patternId}/schedules/reorder`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scheduleIds: [plain.id, target.id],
            anchors: [
              { scheduleId: target.id, anchor: "after", anchorSourceId: plain.id },
            ],
          }),
        },
      );
      expect(res.status).toBe(400);
    });

    it("rejects partial anchor fields (anchor without source)", async () => {
      const target = await createSchedule(tripId, dayId, patternId, {
        name: "Target",
        category: "sightseeing",
      });

      const res = await app.request(
        `/api/trips/${tripId}/days/${dayId}/patterns/${patternId}/schedules/reorder`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scheduleIds: [target.id],
            anchors: [
              { scheduleId: target.id, anchor: "after", anchorSourceId: null },
            ],
          }),
        },
      );
      expect(res.status).toBe(400);
    });

    it("rejects anchor pointing to itself", async () => {
      const hotel = await createSchedule(tripId, dayId, patternId, {
        name: "Hotel",
        category: "hotel",
        startTime: "15:00",
        endTime: "10:00",
        endDayOffset: 1,
      });

      const res = await app.request(
        `/api/trips/${tripId}/days/${dayId}/patterns/${patternId}/schedules/reorder`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scheduleIds: [hotel.id],
            anchors: [
              { scheduleId: hotel.id, anchor: "after", anchorSourceId: hotel.id },
            ],
          }),
        },
      );
      expect(res.status).toBe(400);
    });

    it("clears all anchors when clearAnchors=true", async () => {
      const hotel = await createSchedule(tripId, dayId, patternId, {
        name: "Hotel",
        category: "hotel",
        startTime: "15:00",
        endTime: "10:00",
        endDayOffset: 1,
      });
      const target = await createSchedule(tripId, dayId, patternId, {
        name: "Target",
        category: "sightseeing",
      });

      // まず anchor をセット
      await app.request(
        `/api/trips/${tripId}/days/${dayId}/patterns/${patternId}/schedules/reorder`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scheduleIds: [hotel.id, target.id],
            anchors: [
              { scheduleId: target.id, anchor: "after", anchorSourceId: hotel.id },
            ],
          }),
        },
      );

      // clearAnchors で一括クリア
      const res = await app.request(
        `/api/trips/${tripId}/days/${dayId}/patterns/${patternId}/schedules/reorder`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scheduleIds: [hotel.id, target.id],
            clearAnchors: true,
          }),
        },
      );
      expect(res.status).toBe(200);

      const listRes = await app.request(
        `/api/trips/${tripId}/days/${dayId}/patterns/${patternId}/schedules`,
      );
      const list = await listRes.json();
      const fetched = list.find((s: { id: string }) => s.id === target.id);
      expect(fetched.crossDayAnchor).toBeNull();
      expect(fetched.crossDayAnchorSourceId).toBeNull();
    });
  });
```

- [ ] **Step 2: Red 確認**

```bash
bun run --filter @sugara/api test:integration -- schedules
```
Expected: 上記 5 テストが全て FAIL（API 未実装のため anchor が設定されない / validate が通らない / clearAnchors が無視される）。

---

## Task A4: reorder API 実装 - Green（4 ステップに分割）

**Files:**
- 変更: `apps/api/src/routes/schedules.ts`

既存の reorder ハンドラを段階的に書き換える。各ステップで該当 test が順に pass していくことを確認。

- [ ] **Step 1: reorder ハンドラの Zod 受理を anchors / clearAnchors 対応に変える**

`apps/api/src/routes/schedules.ts` の既存 reorder ハンドラ（L357 付近）で `parsed.data` から `anchors` と `clearAnchors` を destructure:

変更前:
```ts
const parsed = reorderSchedulesSchema.safeParse(body);
if (!parsed.success) {
  return c.json({ error: parsed.error.flatten() }, 400);
}

// Verify all schedules belong to this pattern before updating
if (parsed.data.scheduleIds.length > 0) {
  ...
}
```

変更後（最小差分でパラメータ取得のみ追加）:
```ts
const parsed = reorderSchedulesSchema.safeParse(body);
if (!parsed.success) {
  return c.json({ error: parsed.error.flatten() }, 400);
}
const { scheduleIds, anchors, clearAnchors } = parsed.data;

// Verify all schedules belong to this pattern before updating
if (scheduleIds.length > 0) {
  const targetSchedules = await db.query.schedules.findMany({
    where: and(inArray(schedules.id, scheduleIds), eq(schedules.dayPatternId, patternId)),
    columns: { id: true },
  });
  if (targetSchedules.length !== scheduleIds.length) {
    return c.json({ error: ERROR_MSG.INVALID_REORDER }, 400);
  }
}
```

- [ ] **Step 2: anchors の validate を追加（rejection 系テストを pass させる）**

上記 `if (scheduleIds.length > 0) { ... }` の直後に、Task A5 で作成する `validateAnchors` helper を呼ぶコードを入れる。ただし Task A5 をまだ実行していない場合はこの Step で先に helper ファイルを作成する：

`apps/api/src/lib/anchor-validate.ts` を Task A5 Step 3 の定義通りに作成する（Task A5 を Task A4 より前に実行するのが簡単）。

追加コード:

```ts
// anchors validate
if (anchors && anchors.length > 0) {
  const check = await validateAnchors(db, tripId, patternId, anchors);
  if (check.ok === false) {
    return c.json({ error: check.message }, check.status);
  }
}
```

import に追加:
```ts
import { validateAnchors } from "../lib/anchor-validate";
```

- [ ] **Step 3: transaction 内で sortOrder 更新 + anchor 書き込みを行う**

既存の `if (parsed.data.scheduleIds.length > 0) { await db.update(schedules).set({ sortOrder: sql\`CASE ...\` }).where(inArray(...)); }` を transaction に包み、anchor 書き込みも含める:

変更後:
```ts
if (scheduleIds.length === 0 && !clearAnchors && (!anchors || anchors.length === 0)) {
  return c.json({ ok: true });
}

await db.transaction(async (tx) => {
  if (scheduleIds.length > 0) {
    await tx
      .update(schedules)
      .set({
        sortOrder: sql`CASE ${sql.join(
          scheduleIds.map((id, i) => sql`WHEN ${schedules.id} = ${id} THEN ${i}::integer`),
          sql` `,
        )} END`,
      })
      .where(inArray(schedules.id, scheduleIds));
  }

  if (clearAnchors && scheduleIds.length > 0) {
    await tx
      .update(schedules)
      .set({ crossDayAnchor: null, crossDayAnchorSourceId: null })
      .where(inArray(schedules.id, scheduleIds));
  } else if (anchors && anchors.length > 0) {
    for (const a of anchors) {
      await tx
        .update(schedules)
        .set({
          crossDayAnchor: a.anchor,
          crossDayAnchorSourceId: a.anchorSourceId,
        })
        .where(eq(schedules.id, a.scheduleId));
    }
  }
});

return c.json({ ok: true });
```

- [ ] **Step 4: Green 確認**

```bash
bun run --filter @sugara/api test:integration -- schedules
```
Expected: Task A3 の 5 テスト + 既存 reorder テストが全 pass。

- [ ] **Step 5: commit**

```bash
git add apps/api/src/routes/schedules.ts apps/api/src/lib/anchor-validate.ts apps/api/src/__tests__/integration/schedules.integration.test.ts
git commit -m "feat(api): reorder エンドポイントに anchors と clearAnchors を追加"
```

---

## Task A5: update API での endDayOffset cascade と anchor validate

**Files:**
- 変更: `apps/api/src/routes/schedules.ts`
- 変更: `apps/api/src/__tests__/integration/schedules.integration.test.ts`

- [ ] **Step 1: integration テスト追加 (Red)**

integration test の末尾 `});` 直前に:

```ts
  describe("update with anchor cascade", () => {
    it("clears anchors on schedules referencing a hotel whose endDayOffset is set to null", async () => {
      const hotel = await createSchedule(tripId, dayId, patternId, {
        name: "Hotel",
        category: "hotel",
        startTime: "15:00",
        endTime: "10:00",
        endDayOffset: 1,
      });
      const target = await createSchedule(tripId, dayId, patternId, {
        name: "Target",
        category: "sightseeing",
      });
      // anchor を設定
      await app.request(
        `/api/trips/${tripId}/days/${dayId}/patterns/${patternId}/schedules/reorder`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scheduleIds: [hotel.id, target.id],
            anchors: [{ scheduleId: target.id, anchor: "after", anchorSourceId: hotel.id }],
          }),
        },
      );

      // hotel の endDayOffset を null に更新
      const updateRes = await app.request(
        `/api/trips/${tripId}/days/${dayId}/patterns/${patternId}/schedules/${hotel.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endDayOffset: null, endTime: null }),
        },
      );
      expect(updateRes.status).toBe(200);

      // target の anchor が null にクリアされていること
      const listRes = await app.request(
        `/api/trips/${tripId}/days/${dayId}/patterns/${patternId}/schedules`,
      );
      const list = await listRes.json();
      const fetched = list.find((s: { id: string }) => s.id === target.id);
      expect(fetched.crossDayAnchor).toBeNull();
      expect(fetched.crossDayAnchorSourceId).toBeNull();
    });

    it("rejects anchor in update when target dayPatternId is null (candidate)", async () => {
      const hotel = await createSchedule(tripId, dayId, patternId, {
        name: "Hotel",
        category: "hotel",
        startTime: "15:00",
        endTime: "10:00",
        endDayOffset: 1,
      });
      const target = await createSchedule(tripId, dayId, patternId, {
        name: "Target",
        category: "sightseeing",
      });
      // candidate 化
      await app.request(`/api/trips/${tripId}/schedules/${target.id}/unassign`, {
        method: "POST",
      });

      // candidate への anchor セットは update 経由で拒否
      const res = await app.request(
        `/api/trips/${tripId}/days/${dayId}/patterns/${patternId}/schedules/${target.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            crossDayAnchor: "after",
            crossDayAnchorSourceId: hotel.id,
          }),
        },
      );
      // target は別 pattern (null) に属すので 404 が自然だが、validate の目的上 400 でもよい
      expect([400, 404]).toContain(res.status);
    });
  });
```

- [ ] **Step 2: Red 確認**

```bash
bun run --filter @sugara/api test:integration -- schedules
```
Expected: 2 テストが FAIL。

- [ ] **Step 3: update ハンドラを cascade 対応に**

`apps/api/src/routes/schedules.ts` の `PATCH /:tripId/days/:dayId/patterns/:patternId/schedules/:scheduleId` ハンドラ（L405 付近）を書き換える。既存のロジックを保持しつつ、以下を追加:

(1) anchor 書き込み時の validate（reorder と同じロジックを helper 化）
(2) endDayOffset が null/0 に更新される時の cascade クリア

まず validate 用のユーティリティを `apps/api/src/lib/anchor-validate.ts` として新規作成:

```ts
import { and, eq, inArray } from "drizzle-orm";
import type { db as rootDb } from "../db/index";
import { schedules } from "../db/schema";

export type AnchorInput = {
  scheduleId: string;
  anchor: "before" | "after" | null;
  anchorSourceId: string | null;
};

export type AnchorValidateResult =
  | { ok: true }
  | { ok: false; status: 400; message: string };

/**
 * DbOrTx is inferred from the exported root `db` so it matches either the
 * top-level Drizzle client or a transaction instance returned by
 * `db.transaction(async (tx) => ...)`. Both expose `query.schedules.findMany`.
 */
type DbOrTx = typeof rootDb | Parameters<Parameters<typeof rootDb.transaction>[0]>[0];

export async function validateAnchors(
  dbOrTx: DbOrTx,
  tripId: string,
  patternId: string,
  anchors: AnchorInput[],
): Promise<AnchorValidateResult> {
  for (const a of anchors) {
    if ((a.anchor === null) !== (a.anchorSourceId === null)) {
      return {
        ok: false,
        status: 400,
        message: "anchor と anchorSourceId は両方セットか両方 null にしてください",
      };
    }
    if (a.anchorSourceId && a.anchorSourceId === a.scheduleId) {
      return { ok: false, status: 400, message: "anchorSourceId は自分自身を指せません" };
    }
  }

  const targetIds = anchors.map((a) => a.scheduleId);
  if (targetIds.length > 0) {
    const targets = await dbOrTx.query.schedules.findMany({
      where: and(inArray(schedules.id, targetIds), eq(schedules.dayPatternId, patternId)),
      columns: { id: true },
    });
    if (targets.length !== targetIds.length) {
      return { ok: false, status: 400, message: "anchor の対象が pattern に存在しません" };
    }
  }

  const sourceIds = anchors
    .map((a) => a.anchorSourceId)
    .filter((id): id is string => id !== null);
  if (sourceIds.length === 0) return { ok: true };

  const sources = await dbOrTx.query.schedules.findMany({
    where: and(inArray(schedules.id, sourceIds), eq(schedules.tripId, tripId)),
    columns: { id: true, endDayOffset: true },
  });
  const sourceMap = new Map(sources.map((s) => [s.id, s]));
  for (const a of anchors) {
    if (a.anchorSourceId === null) continue;
    const source = sourceMap.get(a.anchorSourceId);
    if (!source) {
      return { ok: false, status: 400, message: "anchorSourceId が trip 内に存在しません" };
    }
    if (!source.endDayOffset || source.endDayOffset <= 0) {
      return {
        ok: false,
        status: 400,
        message: "anchorSourceId は endDayOffset > 0 の schedule でなければなりません",
      };
    }
  }
  return { ok: true };
}
```

型の要点:
- `typeof rootDb` で root の Drizzle db 型を拾う
- `db.transaction((tx) => ...)` の tx 型は `Parameters<Parameters<typeof rootDb.transaction>[0]>[0]` で抽出
- 両者のユニオンを `DbOrTx` とする。`query.schedules.findMany` のシグネチャは両方に揃っている
- `columns: { id: true }` / `{ id: true, endDayOffset: true }` で select 列を最小化


- [ ] **Step 4: update ハンドラで cascade と validate を呼ぶ**

`apps/api/src/routes/schedules.ts` の update ハンドラ末尾近く、`updated` を返す直前に以下の cascade ロジックを入れる:

```ts
// 既存の [updated] = await db.update(schedules).set(...).returning() の直後
if (
  "endDayOffset" in updateData &&
  (updateData.endDayOffset === null || updateData.endDayOffset === 0) &&
  (existing.endDayOffset ?? 0) > 0
) {
  // この schedule を anchor_source として参照している全 schedule の anchor をクリア
  await db
    .update(schedules)
    .set({ crossDayAnchor: null, crossDayAnchorSourceId: null })
    .where(eq(schedules.crossDayAnchorSourceId, scheduleId));
}
```

また update 入力に `crossDayAnchor` / `crossDayAnchorSourceId` が含まれる場合、上の reorder で書いた validate ロジックを呼ぶ（helper 化した `validateAnchors` を使う）:

```ts
if ("crossDayAnchor" in updateData || "crossDayAnchorSourceId" in updateData) {
  const check = await validateAnchors(db, tripId, patternId, [
    {
      scheduleId,
      anchor: updateData.crossDayAnchor ?? null,
      anchorSourceId: updateData.crossDayAnchorSourceId ?? null,
    },
  ]);
  if (check.ok === false) {
    return c.json({ error: check.message }, check.status);
  }
}
```

この validate は既存の optimistic lock の前に置く。

- [ ] **Step 5: reorder ハンドラも helper を使うよう refactor**

Task A4 の reorder 内 validate を `validateAnchors(tx, tripId, patternId, anchors)` 呼び出しに置き換える（同じロジックなので重複排除）。

- [ ] **Step 6: Green 確認**

```bash
bun run --filter @sugara/api test:integration -- schedules
bun run --filter @sugara/api check-types
bun run --filter @sugara/api check
```
Expected: 全 pass / exit 0

- [ ] **Step 7: commit**

```bash
git add apps/api/src/routes/schedules.ts apps/api/src/lib/anchor-validate.ts apps/api/src/__tests__/integration/schedules.integration.test.ts
git commit -m "feat(api): update の endDayOffset 変更で anchor を cascade クリア + validate helper 抽出"
```

---

## Task A6: PR A 単独 merge smoke test + push + PR 作成

PR A は schema + API のみ。web 側で anchor を扱うコードはまだないが、`ScheduleResponse` に optional フィールドが増えているので型チェックと既存経路のスモークが必要。

- [ ] **Step 1: 全パッケージの型・テストを通す**

```bash
bun run check-types
bun run test
```
Expected: すべて pass。`ScheduleResponse` に追加された 2 フィールドが optional + nullable なので既存クライアントコードはビルド影響を受けない。

- [ ] **Step 2: smoke test - 既存の reorder 経路が壊れていないことを確認**

```bash
bun run --filter @sugara/api test:integration -- schedules
```

Expected:
- 新規 7 テスト（reorder anchor 5 + update cascade 2）pass
- 既存 reorder テスト `reorders schedules` / `reorder with candidate ids...` 等も pass

- [ ] **Step 3: smoke - 既存の assign / create / update 経路で anchor が null 固定**

integration テスト追加で、assign / create 直後の schedule の `crossDayAnchor` と `crossDayAnchorSourceId` が null であることを確認:

```ts
// apps/api/src/__tests__/integration/schedules.integration.test.ts の describe 内に追加
it("creates schedule with null anchors by default", async () => {
  const created = await createSchedule(tripId, dayId, patternId, {
    name: "Plain",
    category: "sightseeing",
  });
  expect(created.crossDayAnchor).toBeNull();
  expect(created.crossDayAnchorSourceId).toBeNull();
});
```

実行:
```bash
bun run --filter @sugara/api test:integration -- schedules
```
Expected: 追加 1 テスト pass

- [ ] **Step 4: smoke - trigger 動作検証**

integration テストに trigger 検証を追加。`cross_day_anchor_source_id` を SQL 直で null にして `cross_day_anchor` が自動的に null になることを確認:

```ts
it("trigger nulls cross_day_anchor when source_id becomes null", async () => {
  const hotel = await createSchedule(tripId, dayId, patternId, {
    name: "Hotel",
    category: "hotel",
    startTime: "15:00",
    endTime: "10:00",
    endDayOffset: 1,
  });
  const target = await createSchedule(tripId, dayId, patternId, {
    name: "Target",
    category: "sightseeing",
  });
  await app.request(
    `/api/trips/${tripId}/days/${dayId}/patterns/${patternId}/schedules/reorder`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scheduleIds: [hotel.id, target.id],
        anchors: [{ scheduleId: target.id, anchor: "after", anchorSourceId: hotel.id }],
      }),
    },
  );

  // Simulate FK SET NULL by setting source_id directly to NULL via raw SQL
  const tx = getTestDb();
  await tx
    .update(schedules)
    .set({ crossDayAnchorSourceId: null })
    .where(eq(schedules.id, target.id));

  const after = await tx.query.schedules.findFirst({
    where: eq(schedules.id, target.id),
  });
  // trigger が crossDayAnchor を null に同期させたはず
  expect(after?.crossDayAnchor).toBeNull();
  expect(after?.crossDayAnchorSourceId).toBeNull();
});
```

import 追加（ファイル先頭付近）:
```ts
import { eq } from "drizzle-orm";
import { schedules } from "../../db/schema";
```

実行:
```bash
bun run --filter @sugara/api test:integration -- schedules
```
Expected: trigger テスト pass

- [ ] **Step 5: commit smoke tests**

```bash
git add apps/api/src/__tests__/integration/schedules.integration.test.ts
git commit -m "test(api): anchor のデフォルト null と trigger 動作のスモークテスト追加"
```

- [ ] **Step 6: push + PR 作成**

```bash
git push -u origin feat/cross-day-anchor-db-api
gh pr create --title "feat: cross_day_anchor スキーマと API (Phase 4a+4b)" --body "$(cat <<'EOF'
## Summary

- schedules に cross_day_anchor / cross_day_anchor_source_id カラムを追加
- DB check 制約と BEFORE UPDATE トリガーで整合性保証
- reorder API に anchors / clearAnchors 追加、validate 実装
- update API で endDayOffset が null/0 に変更される際に anchor を cascade クリア
- integration test 7 件追加

## Why

spec: docs/plans/2026-04-20-cross-day-anchor-spec.md 参照。PR B (web 側 merge/drop-position/drag-drop) の前提となる schema + API の土台。

## Test plan

- [ ] local で db:migrate が冪等に流れる
- [ ] reorder の anchor 書き込み / clearAnchors 経路が動作
- [ ] 不正な anchor が validate で弾かれる
- [ ] hotel の endDayOffset を null に更新すると関連 anchor がクリアされる

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

# PR B: merge-timeline + drop-position + drag-and-drop (Phase 4c + 4d + 4e)

PR A がマージされた状態で着手する。以下は main pull 後の前提。

## Task B1: ブランチ作成 + 既存テスト baseline

- [ ] **Step 1:**

```bash
git checkout main && git pull --ff-only
git checkout -b feat/cross-day-anchor-web
```

- [ ] **Step 2: baseline テスト確認**

```bash
bun run --filter @sugara/web test -- merge-timeline
bun run --filter @sugara/web test -- drop-position
bun run --filter @sugara/web test -- use-trip-drag-and-drop
```
Expected: 全 pass（PR #28〜#32 後の状態）

---

## Task B2: merge-timeline の anchor 対応 - Red

**Files:**
- 変更: `apps/web/lib/__tests__/merge-timeline.test.ts`

- [ ] **Step 1: テストファイルの末尾に anchor ケースを追加**

既存 `describe("buildMergedTimeline", () => { ... });` の閉じ `});` の直後に以下を追加:

```ts
describe("buildMergedTimeline with cross-day anchors", () => {
  function makeAnchoredSchedule(
    id: string,
    anchor: "before" | "after",
    sourceId: string,
    overrides: Partial<ScheduleResponse> = {},
  ): ScheduleResponse {
    return makeSchedule({
      id,
      crossDayAnchor: anchor,
      crossDayAnchorSourceId: sourceId,
      ...overrides,
    });
  }

  it("places anchor='after' schedule immediately after the matching crossDay", () => {
    // 鳩ノ巣渓谷 シナリオ
    const hotelId = "hotel-day1";
    const checkout = makeCrossDayEntry({ id: hotelId, endTime: "08:50" });
    const schedules = [
      makeAnchoredSchedule("hatonosu", "after", hotelId, { sortOrder: 0 }),
      makeSchedule({ id: "okutama", startTime: "09:00", sortOrder: 1 }),
    ];
    const result = ids(buildMergedTimeline(schedules, [checkout]));
    expect(result).toEqual(["c-hotel-day1", "hatonosu", "okutama"]);
  });

  it("places anchor='before' schedule immediately before the matching crossDay", () => {
    const hotelId = "hotel-day1";
    const checkout = makeCrossDayEntry({ id: hotelId, endTime: "08:50" });
    const schedules = [
      makeAnchoredSchedule("before-check", "before", hotelId, { sortOrder: 0 }),
      makeSchedule({ id: "okutama", startTime: "09:00", sortOrder: 1 }),
    ];
    const result = ids(buildMergedTimeline(schedules, [checkout]));
    expect(result).toEqual(["before-check", "c-hotel-day1", "okutama"]);
  });

  it("sorts multiple anchored schedules by sortOrder within the same position", () => {
    const hotelId = "hotel-day1";
    const checkout = makeCrossDayEntry({ id: hotelId, endTime: "08:50" });
    const schedules = [
      makeAnchoredSchedule("a2", "after", hotelId, { sortOrder: 2 }),
      makeAnchoredSchedule("a1", "after", hotelId, { sortOrder: 1 }),
      makeSchedule({ id: "okutama", startTime: "09:00", sortOrder: 3 }),
    ];
    const result = ids(buildMergedTimeline(schedules, [checkout]));
    expect(result).toEqual(["c-hotel-day1", "a1", "a2", "okutama"]);
  });

  it("falls back to time-based merge when anchorSourceId doesn't match any crossDay", () => {
    // 別 pattern のホテルを指す anchor は fallback
    const checkout = makeCrossDayEntry({ id: "hotel-a", endTime: "08:50" });
    const schedules = [
      makeAnchoredSchedule("orphan", "after", "hotel-b", {
        sortOrder: 0,
        startTime: "10:00",
      }),
    ];
    const result = ids(buildMergedTimeline(schedules, [checkout]));
    // anchor 無視 → 時刻 merge: checkout(08:50) < orphan(10:00)
    expect(result).toEqual(["c-hotel-a", "orphan"]);
  });

  it("falls back to time-based merge when anchorSourceId is null (partial anchor)", () => {
    const checkout = makeCrossDayEntry({ id: "hotel-a", endTime: "08:50" });
    const schedules = [
      makeAnchoredSchedule("partial", "after", null as unknown as string, {
        sortOrder: 0,
        startTime: "10:00",
      }),
    ];
    const result = ids(buildMergedTimeline(schedules, [checkout]));
    expect(result).toEqual(["c-hotel-a", "partial"]);
  });

  it("keeps anchored 'before' schedules before time-based flushed crossDays", () => {
    // crossDay が 2 件: 1 つは anchor 相手、もう 1 つは時刻 flush される
    const hotelA = "hotel-a";
    const hotelB = "hotel-b";
    const schedules = [
      makeAnchoredSchedule("anchored", "before", hotelA, { sortOrder: 0 }),
      makeSchedule({ id: "s1", startTime: "12:00", sortOrder: 1 }),
    ];
    const entries = [
      makeCrossDayEntry({ id: hotelA, endTime: "08:00" }),
      makeCrossDayEntry({ id: hotelB, endTime: "11:00" }),
    ];
    const result = ids(buildMergedTimeline(schedules, entries));
    expect(result).toEqual(["anchored", "c-hotel-a", "c-hotel-b", "s1"]);
  });
});
```

- [ ] **Step 2: Red 確認**

```bash
bun run --filter @sugara/web test -- merge-timeline
```
Expected: 6 テスト FAIL（anchor 対応未実装、anchor 付き schedule は通常 schedule として時刻 merge される）

---

## Task B3: merge-timeline 実装 - Green

**Files:**
- 変更: `apps/web/lib/merge-timeline.ts`

- [ ] **Step 1: `buildMergedTimeline` を anchor 対応に書き換え**

`apps/web/lib/merge-timeline.ts` を以下に置き換える:

```ts
import type { CrossDayEntry, ScheduleResponse } from "@sugara/shared";

export type TimelineItem =
  | { type: "schedule"; schedule: ScheduleResponse }
  | { type: "crossDay"; entry: CrossDayEntry };

/**
 * Build a merged timeline of schedules and cross-day entries.
 *
 * Schedules with a valid cross-day anchor (both `crossDayAnchor` and
 * `crossDayAnchorSourceId` set, and the source id matching one of the
 * crossDayEntries) are placed immediately before/after their target
 * crossDay and sorted by sortOrder within that slot. All other schedules
 * (including schedules with a broken/stale anchor) flow through the
 * time-based merge: time-having schedules flush pending crossDays whose
 * endTime is <= the schedule's startTime, and null-startTime schedules do
 * not flush. Remaining crossDays fall through to the end (entries with
 * endTime sorted by endTime, then null-endTime entries).
 */
export function buildMergedTimeline(
  schedules: ScheduleResponse[],
  crossDayEntries: CrossDayEntry[] | undefined,
): TimelineItem[] {
  if (!crossDayEntries || crossDayEntries.length === 0) {
    return schedules.map((schedule) => ({ type: "schedule", schedule }));
  }

  const validSourceIds = new Set(crossDayEntries.map((e) => e.schedule.id));

  const anchoredBefore: ScheduleResponse[] = [];
  const anchoredAfter: ScheduleResponse[] = [];
  const plainSchedules: ScheduleResponse[] = [];

  for (const schedule of schedules) {
    const anchor = schedule.crossDayAnchor;
    const sourceId = schedule.crossDayAnchorSourceId;
    if (anchor && sourceId && validSourceIds.has(sourceId)) {
      if (anchor === "before") anchoredBefore.push(schedule);
      else anchoredAfter.push(schedule);
    } else {
      plainSchedules.push(schedule);
    }
  }

  const sortBySortOrder = (a: ScheduleResponse, b: ScheduleResponse) =>
    a.sortOrder - b.sortOrder;
  anchoredBefore.sort(sortBySortOrder);
  anchoredAfter.sort(sortBySortOrder);

  const merged = timeBasedMerge(plainSchedules, crossDayEntries);

  for (const entry of crossDayEntries) {
    const sourceId = entry.schedule.id;
    const before = anchoredBefore.filter((s) => s.crossDayAnchorSourceId === sourceId);
    const after = anchoredAfter.filter((s) => s.crossDayAnchorSourceId === sourceId);

    if (before.length > 0) {
      const posBefore = merged.indexOf(findMergedCrossDay(merged, entry)!);
      if (posBefore !== -1) {
        merged.splice(
          posBefore,
          0,
          ...before.map((s): TimelineItem => ({ type: "schedule", schedule: s })),
        );
      }
    }
    if (after.length > 0) {
      const posAfter = merged.indexOf(findMergedCrossDay(merged, entry)!);
      if (posAfter !== -1) {
        merged.splice(
          posAfter + 1,
          0,
          ...after.map((s): TimelineItem => ({ type: "schedule", schedule: s })),
        );
      }
    }
  }

  return merged;
}

function findMergedCrossDay(merged: TimelineItem[], entry: CrossDayEntry): TimelineItem | null {
  for (const item of merged) {
    if (item.type === "crossDay" && item.entry === entry) return item;
  }
  return null;
}

function timeBasedMerge(
  schedules: ScheduleResponse[],
  crossDayEntries: CrossDayEntry[],
): TimelineItem[] {
  const merged: TimelineItem[] = [];
  const remaining = [...crossDayEntries];

  for (const schedule of schedules) {
    const scheduleTime = schedule.startTime?.slice(0, 5) ?? null;
    if (scheduleTime != null) {
      const toInsert: CrossDayEntry[] = [];
      for (let j = remaining.length - 1; j >= 0; j--) {
        const entryTime = remaining[j].schedule.endTime?.slice(0, 5) ?? null;
        if (entryTime == null) continue;
        if (entryTime <= scheduleTime) {
          toInsert.unshift(remaining[j]);
          remaining.splice(j, 1);
        }
      }
      toInsert.sort((a, b) => {
        const ta = a.schedule.endTime?.slice(0, 5) ?? "";
        const tb = b.schedule.endTime?.slice(0, 5) ?? "";
        return ta < tb ? -1 : ta > tb ? 1 : 0;
      });
      for (const entry of toInsert) merged.push({ type: "crossDay", entry });
    }
    merged.push({ type: "schedule", schedule });
  }

  const withEnd: CrossDayEntry[] = [];
  const withoutEnd: CrossDayEntry[] = [];
  for (const entry of remaining) {
    if (entry.schedule.endTime != null) withEnd.push(entry);
    else withoutEnd.push(entry);
  }
  withEnd.sort((a, b) => {
    const ta = a.schedule.endTime?.slice(0, 5) ?? "";
    const tb = b.schedule.endTime?.slice(0, 5) ?? "";
    return ta < tb ? -1 : ta > tb ? 1 : 0;
  });
  for (const entry of withEnd) merged.push({ type: "crossDay", entry });
  for (const entry of withoutEnd) merged.push({ type: "crossDay", entry });

  return merged;
}

export function timelineSortableIds(items: TimelineItem[]): string[] {
  return items.map((item) =>
    item.type === "crossDay" ? `cross-${item.entry.schedule.id}` : item.schedule.id,
  );
}

export function timelineScheduleOrder(items: TimelineItem[]): ScheduleResponse[] {
  const result: ScheduleResponse[] = [];
  for (const item of items) {
    if (item.type === "schedule") result.push(item.schedule);
  }
  return result;
}
```

- [ ] **Step 2: Green 確認**

```bash
bun run --filter @sugara/web test -- merge-timeline
```
Expected: 既存 24 + 新規 6 = 30 件 pass

- [ ] **Step 3: commit**

```bash
git add apps/web/lib/merge-timeline.ts apps/web/lib/__tests__/merge-timeline.test.ts
git commit -m "feat(web): buildMergedTimeline を cross-day anchor 対応に拡張"
```

---

## Task B4: drop-position が anchor 情報を返すよう拡張 - Red

**Files:**
- 変更: `apps/web/lib/__tests__/drop-position.test.ts`

- [ ] **Step 1: テスト末尾に anchor ケース追加**

`apps/web/lib/__tests__/drop-position.test.ts` の末尾、`describe("computeScheduleReorderIndex", ...)` の閉じ `});` の直後に:

```ts
describe("computeInsertIndex returns anchor info for crossDay drops", () => {
  const s1 = makeSchedule({ id: "s1", startTime: "09:00", sortOrder: 0 });
  const hotelCross = makeCrossDayEntry({ id: "hotel", endTime: "10:00" });

  it("returns anchor=before when dropping on crossDay upper half", () => {
    const target: DropTarget = {
      kind: "schedule",
      overId: "cross-hotel",
      upperHalf: true,
    };
    const result = computeCandidateDropResult([s1], [hotelCross], target);
    expect(result.insertIndex).toBe(0);
    expect(result.anchor).toEqual({ anchor: "before", anchorSourceId: "hotel" });
  });

  it("returns anchor=after when dropping on crossDay lower half", () => {
    const target: DropTarget = {
      kind: "schedule",
      overId: "cross-hotel",
      upperHalf: false,
    };
    const result = computeCandidateDropResult([s1], [hotelCross], target);
    expect(result.insertIndex).toBe(1);
    expect(result.anchor).toEqual({ anchor: "after", anchorSourceId: "hotel" });
  });

  it("returns anchor=null when dropping on a regular schedule", () => {
    const target: DropTarget = { kind: "schedule", overId: "s1", upperHalf: true };
    const result = computeCandidateDropResult([s1], [hotelCross], target);
    expect(result.anchor).toEqual({ anchor: null, anchorSourceId: null });
  });

  it("returns anchor=null when dropping outside/timeline", () => {
    expect(
      computeCandidateDropResult([s1], [hotelCross], { kind: "timeline" }).anchor,
    ).toEqual({ anchor: null, anchorSourceId: null });
    expect(
      computeCandidateDropResult([s1], [hotelCross], { kind: "outside" }).anchor,
    ).toEqual({ anchor: null, anchorSourceId: null });
  });
});
```

テスト冒頭の import に `computeCandidateDropResult` を追加:

```ts
import {
  computeCandidateDropResult,
  computeCandidateInsertIndex,
  computeScheduleReorderIndex,
  type DropTarget,
  isOverUpperHalf,
} from "../drop-position";
```

- [ ] **Step 2: Red 確認**

```bash
bun run --filter @sugara/web test -- drop-position
```
Expected: TypeError（関数未定義）or FAIL

---

## Task B5: drop-position に anchor 計算を追加 - Green

**Files:**
- 変更: `apps/web/lib/drop-position.ts`

- [ ] **Step 1: `computeCandidateDropResult` を追加**

`apps/web/lib/drop-position.ts` の末尾に以下を追加:

```ts
export type AnchorUpdate = {
  anchor: "before" | "after" | null;
  anchorSourceId: string | null;
};

export type CandidateDropResult = {
  insertIndex: number;
  anchor: AnchorUpdate;
};

/**
 * Like `computeCandidateInsertIndex`, but also returns the anchor update
 * that should be written to the newly inserted schedule. When the drop
 * target is a crossDay, the anchor is set to 'before' or 'after' with the
 * source schedule id extracted from the `cross-<id>` sortable id. For any
 * other drop (regular schedule, timeline zone, outside), the anchor is
 * cleared.
 */
export function computeCandidateDropResult(
  schedules: ScheduleResponse[],
  crossDayEntries: CrossDayEntry[] | undefined,
  target: DropTarget,
): CandidateDropResult {
  const insertIndex = computeCandidateInsertIndex(schedules, crossDayEntries, target);
  const anchor = extractAnchor(target);
  return { insertIndex, anchor };
}

/**
 * Same as `computeScheduleReorderIndex` but also returns the anchor update.
 * Returns null only when the target index computation returns null (active
 * not found or no-op).
 */
export function computeScheduleReorderResult(
  schedules: ScheduleResponse[],
  crossDayEntries: CrossDayEntry[] | undefined,
  activeId: string,
  target: DropTarget,
): { destIndex: number; anchor: AnchorUpdate } | null {
  const destIndex = computeScheduleReorderIndex(schedules, crossDayEntries, activeId, target);
  if (destIndex === null) return null;
  return { destIndex, anchor: extractAnchor(target) };
}

function extractAnchor(target: DropTarget): AnchorUpdate {
  if (target.kind !== "schedule") {
    return { anchor: null, anchorSourceId: null };
  }
  const m = /^cross-(.+)$/.exec(target.overId);
  if (!m) return { anchor: null, anchorSourceId: null };
  return {
    anchor: target.upperHalf ? "before" : "after",
    anchorSourceId: m[1],
  };
}
```

- [ ] **Step 2: Green 確認**

```bash
bun run --filter @sugara/web test -- drop-position
```
Expected: 既存 33 + 新規 4 = 37 件 pass

- [ ] **Step 3: commit**

```bash
git add apps/web/lib/drop-position.ts apps/web/lib/__tests__/drop-position.test.ts
git commit -m "feat(web): drop-position に computeCandidateDropResult/computeScheduleReorderResult を追加"
```

---

## Task B6: use-trip-drag-and-drop で anchor を送信

**Files:**
- 変更: `apps/web/lib/hooks/use-trip-drag-and-drop.ts`

- [ ] **Step 1: import を変更**

`apps/web/lib/hooks/use-trip-drag-and-drop.ts` の先頭 import を次に書き換え:

```ts
import {
  computeCandidateDropResult,
  computeScheduleReorderResult,
  type DropTarget,
  isOverUpperHalf,
} from "@/lib/drop-position";
```

- [ ] **Step 2: handleDragEnd の schedule → timeline 分岐を書き換え**

`schedule → timeline` 分岐（`if (sourceType === "schedule" && isOverTimeline)` 内）を以下に置き換える:

```ts
if (sourceType === "schedule" && isOverTimeline) {
  if (over && active.id === over.id) return;
  const activeId = String(active.id);
  const activeIdx = currentSchedules.findIndex((s) => s.id === activeId);
  if (activeIdx === -1) return;

  const target = buildDropTarget(event, savedLastOverZone);
  const result = computeScheduleReorderResult(currentSchedules, crossDayEntries, activeId, target);
  if (result === null) return;
  const { destIndex, anchor } = result;
  if (destIndex === activeIdx) return;

  const reordered = arrayMove(currentSchedules, activeIdx, destIndex);
  setLocalSchedules(reordered);

  const scheduleIds = reordered.map((s) => s.id);
  try {
    await api(
      `/api/trips/${tripId}/days/${currentDayId}/patterns/${currentPatternId}/schedules/reorder`,
      {
        method: "PATCH",
        body: JSON.stringify({
          scheduleIds,
          anchors: [{ scheduleId: activeId, anchor: anchor.anchor, anchorSourceId: anchor.anchorSourceId }],
        }),
      },
    );
    onDone();
  } catch (err) {
    if (err instanceof ApiError && (err.status === 400 || err.status === 404)) {
      toast.error(tm("conflictStale"));
    } else {
      toast.error(tm("scheduleReorderFailed"));
    }
    onDone();
  }
}
```

- [ ] **Step 3: handleDragEnd の candidate → timeline 分岐を書き換え**

`candidate → timeline` 分岐を:

```ts
} else if (sourceType === "candidate" && isOverTimeline) {
  const candidate = currentCandidates.find((c) => c.id === active.id);
  if (!candidate) return;

  setLocalCandidates(currentCandidates.filter((c) => c.id !== active.id));

  const target = buildDropTarget(event, savedLastOverZone);
  const { insertIndex, anchor } = computeCandidateDropResult(
    currentSchedules,
    crossDayEntries,
    target,
  );

  const newSchedule: ScheduleResponse = {
    id: candidate.id,
    name: candidate.name,
    category: candidate.category,
    address: candidate.address,
    startTime: candidate.startTime,
    endTime: candidate.endTime,
    sortOrder: insertIndex,
    memo: candidate.memo,
    urls: candidate.urls,
    departurePlace: candidate.departurePlace,
    arrivalPlace: candidate.arrivalPlace,
    transportMethod: candidate.transportMethod,
    color: candidate.color,
    endDayOffset: candidate.endDayOffset,
    latitude: candidate.latitude,
    longitude: candidate.longitude,
    placeId: candidate.placeId,
    crossDayAnchor: anchor.anchor,
    crossDayAnchorSourceId: anchor.anchorSourceId,
    updatedAt: candidate.updatedAt,
  };

  const insertedSchedules = [...currentSchedules];
  insertedSchedules.splice(insertIndex, 0, newSchedule);
  setLocalSchedules(insertedSchedules);
  toast.success(tm("candidateAssigned"));

  try {
    await api(`/api/trips/${tripId}/candidates/${active.id}/assign`, {
      method: "POST",
      body: JSON.stringify({ dayPatternId: currentPatternId }),
    });
  } catch (err) {
    if (err instanceof ApiError && (err.status === 400 || err.status === 404)) {
      toast.error(tm("conflictStale"));
    } else {
      toast.error(tm("candidateAssignFailed"));
    }
    onDone();
    return;
  }

  try {
    // assign 後に reorder + anchor で位置と anchor を書き込む
    const scheduleIds = [...currentSchedules.map((s) => s.id)];
    scheduleIds.splice(insertIndex, 0, String(active.id));
    await api(
      `/api/trips/${tripId}/days/${currentDayId}/patterns/${currentPatternId}/schedules/reorder`,
      {
        method: "PATCH",
        body: JSON.stringify({
          scheduleIds,
          anchors: [
            {
              scheduleId: String(active.id),
              anchor: anchor.anchor,
              anchorSourceId: anchor.anchorSourceId,
            },
          ],
        }),
      },
    );
  } catch {
    onDone();
    return;
  }
  onDone();
}
```

- [ ] **Step 4: reorderSchedule (キーボード) でも anchor null クリア**

同ファイル内の `reorderSchedule` 関数を次のように書き換え:

```ts
async function reorderSchedule(id: string, direction: "up" | "down") {
  if (!currentDayId || !currentPatternId) return;
  const current = localSchedules ?? schedules;
  const idx = current.findIndex((s) => s.id === id);
  if (idx === -1) return;
  const newIdx = direction === "up" ? idx - 1 : idx + 1;
  if (newIdx < 0 || newIdx >= current.length) return;

  const reordered = arrayMove(current, idx, newIdx);
  setLocalSchedules(reordered);

  try {
    await api(
      `/api/trips/${tripId}/days/${currentDayId}/patterns/${currentPatternId}/schedules/reorder`,
      {
        method: "PATCH",
        body: JSON.stringify({
          scheduleIds: reordered.map((s) => s.id),
          anchors: [{ scheduleId: id, anchor: null, anchorSourceId: null }],
        }),
      },
    );
    onDone();
  } catch (err) {
    if (err instanceof ApiError && (err.status === 400 || err.status === 404)) {
      toast.error(tm("conflictStale"));
    } else {
      toast.error(tm("scheduleReorderFailed"));
    }
    onDone();
  } finally {
    setLocalSchedules(null);
  }
}
```

- [ ] **Step 5: 既存テスト確認 + mock body assertion のチェック**

```bash
bun run --filter @sugara/web test -- use-trip-drag-and-drop
```
Expected: 全 pass。

既存テスト (`use-trip-drag-and-drop.test.ts`) を Read して、`api` mock の呼び出し検証で body の JSON 形を snapshot / deep equal で assert している箇所がないか確認:

```
Grep "api\(" apps/web/lib/hooks/use-trip-drag-and-drop.test.ts -n
```

現状は `vi.mock("@/lib/api", () => ({ api: vi.fn().mockResolvedValue(undefined), ... }))` で call の回数や 1st argument URL を expect している可能性はあるが、2nd argument body の厳密比較はしていない（スナップショットがあれば `toHaveBeenCalledWith` に body が含まれ anchors 追加で壊れる）。

壊れた場合の対応方針:
- 既存テストが `toHaveBeenCalledWith(url, { method, body: JSON.stringify({ scheduleIds: [...] }) })` のような厳密比較なら、期待値に `anchors: [{ scheduleId: ..., anchor: null, anchorSourceId: null }]` を追加して一緒に修正する。
- call の assert が曖昧（URL と method のみ）なら修正不要。

- [ ] **Step 6: merge-timeline / drop-position / 全 web テストを最終確認**

```bash
bun run --filter @sugara/web test
bun run --filter @sugara/web check-types
bun run --filter @sugara/web check
```
Expected: 全 pass / exit 0

- [ ] **Step 7: commit**

```bash
git add apps/web/lib/hooks/use-trip-drag-and-drop.ts apps/web/lib/hooks/use-trip-drag-and-drop.test.ts
git commit -m "feat(web): drag-end と reorderSchedule で anchor を送信"
```

---

## Task B7: PR B push + PR 作成

- [ ] **Step 1**

```bash
git push -u origin feat/cross-day-anchor-web
gh pr create --title "feat: cross-day anchor の merge ロジックと drag 配線 (Phase 4c+4d+4e)" --body "$(cat <<'EOF'
## Summary

- buildMergedTimeline を anchor 対応に拡張（有効 anchor を crossDay の前後に差し込み、無効 anchor は時刻 merge に fallback）
- drop-position に computeCandidateDropResult / computeScheduleReorderResult を追加（anchor 情報を返す）
- use-trip-drag-and-drop で drag-end と reorderSchedule から anchor を reorder API に送信
- merge-timeline 6 ケース、drop-position 4 ケース追加

## Why

spec: docs/plans/2026-04-20-cross-day-anchor-spec.md の Phase 4c/4d/4e。PR A (DB + API) をブロッカーとする。

## Test plan

- [ ] 鳩ノ巣渓谷シナリオ（時刻なし予定を crossDay の lower half にドロップ → crossDay の直後に配置）
- [ ] crossDay の upper half にドロップ → crossDay の直前に配置
- [ ] 通常 schedule に drop → anchor クリア
- [ ] キーボード上下移動でも anchor がクリアされる
- [ ] 別 pattern を見ている時に anchor 相手の crossDay が消えると時刻 merge に fallback

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

# PR C: 時刻順ボタン + 実機確認 (Phase 4f + 4g)

## Task C1: ブランチ作成

- [ ] **Step 1**

```bash
git checkout main && git pull --ff-only
git checkout -b feat/cross-day-anchor-sort-reset
```

## Task C2: 時刻順ボタンで clearAnchors を送る

**Files:**
- 変更: `apps/web/components/day-timeline.tsx`

- [ ] **Step 1: `handleSortByTime` 関数を書き換え**

`apps/web/components/day-timeline.tsx` の `handleSortByTime`（L170 付近）を次に置き換え:

```ts
async function handleSortByTime() {
  const sorted = [...schedules].sort(compareByStartTime);
  const scheduleIds = sorted.map((s) => s.id);
  try {
    await api(`/api/trips/${tripId}/days/${dayId}/patterns/${patternId}/schedules/reorder`, {
      method: "PATCH",
      body: JSON.stringify({ scheduleIds, clearAnchors: true }),
    });
    onRefresh();
  } catch {
    toast.error(tm("scheduleReorderFailed"));
  }
}
```

- [ ] **Step 2: isSorted 判定を anchor 存在時に常に「並び替え可能」とする**

同ファイル内 `const isSorted = ...` 付近（L164）を次に変更:

```ts
const hasAnyAnchor = schedules.some(
  (s) => s.crossDayAnchor != null && s.crossDayAnchorSourceId != null,
);
const isSorted =
  !hasAnyAnchor &&
  (schedules.length <= 1 ||
    schedules.every(
      (schedule, i) => i === 0 || compareByStartTime(schedules[i - 1], schedule) <= 0,
    ));
```

これで anchor を持つ schedule が 1 件でもあれば「時刻順」ボタンが常に active になる。

- [ ] **Step 3: 既存テストが通ることを確認**

```bash
bun run --filter @sugara/web test
bun run --filter @sugara/web check-types
```
Expected: 全 pass

- [ ] **Step 4: commit**

```bash
git add apps/web/components/day-timeline.tsx
git commit -m "feat(web): 時刻順ボタンで anchor 一括クリア、anchor ありなら常に有効化"
```

---

## Task C3: 実機確認

以下は手動確認手順。チェックボックス付きで記録する。

- [ ] **Step 1: dev 環境を起動**

```bash
bun run --filter @sugara/web dev
# 別ターミナル
# supabase が起動していることを確認: supabase status
```

- [ ] **Step 2: 奥多摩シナリオを DB で準備**

```bash
docker exec supabase_db_sugara psql -U postgres <<'SQL'
-- Kyoto trip の京都タワーホテルを使う（既存の検証データ）
UPDATE schedules SET end_day_offset=1, end_time='11:00' WHERE name='京都タワーホテル';

-- 候補「鳩ノ巣渓谷」を Day2 default pattern に assign（sortOrder=0 = 先頭）
-- trip_id / day2 default pattern id は `supabase status` の URL から studio で取得できる
SQL
```

- [ ] **Step 3: ブラウザで Kyoto trip → Day2 を開き、鳩ノ巣渓谷をチェックアウトの下半分にドラッグ&ドロップ**

期待:
- 鳩ノ巣渓谷が「京都タワーホテル チェックアウト ~11:00」の**直後**に表示される
- 画面再読み込みしても順序が維持される

- [ ] **Step 4: 鳩ノ巣渓谷に時刻 08:00 を設定**

期待:
- 時刻を追加しても鳩ノ巣渓谷はチェックアウトの直後のまま（Last write wins）

- [ ] **Step 5: 「時刻順」ボタンを押す**

期待:
- 鳩ノ巣渓谷が時刻順位置（08:00 なのでチェックアウト 11:00 より前）に移動する
- ボタンが押下後に disabled になる（`isSorted=true` かつ `hasAnyAnchor=false`）

- [ ] **Step 6: pattern を追加して切替**

Day1 に「雨」pattern を追加し、Day2 にも「雨」pattern を追加。Day2 雨 pattern を選択。

期待:
- 鳩ノ巣渓谷の anchor 相手（京都タワーホテル）は Day1 default pattern にいるため、Day2 雨 pattern からは見えない
- 鳩ノ巣渓谷は時刻 merge にフォールバックして表示される

- [ ] **Step 7: 検証データを元に戻す**

```bash
docker exec supabase_db_sugara psql -U postgres <<'SQL'
UPDATE schedules SET end_day_offset=NULL, end_time=NULL WHERE name='京都タワーホテル';
UPDATE schedules SET cross_day_anchor=NULL, cross_day_anchor_source_id=NULL WHERE name='鳩ノ巣渓谷';
UPDATE schedules SET day_pattern_id=NULL WHERE name='鳩ノ巣渓谷';  -- 候補へ戻す場合
-- pattern 追加分は削除
DELETE FROM day_patterns WHERE label='雨';
SQL
```

---

## Task C4: E2E テストで anchor シナリオを回帰防止

**Files:**
- 変更: `apps/web/e2e/` 配下（既存 Playwright 構成）

- [ ] **Step 1: 既存 E2E の構成と seed 利用方法を確認**

```
Glob apps/web/e2e/**/*.ts
```

`apps/web/e2e/` にある既存テストファイルと `playwright.config.ts` を Read で確認し、既存の login helper / fixture を流用する。

- [ ] **Step 2: anchor シナリオの E2E テストを追加**

`apps/web/e2e/cross-day-anchor.spec.ts`（新規）:

```ts
import { expect, test } from "@playwright/test";

// 前提: bun run db:seed で Kyoto trip と 鳩ノ巣渓谷 candidate が作られている
// 既存 helper (login など) があれば流用する

test.describe("cross-day anchor", () => {
  test.beforeEach(async ({ page }) => {
    // 既存の login helper を呼び出す
    await loginAsDev(page);
  });

  test("candidate を crossDay の直後に drop すると anchor が保持される", async ({ page }) => {
    // Kyoto trip を開き、Day1 の京都タワーホテルに endDayOffset=1 を設定
    await page.goto("/trips/<seeded-trip-id>");
    // ... ホテルを編集して endDayOffset=1 を設定
    // Day2 に切替
    await page.click('role=tab[name="2日目"]');
    // 候補「鳩ノ巣渓谷」の handle を取得
    const candidate = page.locator('[data-testid="candidate-鳩ノ巣渓谷"]');
    // crossDay card の lower half を取得
    const crossDay = page.locator('[data-testid^="cross-"]').first();
    const crossDayBox = await crossDay.boundingBox();
    if (!crossDayBox) throw new Error("crossDay card not found");
    // candidate を crossDay の下半分にドラッグ
    await candidate.dragTo(crossDay, {
      targetPosition: { x: crossDayBox.width / 2, y: crossDayBox.height * 0.75 },
    });
    // 期待: 鳩ノ巣渓谷が crossDay の直後に表示される
    const items = page.locator('[data-testid^="timeline-item-"]');
    const texts = await items.allTextContents();
    const crossIdx = texts.findIndex((t) => t.includes("京都タワーホテル"));
    const hatonosuIdx = texts.findIndex((t) => t.includes("鳩ノ巣渓谷"));
    expect(hatonosuIdx).toBe(crossIdx + 1);

    // リロード後も順序が保持される
    await page.reload();
    const textsAfter = await page.locator('[data-testid^="timeline-item-"]').allTextContents();
    const crossIdxAfter = textsAfter.findIndex((t) => t.includes("京都タワーホテル"));
    const hatonosuIdxAfter = textsAfter.findIndex((t) => t.includes("鳩ノ巣渓谷"));
    expect(hatonosuIdxAfter).toBe(crossIdxAfter + 1);
  });

  test("時刻順ボタンで anchor がクリアされ時刻順に並ぶ", async ({ page }) => {
    // 前提: 上のテストが anchor を残した状態から再開（または setup で作成）
    await page.goto("/trips/<seeded-trip-id>");
    await page.click('role=tab[name="2日目"]');
    // 鳩ノ巣渓谷に時刻を設定
    await page.click('[data-testid="schedule-item-鳩ノ巣渓谷"] [data-testid="edit-button"]');
    await page.fill('input[name="startTime"]', "06:00");
    await page.click('button[type="submit"]');
    // 時刻順ボタンを押す
    await page.click('button:has-text("時刻順")');
    // 鳩ノ巣渓谷が crossDay より前（06:00 < 11:00）に移動
    const textsAfter = await page.locator('[data-testid^="timeline-item-"]').allTextContents();
    const crossIdx = textsAfter.findIndex((t) => t.includes("京都タワーホテル"));
    const hatonosuIdx = textsAfter.findIndex((t) => t.includes("鳩ノ巣渓谷"));
    expect(hatonosuIdx).toBeLessThan(crossIdx);
  });
});

async function loginAsDev(page: import("@playwright/test").Page) {
  await page.goto("/auth/login");
  await page.fill('input[name="username"]', "dev");
  await page.fill('input[name="password"]', "Password1");
  await page.click('button:has-text("ログイン")');
  await page.waitForURL(/\/home|\/trips/);
}
```

**実装時の注意:**
- 既存 E2E のセレクタ規約（`data-testid` など）を確認して合わせる
- 上記 `[data-testid^="timeline-item-"]` / `[data-testid^="cross-"]` などは現状のコードに存在しない可能性が高い。必要なら実装コードに `data-testid` を追加する（PR B にリファクタとして含めるのが自然）
- seed ID をハードコードすると壊れやすい。`apps/api/src/db/seed.ts` から trip name で検索するヘルパーを追加する、または E2E 専用の trip を test 内で API で作成するのが安全

- [ ] **Step 3: E2E 実行**

```bash
bun run --filter @sugara/web test:e2e -- cross-day-anchor
```
Expected: 2 テスト pass

- [ ] **Step 4: commit**

```bash
git add apps/web/e2e/cross-day-anchor.spec.ts
# data-testid を追加した場合は関連ファイルも
git commit -m "test(web): cross-day anchor の E2E テストを追加"
```

---

## Task C5: News / FAQ 検討

- [ ] **Step 1: `apps/web/content/news/ja/` に新記事を追加**

日付は merge 日に合わせて `2026-MM-DD-cross-day-anchor.md` を作成:

```md
---
title: 日をまたぐ予定の前後に手動で予定を並べられるようになりました
date: 2026-MM-DD
---

ホテルのチェックアウトなど日をまたぐ予定（前日から続く予定）の前後に、予定をドラッグで手動配置できるようになりました。

- チェックアウトの上半分にドロップ → チェックアウトの前
- チェックアウトの下半分にドロップ → チェックアウトの後
- 一度配置した位置は、予定の時刻を後から変更しても保持されます
- 時刻順ボタンを押すと手動配置を解除して時刻通りに並び替えできます
```

英語版を `apps/web/content/news/en/` にも同じファイル名で作成。

- [ ] **Step 2: `apps/api/src/db/seed-faqs.ts` 確認**

新しい挙動に関する FAQ が必要なら ja/en 両方に追加。「日をまたぐ予定の並び順を変えたいときは？」「時刻順ボタンはどうなる？」などのエントリを検討する。

- [ ] **Step 3: commit**

```bash
git add apps/web/content/news/ apps/api/src/db/seed-faqs.ts
git commit -m "docs: cross-day anchor 機能のお知らせと FAQ を追加"
```

---

## Task C6: PR C push + PR 作成

- [ ] **Step 1**

```bash
git push -u origin feat/cross-day-anchor-sort-reset
gh pr create --title "feat: 時刻順ボタンで anchor クリア + 実機確認 + お知らせ (Phase 4f+4g)" --body "$(cat <<'EOF'
## Summary

- handleSortByTime が reorder に clearAnchors=true を送るように
- isSorted 判定に anchor 存在フラグを組み込み、anchor があれば時刻順ボタンを常に有効化
- お知らせ記事と FAQ を追加

## Why

spec: docs/plans/2026-04-20-cross-day-anchor-spec.md の Phase 4f/4g。PR A, PR B の後に merge すること。

## Test plan

- [ ] 鳩ノ巣渓谷を crossDay 直後に drop → 反映 → 時刻編集 → 位置維持
- [ ] 時刻順ボタンで anchor 一括クリア + 時刻順並び替え
- [ ] 別 pattern 切替で anchor が fallback
- [ ] お知らせが /news ページに表示される

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 2: spec/plan/prev-plan を削除**

Phase 4 の 3 PR が全てマージされたら、不要になった plan ドキュメントを削除する commit を作る:

```bash
git checkout main && git pull --ff-only
git checkout -b chore/cleanup-cross-day-plans
git rm docs/plans/2026-04-20-cross-day-anchor-spec.md docs/plans/2026-04-20-cross-day-anchor-plan.md docs/plans/2026-04-20-cross-day-followups.md
git commit -m "chore: cross-day anchor 関連の計画ドキュメントを削除（実装完了）"
git push -u origin chore/cleanup-cross-day-plans
gh pr create --title "chore: cross-day anchor 関連の計画ドキュメントを削除" --body "Phase 1〜4 の実装が完了したため計画ドキュメントを削除する。履歴は git log に残る。"
```

---

## Self-Review

### 1. Spec coverage

spec の要素 → タスク対応:

| spec 要素 | 対応タスク |
|---|---|
| データモデル 2 カラム + check | Task A1 |
| BEFORE UPDATE トリガー | Task A1 Step 4 |
| anchor_source_id FK with ON DELETE SET NULL | Task A1 Step 3 |
| reorderSchedulesSchema 拡張 | Task A2 Step 3 |
| ScheduleResponse 2 フィールド | Task A2 Step 1 |
| createScheduleSchema に anchor 追加 | Task A2 Step 2 |
| reorder API validate 5 項目 | Task A4 Step 1 |
| clearAnchors 処理 | Task A4 Step 1 |
| update API の anchor validate | Task A5 Step 3 |
| endDayOffset cascade クリア | Task A5 Step 4 |
| merge アルゴリズム | Task B3 Step 1 |
| drop-position anchor 情報 | Task B5 Step 1 |
| drag-end anchor 送信 | Task B6 Step 2, 3 |
| reorderSchedule (キーボード) anchor クリア | Task B6 Step 4 |
| 時刻順ボタン clearAnchors | Task C2 Step 1 |
| isSorted 判定 anchor 対応 | Task C2 Step 2 |
| 実機確認 | Task C3 |
| お知らせ / FAQ | Task C4 |

全項目カバー済み。

### 2. Placeholder scan

- "TBD" / "TODO" 検索: 無し
- "similar to" 検索: 無し（重複コードは意図的に書き下し済み）
- "add appropriate X" 系: 無し

### 3. Type consistency

- `ScheduleResponse.crossDayAnchor` / `crossDayAnchorSourceId` は Task A2 Step 1 で定義、Task B3/B6 で使用、一致
- `reorderSchedulesSchema.anchors[].scheduleId / anchor / anchorSourceId` は Task A2 Step 3 で定義、Task A4 Step 1 と B6 Step 2/3/4 で使用、一致
- `computeCandidateDropResult` / `computeScheduleReorderResult` は Task B5 Step 1 で定義、Task B6 で使用、一致
- `validateAnchors` は Task A5 Step 3 で新規ファイル `apps/api/src/lib/anchor-validate.ts` に定義、Task A5 Step 5 で reorder からも呼ぶ、一致
