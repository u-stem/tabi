import { createExpenseSchema, MAX_EXPENSES_PER_TRIP, updateExpenseSchema } from "@sugara/shared";
import { count, eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/index";
import { expenseSplits, expenses, tripMembers } from "../db/schema";
import { logActivity } from "../lib/activity-logger";
import { ERROR_MSG } from "../lib/constants";
import { calculateEqualSplit, calculateSettlement } from "../lib/settlement";
import { requireAuth } from "../middleware/auth";
import { requireTripAccess } from "../middleware/require-trip-access";
import type { AppEnv } from "../types";

const expenseRoutes = new Hono<AppEnv>();
expenseRoutes.use("*", requireAuth);

// List expenses with settlement summary
expenseRoutes.get("/:tripId/expenses", requireTripAccess(), async (c) => {
  const tripId = c.req.param("tripId");

  const [expenseList, members] = await Promise.all([
    db.query.expenses.findMany({
      where: eq(expenses.tripId, tripId),
      with: {
        paidByUser: { columns: { id: true, name: true } },
        splits: { with: { user: { columns: { id: true, name: true } } } },
      },
      orderBy: (expenses, { desc }) => [desc(expenses.createdAt)],
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

  return c.json({ expenses: expenseList, settlement });
});

// Create expense
expenseRoutes.post("/:tripId/expenses", requireTripAccess("editor"), async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("tripId");

  const body = await c.req.json();
  const parsed = createExpenseSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const { title, amount, paidByUserId, splitType, splits } = parsed.data;

  // Check expense count limit
  const [{ count: expenseCount }] = await db
    .select({ count: count() })
    .from(expenses)
    .where(eq(expenses.tripId, tripId));

  if (expenseCount >= MAX_EXPENSES_PER_TRIP) {
    return c.json({ error: ERROR_MSG.LIMIT_EXPENSES }, 409);
  }

  // Verify all users are trip members
  const members = await db.query.tripMembers.findMany({
    where: eq(tripMembers.tripId, tripId),
  });
  const memberIds = new Set(members.map((m) => m.userId));

  if (!memberIds.has(paidByUserId)) {
    return c.json({ error: ERROR_MSG.EXPENSE_PAYER_NOT_MEMBER }, 400);
  }

  const allSplitUserIds = splits.map((s) => s.userId);
  if (allSplitUserIds.some((id) => !memberIds.has(id))) {
    return c.json({ error: ERROR_MSG.EXPENSE_SPLIT_USER_NOT_MEMBER }, 400);
  }

  // Calculate split amounts for equal type
  const splitAmounts =
    splitType === "equal"
      ? calculateEqualSplit(amount, splits.length)
      : splits.map((s) => s.amount!);

  const result = await db.transaction(async (tx) => {
    const [expense] = await tx
      .insert(expenses)
      .values({ tripId, paidByUserId, title, amount, splitType })
      .returning();

    await tx.insert(expenseSplits).values(
      splits.map((s, i) => ({
        expenseId: expense.id,
        userId: s.userId,
        amount: splitAmounts[i],
      })),
    );

    return expense;
  });

  logActivity({
    tripId,
    userId: user.id,
    action: "created",
    entityType: "expense",
    entityName: title,
    detail: `\u00A5${amount.toLocaleString()}`,
  });

  return c.json(result, 201);
});

// Update expense
expenseRoutes.patch("/:tripId/expenses/:expenseId", requireTripAccess("editor"), async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("tripId");
  const expenseId = c.req.param("expenseId");

  const body = await c.req.json();
  const parsed = updateExpenseSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const existing = await db.query.expenses.findFirst({
    where: eq(expenses.id, expenseId),
  });

  if (!existing || existing.tripId !== tripId) {
    return c.json({ error: ERROR_MSG.EXPENSE_NOT_FOUND }, 404);
  }

  const { splits, ...updateFields } = parsed.data;

  // Verify member constraints when paidByUserId or splits change
  if (updateFields.paidByUserId || splits) {
    const members = await db.query.tripMembers.findMany({
      where: eq(tripMembers.tripId, tripId),
    });
    const memberIds = new Set(members.map((m) => m.userId));

    if (updateFields.paidByUserId && !memberIds.has(updateFields.paidByUserId)) {
      return c.json({ error: ERROR_MSG.EXPENSE_PAYER_NOT_MEMBER }, 400);
    }

    if (splits?.some((s) => !memberIds.has(s.userId))) {
      return c.json({ error: ERROR_MSG.EXPENSE_SPLIT_USER_NOT_MEMBER }, 400);
    }
  }

  const updated = await db.transaction(async (tx) => {
    const [result] = await tx
      .update(expenses)
      .set({ ...updateFields, updatedAt: new Date() })
      .where(eq(expenses.id, expenseId))
      .returning();

    if (splits) {
      const finalAmount = updateFields.amount ?? existing.amount;
      const finalSplitType = updateFields.splitType ?? existing.splitType;
      const splitAmounts =
        finalSplitType === "equal"
          ? calculateEqualSplit(finalAmount, splits.length)
          : splits.map((s) => s.amount!);

      await tx.delete(expenseSplits).where(eq(expenseSplits.expenseId, expenseId));
      await tx.insert(expenseSplits).values(
        splits.map((s, i) => ({
          expenseId,
          userId: s.userId,
          amount: splitAmounts[i],
        })),
      );
    }

    return result;
  });

  const oldAmount = existing.amount;
  const newAmount = updated.amount;
  const detail =
    oldAmount !== newAmount
      ? `\u00A5${oldAmount.toLocaleString()} → \u00A5${newAmount.toLocaleString()}`
      : `\u00A5${newAmount.toLocaleString()}`;

  logActivity({
    tripId,
    userId: user.id,
    action: "updated",
    entityType: "expense",
    entityName: updated.title,
    detail,
  });

  return c.json(updated);
});

// Delete expense
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

  await db.delete(expenses).where(eq(expenses.id, expenseId));

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

export { expenseRoutes };
