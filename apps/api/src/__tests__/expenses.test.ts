import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetSession,
  mockDbQuery,
  mockDbInsert,
  mockDbUpdate,
  mockDbDelete,
  mockDbSelect,
  mockCreateNotification,
  mockNotifyUsers,
} = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
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
  },
  mockDbInsert: vi.fn(),
  mockDbUpdate: vi.fn(),
  mockDbDelete: vi.fn(),
  mockDbSelect: vi.fn(),
  mockCreateNotification: vi.fn(),
  mockNotifyUsers: vi.fn(),
}));

vi.mock("../lib/auth", () => ({
  auth: {
    api: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
    },
  },
}));

vi.mock("../db/index", () => {
  const tx = {
    query: mockDbQuery,
    insert: (...args: unknown[]) => mockDbInsert(...args),
    update: (...args: unknown[]) => mockDbUpdate(...args),
    delete: (...args: unknown[]) => mockDbDelete(...args),
    select: (...args: unknown[]) => mockDbSelect(...args),
  };
  return {
    db: { ...tx, transaction: (fn: (t: typeof tx) => unknown) => fn(tx) },
  };
});

vi.mock("../lib/activity-logger", () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../lib/notifications", () => ({
  createNotification: (...args: unknown[]) => mockCreateNotification(...args),
  notifyUsers: (...args: unknown[]) => mockNotifyUsers(...args),
}));

import { MAX_EXPENSES_PER_TRIP } from "@sugara/shared";
import { logActivity } from "../lib/activity-logger";
import { expenseRoutes } from "../routes/expenses";
import { createTestApp, TEST_USER } from "./test-helpers";

const fakeUser = TEST_USER;
const tripId = "trip-1";
// UUID values for Zod validation
const userId1 = "00000000-0000-0000-0000-000000000001";
const userId2 = "00000000-0000-0000-0000-000000000002";

function setupAuth(role: "owner" | "editor" | "viewer" = "owner") {
  mockGetSession.mockResolvedValue({
    user: fakeUser,
    session: { id: "session-1" },
  });
  mockDbQuery.tripMembers.findFirst.mockResolvedValue({
    tripId,
    userId: fakeUser.id,
    role,
  });
}

function makeApp() {
  return createTestApp(expenseRoutes, "/api/trips");
}

function mockCountQuery(count: number) {
  mockDbSelect.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([{ count }]),
    }),
  });
}

describe("Expense routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAuth();
    mockDbQuery.trips.findFirst.mockResolvedValue({ title: "テスト旅行" });
    mockCreateNotification.mockResolvedValue(undefined);
  });

  describe("GET /api/trips/:tripId/expenses", () => {
    it("returns empty expenses and settlement", async () => {
      mockDbQuery.expenses.findMany.mockResolvedValue([]);
      mockDbQuery.tripMembers.findMany.mockResolvedValue([
        { userId: fakeUser.id, user: { id: fakeUser.id, name: fakeUser.name } },
      ]);

      const res = await makeApp().request(`/api/trips/${tripId}/expenses`);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.expenses).toEqual([]);
      expect(json.settlement.totalAmount).toBe(0);
      expect(json.settlement.transfers).toEqual([]);
    });

    it("returns expenses with splits and settlement", async () => {
      mockDbQuery.expenses.findMany.mockResolvedValue([
        {
          id: "exp-1",
          title: "Dinner",
          amount: 1000,
          splitType: "equal",
          paidByUserId: userId1,
          paidByUser: { id: userId1, name: "User 1" },
          splits: [
            { userId: userId1, amount: 500, user: { id: userId1, name: "User 1" } },
            { userId: userId2, amount: 500, user: { id: userId2, name: "User 2" } },
          ],
          createdAt: "2026-01-01T00:00:00Z",
        },
      ]);
      mockDbQuery.tripMembers.findMany.mockResolvedValue([
        { userId: userId1, user: { id: userId1, name: "User 1" } },
        { userId: userId2, user: { id: userId2, name: "User 2" } },
      ]);

      const res = await makeApp().request(`/api/trips/${tripId}/expenses`);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.expenses).toHaveLength(1);
      expect(json.expenses[0].title).toBe("Dinner");
      expect(json.settlement.totalAmount).toBe(1000);
      expect(json.settlement.transfers).toHaveLength(1);
    });

    it("allows viewer access", async () => {
      setupAuth("viewer");
      mockDbQuery.expenses.findMany.mockResolvedValue([]);
      mockDbQuery.tripMembers.findMany.mockResolvedValue([]);

      const res = await makeApp().request(`/api/trips/${tripId}/expenses`);
      expect(res.status).toBe(200);
    });
  });

  describe("POST /api/trips/:tripId/expenses", () => {
    const validBody = {
      title: "Dinner",
      amount: 1000,
      paidByUserId: userId1,
      splitType: "equal" as const,
      splits: [{ userId: userId1 }, { userId: userId2 }],
    };

    it("creates expense with equal split", async () => {
      mockDbQuery.tripMembers.findMany.mockResolvedValue([
        { userId: userId1 },
        { userId: userId2 },
      ]);
      mockCountQuery(0);
      // First insert returns expense, second insert (splits) also needs mock
      mockDbInsert
        .mockReturnValueOnce({
          values: vi.fn().mockReturnValue({
            returning: vi
              .fn()
              .mockResolvedValueOnce([{ id: "exp-1", ...validBody, createdAt: new Date() }]),
          }),
        })
        .mockReturnValueOnce({
          values: vi.fn().mockResolvedValueOnce(undefined),
        });

      const res = await makeApp().request(`/api/trips/${tripId}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      });

      expect(res.status).toBe(201);
      expect(logActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          tripId,
          action: "created",
          entityType: "expense",
          entityName: "Dinner",
        }),
      );
    });

    it("creates expense with custom split", async () => {
      const customBody = {
        title: "Hotel",
        amount: 1000,
        paidByUserId: userId1,
        splitType: "custom",
        splits: [
          { userId: userId1, amount: 300 },
          { userId: userId2, amount: 700 },
        ],
      };
      mockDbQuery.tripMembers.findMany.mockResolvedValue([
        { userId: userId1 },
        { userId: userId2 },
      ]);
      mockCountQuery(0);
      mockDbInsert
        .mockReturnValueOnce({
          values: vi.fn().mockReturnValue({
            returning: vi
              .fn()
              .mockResolvedValueOnce([{ id: "exp-2", ...customBody, createdAt: new Date() }]),
          }),
        })
        .mockReturnValueOnce({
          values: vi.fn().mockResolvedValueOnce(undefined),
        });

      const res = await makeApp().request(`/api/trips/${tripId}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(customBody),
      });

      expect(res.status).toBe(201);
    });

    it("creates expense with itemized split and line items", async () => {
      const itemizedBody = {
        title: "居酒屋",
        amount: 5000,
        paidByUserId: userId1,
        splitType: "itemized",
        splits: [
          { userId: userId1, amount: 3000 },
          { userId: userId2, amount: 2000 },
        ],
        lineItems: [
          { name: "料理", amount: 3000, memberIds: [userId1, userId2] },
          { name: "ビール", amount: 2000, memberIds: [userId1] },
        ],
      };
      mockDbQuery.tripMembers.findMany.mockResolvedValue([
        { userId: userId1 },
        { userId: userId2 },
      ]);
      mockCountQuery(0);
      mockDbInsert
        .mockReturnValueOnce({
          values: vi.fn().mockReturnValue({
            returning: vi
              .fn()
              .mockResolvedValueOnce([{ id: "exp-3", ...itemizedBody, createdAt: new Date() }]),
          }),
        })
        .mockReturnValueOnce({
          values: vi.fn().mockResolvedValueOnce(undefined),
        })
        // lineItem 1 insert + returning
        .mockReturnValueOnce({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValueOnce([{ id: "li-1" }]),
          }),
        })
        // lineItem 1 members insert
        .mockReturnValueOnce({
          values: vi.fn().mockResolvedValueOnce(undefined),
        })
        // lineItem 2 insert + returning
        .mockReturnValueOnce({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValueOnce([{ id: "li-2" }]),
          }),
        })
        // lineItem 2 members insert
        .mockReturnValueOnce({
          values: vi.fn().mockResolvedValueOnce(undefined),
        });

      const res = await makeApp().request(`/api/trips/${tripId}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(itemizedBody),
      });

      expect(res.status).toBe(201);
      // Verify line items were inserted (expense + splits + 2*(lineItem + members) = 6 inserts)
      expect(mockDbInsert).toHaveBeenCalledTimes(6);
    });

    it("returns 400 when itemized split total does not match amount", async () => {
      const res = await makeApp().request(`/api/trips/${tripId}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "居酒屋",
          amount: 5000,
          paidByUserId: userId1,
          splitType: "itemized",
          splits: [
            { userId: userId1, amount: 2000 },
            { userId: userId2, amount: 2000 },
          ],
          lineItems: [{ name: "料理", amount: 4000, memberIds: [userId1, userId2] }],
        }),
      });

      expect(res.status).toBe(400);
    });

    it("returns 400 when lineItem memberIds contains non-member", async () => {
      mockDbQuery.tripMembers.findMany.mockResolvedValue([
        { userId: userId1 },
        { userId: userId2 },
      ]);
      mockCountQuery(0);
      const nonMemberId = "00000000-0000-0000-0000-000000000099";

      const res = await makeApp().request(`/api/trips/${tripId}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "居酒屋",
          amount: 5000,
          paidByUserId: userId1,
          splitType: "itemized",
          splits: [
            { userId: userId1, amount: 3000 },
            { userId: userId2, amount: 2000 },
          ],
          lineItems: [{ name: "料理", amount: 5000, memberIds: [userId1, nonMemberId] }],
        }),
      });

      expect(res.status).toBe(400);
    });

    it("returns 400 when itemized split has no lineItems", async () => {
      const res = await makeApp().request(`/api/trips/${tripId}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "居酒屋",
          amount: 5000,
          paidByUserId: userId1,
          splitType: "itemized",
          splits: [
            { userId: userId1, amount: 3000 },
            { userId: userId2, amount: 2000 },
          ],
        }),
      });

      expect(res.status).toBe(400);
    });

    it("returns 400 for empty title", async () => {
      const res = await makeApp().request(`/api/trips/${tripId}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...validBody, title: "" }),
      });

      expect(res.status).toBe(400);
    });

    it("returns 400 for amount 0", async () => {
      const res = await makeApp().request(`/api/trips/${tripId}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...validBody, amount: 0 }),
      });

      expect(res.status).toBe(400);
    });

    it("returns 400 when splits have duplicate userId", async () => {
      const res = await makeApp().request(`/api/trips/${tripId}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...validBody,
          splits: [{ userId: userId1 }, { userId: userId1 }],
        }),
      });

      expect(res.status).toBe(400);
    });

    it("returns 400 when custom split total does not match amount", async () => {
      const res = await makeApp().request(`/api/trips/${tripId}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...validBody,
          splitType: "custom",
          splits: [
            { userId: userId1, amount: 300 },
            { userId: userId2, amount: 300 },
          ],
        }),
      });

      expect(res.status).toBe(400);
    });

    it("returns 400 when paidByUserId is not a member", async () => {
      mockDbQuery.tripMembers.findMany.mockResolvedValue([{ userId: userId2 }]);
      mockCountQuery(0);

      const res = await makeApp().request(`/api/trips/${tripId}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      });

      expect(res.status).toBe(400);
    });

    it("returns 409 when expense limit reached", async () => {
      mockDbQuery.tripMembers.findMany.mockResolvedValue([
        { userId: userId1 },
        { userId: userId2 },
      ]);
      mockCountQuery(MAX_EXPENSES_PER_TRIP);

      const res = await makeApp().request(`/api/trips/${tripId}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      });

      expect(res.status).toBe(409);
    });

    it("returns 404 for viewer", async () => {
      setupAuth("viewer");

      const res = await makeApp().request(`/api/trips/${tripId}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      });

      expect(res.status).toBe(404);
    });

    it("POST: 経費作成時に splits の他ユーザーに createNotification を呼ぶ", async () => {
      mockDbQuery.tripMembers.findMany.mockResolvedValue([
        { userId: userId1 },
        { userId: userId2 },
      ]);
      mockCountQuery(0);
      mockDbInsert
        .mockReturnValueOnce({
          values: vi.fn().mockReturnValue({
            returning: vi
              .fn()
              .mockResolvedValueOnce([{ id: "exp-1", ...validBody, createdAt: new Date() }]),
          }),
        })
        .mockReturnValueOnce({
          values: vi.fn().mockResolvedValueOnce(undefined),
        });

      await makeApp().request(`/api/trips/${tripId}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      });

      expect(mockNotifyUsers).toHaveBeenCalledWith(
        expect.objectContaining({ type: "expense_added" }),
      );
    });
  });

  describe("PATCH /api/trips/:tripId/expenses/:expenseId", () => {
    it("updates expense title", async () => {
      mockDbQuery.expenses.findFirst.mockResolvedValue({
        id: "exp-1",
        tripId,
        title: "Old title",
        amount: 1000,
        splitType: "equal",
      });
      const updatedExpense = { id: "exp-1", title: "New title", amount: 1000 };
      mockDbUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedExpense]),
          }),
        }),
      });

      const res = await makeApp().request(`/api/trips/${tripId}/expenses/exp-1`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New title" }),
      });

      expect(res.status).toBe(200);
      // lineItems should NOT be deleted when only title changes
      expect(mockDbDelete).not.toHaveBeenCalled();
    });

    it("updates expense with splits in transaction", async () => {
      mockDbQuery.expenses.findFirst.mockResolvedValue({
        id: "exp-1",
        tripId,
        title: "Dinner",
        amount: 1000,
        splitType: "equal",
      });
      mockDbQuery.tripMembers.findMany.mockResolvedValue([
        { userId: userId1 },
        { userId: userId2 },
      ]);
      const updatedExpense = { id: "exp-1", title: "Dinner", amount: 2000 };
      mockDbUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedExpense]),
          }),
        }),
      });
      mockDbDelete.mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });
      mockDbInsert.mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      });

      const res = await makeApp().request(`/api/trips/${tripId}/expenses/exp-1`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: 2000,
          splitType: "equal",
          splits: [{ userId: userId1 }, { userId: userId2 }],
        }),
      });

      expect(res.status).toBe(200);
    });

    it("returns 400 when paidByUserId is not a member", async () => {
      mockDbQuery.expenses.findFirst.mockResolvedValue({
        id: "exp-1",
        tripId,
        title: "Dinner",
        amount: 1000,
        splitType: "equal",
      });
      mockDbQuery.tripMembers.findMany.mockResolvedValue([{ userId: userId2 }]);

      const res = await makeApp().request(`/api/trips/${tripId}/expenses/exp-1`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paidByUserId: userId1 }),
      });

      expect(res.status).toBe(400);
    });

    it("returns 400 when split user is not a member", async () => {
      mockDbQuery.expenses.findFirst.mockResolvedValue({
        id: "exp-1",
        tripId,
        title: "Dinner",
        amount: 1000,
        splitType: "equal",
      });
      mockDbQuery.tripMembers.findMany.mockResolvedValue([{ userId: userId1 }]);

      const res = await makeApp().request(`/api/trips/${tripId}/expenses/exp-1`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          splits: [{ userId: userId1 }, { userId: userId2 }],
        }),
      });

      expect(res.status).toBe(400);
    });

    it("returns 404 for non-existent expense", async () => {
      mockDbQuery.expenses.findFirst.mockResolvedValue(null);

      const res = await makeApp().request(`/api/trips/${tripId}/expenses/non-existent`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New title" }),
      });

      expect(res.status).toBe(404);
    });

    it("updates itemized expense line items", async () => {
      mockDbQuery.expenses.findFirst.mockResolvedValue({
        id: "exp-1",
        tripId,
        title: "居酒屋",
        amount: 5000,
        splitType: "itemized",
      });
      mockDbQuery.tripMembers.findMany.mockResolvedValue([
        { userId: userId1 },
        { userId: userId2 },
      ]);
      const updatedExpense = { id: "exp-1", title: "居酒屋", amount: 6000 };
      mockDbUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedExpense]),
          }),
        }),
      });
      mockDbDelete.mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });
      mockDbInsert
        // splits insert
        .mockReturnValueOnce({
          values: vi.fn().mockResolvedValueOnce(undefined),
        })
        // lineItem 1 insert
        .mockReturnValueOnce({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValueOnce([{ id: "li-1" }]),
          }),
        })
        // lineItem 1 members
        .mockReturnValueOnce({
          values: vi.fn().mockResolvedValueOnce(undefined),
        })
        // lineItem 2 insert
        .mockReturnValueOnce({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValueOnce([{ id: "li-2" }]),
          }),
        })
        // lineItem 2 members
        .mockReturnValueOnce({
          values: vi.fn().mockResolvedValueOnce(undefined),
        });

      const res = await makeApp().request(`/api/trips/${tripId}/expenses/exp-1`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "居酒屋",
          amount: 6000,
          splitType: "itemized",
          splits: [
            { userId: userId1, amount: 4000 },
            { userId: userId2, amount: 2000 },
          ],
          lineItems: [
            { name: "料理", amount: 4000, memberIds: [userId1, userId2] },
            { name: "ソフトドリンク", amount: 2000, memberIds: [userId2] },
          ],
        }),
      });

      expect(res.status).toBe(200);
      // delete is called twice: once for splits, once for lineItems
      expect(mockDbDelete).toHaveBeenCalledTimes(2);
    });

    it("amount のみ更新で既存 splits 合計と不一致の場合 400 を返す", async () => {
      mockDbQuery.expenses.findFirst.mockResolvedValue({
        id: "exp-1",
        tripId,
        amount: 1000,
        splitType: "custom",
      });
      // biome-ignore lint/suspicious/noExplicitAny: dynamic mock property addition
      (mockDbQuery as any).expenseSplits = {
        findMany: vi.fn().mockResolvedValue([
          { userId: userId1, amount: 600 },
          { userId: userId2, amount: 400 },
        ]),
      };

      const res = await makeApp().request(`/api/trips/${tripId}/expenses/exp-1`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        // amount のみ変更, splits なし → 既存 splits 合計 1000 ≠ 新 amount 2000
        body: JSON.stringify({ amount: 2000 }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe("DELETE /api/trips/:tripId/expenses/:expenseId", () => {
    it("deletes expense and returns 204", async () => {
      mockDbQuery.expenses.findFirst.mockResolvedValue({
        id: "exp-1",
        tripId,
        title: "Dinner",
        amount: 1000,
      });
      mockDbDelete.mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      const res = await makeApp().request(`/api/trips/${tripId}/expenses/exp-1`, {
        method: "DELETE",
      });

      expect(res.status).toBe(204);
      expect(logActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          tripId,
          action: "deleted",
          entityType: "expense",
          entityName: "Dinner",
        }),
      );
    });

    it("returns 404 for non-existent expense", async () => {
      mockDbQuery.expenses.findFirst.mockResolvedValue(null);

      const res = await makeApp().request(`/api/trips/${tripId}/expenses/non-existent`, {
        method: "DELETE",
      });

      expect(res.status).toBe(404);
    });
  });
});
