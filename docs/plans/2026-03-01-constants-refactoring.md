# Constants & Code Sharing Refactoring Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 散在するマジックナンバー・文字列を定数化し、重複する通知送信パターンを共通ヘルパーに集約する。

**Architecture:** `apps/api/src/lib/constants.ts` に新定数を追加、`apps/api/src/lib/notifications.ts` に共通ヘルパーを追加。API ルートがこれらを参照するよう更新する。振る舞いは変えない（純粋なリファクタリング）。

**Tech Stack:** TypeScript, Drizzle ORM, Vitest

---

## Context

### 現状の問題

1. **TTL重複** — `GUEST_TTL_MS = 7 * 24 * 60 * 60 * 1000` (auth.ts:11) と `SHARE_LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000` (share-token.ts:3) が同じ値を独立して定義
2. **小定数の散在** — `"guest.sugara.local"`, `minUsernameLength: 3`, `maxUsernameLength: 20`, `limit: 20` (通知一覧) が各ファイルにベタ書き
3. **Rate Limit重複** — `rateLimitByIp({ window: 60, max: 30 })` が share.ts と poll-share.ts に重複
4. **通知送信パターン重複** — trip名取得→createNotification の fire-and-forget パターンが members.ts (3箇所), expenses.ts (1箇所) に重複。さらに members+trip 並列取得→全員通知パターンが schedules.ts に3箇所重複

### 変更対象ファイル

- `apps/api/src/lib/constants.ts` — 定数追加
- `apps/api/src/lib/notifications.ts` — ヘルパー追加
- `apps/api/src/lib/share-token.ts` — SEVEN_DAYS_MS 参照に変更
- `apps/api/src/lib/auth.ts` — SEVEN_DAYS_MS, GUEST_EMAIL_DOMAIN 参照に変更
- `apps/api/src/routes/notifications.ts` — NOTIFICATIONS_LIST_LIMIT 参照に変更
- `apps/api/src/routes/share.ts` — RATE_LIMIT_PUBLIC_RESOURCE 参照に変更
- `apps/api/src/routes/poll-share.ts` — RATE_LIMIT_PUBLIC_RESOURCE 参照に変更
- `apps/api/src/routes/account.ts` — RATE_LIMIT_ACCOUNT_MUTATION 参照に変更
- `apps/api/src/routes/members.ts` — notifyUsers 参照に変更
- `apps/api/src/routes/expenses.ts` — notifyUsers 参照に変更
- `apps/api/src/routes/schedules.ts` — notifyTripMembersExcluding 参照に変更

---

### Task 1: constants.ts に新定数を追加

**Files:**
- Modify: `apps/api/src/lib/constants.ts`

**Step 1: constants.ts に追加**

`apps/api/src/lib/constants.ts` の先頭（`import` の後）に以下を追加:

```typescript
// 7-day TTL in milliseconds — shared by guest accounts and share links
export const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// Guest account config
export const GUEST_EMAIL_DOMAIN = "guest.sugara.local";

// Username constraints (must match DB schema)
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;

// Notification list page size
export const NOTIFICATIONS_LIST_LIMIT = 20;

// Rate limit configs
export const RATE_LIMIT_PUBLIC_RESOURCE = { window: 60, max: 30 } as const;
export const RATE_LIMIT_ACCOUNT_MUTATION = { window: 300, max: 5 } as const;
```

**Step 2: 型チェックで確認**

Run: `bun run check-types`
Expected: エラーなし (まだ誰も参照していないので当然)

**Step 3: Commit**

```bash
git add apps/api/src/lib/constants.ts
git commit -m "refactor: 共通定数を constants.ts に追加"
```

---

### Task 2: TTL定数を参照に切り替え

**Files:**
- Modify: `apps/api/src/lib/auth.ts`
- Modify: `apps/api/src/lib/share-token.ts`

**Step 1: auth.ts を更新**

`apps/api/src/lib/auth.ts` の変更:

```typescript
// Before (line 11):
const GUEST_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// After:
import { GUEST_EMAIL_DOMAIN, SEVEN_DAYS_MS, USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH } from "./constants";
```

importを既存のimport群の末尾に追加し、`GUEST_TTL_MS` の定数定義行を削除。

使用箇所を置換:
- `Date.now() + GUEST_TTL_MS` → `Date.now() + SEVEN_DAYS_MS`
- `emailDomainName: "guest.sugara.local"` → `emailDomainName: GUEST_EMAIL_DOMAIN`
- `username({ minUsernameLength: 3, maxUsernameLength: 20 })` → `username({ minUsernameLength: USERNAME_MIN_LENGTH, maxUsernameLength: USERNAME_MAX_LENGTH })`

**Step 2: share-token.ts を更新**

`apps/api/src/lib/share-token.ts`:

```typescript
import crypto from "node:crypto";
import { SEVEN_DAYS_MS } from "./constants";

// 削除: const SHARE_LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function generateShareToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

export function shareExpiresAt(): Date {
  return new Date(Date.now() + SEVEN_DAYS_MS);
}
```

**Step 3: 型チェック**

Run: `bun run check-types`
Expected: エラーなし

**Step 4: テスト実行**

Run: `bun run --filter @sugara/api test`
Expected: 全件 PASS

**Step 5: Commit**

```bash
git add apps/api/src/lib/auth.ts apps/api/src/lib/share-token.ts
git commit -m "refactor: GUEST_TTL_MS と SHARE_LINK_TTL_MS を SEVEN_DAYS_MS に統一"
```

---

### Task 3: Rate Limit定数・通知件数定数を参照に切り替え

**Files:**
- Modify: `apps/api/src/routes/share.ts`
- Modify: `apps/api/src/routes/poll-share.ts`
- Modify: `apps/api/src/routes/account.ts`
- Modify: `apps/api/src/routes/notifications.ts`

**Step 1: share.ts を更新**

```typescript
// 追加 import:
import { RATE_LIMIT_PUBLIC_RESOURCE } from "../lib/constants";

// Before (line 15):
const sharedTripRateLimit = rateLimitByIp({ window: 60, max: 30 });

// After:
const sharedTripRateLimit = rateLimitByIp(RATE_LIMIT_PUBLIC_RESOURCE);
```

**Step 2: poll-share.ts を更新**

```typescript
// 追加 import:
import { RATE_LIMIT_PUBLIC_RESOURCE } from "../lib/constants";

// Before (line 10):
const sharedPollRateLimit = rateLimitByIp({ window: 60, max: 30 });

// After:
const sharedPollRateLimit = rateLimitByIp(RATE_LIMIT_PUBLIC_RESOURCE);
```

**Step 3: account.ts を更新**

```typescript
// 追加 import:
import { RATE_LIMIT_ACCOUNT_MUTATION } from "../lib/constants";

// Before (line 14):
const deleteRateLimit = rateLimitByIp({ window: 300, max: 5 });

// After:
const deleteRateLimit = rateLimitByIp(RATE_LIMIT_ACCOUNT_MUTATION);
```

**Step 4: routes/notifications.ts を更新**

```typescript
// 追加 import:
import { NOTIFICATIONS_LIST_LIMIT } from "../lib/constants";

// Before (line 20):
      limit: 20,

// After:
      limit: NOTIFICATIONS_LIST_LIMIT,
```

**Step 5: 型チェック**

Run: `bun run check-types`
Expected: エラーなし

**Step 6: テスト実行**

Run: `bun run --filter @sugara/api test`
Expected: 全件 PASS

**Step 7: Commit**

```bash
git add apps/api/src/routes/share.ts apps/api/src/routes/poll-share.ts apps/api/src/routes/account.ts apps/api/src/routes/notifications.ts
git commit -m "refactor: Rate Limit定数と通知件数定数を constants.ts 参照に変更"
```

---

### Task 4: notifyUsers ヘルパーを追加（members.ts / expenses.ts パターン）

このタスクでは「userIDは既知だが、trip名だけ非同期で取得してから通知」というパターンを共通化する。

**Files:**
- Modify: `apps/api/src/lib/notifications.ts`
- Modify: `apps/api/src/routes/members.ts`
- Modify: `apps/api/src/routes/expenses.ts`

**Step 1: notifications.ts にヘルパーを追加**

`apps/api/src/lib/notifications.ts` に以下を追加（`createNotification` のすぐ下）。
Drizzle ORM `db` と `trips` は既にインポート済みであることを確認する（なければ追加）。

```typescript
import { trips } from "../db/schema";

// ...既存コード...

/**
 * Fire-and-forget: fetch trip title then notify multiple users.
 * Use when recipient userIds are already known (e.g. expense splits, member add/remove).
 */
export function notifyUsers(params: {
  type: NotificationType;
  tripId: string;
  userIds: string[];
  makePayload: (tripName: string) => NotificationPayload;
}): void {
  const { type, tripId, userIds, makePayload } = params;
  if (userIds.length === 0) return;
  void db.query.trips
    .findFirst({ where: eq(trips.id, tripId), columns: { title: true } })
    .then((trip) => {
      const tripName = trip?.title ?? "旅行";
      void Promise.all(userIds.map((userId) => createNotification({ type, userId, tripId, payload: makePayload(tripName) })));
    });
}
```

注意: `eq` は `drizzle-orm` から既にインポートされているはず。`trips` は `../db/schema` から追加が必要。

**Step 2: 現在の imports を確認してから追記**

`apps/api/src/lib/notifications.ts` の先頭を確認。`trips` と `eq` が既にあれば追加不要。
- `eq` は `drizzle-orm` から `and, asc, eq, inArray` のうちの1つなので既に存在する。
- `trips` は schema からまだインポートされていないので追加が必要:

```typescript
// Before:
import { notificationPreferences, notifications, pushSubscriptions } from "../db/schema";

// After:
import { notificationPreferences, notifications, pushSubscriptions, trips } from "../db/schema";
```

**Step 3: members.ts を更新**

`apps/api/src/routes/members.ts` に import を追加:
```typescript
import { createNotification, notifyUsers } from "../lib/notifications";
```
(既存の `createNotification` import があれば `notifyUsers` を追加するだけ)

Add member (line ~122-131 の fire-and-forget ブロック) を置換:

```typescript
// Before:
  void db.query.trips
    .findFirst({ where: eq(trips.id, tripId), columns: { title: true } })
    .then((trip) => {
      void createNotification({
        type: "member_added",
        userId: targetUser.id,
        tripId,
        payload: { actorName: user.name, tripName: trip?.title ?? "旅行" },
      });
    });

// After:
  notifyUsers({
    type: "member_added",
    tripId,
    userIds: [targetUser.id],
    makePayload: (tripName) => ({ actorName: user.name, tripName }),
  });
```

Update member role (line ~181-193) を置換:

```typescript
// Before:
  void db.query.trips
    .findFirst({ where: eq(trips.id, tripId), columns: { title: true } })
    .then((trip) => {
      void createNotification({
        type: "role_changed",
        userId: targetUserId,
        tripId,
        payload: {
          actorName: user.name,
          tripName: trip?.title ?? "旅行",
          newRole: ROLE_LABELS[parsed.data.role],
        },
      });
    });

// After:
  notifyUsers({
    type: "role_changed",
    tripId,
    userIds: [targetUserId],
    makePayload: (tripName) => ({
      actorName: user.name,
      tripName,
      newRole: ROLE_LABELS[parsed.data.role],
    }),
  });
```

Remove member (line ~252-261) を置換:

```typescript
// Before:
  void db.query.trips
    .findFirst({ where: eq(trips.id, tripId), columns: { title: true } })
    .then((trip) => {
      void createNotification({
        type: "member_removed",
        userId: targetUserId,
        tripId,
        payload: { actorName: user.name, tripName: trip?.title ?? "旅行" },
      });
    });

// After:
  notifyUsers({
    type: "member_removed",
    tripId,
    userIds: [targetUserId],
    makePayload: (tripName) => ({ actorName: user.name, tripName }),
  });
```

members.ts から不要になった import を削除:
- `trips` (schema から) — `trips` を使う箇所が他にないか確認してから削除
- `db` — 他の箇所で使っているので残す

**Step 4: members.ts の import 整理**

members.ts の import を確認。`trips` テーブルは今回の変更後に残っているか確認。
`trips` はもう直接参照しなくなるので:
```typescript
// Before:
import { expenseSplits, expenses, tripMembers, trips, users } from "../db/schema";

// After:
import { expenseSplits, expenses, tripMembers, users } from "../db/schema";
```

**Step 5: expenses.ts を更新**

`apps/api/src/routes/expenses.ts` に import を追加:
```typescript
import { createNotification, notifyUsers } from "../lib/notifications";
```

Create expense の fire-and-forget ブロック (line ~118-134) を置換:

```typescript
// Before:
  void db.query.trips
    .findFirst({ where: eq(trips.id, tripId), columns: { title: true } })
    .then((trip) => {
      const tripName = trip?.title ?? "旅行";
      void Promise.all(
        splits
          .filter((s) => s.userId !== user.id)
          .map((s) =>
            createNotification({
              type: "expense_added",
              userId: s.userId,
              tripId,
              payload: { actorName: user.name, tripName, entityName: title },
            }),
          ),
      );
    });

// After:
  notifyUsers({
    type: "expense_added",
    tripId,
    userIds: splits.filter((s) => s.userId !== user.id).map((s) => s.userId),
    makePayload: (tripName) => ({ actorName: user.name, tripName, entityName: title }),
  });
```

expenses.ts から不要になった import を確認:
- `trips` (schema から) — 他で使っているか確認
  - `expenses, expenseSplits, tripMembers, trips` — `trips` は他の場所でも使っていたら残す。使わなければ削除。

**Step 6: 型チェック**

Run: `bun run check-types`
Expected: エラーなし

**Step 7: テスト実行**

Run: `bun run --filter @sugara/api test`
Expected: 全件 PASS

**Step 8: Lint**

Run: `bun run --filter @sugara/api check`
Expected: エラーなし (未使用 import があれば Biome が検出)

**Step 9: Commit**

```bash
git add apps/api/src/lib/notifications.ts apps/api/src/routes/members.ts apps/api/src/routes/expenses.ts
git commit -m "refactor: notifyUsers ヘルパーを追加し members.ts・expenses.ts で使用"
```

---

### Task 5: notifyTripMembersExcluding ヘルパーを追加（schedules.ts パターン）

このタスクでは「trip members を全員フェッチし、actorを除いて全員に通知」というパターンを共通化する。

**Files:**
- Modify: `apps/api/src/lib/notifications.ts`
- Modify: `apps/api/src/routes/schedules.ts`

**Step 1: notifications.ts に追加**

`notifyUsers` のすぐ下に追加:

```typescript
/**
 * Fire-and-forget: fetch all trip members and trip title in parallel,
 * then notify all members except the actor.
 * Use when recipient list = all trip members (e.g. schedule create/update/delete).
 */
export function notifyTripMembersExcluding(params: {
  type: NotificationType;
  tripId: string;
  actorId: string;
  makePayload: (tripName: string) => NotificationPayload;
}): void {
  const { type, tripId, actorId, makePayload } = params;
  void (async () => {
    const [members, trip] = await Promise.all([
      db.query.tripMembers.findMany({
        where: eq(tripMembers.tripId, tripId),
        columns: { userId: true },
      }),
      db.query.trips.findFirst({ where: eq(trips.id, tripId), columns: { title: true } }),
    ]);
    const tripName = trip?.title ?? "旅行";
    await Promise.all(
      members
        .filter((m) => m.userId !== actorId)
        .map((m) => createNotification({ type, userId: m.userId, tripId, payload: makePayload(tripName) })),
    );
  })();
}
```

`tripMembers` は `apps/api/src/db/schema` から import が必要:

```typescript
// Before:
import { notificationPreferences, notifications, pushSubscriptions, trips } from "../db/schema";

// After:
import { notificationPreferences, notifications, pushSubscriptions, tripMembers, trips } from "../db/schema";
```

**Step 2: schedules.ts を更新**

`apps/api/src/routes/schedules.ts` に import を追加:
```typescript
import { createNotification, notifyTripMembersExcluding } from "../lib/notifications";
```

Add schedule の fire-and-forget ブロック (line ~110-131) を置換:

```typescript
// Before:
  void (async () => {
    const [members, trip] = await Promise.all([
      db.query.tripMembers.findMany({
        where: eq(tripMembers.tripId, tripId),
        columns: { userId: true },
      }),
      db.query.trips.findFirst({ where: eq(trips.id, tripId), columns: { title: true } }),
    ]);
    const tripName = trip?.title ?? "旅行";
    await Promise.all(
      members
        .filter((m) => m.userId !== user.id)
        .map((m) =>
          createNotification({
            type: "schedule_created",
            userId: m.userId,
            tripId,
            payload: { actorName: user.name, tripName, entityName: schedule.name },
          }),
        ),
    );
  })();

// After:
  notifyTripMembersExcluding({
    type: "schedule_created",
    tripId,
    actorId: user.id,
    makePayload: (tripName) => ({ actorName: user.name, tripName, entityName: schedule.name }),
  });
```

同様に `schedule_updated` の fire-and-forget ブロックも置換:

```typescript
// Before:
  void (async () => {
    const [members, trip] = await Promise.all([...]);
    const tripName = trip?.title ?? "旅行";
    await Promise.all(
      members.filter(...).map(...createNotification({ type: "schedule_updated", ... }))
    );
  })();

// After:
  notifyTripMembersExcluding({
    type: "schedule_updated",
    tripId,
    actorId: user.id,
    makePayload: (tripName) => ({ actorName: user.name, tripName, entityName: updated.name }),
  });
```

同様に `schedule_deleted` の fire-and-forget ブロックも置換:

```typescript
// Before:
  void (async () => {
    const [members, trip] = await Promise.all([...]);
    const tripName = trip?.title ?? "旅行";
    await Promise.all(
      members.filter(...).map(...createNotification({ type: "schedule_deleted", ... }))
    );
  })();

// After:
  notifyTripMembersExcluding({
    type: "schedule_deleted",
    tripId,
    actorId: user.id,
    makePayload: (tripName) => ({ actorName: user.name, tripName }),
  });
```

schedules.ts から不要になった import を確認:
- `tripMembers` (schema から) — 通知ブロック以外で使っているか確認
  - 確認方法: grep で `tripMembers` の残存参照を検索
  - 使っていなければ削除
- `trips` (schema から) — 同様に確認
- `createNotification` (notifications から) — 使わなければ削除

**Step 3: 型チェック**

Run: `bun run check-types`
Expected: エラーなし

**Step 4: テスト実行**

Run: `bun run --filter @sugara/api test`
Expected: 全件 PASS

**Step 5: Lint**

Run: `bun run --filter @sugara/api check`
Expected: エラーなし

**Step 6: Commit**

```bash
git add apps/api/src/lib/notifications.ts apps/api/src/routes/schedules.ts
git commit -m "refactor: notifyTripMembersExcluding ヘルパーを追加し schedules.ts で使用"
```

---

### Task 6: 全体検証

**Step 1: 全テスト実行**

Run: `bun run test`
Expected: 全件 PASS

**Step 2: 型チェック**

Run: `bun run check-types`
Expected: エラーなし

**Step 3: Lint & Format**

Run: `bun run check`
Expected: エラーなし

---

## 注意事項

- `as const` を `RATE_LIMIT_PUBLIC_RESOURCE` に付けているため、`rateLimitByIp` の引数型と一致することを確認。型エラーが出る場合は `as const` を外すか、`RateLimitOptions` 型を確認する。
- `notifyUsers` と `notifyTripMembersExcluding` は fire-and-forget のため、呼び出し側で `await` や `void` を付けない。関数自体が内部で fire-and-forget を処理する。
- schedules.ts と members.ts から `trips` テーブルの import を削除するとき、他の箇所でも使っていないか必ず確認してから削除する。
