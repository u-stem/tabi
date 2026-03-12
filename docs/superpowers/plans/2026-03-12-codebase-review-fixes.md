# Codebase Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** セキュリティ、コード品質、UX の 22 件の指摘事項を修正する

**Architecture:** API 側 (Hono) とフロントエンド側 (Next.js) の両方を修正。DB スキーマ変更 (FK 制約、複合インデックス) は migration で対応。メッセージ定数は `packages/shared/src/messages.ts` に追加。

**Tech Stack:** TypeScript, Hono, Next.js 15, Drizzle ORM, Supabase Realtime, React Query, Zod

---

## Chunk 1: Security Fixes (S1-S5)

### Task 1: S1 - Realtime チャネルの認証不備のドキュメント化

Supabase Realtime の Authorization はインフラ側 (Dashboard) の設定が必要。コード側では tripId が UUIDv4 (122-bit entropy) で推測困難であることを明文化し、根本対策のための TODO を残す。

**Files:**
- Modify: `apps/web/lib/hooks/use-trip-sync.ts:50`

- [ ] **Step 1: セキュリティコメントを追加**

```typescript
// 変更前 (50行目):
      const channel = supabase.channel(`trip:${tripId}`);

// 変更後:
      // SECURITY: Supabase Realtime channels are accessible to anyone with the anon key.
      // tripId is a UUIDv4 (122-bit entropy), making brute-force impractical.
      // TODO: Enable Realtime Authorization in Supabase Dashboard
      // to verify JWT claims against trip membership.
      const channel = supabase.channel(`trip:${tripId}`);
```

- [ ] **Step 2: ビルド確認**

Run: `bun run --filter @sugara/web build`
Expected: 成功

- [ ] **Step 3: コミット**

```bash
git add apps/web/lib/hooks/use-trip-sync.ts
git commit -m "docs: Realtime チャネルのセキュリティリスクをコメントで明文化"
```

---

### Task 2: S2 - レート制限のインメモリ制約をコメントで明文化

既にコメントで「best-effort」と認識されているが、Better Auth 側の `rateLimit.storage` にも同じ注釈を追加し、将来の外部ストア移行を TODO 化する。

**Files:**
- Modify: `apps/api/src/lib/auth.ts:33-37`

- [ ] **Step 1: Better Auth のレート制限に TODO コメント追加**

```typescript
// 変更前 (33-37行目):
  rateLimit: {
    enabled: isProduction,
    window: 60,
    max: 30,
    storage: "memory",

// 変更後:
  rateLimit: {
    enabled: isProduction,
    window: 60,
    max: 30,
    // TODO: Switch to external store (e.g. Upstash Redis) for Vercel serverless.
    // In-memory storage is per-instance and not shared across function invocations.
    storage: "memory",
```

- [ ] **Step 2: rate-limit.ts にも TODO を追加**

```typescript
// 変更前 (6-9行目):
// In-memory store. In Vercel's serverless environment each function instance
// has its own memory, so this store is not shared across instances.
// The rate limit is therefore best-effort and not a hard guarantee.
// Shared store cache keyed by "window:max" to prevent duplicate setIntervals

// 変更後:
// In-memory store. In Vercel's serverless environment each function instance
// has its own memory, so this store is not shared across instances.
// The rate limit is therefore best-effort and not a hard guarantee.
// TODO: Switch to external store (e.g. Upstash Redis) for reliable rate limiting.
// Shared store cache keyed by "window:max" to prevent duplicate setIntervals
```

- [ ] **Step 3: ビルド確認**

Run: `bun run --filter @sugara/api build`

- [ ] **Step 4: コミット**

```bash
git add apps/api/src/lib/auth.ts apps/api/src/middleware/rate-limit.ts
git commit -m "docs: レート制限の外部ストア移行を TODO 化"
```

---

### Task 3: S3 - 匿名投票の x-anonymous-id 偽装対策

匿名投票で `x-anonymous-id` ヘッダーに加えて IP アドレスを組み合わせて識別する。同一 IP + 同一 anonymousId でないと既存投票の上書き/削除ができないようにする。

**Files:**
- Modify: `apps/api/src/routes/quick-poll-share.ts:65-121, 124-159`

- [ ] **Step 1: テストファイルの確認**

Run: `ls apps/api/src/__tests__/quick-poll-share*` で既存テストを確認。なければ追加対象。

- [ ] **Step 2: 投票時の IP 記録を追加**

POST `/api/quick-polls/s/:shareToken/vote` で、匿名投票の場合に IP をハッシュして `anonymousId` と組み合わせる。

ただし、DB スキーマに `ipHash` カラムを追加する必要があり、migration が必要になる。

**より簡易な対策:** 匿名投票の場合、`anonymousId` がリクエストの `x-anonymous-id` ヘッダーから来ることを Zod スキーマ側で検証済みだが、クライアントが localStorage に保存した UUID を使う仕組み。偽装は可能だがコストが上がる。

**現実的な対策:** コメントで制約を明文化し、匿名投票の限界として記録する。

```typescript
// 変更前 (94-95行目):
  const voterId = user?.id ?? null;
  const voterAnonymousId = !voterId ? anonymousId : undefined;

// 変更後:
  const voterId = user?.id ?? null;
  // NOTE: anonymousId is client-generated (localStorage UUID). A determined user
  // can forge different IDs to vote multiple times. Acceptable trade-off for
  // a lightweight poll feature; use authenticated voting for important decisions.
  const voterAnonymousId = !voterId ? anonymousId : undefined;
```

- [ ] **Step 3: コミット**

```bash
git add apps/api/src/routes/quick-poll-share.ts
git commit -m "docs: 匿名投票の x-anonymous-id の制約をコメントで明文化"
```

---

### Task 4: S4 - フィードバックの Markdown サニタイズ強化

`javascript:` だけでなく `data:` や `vbscript:` などの危険なプロトコルもブロックする。

**Files:**
- Modify: `apps/api/src/routes/feedback.ts:28`

- [ ] **Step 1: サニタイズの正規表現を強化**

```typescript
// 変更前 (28行目):
  const sanitized = body.replace(/@/g, "@ ").replace(/\[([^\]]*)\]\(javascript:/gi, "[$1](");

// 変更後:
  const sanitized = body
    .replace(/@/g, "@ ")
    .replace(/\[([^\]]*)\]\((javascript|data|vbscript):/gi, "[$1](");
```

- [ ] **Step 2: ビルド確認**

Run: `bun run --filter @sugara/api build`

- [ ] **Step 3: コミット**

```bash
git add apps/api/src/routes/feedback.ts
git commit -m "fix: フィードバックのサニタイズで data:/vbscript: もブロック"
```

---

### Task 5: S5 - CSP の unsafe-inline に関する TODO 追加

`unsafe-inline` を nonce ベースに移行するのは Next.js の設定変更が必要で大掛かり。TODO で記録する。

**Files:**
- Modify: `apps/web/next.config.ts:7`

- [ ] **Step 1: コメント追加**

```typescript
// 変更前 (6-7行目):
  // Next.js requires 'unsafe-inline' for hydration scripts
  "script-src 'self' 'unsafe-inline' https://maps.googleapis.com",

// 変更後:
  // Next.js requires 'unsafe-inline' for hydration scripts.
  // TODO: Migrate to nonce-based CSP with 'strict-dynamic' for stronger XSS protection.
  "script-src 'self' 'unsafe-inline' https://maps.googleapis.com",
```

- [ ] **Step 2: コミット**

```bash
git add apps/web/next.config.ts
git commit -m "docs: CSP の nonce ベース移行を TODO 化"
```

---

## Chunk 2: Quality / Bug Fixes (Q1-Q8)

### Task 6: Q1 - confirmedOptionId に FK 制約を追加

Drizzle スキーマでは循環参照を避けるため FK を省略しているが、migration で直接 FK を追加する。

**Files:**
- Modify: `apps/api/src/db/schema.ts:416-418` (コメント更新)
- Create: migration ファイル (drizzle generate で自動生成)

- [ ] **Step 1: スキーマのコメントを更新**

```typescript
// 変更前 (416-418行目):
  // FK to schedulePollOptions.id omitted to avoid circular type inference
  // between schedulePolls and schedulePollOptions. Enforced at application layer.
  confirmedOptionId: uuid("confirmed_option_id"),

// 変更後:
  // FK to schedulePollOptions.id is defined via raw SQL in migration
  // to avoid circular type inference in Drizzle's TypeScript layer.
  confirmedOptionId: uuid("confirmed_option_id"),
```

- [ ] **Step 2: カスタム migration ファイルを作成**

Run: `bun run db:generate` で空の migration を作成するか、手動で作成。

migration SQL:
```sql
ALTER TABLE "schedule_polls"
  ADD CONSTRAINT "schedule_polls_confirmed_option_id_fk"
  FOREIGN KEY ("confirmed_option_id")
  REFERENCES "schedule_poll_options"("id")
  ON DELETE SET NULL;
```

- [ ] **Step 3: ローカル DB に適用**

Run: `bun run db:migrate`

- [ ] **Step 4: テスト実行**

Run: `bun run --filter @sugara/api test`

- [ ] **Step 5: コミット**

```bash
git add apps/api/src/db/schema.ts apps/api/drizzle/
git commit -m "fix: confirmedOptionId に FK 制約を追加"
```

---

### Task 7: Q2 - pruneOldNotifications のエラーハンドリング修正

`void pruneOldNotifications(userId)` を `.catch` 付きに変更する。

**Files:**
- Modify: `apps/api/src/lib/notifications.ts:129`

- [ ] **Step 1: catch を追加**

```typescript
// 変更前 (129行目):
    void pruneOldNotifications(userId);

// 変更後:
    pruneOldNotifications(userId).catch((err) => {
      console.error("[pruneOldNotifications]", err);
    });
```

- [ ] **Step 2: sendPushToUser にも同様に修正**

```typescript
// 変更前 (132行目):
  void sendPushToUser(userId, type, payload, tripId);

// 変更後:
  sendPushToUser(userId, type, payload, tripId).catch((err) => {
    console.error("[sendPushToUser]", err);
  });
```

- [ ] **Step 3: テスト実行**

Run: `bun run --filter @sugara/api test`

- [ ] **Step 4: コミット**

```bash
git add apps/api/src/lib/notifications.ts
git commit -m "fix: fire-and-forget の Promise に catch を追加"
```

---

### Task 8: Q3 - notifications テーブルに複合インデックス追加

`(userId, createdAt)` の複合インデックスを追加し、`pruneOldNotifications` のクエリパフォーマンスを改善する。

**Files:**
- Modify: `apps/api/src/db/schema.ts:746-749`

- [ ] **Step 1: 既存の個別インデックスを複合インデックスに置き換え**

```typescript
// 変更前 (746-749行目):
  (table) => [
    index("notifications_user_id_idx").on(table.userId),
    index("notifications_created_at_idx").on(table.createdAt),
  ],

// 変更後:
  (table) => [
    index("notifications_user_id_created_at_idx").on(table.userId, table.createdAt),
  ],
```

注意: `userId` 単体のクエリも複合インデックスの先頭カラムで対応可能。`createdAt` 単体のクエリが他に無いことを確認済み。

- [ ] **Step 2: migration 生成**

Run: `bun run db:generate`

- [ ] **Step 3: ローカル DB に適用**

Run: `bun run db:migrate`

- [ ] **Step 4: テスト実行**

Run: `bun run --filter @sugara/api test`

- [ ] **Step 5: コミット**

```bash
git add apps/api/src/db/schema.ts apps/api/drizzle/
git commit -m "fix: notifications に (userId, createdAt) 複合インデックスを追加"
```

---

### Task 9: Q4 - candidates.ts の N+1 更新クエリを一括更新に修正

ループ内個別 UPDATE を `CASE WHEN` による一括 UPDATE に置き換える。

**Files:**
- Modify: `apps/api/src/routes/candidates.ts:120-137`

- [ ] **Step 1: 一括更新に書き換え**

```typescript
// 変更前 (120-137行目):
  await db.transaction(async (tx) => {
    let nextOrder = await getNextSortOrder(
      tx,
      schedules.sortOrder,
      schedules,
      eq(schedules.dayPatternId, parsed.data.dayPatternId),
    );

    for (const scheduleId of parsed.data.scheduleIds) {
      await tx
        .update(schedules)
        .set({
          dayPatternId: parsed.data.dayPatternId,
          sortOrder: nextOrder++,
          updatedAt: new Date(),
        })
        .where(eq(schedules.id, scheduleId));
    }
  });

// 変更後:
  await db.transaction(async (tx) => {
    const baseOrder = await getNextSortOrder(
      tx,
      schedules.sortOrder,
      schedules,
      eq(schedules.dayPatternId, parsed.data.dayPatternId),
    );

    const ids = parsed.data.scheduleIds;
    const now = new Date();
    await tx
      .update(schedules)
      .set({
        dayPatternId: parsed.data.dayPatternId,
        sortOrder: sql`${baseOrder} + array_position(${sql.raw(`ARRAY[${ids.map((id) => `'${id}'::uuid`).join(",")}]`)}, ${schedules.id}) - 1`,
        updatedAt: now,
      })
      .where(inArray(schedules.id, ids));
  });
```

注意: `array_position` は PostgreSQL 固有。Drizzle の `sql` テンプレートでパラメータバインディングを使いつつ配列を渡す必要があるため、実装時にテストで動作確認が必須。

**代替案 (よりシンプル):** `CASE WHEN` パターン:

```typescript
  await db.transaction(async (tx) => {
    const baseOrder = await getNextSortOrder(
      tx,
      schedules.sortOrder,
      schedules,
      eq(schedules.dayPatternId, parsed.data.dayPatternId),
    );

    const ids = parsed.data.scheduleIds;
    const now = new Date();
    const cases = ids.map((id, i) => sql`when ${schedules.id} = ${id} then ${baseOrder + i}`);
    await tx
      .update(schedules)
      .set({
        dayPatternId: parsed.data.dayPatternId,
        sortOrder: sql`case ${sql.join(cases, sql` `)} end`,
        updatedAt: now,
      })
      .where(inArray(schedules.id, ids));
  });
```

- [ ] **Step 2: import に `inArray` と `sql` を追加**

既存 import に `inArray` と `sql` を追加する。

- [ ] **Step 3: テスト実行**

Run: `bun run --filter @sugara/api test`

- [ ] **Step 4: コミット**

```bash
git add apps/api/src/routes/candidates.ts
git commit -m "fix: 候補一括割り当ての N+1 更新を CASE WHEN で一括化"
```

---

### Task 10: Q5 - trips.ts で 404 チェックを先に行う

旅行詳細取得で `tripWithPoll` の null チェックを先に行い、不要なクエリを防ぐ。

**Files:**
- Modify: `apps/api/src/routes/trips.ts:285-322`

- [ ] **Step 1: null チェックを移動**

```typescript
// 変更前 (286-322行目):
  const tripWithPoll = await db.query.trips.findFirst({ ... });
  const candidates = await queryCandidatesWithReactions(tripId, user.id);
  const [{ count: memberCount }] = await db
    .select({ count: count() })
    .from(tripMembers)
    .where(eq(tripMembers.tripId, tripId));
  const detailSettings = await getAppSettings();

  if (!tripWithPoll) {
    return c.json({ error: ERROR_MSG.TRIP_NOT_FOUND }, 404);
  }

// 変更後:
  const tripWithPoll = await db.query.trips.findFirst({ ... });

  if (!tripWithPoll) {
    return c.json({ error: ERROR_MSG.TRIP_NOT_FOUND }, 404);
  }

  const candidates = await queryCandidatesWithReactions(tripId, user.id);
  const [{ count: memberCount }] = await db
    .select({ count: count() })
    .from(tripMembers)
    .where(eq(tripMembers.tripId, tripId));
  const detailSettings = await getAppSettings();
```

- [ ] **Step 2: テスト実行**

Run: `bun run --filter @sugara/api test`

- [ ] **Step 3: コミット**

```bash
git add apps/api/src/routes/trips.ts
git commit -m "fix: 旅行詳細取得で 404 チェックを先に実行して無駄なクエリを防止"
```

---

### Task 11: Q6 - faq-search.tsx の unsafe キャストを修正

`as unknown as SearchableFaq[]` を `SearchResult & SearchableFaq` 型に修正する。

**Files:**
- Modify: `apps/web/app/faq/_components/faq-search.tsx:16-18`

- [ ] **Step 1: 型を修正**

```typescript
// 変更前 (1行目, 16-18行目):
import { useMemo, useState } from "react";
...
  const results = useMemo<SearchableFaq[]>(() => {
    if (!query.trim()) return faqs;
    return index.search(query) as unknown as SearchableFaq[];
  }, [index, faqs, query]);

// 変更後:
import type { SearchResult } from "minisearch";
import { useMemo, useState } from "react";
...
  const results = useMemo<SearchableFaq[]>(() => {
    if (!query.trim()) return faqs;
    return index.search(query) as Array<SearchResult & SearchableFaq>;
  }, [index, faqs, query]);
```

注意: MiniSearch の `storeFields` で `id`, `question`, `answer`, `sortOrder` を保持しているため、SearchResult にこれらのフィールドが含まれる。`SearchResult & SearchableFaq` は `SearchableFaq` のスーパーセットなので `SearchableFaq[]` への代入が可能。

- [ ] **Step 2: 型チェック**

Run: `bun run check-types`

- [ ] **Step 3: コミット**

```bash
git add apps/web/app/faq/_components/faq-search.tsx
git commit -m "fix: faq-search の unsafe キャストを型安全に修正"
```

---

### Task 12: Q7 - activity-logger.ts の prune 改善

N+1 パターンを `DELETE ... WHERE id NOT IN (SELECT id ... LIMIT N)` の単一クエリに置き換える。

**Files:**
- Modify: `apps/api/src/lib/activity-logger.ts:46-59`

- [ ] **Step 1: prune を単一クエリに書き換え**

```typescript
// 変更前 (46-59行目):
  // Keep only the latest MAX_LOGS_PER_TRIP entries per trip
  const keepIds = await db
    .select({ id: activityLogs.id })
    .from(activityLogs)
    .where(eq(activityLogs.tripId, params.tripId))
    .orderBy(desc(activityLogs.createdAt))
    .limit(MAX_LOGS_PER_TRIP);

  const keepIdList = keepIds.map((r) => r.id);
  if (keepIdList.length >= MAX_LOGS_PER_TRIP) {
    await db
      .delete(activityLogs)
      .where(and(eq(activityLogs.tripId, params.tripId), notInArray(activityLogs.id, keepIdList)));
  }

// 変更後:
  // Keep only the latest MAX_LOGS_PER_TRIP entries per trip.
  // Uses a subquery to avoid N+1: single DELETE instead of SELECT + DELETE.
  const keepSubquery = db
    .select({ id: activityLogs.id })
    .from(activityLogs)
    .where(eq(activityLogs.tripId, params.tripId))
    .orderBy(desc(activityLogs.createdAt))
    .limit(MAX_LOGS_PER_TRIP);

  await db
    .delete(activityLogs)
    .where(
      and(
        eq(activityLogs.tripId, params.tripId),
        notInArray(activityLogs.id, keepSubquery),
      ),
    );
```

注意: 既存コードでも 2 クエリだが、`keepIdList.length >= MAX_LOGS_PER_TRIP` の条件チェックで不要な DELETE を回避していた。サブクエリ版では常に DELETE が走るが、`NOT IN (SELECT ... LIMIT N)` で該当行が 0 件なら実質 no-op。INSERT 直後なので最低 1 行はあるため `keepIdList.length >= MAX_LOGS_PER_TRIP` の条件に相当する「まだ上限に達していない」ケースでは空の DELETE になるのみ。

- [ ] **Step 2: テスト実行**

Run: `bun run --filter @sugara/api test`

- [ ] **Step 3: コミット**

```bash
git add apps/api/src/lib/activity-logger.ts
git commit -m "refactor: activity-logger の prune をサブクエリで単一 DELETE に改善"
```

---

### Task 13: Q8 - getAdminUserId のキャッシュ化

毎リクエストの DB クエリを避けるため、結果をメモリキャッシュする。

**Files:**
- Modify: `apps/api/src/lib/resolve-is-admin.ts:32-42`

- [ ] **Step 1: キャッシュを追加**

```typescript
// 変更前 (29-42行目):
/**
 * Get the admin user's ID (or null if ADMIN_USERNAME is unset / not found).
 */
export async function getAdminUserId(): Promise<string | null> {
  const adminUsername = process.env.ADMIN_USERNAME;
  if (!adminUsername) return null;

  const row = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, adminUsername))
    .limit(1);
  return row[0]?.id ?? null;
}

// 変更後:
/**
 * Get the admin user's ID (or null if ADMIN_USERNAME is unset / not found).
 * Cached for 5 minutes to avoid per-request DB queries.
 */
let adminUserIdCache: { value: string | null; expiresAt: number } | null = null;
const ADMIN_CACHE_TTL_MS = 5 * 60 * 1000;

export async function getAdminUserId(): Promise<string | null> {
  const adminUsername = process.env.ADMIN_USERNAME;
  if (!adminUsername) return null;

  if (adminUserIdCache && adminUserIdCache.expiresAt > Date.now()) {
    return adminUserIdCache.value;
  }

  const row = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, adminUsername))
    .limit(1);
  const value = row[0]?.id ?? null;
  adminUserIdCache = { value, expiresAt: Date.now() + ADMIN_CACHE_TTL_MS };
  return value;
}
```

- [ ] **Step 2: テスト実行**

Run: `bun run --filter @sugara/api test`

- [ ] **Step 3: コミット**

```bash
git add apps/api/src/lib/resolve-is-admin.ts
git commit -m "fix: getAdminUserId に 5 分キャッシュを追加"
```

---

## Chunk 3: UX Fixes (U1-U11)

### Task 14: U1 - PollTab の日程確定ボタンにローディング追加

確定ボタンと削除ボタンに `disabled={isPending}` を追加する。

**Files:**
- Modify: `apps/web/app/(authenticated)/trips/[id]/_components/poll-tab.tsx:671-678, 708-716`

- [ ] **Step 1: 確定ダイアログのボタンを修正**

```tsx
// 変更前 (671-678行目):
            <ResponsiveAlertDialogAction
              onClick={() => {
                if (confirmOptionId) confirmMutation.mutate(confirmOptionId);
                setConfirmOptionId(null);
              }}
            >
              確定する
            </ResponsiveAlertDialogAction>

// 変更後:
            <ResponsiveAlertDialogAction
              disabled={confirmMutation.isPending}
              onClick={() => {
                if (confirmOptionId) confirmMutation.mutate(confirmOptionId);
                setConfirmOptionId(null);
              }}
            >
              {confirmMutation.isPending ? "確定中..." : "確定する"}
            </ResponsiveAlertDialogAction>
```

- [ ] **Step 2: 削除ダイアログのボタンを修正**

```tsx
// 変更前 (708-716行目):
            <ResponsiveAlertDialogDestructiveAction
              onClick={() => {
                if (deleteOptionId) deleteOptionMutation.mutate(deleteOptionId);
                setDeleteOptionId(null);
              }}
            >
              <Trash2 className="h-4 w-4" />
              削除する
            </ResponsiveAlertDialogDestructiveAction>

// 変更後:
            <ResponsiveAlertDialogDestructiveAction
              disabled={deleteOptionMutation.isPending}
              onClick={() => {
                if (deleteOptionId) deleteOptionMutation.mutate(deleteOptionId);
                setDeleteOptionId(null);
              }}
            >
              <Trash2 className="h-4 w-4" />
              {deleteOptionMutation.isPending ? "削除中..." : "削除する"}
            </ResponsiveAlertDialogDestructiveAction>
```

- [ ] **Step 3: 型チェック**

Run: `bun run check-types`

- [ ] **Step 4: コミット**

```bash
git add apps/web/app/(authenticated)/trips/[id]/_components/poll-tab.tsx
git commit -m "fix: PollTab の確定/削除ボタンにローディング状態を追加"
```

---

### Task 15: U2 - エラーメッセージの英語漏れ修正

`packages/shared/src/messages.ts` に日本語メッセージを追加し、`expense-dialog.tsx` と `souvenir-dialog.tsx` で使用する。

**Files:**
- Modify: `packages/shared/src/messages.ts` (269行付近)
- Modify: `apps/web/components/expense-dialog.tsx:267`
- Modify: `apps/web/components/souvenir-dialog.tsx:129`

- [ ] **Step 1: メッセージ定数を追加**

```typescript
// packages/shared/src/messages.ts の 269行目の後に追加:
  EXPENSE_SAVE_FAILED: "費用の保存に失敗しました",

// さらに適切な位置 (EMPTY_SOUVENIR の近くなど) に追加:
  SOUVENIR_SAVE_FAILED: "お土産の保存に失敗しました",
```

- [ ] **Step 2: expense-dialog.tsx を修正**

```typescript
// 変更前 (267行目):
      toast.error(getApiErrorMessage(err, "Failed to save expense"));

// 変更後:
      toast.error(getApiErrorMessage(err, MSG.EXPENSE_SAVE_FAILED));
```

- [ ] **Step 3: souvenir-dialog.tsx を修正**

```typescript
// 変更前 (129行目):
      toast.error(getApiErrorMessage(err, "Failed to save souvenir"));

// 変更後:
      toast.error(getApiErrorMessage(err, MSG.SOUVENIR_SAVE_FAILED));
```

- [ ] **Step 4: 型チェック**

Run: `bun run check-types`

- [ ] **Step 5: コミット**

```bash
git add packages/shared/src/messages.ts apps/web/components/expense-dialog.tsx apps/web/components/souvenir-dialog.tsx
git commit -m "fix: 費用・お土産ダイアログのエラーメッセージを日本語に統一"
```

---

### Task 16: U3 - getApiErrorMessage のフォールバック改善

サーバーエラー (5xx) の場合にフォールバックメッセージを返すようにする。

**Files:**
- Modify: `apps/web/lib/api.ts:55-67`

- [ ] **Step 1: 5xx エラーでフォールバックを使用**

```typescript
// 変更前 (55-67行目):
export function getApiErrorMessage(
  err: unknown,
  fallback: string,
  opts?: { conflict?: string; notFound?: string },
): string {
  if (err instanceof ApiError) {
    if (err.status === 409) return opts?.conflict ?? err.message;
    if (err.status === 404) return opts?.notFound ?? err.message;
    return err.message;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

// 変更後:
export function getApiErrorMessage(
  err: unknown,
  fallback: string,
  opts?: { conflict?: string; notFound?: string },
): string {
  if (err instanceof ApiError) {
    if (err.status === 409) return opts?.conflict ?? err.message;
    if (err.status === 404) return opts?.notFound ?? err.message;
    // Server errors (5xx) may contain technical details; use fallback instead
    if (err.status >= 500) return fallback;
    return err.message;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}
```

- [ ] **Step 2: 型チェック**

Run: `bun run check-types`

- [ ] **Step 3: コミット**

```bash
git add apps/web/lib/api.ts
git commit -m "fix: getApiErrorMessage で 5xx エラー時にフォールバックメッセージを使用"
```

---

### Task 17: U4 - PollTab のローディングを Skeleton に統一

テキスト「読み込み中...」を Skeleton コンポーネントに置き換える。

**Files:**
- Modify: `apps/web/app/(authenticated)/trips/[id]/_components/poll-tab.tsx:278-284`

- [ ] **Step 1: Skeleton import を追加し、ローディング表示を変更**

import に `Skeleton` を追加:
```typescript
import { Skeleton } from "@/components/ui/skeleton";
```

```tsx
// 変更前 (278-284行目):
  if (isLoading || !poll) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-muted-foreground">読み込み中...</p>
      </div>
    );
  }

// 変更後:
  if (isLoading || !poll) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
```

- [ ] **Step 2: 型チェック**

Run: `bun run check-types`

- [ ] **Step 3: コミット**

```bash
git add apps/web/app/(authenticated)/trips/[id]/_components/poll-tab.tsx
git commit -m "fix: PollTab のローディングを Skeleton に統一"
```

---

### Task 18: U5 - 候補スポットのリアクションにオプティミスティック更新を追加

`handleReact` と `handleRemoveReaction` にオプティミスティック更新を追加する。

**Files:**
- Modify: `apps/web/components/candidate-panel.tsx:166-187`

- [ ] **Step 1: handleReact にオプティミスティック更新を追加**

```typescript
// 変更前 (166-176行目):
  async function handleReact(scheduleId: string, type: "like" | "hmm") {
    try {
      await api(`/api/trips/${tripId}/candidates/${scheduleId}/reaction`, {
        method: "PUT",
        body: JSON.stringify({ type }),
      });
      onRefresh();
    } catch {
      toast.error(MSG.REACTION_FAILED);
    }
  }

// 変更後:
  async function handleReact(scheduleId: string, type: "like" | "hmm") {
    const prev = queryClient.getQueryData(cacheKey);
    queryClient.setQueryData(cacheKey, (old: TripResponse | undefined) => {
      if (!old) return old;
      return {
        ...old,
        candidates: old.candidates.map((c) =>
          c.id === scheduleId ? { ...c, myReaction: type } : c,
        ),
      };
    });
    try {
      await api(`/api/trips/${tripId}/candidates/${scheduleId}/reaction`, {
        method: "PUT",
        body: JSON.stringify({ type }),
      });
      onRefresh();
    } catch {
      if (prev) queryClient.setQueryData(cacheKey, prev);
      toast.error(MSG.REACTION_FAILED);
    }
  }
```

- [ ] **Step 2: handleRemoveReaction にも同様に追加**

```typescript
// 変更前 (178-187行目):
  async function handleRemoveReaction(scheduleId: string) {
    try {
      await api(`/api/trips/${tripId}/candidates/${scheduleId}/reaction`, {
        method: "DELETE",
      });
      onRefresh();
    } catch {
      toast.error(MSG.REACTION_REMOVE_FAILED);
    }
  }

// 変更後:
  async function handleRemoveReaction(scheduleId: string) {
    const prev = queryClient.getQueryData(cacheKey);
    queryClient.setQueryData(cacheKey, (old: TripResponse | undefined) => {
      if (!old) return old;
      return {
        ...old,
        candidates: old.candidates.map((c) =>
          c.id === scheduleId ? { ...c, myReaction: null } : c,
        ),
      };
    });
    try {
      await api(`/api/trips/${tripId}/candidates/${scheduleId}/reaction`, {
        method: "DELETE",
      });
      onRefresh();
    } catch {
      if (prev) queryClient.setQueryData(cacheKey, prev);
      toast.error(MSG.REACTION_REMOVE_FAILED);
    }
  }
```

注意: `TripResponse` 型と `cacheKey` は既に `handleDelete` で使用されている (147-163行目参照)。同じパターンを踏襲。`CandidateResponse` に `myReaction` フィールドがあることを確認すること。

- [ ] **Step 3: 型チェック**

Run: `bun run check-types`

- [ ] **Step 4: コミット**

```bash
git add apps/web/components/candidate-panel.tsx
git commit -m "fix: 候補スポットのリアクションにオプティミスティック更新を追加"
```

---

### Task 19: U6 - ホームタブに role="tab" / aria-selected を追加

設定ページとの一貫性のため、タブボタンにアクセシビリティ属性を追加する。

**Files:**
- Modify: `apps/web/app/(authenticated)/home/page.tsx:176-192`

- [ ] **Step 1: タブに aria 属性を追加**

```tsx
// 変更前 (176-192行目):
        <div className="mt-4 flex gap-1.5">
          {tabs.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => handleTabChange(value)}
              className={cn(
                "shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-[colors,transform] active:scale-[0.95]",
                tab === value
                  ? "bg-muted text-foreground"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

// 変更後:
        <div className="mt-4 flex gap-1.5" role="tablist">
          {tabs.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => handleTabChange(value)}
              className={cn(
                "shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-[colors,transform] active:scale-[0.95]",
                tab === value
                  ? "bg-muted text-foreground"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
```

- [ ] **Step 2: SP 版のホームページにも同様の修正があるか確認して適用**

`apps/web/app/(sp)/sp/home/page.tsx` にも同じパターンがあれば同様に修正。

- [ ] **Step 3: 型チェック**

Run: `bun run check-types`

- [ ] **Step 4: コミット**

```bash
git add apps/web/app/(authenticated)/home/page.tsx apps/web/app/(sp)/sp/home/page.tsx
git commit -m "fix: ホームタブに role=tab / aria-selected を追加"
```

---

### Task 20: U7 - 日程調整の回答ボタンに aria-pressed を追加

**Files:**
- Modify: `apps/web/app/(authenticated)/trips/[id]/_components/poll-tab.tsx:518-532`

- [ ] **Step 1: aria 属性を追加**

```tsx
// 変更前 (519-531行目):
                        <button
                          key={value}
                          type="button"
                          className={`flex h-8 flex-1 items-center justify-center rounded border transition-colors ${
                            isActive
                              ? config.activeClassName
                              : "border-muted-foreground/20 text-muted-foreground hover:bg-accent"
                          } ${!isOpen ? "opacity-50" : ""}`}
                          onClick={() => handleSetResponse(opt.id, value)}
                          disabled={!isOpen}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </button>

// 変更後:
                        <button
                          key={value}
                          type="button"
                          aria-pressed={isActive}
                          aria-label={value === "ok" ? "参加可能" : value === "maybe" ? "未定" : "参加不可"}
                          className={`flex h-8 flex-1 items-center justify-center rounded border transition-colors ${
                            isActive
                              ? config.activeClassName
                              : "border-muted-foreground/20 text-muted-foreground hover:bg-accent"
                          } ${!isOpen ? "opacity-50" : ""}`}
                          onClick={() => handleSetResponse(opt.id, value)}
                          disabled={!isOpen}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </button>
```

- [ ] **Step 2: 型チェック**

Run: `bun run check-types`

- [ ] **Step 3: コミット**

```bash
git add apps/web/app/(authenticated)/trips/[id]/_components/poll-tab.tsx
git commit -m "fix: 日程調整の回答ボタンに aria-pressed / aria-label を追加"
```

---

### Task 21: U8 - 旅行削除ダイアログに旅行名を表示

**Files:**
- Modify: `apps/web/components/trip-actions.tsx:80-89` (props に `tripTitle` 追加)
- Modify: `apps/web/components/trip-actions.tsx:571-574` (ダイアログに旅行名表示)
- Modify: 呼び出し元 `apps/web/app/(authenticated)/trips/[id]/_components/trip-header.tsx:37-49`

- [ ] **Step 1: TripActionsProps に tripTitle を追加**

```typescript
// 変更前 (80-89行目):
type TripActionsProps = {
  tripId: string;
  status: TripStatus;
  role: MemberRole;
  pollId?: string | null;
  onStatusChange?: () => void;
  onEdit?: () => void;
  disabled?: boolean;
  memberLimitReached?: boolean;
  compact?: boolean;

// 変更後:
type TripActionsProps = {
  tripId: string;
  tripTitle: string;
  status: TripStatus;
  role: MemberRole;
  pollId?: string | null;
  onStatusChange?: () => void;
  onEdit?: () => void;
  disabled?: boolean;
  memberLimitReached?: boolean;
  compact?: boolean;
```

- [ ] **Step 2: 分割代入に tripTitle を追加**

```typescript
// 変更前 (107-109行目):
export function TripActions({
  tripId,
  status,

// 変更後:
export function TripActions({
  tripId,
  tripTitle,
  status,
```

- [ ] **Step 3: ダイアログに旅行名を表示**

```tsx
// 変更前 (571-574行目):
            <ResponsiveAlertDialogTitle>旅行を削除しますか？</ResponsiveAlertDialogTitle>
            <ResponsiveAlertDialogDescription>
              この旅行とすべての予定が削除されます。この操作は取り消せません。
            </ResponsiveAlertDialogDescription>

// 変更後:
            <ResponsiveAlertDialogTitle>旅行を削除しますか？</ResponsiveAlertDialogTitle>
            <ResponsiveAlertDialogDescription>
              「{tripTitle}」とすべての予定が削除されます。この操作は取り消せません。
            </ResponsiveAlertDialogDescription>
```

- [ ] **Step 4: 呼び出し元で tripTitle を渡す**

trip-header.tsx:
```typescript
// 変更前 (37-49行目):
  const tripActionsProps = {
    tripId,
    status: trip.status,
    role: trip.role,

// 変更後:
  const tripActionsProps = {
    tripId,
    tripTitle: trip.title,
    status: trip.status,
    role: trip.role,
```

注意: SP 版 (`apps/web/app/(sp)/...`) にも同じ呼び出しがあれば修正。

- [ ] **Step 5: 型チェック**

Run: `bun run check-types`

- [ ] **Step 6: コミット**

```bash
git add apps/web/components/trip-actions.tsx apps/web/app/(authenticated)/trips/[id]/_components/trip-header.tsx
git commit -m "fix: 旅行削除ダイアログに旅行名を表示"
```

---

### Task 22: U9 - EmptyState に action prop を追加

EmptyState コンポーネントに任意のアクション要素を渡せるようにし、旅行一覧の空状態で使用する。

**Files:**
- Modify: `apps/web/components/ui/empty-state.tsx`
- Modify: `apps/web/app/(authenticated)/home/page.tsx:218-222`

- [ ] **Step 1: EmptyState に action prop を追加**

```tsx
// 変更前 (4-8行目):
type EmptyStateProps = {
  message: string;
  variant: "box" | "page" | "inline";
  className?: string;
};

// 変更後:
type EmptyStateProps = {
  message: string;
  variant: "box" | "page" | "inline";
  className?: string;
  action?: React.ReactNode;
};
```

各 variant の JSX で `{action}` を `<p>` の後に追加:

```tsx
// page variant (27-28行目):
// 変更前:
  if (variant === "page") {
    return <p className={cn("mt-8 text-center text-muted-foreground", className)}>{message}</p>;
  }

// 変更後:
  if (variant === "page") {
    return (
      <div className={cn("mt-8 text-center", className)}>
        <p className="text-muted-foreground">{message}</p>
        {action}
      </div>
    );
  }
```

- [ ] **Step 2: 型チェック**

Run: `bun run check-types`

- [ ] **Step 3: コミット**

```bash
git add apps/web/components/ui/empty-state.tsx
git commit -m "fix: EmptyState に action prop を追加"
```

注意: 空状態で「旅行を作成」ボタンを表示するのは呼び出し元の変更が必要だが、EmptyState の API 拡張のみでコミット。home/page.tsx での使用は別タスクまたは今後の改善として残す（既に FAB が存在するため）。

---

### Task 23: U10 - パスワード強度のリアルタイムフィードバック

入力中にパスワード要件の充足状態を表示する。

**Files:**
- Modify: `apps/web/components/signup-form.tsx`

- [ ] **Step 1: パスワード state を追加**

```typescript
// 変更前 (25-27行目):
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);

// 変更後:
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [password, setPassword] = useState("");
```

- [ ] **Step 2: パスワード input に onChange を追加**

```tsx
// 変更前 (134-142行目):
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="8文字以上"
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              required
            />

// 変更後:
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="8文字以上"
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
```

- [ ] **Step 3: 要件テキストをリアルタイム表示に変更**

```tsx
// 変更前 (143行目):
            <p className="text-xs text-muted-foreground">{getPasswordRequirementsText()}</p>

// 変更後:
            {password.length > 0 ? (
              <PasswordStrength password={password} />
            ) : (
              <p className="text-xs text-muted-foreground">{getPasswordRequirementsText()}</p>
            )}
```

`PasswordStrength` は同ファイル内にインラインで定義:

```tsx
function PasswordStrength({ password }: { password: string }) {
  const { errors } = validatePassword(password);
  if (errors.length === 0) {
    return <p className="text-xs text-green-600 dark:text-green-400">要件を満たしています</p>;
  }
  return (
    <p className="text-xs text-muted-foreground">
      未達: {errors.join("、")}
    </p>
  );
}
```

注意: `validatePassword` は `{ valid, errors }` を返す。`valid === true` のときは errors が空。

- [ ] **Step 4: 型チェック**

Run: `bun run check-types`

- [ ] **Step 5: コミット**

```bash
git add apps/web/components/signup-form.tsx
git commit -m "fix: パスワード入力時にリアルタイムで強度フィードバックを表示"
```

---

### Task 24: U11 - 費用ありメンバーの削除不可表示にアクセシビリティ改善

`<span>` に Tooltip を追加して理由を表示する。

**Files:**
- Modify: `apps/web/components/member-dialog.tsx:304-307`

- [ ] **Step 1: Tooltip で理由を表示**

```tsx
// 変更前 (304-307行目):
                      {member.hasExpenses ? (
                        <span className="cursor-not-allowed select-none text-sm text-muted-foreground/50">
                          削除
                        </span>

// 変更後:
                      {member.hasExpenses ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span
                              className="cursor-not-allowed select-none text-sm text-muted-foreground/50"
                              aria-label="費用データがあるため削除できません"
                            >
                              削除
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>費用データがあるため削除できません</TooltipContent>
                        </Tooltip>
```

注意: `Tooltip`, `TooltipTrigger`, `TooltipContent` が既に import されているか確認。されていなければ import を追加。

- [ ] **Step 2: 型チェック**

Run: `bun run check-types`

- [ ] **Step 3: コミット**

```bash
git add apps/web/components/member-dialog.tsx
git commit -m "fix: 費用ありメンバーの削除不可表示に Tooltip を追加"
```

---

## 最終確認

- [ ] **全テスト実行:** `bun run test`
- [ ] **型チェック:** `bun run check-types`
- [ ] **lint:** `bun run check`
