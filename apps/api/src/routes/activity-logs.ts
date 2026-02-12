import { and, desc, eq, lt } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/index";
import { activityLogs, users } from "../db/schema";
import { ERROR_MSG, MAX_LOGS_PER_TRIP } from "../lib/constants";
import { checkTripAccess } from "../lib/permissions";
import { requireAuth } from "../middleware/auth";
import type { AppEnv } from "../types";

const activityLogRoutes = new Hono<AppEnv>();
activityLogRoutes.use("*", requireAuth);

// List activity logs for a trip
activityLogRoutes.get("/:tripId/activity-logs", async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("tripId");

  const role = await checkTripAccess(tripId, user.id);
  if (!role) {
    return c.json({ error: ERROR_MSG.TRIP_NOT_FOUND }, 404);
  }

  const limitParam = Number(c.req.query("limit") || String(MAX_LOGS_PER_TRIP));
  const limit = Math.min(Math.max(1, limitParam), MAX_LOGS_PER_TRIP);
  const cursor = c.req.query("cursor");

  const whereConditions = cursor
    ? and(eq(activityLogs.tripId, tripId), lt(activityLogs.createdAt, new Date(cursor)))
    : eq(activityLogs.tripId, tripId);

  const logs = await db
    .select({
      id: activityLogs.id,
      userId: activityLogs.userId,
      userName: users.name,
      action: activityLogs.action,
      entityType: activityLogs.entityType,
      entityName: activityLogs.entityName,
      detail: activityLogs.detail,
      createdAt: activityLogs.createdAt,
    })
    .from(activityLogs)
    .innerJoin(users, eq(activityLogs.userId, users.id))
    .where(whereConditions)
    .orderBy(desc(activityLogs.createdAt))
    .limit(limit + 1);

  const hasMore = logs.length > limit;
  const items = hasMore ? logs.slice(0, limit) : logs;
  const nextCursor = hasMore ? items[items.length - 1].createdAt.toISOString() : null;

  return c.json({
    items: items.map((log) => ({
      ...log,
      createdAt: log.createdAt.toISOString(),
    })),
    nextCursor,
  });
});

export { activityLogRoutes };
