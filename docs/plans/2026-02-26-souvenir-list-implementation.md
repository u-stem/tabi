# Souvenir List Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 旅行単位・個人管理のお土産ウィッシュリスト機能を追加する。各メンバーが「買いたいもの」を記録し、チェックオフで管理できる。

**Architecture:** 費用管理（expense）と同じパターンで実装する。`souvenirItems` テーブルを追加し、`user_id` で個人管理。他メンバーのリストは見えない。スケジュールへの依存なし。

**Tech Stack:** Drizzle ORM, Hono, Zod, React Query, shadcn/ui (ResponsiveDialog)

---

## Task 1: DB Schema — souvenir_items テーブル追加

**Files:**
- Modify: `apps/api/src/db/schema.ts`

**Step 1: souvenirItems テーブルとリレーションを追加**

`apps/api/src/db/schema.ts` のファイル末尾（expenseSplitsRelations の後）に追加する。

まず import 確認 — `pgTable`, `uuid`, `varchar`, `text`, `boolean`, `timestamp`, `index` はすでに import 済みであること（expenses テーブルで使用済み）。

追加するコード（expenseSplits の定義ブロックの直後に挿入）:

```typescript
export const souvenirItems = pgTable(
  "souvenir_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 200 }).notNull(),
    recipient: varchar("recipient", { length: 100 }),
    url: varchar("url", { length: 2000 }),
    address: varchar("address", { length: 500 }),
    memo: text("memo"),
    isPurchased: boolean("is_purchased").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("souvenir_items_trip_id_idx").on(table.tripId),
    index("souvenir_items_user_id_idx").on(table.userId),
  ],
).enableRLS();

export const souvenirItemsRelations = relations(souvenirItems, ({ one }) => ({
  trip: one(trips, { fields: [souvenirItems.tripId], references: [trips.id] }),
  user: one(users, { fields: [souvenirItems.userId], references: [users.id] }),
}));
```

**Step 2: マイグレーション生成・適用**

```bash
bun run db:generate
bun run db:migrate
```

Expected: `souvenir_items` テーブルが作成され、`drizzle/` に新しい .sql ファイルが生成される。

**Step 3: 型チェック確認**

```bash
bun run --filter @sugara/api check-types
```

Expected: エラーなし

**Step 4: Commit**

```bash
git add apps/api/src/db/schema.ts drizzle/
git commit -m "feat: souvenir_items テーブルを追加"
```

---

## Task 2: Shared Schema — Zod スキーマと上限定数

**Files:**
- Create: `packages/shared/src/schemas/souvenir.ts`
- Modify: `packages/shared/src/schemas/index.ts`
- Modify: `packages/shared/src/limits.ts`

**Step 1: 失敗するテストを書く**

`packages/shared/src/__tests__/souvenir-schema.test.ts` を作成:

```typescript
import { describe, expect, it } from "vitest";
import { createSouvenirSchema, updateSouvenirSchema } from "../schemas/souvenir";

describe("createSouvenirSchema", () => {
  it("accepts valid input with name only", () => {
    const result = createSouvenirSchema.safeParse({ name: "Tokyo banana" });
    expect(result.success).toBe(true);
  });

  it("accepts all optional fields", () => {
    const result = createSouvenirSchema.safeParse({
      name: "Tokyo banana",
      recipient: "Mom",
      url: "https://example.com",
      address: "Shibuya, Tokyo",
      memo: "Get the matcha flavor",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = createSouvenirSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects name over 200 chars", () => {
    const result = createSouvenirSchema.safeParse({ name: "a".repeat(201) });
    expect(result.success).toBe(false);
  });
});

describe("updateSouvenirSchema", () => {
  it("accepts partial update with isPurchased only", () => {
    const result = updateSouvenirSchema.safeParse({ isPurchased: true });
    expect(result.success).toBe(true);
  });

  it("accepts name update", () => {
    const result = updateSouvenirSchema.safeParse({ name: "New name" });
    expect(result.success).toBe(true);
  });

  it("rejects empty object", () => {
    const result = updateSouvenirSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects empty name", () => {
    const result = updateSouvenirSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });
});
```

**Step 2: テストが失敗することを確認**

```bash
bun run --filter @sugara/shared test
```

Expected: FAIL — `Cannot find module '../schemas/souvenir'`

**Step 3: Zod スキーマを実装**

`packages/shared/src/schemas/souvenir.ts` を作成:

```typescript
import { z } from "zod";

export const SOUVENIR_NAME_MAX_LENGTH = 200;
export const SOUVENIR_RECIPIENT_MAX_LENGTH = 100;
export const SOUVENIR_URL_MAX_LENGTH = 2000;
export const SOUVENIR_ADDRESS_MAX_LENGTH = 500;

export const createSouvenirSchema = z.object({
  name: z.string().min(1).max(SOUVENIR_NAME_MAX_LENGTH),
  recipient: z.string().max(SOUVENIR_RECIPIENT_MAX_LENGTH).optional(),
  url: z.string().max(SOUVENIR_URL_MAX_LENGTH).optional(),
  address: z.string().max(SOUVENIR_ADDRESS_MAX_LENGTH).optional(),
  memo: z.string().optional(),
});

export const updateSouvenirSchema = z
  .object({
    name: z.string().min(1).max(SOUVENIR_NAME_MAX_LENGTH),
    recipient: z.string().max(SOUVENIR_RECIPIENT_MAX_LENGTH).nullable(),
    url: z.string().max(SOUVENIR_URL_MAX_LENGTH).nullable(),
    address: z.string().max(SOUVENIR_ADDRESS_MAX_LENGTH).nullable(),
    memo: z.string().nullable(),
    isPurchased: z.boolean(),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export type CreateSouvenirInput = z.infer<typeof createSouvenirSchema>;
export type UpdateSouvenirInput = z.infer<typeof updateSouvenirSchema>;
```

**Step 4: index.ts と limits.ts を更新**

`packages/shared/src/schemas/index.ts` に追加:
```typescript
export * from "./souvenir";
```

`packages/shared/src/limits.ts` に追加:
```typescript
export const MAX_SOUVENIRS_PER_USER_PER_TRIP = 100;
```

**Step 5: テストが通ることを確認**

```bash
bun run --filter @sugara/shared test
```

Expected: PASS (souvenir-schema の全テスト)

**Step 6: Commit**

```bash
git add packages/shared/src/schemas/souvenir.ts packages/shared/src/schemas/index.ts packages/shared/src/limits.ts packages/shared/src/__tests__/souvenir-schema.test.ts
git commit -m "feat: お土産リストの Zod スキーマと上限定数を追加"
```

---

## Task 3: API Route — souvenirs.ts 実装

**Files:**
- Create: `apps/api/src/routes/souvenirs.ts`
- Modify: `apps/api/src/lib/constants.ts`
- Modify: `apps/api/src/app.ts`

**Step 1: エラーメッセージを追加**

`apps/api/src/lib/constants.ts` の `ERROR_MSG` オブジェクトに追加（`EXPENSE_SPLIT_USER_NOT_MEMBER` の後）:

```typescript
SOUVENIR_NOT_FOUND: "Souvenir not found",
LIMIT_SOUVENIRS: "Souvenir limit reached",
```

**Step 2: APIルートを実装**

`apps/api/src/routes/souvenirs.ts` を作成:

```typescript
import {
  MAX_SOUVENIRS_PER_USER_PER_TRIP,
  createSouvenirSchema,
  updateSouvenirSchema,
} from "@sugara/shared";
import { and, count, eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/index";
import { souvenirItems } from "../db/schema";
import { ERROR_MSG } from "../lib/constants";
import { requireAuth } from "../middleware/auth";
import { requireTripAccess } from "../middleware/require-trip-access";
import type { AppEnv } from "../types";

const souvenirRoutes = new Hono<AppEnv>();
souvenirRoutes.use("*", requireAuth);

// GET /api/trips/:tripId/souvenirs — own items only
souvenirRoutes.get("/:tripId/souvenirs", requireTripAccess(), async (c) => {
  const tripId = c.req.param("tripId");
  const user = c.get("user");

  const items = await db.query.souvenirItems.findMany({
    where: and(eq(souvenirItems.tripId, tripId), eq(souvenirItems.userId, user.id)),
    orderBy: (souvenirItems, { asc }) => [asc(souvenirItems.createdAt)],
  });

  return c.json({ items });
});

// POST /api/trips/:tripId/souvenirs
souvenirRoutes.post("/:tripId/souvenirs", requireTripAccess(), async (c) => {
  const tripId = c.req.param("tripId");
  const user = c.get("user");

  const body = await c.req.json();
  const parsed = createSouvenirSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, 400);
  }

  const [{ itemCount }] = await db
    .select({ itemCount: count() })
    .from(souvenirItems)
    .where(and(eq(souvenirItems.tripId, tripId), eq(souvenirItems.userId, user.id)));

  if (itemCount >= MAX_SOUVENIRS_PER_USER_PER_TRIP) {
    return c.json({ error: ERROR_MSG.LIMIT_SOUVENIRS }, 409);
  }

  const { name, recipient, url, address, memo } = parsed.data;
  const [item] = await db
    .insert(souvenirItems)
    .values({ tripId, userId: user.id, name, recipient, url, address, memo })
    .returning();

  return c.json(item, 201);
});

// PATCH /api/trips/:tripId/souvenirs/:itemId
souvenirRoutes.patch("/:tripId/souvenirs/:itemId", requireTripAccess(), async (c) => {
  const tripId = c.req.param("tripId");
  const itemId = c.req.param("itemId");
  const user = c.get("user");

  const existing = await db.query.souvenirItems.findFirst({
    where: and(
      eq(souvenirItems.id, itemId),
      eq(souvenirItems.tripId, tripId),
      eq(souvenirItems.userId, user.id),
    ),
  });
  if (!existing) {
    return c.json({ error: ERROR_MSG.SOUVENIR_NOT_FOUND }, 404);
  }

  const body = await c.req.json();
  const parsed = updateSouvenirSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, 400);
  }

  const [updated] = await db
    .update(souvenirItems)
    .set(parsed.data)
    .where(eq(souvenirItems.id, itemId))
    .returning();

  return c.json(updated);
});

// DELETE /api/trips/:tripId/souvenirs/:itemId
souvenirRoutes.delete("/:tripId/souvenirs/:itemId", requireTripAccess(), async (c) => {
  const tripId = c.req.param("tripId");
  const itemId = c.req.param("itemId");
  const user = c.get("user");

  const existing = await db.query.souvenirItems.findFirst({
    where: and(
      eq(souvenirItems.id, itemId),
      eq(souvenirItems.tripId, tripId),
      eq(souvenirItems.userId, user.id),
    ),
  });
  if (!existing) {
    return c.json({ error: ERROR_MSG.SOUVENIR_NOT_FOUND }, 404);
  }

  await db.delete(souvenirItems).where(eq(souvenirItems.id, itemId));

  return new Response(null, { status: 204 });
});

export { souvenirRoutes };
```

**Step 3: app.ts にルートを登録**

`apps/api/src/app.ts` を修正。`expenseRoutes` の import の後に追加:

```typescript
import { souvenirRoutes } from "./routes/souvenirs";
```

`app.route("/api/trips", expenseRoutes);` の行の後に追加:

```typescript
app.route("/api/trips", souvenirRoutes);
```

**Step 4: 型チェック確認**

```bash
bun run --filter @sugara/api check-types
```

Expected: エラーなし

**Step 5: Commit**

```bash
git add apps/api/src/routes/souvenirs.ts apps/api/src/lib/constants.ts apps/api/src/app.ts
git commit -m "feat: お土産リスト API ルートを追加"
```

---

## Task 4: API Tests — souvenirs.test.ts

**Files:**
- Create: `apps/api/src/__tests__/souvenirs.test.ts`

**Step 1: テストを書く**

`apps/api/src/__tests__/test-helpers.ts` を参照して同じパターンを使う（`createTestApp`, `TEST_USER`）。

`apps/api/src/__tests__/souvenirs.test.ts` を作成:

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetSession, mockDbQuery, mockDbInsert, mockDbUpdate, mockDbDelete, mockDbSelect } =
  vi.hoisted(() => ({
    mockGetSession: vi.fn(),
    mockDbQuery: {
      souvenirItems: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
      tripMembers: {
        findFirst: vi.fn(),
      },
    },
    mockDbInsert: vi.fn(),
    mockDbUpdate: vi.fn(),
    mockDbDelete: vi.fn(),
    mockDbSelect: vi.fn(),
  }));

vi.mock("../lib/auth", () => ({
  auth: {
    api: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
    },
  },
}));

vi.mock("../db/index", () => ({
  db: {
    query: mockDbQuery,
    insert: (...args: unknown[]) => mockDbInsert(...args),
    update: (...args: unknown[]) => mockDbUpdate(...args),
    delete: (...args: unknown[]) => mockDbDelete(...args),
    select: (...args: unknown[]) => mockDbSelect(...args),
  },
}));

import { MAX_SOUVENIRS_PER_USER_PER_TRIP } from "@sugara/shared";
import { souvenirRoutes } from "../routes/souvenirs";
import { createTestApp, TEST_USER } from "./test-helpers";

const fakeUser = TEST_USER;
const tripId = "trip-1";
const itemId = "00000000-0000-0000-0000-000000000001";

function setupAuth() {
  mockGetSession.mockResolvedValue({
    user: fakeUser,
    session: { id: "session-1" },
  });
  mockDbQuery.tripMembers.findFirst.mockResolvedValue({
    tripId,
    userId: fakeUser.id,
    role: "owner",
  });
}

function makeApp() {
  return createTestApp(souvenirRoutes, "/api/trips");
}

function mockCountQuery(count: number) {
  mockDbSelect.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([{ itemCount: count }]),
    }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/trips/:tripId/souvenirs", () => {
  it("returns own items", async () => {
    setupAuth();
    const items = [{ id: itemId, name: "Tokyo banana", isPurchased: false }];
    mockDbQuery.souvenirItems.findMany.mockResolvedValue(items);

    const res = await makeApp().request(`/api/trips/${tripId}/souvenirs`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toEqual(items);
  });

  it("returns 401 without auth", async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await makeApp().request(`/api/trips/${tripId}/souvenirs`);
    expect(res.status).toBe(401);
  });
});

describe("POST /api/trips/:tripId/souvenirs", () => {
  it("creates souvenir item with name only", async () => {
    setupAuth();
    mockCountQuery(0);
    const created = { id: itemId, name: "Tokyo banana", isPurchased: false };
    mockDbInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([created]),
      }),
    });

    const res = await makeApp().request(`/api/trips/${tripId}/souvenirs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Tokyo banana" }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe("Tokyo banana");
  });

  it("creates souvenir item with all optional fields", async () => {
    setupAuth();
    mockCountQuery(0);
    const created = {
      id: itemId,
      name: "Matcha Kit Kat",
      recipient: "Mom",
      url: "https://example.com",
      address: "Shibuya, Tokyo",
      memo: "Green box",
      isPurchased: false,
    };
    mockDbInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([created]),
      }),
    });

    const res = await makeApp().request(`/api/trips/${tripId}/souvenirs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Matcha Kit Kat",
        recipient: "Mom",
        url: "https://example.com",
        address: "Shibuya, Tokyo",
        memo: "Green box",
      }),
    });
    expect(res.status).toBe(201);
  });

  it("returns 400 for empty name", async () => {
    setupAuth();
    const res = await makeApp().request(`/api/trips/${tripId}/souvenirs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 409 when limit reached", async () => {
    setupAuth();
    mockCountQuery(MAX_SOUVENIRS_PER_USER_PER_TRIP);

    const res = await makeApp().request(`/api/trips/${tripId}/souvenirs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "One more souvenir" }),
    });
    expect(res.status).toBe(409);
  });
});

describe("PATCH /api/trips/:tripId/souvenirs/:itemId", () => {
  it("marks item as purchased", async () => {
    setupAuth();
    const existing = { id: itemId, name: "Tokyo banana", isPurchased: false, userId: fakeUser.id };
    mockDbQuery.souvenirItems.findFirst.mockResolvedValue(existing);
    const updated = { ...existing, isPurchased: true };
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([updated]),
        }),
      }),
    });

    const res = await makeApp().request(`/api/trips/${tripId}/souvenirs/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPurchased: true }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.isPurchased).toBe(true);
  });

  it("returns 404 for non-existent or other user's item", async () => {
    setupAuth();
    mockDbQuery.souvenirItems.findFirst.mockResolvedValue(null);

    const res = await makeApp().request(`/api/trips/${tripId}/souvenirs/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPurchased: true }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 400 for empty update body", async () => {
    setupAuth();
    const existing = { id: itemId, name: "Tokyo banana", isPurchased: false, userId: fakeUser.id };
    mockDbQuery.souvenirItems.findFirst.mockResolvedValue(existing);

    const res = await makeApp().request(`/api/trips/${tripId}/souvenirs/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/trips/:tripId/souvenirs/:itemId", () => {
  it("deletes item and returns 204", async () => {
    setupAuth();
    const existing = { id: itemId, name: "Tokyo banana", isPurchased: false, userId: fakeUser.id };
    mockDbQuery.souvenirItems.findFirst.mockResolvedValue(existing);
    mockDbDelete.mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });

    const res = await makeApp().request(`/api/trips/${tripId}/souvenirs/${itemId}`, {
      method: "DELETE",
    });
    expect(res.status).toBe(204);
  });

  it("returns 404 for non-existent or other user's item", async () => {
    setupAuth();
    mockDbQuery.souvenirItems.findFirst.mockResolvedValue(null);

    const res = await makeApp().request(`/api/trips/${tripId}/souvenirs/${itemId}`, {
      method: "DELETE",
    });
    expect(res.status).toBe(404);
  });
});
```

**Step 2: テストを実行して通ることを確認**

```bash
bun run --filter @sugara/api test
```

Expected: souvenirs のテストが全て PASS

**Step 3: Commit**

```bash
git add apps/api/src/__tests__/souvenirs.test.ts
git commit -m "test: お土産リスト API のユニットテストを追加"
```

---

## Task 5: Frontend — Query Keys と型定義

**Files:**
- Modify: `apps/web/lib/query-keys.ts`

**Step 1: souvenirs キーを追加**

`apps/web/lib/query-keys.ts` の `expenses` ブロックの後に追加:

```typescript
souvenirs: {
  all: ["souvenirs"] as const,
  list: (tripId: string) => [...queryKeys.souvenirs.all, tripId] as const,
},
```

**Step 2: Commit**

```bash
git add apps/web/lib/query-keys.ts
git commit -m "feat: souvenirs の React Query キーを追加"
```

---

## Task 6: Frontend — SouvenirDialog コンポーネント

**Files:**
- Create: `apps/web/components/souvenir-dialog.tsx`

**Step 1: ダイアログを実装**

`apps/web/components/souvenir-dialog.tsx` を作成:

```typescript
"use client";

import {
  SOUVENIR_ADDRESS_MAX_LENGTH,
  SOUVENIR_NAME_MAX_LENGTH,
  SOUVENIR_RECIPIENT_MAX_LENGTH,
  SOUVENIR_URL_MAX_LENGTH,
} from "@sugara/shared";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ResponsiveDialog,
  ResponsiveDialogClose,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { Textarea } from "@/components/ui/textarea";
import { api, getApiErrorMessage } from "@/lib/api";

type SouvenirItem = {
  id: string;
  name: string;
  recipient: string | null;
  url: string | null;
  address: string | null;
  memo: string | null;
  isPurchased: boolean;
};

type SouvenirDialogProps = {
  tripId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: SouvenirItem | null;
  onSaved: () => void;
};

export function SouvenirDialog({ tripId, open, onOpenChange, item, onSaved }: SouvenirDialogProps) {
  const isEdit = !!item;
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [recipient, setRecipient] = useState("");
  const [url, setUrl] = useState("");
  const [address, setAddress] = useState("");
  const [memo, setMemo] = useState("");

  useEffect(() => {
    if (!open) return;
    if (item) {
      setName(item.name);
      setRecipient(item.recipient ?? "");
      setUrl(item.url ?? "");
      setAddress(item.address ?? "");
      setMemo(item.memo ?? "");
    } else {
      setName("");
      setRecipient("");
      setUrl("");
      setAddress("");
      setMemo("");
    }
  }, [open, item]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      const body = {
        name: name.trim(),
        recipient: recipient.trim() || null,
        url: url.trim() || null,
        address: address.trim() || null,
        memo: memo.trim() || null,
      };

      if (isEdit) {
        await api(`/api/trips/${tripId}/souvenirs/${item.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      } else {
        await api(`/api/trips/${tripId}/souvenirs`, {
          method: "POST",
          body: JSON.stringify(body),
        });
      }
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to save souvenir"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-sm">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            {isEdit ? "お土産を編集" : "お土産を追加"}
          </ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="souvenir-name">品名</Label>
            <Input
              id="souvenir-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: 東京バナナ"
              maxLength={SOUVENIR_NAME_MAX_LENGTH}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="souvenir-recipient">誰向け</Label>
            <Input
              id="souvenir-recipient"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="例: お母さん"
              maxLength={SOUVENIR_RECIPIENT_MAX_LENGTH}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="souvenir-url">URL</Label>
            <Input
              id="souvenir-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              maxLength={SOUVENIR_URL_MAX_LENGTH}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="souvenir-address">住所・場所</Label>
            <Input
              id="souvenir-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="例: 渋谷区道玄坂..."
              maxLength={SOUVENIR_ADDRESS_MAX_LENGTH}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="souvenir-memo">メモ</Label>
            <Textarea
              id="souvenir-memo"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="自由メモ"
              rows={2}
            />
          </div>
          <ResponsiveDialogFooter>
            <ResponsiveDialogClose asChild>
              <Button type="button" variant="outline">
                <X className="h-4 w-4" />
                キャンセル
              </Button>
            </ResponsiveDialogClose>
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading ? "保存中..." : isEdit ? "保存" : "追加"}
            </Button>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
```

**Step 2: 型チェック確認**

```bash
bun run --filter @sugara/web check-types
```

Expected: エラーなし

**Step 3: Commit**

```bash
git add apps/web/components/souvenir-dialog.tsx
git commit -m "feat: SouvenirDialog コンポーネントを追加"
```

---

## Task 7: Frontend — SouvenirPanel コンポーネント

**Files:**
- Create: `apps/web/components/souvenir-panel.tsx`

**Step 1: パネルを実装**

`apps/web/components/souvenir-panel.tsx` を作成:

```typescript
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { SouvenirDialog } from "@/components/souvenir-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ResponsiveAlertDialog,
  ResponsiveAlertDialogCancel,
  ResponsiveAlertDialogContent,
  ResponsiveAlertDialogDestructiveAction,
  ResponsiveAlertDialogDescription,
  ResponsiveAlertDialogFooter,
  ResponsiveAlertDialogHeader,
  ResponsiveAlertDialogTitle,
} from "@/components/ui/responsive-alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { api, getApiErrorMessage } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

type SouvenirItem = {
  id: string;
  name: string;
  recipient: string | null;
  url: string | null;
  address: string | null;
  memo: string | null;
  isPurchased: boolean;
  createdAt: string;
};

type SouvenirPanelProps = {
  tripId: string;
};

export function SouvenirPanel({ tripId }: SouvenirPanelProps) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SouvenirItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SouvenirItem | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.souvenirs.list(tripId),
    queryFn: () => api<{ items: SouvenirItem[] }>(`/api/trips/${tripId}/souvenirs`),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isPurchased }: { id: string; isPurchased: boolean }) =>
      api(`/api/trips/${tripId}/souvenirs/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ isPurchased }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.souvenirs.list(tripId) });
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, "Failed to update"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      api(`/api/trips/${tripId}/souvenirs/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.souvenirs.list(tripId) });
      setDeleteTarget(null);
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, "Failed to delete"));
    },
  });

  const handleSaved = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.souvenirs.list(tripId) });
    setEditingItem(null);
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (isError) {
    return <p className="py-8 text-center text-sm text-muted-foreground">読み込みに失敗しました</p>;
  }

  const items = data?.items ?? [];
  const purchased = items.filter((i) => i.isPurchased);
  const remaining = items.filter((i) => !i.isPurchased);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          追加
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          お土産リストはまだありません
        </p>
      ) : (
        <div className="space-y-1">
          {remaining.map((item) => (
            <SouvenirItemRow
              key={item.id}
              item={item}
              onToggle={(isPurchased) => toggleMutation.mutate({ id: item.id, isPurchased })}
              onEdit={() => {
                setEditingItem(item);
                setDialogOpen(true);
              }}
              onDelete={() => setDeleteTarget(item)}
            />
          ))}
          {purchased.length > 0 && remaining.length > 0 && (
            <div className="my-2 border-t" />
          )}
          {purchased.map((item) => (
            <SouvenirItemRow
              key={item.id}
              item={item}
              onToggle={(isPurchased) => toggleMutation.mutate({ id: item.id, isPurchased })}
              onEdit={() => {
                setEditingItem(item);
                setDialogOpen(true);
              }}
              onDelete={() => setDeleteTarget(item)}
            />
          ))}
        </div>
      )}

      <SouvenirDialog
        tripId={tripId}
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingItem(null);
        }}
        item={editingItem}
        onSaved={handleSaved}
      />

      <ResponsiveAlertDialog
        open={deleteTarget !== null}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
      >
        <ResponsiveAlertDialogContent>
          <ResponsiveAlertDialogHeader>
            <ResponsiveAlertDialogTitle>削除しますか？</ResponsiveAlertDialogTitle>
            <ResponsiveAlertDialogDescription>
              「{deleteTarget?.name}」を削除します。この操作は取り消せません。
            </ResponsiveAlertDialogDescription>
          </ResponsiveAlertDialogHeader>
          <ResponsiveAlertDialogFooter>
            <ResponsiveAlertDialogCancel>キャンセル</ResponsiveAlertDialogCancel>
            <ResponsiveAlertDialogDestructiveAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
            >
              削除する
            </ResponsiveAlertDialogDestructiveAction>
          </ResponsiveAlertDialogFooter>
        </ResponsiveAlertDialogContent>
      </ResponsiveAlertDialog>
    </div>
  );
}

function SouvenirItemRow({
  item,
  onToggle,
  onEdit,
  onDelete,
}: {
  item: SouvenirItem;
  onToggle: (isPurchased: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={`flex items-start gap-3 rounded-md border p-3 ${
        item.isPurchased ? "opacity-50" : ""
      }`}
    >
      <Checkbox
        checked={item.isPurchased}
        onCheckedChange={(checked) => onToggle(checked === true)}
        className="mt-0.5 shrink-0"
        aria-label={item.isPurchased ? "購入済みを取り消す" : "購入済みにする"}
      />
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium ${item.isPurchased ? "line-through" : ""}`}>
          {item.name}
        </p>
        {item.recipient && (
          <p className="text-xs text-muted-foreground">{item.recipient} 向け</p>
        )}
        {item.address && (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{item.address}</span>
          </p>
        )}
        {item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-blue-500 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="h-3 w-3 shrink-0" />
            <span className="truncate">{item.url}</span>
          </a>
        )}
        {item.memo && <p className="text-xs text-muted-foreground">{item.memo}</p>}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
            <span className="sr-only">メニュー</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <circle cx="12" cy="5" r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="12" cy="19" r="1.5" />
            </svg>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onEdit}>
            <Pencil className="mr-2 h-4 w-4" />
            編集
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={onDelete}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            削除
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
```

**Step 2: 型チェック確認**

```bash
bun run --filter @sugara/web check-types
```

Expected: エラーなし

**Step 3: Commit**

```bash
git add apps/web/components/souvenir-panel.tsx
git commit -m "feat: SouvenirPanel コンポーネントを追加"
```

---

## Task 8: Frontend — デスクトップ右パネルへの統合

**Files:**
- Modify: `apps/web/app/(authenticated)/trips/[id]/_components/right-panel-tabs.tsx`
- Modify: `apps/web/app/(authenticated)/trips/[id]/_components/right-panel.tsx`

**Step 1: right-panel-tabs.tsx を修正**

`apps/web/app/(authenticated)/trips/[id]/_components/right-panel-tabs.tsx`:

```typescript
// 1行目: RightPanelTab 型に "souvenirs" を追加
export type RightPanelTab = "candidates" | "activity" | "bookmarks" | "expenses" | "souvenirs";
```

費用タブ（`aria-selected={current === "expenses"}` ブロック）の後に追加:

```typescript
<button
  type="button"
  role="tab"
  aria-selected={current === "souvenirs"}
  onClick={() => onChange("souvenirs")}
  className={cn(CHIP_BASE, current === "souvenirs" ? CHIP_ACTIVE : CHIP_INACTIVE)}
>
  お土産
</button>
```

**Step 2: right-panel.tsx を修正**

`apps/web/app/(authenticated)/trips/[id]/_components/right-panel.tsx`:

import に追加:
```typescript
import { SouvenirPanel } from "@/components/souvenir-panel";
```

`rightPanelTab === "expenses"` ブロックの後（`: (` の前）に追加:

```typescript
) : rightPanelTab === "souvenirs" ? (
  <SouvenirPanel tripId={tripId} />
```

**Step 3: 型チェック確認**

```bash
bun run --filter @sugara/web check-types
```

Expected: エラーなし

**Step 4: Commit**

```bash
git add apps/web/app/(authenticated)/trips/[id]/_components/right-panel-tabs.tsx apps/web/app/(authenticated)/trips/[id]/_components/right-panel.tsx
git commit -m "feat: デスクトップ右パネルにお土産タブを追加"
```

---

## Task 9: Frontend — モバイル SP ページへの統合

**Files:**
- Modify: `apps/web/components/mobile-content-tabs.tsx`
- Modify: `apps/web/app/(sp)/sp/trips/[id]/page.tsx`

**Step 1: mobile-content-tabs.tsx を修正**

`apps/web/components/mobile-content-tabs.tsx`:

```typescript
// MobileContentTab 型に "souvenirs" を追加
export type MobileContentTab = "schedule" | "candidates" | "expenses" | "bookmarks" | "activity" | "souvenirs";

// BASE_TABS に追加（expenses の後）
const BASE_TABS: { id: MobileContentTab; label: string }[] = [
  { id: "schedule", label: "予定" },
  { id: "candidates", label: "候補" },
  { id: "expenses", label: "費用" },
  { id: "souvenirs", label: "お土産" },  // 追加
];
```

grid-cols を 3 から 4 に変更:
```typescript
// "grid-cols-3" → "grid-cols-4"
className="my-2 grid shrink-0 grid-cols-4 gap-1 rounded-lg bg-muted p-1"
```

**Step 2: SP ページに SouvenirPanel を追加**

`apps/web/app/(sp)/sp/trips/[id]/page.tsx`:

import に追加:
```typescript
import { SouvenirPanel } from "@/components/souvenir-panel";
```

expenses タブのレンダリング部分（`{activeTab === "expenses" && ...}` ブロック）の後に追加:

```tsx
{activeTab === "souvenirs" && (
  <div
    id={getMobileTabPanelId("souvenirs")}
    role="tabpanel"
    aria-labelledby={getMobileTabTriggerId("souvenirs")}
  >
    <SouvenirPanel tripId={tripId} />
  </div>
)}
```

**Step 3: 全体型チェック確認**

```bash
bun run check-types
```

Expected: エラーなし

**Step 4: 全テスト実行**

```bash
bun run test
```

Expected: 全テスト PASS

**Step 5: Commit**

```bash
git add apps/web/components/mobile-content-tabs.tsx apps/web/app/(sp)/sp/trips/[id]/page.tsx
git commit -m "feat: モバイル SP ページにお土産タブを追加"
```

---

## 完了確認チェックリスト

- [ ] `souvenir_items` テーブルが DB に存在する
- [ ] `GET /api/trips/:tripId/souvenirs` が自分のアイテムのみ返す
- [ ] `POST` でアイテム作成、`PATCH` でチェック/編集、`DELETE` で削除できる
- [ ] 他メンバーのアイテムを PATCH/DELETE しようとすると 404
- [ ] デスクトップ右パネルに「お土産」タブが表示される
- [ ] モバイルに「お土産」タブが表示される
- [ ] チェックボックスで購入済み/未を切り替えられる
- [ ] 購入済みアイテムは下部にグレーアウトして表示される
- [ ] URL があるアイテムは外部リンクとして開ける
- [ ] 全テストが通る
