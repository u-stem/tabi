import {
  batchDeleteSchedulesSchema,
  batchUnassignSchedulesSchema,
  createScheduleSchema,
  reorderSchedulesSchema,
  updateScheduleSchema,
} from "@tabi/shared";
import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/index";
import { schedules } from "../db/schema";
import { ERROR_MSG } from "../lib/constants";
import { canEdit, checkTripAccess, verifyPatternAccess } from "../lib/permissions";
import { requireAuth } from "../middleware/auth";
import type { AppEnv } from "../types";
import { broadcastToTrip } from "../ws/rooms";

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

  // Get next sort order
  const maxOrder = await db
    .select({ max: sql<number>`COALESCE(MAX(${schedules.sortOrder}), -1)` })
    .from(schedules)
    .where(eq(schedules.dayPatternId, patternId));

  const [schedule] = await db
    .insert(schedules)
    .values({
      tripId,
      dayPatternId: patternId,
      ...parsed.data,
      sortOrder: (maxOrder[0]?.max ?? -1) + 1,
    })
    .returning();

  broadcastToTrip(tripId, user.id, { type: "schedule:created", dayId, patternId, schedule });
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

    broadcastToTrip(tripId, user.id, {
      type: "schedule:batch-deleted",
      scheduleIds: parsed.data.scheduleIds,
      dayId,
      patternId,
    });
    return c.json({ ok: true });
  },
);

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

    const targetSchedules = await db.query.schedules.findMany({
      where: and(
        inArray(schedules.id, parsed.data.scheduleIds),
        eq(schedules.dayPatternId, patternId),
      ),
    });
    if (targetSchedules.length !== parsed.data.scheduleIds.length) {
      return c.json({ error: ERROR_MSG.SCHEDULE_NOT_FOUND }, 404);
    }

    const maxOrder = await db
      .select({ max: sql<number>`COALESCE(MAX(${schedules.sortOrder}), -1)` })
      .from(schedules)
      .where(eq(schedules.dayPatternId, patternId));

    let nextOrder = (maxOrder[0]?.max ?? -1) + 1;

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
          sortOrder: nextOrder++,
        })),
      )
      .returning();

    broadcastToTrip(tripId, user.id, {
      type: "schedule:batch-duplicated",
      scheduleIds: parsed.data.scheduleIds,
      dayId,
      patternId,
    });
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
      return c.json({ error: "Some schedules do not belong to this pattern" }, 400);
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

  broadcastToTrip(tripId, user.id, {
    type: "schedule:reordered",
    dayId,
    patternId,
    scheduleIds: parsed.data.scheduleIds,
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

    const [updated] = await db
      .update(schedules)
      .set({
        ...parsed.data,
        updatedAt: new Date(),
      })
      .where(eq(schedules.id, scheduleId))
      .returning();

    broadcastToTrip(tripId, user.id, {
      type: "schedule:updated",
      dayId,
      patternId,
      schedule: updated,
    });
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
    broadcastToTrip(tripId, user.id, { type: "schedule:deleted", dayId, patternId, scheduleId });
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

  // Group by source pattern for broadcast
  const fromDayId = assigned[0].dayPattern!.tripDay.id;
  const fromPatternId = assigned[0].dayPatternId!;

  await db.transaction(async (tx) => {
    const maxOrder = await tx
      .select({ max: sql<number>`COALESCE(MAX(${schedules.sortOrder}), -1)` })
      .from(schedules)
      .where(and(eq(schedules.tripId, tripId), isNull(schedules.dayPatternId)));

    let nextOrder = (maxOrder[0]?.max ?? -1) + 1;
    for (const scheduleId of parsed.data.scheduleIds) {
      await tx
        .update(schedules)
        .set({
          dayPatternId: null,
          sortOrder: nextOrder++,
          updatedAt: new Date(),
        })
        .where(eq(schedules.id, scheduleId));
    }
  });

  broadcastToTrip(tripId, user.id, {
    type: "schedule:batch-unassigned",
    scheduleIds: parsed.data.scheduleIds,
    fromDayId,
    fromPatternId,
  });
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

  const maxOrder = await db
    .select({ max: sql<number>`COALESCE(MAX(${schedules.sortOrder}), -1)` })
    .from(schedules)
    .where(and(eq(schedules.tripId, tripId), isNull(schedules.dayPatternId)));

  const [updated] = await db
    .update(schedules)
    .set({
      dayPatternId: null,
      sortOrder: (maxOrder[0]?.max ?? -1) + 1,
      updatedAt: new Date(),
    })
    .where(eq(schedules.id, scheduleId))
    .returning();

  broadcastToTrip(tripId, user.id, {
    type: "schedule:unassigned",
    scheduleId,
    fromDayId: existing.dayPattern!.tripDay.id,
    fromPatternId: existing.dayPatternId!,
  });
  return c.json(updated);
});

export { scheduleRoutes };
