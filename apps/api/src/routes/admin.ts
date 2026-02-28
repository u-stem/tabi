import { and, count, eq, gte, sql } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/index";
import { schedules, sessions, souvenirItems, trips, users } from "../db/schema";
import { requireAuth } from "../middleware/auth";
import { requireAdmin } from "../middleware/require-admin";
import type { AppEnv } from "../types";

type TripStatus = "scheduling" | "draft" | "planned" | "active" | "completed";

const adminRoutes = new Hono<AppEnv>();

adminRoutes.get("/api/admin/stats", requireAuth, requireAdmin, async (c) => {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalUsersResult,
    guestUsersResult,
    newUsers7dResult,
    newUsers30dResult,
    tripStatusResult,
    newTrips7dResult,
    totalSchedulesResult,
    totalSouvenirsResult,
    mauResult,
    dbSizeResult,
  ] = await Promise.all([
    // Non-guest users
    db.select({ count: count() }).from(users).where(eq(users.isAnonymous, false)),
    // Guest users
    db.select({ count: count() }).from(users).where(eq(users.isAnonymous, true)),
    // New non-guest users in last 7 days
    db
      .select({ count: count() })
      .from(users)
      .where(and(eq(users.isAnonymous, false), gte(users.createdAt, sevenDaysAgo))),
    // New non-guest users in last 30 days
    db
      .select({ count: count() })
      .from(users)
      .where(and(eq(users.isAnonymous, false), gte(users.createdAt, thirtyDaysAgo))),
    // Trips grouped by status
    db.select({ status: trips.status, count: count() }).from(trips).groupBy(trips.status),
    // New trips in last 7 days
    db.select({ count: count() }).from(trips).where(gte(trips.createdAt, sevenDaysAgo)),
    // Total schedules
    db.select({ count: count() }).from(schedules),
    // Total souvenir items
    db.select({ count: count() }).from(souvenirItems),
    // MAU: distinct users with session activity in last 30 days.
    // updatedAt reflects session refreshes by Better Auth, capturing returning users
    // who logged in before the window but remained active.
    db
      .selectDistinct({ userId: sessions.userId })
      .from(sessions)
      .where(gte(sessions.updatedAt, thirtyDaysAgo)),
    // DB size in bytes. pg_database_size returns bigint; postgres.js serializes
    // bigint as string, so Number() conversion is safe for sizes below 2^53.
    db.execute(sql`SELECT pg_database_size(current_database()) AS size`),
  ]);

  // Build trips.byStatus map
  const statusMap: Record<TripStatus, number> = {
    scheduling: 0,
    draft: 0,
    planned: 0,
    active: 0,
    completed: 0,
  };
  for (const row of tripStatusResult) {
    statusMap[row.status] = Number(row.count);
  }
  const totalTrips = Object.values(statusMap).reduce((a, b) => a + b, 0);

  return c.json({
    users: {
      total: Number(totalUsersResult[0]?.count ?? 0),
      guest: Number(guestUsersResult[0]?.count ?? 0),
      newLast7Days: Number(newUsers7dResult[0]?.count ?? 0),
      newLast30Days: Number(newUsers30dResult[0]?.count ?? 0),
    },
    trips: {
      total: totalTrips,
      byStatus: statusMap,
      newLast7Days: Number(newTrips7dResult[0]?.count ?? 0),
    },
    content: {
      schedules: Number(totalSchedulesResult[0]?.count ?? 0),
      souvenirs: Number(totalSouvenirsResult[0]?.count ?? 0),
    },
    supabase: {
      mau: mauResult.length,
      dbSizeBytes: Number((dbSizeResult[0] as { size: string }).size),
    },
  });
});

export { adminRoutes };
