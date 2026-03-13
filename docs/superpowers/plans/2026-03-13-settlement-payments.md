# Settlement Payments (精算チェック) Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 旅行の精算 (transfer) に支払済チェック機能を追加し、未精算状況をプロフィールとホーム画面で可視化する

**Architecture:** 新テーブル `settlement_payments` で支払済状態を管理。費用変更時にトランザクション内で自動リセット。フロントエンドは費用タブにチェックボックス、プロフィールに未精算サマリー、ホームにバッジを追加。

**Tech Stack:** Drizzle ORM, Hono, React Query, shadcn/ui, Zod

**Spec:** `docs/superpowers/specs/2026-03-13-settlement-payments-design.md`

---

## File Structure

### New files
- `apps/api/src/routes/settlement-payments.ts` — settlement payment CRUD endpoints + unsettled summary
- `apps/api/src/__tests__/settlement-payments.test.ts` — unit tests for settlement payment routes
- `apps/web/components/settlement-section.tsx` — settlement section with checkboxes (extracted from expense-panel)
- `apps/web/components/unsettled-summary.tsx` — profile page unsettled summary section
- `apps/web/lib/hooks/use-unsettled-trip-ids.ts` — hook for unsettled trip ID set (used by home pages)

### Modified files
- `apps/api/src/db/schema.ts` — add `settlementPayments` table + `settlement_checked` enum value
- `apps/api/src/app.ts` — register settlement payment routes
- `apps/api/src/routes/expenses.ts` — add auto-reset to POST/PATCH/DELETE, add settlementPayments to GET response
- `packages/shared/src/schemas/expense.ts` — add `createSettlementPaymentSchema`
- `packages/shared/src/types.ts` — add `SettlementPayment`, `UnsettledSummary` types
- `packages/shared/src/schemas/notification.ts` — add `settlement_checked`
- `packages/shared/src/messages.ts` — add push message + UI messages
- `apps/web/components/expense-panel.tsx` — replace inline settlement with `SettlementSection`
- `apps/web/components/trip-card.tsx` — add unsettled badge
- `apps/web/components/activity-log.tsx` — add settle/unsettle actions
- `apps/web/lib/query-keys.ts` — add settlement keys
- `apps/web/app/users/[userId]/page.tsx` — add unsettled summary section
- `apps/web/app/(sp)/sp/users/[userId]/page.tsx` — use updated profile content
- `apps/web/app/(authenticated)/home/page.tsx` — pass unsettled prop to TripCard
- `apps/web/app/(sp)/sp/home/page.tsx` — pass unsettled prop to TripCard
- `apps/api/src/db/seed-faqs.ts` — add settlement FAQs

---

## Chunk 1: Data Model + Shared Schemas

### Task 1: DB Schema — settlement_payments table + notification enum

**Files:**
- Modify: `apps/api/src/db/schema.ts`

- [ ] **Step 1: Add `settlement_checked` to notificationTypeEnum**

In `apps/api/src/db/schema.ts`, add `"settlement_checked"` to the `notificationTypeEnum` array:

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
  "settlement_checked",
]);
```

- [ ] **Step 2: Add settlementPayments table**

After the last table definition (after `quickPollVotes` around line 873), add:

```typescript
export const settlementPayments = pgTable(
  "settlement_payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    fromUserId: uuid("from_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    toUserId: uuid("to_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }).defaultNow().notNull(),
    paidByUserId: uuid("paid_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("settlement_payments_trip_id_idx").on(table.tripId),
    uniqueIndex("settlement_payments_trip_from_to_amount_idx").on(
      table.tripId,
      table.fromUserId,
      table.toUserId,
      table.amount,
    ),
  ],
).enableRLS();
```

Import `integer` from `drizzle-orm/pg-core` if not already imported (check existing imports at top of file).

- [ ] **Step 3: Add relations for settlementPayments**

```typescript
export const settlementPaymentsRelations = relations(settlementPayments, ({ one }) => ({
  trip: one(trips, { fields: [settlementPayments.tripId], references: [trips.id] }),
  fromUser: one(users, {
    fields: [settlementPayments.fromUserId],
    references: [users.id],
    relationName: "settlementPaymentFrom",
  }),
  toUser: one(users, {
    fields: [settlementPayments.toUserId],
    references: [users.id],
    relationName: "settlementPaymentTo",
  }),
  paidByUser: one(users, {
    fields: [settlementPayments.paidByUserId],
    references: [users.id],
    relationName: "settlementPaymentPaidBy",
  }),
}));
```

- [ ] **Step 4: Generate and run migration**

Run: `bun run db:generate`
Then: `bun run db:migrate`

Verify: migration file is created in `apps/api/drizzle/` with `CREATE TABLE settlement_payments` and `ALTER TYPE notification_type ADD VALUE 'settlement_checked'`.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/db/schema.ts apps/api/drizzle/
git commit -m "feat: settlement_payments テーブルと settlement_checked 通知タイプを追加"
```

---

### Task 2: Shared schemas and types

**Files:**
- Modify: `packages/shared/src/schemas/expense.ts`
- Modify: `packages/shared/src/types.ts`

- [ ] **Step 1: Add createSettlementPaymentSchema**

At the end of `packages/shared/src/schemas/expense.ts`:

```typescript
export const createSettlementPaymentSchema = z.object({
  fromUserId: z.string().uuid(),
  toUserId: z.string().uuid(),
  amount: z.number().int().positive(),
});
```

- [ ] **Step 2: Add SettlementPayment type and UnsettledSummary types**

In `packages/shared/src/types.ts`, after the `ExpensesResponse` type (around line 292):

```typescript
export type SettlementPayment = {
  id: string;
  tripId: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  paidAt: string;
  paidByUserId: string;
};

export type UnsettledTransfer = {
  fromUser: { id: string; name: string };
  toUser: { id: string; name: string };
  amount: number;
};

export type UnsettledTrip = {
  tripId: string;
  tripTitle: string;
  transfers: UnsettledTransfer[];
};

export type UnsettledSummary = {
  totalOwed: number;
  totalOwedTo: number;
  trips: UnsettledTrip[];
};
```

- [ ] **Step 3: Add settlementPayments to ExpensesResponse**

Update the `ExpensesResponse` type:

```typescript
export type ExpensesResponse = {
  expenses: ExpenseItem[];
  settlement: Settlement;
  settlementPayments: SettlementPayment[];
  categoryTotals: CategoryTotal[];
};
```

- [ ] **Step 4: Run type check**

Run: `bun run check-types`

Expected: type errors in expense-panel.tsx and expenses.ts (they don't return `settlementPayments` yet) — this is expected and will be fixed in later tasks.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/schemas/expense.ts packages/shared/src/types.ts
git commit -m "feat: 精算チェックの共有スキーマと型定義を追加"
```

---

### Task 3: Notification integration

**Files:**
- Modify: `packages/shared/src/schemas/notification.ts`
- Modify: `packages/shared/src/messages.ts`

- [ ] **Step 1: Add settlement_checked to notificationTypeSchema**

In `packages/shared/src/schemas/notification.ts`, add `"settlement_checked"` to the Zod enum:

```typescript
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
  "settlement_checked",
]);
```

- [ ] **Step 2: Add to NOTIFICATION_DEFAULTS**

```typescript
export const NOTIFICATION_DEFAULTS = {
  member_added: { inApp: true, push: true },
  member_removed: { inApp: true, push: true },
  role_changed: { inApp: true, push: false },
  schedule_created: { inApp: false, push: false },
  schedule_updated: { inApp: false, push: false },
  schedule_deleted: { inApp: false, push: false },
  poll_started: { inApp: true, push: false },
  poll_closed: { inApp: true, push: false },
  expense_added: { inApp: false, push: false },
  settlement_checked: { inApp: true, push: true },
} satisfies Record<NotificationType, { inApp: boolean; push: boolean }>;
```

- [ ] **Step 3: Add to NOTIFICATION_TYPE_LABELS**

```typescript
export const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  // ... existing entries ...
  expense_added: "費用が追加された",
  settlement_checked: "精算チェック",
};
```

- [ ] **Step 4: Add to formatNotificationText**

Add a new case before the `default`:

```typescript
    case "settlement_checked":
      return `${payload.actorName}さんが精算をチェックしました`;
```

- [ ] **Step 5: Add to PUSH_MSG in messages.ts**

In `packages/shared/src/messages.ts`, add to the `PUSH_MSG` object:

```typescript
  settlement_checked: (p) => `${p.actorName}さんが精算をチェックしました`,
```

- [ ] **Step 6: Add UI messages for settlement operations**

In `packages/shared/src/messages.ts`, find the `MSG` object and add in the Expense section:

```typescript
  SETTLEMENT_CHECK_FAILED: "精算チェックに失敗しました",
  SETTLEMENT_UNCHECK_FAILED: "精算チェックの解除に失敗しました",
  SETTLEMENT_ALREADY_CHECKED: "この精算は既にチェック済みです",
```

- [ ] **Step 7: Run type check**

Run: `bun run check-types`

Expected: PASS (notification types are consistent across all files)

- [ ] **Step 8: Commit**

```bash
git add packages/shared/src/schemas/notification.ts packages/shared/src/messages.ts
git commit -m "feat: 精算チェックの通知タイプとメッセージを追加"
```

---

## Chunk 2: API — Settlement Payment Endpoints

### Task 4: Settlement payment routes (POST + DELETE)

**Files:**
- Create: `apps/api/src/routes/settlement-payments.ts`
- Create: `apps/api/src/__tests__/settlement-payments.test.ts`

- [ ] **Step 1: Write tests for POST /api/trips/:tripId/settlement-payments**

Create `apps/api/src/__tests__/settlement-payments.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetSession,
  mockDbQuery,
  mockDbInsert,
  mockDbDelete,
  mockNotifyUsers,
} = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockDbQuery: {
    expenses: { findMany: vi.fn() },
    tripMembers: { findFirst: vi.fn(), findMany: vi.fn() },
    trips: { findFirst: vi.fn() },
    settlementPayments: { findFirst: vi.fn(), findMany: vi.fn() },
  },
  mockDbInsert: vi.fn(),
  mockDbDelete: vi.fn(),
  mockNotifyUsers: vi.fn(),
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
    delete: (...args: unknown[]) => mockDbDelete(...args),
  },
}));

vi.mock("../lib/activity-logger", () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../lib/notifications", () => ({
  notifyUsers: (...args: unknown[]) => mockNotifyUsers(...args),
}));

vi.mock("../lib/settlement", () => ({
  calculateSettlement: vi.fn().mockReturnValue({
    totalAmount: 1000,
    balances: [],
    transfers: [
      { from: { id: "user-from", name: "From" }, to: { id: "user-to", name: "To" }, amount: 500 },
    ],
  }),
}));

import { logActivity } from "../lib/activity-logger";
import { settlementPaymentRoutes } from "../routes/settlement-payments";
import { createTestApp, TEST_USER } from "./test-helpers";

const tripId = "trip-1";
const fromUserId = "00000000-0000-0000-0000-000000000001";
const toUserId = "00000000-0000-0000-0000-000000000002";

function setupAuth(userId = TEST_USER.id, role: "owner" | "editor" | "viewer" = "owner") {
  mockGetSession.mockResolvedValue({
    user: { ...TEST_USER, id: userId },
    session: { id: "session-1" },
  });
  mockDbQuery.tripMembers.findFirst.mockResolvedValue({
    tripId,
    userId,
    role,
  });
}

function makeApp() {
  return createTestApp(settlementPaymentRoutes, "/api/trips");
}

describe("Settlement payment routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAuth(fromUserId);
    mockDbQuery.trips.findFirst.mockResolvedValue({ title: "テスト旅行" });
  });

  describe("POST /api/trips/:tripId/settlement-payments", () => {
    it("creates a settlement payment", async () => {
      mockDbQuery.tripMembers.findMany.mockResolvedValue([
        { userId: fromUserId, user: { id: fromUserId, name: "From" } },
        { userId: toUserId, user: { id: toUserId, name: "To" } },
      ]);
      mockDbQuery.expenses.findMany.mockResolvedValue([]);
      const payment = {
        id: "sp-1",
        tripId,
        fromUserId,
        toUserId,
        amount: 500,
        paidAt: new Date().toISOString(),
        paidByUserId: fromUserId,
      };
      mockDbInsert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([payment]),
        }),
      });

      const res = await makeApp().request(`/api/trips/${tripId}/settlement-payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromUserId, toUserId, amount: 500 }),
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.settlementPayment.fromUserId).toBe(fromUserId);
      expect(logActivity).toHaveBeenCalledWith(
        expect.objectContaining({ action: "settle", entityType: "settlement" }),
      );
      expect(mockNotifyUsers).toHaveBeenCalled();
    });

    it("rejects if caller is not from or to user", async () => {
      setupAuth("other-user-id");
      mockDbQuery.tripMembers.findMany.mockResolvedValue([]);
      mockDbQuery.expenses.findMany.mockResolvedValue([]);

      const res = await makeApp().request(`/api/trips/${tripId}/settlement-payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromUserId, toUserId, amount: 500 }),
      });

      expect(res.status).toBe(403);
    });

    it("rejects invalid body", async () => {
      const res = await makeApp().request(`/api/trips/${tripId}/settlement-payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromUserId: "not-uuid" }),
      });

      expect(res.status).toBe(400);
    });

    it("returns 409 on duplicate", async () => {
      mockDbQuery.tripMembers.findMany.mockResolvedValue([
        { userId: fromUserId, user: { id: fromUserId, name: "From" } },
        { userId: toUserId, user: { id: toUserId, name: "To" } },
      ]);
      mockDbQuery.expenses.findMany.mockResolvedValue([]);
      const uniqueError = new Error("duplicate key");
      (uniqueError as any).code = "23505";
      mockDbInsert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockRejectedValue(uniqueError),
        }),
      });

      const res = await makeApp().request(`/api/trips/${tripId}/settlement-payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromUserId, toUserId, amount: 500 }),
      });

      expect(res.status).toBe(409);
    });
  });

  describe("DELETE /api/trips/:tripId/settlement-payments/:id", () => {
    it("deletes a settlement payment", async () => {
      mockDbQuery.settlementPayments.findFirst.mockResolvedValue({
        id: "sp-1",
        tripId,
        fromUserId,
        toUserId,
        amount: 500,
        paidByUserId: fromUserId,
      });
      mockDbQuery.tripMembers.findMany.mockResolvedValue([
        { userId: fromUserId, user: { id: fromUserId, name: "From" } },
        { userId: toUserId, user: { id: toUserId, name: "To" } },
      ]);
      mockDbDelete.mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      const res = await makeApp().request(`/api/trips/${tripId}/settlement-payments/sp-1`, {
        method: "DELETE",
      });

      expect(res.status).toBe(204);
      expect(logActivity).toHaveBeenCalledWith(
        expect.objectContaining({ action: "unsettle", entityType: "settlement" }),
      );
    });

    it("returns 404 for non-existent payment", async () => {
      mockDbQuery.settlementPayments.findFirst.mockResolvedValue(null);

      const res = await makeApp().request(`/api/trips/${tripId}/settlement-payments/sp-missing`, {
        method: "DELETE",
      });

      expect(res.status).toBe(404);
    });

    it("rejects if caller is not from or to user", async () => {
      setupAuth("other-user-id");
      mockDbQuery.settlementPayments.findFirst.mockResolvedValue({
        id: "sp-1",
        tripId,
        fromUserId,
        toUserId,
        amount: 500,
        paidByUserId: fromUserId,
      });

      const res = await makeApp().request(`/api/trips/${tripId}/settlement-payments/sp-1`, {
        method: "DELETE",
      });

      expect(res.status).toBe(403);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run --filter @sugara/api test -- settlement-payments`

Expected: FAIL (module not found)

- [ ] **Step 3: Implement settlement payment routes**

Create `apps/api/src/routes/settlement-payments.ts`:

```typescript
import { createSettlementPaymentSchema } from "@sugara/shared";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/index";
import {
  expenses,
  expenseSplits,
  settlementPayments,
  tripMembers,
} from "../db/schema";
import { logActivity } from "../lib/activity-logger";
import { notifyUsers } from "../lib/notifications";
import { calculateSettlement } from "../lib/settlement";
import { requireAuth } from "../middleware/auth";
import { requireTripAccess } from "../middleware/require-trip-access";
import type { AppEnv } from "../types";

const settlementPaymentRoutes = new Hono<AppEnv>();
settlementPaymentRoutes.use("*", requireAuth);

// Create settlement payment (mark transfer as paid)
settlementPaymentRoutes.post(
  "/:tripId/settlement-payments",
  requireTripAccess(),
  async (c) => {
    const user = c.get("user");
    const tripId = c.req.param("tripId");

    const body = await c.req.json();
    const parsed = createSettlementPaymentSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }

    const { fromUserId, toUserId, amount } = parsed.data;

    // Authorization: caller must be fromUserId or toUserId
    if (user.id !== fromUserId && user.id !== toUserId) {
      return c.json({ error: "Unauthorized" }, 403);
    }

    // Validate the transfer exists in current settlement
    const [expenseList, members] = await Promise.all([
      db.query.expenses.findMany({
        where: eq(expenses.tripId, tripId),
        with: { splits: true },
      }),
      db.query.tripMembers.findMany({
        where: eq(tripMembers.tripId, tripId),
        with: { user: { columns: { id: true, name: true } } },
      }),
    ]);

    const memberInfos = members.map((m) => ({ id: m.user.id, name: m.user.name }));
    const expenseData = expenseList.map((e) => ({
      paidByUserId: e.paidByUserId,
      amount: e.amount,
      splits: e.splits.map((s) => ({ userId: s.userId, amount: s.amount })),
    }));
    const settlement = calculateSettlement(expenseData, memberInfos);

    const matchingTransfer = settlement.transfers.find(
      (t) => t.from.id === fromUserId && t.to.id === toUserId && t.amount === amount,
    );
    if (!matchingTransfer) {
      return c.json({ error: "Transfer not found in current settlement" }, 400);
    }

    try {
      const [payment] = await db
        .insert(settlementPayments)
        .values({
          tripId,
          fromUserId,
          toUserId,
          amount,
          paidByUserId: user.id,
        })
        .returning();

      const fromName = matchingTransfer.from.name;
      const toName = matchingTransfer.to.name;

      logActivity({
        tripId,
        userId: user.id,
        action: "settle",
        entityType: "settlement",
        entityName: `${fromName} → ${toName}`,
        detail: `\u00A5${amount.toLocaleString()}`,
      });

      // Notify the other party only
      const otherUserId = user.id === fromUserId ? toUserId : fromUserId;
      notifyUsers({
        type: "settlement_checked",
        tripId,
        userIds: [otherUserId],
        makePayload: (tripName) => ({
          actorName: user.name,
          tripName,
          entityName: `${fromName} → ${toName} \u00A5${amount.toLocaleString()}`,
        }),
      });

      return c.json({ settlementPayment: payment }, 201);
    } catch (err: unknown) {
      if (err instanceof Error && (err as any).code === "23505") {
        return c.json({ error: "Settlement already checked" }, 409);
      }
      throw err;
    }
  },
);

// Delete settlement payment (uncheck)
settlementPaymentRoutes.delete(
  "/:tripId/settlement-payments/:id",
  requireTripAccess(),
  async (c) => {
    const user = c.get("user");
    const tripId = c.req.param("tripId");
    const id = c.req.param("id");

    const existing = await db.query.settlementPayments.findFirst({
      where: and(eq(settlementPayments.id, id), eq(settlementPayments.tripId, tripId)),
    });

    if (!existing) {
      return c.json({ error: "Settlement payment not found" }, 404);
    }

    // Authorization: caller must be fromUserId or toUserId
    if (user.id !== existing.fromUserId && user.id !== existing.toUserId) {
      return c.json({ error: "Unauthorized" }, 403);
    }

    await db.delete(settlementPayments).where(eq(settlementPayments.id, id));

    // Look up names for activity log
    const members = await db.query.tripMembers.findMany({
      where: eq(tripMembers.tripId, tripId),
      with: { user: { columns: { id: true, name: true } } },
    });
    const memberMap = new Map(members.map((m) => [m.user.id, m.user.name]));
    const fromName = memberMap.get(existing.fromUserId) ?? "Unknown";
    const toName = memberMap.get(existing.toUserId) ?? "Unknown";

    logActivity({
      tripId,
      userId: user.id,
      action: "unsettle",
      entityType: "settlement",
      entityName: `${fromName} → ${toName}`,
      detail: `\u00A5${existing.amount.toLocaleString()}`,
    });

    return c.body(null, 204);
  },
);

export { settlementPaymentRoutes };
```

- [ ] **Step 4: Register routes in app.ts**

In `apps/api/src/app.ts`, add import and route:

```typescript
import { settlementPaymentRoutes } from "./routes/settlement-payments";
```

Add after the `expenseRoutes` line:

```typescript
app.route("/api/trips", settlementPaymentRoutes);
```

- [ ] **Step 5: Run tests**

Run: `bun run --filter @sugara/api test -- settlement-payments`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/settlement-payments.ts apps/api/src/__tests__/settlement-payments.test.ts apps/api/src/app.ts
git commit -m "feat: 精算チェックの作成・削除 API エンドポイントを追加"
```

---

### Task 5: Auto-reset and GET response update

**Files:**
- Modify: `apps/api/src/routes/expenses.ts`

- [ ] **Step 1: Add settlementPayments import**

In `apps/api/src/routes/expenses.ts`, add `settlementPayments` to the schema import:

```typescript
import {
  expenseLineItemMembers,
  expenseLineItems,
  expenseSplits,
  expenses,
  settlementPayments,
  tripMembers,
} from "../db/schema";
```

- [ ] **Step 2: Add settlementPayments to GET response**

In the GET handler (around line 30-78), after calculating `categoryTotals`, query settlement payments and add to response:

After `const categoryTotals = ...` and before `return c.json(...)`:

```typescript
  const payments = await db.query.settlementPayments.findMany({
    where: eq(settlementPayments.tripId, tripId),
  });
```

Update the return:

```typescript
  return c.json({ expenses: expenseList, settlement, settlementPayments: payments, categoryTotals });
```

- [ ] **Step 3: Add auto-reset to POST (create expense)**

In the POST handler's transaction (around line 129-166), add at the end of the transaction callback, after line items insertion but before `return expense;`:

```typescript
    // Auto-reset settlement payments when expenses change
    await tx.delete(settlementPayments).where(eq(settlementPayments.tripId, tripId));
```

- [ ] **Step 4: Add auto-reset to PATCH (update expense)**

In the PATCH handler's transaction (around line 249-301), add before `return result;`:

```typescript
    // Auto-reset settlement payments when expenses change
    await tx.delete(settlementPayments).where(eq(settlementPayments.tripId, tripId));
```

- [ ] **Step 5: Add auto-reset to DELETE (delete expense) — wrap in transaction**

Replace the current DELETE handler body (lines 323-348). The delete needs a transaction now:

```typescript
expenseRoutes.delete("/:tripId/expenses/:expenseId", requireTripAccess("editor"), async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("tripId");
  const expenseId = c.req.param("expenseId");

  const existing = await db.query.expenses.findFirst({
    where: eq(expenses.id, expenseId),
  });

  if (!existing || existing.tripId !== tripId) {
    return c.json({ error: ERROR_MSG.EXPENSE_NOT_FOUND }, 404);
  }

  await db.transaction(async (tx) => {
    await tx.delete(expenses).where(eq(expenses.id, expenseId));
    // Auto-reset settlement payments when expenses change
    await tx.delete(settlementPayments).where(eq(settlementPayments.tripId, tripId));
  });

  logActivity({
    tripId,
    userId: user.id,
    action: "deleted",
    entityType: "expense",
    entityName: existing.title,
    detail: `\u00A5${existing.amount.toLocaleString()}`,
  });

  return c.body(null, 204);
});
```

- [ ] **Step 6: Update existing expense tests for auto-reset**

In `apps/api/src/__tests__/expenses.test.ts`, add `settlementPayments` to `mockDbQuery`:

```typescript
  mockDbQuery: {
    expenses: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    tripMembers: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    trips: {
      findFirst: vi.fn(),
    },
    settlementPayments: {
      findMany: vi.fn(),
    },
  },
```

Also ensure that `mockDbDelete` returns properly for the auto-reset chain. Update the `db` mock's transaction to also expose delete:

The existing mock already exposes `delete` via `tx`, so the transaction-based auto-reset should work. For the GET test, add `mockDbQuery.settlementPayments.findMany.mockResolvedValue([])` in the GET test cases.

In the `beforeEach`:
```typescript
  mockDbQuery.settlementPayments.findMany.mockResolvedValue([]);
```

- [ ] **Step 7: Run all expense tests**

Run: `bun run --filter @sugara/api test -- expenses`

Expected: PASS

- [ ] **Step 8: Run type check**

Run: `bun run check-types`

Expected: PASS (ExpensesResponse now includes settlementPayments and the API returns it)

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/routes/expenses.ts apps/api/src/__tests__/expenses.test.ts
git commit -m "feat: 費用変更時の精算チェック自動リセットと GET レスポンスに settlementPayments を追加"
```

---

### Task 6: Unsettled summary endpoint

**Files:**
- Modify: `apps/api/src/routes/settlement-payments.ts`
- Modify: `apps/api/src/__tests__/settlement-payments.test.ts`

- [ ] **Step 1: Write tests for GET /api/users/:userId/unsettled-summary**

Add to `apps/api/src/__tests__/settlement-payments.test.ts`, in a new describe block. Note: this endpoint is on a different route prefix (`/api/users`), so we need a separate app or route. Since the route is on `settlementPaymentRoutes`, we can add it to the same routes file but mount it differently.

Actually, this endpoint needs to be on a separate route prefix. Add a new route file or add it to the existing profile routes. For simplicity, create it in the settlement-payments routes file but expose it as a separate Hono instance.

Update the test file — add new tests after the existing describe block:

```typescript
import { unsettledSummaryRoutes } from "../routes/settlement-payments";

function makeUnsettledApp() {
  return createTestApp(unsettledSummaryRoutes, "/api/users");
}

describe("Unsettled summary routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAuth(fromUserId);
  });

  describe("GET /api/users/:userId/unsettled-summary", () => {
    it("returns empty summary when no unsettled transfers", async () => {
      mockDbQuery.tripMembers.findMany.mockResolvedValue([]);

      const res = await makeUnsettledApp().request(
        `/api/users/${fromUserId}/unsettled-summary`,
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.totalOwed).toBe(0);
      expect(json.totalOwedTo).toBe(0);
      expect(json.trips).toEqual([]);
    });

    it("rejects if userId does not match caller", async () => {
      const res = await makeUnsettledApp().request(
        `/api/users/other-user/unsettled-summary`,
      );

      expect(res.status).toBe(403);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run --filter @sugara/api test -- settlement-payments`

Expected: FAIL (unsettledSummaryRoutes not exported)

- [ ] **Step 3: Implement unsettled summary endpoint**

Add to `apps/api/src/routes/settlement-payments.ts`, add new imports and a second Hono instance:

```typescript
import { trips } from "../db/schema";
```

After the `settlementPaymentRoutes` export, add:

```typescript
const unsettledSummaryRoutes = new Hono<AppEnv>();
unsettledSummaryRoutes.use("*", requireAuth);

unsettledSummaryRoutes.get("/:userId/unsettled-summary", async (c) => {
  const user = c.get("user");
  const userId = c.req.param("userId");

  if (user.id !== userId) {
    return c.json({ error: "Unauthorized" }, 403);
  }

  // Find all trips where user is a member
  const memberships = await db.query.tripMembers.findMany({
    where: eq(tripMembers.userId, userId),
    with: {
      trip: { columns: { id: true, title: true } },
    },
  });

  let totalOwed = 0;
  let totalOwedTo = 0;
  const unsettledTrips: {
    tripId: string;
    tripTitle: string;
    transfers: { fromUser: { id: string; name: string }; toUser: { id: string; name: string }; amount: number }[];
  }[] = [];

  const tripResults = await Promise.all(
    memberships.map(async (membership) => {
      const trip = membership.trip;
      const [expenseList, members, payments] = await Promise.all([
        db.query.expenses.findMany({
          where: eq(expenses.tripId, trip.id),
          with: { splits: true },
        }),
        db.query.tripMembers.findMany({
          where: eq(tripMembers.tripId, trip.id),
          with: { user: { columns: { id: true, name: true } } },
        }),
        db.query.settlementPayments.findMany({
          where: eq(settlementPayments.tripId, trip.id),
        }),
      ]);
      return { trip, expenseList, members, payments };
    }),
  );

  for (const { trip, expenseList, members, payments } of tripResults) {

    const memberInfos = members.map((m) => ({ id: m.user.id, name: m.user.name }));
    const expenseData = expenseList.map((e) => ({
      paidByUserId: e.paidByUserId,
      amount: e.amount,
      splits: e.splits.map((s) => ({ userId: s.userId, amount: s.amount })),
    }));

    const settlement = calculateSettlement(expenseData, memberInfos);

    // Filter unsettled transfers involving this user
    const unsettledTransfers = settlement.transfers.filter((t) => {
      const isSettled = payments.some(
        (p) => p.fromUserId === t.from.id && p.toUserId === t.to.id && p.amount === t.amount,
      );
      if (isSettled) return false;
      return t.from.id === userId || t.to.id === userId;
    });

    if (unsettledTransfers.length > 0) {
      for (const t of unsettledTransfers) {
        if (t.from.id === userId) totalOwed += t.amount;
        if (t.to.id === userId) totalOwedTo += t.amount;
      }

      unsettledTrips.push({
        tripId: trip.id,
        tripTitle: trip.title,
        transfers: unsettledTransfers.map((t) => ({
          fromUser: t.from,
          toUser: t.to,
          amount: t.amount,
        })),
      });
    }
  }

  return c.json({ totalOwed, totalOwedTo, trips: unsettledTrips });
});

export { settlementPaymentRoutes, unsettledSummaryRoutes };
```

Update the original export line to include both:
Remove the old `export { settlementPaymentRoutes };` at the bottom.

- [ ] **Step 4: Register unsettled summary routes in app.ts**

In `apps/api/src/app.ts`, update the import:

```typescript
import { settlementPaymentRoutes, unsettledSummaryRoutes } from "./routes/settlement-payments";
```

Add after the settlement routes line:

```typescript
app.route("/api/users", unsettledSummaryRoutes);
```

- [ ] **Step 5: Run tests**

Run: `bun run --filter @sugara/api test -- settlement-payments`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/settlement-payments.ts apps/api/src/__tests__/settlement-payments.test.ts apps/api/src/app.ts
git commit -m "feat: 未精算サマリー API エンドポイントを追加"
```

---

## Chunk 3: Frontend — Settlement Section + Activity Log

### Task 7: Activity log updates

**Files:**
- Modify: `apps/web/components/activity-log.tsx`

- [ ] **Step 1: Add settle/unsettle action styles**

In `apps/web/components/activity-log.tsx`, add to `ACTION_STYLES`:

```typescript
  settle: {
    icon: Check,
    color: "bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400",
  },
  unsettle: {
    icon: X,
    color: "bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400",
  },
```

`Check` is already imported but `X` is not. Update the import line to include `X`:

```typescript
import { ArrowRightLeft, Check, Copy, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
```

- [ ] **Step 2: Add settlement action templates**

Add to `ACTION_TEMPLATES`:

```typescript
  settlement: {
    settle: "精算{name}をチェック",
    unsettle: "精算{name}のチェックを解除",
  },
```

- [ ] **Step 3: Run type check and lint**

Run: `bun run check-types && bun run lint`

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/activity-log.tsx
git commit -m "feat: 精算チェック/解除のアクティビティログ表示を追加"
```

---

### Task 8: Query keys update

**Files:**
- Modify: `apps/web/lib/query-keys.ts`

- [ ] **Step 1: Add settlement query keys**

In `apps/web/lib/query-keys.ts`, add to the `expenses` section and add a new `settlement` section:

```typescript
  settlement: {
    all: ["settlement"] as const,
    unsettled: (userId: string) => ["settlement", "unsettled", userId] as const,
  },
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/lib/query-keys.ts
git commit -m "feat: 精算関連のクエリキーを追加"
```

---

### Task 9: Settlement section component

**Files:**
- Create: `apps/web/components/settlement-section.tsx`
- Modify: `apps/web/components/expense-panel.tsx`

- [ ] **Step 1: Create SettlementSection component**

Create `apps/web/components/settlement-section.tsx`:

```typescript
"use client";

import type { Settlement, SettlementPayment } from "@sugara/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { api, getApiErrorMessage } from "@/lib/api";
import { MSG } from "@/lib/messages";
import { queryKeys } from "@/lib/query-keys";

type SettlementSectionProps = {
  tripId: string;
  settlement: Settlement;
  settlementPayments: SettlementPayment[];
  currentUserId: string | undefined;
};

function findPayment(
  payments: SettlementPayment[],
  fromId: string,
  toId: string,
  amount: number,
): SettlementPayment | undefined {
  return payments.find(
    (p) => p.fromUserId === fromId && p.toUserId === toId && p.amount === amount,
  );
}

export function SettlementSection({
  tripId,
  settlement,
  settlementPayments,
  currentUserId,
}: SettlementSectionProps) {
  const queryClient = useQueryClient();
  const transfers = [...settlement.transfers].sort((a, b) => b.amount - a.amount);
  const checkedCount = transfers.filter((t) =>
    findPayment(settlementPayments, t.from.id, t.to.id, t.amount),
  ).length;
  const allChecked = transfers.length > 0 && checkedCount === transfers.length;

  const checkMutation = useMutation({
    mutationFn: (body: { fromUserId: string; toUserId: string; amount: number }) =>
      api(`/api/trips/${tripId}/settlement-payments`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.expenses.list(tripId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.trips.activityLogs(tripId) });
      if (currentUserId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.settlement.unsettled(currentUserId),
        });
      }
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, MSG.SETTLEMENT_CHECK_FAILED, {
        conflict: MSG.SETTLEMENT_ALREADY_CHECKED,
      }));
    },
  });

  const uncheckMutation = useMutation({
    mutationFn: (paymentId: string) =>
      api(`/api/trips/${tripId}/settlement-payments/${paymentId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.expenses.list(tripId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.trips.activityLogs(tripId) });
      if (currentUserId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.settlement.unsettled(currentUserId),
        });
      }
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, MSG.SETTLEMENT_UNCHECK_FAILED));
    },
  });

  const handleToggle = (fromId: string, toId: string, amount: number) => {
    const existing = findPayment(settlementPayments, fromId, toId, amount);
    if (existing) {
      uncheckMutation.mutate(existing.id);
    } else {
      checkMutation.mutate({ fromUserId: fromId, toUserId: toId, amount });
    }
  };

  if (transfers.length === 0) return null;

  return (
    <div className="space-y-1 border-t px-3 pt-2 pb-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">精算</p>
        <span className="text-xs text-emerald-600 dark:text-emerald-400">
          {allChecked ? "精算完了" : `${checkedCount}/${transfers.length} 完了`}
        </span>
      </div>
      {transfers.map((t) => {
        const payment = findPayment(settlementPayments, t.from.id, t.to.id, t.amount);
        const isChecked = !!payment;
        const canToggle =
          currentUserId === t.from.id || currentUserId === t.to.id;
        const isLoading = checkMutation.isPending || uncheckMutation.isPending;

        return (
          <div
            key={`${t.from.id}-${t.to.id}-${t.amount}`}
            className="flex items-center gap-1.5 pl-1 text-sm"
          >
            <Checkbox
              checked={isChecked}
              onCheckedChange={() => handleToggle(t.from.id, t.to.id, t.amount)}
              disabled={!canToggle || isLoading}
              className="h-4 w-4"
            />
            <span
              className={
                isChecked ? "line-through text-muted-foreground" : ""
              }
            >
              {t.from.name}
            </span>
            <ArrowRight
              className={`h-3 w-3 shrink-0 ${isChecked ? "text-muted-foreground/50" : "text-muted-foreground"}`}
            />
            <span
              className={
                isChecked ? "line-through text-muted-foreground" : ""
              }
            >
              {t.to.name}
            </span>
            <span
              className={`ml-auto font-medium ${isChecked ? "line-through text-muted-foreground" : ""}`}
            >
              {t.amount.toLocaleString()}円
            </span>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Update expense-panel.tsx to use SettlementSection**

In `apps/web/components/expense-panel.tsx`, add import:

```typescript
import { SettlementSection } from "@/components/settlement-section";
import { useSession } from "@/lib/auth-client";
```

In the `ExpensePanel` function, add after the existing hooks:

```typescript
  const { data: session } = useSession();
```

Replace the inline settlement section (the `<div className="space-y-1 border-t px-3 pt-2 pb-3">` block with the `精算` label and transfer rows, around lines 158-174) with:

```typescript
                  <SettlementSection
                    tripId={tripId}
                    settlement={settlement}
                    settlementPayments={data.settlementPayments}
                    currentUserId={session?.user?.id}
                  />
```

Also update the destructuring of `data` to include `settlementPayments`. Find the line where `settlement` and `categoryTotals` are used. The data comes from `data` which is typed as `ExpensesResponse`. Since we updated the type, `data.settlementPayments` should be available.

Remove the `ArrowRight` import if it's no longer used elsewhere in the file (it was only used in the settlement section). Check if `ArrowRight` is used elsewhere in expense-panel.tsx — it might be used elsewhere, so check before removing.

- [ ] **Step 3: Verify Checkbox component exists**

Run: `ls apps/web/components/ui/checkbox.tsx`

If it doesn't exist, create `apps/web/components/ui/checkbox.tsx` manually following the shadcn/ui Checkbox pattern (uses `@radix-ui/react-checkbox`). First install the dependency:

Run: `cd apps/web && bun add @radix-ui/react-checkbox && cd ../..`

Then create the component following the existing shadcn/ui component patterns in `apps/web/components/ui/`.

- [ ] **Step 4: Run type check**

Run: `bun run check-types`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/settlement-section.tsx apps/web/components/expense-panel.tsx apps/web/components/ui/checkbox.tsx
git commit -m "feat: 費用タブに精算チェックボックス UI を追加"
```

---

## Chunk 4: Frontend — Profile Summary + Home Badge + FAQs

### Task 10: Unsettled summary on profile page

**Files:**
- Create: `apps/web/components/unsettled-summary.tsx`
- Modify: `apps/web/app/users/[userId]/page.tsx`
- Modify: `apps/web/app/(sp)/sp/users/[userId]/page.tsx`

- [ ] **Step 1: Create UnsettledSummary component**

Create `apps/web/components/unsettled-summary.tsx`:

```typescript
"use client";

import type { UnsettledSummary } from "@sugara/shared";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { api } from "@/lib/api";
import { QUERY_CONFIG } from "@/lib/query-config";
import { queryKeys } from "@/lib/query-keys";

type UnsettledSummarySectionProps = {
  userId: string;
  isOwnProfile: boolean;
};

export function UnsettledSummarySection({ userId, isOwnProfile }: UnsettledSummarySectionProps) {
  const { data } = useQuery({
    queryKey: queryKeys.settlement.unsettled(userId),
    queryFn: () => api<UnsettledSummary>(`/api/users/${userId}/unsettled-summary`),
    enabled: isOwnProfile,
    ...QUERY_CONFIG.stable,
  });

  if (!isOwnProfile || !data || (data.totalOwed === 0 && data.totalOwedTo === 0)) {
    return null;
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold">未精算</p>
      <div className="flex gap-3">
        <div className="flex-1 rounded-lg bg-red-50 p-3 text-center dark:bg-red-950">
          <p className="text-xs text-red-600 dark:text-red-400">支払い残</p>
          <p className="text-lg font-bold text-red-600 dark:text-red-400">
            {data.totalOwed > 0 ? `\u00A5${data.totalOwed.toLocaleString()}` : "-"}
          </p>
        </div>
        <div className="flex-1 rounded-lg bg-emerald-50 p-3 text-center dark:bg-emerald-950">
          <p className="text-xs text-emerald-600 dark:text-emerald-400">受取り残</p>
          <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
            {data.totalOwedTo > 0 ? `\u00A5${data.totalOwedTo.toLocaleString()}` : "-"}
          </p>
        </div>
      </div>

      {data.trips.map((trip) => (
        <div key={trip.tripId} className="overflow-hidden rounded-lg border">
          <div className="border-b bg-muted/50 px-3 py-2 text-xs font-semibold">
            {trip.tripTitle}
          </div>
          {trip.transfers.map((t, i) => {
            const isOwed = t.fromUser.id === userId;
            return (
              <div
                key={`${t.fromUser.id}-${t.toUser.id}-${i}`}
                className="flex items-center justify-between border-b px-3 py-2 text-sm last:border-b-0"
              >
                <span className="flex items-center gap-1">
                  {isOwed ? "あなた" : t.fromUser.name}
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  {isOwed ? t.toUser.name : "あなた"}
                </span>
                <span
                  className={`font-semibold ${
                    isOwed
                      ? "text-red-600 dark:text-red-400"
                      : "text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  {`\u00A5${t.amount.toLocaleString()}`}
                </span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Add UnsettledSummarySection to desktop profile page**

In `apps/web/app/users/[userId]/page.tsx`, find the `ProfileContent` component and add the unsettled summary section. Import and render:

```typescript
import { UnsettledSummarySection } from "@/components/unsettled-summary";
```

In `ProfileContent`, find where the profile sections are rendered and add `UnsettledSummarySection` before the bookmark lists section. Pass `userId` and `isOwnProfile` (compare session user id with the profile user id).

The exact insertion point depends on the file structure. Read the file fully to determine where to place it.

- [ ] **Step 3: Verify SP profile page uses shared ProfileContent**

The SP profile page at `apps/web/app/(sp)/sp/users/[userId]/page.tsx` already imports `ProfileContent` from the desktop page. No separate changes needed if the component is shared.

- [ ] **Step 4: Run type check**

Run: `bun run check-types`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/unsettled-summary.tsx apps/web/app/users/[userId]/page.tsx
git commit -m "feat: プロフィールに未精算サマリーセクションを追加"
```

---

### Task 11: Home badge for unsettled trips

**Files:**
- Modify: `apps/web/components/trip-card.tsx`
- Modify: home page files that render TripCard

- [ ] **Step 1: Add unsettled prop to TripCard**

In `apps/web/components/trip-card.tsx`, add `unsettled` to `TripCardProps`:

```typescript
type TripCardProps = TripListItem & {
  hrefPrefix?: string;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (id: string) => void;
  priority?: boolean;
  unsettled?: boolean;
};
```

Add `unsettled = false` to the destructured props.

In the badge area (around line 67-76, inside the `<div className="flex items-center gap-1.5">` block), add the unsettled badge before the role badge:

```typescript
            {unsettled && (
              <Badge variant="outline" className="text-xs border-red-200 text-red-600 dark:border-red-800 dark:text-red-400">
                未精算
              </Badge>
            )}
```

- [ ] **Step 2: Pass unsettled prop from home pages**

Two files render TripCard: `apps/web/app/(authenticated)/home/page.tsx` (desktop) and `apps/web/app/(sp)/sp/home/page.tsx` (SP).

Neither currently imports `useSession`. Create a shared hook to encapsulate the unsettled trip ID set:

Create `apps/web/lib/hooks/use-unsettled-trip-ids.ts`:

```typescript
import type { UnsettledSummary } from "@sugara/shared";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { api } from "@/lib/api";
import { useSession } from "@/lib/auth-client";
import { QUERY_CONFIG } from "@/lib/query-config";
import { queryKeys } from "@/lib/query-keys";

export function useUnsettledTripIds(): Set<string> {
  const { data: session } = useSession();
  const userId = session?.user?.id;

  const { data } = useQuery({
    queryKey: queryKeys.settlement.unsettled(userId ?? ""),
    queryFn: () => api<UnsettledSummary>(`/api/users/${userId}/unsettled-summary`),
    enabled: !!userId,
    ...QUERY_CONFIG.stable,
  });

  return useMemo(
    () => new Set(data?.trips.map((t) => t.tripId) ?? []),
    [data],
  );
}
```

In `apps/web/app/(authenticated)/home/page.tsx`, add import and use:

```typescript
import { useUnsettledTripIds } from "@/lib/hooks/use-unsettled-trip-ids";
```

Inside the component, add after existing hooks:

```typescript
  const unsettledTripIds = useUnsettledTripIds();
```

Update the TripCard usage (around line 238):

```typescript
                <TripCard
                  {...trip}
                  priority={index === 0}
                  selectable={selectionMode}
                  selected={selectedIds.has(trip.id)}
                  onSelect={handleSelect}
                  unsettled={unsettledTripIds.has(trip.id)}
                />
```

In `apps/web/app/(sp)/sp/home/page.tsx`, add the same import and hook call, and update TripCard usage (around line 162):

```typescript
          <TripCard
            key={trip.id}
            {...trip}
            hrefPrefix="/sp/trips"
            priority={isActive && index === 0}
            selectable={isActive && selectionMode}
            selected={isActive ? selectedIds.has(trip.id) : false}
            onSelect={isActive ? handleSelect : undefined}
            unsettled={unsettledTripIds.has(trip.id)}
          />
```

- [ ] **Step 3: Run type check**

Run: `bun run check-types`

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/trip-card.tsx apps/web/lib/hooks/use-unsettled-trip-ids.ts apps/web/app/(authenticated)/home/page.tsx apps/web/app/(sp)/sp/home/page.tsx
git commit -m "feat: ホーム画面の旅行カードに未精算バッジを追加"
```

---

### Task 12: FAQ updates + seed

**Files:**
- Modify: `apps/api/src/db/seed-faqs.ts`

- [ ] **Step 1: Add settlement FAQs**

In `apps/api/src/db/seed-faqs.ts`, find the expense-related FAQs and add after them:

```typescript
  // ---- Settlement ----
  {
    question: "精算のチェックはどうやってつけますか？",
    answer:
      "費用タブの精算セクションで、各精算の横にあるチェックボックスをタップします。支払う側・受け取る側のどちらでもチェックできます。",
    sortOrder: 161,
  },
  {
    question: "精算のチェックが消えました。なぜですか？",
    answer:
      "費用が追加・編集・削除されると、精算額が変わる可能性があるため、チェックは自動的にリセットされます。",
    sortOrder: 162,
  },
  {
    question: "未精算の確認はどこでできますか？",
    answer:
      "プロフィール画面で全旅行の未精算サマリーを確認できます。また、ホーム画面の旅行カードに「未精算」バッジが表示されます。",
    sortOrder: 163,
  },
```

Adjust `sortOrder` values to fit the existing ordering in the file.

- [ ] **Step 2: Run FAQ seed**

Run: `bun run --filter @sugara/api db:seed-faqs`

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/db/seed-faqs.ts
git commit -m "docs: 精算チェック機能の FAQ を追加"
```

---

### Task 13: Final verification

- [ ] **Step 1: Run all tests**

Run: `bun run test`

Expected: All tests PASS

- [ ] **Step 2: Run type check**

Run: `bun run check-types`

Expected: PASS

- [ ] **Step 3: Run lint and format**

Run: `bun run check`

Expected: PASS

- [ ] **Step 4: Verify build**

Run: `bun run build`

Expected: PASS
