import { createSpotSchema, reorderSpotsSchema, updateSpotSchema } from "@tabi/shared";
import { and, eq, inArray, sql } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/index";
import { spots } from "../db/schema";
import { ERROR_MSG } from "../lib/constants";
import { canEdit, verifyPatternAccess } from "../lib/permissions";
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
      dayPatternId: patternId,
      ...parsed.data,
      sortOrder: (maxOrder[0]?.max ?? -1) + 1,
    })
    .returning();

  broadcastToTrip(tripId, user.id, { type: "spot:created", dayId, patternId, spot });
  return c.json(spot, 201);
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

export { spotRoutes };
