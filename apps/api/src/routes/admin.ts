import { and, count, countDistinct, eq, gte, sql } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/index";
import { appSettings, schedules, sessions, souvenirItems, trips, users } from "../db/schema";
import { getAppSettings } from "../lib/app-settings";
import { requireAuth } from "../middleware/auth";
import { requireAdmin } from "../middleware/require-admin";
import type { AppEnv } from "../types";

type TripStatus = "scheduling" | "draft" | "planned" | "active" | "completed";

const adminRoutes = new Hono<AppEnv>();

// Resolves with the value or rejects with Error("query_timeout") after ms milliseconds.
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error("query_timeout")), ms);
    promise.then(
      (v) => {
        clearTimeout(id);
        resolve(v);
      },
      (e) => {
        clearTimeout(id);
        reject(e);
      },
    );
  });
}

async function fetchStats(sevenDaysAgo: Date, thirtyDaysAgo: Date) {
  // Run sequentially rather than via Promise.all to avoid Supavisor (Supabase's
  // Transaction Pooler) pipeline stalls. Concurrent queries cause PostgreSQL to enter
  // ClientRead wait — Supavisor finishes the query but doesn't forward results back —
  // leading to indefinite hangs. Sequential execution avoids pipelining entirely.
  const totalUsersResult = await db
    .select({ count: count() })
    .from(users)
    .where(eq(users.isAnonymous, false));
  const guestUsersResult = await db
    .select({ count: count() })
    .from(users)
    .where(eq(users.isAnonymous, true));
  const newUsers7dResult = await db
    .select({ count: count() })
    .from(users)
    .where(and(eq(users.isAnonymous, false), gte(users.createdAt, sevenDaysAgo)));
  const newUsers30dResult = await db
    .select({ count: count() })
    .from(users)
    .where(and(eq(users.isAnonymous, false), gte(users.createdAt, thirtyDaysAgo)));
  const tripStatusResult = await db
    .select({ status: trips.status, count: count() })
    .from(trips)
    .groupBy(trips.status);
  const newTrips7dResult = await db
    .select({ count: count() })
    .from(trips)
    .where(gte(trips.createdAt, sevenDaysAgo));
  const totalSchedulesResult = await db.select({ count: count() }).from(schedules);
  const totalSouvenirsResult = await db.select({ count: count() }).from(souvenirItems);
  // MAU: distinct users who created a session in the last 30 days.
  // COUNT(DISTINCT) in DB is far cheaper than SELECT DISTINCT + JS count.
  // Uses createdAt because updatedAt was added manually and has NULL for all existing rows.
  const mauResult = await db
    .select({ count: countDistinct(sessions.userId) })
    .from(sessions)
    .where(gte(sessions.createdAt, thirtyDaysAgo));
  // DB size in bytes. pg_database_size returns bigint; postgres.js serializes
  // bigint as string, so Number() conversion is safe for sizes below 2^53.
  const dbSizeResult = await db.execute(sql`SELECT pg_database_size(current_database()) AS size`);

  return {
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
  };
}

adminRoutes.get("/api/admin/settings", requireAuth, requireAdmin, async (c) => {
  const settings = await getAppSettings();
  return c.json({ signupEnabled: settings.signupEnabled });
});

adminRoutes.patch("/api/admin/settings", requireAuth, requireAdmin, async (c) => {
  const body = await c.req.json<{ signupEnabled: unknown }>();

  if (typeof body.signupEnabled !== "boolean") {
    return c.json({ error: "signupEnabled must be a boolean" }, 400);
  }

  await db
    .update(appSettings)
    .set({ signupEnabled: body.signupEnabled })
    .where(eq(appSettings.id, 1));

  return c.json({ signupEnabled: body.signupEnabled });
});

adminRoutes.get("/api/admin/stats", requireAuth, requireAdmin, async (c) => {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  let stats: Awaited<ReturnType<typeof fetchStats>>;
  try {
    stats = await withTimeout(fetchStats(sevenDaysAgo, thirtyDaysAgo), 20_000);
  } catch (err) {
    if (err instanceof Error && err.message === "query_timeout") {
      console.error("[admin/stats] query timeout after 20s");
      return c.json({ error: "Query timeout" }, 504);
    }
    throw err;
  }

  const {
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
  } = stats;

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
      mau: Number(mauResult[0]?.count ?? 0),
      dbSizeBytes: Number((dbSizeResult[0] as { size: string }).size),
    },
  });
});

export { adminRoutes };
