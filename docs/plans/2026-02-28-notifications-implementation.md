# 通知機能 実装計画

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** アプリ内通知とブラウザ push 通知を実装し、旅行メンバー変更・スケジュール操作・投票・経費イベントをリアルタイムにユーザーへ届ける。

**Architecture:** API ルートハンドラー内で DB 操作後に `createNotification()` ユーティリティを呼ぶ。In-app 通知は `notifications` テーブルに INSERT し、SWR polling でフロントが取得する。Push 通知は `web-push` ライブラリで fire-and-forget 送信する。Service Worker は既存の `apps/web/app/sw.ts` (Serwist) に push ハンドラーを追記する。

**Tech Stack:** Drizzle ORM, Hono, web-push, Serwist (existing), SWR (existing), Vitest

---

## Task 1: DB スキーマ追加

**Files:**
- Modify: `apps/api/src/db/schema.ts`

**Step 1: enum と 3 テーブルを schema.ts の末尾に追記**

既存の enum 定義の末尾（`reactionTypeEnum` の後）に追加する。

```typescript
export const notificationTypeEnum = pgEnum("notification_type", [
  "member_added",
  "member_removed",
  "role_changed",
  "schedule_created",
  "schedule_updated",
  "schedule_deleted",
  "poll_started",
  "poll_closed",
  "expense_added",
]);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tripId: uuid("trip_id").references(() => trips.id, { onDelete: "cascade" }),
    type: notificationTypeEnum("type").notNull(),
    payload: jsonb("payload").notNull().default({}),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("notifications_user_id_idx").on(table.userId),
    index("notifications_created_at_idx").on(table.createdAt),
  ],
).enableRLS();

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("push_subscriptions_user_id_idx").on(table.userId)],
).enableRLS();

export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: notificationTypeEnum("type").notNull(),
    inApp: boolean("in_app").notNull().default(true),
    push: boolean("push").notNull().default(true),
  },
  (table) => [primaryKey({ columns: [table.userId, table.type] })],
).enableRLS();
```

リレーション定義も追加する（既存リレーション定義ブロックの末尾）:

```typescript
export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
  trip: one(trips, { fields: [notifications.tripId], references: [trips.id] }),
}));

export const pushSubscriptionsRelations = relations(pushSubscriptions, ({ one }) => ({
  user: one(users, { fields: [pushSubscriptions.userId], references: [users.id] }),
}));

export const notificationPreferencesRelations = relations(notificationPreferences, ({ one }) => ({
  user: one(users, { fields: [notificationPreferences.userId], references: [users.id] }),
}));
```

`jsonb` は `apps/api/src/db/schema.ts` の既存インポートに追加が必要:

```typescript
import { ..., jsonb, boolean } from "drizzle-orm/pg-core";
```

**Step 2: マイグレーション生成・適用**

```bash
bun run db:generate
bun run db:migrate
```

Expected: マイグレーションファイルが生成され、ローカル DB に適用される。

**Step 3: 型チェック**

```bash
bun run check-types
```

Expected: エラーなし

**Step 4: コミット**

```bash
git add apps/api/src/db/schema.ts drizzle/
git commit -m "feat: notifications / push_subscriptions / notification_preferences テーブルを追加"
```

---

## Task 2: 共有 Zod スキーマ追加

**Files:**
- Create: `packages/shared/src/schemas/notification.ts`
- Modify: `packages/shared/src/schemas/index.ts`

**Step 1: スキーマファイルを作成**

```typescript
// packages/shared/src/schemas/notification.ts
import { z } from "zod";

export const notificationTypeSchema = z.enum([
  "member_added",
  "member_removed",
  "role_changed",
  "schedule_created",
  "schedule_updated",
  "schedule_deleted",
  "poll_started",
  "poll_closed",
  "expense_added",
]);

export type NotificationType = z.infer<typeof notificationTypeSchema>;

export const updateNotificationPreferenceSchema = z.object({
  type: notificationTypeSchema,
  inApp: z.boolean().optional(),
  push: z.boolean().optional(),
});

export const createPushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
});
```

**Step 2: index.ts に export を追加**

```typescript
// packages/shared/src/schemas/index.ts に追加
export * from "./notification";
```

**Step 3: 型チェック**

```bash
bun run check-types
```

Expected: エラーなし

**Step 4: コミット**

```bash
git add packages/shared/src/schemas/notification.ts packages/shared/src/schemas/index.ts
git commit -m "feat: notification の Zod スキーマを追加"
```

---

## Task 3: web-push インストールと環境変数設定

**Files:**
- Modify: `apps/api/src/lib/env.ts`

**Step 1: web-push をインストール**

```bash
bun add web-push --filter @sugara/api
bun add -D @types/web-push --filter @sugara/api
```

Expected: `apps/api/package.json` に `web-push` が追加される。

**Step 2: VAPID キーを生成（一回限り）**

```bash
node -e "const wp = require('web-push'); const keys = wp.generateVAPIDKeys(); console.log(JSON.stringify(keys, null, 2));"
```

出力された `publicKey` と `privateKey` を `.env.local` に追記:

```bash
# apps/web/.env.local に追記
VAPID_PUBLIC_KEY=<生成された publicKey>
VAPID_PRIVATE_KEY=<生成された privateKey>
VAPID_SUBJECT=mailto:admin@sugara.app
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<VAPID_PUBLIC_KEY と同じ値>
```

**Step 3: env.ts に VAPID 設定を追加**

```typescript
// apps/api/src/lib/env.ts の env オブジェクトに追加
get VAPID_PUBLIC_KEY() {
  return withDefault("VAPID_PUBLIC_KEY", "");
},
get VAPID_PRIVATE_KEY() {
  return withDefault("VAPID_PRIVATE_KEY", "");
},
get VAPID_SUBJECT() {
  return withDefault("VAPID_SUBJECT", "mailto:admin@sugara.app");
},
```

**Step 4: 型チェック**

```bash
bun run check-types
```

**Step 5: コミット（.env.local は絶対にコミットしない）**

```bash
git add apps/api/src/lib/env.ts apps/api/package.json bun.lock
git commit -m "feat: web-push をインストールし VAPID 環境変数を env.ts に追加"
```

---

## Task 4: 通知ユーティリティ実装

**Files:**
- Create: `apps/api/src/lib/notifications.ts`
- Create: `apps/api/src/__tests__/notifications.test.ts`

**Step 1: テストを書く（Red）**

```typescript
// apps/api/src/__tests__/notifications.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDbQuery, mockDbInsert, mockSendNotification } = vi.hoisted(() => ({
  mockDbQuery: {
    notificationPreferences: { findFirst: vi.fn() },
    pushSubscriptions: { findMany: vi.fn() },
  },
  mockDbInsert: vi.fn(),
  mockSendNotification: vi.fn(),
}));

vi.mock("../db/index", () => ({
  db: {
    query: mockDbQuery,
    insert: (...args: unknown[]) => mockDbInsert(...args),
  },
}));

vi.mock("web-push", () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: (...args: unknown[]) => mockSendNotification(...args),
  },
}));

import { createNotification } from "../lib/notifications";

const baseParams = {
  type: "member_added" as const,
  userId: "user-1",
  tripId: "trip-1",
  payload: { actorName: "田中", tripName: "京都旅行" },
};

describe("createNotification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbQuery.notificationPreferences.findFirst.mockResolvedValue(null); // no pref = default ON
    mockDbQuery.pushSubscriptions.findMany.mockResolvedValue([]);
    mockDbInsert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });
    mockSendNotification.mockResolvedValue({});
  });

  it("preferences が未設定の場合は in_app を DB に INSERT する", async () => {
    await createNotification(baseParams);
    expect(mockDbInsert).toHaveBeenCalled();
  });

  it("inApp が false の場合は DB INSERT しない", async () => {
    mockDbQuery.notificationPreferences.findFirst.mockResolvedValue({
      inApp: false,
      push: false,
    });
    await createNotification(baseParams);
    expect(mockDbInsert).not.toHaveBeenCalled();
  });

  it("push サブスクリプションがある場合は sendNotification を呼ぶ", async () => {
    mockDbQuery.pushSubscriptions.findMany.mockResolvedValue([
      { endpoint: "https://fcm.example.com/push/1", p256dh: "abc", auth: "xyz" },
    ]);
    await createNotification(baseParams);
    // sendNotification は非同期 fire-and-forget なので少し待つ
    await new Promise((r) => setTimeout(r, 10));
    expect(mockSendNotification).toHaveBeenCalled();
  });

  it("push が false の場合は sendNotification を呼ばない", async () => {
    mockDbQuery.notificationPreferences.findFirst.mockResolvedValue({
      inApp: true,
      push: false,
    });
    mockDbQuery.pushSubscriptions.findMany.mockResolvedValue([
      { endpoint: "https://fcm.example.com/push/1", p256dh: "abc", auth: "xyz" },
    ]);
    await createNotification(baseParams);
    await new Promise((r) => setTimeout(r, 10));
    expect(mockSendNotification).not.toHaveBeenCalled();
  });
});
```

**Step 2: テストが失敗することを確認**

```bash
bun run --filter @sugara/api test -- notifications.test.ts
```

Expected: FAIL (モジュールが存在しない)

**Step 3: ユーティリティを実装**

```typescript
// apps/api/src/lib/notifications.ts
import webpush from "web-push";
import { and, eq } from "drizzle-orm";
import { db } from "../db/index";
import {
  notificationPreferences,
  notifications,
  pushSubscriptions,
} from "../db/schema";
import { env } from "./env";
import type { NotificationType } from "@sugara/shared";

webpush.setVapidDetails(
  env.VAPID_SUBJECT,
  env.VAPID_PUBLIC_KEY,
  env.VAPID_PRIVATE_KEY,
);

export type NotificationPayload = {
  actorName?: string;
  tripName?: string;
  entityName?: string;
  newRole?: string;
  [key: string]: string | undefined;
};

type CreateNotificationParams = {
  type: NotificationType;
  userId: string;
  tripId?: string;
  payload: NotificationPayload;
};

/**
 * Fire-and-forget notification creation. Errors are caught internally.
 */
export function createNotification(params: CreateNotificationParams): Promise<void> {
  return createNotificationInternal(params).catch((err) => {
    console.error("[createNotification]", params.type, err);
  });
}

function buildPushMessage(
  type: NotificationType,
  payload: NotificationPayload,
  tripId?: string,
): { title: string; body: string; url: string } {
  const tripUrl = tripId ? `/trips/${tripId}` : "/";
  switch (type) {
    case "member_added":
      return {
        title: payload.tripName ?? "旅行",
        body: `${payload.actorName}さんがあなたを招待しました`,
        url: tripUrl,
      };
    case "member_removed":
      return {
        title: payload.tripName ?? "旅行",
        body: "旅行メンバーから削除されました",
        url: "/",
      };
    case "role_changed":
      return {
        title: payload.tripName ?? "旅行",
        body: `あなたのロールが「${payload.newRole}」に変更されました`,
        url: tripUrl,
      };
    case "schedule_created":
      return {
        title: payload.tripName ?? "旅行",
        body: `${payload.actorName}さんが「${payload.entityName}」を追加しました`,
        url: tripUrl,
      };
    case "schedule_updated":
      return {
        title: payload.tripName ?? "旅行",
        body: `${payload.actorName}さんが「${payload.entityName}」を更新しました`,
        url: tripUrl,
      };
    case "schedule_deleted":
      return {
        title: payload.tripName ?? "旅行",
        body: `${payload.actorName}さんがスケジュールを削除しました`,
        url: tripUrl,
      };
    case "poll_started":
      return {
        title: payload.tripName ?? "旅行",
        body: "日程投票が開始されました",
        url: tripUrl,
      };
    case "poll_closed":
      return {
        title: payload.tripName ?? "旅行",
        body: "日程投票が終了しました",
        url: tripUrl,
      };
    case "expense_added":
      return {
        title: payload.tripName ?? "旅行",
        body: `${payload.actorName}さんが経費「${payload.entityName}」を追加しました`,
        url: tripUrl,
      };
  }
}

async function createNotificationInternal(
  params: CreateNotificationParams,
): Promise<void> {
  const { type, userId, tripId, payload } = params;

  const pref = await db.query.notificationPreferences.findFirst({
    where: and(
      eq(notificationPreferences.userId, userId),
      eq(notificationPreferences.type, type),
    ),
  });

  const inAppEnabled = pref?.inApp ?? true;
  const pushEnabled = pref?.push ?? true;

  if (inAppEnabled) {
    await db.insert(notifications).values({ userId, tripId, type, payload });
  }

  if (pushEnabled) {
    void sendPushToUser(userId, type, payload, tripId);
  }
}

async function sendPushToUser(
  userId: string,
  type: NotificationType,
  payload: NotificationPayload,
  tripId?: string,
): Promise<void> {
  const subs = await db.query.pushSubscriptions.findMany({
    where: eq(pushSubscriptions.userId, userId),
  });
  if (subs.length === 0) return;

  const message = buildPushMessage(type, payload, tripId);
  await Promise.allSettled(
    subs.map((sub) =>
      webpush
        .sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(message),
        )
        .catch(() => {
          // Expired subscriptions fail silently
        }),
    ),
  );
}
```

**Step 4: テストを実行**

```bash
bun run --filter @sugara/api test -- notifications.test.ts
```

Expected: 4 tests pass

**Step 5: コミット**

```bash
git add apps/api/src/lib/notifications.ts apps/api/src/__tests__/notifications.test.ts
git commit -m "feat: createNotification ユーティリティを実装"
```

---

## Task 5: Notifications API ルート実装

**Files:**
- Create: `apps/api/src/routes/notifications.ts`
- Create: `apps/api/src/__tests__/notifications-routes.test.ts`

**Step 1: テストを書く（Red）**

```typescript
// apps/api/src/__tests__/notifications-routes.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestApp } from "./test-helpers";

const { mockGetSession, mockDbQuery, mockDbUpdate } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockDbQuery: {
    notifications: { findMany: vi.fn() },
  },
  mockDbUpdate: vi.fn(),
}));

vi.mock("../lib/auth", () => ({
  auth: { api: { getSession: (...args: unknown[]) => mockGetSession(...args) } },
}));

vi.mock("../db/index", () => ({
  db: {
    query: mockDbQuery,
    update: (...args: unknown[]) => mockDbUpdate(...args),
  },
}));

import { notificationRoutes } from "../routes/notifications";

const fakeUser = { id: "user-1", name: "Test" };

describe("Notification routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({ user: fakeUser, session: { id: "s1" } });
    mockDbQuery.notifications.findMany.mockResolvedValue([]);
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    });
  });

  it("GET /api/notifications は認証が必要", async () => {
    mockGetSession.mockResolvedValue(null);
    const app = createTestApp(notificationRoutes, "/api/notifications");
    const res = await app.request("/api/notifications");
    expect(res.status).toBe(401);
  });

  it("GET /api/notifications は通知一覧を返す", async () => {
    const app = createTestApp(notificationRoutes, "/api/notifications");
    const res = await app.request("/api/notifications");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("notifications");
    expect(body).toHaveProperty("unreadCount");
  });

  it("PUT /api/notifications/read-all は全件既読にする", async () => {
    const app = createTestApp(notificationRoutes, "/api/notifications");
    const res = await app.request("/api/notifications/read-all", { method: "PUT" });
    expect(res.status).toBe(200);
    expect(mockDbUpdate).toHaveBeenCalled();
  });
});
```

**Step 2: テストが失敗することを確認**

```bash
bun run --filter @sugara/api test -- notifications-routes.test.ts
```

Expected: FAIL

**Step 3: ルートを実装**

```typescript
// apps/api/src/routes/notifications.ts
import { and, count, eq, isNull } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/index";
import { notifications } from "../db/schema";
import { ERROR_MSG } from "../lib/constants";
import { requireAuth } from "../middleware/auth";
import type { AppEnv } from "../types";

const notificationRoutes = new Hono<AppEnv>();
notificationRoutes.use("*", requireAuth);

// GET /api/notifications - 通知一覧 + 未読件数
notificationRoutes.get("/", async (c) => {
  const user = c.get("user");

  const [items, [{ unreadCount }]] = await Promise.all([
    db.query.notifications.findMany({
      where: eq(notifications.userId, user.id),
      orderBy: (n, { desc }) => [desc(n.createdAt)],
      limit: 20,
    }),
    db
      .select({ unreadCount: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt))),
  ]);

  return c.json({ notifications: items, unreadCount: Number(unreadCount) });
});

// PUT /api/notifications/read-all - 全件既読
notificationRoutes.put("/read-all", async (c) => {
  const user = c.get("user");
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)));
  return c.json({ ok: true });
});

// PUT /api/notifications/:id/read - 1件既読
notificationRoutes.put("/:id/read", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const item = await db.query.notifications.findFirst({
    where: and(eq(notifications.id, id), eq(notifications.userId, user.id)),
  });
  if (!item) {
    return c.json({ error: ERROR_MSG.NOT_FOUND }, 404);
  }
  await db.update(notifications).set({ readAt: new Date() }).where(eq(notifications.id, id));
  return c.json({ ok: true });
});

export { notificationRoutes };
```

**Step 4: テストを実行**

```bash
bun run --filter @sugara/api test -- notifications-routes.test.ts
```

Expected: 3 tests pass

**Step 5: コミット**

```bash
git add apps/api/src/routes/notifications.ts apps/api/src/__tests__/notifications-routes.test.ts
git commit -m "feat: notifications API ルートを実装"
```

---

## Task 6: Push サブスクリプション API ルート実装

**Files:**
- Create: `apps/api/src/routes/push-subscriptions.ts`
- Create: `apps/api/src/__tests__/push-subscriptions.test.ts`

**Step 1: テストを書く（Red）**

```typescript
// apps/api/src/__tests__/push-subscriptions.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestApp } from "./test-helpers";

const { mockGetSession, mockDbInsert, mockDbDelete, mockDbSelect } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockDbInsert: vi.fn(),
  mockDbDelete: vi.fn(),
  mockDbSelect: vi.fn(),
}));

vi.mock("../lib/auth", () => ({
  auth: { api: { getSession: (...args: unknown[]) => mockGetSession(...args) } },
}));

vi.mock("../db/index", () => ({
  db: {
    insert: (...args: unknown[]) => mockDbInsert(...args),
    delete: (...args: unknown[]) => mockDbDelete(...args),
    select: (...args: unknown[]) => mockDbSelect(...args),
  },
}));

import { pushSubscriptionRoutes } from "../routes/push-subscriptions";

const fakeUser = { id: "user-1", name: "Test" };
const validBody = {
  endpoint: "https://fcm.googleapis.com/push/1",
  p256dh: "abc123",
  auth: "xyz789",
};

describe("Push subscription routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({ user: fakeUser, session: { id: "s1" } });
    mockDbInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({ onConflictDoNothing: vi.fn().mockResolvedValue(undefined) }),
    });
    mockDbDelete.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ count: 3 }]) }),
    });
  });

  it("POST /api/push-subscriptions はサブスクリプションを保存する", async () => {
    const app = createTestApp(pushSubscriptionRoutes, "/api/push-subscriptions");
    const res = await app.request("/api/push-subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody),
    });
    expect(res.status).toBe(201);
    expect(mockDbInsert).toHaveBeenCalled();
  });

  it("DELETE /api/push-subscriptions はサブスクリプションを削除する", async () => {
    const app = createTestApp(pushSubscriptionRoutes, "/api/push-subscriptions");
    const res = await app.request("/api/push-subscriptions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: validBody.endpoint }),
    });
    expect(res.status).toBe(200);
    expect(mockDbDelete).toHaveBeenCalled();
  });
});
```

**Step 2: テストが失敗することを確認**

```bash
bun run --filter @sugara/api test -- push-subscriptions.test.ts
```

**Step 3: ルートを実装**

```typescript
// apps/api/src/routes/push-subscriptions.ts
import { createPushSubscriptionSchema } from "@sugara/shared";
import { and, count, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db/index";
import { pushSubscriptions } from "../db/schema";
import { requireAuth } from "../middleware/auth";
import type { AppEnv } from "../types";

const MAX_SUBSCRIPTIONS_PER_USER = 5;

const pushSubscriptionRoutes = new Hono<AppEnv>();
pushSubscriptionRoutes.use("*", requireAuth);

// POST /api/push-subscriptions - 購読を保存
pushSubscriptionRoutes.post("/", async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const parsed = createPushSubscriptionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const [{ count: subCount }] = await db
    .select({ count: count() })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, user.id));

  // Enforce per-user subscription limit (multi-device)
  if (Number(subCount) >= MAX_SUBSCRIPTIONS_PER_USER) {
    await db
      .delete(pushSubscriptions)
      .where(
        and(eq(pushSubscriptions.userId, user.id), eq(pushSubscriptions.endpoint, parsed.data.endpoint)),
      );
  }

  await db
    .insert(pushSubscriptions)
    .values({ userId: user.id, ...parsed.data })
    .onConflictDoNothing();

  return c.json({ ok: true }, 201);
});

// DELETE /api/push-subscriptions - 購読を削除（ログアウト時）
pushSubscriptionRoutes.delete("/", async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const parsed = z.object({ endpoint: z.string().url() }).safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  await db
    .delete(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.userId, user.id),
        eq(pushSubscriptions.endpoint, parsed.data.endpoint),
      ),
    );

  return c.json({ ok: true });
});

export { pushSubscriptionRoutes };
```

**Step 4: テストを実行**

```bash
bun run --filter @sugara/api test -- push-subscriptions.test.ts
```

Expected: 2 tests pass

**Step 5: コミット**

```bash
git add apps/api/src/routes/push-subscriptions.ts apps/api/src/__tests__/push-subscriptions.test.ts
git commit -m "feat: push-subscriptions API ルートを実装"
```

---

## Task 7: 通知設定 API ルート実装

**Files:**
- Create: `apps/api/src/routes/notification-preferences.ts`
- Create: `apps/api/src/__tests__/notification-preferences.test.ts`

**Step 1: テストを書く（Red）**

```typescript
// apps/api/src/__tests__/notification-preferences.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestApp } from "./test-helpers";

const { mockGetSession, mockDbQuery, mockDbInsert } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockDbQuery: { notificationPreferences: { findMany: vi.fn() } },
  mockDbInsert: vi.fn(),
}));

vi.mock("../lib/auth", () => ({
  auth: { api: { getSession: (...args: unknown[]) => mockGetSession(...args) } },
}));

vi.mock("../db/index", () => ({
  db: {
    query: mockDbQuery,
    insert: (...args: unknown[]) => mockDbInsert(...args),
  },
}));

import { notificationPreferenceRoutes } from "../routes/notification-preferences";

const fakeUser = { id: "user-1", name: "Test" };

describe("Notification preference routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({ user: fakeUser, session: { id: "s1" } });
    mockDbQuery.notificationPreferences.findMany.mockResolvedValue([]);
    mockDbInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
      }),
    });
  });

  it("GET /api/notification-preferences は設定一覧を返す", async () => {
    const app = createTestApp(notificationPreferenceRoutes, "/api/notification-preferences");
    const res = await app.request("/api/notification-preferences");
    expect(res.status).toBe(200);
  });

  it("PUT /api/notification-preferences は設定を更新する", async () => {
    const app = createTestApp(notificationPreferenceRoutes, "/api/notification-preferences");
    const res = await app.request("/api/notification-preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "schedule_created", push: false }),
    });
    expect(res.status).toBe(200);
    expect(mockDbInsert).toHaveBeenCalled();
  });
});
```

**Step 2: テストが失敗することを確認**

```bash
bun run --filter @sugara/api test -- notification-preferences.test.ts
```

**Step 3: ルートを実装**

```typescript
// apps/api/src/routes/notification-preferences.ts
import { notificationTypeSchema, updateNotificationPreferenceSchema } from "@sugara/shared";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/index";
import { notificationPreferences } from "../db/schema";
import { requireAuth } from "../middleware/auth";
import type { AppEnv } from "../types";

const notificationPreferenceRoutes = new Hono<AppEnv>();
notificationPreferenceRoutes.use("*", requireAuth);

const ALL_TYPES = notificationTypeSchema.options;

// GET /api/notification-preferences - 設定一覧（未設定は default ON で補完）
notificationPreferenceRoutes.get("/", async (c) => {
  const user = c.get("user");
  const saved = await db.query.notificationPreferences.findMany({
    where: eq(notificationPreferences.userId, user.id),
  });

  const savedMap = new Map(saved.map((p) => [p.type, p]));
  const prefs = ALL_TYPES.map((type) => ({
    type,
    inApp: savedMap.get(type)?.inApp ?? true,
    push: savedMap.get(type)?.push ?? true,
  }));

  return c.json(prefs);
});

// PUT /api/notification-preferences - 1種別の設定を更新
notificationPreferenceRoutes.put("/", async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const parsed = updateNotificationPreferenceSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  await db
    .insert(notificationPreferences)
    .values({
      userId: user.id,
      type: parsed.data.type,
      inApp: parsed.data.inApp ?? true,
      push: parsed.data.push ?? true,
    })
    .onConflictDoUpdate({
      target: [notificationPreferences.userId, notificationPreferences.type],
      set: {
        ...(parsed.data.inApp !== undefined && { inApp: parsed.data.inApp }),
        ...(parsed.data.push !== undefined && { push: parsed.data.push }),
      },
    });

  return c.json({ ok: true });
});

export { notificationPreferenceRoutes };
```

**Step 4: テストを実行**

```bash
bun run --filter @sugara/api test -- notification-preferences.test.ts
```

Expected: 2 tests pass

**Step 5: コミット**

```bash
git add apps/api/src/routes/notification-preferences.ts apps/api/src/__tests__/notification-preferences.test.ts
git commit -m "feat: notification-preferences API ルートを実装"
```

---

## Task 8: app.ts にルートを登録

**Files:**
- Modify: `apps/api/src/app.ts`

**Step 1: インポートとルート登録を追加**

```typescript
// インポートを追加
import { notificationPreferenceRoutes } from "./routes/notification-preferences";
import { notificationRoutes } from "./routes/notifications";
import { pushSubscriptionRoutes } from "./routes/push-subscriptions";

// ルート登録を追加（既存の app.route("/api", ...) の近く）
app.route("/api/notifications", notificationRoutes);
app.route("/api/push-subscriptions", pushSubscriptionRoutes);
app.route("/api/notification-preferences", notificationPreferenceRoutes);
```

**Step 2: 型チェック**

```bash
bun run check-types
```

Expected: エラーなし

**Step 3: コミット**

```bash
git add apps/api/src/app.ts
git commit -m "feat: notification 系ルートを app.ts に登録"
```

---

## Task 9: members.ts に通知を追加

**Files:**
- Modify: `apps/api/src/routes/members.ts`
- Modify: `apps/api/src/__tests__/members.test.ts`

**Step 1: 既存テストに notification モックを追加**

`members.test.ts` の vi.mock ブロックに以下を追加:

```typescript
vi.mock("../lib/notifications", () => ({
  createNotification: vi.fn().mockResolvedValue(undefined),
}));
```

**Step 2: テストを追加（Red）**

```typescript
// members.test.ts の POST テストに追加
it("POST: メンバー追加時に createNotification を呼ぶ", async () => {
  const { createNotification } = await import("../lib/notifications");
  // ... 追加後に createNotification が呼ばれたことを verify
  expect(createNotification).toHaveBeenCalledWith(
    expect.objectContaining({ type: "member_added" }),
  );
});
```

**Step 3: members.ts に通知を追加**

`members.ts` のインポートに追加:

```typescript
import { createNotification } from "../lib/notifications";
```

POST ハンドラーの `logActivity(...)` の後:

```typescript
// Notify the added member
void createNotification({
  type: "member_added",
  userId: targetUser.id,
  tripId,
  payload: { actorName: user.name, tripName: trip.name },
});
```

※ `trip.name` を取得するため、`c.get("trip")` またはDB クエリが必要。
`requireTripAccess` middleware が `c.set("trip", ...)` している場合はそれを使う。なければ以下でトリップ名を取得:

```typescript
const trip = await db.query.trips.findFirst({
  where: eq(trips.id, tripId),
  columns: { title: true, destination: true },
});
const tripName = trip?.title ?? trip?.destination ?? "旅行";
```

PATCH ハンドラーの `logActivity(...)` の後:

```typescript
void createNotification({
  type: "role_changed",
  userId: targetUserId,
  tripId,
  payload: { actorName: user.name, tripName, newRole: ROLE_LABELS[parsed.data.role] },
});
```

DELETE ハンドラーの `logActivity(...)` の後:

```typescript
void createNotification({
  type: "member_removed",
  userId: targetUserId,
  tripId,
  payload: { actorName: user.name, tripName },
});
```

**Step 4: テストを実行**

```bash
bun run --filter @sugara/api test -- members.test.ts
```

Expected: all pass

**Step 5: コミット**

```bash
git add apps/api/src/routes/members.ts apps/api/src/__tests__/members.test.ts
git commit -m "feat: members ルートにメンバー変更通知を追加"
```

---

## Task 10: schedules.ts に通知を追加

**Files:**
- Modify: `apps/api/src/routes/schedules.ts`
- Modify: `apps/api/src/__tests__/schedules.test.ts`

**Step 1: テストに notification モックを追加**

`schedules.test.ts` の vi.mock ブロックに:

```typescript
vi.mock("../lib/notifications", () => ({
  createNotification: vi.fn().mockResolvedValue(undefined),
}));
```

**Step 2: schedules.ts に通知を追加**

インポートに追加:

```typescript
import { createNotification } from "../lib/notifications";
import { tripMembers } from "../db/schema";
```

スケジュール作成 (POST) ハンドラー内で `logActivity` の後:

```typescript
// Notify all other trip members
const members = await db.query.tripMembers.findMany({
  where: eq(tripMembers.tripId, tripId),
  columns: { userId: true },
});
const tripForNotif = await db.query.trips.findFirst({
  where: eq(trips.id, tripId),
  columns: { title: true, destination: true },
});
const tripName = tripForNotif?.title ?? tripForNotif?.destination ?? "旅行";

await Promise.all(
  members
    .filter((m) => m.userId !== user.id)
    .map((m) =>
      createNotification({
        type: "schedule_created",
        userId: m.userId,
        tripId,
        payload: { actorName: user.name, tripName, entityName: parsed.data.name },
      }),
    ),
);
```

スケジュール更新 (PATCH) と削除 (DELETE) にも同様のパターンで追加（type を変える）。

**Step 3: テストを実行**

```bash
bun run --filter @sugara/api test -- schedules.test.ts
```

Expected: all pass

**Step 4: コミット**

```bash
git add apps/api/src/routes/schedules.ts apps/api/src/__tests__/schedules.test.ts
git commit -m "feat: schedules ルートにスケジュール変更通知を追加"
```

---

## Task 11: polls.ts に通知を追加

**Files:**
- Modify: `apps/api/src/routes/polls.ts`
- Modify: `apps/api/src/__tests__/polls.test.ts`

**Step 1: vi.mock を追加**

```typescript
vi.mock("../lib/notifications", () => ({
  createNotification: vi.fn().mockResolvedValue(undefined),
}));
```

**Step 2: polls.ts に通知を追加**

投票作成時（POST）で全メンバーに `poll_started` 通知:

```typescript
// Poll 作成後、tripMembers を取得して全員に通知
const members = await db.query.tripMembers.findMany({
  where: eq(tripMembers.tripId, poll.tripId),
  columns: { userId: true },
});
await Promise.all(
  members.map((m) =>
    createNotification({
      type: "poll_started",
      userId: m.userId,
      tripId: poll.tripId,
      payload: { actorName: user.name, tripName },
    }),
  ),
);
```

投票確定時（confirm ハンドラー）で `poll_closed` 通知を同様に追加。

**Step 3: テストを実行**

```bash
bun run --filter @sugara/api test -- polls.test.ts
```

**Step 4: コミット**

```bash
git add apps/api/src/routes/polls.ts apps/api/src/__tests__/polls.test.ts
git commit -m "feat: polls ルートに投票通知を追加"
```

---

## Task 12: expenses.ts に通知を追加

**Files:**
- Modify: `apps/api/src/routes/expenses.ts`
- Modify: `apps/api/src/__tests__/expenses.test.ts`

**Step 1: vi.mock を追加**

```typescript
vi.mock("../lib/notifications", () => ({
  createNotification: vi.fn().mockResolvedValue(undefined),
}));
```

**Step 2: expenses.ts に通知を追加**

経費作成（POST）後、splits のユーザーのうち自分以外に通知:

```typescript
await Promise.all(
  parsed.data.splits
    .filter((s) => s.userId !== user.id)
    .map((s) =>
      createNotification({
        type: "expense_added",
        userId: s.userId,
        tripId,
        payload: { actorName: user.name, tripName, entityName: parsed.data.title },
      }),
    ),
);
```

**Step 3: テストを実行**

```bash
bun run --filter @sugara/api test -- expenses.test.ts
```

**Step 4: 全テストを実行**

```bash
bun run --filter @sugara/api test
```

Expected: all pass

**Step 5: コミット**

```bash
git add apps/api/src/routes/expenses.ts apps/api/src/__tests__/expenses.test.ts
git commit -m "feat: expenses ルートに経費追加通知を追加"
```

---

## Task 13: Service Worker に push ハンドラーを追加

**Files:**
- Modify: `apps/web/app/sw.ts`

**Step 1: push ハンドラーを sw.ts の末尾に追記**

`serwist.addEventListeners();` の後に追加:

```typescript
// Push notification handlers (separate from serwist)
self.addEventListener("push", (event) => {
  if (!event.data) return;
  const data = event.data.json() as { title: string; body: string; url: string };

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon-192x192.png",
      badge: "/icon-72x72.png",
      data: { url: data.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        const url = (event.notification.data as { url: string }).url;
        const existing = clientList.find((c) => c.url.includes(url));
        if (existing) return existing.focus();
        return self.clients.openWindow(url);
      }),
  );
});
```

**Step 2: 型チェック**

```bash
bun run check-types
```

Expected: エラーなし

**Step 3: コミット**

```bash
git add apps/web/app/sw.ts
git commit -m "feat: Service Worker に push 通知ハンドラーを追加"
```

---

## Task 14: Push サブスクリプション登録フック実装

**Files:**
- Create: `apps/web/lib/hooks/use-push-subscription.ts`

**Step 1: フックを実装**

```typescript
// apps/web/lib/hooks/use-push-subscription.ts
"use client";

import { useEffect } from "react";
import { api } from "../api";

async function registerPushSubscription(): Promise<void> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

  const registration = await navigator.serviceWorker.ready;
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) return;

  const existing = await registration.pushManager.getSubscription();
  if (existing) return; // Already subscribed

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return;

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  });

  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return;

  await api("/api/push-subscriptions", {
    method: "POST",
    body: JSON.stringify({
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    }),
  });
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export function usePushSubscription(isAuthenticated: boolean): void {
  useEffect(() => {
    if (!isAuthenticated) return;
    // Delay to avoid blocking initial render
    const timer = setTimeout(() => {
      void registerPushSubscription();
    }, 3000);
    return () => clearTimeout(timer);
  }, [isAuthenticated]);
}
```

**Step 2: 型チェック**

```bash
bun run check-types
```

**Step 3: コミット**

```bash
git add apps/web/lib/hooks/use-push-subscription.ts
git commit -m "feat: push サブスクリプション登録フックを実装"
```

---

## Task 15: 通知ベルアイコンとパネルを実装

**Files:**
- Create: `apps/web/components/notification-bell.tsx`
- Modify: `apps/web/components/header.tsx`

**Step 1: 通知ベルコンポーネントを作成**

```typescript
// apps/web/components/notification-bell.tsx
"use client";

import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { api } from "../lib/api";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

type Notification = {
  id: string;
  type: string;
  payload: Record<string, string>;
  readAt: string | null;
  createdAt: string;
  tripId: string | null;
};

type NotificationsResponse = {
  notifications: Notification[];
  unreadCount: number;
};

function fetcher(url: string) {
  return api<NotificationsResponse>(url);
}

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { data, mutate } = useSWR("/api/notifications", fetcher, {
    refreshInterval: 60_000,
    revalidateOnFocus: true,
  });

  const unreadCount = data?.unreadCount ?? 0;

  async function handleMarkAllRead() {
    await api("/api/notifications/read-all", { method: "PUT" });
    await mutate();
  }

  async function handleClickNotification(n: Notification) {
    if (!n.readAt) {
      await api(`/api/notifications/${n.id}/read`, { method: "PUT" });
      await mutate();
    }
    setOpen(false);
    if (n.tripId) router.push(`/trips/${n.tripId}`);
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-sm font-medium">通知</span>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              すべて既読
            </button>
          )}
        </div>
        <DropdownMenuSeparator />
        {!data?.notifications.length ? (
          <div className="px-3 py-4 text-center text-sm text-muted-foreground">
            通知はありません
          </div>
        ) : (
          data.notifications.map((n) => (
            <DropdownMenuItem
              key={n.id}
              className={`flex flex-col items-start gap-0.5 px-3 py-2 cursor-pointer ${!n.readAt ? "bg-muted/50" : ""}`}
              onClick={() => handleClickNotification(n)}
            >
              <span className="text-sm">{formatNotificationText(n)}</span>
              <span className="text-xs text-muted-foreground">
                {new Date(n.createdAt).toLocaleString("ja-JP", {
                  month: "numeric",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function formatNotificationText(n: Notification): string {
  const p = n.payload as Record<string, string>;
  switch (n.type) {
    case "member_added":
      return `${p.actorName}さんが「${p.tripName}」に招待しました`;
    case "member_removed":
      return `「${p.tripName}」のメンバーから削除されました`;
    case "role_changed":
      return `「${p.tripName}」でのロールが変更されました`;
    case "schedule_created":
      return `${p.actorName}さんが「${p.entityName}」を追加しました`;
    case "schedule_updated":
      return `${p.actorName}さんが「${p.entityName}」を更新しました`;
    case "schedule_deleted":
      return `${p.actorName}さんがスケジュールを削除しました`;
    case "poll_started":
      return `「${p.tripName}」で日程投票が開始されました`;
    case "poll_closed":
      return `「${p.tripName}」の日程投票が終了しました`;
    case "expense_added":
      return `${p.actorName}さんが経費「${p.entityName}」を追加しました`;
    default:
      return "新しい通知があります";
  }
}
```

**Step 2: header.tsx にベルアイコンを追加**

`apps/web/components/header.tsx` を読んで `ThemeToggle` の隣に `NotificationBell` を追加する。また `usePushSubscription` フックを呼び出す（認証状態を渡す）。

```typescript
import { NotificationBell } from "./notification-bell";
import { usePushSubscription } from "../lib/hooks/use-push-subscription";

// ヘッダーコンポーネント内で
usePushSubscription(!!session?.user);

// JSX に追加 (ThemeToggle の前後)
<NotificationBell />
```

**Step 3: 型チェック**

```bash
bun run check-types
```

**Step 4: コミット**

```bash
git add apps/web/components/notification-bell.tsx apps/web/components/header.tsx
git commit -m "feat: 通知ベルアイコンとドロップダウンパネルをヘッダーに追加"
```

---

## Task 16: 通知設定を settings ページに追加

**Files:**
- Create: `apps/web/components/notification-preferences-section.tsx`
- Modify: `apps/web/app/(authenticated)/settings/page.tsx`

**Step 1: 設定セクションコンポーネントを作成**

```typescript
// apps/web/components/notification-preferences-section.tsx
"use client";

import useSWR from "swr";
import { api } from "../lib/api";
import { Switch } from "./ui/switch";
import { Label } from "./ui/label";

type Pref = { type: string; inApp: boolean; push: boolean };

const TYPE_LABELS: Record<string, string> = {
  member_added: "旅行に招待された",
  member_removed: "メンバーから削除された",
  role_changed: "ロールが変更された",
  schedule_created: "スケジュールが追加された",
  schedule_updated: "スケジュールが更新された",
  schedule_deleted: "スケジュールが削除された",
  poll_started: "日程投票が開始された",
  poll_closed: "日程投票が終了した",
  expense_added: "経費が追加された",
};

function fetcher(url: string) {
  return api<Pref[]>(url);
}

export function NotificationPreferencesSection() {
  const { data, mutate } = useSWR("/api/notification-preferences", fetcher);

  async function togglePref(type: string, field: "inApp" | "push", value: boolean) {
    await api("/api/notification-preferences", {
      method: "PUT",
      body: JSON.stringify({ type, [field]: value }),
    });
    await mutate();
  }

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">通知設定</h2>
      <div className="space-y-3">
        <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-2 items-center text-sm text-muted-foreground pb-1">
          <span />
          <span>アプリ内</span>
          <span>Push</span>
        </div>
        {data?.map((pref) => (
          <div
            key={pref.type}
            className="grid grid-cols-[1fr_auto_auto] gap-x-4 items-center"
          >
            <Label>{TYPE_LABELS[pref.type] ?? pref.type}</Label>
            <Switch
              checked={pref.inApp}
              onCheckedChange={(v) => togglePref(pref.type, "inApp", v)}
            />
            <Switch
              checked={pref.push}
              onCheckedChange={(v) => togglePref(pref.type, "push", v)}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
```

**Step 2: settings/page.tsx に追加**

`apps/web/app/(authenticated)/settings/page.tsx` を読み、`DeleteAccountSection` の前に追加:

```typescript
import { NotificationPreferencesSection } from "../../../../components/notification-preferences-section";

// JSX 内に追加
<NotificationPreferencesSection />
```

**Step 3: 型チェック + lint**

```bash
bun run check-types
bun run check
```

Expected: エラーなし（warning があれば確認）

**Step 4: 全テストを実行**

```bash
bun run test
```

Expected: all pass

**Step 5: コミット**

```bash
git add apps/web/components/notification-preferences-section.tsx apps/web/app/(authenticated)/settings/page.tsx
git commit -m "feat: 設定ページに通知設定セクションを追加"
```

---

## 完了後の確認

1. Vercel に以下の環境変数を追加する（管理ダッシュボードから）:
   - `VAPID_PUBLIC_KEY`
   - `VAPID_PRIVATE_KEY`
   - `VAPID_SUBJECT`
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY`

2. 本番 DB にマイグレーションを適用:
   ```bash
   MIGRATION_URL=<本番TransactionPoolerURL> bun run db:migrate
   ```

3. ブラウザで動作確認:
   - ログイン後にベルアイコンが表示される
   - 設定ページに「通知設定」セクションが表示される
   - 別ブラウザでメンバー追加 → ベルの未読数が増加する
   - push 通知の許可を与え → OS ネイティブ通知が届く
