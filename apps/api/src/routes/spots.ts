import { Hono } from "hono";
import { eq, sql } from "drizzle-orm";
import { db } from "../db/index";
import { spots } from "../db/schema";
import { requireAuth } from "../middleware/auth";
import { createSpotSchema, updateSpotSchema, reorderSpotsSchema } from "@tabi/shared";

type AuthUser = { id: string; name: string; email: string };

type Env = {
  Variables: {
    user: AuthUser;
    session: unknown;
  };
};

const spotRoutes = new Hono<Env>();
spotRoutes.use("*", requireAuth);

// List spots for a day
spotRoutes.get("/:tripId/days/:dayId/spots", async (c) => {
  const dayId = c.req.param("dayId");
  const daySpots = await db.query.spots.findMany({
    where: eq(spots.tripDayId, dayId),
    orderBy: (spots, { asc }) => [asc(spots.sortOrder)],
  });
  return c.json(daySpots);
});

// Add spot
spotRoutes.post("/:tripId/days/:dayId/spots", async (c) => {
  const dayId = c.req.param("dayId");
  const body = await c.req.json();
  const parsed = createSpotSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  // Get next sort order
  const maxOrder = await db
    .select({ max: sql<number>`COALESCE(MAX(${spots.sortOrder}), -1)` })
    .from(spots)
    .where(eq(spots.tripDayId, dayId));

  const { latitude, longitude, ...restData } = parsed.data;
  const [spot] = await db.insert(spots).values({
    tripDayId: dayId,
    ...restData,
    ...(latitude !== undefined ? { latitude: String(latitude) } : {}),
    ...(longitude !== undefined ? { longitude: String(longitude) } : {}),
    sortOrder: (maxOrder[0]?.max ?? -1) + 1,
  }).returning();

  return c.json(spot, 201);
});

// Reorder spots -- registered before /:spotId to avoid "reorder" matching as spotId
spotRoutes.patch("/:tripId/days/:dayId/spots/reorder", async (c) => {
  const body = await c.req.json();
  const parsed = reorderSpotsSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  for (let i = 0; i < parsed.data.spotIds.length; i++) {
    await db.update(spots)
      .set({ sortOrder: i })
      .where(eq(spots.id, parsed.data.spotIds[i]));
  }

  return c.json({ ok: true });
});

// Update spot
spotRoutes.patch("/:tripId/days/:dayId/spots/:spotId", async (c) => {
  const spotId = c.req.param("spotId");
  const body = await c.req.json();
  const parsed = updateSpotSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const existing = await db.query.spots.findFirst({
    where: eq(spots.id, spotId),
  });

  if (!existing) {
    return c.json({ error: "Spot not found" }, 404);
  }

  const { latitude, longitude, ...restUpdate } = parsed.data;
  const [updated] = await db.update(spots)
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
  const spotId = c.req.param("spotId");

  const existing = await db.query.spots.findFirst({
    where: eq(spots.id, spotId),
  });

  if (!existing) {
    return c.json({ error: "Spot not found" }, 404);
  }

  await db.delete(spots).where(eq(spots.id, spotId));
  return c.json({ ok: true });
});

export { spotRoutes };
