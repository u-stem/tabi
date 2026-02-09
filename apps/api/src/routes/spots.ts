import { createSpotSchema, reorderSpotsSchema, updateSpotSchema } from "@tabi/shared";
import { and, eq, inArray, sql } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/index";
import { dayPatterns, spots, tripDays } from "../db/schema";

import { canEdit, checkTripAccess } from "../lib/permissions";
import { requireAuth } from "../middleware/auth";
import type { AppEnv } from "../types";

const spotRoutes = new Hono<AppEnv>();
spotRoutes.use("*", requireAuth);

// Verify pattern belongs to day, day belongs to trip, user has access
async function verifyPatternAccess(
  tripId: string,
  dayId: string,
  patternId: string,
  userId: string,
): Promise<boolean> {
  const day = await db.query.tripDays.findFirst({
    where: and(eq(tripDays.id, dayId), eq(tripDays.tripId, tripId)),
  });
  if (!day) return false;
  const pattern = await db.query.dayPatterns.findFirst({
    where: and(eq(dayPatterns.id, patternId), eq(dayPatterns.tripDayId, dayId)),
  });
  if (!pattern) return false;
  const role = await checkTripAccess(tripId, userId);
  return role !== null;
}

// Verify pattern access with edit permission
async function verifyPatternEditAccess(
  tripId: string,
  dayId: string,
  patternId: string,
  userId: string,
): Promise<boolean> {
  const day = await db.query.tripDays.findFirst({
    where: and(eq(tripDays.id, dayId), eq(tripDays.tripId, tripId)),
  });
  if (!day) return false;
  const pattern = await db.query.dayPatterns.findFirst({
    where: and(eq(dayPatterns.id, patternId), eq(dayPatterns.tripDayId, dayId)),
  });
  if (!pattern) return false;
  const role = await checkTripAccess(tripId, userId);
  return canEdit(role);
}

// List spots for a pattern
spotRoutes.get("/:tripId/days/:dayId/patterns/:patternId/spots", async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("tripId");
  const dayId = c.req.param("dayId");
  const patternId = c.req.param("patternId");

  if (!(await verifyPatternAccess(tripId, dayId, patternId, user.id))) {
    return c.json({ error: "Trip not found" }, 404);
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

  if (!(await verifyPatternEditAccess(tripId, dayId, patternId, user.id))) {
    return c.json({ error: "Trip not found" }, 404);
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

  const { latitude, longitude, ...restData } = parsed.data;
  const [spot] = await db
    .insert(spots)
    .values({
      dayPatternId: patternId,
      ...restData,
      ...(latitude != null ? { latitude: String(latitude) } : {}),
      ...(longitude != null ? { longitude: String(longitude) } : {}),
      sortOrder: (maxOrder[0]?.max ?? -1) + 1,
    })
    .returning();

  return c.json(spot, 201);
});

// Reorder spots -- registered before /:spotId to avoid "reorder" matching as spotId
spotRoutes.patch("/:tripId/days/:dayId/patterns/:patternId/spots/reorder", async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("tripId");
  const dayId = c.req.param("dayId");
  const patternId = c.req.param("patternId");

  if (!(await verifyPatternEditAccess(tripId, dayId, patternId, user.id))) {
    return c.json({ error: "Trip not found" }, 404);
  }

  const body = await c.req.json();
  const parsed = reorderSpotsSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  await db.transaction(async (tx) => {
    // Verify all spots belong to this pattern
    if (parsed.data.spotIds.length > 0) {
      const targetSpots = await tx.query.spots.findMany({
        where: and(inArray(spots.id, parsed.data.spotIds), eq(spots.dayPatternId, patternId)),
      });
      if (targetSpots.length !== parsed.data.spotIds.length) {
        throw new Error("Some spots do not belong to this pattern");
      }
    }

    for (let i = 0; i < parsed.data.spotIds.length; i++) {
      await tx.update(spots).set({ sortOrder: i }).where(eq(spots.id, parsed.data.spotIds[i]));
    }
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

  if (!(await verifyPatternEditAccess(tripId, dayId, patternId, user.id))) {
    return c.json({ error: "Trip not found" }, 404);
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
    return c.json({ error: "Spot not found" }, 404);
  }

  const { latitude: lat, longitude: lon, ...restUpdate } = parsed.data;
  const [updated] = await db
    .update(spots)
    .set({
      ...restUpdate,
      ...(lat != null ? { latitude: String(lat) } : {}),
      ...(lon != null ? { longitude: String(lon) } : {}),
      updatedAt: new Date(),
    })
    .where(eq(spots.id, spotId))
    .returning();

  return c.json(updated);
});

// Delete spot
spotRoutes.delete("/:tripId/days/:dayId/patterns/:patternId/spots/:spotId", async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("tripId");
  const dayId = c.req.param("dayId");
  const patternId = c.req.param("patternId");
  const spotId = c.req.param("spotId");

  if (!(await verifyPatternEditAccess(tripId, dayId, patternId, user.id))) {
    return c.json({ error: "Trip not found" }, 404);
  }

  const existing = await db.query.spots.findFirst({
    where: and(eq(spots.id, spotId), eq(spots.dayPatternId, patternId)),
  });

  if (!existing) {
    return c.json({ error: "Spot not found" }, 404);
  }

  await db.delete(spots).where(eq(spots.id, spotId));
  return c.json({ ok: true });
});

export { spotRoutes };
