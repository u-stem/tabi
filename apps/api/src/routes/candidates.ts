import {
  assignCandidateSchema,
  batchAssignCandidatesSchema,
  batchDeleteSchedulesSchema,
  createCandidateSchema,
  reorderSchedulesSchema,
  updateScheduleSchema,
} from "@tabi/shared";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/index";
import { dayPatterns, schedules } from "../db/schema";
import { ERROR_MSG } from "../lib/constants";
import { canEdit, checkTripAccess } from "../lib/permissions";
import { requireAuth } from "../middleware/auth";
import type { AppEnv } from "../types";
import { broadcastToTrip } from "../ws/rooms";

const candidateRoutes = new Hono<AppEnv>();
candidateRoutes.use("*", requireAuth);

// List candidates for a trip
candidateRoutes.get("/:tripId/candidates", async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("tripId");

  const role = await checkTripAccess(tripId, user.id);
  if (!role) {
    return c.json({ error: ERROR_MSG.TRIP_NOT_FOUND }, 404);
  }

  const candidates = await db.query.schedules.findMany({
    where: and(eq(schedules.tripId, tripId), isNull(schedules.dayPatternId)),
    orderBy: (s, { asc }) => [asc(s.sortOrder)],
  });
  return c.json(candidates);
});

// Create candidate
candidateRoutes.post("/:tripId/candidates", async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("tripId");

  const role = await checkTripAccess(tripId, user.id);
  if (!canEdit(role)) {
    return c.json({ error: ERROR_MSG.TRIP_NOT_FOUND }, 404);
  }

  const body = await c.req.json();
  const parsed = createCandidateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const maxOrder = await db
    .select({ max: sql<number>`COALESCE(MAX(${schedules.sortOrder}), -1)` })
    .from(schedules)
    .where(and(eq(schedules.tripId, tripId), isNull(schedules.dayPatternId)));

  const [schedule] = await db
    .insert(schedules)
    .values({
      tripId,
      ...parsed.data,
      sortOrder: (maxOrder[0]?.max ?? -1) + 1,
    })
    .returning();

  broadcastToTrip(tripId, user.id, { type: "candidate:created", schedule });
  return c.json(schedule, 201);
});

// Batch assign candidates to a day pattern
candidateRoutes.post("/:tripId/candidates/batch-assign", async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("tripId");

  const role = await checkTripAccess(tripId, user.id);
  if (!canEdit(role)) {
    return c.json({ error: ERROR_MSG.TRIP_NOT_FOUND }, 404);
  }

  const body = await c.req.json();
  const parsed = batchAssignCandidatesSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const candidates = await db.query.schedules.findMany({
    where: and(
      inArray(schedules.id, parsed.data.scheduleIds),
      eq(schedules.tripId, tripId),
      isNull(schedules.dayPatternId),
    ),
  });
  if (candidates.length !== parsed.data.scheduleIds.length) {
    return c.json({ error: ERROR_MSG.CANDIDATE_NOT_FOUND }, 404);
  }

  const pattern = await db.query.dayPatterns.findFirst({
    where: eq(dayPatterns.id, parsed.data.dayPatternId),
    with: { tripDay: true },
  });
  if (!pattern || pattern.tripDay.tripId !== tripId) {
    return c.json({ error: ERROR_MSG.PATTERN_NOT_FOUND }, 404);
  }

  await db.transaction(async (tx) => {
    const maxOrder = await tx
      .select({ max: sql<number>`COALESCE(MAX(${schedules.sortOrder}), -1)` })
      .from(schedules)
      .where(eq(schedules.dayPatternId, parsed.data.dayPatternId));

    let nextOrder = (maxOrder[0]?.max ?? -1) + 1;
    for (const scheduleId of parsed.data.scheduleIds) {
      await tx
        .update(schedules)
        .set({
          dayPatternId: parsed.data.dayPatternId,
          sortOrder: nextOrder++,
          updatedAt: new Date(),
        })
        .where(eq(schedules.id, scheduleId));
    }
  });

  broadcastToTrip(tripId, user.id, {
    type: "candidate:batch-assigned",
    scheduleIds: parsed.data.scheduleIds,
    dayId: pattern.tripDay.id,
    patternId: pattern.id,
  });
  return c.json({ ok: true });
});

// Batch delete candidates
candidateRoutes.post("/:tripId/candidates/batch-delete", async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("tripId");

  const role = await checkTripAccess(tripId, user.id);
  if (!canEdit(role)) {
    return c.json({ error: ERROR_MSG.TRIP_NOT_FOUND }, 404);
  }

  const body = await c.req.json();
  const parsed = batchDeleteSchedulesSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const candidates = await db.query.schedules.findMany({
    where: and(
      inArray(schedules.id, parsed.data.scheduleIds),
      eq(schedules.tripId, tripId),
      isNull(schedules.dayPatternId),
    ),
  });
  if (candidates.length !== parsed.data.scheduleIds.length) {
    return c.json({ error: ERROR_MSG.CANDIDATE_NOT_FOUND }, 404);
  }

  await db.delete(schedules).where(inArray(schedules.id, parsed.data.scheduleIds));

  broadcastToTrip(tripId, user.id, {
    type: "candidate:batch-deleted",
    scheduleIds: parsed.data.scheduleIds,
  });
  return c.json({ ok: true });
});

// Batch duplicate candidates
candidateRoutes.post("/:tripId/candidates/batch-duplicate", async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("tripId");

  const role = await checkTripAccess(tripId, user.id);
  if (!canEdit(role)) {
    return c.json({ error: ERROR_MSG.TRIP_NOT_FOUND }, 404);
  }

  const body = await c.req.json();
  const parsed = batchDeleteSchedulesSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const candidates = await db.query.schedules.findMany({
    where: and(
      inArray(schedules.id, parsed.data.scheduleIds),
      eq(schedules.tripId, tripId),
      isNull(schedules.dayPatternId),
    ),
  });
  if (candidates.length !== parsed.data.scheduleIds.length) {
    return c.json({ error: ERROR_MSG.CANDIDATE_NOT_FOUND }, 404);
  }

  const maxOrder = await db
    .select({ max: sql<number>`COALESCE(MAX(${schedules.sortOrder}), -1)` })
    .from(schedules)
    .where(and(eq(schedules.tripId, tripId), isNull(schedules.dayPatternId)));

  let nextOrder = (maxOrder[0]?.max ?? -1) + 1;

  // Preserve the order of scheduleIds in the request
  const scheduleById = new Map(candidates.map((s) => [s.id, s]));
  const ordered = parsed.data.scheduleIds.map((id) => scheduleById.get(id)!);

  const duplicated = await db
    .insert(schedules)
    .values(
      ordered.map((schedule) => ({
        tripId,
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
    type: "candidate:batch-duplicated",
    scheduleIds: parsed.data.scheduleIds,
  });
  return c.json(duplicated, 201);
});

// Reorder candidates (registered before /:scheduleId to avoid route conflict)
candidateRoutes.patch("/:tripId/candidates/reorder", async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("tripId");

  const role = await checkTripAccess(tripId, user.id);
  if (!canEdit(role)) {
    return c.json({ error: ERROR_MSG.TRIP_NOT_FOUND }, 404);
  }

  const body = await c.req.json();
  const parsed = reorderSchedulesSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  if (parsed.data.scheduleIds.length > 0) {
    const targets = await db.query.schedules.findMany({
      where: and(
        inArray(schedules.id, parsed.data.scheduleIds),
        eq(schedules.tripId, tripId),
        isNull(schedules.dayPatternId),
      ),
    });
    if (targets.length !== parsed.data.scheduleIds.length) {
      return c.json({ error: "Some schedules are not candidates of this trip" }, 400);
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
    type: "candidate:reordered",
    scheduleIds: parsed.data.scheduleIds,
  });
  return c.json({ ok: true });
});

// Update candidate
candidateRoutes.patch("/:tripId/candidates/:scheduleId", async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("tripId");
  const scheduleId = c.req.param("scheduleId");

  const role = await checkTripAccess(tripId, user.id);
  if (!canEdit(role)) {
    return c.json({ error: ERROR_MSG.TRIP_NOT_FOUND }, 404);
  }

  const body = await c.req.json();
  const parsed = updateScheduleSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const existing = await db.query.schedules.findFirst({
    where: and(
      eq(schedules.id, scheduleId),
      eq(schedules.tripId, tripId),
      isNull(schedules.dayPatternId),
    ),
  });
  if (!existing) {
    return c.json({ error: ERROR_MSG.CANDIDATE_NOT_FOUND }, 404);
  }

  const [updated] = await db
    .update(schedules)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(schedules.id, scheduleId))
    .returning();

  broadcastToTrip(tripId, user.id, { type: "candidate:updated", schedule: updated });
  return c.json(updated);
});

// Delete candidate
candidateRoutes.delete("/:tripId/candidates/:scheduleId", async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("tripId");
  const scheduleId = c.req.param("scheduleId");

  const role = await checkTripAccess(tripId, user.id);
  if (!canEdit(role)) {
    return c.json({ error: ERROR_MSG.TRIP_NOT_FOUND }, 404);
  }

  const existing = await db.query.schedules.findFirst({
    where: and(
      eq(schedules.id, scheduleId),
      eq(schedules.tripId, tripId),
      isNull(schedules.dayPatternId),
    ),
  });
  if (!existing) {
    return c.json({ error: ERROR_MSG.CANDIDATE_NOT_FOUND }, 404);
  }

  await db.delete(schedules).where(eq(schedules.id, scheduleId));
  broadcastToTrip(tripId, user.id, { type: "candidate:deleted", scheduleId });
  return c.json({ ok: true });
});

// Assign candidate to a day pattern
candidateRoutes.post("/:tripId/candidates/:scheduleId/assign", async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("tripId");
  const scheduleId = c.req.param("scheduleId");

  const role = await checkTripAccess(tripId, user.id);
  if (!canEdit(role)) {
    return c.json({ error: ERROR_MSG.TRIP_NOT_FOUND }, 404);
  }

  const body = await c.req.json();
  const parsed = assignCandidateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const existing = await db.query.schedules.findFirst({
    where: and(
      eq(schedules.id, scheduleId),
      eq(schedules.tripId, tripId),
      isNull(schedules.dayPatternId),
    ),
  });
  if (!existing) {
    return c.json({ error: ERROR_MSG.CANDIDATE_NOT_FOUND }, 404);
  }

  const pattern = await db.query.dayPatterns.findFirst({
    where: eq(dayPatterns.id, parsed.data.dayPatternId),
    with: { tripDay: true },
  });
  if (!pattern || pattern.tripDay.tripId !== tripId) {
    return c.json({ error: ERROR_MSG.PATTERN_NOT_FOUND }, 404);
  }

  const maxOrder = await db
    .select({ max: sql<number>`COALESCE(MAX(${schedules.sortOrder}), -1)` })
    .from(schedules)
    .where(eq(schedules.dayPatternId, parsed.data.dayPatternId));

  const [updated] = await db
    .update(schedules)
    .set({
      dayPatternId: parsed.data.dayPatternId,
      sortOrder: (maxOrder[0]?.max ?? -1) + 1,
      updatedAt: new Date(),
    })
    .where(eq(schedules.id, scheduleId))
    .returning();

  broadcastToTrip(tripId, user.id, {
    type: "schedule:assigned",
    schedule: updated,
    dayId: pattern.tripDay.id,
    patternId: pattern.id,
  });
  return c.json(updated);
});

export { candidateRoutes };
