import {
  batchDeleteSpotsSchema,
  batchUnassignSpotsSchema,
  createSpotSchema,
  reorderSpotsSchema,
  updateSpotSchema,
} from "@tabi/shared";
import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/index";
import { spots } from "../db/schema";
import { ERROR_MSG } from "../lib/constants";
import { canEdit, checkTripAccess, verifyPatternAccess } from "../lib/permissions";
import { requireAuth } from "../middleware/auth";
import type { AppEnv } from "../types";
import { broadcastToTrip } from "../ws/rooms";

const spotRoutes = new Hono<AppEnv>();
spotRoutes.use("*", requireAuth);

// List spots for a pattern
spotRoutes.get("/:tripId/days/:dayId/patterns/:patternId/spots", async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("tripId");
  const dayId = c.req.param("dayId");
  const patternId = c.req.param("patternId");

  const role = await verifyPatternAccess(tripId, dayId, patternId, user.id);
  if (!role) {
    return c.json({ error: ERROR_MSG.TRIP_NOT_FOUND }, 404);
  }

  const patternSpots = await db.query.spots.findMany({
    where: eq(spots.dayPatternId, patternId),
    orderBy: (spots, { asc }) => [asc(spots.sortOrder)],
  });
  return c.json(patternSpots);
});

// Add spot
spotRoutes.post("/:tripId/days/:dayId/patterns/:patternId/spots", async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("tripId");
  const dayId = c.req.param("dayId");
  const patternId = c.req.param("patternId");

  const role = await verifyPatternAccess(tripId, dayId, patternId, user.id);
  if (!canEdit(role)) {
    return c.json({ error: ERROR_MSG.TRIP_NOT_FOUND }, 404);
  }

  const body = await c.req.json();
  const parsed = createSpotSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  // Get next sort order
  const maxOrder = await db
    .select({ max: sql<number>`COALESCE(MAX(${spots.sortOrder}), -1)` })
    .from(spots)
    .where(eq(spots.dayPatternId, patternId));

  const [spot] = await db
    .insert(spots)
    .values({
      tripId,
      dayPatternId: patternId,
      ...parsed.data,
      sortOrder: (maxOrder[0]?.max ?? -1) + 1,
    })
    .returning();

  broadcastToTrip(tripId, user.id, { type: "spot:created", dayId, patternId, spot });
  return c.json(spot, 201);
});

// Batch delete spots from a pattern
spotRoutes.post("/:tripId/days/:dayId/patterns/:patternId/spots/batch-delete", async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("tripId");
  const dayId = c.req.param("dayId");
  const patternId = c.req.param("patternId");

  const role = await verifyPatternAccess(tripId, dayId, patternId, user.id);
  if (!canEdit(role)) {
    return c.json({ error: ERROR_MSG.TRIP_NOT_FOUND }, 404);
  }

  const body = await c.req.json();
  const parsed = batchDeleteSpotsSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const targetSpots = await db.query.spots.findMany({
    where: and(inArray(spots.id, parsed.data.spotIds), eq(spots.dayPatternId, patternId)),
  });
  if (targetSpots.length !== parsed.data.spotIds.length) {
    return c.json({ error: ERROR_MSG.SPOT_NOT_FOUND }, 404);
  }

  await db.delete(spots).where(inArray(spots.id, parsed.data.spotIds));

  broadcastToTrip(tripId, user.id, {
    type: "spot:batch-deleted",
    spotIds: parsed.data.spotIds,
    dayId,
    patternId,
  });
  return c.json({ ok: true });
});

// Batch duplicate spots in a pattern
spotRoutes.post("/:tripId/days/:dayId/patterns/:patternId/spots/batch-duplicate", async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("tripId");
  const dayId = c.req.param("dayId");
  const patternId = c.req.param("patternId");

  const role = await verifyPatternAccess(tripId, dayId, patternId, user.id);
  if (!canEdit(role)) {
    return c.json({ error: ERROR_MSG.TRIP_NOT_FOUND }, 404);
  }

  const body = await c.req.json();
  const parsed = batchDeleteSpotsSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const targetSpots = await db.query.spots.findMany({
    where: and(inArray(spots.id, parsed.data.spotIds), eq(spots.dayPatternId, patternId)),
  });
  if (targetSpots.length !== parsed.data.spotIds.length) {
    return c.json({ error: ERROR_MSG.SPOT_NOT_FOUND }, 404);
  }

  const maxOrder = await db
    .select({ max: sql<number>`COALESCE(MAX(${spots.sortOrder}), -1)` })
    .from(spots)
    .where(eq(spots.dayPatternId, patternId));

  let nextOrder = (maxOrder[0]?.max ?? -1) + 1;

  const spotById = new Map(targetSpots.map((s) => [s.id, s]));
  const ordered = parsed.data.spotIds.map((id) => spotById.get(id)!);

  const duplicated = await db
    .insert(spots)
    .values(
      ordered.map((spot) => ({
        tripId,
        dayPatternId: patternId,
        name: spot.name,
        category: spot.category,
        address: spot.address,
        startTime: spot.startTime,
        endTime: spot.endTime,
        memo: spot.memo,
        url: spot.url,
        departurePlace: spot.departurePlace,
        arrivalPlace: spot.arrivalPlace,
        transportMethod: spot.transportMethod,
        color: spot.color,
        sortOrder: nextOrder++,
      })),
    )
    .returning();

  broadcastToTrip(tripId, user.id, {
    type: "spot:batch-duplicated",
    spotIds: parsed.data.spotIds,
    dayId,
    patternId,
  });
  return c.json(duplicated, 201);
});

// Reorder spots -- registered before /:spotId to avoid "reorder" matching as spotId
spotRoutes.patch("/:tripId/days/:dayId/patterns/:patternId/spots/reorder", async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("tripId");
  const dayId = c.req.param("dayId");
  const patternId = c.req.param("patternId");

  const role = await verifyPatternAccess(tripId, dayId, patternId, user.id);
  if (!canEdit(role)) {
    return c.json({ error: ERROR_MSG.TRIP_NOT_FOUND }, 404);
  }

  const body = await c.req.json();
  const parsed = reorderSpotsSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  // Verify all spots belong to this pattern before updating
  if (parsed.data.spotIds.length > 0) {
    const targetSpots = await db.query.spots.findMany({
      where: and(inArray(spots.id, parsed.data.spotIds), eq(spots.dayPatternId, patternId)),
    });
    if (targetSpots.length !== parsed.data.spotIds.length) {
      return c.json({ error: "Some spots do not belong to this pattern" }, 400);
    }
  }

  await db.transaction(async (tx) => {
    for (let i = 0; i < parsed.data.spotIds.length; i++) {
      await tx.update(spots).set({ sortOrder: i }).where(eq(spots.id, parsed.data.spotIds[i]));
    }
  });

  broadcastToTrip(tripId, user.id, {
    type: "spot:reordered",
    dayId,
    patternId,
    spotIds: parsed.data.spotIds,
  });
  return c.json({ ok: true });
});

// Update spot
spotRoutes.patch("/:tripId/days/:dayId/patterns/:patternId/spots/:spotId", async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("tripId");
  const dayId = c.req.param("dayId");
  const patternId = c.req.param("patternId");
  const spotId = c.req.param("spotId");

  const role = await verifyPatternAccess(tripId, dayId, patternId, user.id);
  if (!canEdit(role)) {
    return c.json({ error: ERROR_MSG.TRIP_NOT_FOUND }, 404);
  }

  const body = await c.req.json();
  const parsed = updateSpotSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const existing = await db.query.spots.findFirst({
    where: and(eq(spots.id, spotId), eq(spots.dayPatternId, patternId)),
  });

  if (!existing) {
    return c.json({ error: ERROR_MSG.SPOT_NOT_FOUND }, 404);
  }

  const [updated] = await db
    .update(spots)
    .set({
      ...parsed.data,
      updatedAt: new Date(),
    })
    .where(eq(spots.id, spotId))
    .returning();

  broadcastToTrip(tripId, user.id, { type: "spot:updated", dayId, patternId, spot: updated });
  return c.json(updated);
});

// Delete spot
spotRoutes.delete("/:tripId/days/:dayId/patterns/:patternId/spots/:spotId", async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("tripId");
  const dayId = c.req.param("dayId");
  const patternId = c.req.param("patternId");
  const spotId = c.req.param("spotId");

  const role = await verifyPatternAccess(tripId, dayId, patternId, user.id);
  if (!canEdit(role)) {
    return c.json({ error: ERROR_MSG.TRIP_NOT_FOUND }, 404);
  }

  const existing = await db.query.spots.findFirst({
    where: and(eq(spots.id, spotId), eq(spots.dayPatternId, patternId)),
  });

  if (!existing) {
    return c.json({ error: ERROR_MSG.SPOT_NOT_FOUND }, 404);
  }

  await db.delete(spots).where(eq(spots.id, spotId));
  broadcastToTrip(tripId, user.id, { type: "spot:deleted", dayId, patternId, spotId });
  return c.json({ ok: true });
});

// Batch unassign spots (move to candidates)
spotRoutes.post("/:tripId/spots/batch-unassign", async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("tripId");

  const role = await checkTripAccess(tripId, user.id);
  if (!canEdit(role)) {
    return c.json({ error: ERROR_MSG.TRIP_NOT_FOUND }, 404);
  }

  const body = await c.req.json();
  const parsed = batchUnassignSpotsSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const assigned = await db.query.spots.findMany({
    where: and(
      inArray(spots.id, parsed.data.spotIds),
      eq(spots.tripId, tripId),
      isNotNull(spots.dayPatternId),
    ),
    with: { dayPattern: { with: { tripDay: true } } },
  });
  if (assigned.length !== parsed.data.spotIds.length) {
    return c.json({ error: ERROR_MSG.SPOT_NOT_FOUND }, 404);
  }

  // Group by source pattern for broadcast
  const fromDayId = assigned[0].dayPattern!.tripDay.id;
  const fromPatternId = assigned[0].dayPatternId!;

  await db.transaction(async (tx) => {
    const maxOrder = await tx
      .select({ max: sql<number>`COALESCE(MAX(${spots.sortOrder}), -1)` })
      .from(spots)
      .where(and(eq(spots.tripId, tripId), isNull(spots.dayPatternId)));

    let nextOrder = (maxOrder[0]?.max ?? -1) + 1;
    for (const spotId of parsed.data.spotIds) {
      await tx
        .update(spots)
        .set({
          dayPatternId: null,
          sortOrder: nextOrder++,
          updatedAt: new Date(),
        })
        .where(eq(spots.id, spotId));
    }
  });

  broadcastToTrip(tripId, user.id, {
    type: "spot:batch-unassigned",
    spotIds: parsed.data.spotIds,
    fromDayId,
    fromPatternId,
  });
  return c.json({ ok: true });
});

// Unassign spot (move to candidates)
spotRoutes.post("/:tripId/spots/:spotId/unassign", async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("tripId");
  const spotId = c.req.param("spotId");

  const role = await checkTripAccess(tripId, user.id);
  if (!canEdit(role)) {
    return c.json({ error: ERROR_MSG.TRIP_NOT_FOUND }, 404);
  }

  const existing = await db.query.spots.findFirst({
    where: and(eq(spots.id, spotId), eq(spots.tripId, tripId)),
    with: { dayPattern: { with: { tripDay: true } } },
  });
  if (!existing || !existing.dayPatternId) {
    return c.json({ error: ERROR_MSG.SPOT_NOT_FOUND }, 404);
  }

  const maxOrder = await db
    .select({ max: sql<number>`COALESCE(MAX(${spots.sortOrder}), -1)` })
    .from(spots)
    .where(and(eq(spots.tripId, tripId), isNull(spots.dayPatternId)));

  const [updated] = await db
    .update(spots)
    .set({
      dayPatternId: null,
      sortOrder: (maxOrder[0]?.max ?? -1) + 1,
      updatedAt: new Date(),
    })
    .where(eq(spots.id, spotId))
    .returning();

  broadcastToTrip(tripId, user.id, {
    type: "spot:unassigned",
    spotId,
    fromDayId: existing.dayPattern!.tripDay.id,
    fromPatternId: existing.dayPatternId!,
  });
  return c.json(updated);
});

export { spotRoutes };
