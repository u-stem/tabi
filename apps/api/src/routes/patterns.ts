import { createDayPatternSchema, updateDayPatternSchema } from "@tabi/shared";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/index";
import { dayPatterns, spots, tripDays } from "../db/schema";
import { canEdit, checkTripAccess } from "../lib/permissions";
import { requireAuth } from "../middleware/auth";
import type { AppEnv } from "../types";

const patternRoutes = new Hono<AppEnv>();
patternRoutes.use("*", requireAuth);

async function verifyDayAccess(tripId: string, dayId: string, userId: string): Promise<boolean> {
  const day = await db.query.tripDays.findFirst({
    where: and(eq(tripDays.id, dayId), eq(tripDays.tripId, tripId)),
  });
  if (!day) return false;
  const role = await checkTripAccess(tripId, userId);
  return role !== null;
}

async function verifyDayEditAccess(
  tripId: string,
  dayId: string,
  userId: string,
): Promise<boolean> {
  const day = await db.query.tripDays.findFirst({
    where: and(eq(tripDays.id, dayId), eq(tripDays.tripId, tripId)),
  });
  if (!day) return false;
  const role = await checkTripAccess(tripId, userId);
  return canEdit(role);
}

// List patterns for a day
patternRoutes.get("/:tripId/days/:dayId/patterns", async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("tripId");
  const dayId = c.req.param("dayId");

  if (!(await verifyDayAccess(tripId, dayId, user.id))) {
    return c.json({ error: "Trip not found" }, 404);
  }

  const patterns = await db.query.dayPatterns.findMany({
    where: eq(dayPatterns.tripDayId, dayId),
    orderBy: (v, { asc }) => [asc(v.sortOrder)],
    with: {
      spots: {
        orderBy: (s, { asc }) => [asc(s.sortOrder)],
      },
    },
  });
  return c.json(patterns);
});

// Create pattern
patternRoutes.post("/:tripId/days/:dayId/patterns", async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("tripId");
  const dayId = c.req.param("dayId");

  if (!(await verifyDayEditAccess(tripId, dayId, user.id))) {
    return c.json({ error: "Trip not found" }, 404);
  }

  const body = await c.req.json();
  const parsed = createDayPatternSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const existing = await db.query.dayPatterns.findMany({
    where: eq(dayPatterns.tripDayId, dayId),
    columns: { sortOrder: true },
  });
  const maxOrder = existing.reduce((max, v) => Math.max(max, v.sortOrder), -1);

  const [pattern] = await db
    .insert(dayPatterns)
    .values({
      tripDayId: dayId,
      label: parsed.data.label,
      isDefault: false,
      sortOrder: maxOrder + 1,
    })
    .returning();

  return c.json(pattern, 201);
});

// Update pattern
patternRoutes.patch("/:tripId/days/:dayId/patterns/:patternId", async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("tripId");
  const dayId = c.req.param("dayId");
  const patternId = c.req.param("patternId");

  if (!(await verifyDayEditAccess(tripId, dayId, user.id))) {
    return c.json({ error: "Trip not found" }, 404);
  }

  const body = await c.req.json();
  const parsed = updateDayPatternSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const existing = await db.query.dayPatterns.findFirst({
    where: and(eq(dayPatterns.id, patternId), eq(dayPatterns.tripDayId, dayId)),
  });
  if (!existing) {
    return c.json({ error: "Pattern not found" }, 404);
  }

  const [updated] = await db
    .update(dayPatterns)
    .set(parsed.data)
    .where(eq(dayPatterns.id, patternId))
    .returning();

  return c.json(updated);
});

// Delete pattern (default cannot be deleted)
patternRoutes.delete("/:tripId/days/:dayId/patterns/:patternId", async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("tripId");
  const dayId = c.req.param("dayId");
  const patternId = c.req.param("patternId");

  if (!(await verifyDayEditAccess(tripId, dayId, user.id))) {
    return c.json({ error: "Trip not found" }, 404);
  }

  const existing = await db.query.dayPatterns.findFirst({
    where: and(eq(dayPatterns.id, patternId), eq(dayPatterns.tripDayId, dayId)),
  });
  if (!existing) {
    return c.json({ error: "Pattern not found" }, 404);
  }
  if (existing.isDefault) {
    return c.json({ error: "Cannot delete default pattern" }, 400);
  }

  await db.delete(dayPatterns).where(eq(dayPatterns.id, patternId));
  return c.json({ ok: true });
});

// Duplicate pattern (with spots)
patternRoutes.post("/:tripId/days/:dayId/patterns/:patternId/duplicate", async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("tripId");
  const dayId = c.req.param("dayId");
  const patternId = c.req.param("patternId");

  if (!(await verifyDayEditAccess(tripId, dayId, user.id))) {
    return c.json({ error: "Trip not found" }, 404);
  }

  const source = await db.query.dayPatterns.findFirst({
    where: and(eq(dayPatterns.id, patternId), eq(dayPatterns.tripDayId, dayId)),
    with: { spots: true },
  });
  if (!source) {
    return c.json({ error: "Pattern not found" }, 404);
  }

  const existing = await db.query.dayPatterns.findMany({
    where: eq(dayPatterns.tripDayId, dayId),
    columns: { sortOrder: true },
  });
  const maxOrder = existing.reduce((max, v) => Math.max(max, v.sortOrder), -1);

  const result = await db.transaction(async (tx) => {
    const [newPattern] = await tx
      .insert(dayPatterns)
      .values({
        tripDayId: dayId,
        label: `${source.label} (copy)`,
        isDefault: false,
        sortOrder: maxOrder + 1,
      })
      .returning();

    if (source.spots.length > 0) {
      await tx.insert(spots).values(
        source.spots.map((spot) => ({
          dayPatternId: newPattern.id,
          name: spot.name,
          category: spot.category,
          address: spot.address,
          latitude: spot.latitude,
          longitude: spot.longitude,
          startTime: spot.startTime,
          endTime: spot.endTime,
          sortOrder: spot.sortOrder,
          memo: spot.memo,
          url: spot.url,
          departurePlace: spot.departurePlace,
          arrivalPlace: spot.arrivalPlace,
          transportMethod: spot.transportMethod,
          color: spot.color,
        })),
      );
    }

    return newPattern;
  });

  return c.json(result, 201);
});

export { patternRoutes };
