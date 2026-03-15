import { createSettlementPaymentSchema } from "@sugara/shared";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/index";
import { expenses, settlementPayments, tripMembers } from "../db/schema";
import { logActivity } from "../lib/activity-logger";
import { PG_UNIQUE_VIOLATION } from "../lib/constants";
import { notifyUsers } from "../lib/notifications";
import { getParam } from "../lib/params";
import { calculateSettlement } from "../lib/settlement";
import { requireAuth } from "../middleware/auth";
import { requireTripAccess } from "../middleware/require-trip-access";
import type { AppEnv } from "../types";

const settlementPaymentRoutes = new Hono<AppEnv>();
settlementPaymentRoutes.use("*", requireAuth);

// Create settlement payment (mark transfer as paid)
settlementPaymentRoutes.post("/:tripId/settlement-payments", requireTripAccess(), async (c) => {
  const user = c.get("user");
  const tripId = getParam(c, "tripId");

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
      entityName: `${fromName} \u2192 ${toName}`,
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
        entityName: `${fromName} \u2192 ${toName} \u00A5${amount.toLocaleString()}`,
      }),
    });

    return c.json(payment, 201);
  } catch (err: unknown) {
    if (err instanceof Error && "code" in err && err.code === PG_UNIQUE_VIOLATION) {
      return c.json({ error: "Settlement already checked" }, 409);
    }
    throw err;
  }
});

// Delete settlement payment (uncheck)
settlementPaymentRoutes.delete(
  "/:tripId/settlement-payments/:id",
  requireTripAccess(),
  async (c) => {
    const user = c.get("user");
    const tripId = getParam(c, "tripId");
    const id = getParam(c, "id");

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
      entityName: `${fromName} \u2192 ${toName}`,
      detail: `\u00A5${existing.amount.toLocaleString()}`,
    });

    return c.body(null, 204);
  },
);

const unsettledSummaryRoutes = new Hono<AppEnv>();
unsettledSummaryRoutes.use("*", requireAuth);

unsettledSummaryRoutes.get("/:userId/unsettled-summary", async (c) => {
  const user = c.get("user");
  const userId = getParam(c, "userId");

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
    transfers: {
      fromUser: { id: string; name: string };
      toUser: { id: string; name: string };
      amount: number;
    }[];
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
