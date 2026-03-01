# Code Review Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** コードレビューで発見された Critical / Warning / Info の全問題を修正し、構造的な品質を向上する

**Architecture:** 各修正は独立したコミットで行う。テストがある修正はテストファースト、ない修正は修正後にテストを追加する。

**Tech Stack:** TypeScript, Hono, Drizzle ORM, Vitest, Zod

---

## Task 1: notifications.ts — push 購読削除に userId を追加 [Critical]

**Files:**
- Modify: `apps/api/src/lib/notifications.ts:180`
- Test: `apps/api/src/__tests__/notifications.test.ts`

**Context:**
`sendPushToUser` が 410/404 で購読削除する際、`endpoint` のみで WHERE している。`userId` も含めることで防御的に修正する。

**Step 1: テストを追加**

`apps/api/src/__tests__/notifications.test.ts` の `describe("createNotification")` 内に追加：

```typescript
it("410 エラーの場合 userId を含む条件で購読を削除する", async () => {
  const sub = {
    endpoint: "https://fcm.example.com/push/1",
    p256dh: "abc",
    auth: "xyz",
    preferences: {},
  };
  mockDbQuery.pushSubscriptions.findMany.mockResolvedValue([sub]);
  mockSendNotification.mockRejectedValue({ statusCode: 410 });

  // deleteの引数をキャプチャ
  const whereArgs: unknown[] = [];
  const mockWhere = vi.fn().mockImplementation((...args) => {
    whereArgs.push(...args);
    return Promise.resolve(undefined);
  });
  mockDbDelete.mockReturnValue({ where: mockWhere });

  await createNotification({ ...baseParams, userId: "user-1" });
  await new Promise((r) => setTimeout(r, 50));

  expect(mockDbDelete).toHaveBeenCalled();
  // delete の where が userId を含むことを確認（文字列化して検証）
  const whereStr = JSON.stringify(whereArgs);
  expect(whereStr).toContain("user-1");
});
```

**Step 2: テストが失敗することを確認**

```bash
bun run --filter @sugara/api test -- --run notifications
```

Expected: FAIL

**Step 3: 実装を修正**

`apps/api/src/lib/notifications.ts` の `sendPushToUser` 内：

```typescript
// Before (line 179-181):
if (status === 410 || status === 404) {
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, sub.endpoint));
}

// After:
if (status === 410 || status === 404) {
  await db
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.endpoint, sub.endpoint), eq(pushSubscriptions.userId, userId)));
}
```

**Step 4: テストが通ることを確認**

```bash
bun run --filter @sugara/api test -- --run notifications
```

Expected: PASS

**Step 5: コミット**

```bash
git add apps/api/src/lib/notifications.ts apps/api/src/__tests__/notifications.test.ts
git commit -m "fix: push 購読削除の WHERE 条件に userId を追加"
```

---

## Task 2: notifications.ts — pruning を 3 クエリから 2 クエリに削減 [Info]

**Files:**
- Modify: `apps/api/src/lib/notifications.ts:125-148`
- Test: `apps/api/src/__tests__/notifications.test.ts`

**Context:**
`pruneOldNotifications` が COUNT → findMany → DELETE の 3 クエリを発行している。全件 SELECT + JS でカウントすることで 2 クエリに削減できる。

**Step 1: 現在の実装を置換**

```typescript
// Before:
async function pruneOldNotifications(userId: string): Promise<void> {
  const [{ count: total }] = await db
    .select({ count: count() })
    .from(notifications)
    .where(eq(notifications.userId, userId));

  const excess = Number(total) - MAX_NOTIFICATIONS_PER_USER;
  if (excess <= 0) return;

  const oldest = await db.query.notifications.findMany({
    where: eq(notifications.userId, userId),
    orderBy: [asc(notifications.createdAt)],
    limit: excess,
    columns: { id: true },
  });
  if (oldest.length > 0) {
    await db.delete(notifications).where(
      inArray(
        notifications.id,
        oldest.map((n) => n.id),
      ),
    );
  }
}

// After:
async function pruneOldNotifications(userId: string): Promise<void> {
  const all = await db.query.notifications.findMany({
    where: eq(notifications.userId, userId),
    orderBy: [asc(notifications.createdAt)],
    columns: { id: true },
  });

  const excess = all.length - MAX_NOTIFICATIONS_PER_USER;
  if (excess <= 0) return;

  await db.delete(notifications).where(
    inArray(
      notifications.id,
      all.slice(0, excess).map((n) => n.id),
    ),
  );
}
```

不要になったインポートを削除：`count` を `notifications.ts` のインポートから削除。

**Step 2: テストが通ることを確認**

```bash
bun run --filter @sugara/api test -- --run notifications
```

Expected: PASS（既存テストが通ることを確認）

**Step 3: コミット**

```bash
git add apps/api/src/lib/notifications.ts
git commit -m "refactor: pruneOldNotifications を 3 クエリから 2 クエリに削減"
```

---

## Task 3: poll-access.ts — 自動参加登録前に参加者上限を確認 [Critical]

**Files:**
- Modify: `apps/api/src/lib/poll-access.ts:58-68`

**Context:**
`findPollAsParticipant` がトリップメンバーの初回 GET で自動的に参加者を INSERT するが、`MAX_PARTICIPANTS_PER_POLL` チェックがない。`MAX_PARTICIPANTS_PER_POLL = MAX_MEMBERS_PER_TRIP = 20` のため実害は低いが、整合性のためチェックを追加する。

**Step 1: インポートに count を追加し、チェックを実装**

```typescript
// Before (line 58-68):
if (member) {
  // Intentional write side-effect: auto-add trip members as poll participants
  // on first access so they can immediately respond. This is by design because
  // poll participation is tied to trip membership.
  await db.insert(schedulePollParticipants).values({ pollId, userId }).onConflictDoNothing();
  return poll;
}

// After:
if (member) {
  const [{ count: participantCount }] = await db
    .select({ count: count() })
    .from(schedulePollParticipants)
    .where(eq(schedulePollParticipants.pollId, pollId));

  // Intentional write side-effect: auto-add trip members as poll participants
  // on first access so they can immediately respond. This is by design because
  // poll participation is tied to trip membership.
  // Guard against exceeding the limit (should not happen in practice since
  // MAX_PARTICIPANTS_PER_POLL === MAX_MEMBERS_PER_TRIP, but defensive check).
  if (Number(participantCount) < MAX_PARTICIPANTS_PER_POLL) {
    await db.insert(schedulePollParticipants).values({ pollId, userId }).onConflictDoNothing();
  }
  return poll;
}
```

インポートに追加：
```typescript
import { MAX_PARTICIPANTS_PER_POLL } from "@sugara/shared";
import { and, count, eq } from "drizzle-orm";
```

**Step 2: 型チェックを通す**

```bash
bun run check-types
```

Expected: no errors

**Step 3: コミット**

```bash
git add apps/api/src/lib/poll-access.ts
git commit -m "fix: poll 自動参加登録前に参加者上限チェックを追加"
```

---

## Task 4: expenses.ts — amount のみ更新時の splits 整合性検証 [Critical]

**Files:**
- Modify: `apps/api/src/routes/expenses.ts:177-203`
- Test: `apps/api/src/__tests__/expenses.test.ts`

**Context:**
PATCH で `amount` のみ変更（`splits` なし）した場合、既存 splits の合計が新しい `amount` と不一致になる可能性がある。サーバー側でバリデーションを追加する。

**Step 1: 既存テストを確認して問題を把握**

```bash
bun run --filter @sugara/api test -- --run expenses
```

**Step 2: 失敗テストを追加**

`apps/api/src/__tests__/expenses.test.ts` に：

```typescript
it("amount のみ更新で既存 splits 合計と不一致の場合 400 を返す", async () => {
  // existing expense: amount=1000, splits total=1000
  mockDbQuery.expenses.findFirst.mockResolvedValue({
    id: "exp-1",
    tripId: "trip-1",
    amount: 1000,
    splitType: "custom",
  });
  mockDbQuery.expenseSplits = {
    findMany: vi.fn().mockResolvedValue([
      { userId: "user-2", amount: 600 },
      { userId: "user-3", amount: 400 },
    ]),
  };

  const app = createTestApp(expenseRoutes, "/api/trips");
  const res = await app.request("/api/trips/trip-1/expenses/exp-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    // amount のみ変更, splits なし → 既存 splits 合計 1000 ≠ 新 amount 2000
    body: JSON.stringify({ amount: 2000 }),
  });
  expect(res.status).toBe(400);
});
```

**Step 3: テストが失敗することを確認**

```bash
bun run --filter @sugara/api test -- --run expenses
```

Expected: FAIL

**Step 4: ルートハンドラに検証を追加**

`apps/api/src/routes/expenses.ts` の `db.transaction` の前（line ~177 付近）に：

```typescript
// When only amount changes (no splits provided), verify existing splits still sum correctly.
// Without this check, the expense amount and split totals would become inconsistent.
if (updateFields.amount !== undefined && !splits) {
  const existingSplits = await db.query.expenseSplits.findMany({
    where: eq(expenseSplits.expenseId, expenseId),
  });
  const existingTotal = existingSplits.reduce((sum, s) => sum + s.amount, 0);
  if (existingTotal !== updateFields.amount) {
    return c.json({ error: ERROR_MSG.EXPENSE_SPLIT_AMOUNT_MISMATCH }, 400);
  }
}
```

`apps/api/src/lib/constants.ts` に定数を追加：

```typescript
EXPENSE_SPLIT_AMOUNT_MISMATCH: "Split amounts do not match the new total",
```

**Step 5: テストが通ることを確認**

```bash
bun run --filter @sugara/api test -- --run expenses
```

Expected: PASS

**Step 6: コミット**

```bash
git add apps/api/src/routes/expenses.ts apps/api/src/lib/constants.ts apps/api/src/__tests__/expenses.test.ts
git commit -m "fix: amount のみ更新時に既存 splits との整合性を検証"
```

---

## Task 5: push-subscriptions.ts — 上限チェックとinsertをトランザクション化 [Warning]

**Files:**
- Modify: `apps/api/src/routes/push-subscriptions.ts:28-57`

**Context:**
count チェック → 最古削除 → INSERT が別クエリで実行されるため、並行リクエストで上限を超過できる。トランザクションで包む。

**Step 1: POST ハンドラをトランザクション化**

```typescript
// Before (line 28-57): separate queries
// After: wrap in transaction

pushSubscriptionRoutes.post("/", async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const parsed = createPushSubscriptionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  await db.transaction(async (tx) => {
    // Count other subscriptions for this user (excluding the incoming endpoint)
    const [{ count: otherCount }] = await tx
      .select({ count: count() })
      .from(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.userId, user.id),
          ne(pushSubscriptions.endpoint, parsed.data.endpoint),
        ),
      );

    // Enforce per-user subscription limit: remove the oldest if a new endpoint would exceed it
    if (Number(otherCount) >= MAX_SUBSCRIPTIONS_PER_USER) {
      const oldest = await tx.query.pushSubscriptions.findFirst({
        where: and(
          eq(pushSubscriptions.userId, user.id),
          ne(pushSubscriptions.endpoint, parsed.data.endpoint),
        ),
        orderBy: [asc(pushSubscriptions.createdAt)],
        columns: { id: true },
      });
      if (oldest) {
        await tx.delete(pushSubscriptions).where(eq(pushSubscriptions.id, oldest.id));
      }
    }

    await tx
      .insert(pushSubscriptions)
      .values({ userId: user.id, ...parsed.data })
      .onConflictDoNothing();
  });

  return c.json({ ok: true }, 201);
});
```

**Step 2: 型チェック**

```bash
bun run check-types
```

**Step 3: テストが通ることを確認**

```bash
bun run --filter @sugara/api test -- --run push-subscriptions
```

Expected: PASS

**Step 4: コミット**

```bash
git add apps/api/src/routes/push-subscriptions.ts
git commit -m "fix: push 購読の上限チェックと登録をトランザクション化"
```

---

## Task 6: share.ts — 期限切れトークン置換時の楽観的ロック修正 [Warning]

**Files:**
- Modify: `apps/api/src/routes/share.ts:45-47`
- Test: `apps/api/src/__tests__/share.test.ts`

**Context:**
期限切れトークンを置換するとき、WHERE 条件が `eq(trips.id, tripId)` のみで、並行リクエストが先に新しいトークンを設定していても上書きする。既存の期限切れトークン値を WHERE に含めることで競合を防ぐ。

**Step 1: WHERE 条件を修正**

```typescript
// Before (line 44-47):
const expiresAt = shareExpiresAt();
const whereCondition = trip?.shareToken
  ? eq(trips.id, tripId)
  : and(eq(trips.id, tripId), isNull(trips.shareToken));

// After:
const expiresAt = shareExpiresAt();
// Use the current token value in WHERE to prevent overwriting a token
// that another concurrent request may have already set.
const whereCondition = trip?.shareToken
  ? and(eq(trips.id, tripId), eq(trips.shareToken, trip.shareToken))
  : and(eq(trips.id, tripId), isNull(trips.shareToken));
```

**Step 2: 型チェック**

```bash
bun run check-types
```

**Step 3: テストが通ることを確認**

```bash
bun run --filter @sugara/api test -- --run share
```

Expected: PASS（既存テストが通ること）

**Step 4: コミット**

```bash
git add apps/api/src/routes/share.ts
git commit -m "fix: 期限切れトークン置換時の WHERE 条件を修正（楽観的ロック改善）"
```

---

## Task 7: auth.ts — サインアップ設定の fail-closed に変更 [Warning]

**Files:**
- Modify: `apps/api/src/routes/auth.ts:13`
- Test: `apps/api/src/__tests__/auth-signup-intercept.test.ts`

**Context:**
DB エラー時に `signupEnabled: true` (fail-open) にしていたが、セキュリティ観点では fail-closed が望ましい。

**Step 1: fail-closed に変更**

```typescript
// Before:
const { signupEnabled } = await getAppSettings().catch(() => ({ signupEnabled: true }));

// After:
// Fail-closed on DB errors: a DB failure is a systemic issue that warrants
// blocking signup rather than silently allowing registrations.
const { signupEnabled } = await getAppSettings().catch(() => ({ signupEnabled: false }));
```

**Step 2: テストを更新（挙動変更のため）**

`apps/api/src/__tests__/auth-signup-intercept.test.ts` でDB エラー時の期待値を確認し、必要に応じてテストを更新する。

**Step 3: テストが通ることを確認**

```bash
bun run --filter @sugara/api test -- --run auth-signup-intercept
```

**Step 4: コミット**

```bash
git add apps/api/src/routes/auth.ts apps/api/src/__tests__/auth-signup-intercept.test.ts
git commit -m "fix: サインアップ設定読み取り失敗時を fail-closed に変更"
```

---

## Task 8: storage.ts — URL パス抽出に prefix 検証を追加 [Warning]

**Files:**
- Modify: `apps/api/src/lib/storage.ts:66-99`
- Test: `apps/api/src/__tests__/storage.test.ts`

**Context:**
`copyCoverImage` / `deleteCoverImage` が正規表現のみで path を抽出しており、別オリジンの URL が渡された場合でも操作が実行される。既知の Supabase storage prefix で始まることを検証する。

**Step 1: テストを追加**

`apps/api/src/__tests__/storage.test.ts` に：

```typescript
describe("copyCoverImage path extraction", () => {
  it("別オリジンの URL には null を返す", () => {
    // この関数は実際には非同期なので、ここでは validateStoragePath のような
    // 純粋関数に切り出してテストする（Task 8 で実装）
  });
});
```

**Step 2: パス抽出ヘルパーを切り出してテスト可能にし、prefix 検証を追加**

```typescript
const SUPABASE_STORAGE_PATH_PREFIX = `/storage/v1/object/public/${TRIP_COVERS_BUCKET}/`;

/**
 * Extract the storage path from a Supabase public URL.
 * Returns null if the URL does not originate from the expected bucket.
 */
export function extractStoragePath(url: string): string | null {
  const idx = url.indexOf(SUPABASE_STORAGE_PATH_PREFIX);
  if (idx === -1) return null;
  const path = url.slice(idx + SUPABASE_STORAGE_PATH_PREFIX.length);
  // Prevent path traversal
  if (!path || path.includes("..")) return null;
  return path;
}

export async function copyCoverImage(
  sourceUrl: string,
  destTripId: string,
): Promise<string | null> {
  const sourcePath = extractStoragePath(sourceUrl);
  if (!sourcePath) return null;
  // ... rest unchanged
}

export async function deleteCoverImage(url: string): Promise<void> {
  const path = extractStoragePath(url);
  if (!path) return;
  // ... rest unchanged using path
}
```

**Step 3: テストを充実させる**

```typescript
import { extractStoragePath } from "../lib/storage";

describe("extractStoragePath", () => {
  it("有効な Supabase URL からパスを抽出する", () => {
    const url = "https://xxx.supabase.co/storage/v1/object/public/trip-covers/trip-1/123.jpg";
    expect(extractStoragePath(url)).toBe("trip-1/123.jpg");
  });

  it("別オリジンの URL には null を返す", () => {
    expect(extractStoragePath("https://evil.com/trip-covers/trip-1/123.jpg")).toBeNull();
  });

  it("パストラバーサルには null を返す", () => {
    const url = "https://xxx.supabase.co/storage/v1/object/public/trip-covers/../secret";
    expect(extractStoragePath(url)).toBeNull();
  });

  it("空文字列には null を返す", () => {
    expect(extractStoragePath("")).toBeNull();
  });
});
```

**Step 4: テストが通ることを確認**

```bash
bun run --filter @sugara/api test -- --run storage
```

**Step 5: コミット**

```bash
git add apps/api/src/lib/storage.ts apps/api/src/__tests__/storage.test.ts
git commit -m "fix: storage URL パス抽出に prefix 検証を追加しパストラバーサルを防止"
```

---

## Task 9: members.ts — メンバー削除の費用チェックをトランザクション化 [Warning]

**Files:**
- Modify: `apps/api/src/routes/members.ts:200-256`

**Context:**
費用チェックと tripMembers 削除の間に競合状態がある。トランザクションで包む。

**Step 1: DELETE ハンドラをトランザクション化**

```typescript
// Remove member (owner only)
memberRoutes.delete("/:tripId/members/:userId", requireTripAccess("owner"), async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("tripId");
  const targetUserId = c.req.param("userId");

  if (targetUserId === user.id) {
    return c.json({ error: ERROR_MSG.CANNOT_REMOVE_SELF }, 400);
  }

  const existing = await db.query.tripMembers.findFirst({
    where: and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, targetUserId)),
    with: { user: { columns: { name: true } } },
  });
  if (!existing) {
    return c.json({ error: ERROR_MSG.MEMBER_NOT_FOUND }, 404);
  }

  // Check and delete atomically to prevent TOCTOU: a new expense could be added
  // between the check and the delete if not wrapped in a transaction.
  const deleted = await db.transaction(async (tx) => {
    const [{ count: expenseCount }] = await tx
      .select({ count: count() })
      .from(expenses)
      .leftJoin(expenseSplits, eq(expenseSplits.expenseId, expenses.id))
      .where(
        and(
          eq(expenses.tripId, tripId),
          or(eq(expenses.paidByUserId, targetUserId), eq(expenseSplits.userId, targetUserId)),
        ),
      );

    if (expenseCount > 0) return "has_expenses" as const;

    await tx
      .delete(tripMembers)
      .where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, targetUserId)));

    return "ok" as const;
  });

  if (deleted === "has_expenses") {
    return c.json({ error: ERROR_MSG.MEMBER_HAS_EXPENSES }, 409);
  }

  logActivity({ ... }); // unchanged

  void db.query.trips ... // notification unchanged

  return c.json({ ok: true });
});
```

**Step 2: 型チェック**

```bash
bun run check-types
```

**Step 3: テストが通ることを確認**

```bash
bun run --filter @sugara/api test -- --run members
```

**Step 4: コミット**

```bash
git add apps/api/src/routes/members.ts
git commit -m "fix: メンバー削除の費用チェックと削除をトランザクション化"
```

---

## Task 10: candidates.ts — from-bookmarks の順序保証 [Warning]

**Files:**
- Modify: `apps/api/src/routes/candidates.ts:275-310`

**Context:**
`db.query.bookmarks.findMany` が `bookmarkIds` の順序を保証しないため、スケジュールが意図した順序で挿入されない場合がある。`batch-duplicate` と同様に Map を使って順序を保持する。

**Step 1: 順序保持ロジックを追加**

```typescript
// Before (line 276-283):
const found = await db.query.bookmarks.findMany({
  where: inArray(bookmarks.id, parsed.data.bookmarkIds),
  with: { list: { columns: { userId: true } } },
});
const owned = found.filter((bm) => bm.list.userId === user.id);
if (owned.length !== parsed.data.bookmarkIds.length) {
  return c.json({ error: ERROR_MSG.BOOKMARK_OWNER_MISMATCH }, 404);
}

// After:
const found = await db.query.bookmarks.findMany({
  where: inArray(bookmarks.id, parsed.data.bookmarkIds),
  with: { list: { columns: { userId: true } } },
});
// Preserve the order of bookmarkIds in the request (db query order is not guaranteed)
const bookmarkById = new Map(found.map((bm) => [bm.id, bm]));
const owned = parsed.data.bookmarkIds
  .map((id) => bookmarkById.get(id))
  .filter((bm): bm is NonNullable<typeof bm> => bm !== undefined && bm.list.userId === user.id);
if (owned.length !== parsed.data.bookmarkIds.length) {
  return c.json({ error: ERROR_MSG.BOOKMARK_OWNER_MISMATCH }, 404);
}
```

**Step 2: 型チェック**

```bash
bun run check-types
```

**Step 3: テストが通ることを確認**

```bash
bun run --filter @sugara/api test -- --run candidates
```

**Step 4: コミット**

```bash
git add apps/api/src/routes/candidates.ts
git commit -m "fix: from-bookmarks でブックマーク順序を保持して挿入"
```

---

## Task 11: admin.ts — db.execute 結果の型アサーションを Zod 検証に置換 [Info]

**Files:**
- Modify: `apps/api/src/routes/admin.ts:167`

**Context:**
`(dbSizeResult[0] as { size: string }).size` は実行時型エラーのリスクがある。Zod で安全にパースする。

**Step 1: Zod スキーマを使って安全にパース**

```typescript
import { z } from "zod";

// fetchStats 関数内の最後、dbSizeResult の後：
// Before:
// ...
// After:

// In the response building (line ~167):
// Before:
dbSizeBytes: Number((dbSizeResult[0] as { size: string }).size),

// After:
const dbSizeRow = z.object({ size: z.coerce.number() }).safeParse(dbSizeResult[0]);
// ...
// In the response:
dbSizeBytes: dbSizeRow.success ? dbSizeRow.data.size : 0,
```

**Step 2: 型チェック**

```bash
bun run check-types
```

**Step 3: テストが通ることを確認**

```bash
bun run --filter @sugara/api test -- --run admin
```

**Step 4: コミット**

```bash
git add apps/api/src/routes/admin.ts
git commit -m "fix: admin stats の DB サイズ取得を型安全なパースに置換"
```

---

## Task 12: 全テスト・型チェック・lint を通す

**Step 1: 全テストを実行**

```bash
bun run test
```

Expected: PASS

**Step 2: 型チェック**

```bash
bun run check-types
```

Expected: no errors

**Step 3: lint**

```bash
bun run check
```

Expected: no errors

---

## 構造的観点の補足メモ

コードレビューで発見した構造的な問題（今回の修正範囲外だが記録しておく）：

1. **レートリミットのサーバーレス非互換** (`middleware/rate-limit.ts`): Vercel の各インスタンスがメモリを共有しないため、現状はベストエフォート。本格的な制限には Supabase or Redis を使った共有ストアが必要。
2. **ゲストアカウントのメールドメインが推測可能** (`lib/auth.ts`): `guest.sugara.local` ドメインは推測可能。実害は限定的だが、将来的には UUID ベースのドメイン等に変更を検討。
