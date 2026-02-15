import {
  batchDeleteSchedulesSchema,
  batchShiftSchedulesSchema,
  batchUnassignSchedulesSchema,
  createScheduleSchema,
  MAX_SCHEDULES_PER_TRIP,
  reorderSchedulesSchema,
  shiftTime,
  updateScheduleSchema,
} from "@sugara/shared";
import { and, count, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/index";
import { schedules } from "../db/schema";
import { logActivity } from "../lib/activity-logger";
import { ERROR_MSG } from "../lib/constants";
import { canEdit, checkTripAccess, verifyPatternAccess } from "../lib/permissions";
import { getNextSortOrder } from "../lib/sort-order";
import { requireAuth } from "../middleware/auth";
import type { AppEnv } from "../types";

const scheduleRoutes = new Hono<AppEnv>();
scheduleRoutes.use("*", requireAuth);

// List schedules for a pattern
scheduleRoutes.get("/:tripId/days/:dayId/patterns/:patternId/schedules", async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("tripId");
  const dayId = c.req.param("dayId");
  const patternId = c.req.param("patternId");

  const role = await verifyPatternAccess(tripId, dayId, patternId, user.id);
  if (!role) {
    return c.json({ error: ERROR_MSG.TRIP_NOT_FOUND }, 404);
  }

  const patternSchedules = await db.query.schedules.findMany({
    where: eq(schedules.dayPatternId, patternId),
    orderBy: (schedules, { asc }) => [asc(schedules.sortOrder)],
  });
  return c.json(patternSchedules);
});

// Add schedule
scheduleRoutes.post("/:tripId/days/:dayId/patterns/:patternId/schedules", async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("tripId");
  const dayId = c.req.param("dayId");
  const patternId = c.req.param("patternId");

  const role = await verifyPatternAccess(tripId, dayId, patternId, user.id);
  if (!canEdit(role)) {
    return c.json({ error: ERROR_MSG.TRIP_NOT_FOUND }, 404);
  }

  const body = await c.req.json();
  const parsed = createScheduleSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const [scheduleCount] = await db
    .select({ count: count() })
    .from(schedules)
    .where(eq(schedules.tripId, tripId));
  if (scheduleCount.count >= MAX_SCHEDULES_PER_TRIP) {
    return c.json({ error: ERROR_MSG.LIMIT_SCHEDULES }, 409);
  }

  // Get next sort order
  const nextOrder = await getNextSortOrder(
    db,
    schedules.sortOrder,
    schedules,
    eq(schedules.dayPatternId, patternId),
  );

  const [schedule] = await db
    .insert(schedules)
    .values({
      tripId,
      dayPatternId: patternId,
      ...parsed.data,
      sortOrder: nextOrder,
    })
    .returning();

  logActivity({
    tripId,
    userId: user.id,
    action: "created",
    entityType: "schedule",
    entityName: schedule.name,
  }).catch(console.error);

  return c.json(schedule, 201);
});

// Batch delete schedules from a pattern
scheduleRoutes.post(
  "/:tripId/days/:dayId/patterns/:patternId/schedules/batch-delete",
  async (c) => {
    const user = c.get("user");
    const tripId = c.req.param("tripId");
    const dayId = c.req.param("dayId");
    const patternId = c.req.param("patternId");

    const role = await verifyPatternAccess(tripId, dayId, patternId, user.id);
    if (!canEdit(role)) {
      return c.json({ error: ERROR_MSG.TRIP_NOT_FOUND }, 404);
    }

    const body = await c.req.json();
    const parsed = batchDeleteSchedulesSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }

    const targetSchedules = await db.query.schedules.findMany({
      where: and(
        inArray(schedules.id, parsed.data.scheduleIds),
        eq(schedules.dayPatternId, patternId),
      ),
    });
    if (targetSchedules.length !== parsed.data.scheduleIds.length) {
      return c.json({ error: ERROR_MSG.SCHEDULE_NOT_FOUND }, 404);
    }

    await db.delete(schedules).where(inArray(schedules.id, parsed.data.scheduleIds));

    logActivity({
      tripId,
      userId: user.id,
      action: "deleted",
      entityType: "schedule",
      detail: `${parsed.data.scheduleIds.length}件`,
    }).catch(console.error);

    return c.json({ ok: true });
  },
);

// Batch shift schedule times
scheduleRoutes.post("/:tripId/days/:dayId/patterns/:patternId/schedules/batch-shift", async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("tripId");
  const dayId = c.req.param("dayId");
  const patternId = c.req.param("patternId");

  const role = await verifyPatternAccess(tripId, dayId, patternId, user.id);
  if (!canEdit(role)) {
    return c.json({ error: ERROR_MSG.TRIP_NOT_FOUND }, 404);
  }

  const body = await c.req.json();
  const parsed = batchShiftSchedulesSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const { scheduleIds, deltaMinutes } = parsed.data;

  const targetSchedules = await db.query.schedules.findMany({
    where: and(inArray(schedules.id, scheduleIds), eq(schedules.dayPatternId, patternId)),
  });
  if (targetSchedules.length !== scheduleIds.length) {
    return c.json({ error: ERROR_MSG.SCHEDULE_NOT_FOUND }, 404);
  }

  let updatedCount = 0;
  let skippedCount = 0;

  await db.transaction(async (tx) => {
    for (const schedule of targetSchedules) {
      // Skip hotels spanning multiple days
      if (schedule.category === "hotel" && schedule.endDayOffset && schedule.endDayOffset > 0) {
        skippedCount++;
        continue;
      }

      // Skip schedules without any time
      if (!schedule.startTime && !schedule.endTime) {
        skippedCount++;
        continue;
      }

      let newStartTime = schedule.startTime;
      let newEndTime = schedule.endTime;
      let shouldSkip = false;

      if (schedule.startTime) {
        const shifted = shiftTime(schedule.startTime, deltaMinutes);
        if (shifted === null) {
          shouldSkip = true;
        } else {
          newStartTime = shifted;
        }
      }

      if (!shouldSkip && schedule.endTime) {
        // Don't shift endTime for cross-day schedules
        if (schedule.endDayOffset && schedule.endDayOffset > 0) {
          // Keep endTime as-is
        } else {
          const shifted = shiftTime(schedule.endTime, deltaMinutes);
          if (shifted === null) {
            shouldSkip = true;
          } else {
            newEndTime = shifted;
          }
        }
      }

      if (shouldSkip) {
        skippedCount++;
        continue;
      }

      await tx
        .update(schedules)
        .set({
          startTime: newStartTime,
          endTime: newEndTime,
          updatedAt: new Date(),
        })
        .where(eq(schedules.id, schedule.id));
      updatedCount++;
    }
  });

  if (updatedCount > 0) {
    const direction = deltaMinutes > 0 ? "後ろ" : "前";
    const abs = Math.abs(deltaMinutes);
    logActivity({
      tripId,
      userId: user.id,
      action: "updated",
      entityType: "schedule",
      detail: `${updatedCount}件の時間を${abs}分${direction}に移動`,
    }).catch(console.error);
  }

  return c.json({ updatedCount, skippedCount });
});

// Batch duplicate schedules in a pattern
scheduleRoutes.post(
  "/:tripId/days/:dayId/patterns/:patternId/schedules/batch-duplicate",
  async (c) => {
    const user = c.get("user");
    const tripId = c.req.param("tripId");
    const dayId = c.req.param("dayId");
    const patternId = c.req.param("patternId");

    const role = await verifyPatternAccess(tripId, dayId, patternId, user.id);
    if (!canEdit(role)) {
      return c.json({ error: ERROR_MSG.TRIP_NOT_FOUND }, 404);
    }

    const body = await c.req.json();
    const parsed = batchDeleteSchedulesSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }

    const [scheduleCount] = await db
      .select({ count: count() })
      .from(schedules)
      .where(eq(schedules.tripId, tripId));
    if (scheduleCount.count + parsed.data.scheduleIds.length > MAX_SCHEDULES_PER_TRIP) {
      return c.json({ error: ERROR_MSG.LIMIT_SCHEDULES }, 409);
    }

    const targetSchedules = await db.query.schedules.findMany({
      where: and(
        inArray(schedules.id, parsed.data.scheduleIds),
        eq(schedules.dayPatternId, patternId),
      ),
    });
    if (targetSchedules.length !== parsed.data.scheduleIds.length) {
      return c.json({ error: ERROR_MSG.SCHEDULE_NOT_FOUND }, 404);
    }

    const nextOrder = await getNextSortOrder(
      db,
      schedules.sortOrder,
      schedules,
      eq(schedules.dayPatternId, patternId),
    );

    let currentOrder = nextOrder;

    const scheduleById = new Map(targetSchedules.map((s) => [s.id, s]));
    const ordered = parsed.data.scheduleIds.map((id) => scheduleById.get(id)!);

    const duplicated = await db
      .insert(schedules)
      .values(
        ordered.map((schedule) => ({
          tripId,
          dayPatternId: patternId,
          name: schedule.name,
          category: schedule.category,
          address: schedule.address,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          memo: schedule.memo,
          url: schedule.url,
          departurePlace: schedule.departurePlace,
          arrivalPlace: schedule.arrivalPlace,
          transportMethod: schedule.transportMethod,
          color: schedule.color,
          endDayOffset: schedule.endDayOffset,
          sortOrder: currentOrder++,
        })),
      )
      .returning();

    logActivity({
      tripId,
      userId: user.id,
      action: "duplicated",
      entityType: "schedule",
      detail: `${duplicated.length}件`,
    }).catch(console.error);

    return c.json(duplicated, 201);
  },
);

// Reorder schedules -- registered before /:scheduleId to avoid "reorder" matching as scheduleId
scheduleRoutes.patch("/:tripId/days/:dayId/patterns/:patternId/schedules/reorder", async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("tripId");
  const dayId = c.req.param("dayId");
  const patternId = c.req.param("patternId");

  const role = await verifyPatternAccess(tripId, dayId, patternId, user.id);
  if (!canEdit(role)) {
    return c.json({ error: ERROR_MSG.TRIP_NOT_FOUND }, 404);
  }

  const body = await c.req.json();
  const parsed = reorderSchedulesSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  // Verify all schedules belong to this pattern before updating
  if (parsed.data.scheduleIds.length > 0) {
    const targetSchedules = await db.query.schedules.findMany({
      where: and(
        inArray(schedules.id, parsed.data.scheduleIds),
        eq(schedules.dayPatternId, patternId),
      ),
    });
    if (targetSchedules.length !== parsed.data.scheduleIds.length) {
      return c.json({ error: ERROR_MSG.INVALID_REORDER }, 400);
    }
  }

  await db.transaction(async (tx) => {
    for (let i = 0; i < parsed.data.scheduleIds.length; i++) {
      await tx
        .update(schedules)
        .set({ sortOrder: i })
        .where(eq(schedules.id, parsed.data.scheduleIds[i]));
    }
  });

  return c.json({ ok: true });
});

// Update schedule
scheduleRoutes.patch(
  "/:tripId/days/:dayId/patterns/:patternId/schedules/:scheduleId",
  async (c) => {
    const user = c.get("user");
    const tripId = c.req.param("tripId");
    const dayId = c.req.param("dayId");
    const patternId = c.req.param("patternId");
    const scheduleId = c.req.param("scheduleId");

    const role = await verifyPatternAccess(tripId, dayId, patternId, user.id);
    if (!canEdit(role)) {
      return c.json({ error: ERROR_MSG.TRIP_NOT_FOUND }, 404);
    }

    const body = await c.req.json();
    const parsed = updateScheduleSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }

    const existing = await db.query.schedules.findFirst({
      where: and(eq(schedules.id, scheduleId), eq(schedules.dayPatternId, patternId)),
    });

    if (!existing) {
      return c.json({ error: ERROR_MSG.SCHEDULE_NOT_FOUND }, 404);
    }

    const { expectedUpdatedAt, ...updateData } = parsed.data;

    // Atomic optimistic lock: include updatedAt in WHERE clause
    const whereConditions = expectedUpdatedAt
      ? and(
          eq(schedules.id, scheduleId),
          sql`date_trunc('milliseconds', ${schedules.updatedAt}) = ${expectedUpdatedAt}::timestamptz`,
        )
      : eq(schedules.id, scheduleId);

    const [updated] = await db
      .update(schedules)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(whereConditions)
      .returning();

    if (!updated) {
      return c.json({ error: ERROR_MSG.CONFLICT }, 409);
    }

    logActivity({
      tripId,
      userId: user.id,
      action: "updated",
      entityType: "schedule",
      entityName: updated.name,
    }).catch(console.error);

    return c.json(updated);
  },
);

// Delete schedule
scheduleRoutes.delete(
  "/:tripId/days/:dayId/patterns/:patternId/schedules/:scheduleId",
  async (c) => {
    const user = c.get("user");
    const tripId = c.req.param("tripId");
    const dayId = c.req.param("dayId");
    const patternId = c.req.param("patternId");
    const scheduleId = c.req.param("scheduleId");

    const role = await verifyPatternAccess(tripId, dayId, patternId, user.id);
    if (!canEdit(role)) {
      return c.json({ error: ERROR_MSG.TRIP_NOT_FOUND }, 404);
    }

    const existing = await db.query.schedules.findFirst({
      where: and(eq(schedules.id, scheduleId), eq(schedules.dayPatternId, patternId)),
    });

    if (!existing) {
      return c.json({ error: ERROR_MSG.SCHEDULE_NOT_FOUND }, 404);
    }

    await db.delete(schedules).where(eq(schedules.id, scheduleId));

    logActivity({
      tripId,
      userId: user.id,
      action: "deleted",
      entityType: "schedule",
      entityName: existing.name,
    }).catch(console.error);

    return c.json({ ok: true });
  },
);

// Batch unassign schedules (move to candidates)
scheduleRoutes.post("/:tripId/schedules/batch-unassign", async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("tripId");

  const role = await checkTripAccess(tripId, user.id);
  if (!canEdit(role)) {
    return c.json({ error: ERROR_MSG.TRIP_NOT_FOUND }, 404);
  }

  const body = await c.req.json();
  const parsed = batchUnassignSchedulesSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const assigned = await db.query.schedules.findMany({
    where: and(
      inArray(schedules.id, parsed.data.scheduleIds),
      eq(schedules.tripId, tripId),
      isNotNull(schedules.dayPatternId),
    ),
    with: { dayPattern: { with: { tripDay: true } } },
  });
  if (assigned.length !== parsed.data.scheduleIds.length) {
    return c.json({ error: ERROR_MSG.SCHEDULE_NOT_FOUND }, 404);
  }

  await db.transaction(async (tx) => {
    const nextOrder = await getNextSortOrder(
      tx,
      schedules.sortOrder,
      schedules,
      and(eq(schedules.tripId, tripId), isNull(schedules.dayPatternId)),
    );

    let currentOrder = nextOrder;
    for (const scheduleId of parsed.data.scheduleIds) {
      await tx
        .update(schedules)
        .set({
          dayPatternId: null,
          sortOrder: currentOrder++,
          updatedAt: new Date(),
        })
        .where(eq(schedules.id, scheduleId));
    }
  });

  logActivity({
    tripId,
    userId: user.id,
    action: "unassigned",
    entityType: "schedule",
    detail: `${parsed.data.scheduleIds.length}件`,
  }).catch(console.error);

  return c.json({ ok: true });
});

// Unassign schedule (move to candidates)
scheduleRoutes.post("/:tripId/schedules/:scheduleId/unassign", async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("tripId");
  const scheduleId = c.req.param("scheduleId");

  const role = await checkTripAccess(tripId, user.id);
  if (!canEdit(role)) {
    return c.json({ error: ERROR_MSG.TRIP_NOT_FOUND }, 404);
  }

  const existing = await db.query.schedules.findFirst({
    where: and(eq(schedules.id, scheduleId), eq(schedules.tripId, tripId)),
    with: { dayPattern: { with: { tripDay: true } } },
  });
  if (!existing || !existing.dayPatternId) {
    return c.json({ error: ERROR_MSG.SCHEDULE_NOT_FOUND }, 404);
  }

  const nextOrder = await getNextSortOrder(
    db,
    schedules.sortOrder,
    schedules,
    and(eq(schedules.tripId, tripId), isNull(schedules.dayPatternId)),
  );

  const [updated] = await db
    .update(schedules)
    .set({
      dayPatternId: null,
      sortOrder: nextOrder,
      updatedAt: new Date(),
    })
    .where(eq(schedules.id, scheduleId))
    .returning();

  logActivity({
    tripId,
    userId: user.id,
    action: "unassigned",
    entityType: "schedule",
    entityName: updated.name,
  }).catch(console.error);

  return c.json(updated);
});

export { scheduleRoutes };
