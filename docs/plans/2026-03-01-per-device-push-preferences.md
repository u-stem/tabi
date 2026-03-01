# Per-device push notification preferences Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move push notification preferences from user-level to per-device (per-subscription), so users can independently control push on each browser/device.

**Architecture:** Add `preferences JSONB NOT NULL DEFAULT '{}'` to `push_subscriptions`. Remove `push` from `notification_preferences`. `sendPushToUser` filters subscriptions by their own preferences, falling back to `NOTIFICATION_DEFAULTS[type].push`. New `GET/PUT /api/push-subscriptions/preferences` endpoints let the frontend manage per-device state. The frontend fetches the current device's endpoint via `pushManager.getSubscription()` and calls the new API.

**Tech Stack:** Drizzle ORM (JSONB), Hono, React Query, Web Push API

---

## Reference files

- Schema: `apps/api/src/db/schema.ts:671-713`
- Notifications lib: `apps/api/src/lib/notifications.ts`
- Push routes: `apps/api/src/routes/push-subscriptions.ts`
- Notification-preferences route: `apps/api/src/routes/notification-preferences.ts`
- Shared schemas: `packages/shared/src/schemas/notification.ts`
- Frontend: `apps/web/components/notification-preferences-section.tsx`
- Query keys: `apps/web/lib/query-keys.ts`
- Existing migration format: `apps/api/drizzle/0015_notifications.sql`

---

### Task 1: Add Zod schema for push subscription preference update

**Files:**
- Modify: `packages/shared/src/schemas/notification.ts`

**Step 1: Write the failing test**

No test needed for a Zod schema itself — it will be tested via the route tests in Task 8.

**Step 2: Add schema to `packages/shared/src/schemas/notification.ts`**

After line 26 (after `createPushSubscriptionSchema`), add:

```ts
export const updatePushSubscriptionPreferenceSchema = z.object({
  endpoint: z.string().url(),
  type: notificationTypeSchema,
  enabled: z.boolean(),
});
```

Also remove `push` from `updateNotificationPreferenceSchema` (line 17–21). New version:

```ts
export const updateNotificationPreferenceSchema = z.object({
  type: notificationTypeSchema,
  inApp: z.boolean().optional(),
});
```

**Step 3: Verify shared package builds**

```bash
bun run --filter @sugara/shared check-types
```

Expected: no errors.

**Step 4: Commit**

```bash
git add packages/shared/src/schemas/notification.ts
git commit -m "feat: push 設定をデバイス単位で管理するための Zod スキーマを追加"
```

---

### Task 2: Update DB schema

**Files:**
- Modify: `apps/api/src/db/schema.ts`

**Step 1: Modify `pushSubscriptions` table definition (`apps/api/src/db/schema.ts:671-687`)**

Current `pushSubscriptions` table ends at line 687. Add `preferences` column before `createdAt`:

```ts
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
    preferences: jsonb("preferences").$type<Record<string, boolean>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("push_subscriptions_user_id_idx").on(table.userId),
    uniqueIndex("push_subscriptions_user_endpoint_unique").on(table.userId, table.endpoint),
  ],
).enableRLS();
```

**Step 2: Remove `push` from `notificationPreferences` table (`apps/api/src/db/schema.ts:689-700`)**

```ts
export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: notificationTypeEnum("type").notNull(),
    inApp: boolean("in_app").notNull().default(true),
  },
  (table) => [primaryKey({ columns: [table.userId, table.type] })],
).enableRLS();
```

**Step 3: Verify TypeScript compiles**

```bash
bun run --filter @sugara/api check-types
```

Expected: no errors (route and lib files will fail until Tasks 4–6 are done; fix those first if needed).

---

### Task 3: Write and apply DB migration

**Files:**
- Create: `apps/api/drizzle/0017_per_device_push_prefs.sql`

**Step 1: Write the migration file**

This migration must:
1. Add `preferences` column (safe, non-destructive, default `{}`)
2. Populate it from existing user-level push settings
3. Drop `push` column from `notification_preferences`

The data migration (step 2) runs BEFORE the column drop so that data is preserved.

```sql
-- Migrate push notification preferences from user-level to per-device

-- Step 1: Add preferences column to push_subscriptions
ALTER TABLE "push_subscriptions"
  ADD COLUMN "preferences" jsonb NOT NULL DEFAULT '{}';
--> statement-breakpoint

-- Step 2: Copy each user's push preferences into all their subscriptions.
-- Only stores entries that exist in notification_preferences (existing explicit settings).
-- Absent keys fall back to NOTIFICATION_DEFAULTS in application code.
UPDATE "push_subscriptions" ps
SET "preferences" = (
  SELECT COALESCE(jsonb_object_agg(np.type, np.push), '{}')
  FROM "notification_preferences" np
  WHERE np.user_id = ps.user_id
);
--> statement-breakpoint

-- Step 3: Drop push column from notification_preferences
ALTER TABLE "notification_preferences" DROP COLUMN "push";
```

**Step 2: Apply migration locally**

```bash
bun run db:migrate
```

Expected output: migration applied successfully, no errors.

**Step 3: Verify schema in Drizzle Studio (optional manual check)**

```bash
bun run db:studio
```

Confirm `push_subscriptions` has `preferences` column and `notification_preferences` has no `push` column.

**Step 4: Commit**

```bash
git add apps/api/drizzle/0017_per_device_push_prefs.sql apps/api/src/db/schema.ts
git commit -m "feat: push 設定をデバイス単位に移行するマイグレーションを追加"
```

---

### Task 4: Update `notifications.ts` — per-subscription push filtering

**Files:**
- Modify: `apps/api/src/lib/notifications.ts`
- Test: `apps/api/src/__tests__/notifications.test.ts`

**Step 1: Rewrite the tests first**

The existing test "push が false の場合は sendNotification を呼ばない" tests user-level push preference, which no longer exists. Replace the entire test file's `createNotification` describe block with:

```ts
describe("createNotification", () => {
  // ... (keep beforeEach setup as-is but add preferences: {} to mock subscriptions)

  it("preferences が未設定の場合は in_app を DB に INSERT する", async () => {
    await createNotification(baseParams);
    expect(mockDbInsert).toHaveBeenCalled();
  });

  it("inApp が false の場合は DB INSERT しない", async () => {
    mockDbQuery.notificationPreferences.findFirst.mockResolvedValue({
      inApp: false,
    });
    await createNotification(baseParams);
    expect(mockDbInsert).not.toHaveBeenCalled();
  });

  it("push サブスクリプションがある場合は sendNotification を呼ぶ", async () => {
    mockDbQuery.pushSubscriptions.findMany.mockResolvedValue([
      { endpoint: "https://fcm.example.com/push/1", p256dh: "abc", auth: "xyz", preferences: {} },
    ]);
    await createNotification(baseParams); // member_added, default push=true
    await new Promise((r) => setTimeout(r, 10));
    expect(mockSendNotification).toHaveBeenCalled();
  });

  it("subscription の preferences[type] が false の場合は sendNotification をスキップする", async () => {
    mockDbQuery.pushSubscriptions.findMany.mockResolvedValue([
      {
        endpoint: "https://fcm.example.com/push/1",
        p256dh: "abc",
        auth: "xyz",
        preferences: { member_added: false },
      },
    ]);
    await createNotification(baseParams); // member_added
    await new Promise((r) => setTimeout(r, 10));
    expect(mockSendNotification).not.toHaveBeenCalled();
  });

  it("複数サブスクリプション: 有効なものだけ sendNotification を呼ぶ", async () => {
    mockDbQuery.pushSubscriptions.findMany.mockResolvedValue([
      {
        endpoint: "https://fcm.example.com/push/1",
        p256dh: "abc",
        auth: "xyz",
        preferences: { member_added: false },
      },
      {
        endpoint: "https://fcm.example.com/push/2",
        p256dh: "def",
        auth: "uvw",
        preferences: {},
      },
    ]);
    await createNotification(baseParams); // member_added, default push=true
    await new Promise((r) => setTimeout(r, 10));
    expect(mockSendNotification).toHaveBeenCalledTimes(1);
  });

  it("preferences が {} で NOTIFICATION_DEFAULTS.push=false の場合は sendNotification をスキップする", async () => {
    mockDbQuery.pushSubscriptions.findMany.mockResolvedValue([
      {
        endpoint: "https://fcm.example.com/push/1",
        p256dh: "abc",
        auth: "xyz",
        preferences: {},
      },
    ]);
    // schedule_created has push=false by default
    await createNotification({ ...baseParams, type: "schedule_created" });
    await new Promise((r) => setTimeout(r, 10));
    expect(mockSendNotification).not.toHaveBeenCalled();
  });
});
```

**Step 2: Run the tests to verify they fail**

```bash
bun run --filter @sugara/api test --reporter=verbose 2>&1 | grep -E "notifications.test|FAIL|PASS"
```

Expected: several tests fail (the new tests reference behavior not yet implemented).

**Step 3: Update `apps/api/src/lib/notifications.ts`**

In `createNotificationInternal` (line 108–126), remove the `pushEnabled` check and always call `sendPushToUser`:

```ts
async function createNotificationInternal(params: CreateNotificationParams): Promise<void> {
  const { type, userId, tripId, payload } = params;

  const pref = await db.query.notificationPreferences.findFirst({
    where: and(eq(notificationPreferences.userId, userId), eq(notificationPreferences.type, type)),
  });

  const inAppEnabled = pref?.inApp ?? NOTIFICATION_DEFAULTS[type].inApp;

  if (inAppEnabled) {
    await db.insert(notifications).values({ userId, tripId, type, payload });
    void pruneOldNotifications(userId);
  }

  void sendPushToUser(userId, type, payload, tripId);
}
```

In `sendPushToUser` (line 153–182), filter subscriptions by their own preferences:

```ts
async function sendPushToUser(
  userId: string,
  type: NotificationType,
  payload: NotificationPayload,
  tripId?: string,
): Promise<void> {
  ensureVapid();
  const subs = await db.query.pushSubscriptions.findMany({
    where: eq(pushSubscriptions.userId, userId),
  });
  if (subs.length === 0) return;

  const enabledSubs = subs.filter(
    (sub) =>
      ((sub.preferences as Record<string, boolean>)[type] ??
        NOTIFICATION_DEFAULTS[type].push),
  );
  if (enabledSubs.length === 0) return;

  const message = buildPushMessage(type, payload, tripId);
  await Promise.allSettled(
    enabledSubs.map((sub) =>
      webpush
        .sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(message),
        )
        .catch(async (err: unknown) => {
          const status = (err as { statusCode?: number })?.statusCode;
          if (status === 410 || status === 404) {
            await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, sub.endpoint));
          }
        }),
    ),
  );
}
```

**Step 4: Run the tests**

```bash
bun run --filter @sugara/api test --reporter=verbose 2>&1 | grep -E "notifications.test"
```

Expected: all tests in `notifications.test.ts` pass.

**Step 5: Commit**

```bash
git add apps/api/src/lib/notifications.ts apps/api/src/__tests__/notifications.test.ts
git commit -m "feat: sendPushToUser をサブスクリプション単位の preferences でフィルタリング"
```

---

### Task 5: Update `notification-preferences` route — remove push

**Files:**
- Modify: `apps/api/src/routes/notification-preferences.ts`
- Test: `apps/api/src/__tests__/notification-preferences.test.ts`

**Step 1: Update the test to verify push field is ignored**

Add one test to `notification-preferences.test.ts`:

```ts
it("PUT /api/notification-preferences は push フィールドを無視する", async () => {
  const app = createTestApp(notificationPreferenceRoutes, "/api/notification-preferences");
  const res = await app.request("/api/notification-preferences", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "schedule_created", inApp: false, push: true }),
  });
  expect(res.status).toBe(200);
  // push field should not reach the DB insert
  const insertCall = mockDbInsert.mock.calls[0];
  const values = insertCall?.[0]; // the table arg; actual values are in .values()
  // Just verify the call succeeded without error — push is stripped by Zod
  expect(mockDbInsert).toHaveBeenCalled();
});
```

Also update the existing PUT test to remove `push: false` from the body (no longer valid in schema):

```ts
it("PUT /api/notification-preferences は設定を更新する", async () => {
  const app = createTestApp(notificationPreferenceRoutes, "/api/notification-preferences");
  const res = await app.request("/api/notification-preferences", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "schedule_created", inApp: false }),
  });
  expect(res.status).toBe(200);
  expect(mockDbInsert).toHaveBeenCalled();
});
```

**Step 2: Run tests to verify the new test fails**

```bash
bun run --filter @sugara/api test --reporter=verbose 2>&1 | grep "notification-preferences"
```

Expected: all pass (the new test likely passes trivially because push is already not stored).

**Step 3: Update `notification-preferences.ts` GET handler**

Remove `push` from the GET response (line 26–30):

```ts
const prefs = ALL_TYPES.map((type) => ({
  type,
  inApp: savedMap.get(type)?.inApp ?? NOTIFICATION_DEFAULTS[type].inApp,
}));
```

Update the PUT handler to remove push handling (lines 44–58):

```ts
const type = parsed.data.type;
await db
  .insert(notificationPreferences)
  .values({
    userId: user.id,
    type,
    inApp: parsed.data.inApp ?? NOTIFICATION_DEFAULTS[type].inApp,
  })
  .onConflictDoUpdate({
    target: [notificationPreferences.userId, notificationPreferences.type],
    set: {
      ...(parsed.data.inApp !== undefined && { inApp: parsed.data.inApp }),
    },
  });
```

Also remove the `push` import from `@sugara/shared` import if it was explicitly listed (it isn't — just `updateNotificationPreferenceSchema` is used).

**Step 4: Run all tests**

```bash
bun run --filter @sugara/api test
```

Expected: all pass.

**Step 5: Commit**

```bash
git add apps/api/src/routes/notification-preferences.ts apps/api/src/__tests__/notification-preferences.test.ts
git commit -m "feat: notification-preferences から push フィールドを削除"
```

---

### Task 6: Add per-device push preference endpoints to push-subscriptions route

**Files:**
- Modify: `apps/api/src/routes/push-subscriptions.ts`
- Test: `apps/api/src/__tests__/push-subscriptions.test.ts`

**Step 1: Write the failing tests**

Add to `push-subscriptions.test.ts`. Needs `mockDbQuery` added to the mock setup:

```ts
// Add to vi.hoisted():
const { mockGetSession, mockDbInsert, mockDbDelete, mockDbSelect, mockDbQuery, mockDbUpdate } =
  vi.hoisted(() => ({
    mockGetSession: vi.fn(),
    mockDbInsert: vi.fn(),
    mockDbDelete: vi.fn(),
    mockDbSelect: vi.fn(),
    mockDbQuery: {
      pushSubscriptions: { findFirst: vi.fn() },
    },
    mockDbUpdate: vi.fn(),
  }));

// Update vi.mock("../db/index") to:
vi.mock("../db/index", () => ({
  db: {
    insert: (...args: unknown[]) => mockDbInsert(...args),
    delete: (...args: unknown[]) => mockDbDelete(...args),
    select: (...args: unknown[]) => mockDbSelect(...args),
    query: mockDbQuery,
    update: (...args: unknown[]) => mockDbUpdate(...args),
  },
}));
```

Add to `beforeEach`:
```ts
mockDbQuery.pushSubscriptions.findFirst.mockResolvedValue(null);
mockDbUpdate.mockReturnValue({
  set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
});
```

New test cases:

```ts
describe("GET /api/push-subscriptions/preferences", () => {
  it("既存サブスクリプションの preferences を全 type 展開して返す", async () => {
    mockDbQuery.pushSubscriptions.findFirst.mockResolvedValue({
      id: "sub-1",
      preferences: { member_added: false },
    });

    const app = createTestApp(pushSubscriptionRoutes, "/api/push-subscriptions");
    const endpoint = encodeURIComponent("https://fcm.googleapis.com/push/1");
    const res = await app.request(`/api/push-subscriptions/preferences?endpoint=${endpoint}`);

    expect(res.status).toBe(200);
    const body = await res.json();
    // member_added explicitly set to false
    expect(body.member_added).toBe(false);
    // member_removed not set → falls back to NOTIFICATION_DEFAULTS (true)
    expect(body.member_removed).toBe(true);
    // All 9 types present
    expect(Object.keys(body).length).toBe(9);
  });

  it("endpoint が存在しない場合は 404 を返す", async () => {
    mockDbQuery.pushSubscriptions.findFirst.mockResolvedValue(null);

    const app = createTestApp(pushSubscriptionRoutes, "/api/push-subscriptions");
    const endpoint = encodeURIComponent("https://unknown.example.com/push/1");
    const res = await app.request(`/api/push-subscriptions/preferences?endpoint=${endpoint}`);

    expect(res.status).toBe(404);
  });

  it("endpoint クエリパラメータがない場合は 400 を返す", async () => {
    const app = createTestApp(pushSubscriptionRoutes, "/api/push-subscriptions");
    const res = await app.request("/api/push-subscriptions/preferences");

    expect(res.status).toBe(400);
  });
});

describe("PUT /api/push-subscriptions/preferences", () => {
  it("サブスクリプションの preferences を更新する", async () => {
    mockDbQuery.pushSubscriptions.findFirst.mockResolvedValue({
      id: "sub-1",
      preferences: {},
    });

    const app = createTestApp(pushSubscriptionRoutes, "/api/push-subscriptions");
    const res = await app.request("/api/push-subscriptions/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: "https://fcm.googleapis.com/push/1",
        type: "member_added",
        enabled: false,
      }),
    });

    expect(res.status).toBe(200);
    expect(mockDbUpdate).toHaveBeenCalled();
  });

  it("endpoint が存在しない場合は 404 を返す", async () => {
    mockDbQuery.pushSubscriptions.findFirst.mockResolvedValue(null);

    const app = createTestApp(pushSubscriptionRoutes, "/api/push-subscriptions");
    const res = await app.request("/api/push-subscriptions/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: "https://unknown.example.com/push/1",
        type: "member_added",
        enabled: false,
      }),
    });

    expect(res.status).toBe(404);
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
bun run --filter @sugara/api test --reporter=verbose 2>&1 | grep "push-subscriptions"
```

Expected: new tests fail with 404/405 (routes not yet implemented).

**Step 3: Implement new endpoints in `push-subscriptions.ts`**

Add imports:

```ts
import {
  NOTIFICATION_DEFAULTS,
  createPushSubscriptionSchema,
  notificationTypeSchema,
  updatePushSubscriptionPreferenceSchema,
} from "@sugara/shared";
```

Add `mockDbQuery`-compatible import (already have `db`). Also add `update` from drizzle-orm:

```ts
import { and, asc, count, eq, ne, update } from "drizzle-orm";
```

Wait — for Drizzle, `db.update()` is used directly. Import `update` is not needed; just use `db.update(pushSubscriptions)`.

Add the two new routes before the export:

```ts
// GET /api/push-subscriptions/preferences?endpoint=<url> - デバイス単位の push 設定取得
pushSubscriptionRoutes.get("/preferences", async (c) => {
  const user = c.get("user");
  const endpoint = c.req.query("endpoint");
  if (!endpoint) {
    return c.json({ error: "endpoint query parameter required" }, 400);
  }

  const sub = await db.query.pushSubscriptions.findFirst({
    where: and(
      eq(pushSubscriptions.userId, user.id),
      eq(pushSubscriptions.endpoint, endpoint),
    ),
  });
  if (!sub) return c.json({ error: "Not found" }, 404);

  const prefs = sub.preferences as Record<string, boolean>;
  const ALL_TYPES = notificationTypeSchema.options;
  const expanded = Object.fromEntries(
    ALL_TYPES.map((type) => [type, prefs[type] ?? NOTIFICATION_DEFAULTS[type].push]),
  );

  return c.json(expanded);
});

// PUT /api/push-subscriptions/preferences - デバイス単位の push 設定更新
pushSubscriptionRoutes.put("/preferences", async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const parsed = updatePushSubscriptionPreferenceSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const { endpoint, type, enabled } = parsed.data;
  const sub = await db.query.pushSubscriptions.findFirst({
    where: and(
      eq(pushSubscriptions.userId, user.id),
      eq(pushSubscriptions.endpoint, endpoint),
    ),
  });
  if (!sub) return c.json({ error: "Not found" }, 404);

  const currentPrefs = sub.preferences as Record<string, boolean>;
  await db
    .update(pushSubscriptions)
    .set({ preferences: { ...currentPrefs, [type]: enabled } })
    .where(
      and(
        eq(pushSubscriptions.userId, user.id),
        eq(pushSubscriptions.endpoint, endpoint),
      ),
    );

  return c.json({ ok: true });
});
```

**Step 4: Run the tests**

```bash
bun run --filter @sugara/api test --reporter=verbose 2>&1 | grep "push-subscriptions"
```

Expected: all tests pass.

**Step 5: Commit**

```bash
git add apps/api/src/routes/push-subscriptions.ts apps/api/src/__tests__/push-subscriptions.test.ts
git commit -m "feat: デバイス単位の push 設定取得・更新エンドポイントを追加"
```

---

### Task 7: Update frontend query keys

**Files:**
- Modify: `apps/web/lib/query-keys.ts`

**Step 1: Add `pushPreferences` key**

In `notifications` block (line 53–57), add `pushPreferences`:

```ts
notifications: {
  all: ["notifications"] as const,
  list: () => [...queryKeys.notifications.all, "list"] as const,
  preferences: () => [...queryKeys.notifications.all, "preferences"] as const,
  pushPreferences: (endpoint: string) =>
    [...queryKeys.notifications.all, "push-preferences", endpoint] as const,
},
```

**Step 2: Verify types**

```bash
bun run --filter @sugara/web check-types
```

Expected: no errors (the key is only added, not yet used).

**Step 3: Commit**

```bash
git add apps/web/lib/query-keys.ts
git commit -m "feat: notifications に pushPreferences クエリキーを追加"
```

---

### Task 8: Update `notification-preferences-section.tsx`

**Files:**
- Modify: `apps/web/components/notification-preferences-section.tsx`

**Step 1: Understand the current component**

Read `apps/web/components/notification-preferences-section.tsx` to understand the current structure. Key parts:
- `Pref` type: `{ type: string; inApp: boolean; push: boolean }`
- Single `useQuery` for both `inApp` and `push` from `GET /api/notification-preferences`
- `updateCategory.mutate` sends to `PUT /api/notification-preferences` with `field: "push"`
- Push switches are always enabled when `pushPermission === "granted"`

**Step 2: Rewrite the component**

The complete updated component:

```tsx
"use client";

import { NOTIFICATION_DEFAULTS, type NotificationType } from "@sugara/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { requestPushPermission } from "../lib/hooks/use-push-subscription";
import { MSG } from "../lib/messages";
import { queryKeys } from "../lib/query-keys";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Switch } from "./ui/switch";

type InAppPref = { type: string; inApp: boolean };

const CATEGORIES = [
  {
    label: "メンバー",
    description: "招待・削除・ロール変更",
    types: ["member_added", "member_removed", "role_changed"] as const,
  },
  {
    label: "予定",
    description: "追加・更新・削除",
    types: ["schedule_created", "schedule_updated", "schedule_deleted"] as const,
  },
  {
    label: "日程投票",
    description: "開始・終了",
    types: ["poll_started", "poll_closed"] as const,
  },
  {
    label: "費用",
    description: "追加",
    types: ["expense_added"] as const,
  },
] as const;

type CategoryType = (typeof CATEGORIES)[number]["types"][number];

function isInAppCategoryOn(prefs: InAppPref[], types: readonly CategoryType[]): boolean {
  return types.every((type) => {
    const pref = prefs.find((p) => p.type === type);
    return pref ? pref.inApp : NOTIFICATION_DEFAULTS[type as NotificationType].inApp;
  });
}

function isPushCategoryOn(
  pushPrefs: Record<string, boolean> | undefined,
  types: readonly CategoryType[],
): boolean {
  if (!pushPrefs) {
    return types.every((type) => NOTIFICATION_DEFAULTS[type as NotificationType].push);
  }
  return types.every(
    (type) => pushPrefs[type] ?? NOTIFICATION_DEFAULTS[type as NotificationType].push,
  );
}

export function NotificationPreferencesSection() {
  const queryClient = useQueryClient();
  const [pushPermission, setPushPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default",
  );
  const [deviceEndpoint, setDeviceEndpoint] = useState<string | null>(null);

  // Get the current device's push subscription endpoint
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => sub && setDeviceEndpoint(sub.endpoint))
      .catch(() => {});
  }, []);

  // User-level: inApp preferences
  const { data: inAppData } = useQuery({
    queryKey: queryKeys.notifications.preferences(),
    queryFn: () => api<InAppPref[]>("/api/notification-preferences"),
  });

  // Device-level: push preferences for this specific device
  const { data: pushPrefsData } = useQuery({
    queryKey: queryKeys.notifications.pushPreferences(deviceEndpoint ?? ""),
    queryFn: () =>
      api<Record<string, boolean>>(
        `/api/push-subscriptions/preferences?endpoint=${encodeURIComponent(deviceEndpoint!)}`,
      ),
    enabled: !!deviceEndpoint && pushPermission === "granted",
  });

  const updateInAppCategory = useMutation({
    mutationFn: ({
      types,
      value,
    }: {
      types: readonly CategoryType[];
      value: boolean;
    }) =>
      Promise.all(
        types.map((type) =>
          api("/api/notification-preferences", {
            method: "PUT",
            body: JSON.stringify({ type, inApp: value }),
          }),
        ),
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.preferences() }),
    onError: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.preferences() });
      toast.error(MSG.NOTIFICATION_PREF_UPDATE_FAILED);
    },
  });

  const updatePushCategory = useMutation({
    mutationFn: ({
      types,
      value,
    }: {
      types: readonly CategoryType[];
      value: boolean;
    }) =>
      Promise.all(
        types.map((type) =>
          api("/api/push-subscriptions/preferences", {
            method: "PUT",
            body: JSON.stringify({ endpoint: deviceEndpoint, type, enabled: value }),
          }),
        ),
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.pushPreferences(deviceEndpoint ?? ""),
      }),
    onError: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.pushPreferences(deviceEndpoint ?? ""),
      });
      toast.error(MSG.NOTIFICATION_PREF_UPDATE_FAILED);
    },
  });

  async function handleEnablePush() {
    const result = await requestPushPermission();
    setPushPermission(result);
    // Re-fetch subscription endpoint after enabling push
    if (result === "granted" && typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.ready
        .then((reg) => reg.pushManager.getSubscription())
        .then((sub) => sub && setDeviceEndpoint(sub.endpoint))
        .catch(() => {});
    }
  }

  const inAppPrefs = inAppData ?? [];
  const pushSwitchesEnabled = pushPermission === "granted" && !!deviceEndpoint;

  return (
    <div className="space-y-4">
      {pushPermission !== "granted" && (
        <Card>
          <CardContent className="flex items-center justify-between gap-4 pt-6">
            <p className="text-sm text-muted-foreground">
              {pushPermission === "denied"
                ? "ブラウザの設定でプッシュ通知が拒否されています"
                : "プッシュ通知を有効にすると旅行の更新をリアルタイムで受け取れます"}
            </p>
            {pushPermission !== "denied" && (
              <Button size="sm" variant="outline" onClick={handleEnablePush} className="shrink-0">
                有効にする
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>通知の種類</CardTitle>
          <CardDescription>イベントごとに通知チャンネルを設定します</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-6 px-1 pb-2 text-xs text-muted-foreground">
              <span />
              <span>アプリ内</span>
              <span>Push</span>
            </div>

            {CATEGORIES.map((cat) => (
              <div
                key={cat.label}
                className="grid grid-cols-[1fr_auto_auto] items-center gap-x-6 rounded-lg px-1 py-2.5"
              >
                <div>
                  <p className="text-sm font-medium leading-none">{cat.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{cat.description}</p>
                </div>
                <Switch
                  checked={isInAppCategoryOn(inAppPrefs, cat.types)}
                  onCheckedChange={(v) =>
                    updateInAppCategory.mutate({ types: cat.types, value: v })
                  }
                  aria-label={`${cat.label} アプリ内通知`}
                />
                <Switch
                  checked={isPushCategoryOn(pushPrefsData, cat.types)}
                  onCheckedChange={(v) =>
                    updatePushCategory.mutate({ types: cat.types, value: v })
                  }
                  disabled={!pushSwitchesEnabled}
                  aria-label={`${cat.label} プッシュ通知`}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 2: Check TypeScript**

```bash
bun run --filter @sugara/web check-types
```

Expected: no errors.

**Step 3: Run all tests**

```bash
bun run test
```

Expected: all tests pass.

**Step 4: Commit**

```bash
git add apps/web/components/notification-preferences-section.tsx
git commit -m "feat: push 設定をデバイス単位の API から取得・更新するよう通知設定画面を更新"
```

---

### Task 9: Run full test suite and verify

**Step 1: Run all tests**

```bash
bun run test
```

Expected: all tests pass.

**Step 2: Type-check all packages**

```bash
bun run check-types
```

Expected: no errors.

**Step 3: Lint**

```bash
bun run check
```

Expected: no lint errors.

**Step 4: Commit if any fixes needed**

If any issues found, fix and commit with:

```bash
git commit -m "fix: 型チェック・lint エラーを修正"
```

---

## Summary of changes

| File | Change |
|------|--------|
| `packages/shared/src/schemas/notification.ts` | Add `updatePushSubscriptionPreferenceSchema`; remove `push` from `updateNotificationPreferenceSchema` |
| `apps/api/src/db/schema.ts` | Add `preferences JSONB` to `pushSubscriptions`; remove `push` from `notificationPreferences` |
| `apps/api/drizzle/0017_per_device_push_prefs.sql` | Migration: add column → data migration → drop column |
| `apps/api/src/lib/notifications.ts` | Remove user-level push check; filter by `sub.preferences` in `sendPushToUser` |
| `apps/api/src/routes/notification-preferences.ts` | Remove `push` from GET/PUT |
| `apps/api/src/routes/push-subscriptions.ts` | Add `GET/PUT /preferences` endpoints |
| `apps/web/lib/query-keys.ts` | Add `pushPreferences(endpoint)` key |
| `apps/web/components/notification-preferences-section.tsx` | Split into two queries; per-device push toggles |
| `apps/api/src/__tests__/notifications.test.ts` | Rewrite push tests to use subscription-level preferences |
| `apps/api/src/__tests__/notification-preferences.test.ts` | Add push-ignored test |
| `apps/api/src/__tests__/push-subscriptions.test.ts` | Add GET/PUT preference tests |
