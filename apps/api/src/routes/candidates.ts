import {
  assignCandidateSchema,
  batchAssignCandidatesSchema,
  batchDeleteSpotsSchema,
  createCandidateSpotSchema,
  reorderSpotsSchema,
  updateSpotSchema,
} from "@tabi/shared";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/index";
import { dayPatterns, spots } from "../db/schema";
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

  const candidates = await db.query.spots.findMany({
    where: and(eq(spots.tripId, tripId), isNull(spots.dayPatternId)),
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
  const parsed = createCandidateSpotSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const maxOrder = await db
    .select({ max: sql<number>`COALESCE(MAX(${spots.sortOrder}), -1)` })
    .from(spots)
    .where(and(eq(spots.tripId, tripId), isNull(spots.dayPatternId)));

  const [spot] = await db
    .insert(spots)
    .values({
      tripId,
      ...parsed.data,
      sortOrder: (maxOrder[0]?.max ?? -1) + 1,
    })
    .returning();

  broadcastToTrip(tripId, user.id, { type: "candidate:created", spot });
  return c.json(spot, 201);
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

  const candidates = await db.query.spots.findMany({
    where: and(
      inArray(spots.id, parsed.data.spotIds),
      eq(spots.tripId, tripId),
      isNull(spots.dayPatternId),
    ),
  });
  if (candidates.length !== parsed.data.spotIds.length) {
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
      .select({ max: sql<number>`COALESCE(MAX(${spots.sortOrder}), -1)` })
      .from(spots)
      .where(eq(spots.dayPatternId, parsed.data.dayPatternId));

    let nextOrder = (maxOrder[0]?.max ?? -1) + 1;
    for (const spotId of parsed.data.spotIds) {
      await tx
        .update(spots)
        .set({
          dayPatternId: parsed.data.dayPatternId,
          sortOrder: nextOrder++,
          updatedAt: new Date(),
        })
        .where(eq(spots.id, spotId));
    }
  });

  broadcastToTrip(tripId, user.id, {
    type: "candidate:batch-assigned",
    spotIds: parsed.data.spotIds,
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
  const parsed = batchDeleteSpotsSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const candidates = await db.query.spots.findMany({
    where: and(
      inArray(spots.id, parsed.data.spotIds),
      eq(spots.tripId, tripId),
      isNull(spots.dayPatternId),
    ),
  });
  if (candidates.length !== parsed.data.spotIds.length) {
    return c.json({ error: ERROR_MSG.CANDIDATE_NOT_FOUND }, 404);
  }

  await db.delete(spots).where(inArray(spots.id, parsed.data.spotIds));

  broadcastToTrip(tripId, user.id, {
    type: "candidate:batch-deleted",
    spotIds: parsed.data.spotIds,
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
  const parsed = batchDeleteSpotsSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const candidates = await db.query.spots.findMany({
    where: and(
      inArray(spots.id, parsed.data.spotIds),
      eq(spots.tripId, tripId),
      isNull(spots.dayPatternId),
    ),
  });
  if (candidates.length !== parsed.data.spotIds.length) {
    return c.json({ error: ERROR_MSG.CANDIDATE_NOT_FOUND }, 404);
  }

  const maxOrder = await db
    .select({ max: sql<number>`COALESCE(MAX(${spots.sortOrder}), -1)` })
    .from(spots)
    .where(and(eq(spots.tripId, tripId), isNull(spots.dayPatternId)));

  let nextOrder = (maxOrder[0]?.max ?? -1) + 1;

  // Preserve the order of spotIds in the request
  const spotById = new Map(candidates.map((s) => [s.id, s]));
  const ordered = parsed.data.spotIds.map((id) => spotById.get(id)!);

  const duplicated = await db
    .insert(spots)
    .values(
      ordered.map((spot) => ({
        tripId,
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
    type: "candidate:batch-duplicated",
    spotIds: parsed.data.spotIds,
  });
  return c.json(duplicated, 201);
});

// Reorder candidates (registered before /:spotId to avoid route conflict)
candidateRoutes.patch("/:tripId/candidates/reorder", async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("tripId");

  const role = await checkTripAccess(tripId, user.id);
  if (!canEdit(role)) {
    return c.json({ error: ERROR_MSG.TRIP_NOT_FOUND }, 404);
  }

  const body = await c.req.json();
  const parsed = reorderSpotsSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  if (parsed.data.spotIds.length > 0) {
    const targets = await db.query.spots.findMany({
      where: and(
        inArray(spots.id, parsed.data.spotIds),
        eq(spots.tripId, tripId),
        isNull(spots.dayPatternId),
      ),
    });
    if (targets.length !== parsed.data.spotIds.length) {
      return c.json({ error: "Some spots are not candidates of this trip" }, 400);
    }
  }

  await db.transaction(async (tx) => {
    for (let i = 0; i < parsed.data.spotIds.length; i++) {
      await tx.update(spots).set({ sortOrder: i }).where(eq(spots.id, parsed.data.spotIds[i]));
    }
  });

  broadcastToTrip(tripId, user.id, {
    type: "candidate:reordered",
    spotIds: parsed.data.spotIds,
  });
  return c.json({ ok: true });
});

// Update candidate
candidateRoutes.patch("/:tripId/candidates/:spotId", async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("tripId");
  const spotId = c.req.param("spotId");

  const role = await checkTripAccess(tripId, user.id);
  if (!canEdit(role)) {
    return c.json({ error: ERROR_MSG.TRIP_NOT_FOUND }, 404);
  }

  const body = await c.req.json();
  const parsed = updateSpotSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const existing = await db.query.spots.findFirst({
    where: and(eq(spots.id, spotId), eq(spots.tripId, tripId), isNull(spots.dayPatternId)),
  });
  if (!existing) {
    return c.json({ error: ERROR_MSG.CANDIDATE_NOT_FOUND }, 404);
  }

  const [updated] = await db
    .update(spots)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(spots.id, spotId))
    .returning();

  broadcastToTrip(tripId, user.id, { type: "candidate:updated", spot: updated });
  return c.json(updated);
});

// Delete candidate
candidateRoutes.delete("/:tripId/candidates/:spotId", async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("tripId");
  const spotId = c.req.param("spotId");

  const role = await checkTripAccess(tripId, user.id);
  if (!canEdit(role)) {
    return c.json({ error: ERROR_MSG.TRIP_NOT_FOUND }, 404);
  }

  const existing = await db.query.spots.findFirst({
    where: and(eq(spots.id, spotId), eq(spots.tripId, tripId), isNull(spots.dayPatternId)),
  });
  if (!existing) {
    return c.json({ error: ERROR_MSG.CANDIDATE_NOT_FOUND }, 404);
  }

  await db.delete(spots).where(eq(spots.id, spotId));
  broadcastToTrip(tripId, user.id, { type: "candidate:deleted", spotId });
  return c.json({ ok: true });
});

// Assign candidate to a day pattern
candidateRoutes.post("/:tripId/candidates/:spotId/assign", async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("tripId");
  const spotId = c.req.param("spotId");

  const role = await checkTripAccess(tripId, user.id);
  if (!canEdit(role)) {
    return c.json({ error: ERROR_MSG.TRIP_NOT_FOUND }, 404);
  }

  const body = await c.req.json();
  const parsed = assignCandidateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const existing = await db.query.spots.findFirst({
    where: and(eq(spots.id, spotId), eq(spots.tripId, tripId), isNull(spots.dayPatternId)),
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
    .select({ max: sql<number>`COALESCE(MAX(${spots.sortOrder}), -1)` })
    .from(spots)
    .where(eq(spots.dayPatternId, parsed.data.dayPatternId));

  const [updated] = await db
    .update(spots)
    .set({
      dayPatternId: parsed.data.dayPatternId,
      sortOrder: (maxOrder[0]?.max ?? -1) + 1,
      updatedAt: new Date(),
    })
    .where(eq(spots.id, spotId))
    .returning();

  broadcastToTrip(tripId, user.id, {
    type: "spot:assigned",
    spot: updated,
    dayId: pattern.tripDay.id,
    patternId: pattern.id,
  });
  return c.json(updated);
});

export { candidateRoutes };
