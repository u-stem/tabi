import { createSpotSchema, reorderSpotsSchema, updateSpotSchema } from "@tabi/shared";
import { and, eq, inArray, sql } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/index";
import { spots, tripDays } from "../db/schema";
import { geocode } from "../lib/geocoding";
import { canEdit, checkTripAccess } from "../lib/permissions";
import { requireAuth } from "../middleware/auth";
import type { AppEnv } from "../types";

const spotRoutes = new Hono<AppEnv>();
spotRoutes.use("*", requireAuth);

// Verify that the day belongs to the trip and the user is a member
async function verifyDayAccess(tripId: string, dayId: string, userId: string): Promise<boolean> {
  const day = await db.query.tripDays.findFirst({
    where: and(eq(tripDays.id, dayId), eq(tripDays.tripId, tripId)),
  });
  if (!day) return false;
  const role = await checkTripAccess(tripId, userId);
  return role !== null;
}

// Verify that the day belongs to the trip and the user can edit
async function verifyDayEditAccess(tripId: string, dayId: string, userId: string): Promise<boolean> {
  const day = await db.query.tripDays.findFirst({
    where: and(eq(tripDays.id, dayId), eq(tripDays.tripId, tripId)),
  });
  if (!day) return false;
  const role = await checkTripAccess(tripId, userId);
  return canEdit(role);
}

// List spots for a day
spotRoutes.get("/:tripId/days/:dayId/spots", async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("tripId");
  const dayId = c.req.param("dayId");

  if (!(await verifyDayAccess(tripId, dayId, user.id))) {
    return c.json({ error: "Trip not found" }, 404);
  }

  const daySpots = await db.query.spots.findMany({
    where: eq(spots.tripDayId, dayId),
    orderBy: (spots, { asc }) => [asc(spots.sortOrder)],
  });
  return c.json(daySpots);
});

// Add spot
spotRoutes.post("/:tripId/days/:dayId/spots", async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("tripId");
  const dayId = c.req.param("dayId");

  if (!(await verifyDayEditAccess(tripId, dayId, user.id))) {
    return c.json({ error: "Trip not found" }, 404);
  }

  const body = await c.req.json();
  const parsed = createSpotSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  let { latitude, longitude } = parsed.data;
  if (parsed.data.address && latitude == null && longitude == null) {
    const coords = await geocode(parsed.data.address);
    if (coords) {
      latitude = coords.latitude;
      longitude = coords.longitude;
    }
  }

  // Get next sort order
  const maxOrder = await db
    .select({ max: sql<number>`COALESCE(MAX(${spots.sortOrder}), -1)` })
    .from(spots)
    .where(eq(spots.tripDayId, dayId));

  const { latitude: _lat, longitude: _lon, ...restData } = parsed.data;
  const [spot] = await db
    .insert(spots)
    .values({
      tripDayId: dayId,
      ...restData,
      ...(latitude != null ? { latitude: String(latitude) } : {}),
      ...(longitude != null ? { longitude: String(longitude) } : {}),
      sortOrder: (maxOrder[0]?.max ?? -1) + 1,
    })
    .returning();

  return c.json(spot, 201);
});

// Reorder spots -- registered before /:spotId to avoid "reorder" matching as spotId
spotRoutes.patch("/:tripId/days/:dayId/spots/reorder", async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("tripId");
  const dayId = c.req.param("dayId");

  if (!(await verifyDayEditAccess(tripId, dayId, user.id))) {
    return c.json({ error: "Trip not found" }, 404);
  }

  const body = await c.req.json();
  const parsed = reorderSpotsSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  await db.transaction(async (tx) => {
    // Verify all spots belong to this day
    if (parsed.data.spotIds.length > 0) {
      const targetSpots = await tx.query.spots.findMany({
        where: and(inArray(spots.id, parsed.data.spotIds), eq(spots.tripDayId, dayId)),
      });
      if (targetSpots.length !== parsed.data.spotIds.length) {
        throw new Error("Some spots do not belong to this day");
      }
    }

    for (let i = 0; i < parsed.data.spotIds.length; i++) {
      await tx.update(spots).set({ sortOrder: i }).where(eq(spots.id, parsed.data.spotIds[i]));
    }
  });

  return c.json({ ok: true });
});

// Update spot
spotRoutes.patch("/:tripId/days/:dayId/spots/:spotId", async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("tripId");
  const dayId = c.req.param("dayId");
  const spotId = c.req.param("spotId");

  if (!(await verifyDayEditAccess(tripId, dayId, user.id))) {
    return c.json({ error: "Trip not found" }, 404);
  }

  const body = await c.req.json();
  const parsed = updateSpotSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const existing = await db.query.spots.findFirst({
    where: and(eq(spots.id, spotId), eq(spots.tripDayId, dayId)),
  });

  if (!existing) {
    return c.json({ error: "Spot not found" }, 404);
  }

  const { latitude, longitude, ...restUpdate } = parsed.data;
  const [updated] = await db
    .update(spots)
    .set({
      ...restUpdate,
      ...(latitude !== undefined ? { latitude: String(latitude) } : {}),
      ...(longitude !== undefined ? { longitude: String(longitude) } : {}),
      updatedAt: new Date(),
    })
    .where(eq(spots.id, spotId))
    .returning();

  return c.json(updated);
});

// Delete spot
spotRoutes.delete("/:tripId/days/:dayId/spots/:spotId", async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("tripId");
  const dayId = c.req.param("dayId");
  const spotId = c.req.param("spotId");

  if (!(await verifyDayEditAccess(tripId, dayId, user.id))) {
    return c.json({ error: "Trip not found" }, 404);
  }

  const existing = await db.query.spots.findFirst({
    where: and(eq(spots.id, spotId), eq(spots.tripDayId, dayId)),
  });

  if (!existing) {
    return c.json({ error: "Spot not found" }, 404);
  }

  await db.delete(spots).where(eq(spots.id, spotId));
  return c.json({ ok: true });
});

export { spotRoutes };
