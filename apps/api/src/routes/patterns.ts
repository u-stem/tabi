import { createDayPatternSchema, updateDayPatternSchema } from "@tabi/shared";
import { and, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/index";
import { dayPatterns, spots } from "../db/schema";
import { ERROR_MSG } from "../lib/constants";
import { canEdit, verifyDayAccess } from "../lib/permissions";
import { requireAuth } from "../middleware/auth";
import type { AppEnv } from "../types";
import { broadcastToTrip } from "../ws/rooms";

const patternRoutes = new Hono<AppEnv>();
patternRoutes.use("*", requireAuth);

function toPatternNotification(p: typeof dayPatterns.$inferSelect) {
  return { id: p.id, label: p.label, isDefault: p.isDefault, sortOrder: p.sortOrder };
}

// List patterns for a day
patternRoutes.get("/:tripId/days/:dayId/patterns", async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("tripId");
  const dayId = c.req.param("dayId");

  const role = await verifyDayAccess(tripId, dayId, user.id);
  if (!role) {
    return c.json({ error: ERROR_MSG.TRIP_NOT_FOUND }, 404);
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

  const role = await verifyDayAccess(tripId, dayId, user.id);
  if (!canEdit(role)) {
    return c.json({ error: ERROR_MSG.TRIP_NOT_FOUND }, 404);
  }

  const body = await c.req.json();
  const parsed = createDayPatternSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const maxOrderResult = await db
    .select({ max: sql<number>`COALESCE(MAX(${dayPatterns.sortOrder}), -1)` })
    .from(dayPatterns)
    .where(eq(dayPatterns.tripDayId, dayId));

  const [pattern] = await db
    .insert(dayPatterns)
    .values({
      tripDayId: dayId,
      label: parsed.data.label,
      isDefault: false,
      sortOrder: (maxOrderResult[0]?.max ?? -1) + 1,
    })
    .returning();

  broadcastToTrip(tripId, user.id, {
    type: "pattern:created",
    dayId,
    pattern: toPatternNotification(pattern),
  });
  return c.json(pattern, 201);
});

// Update pattern
patternRoutes.patch("/:tripId/days/:dayId/patterns/:patternId", async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("tripId");
  const dayId = c.req.param("dayId");
  const patternId = c.req.param("patternId");

  const role = await verifyDayAccess(tripId, dayId, user.id);
  if (!canEdit(role)) {
    return c.json({ error: ERROR_MSG.TRIP_NOT_FOUND }, 404);
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
    return c.json({ error: ERROR_MSG.PATTERN_NOT_FOUND }, 404);
  }

  const [updated] = await db
    .update(dayPatterns)
    .set(parsed.data)
    .where(eq(dayPatterns.id, patternId))
    .returning();

  broadcastToTrip(tripId, user.id, {
    type: "pattern:updated",
    dayId,
    pattern: toPatternNotification(updated),
  });
  return c.json(updated);
});

// Delete pattern (default cannot be deleted)
patternRoutes.delete("/:tripId/days/:dayId/patterns/:patternId", async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("tripId");
  const dayId = c.req.param("dayId");
  const patternId = c.req.param("patternId");

  const role = await verifyDayAccess(tripId, dayId, user.id);
  if (!canEdit(role)) {
    return c.json({ error: ERROR_MSG.TRIP_NOT_FOUND }, 404);
  }

  const existing = await db.query.dayPatterns.findFirst({
    where: and(eq(dayPatterns.id, patternId), eq(dayPatterns.tripDayId, dayId)),
  });
  if (!existing) {
    return c.json({ error: ERROR_MSG.PATTERN_NOT_FOUND }, 404);
  }
  if (existing.isDefault) {
    return c.json({ error: ERROR_MSG.CANNOT_DELETE_DEFAULT }, 400);
  }

  await db.delete(dayPatterns).where(eq(dayPatterns.id, patternId));
  broadcastToTrip(tripId, user.id, { type: "pattern:deleted", dayId, patternId });
  return c.json({ ok: true });
});

// Duplicate pattern (with spots)
patternRoutes.post("/:tripId/days/:dayId/patterns/:patternId/duplicate", async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("tripId");
  const dayId = c.req.param("dayId");
  const patternId = c.req.param("patternId");

  const role = await verifyDayAccess(tripId, dayId, user.id);
  if (!canEdit(role)) {
    return c.json({ error: ERROR_MSG.TRIP_NOT_FOUND }, 404);
  }

  const source = await db.query.dayPatterns.findFirst({
    where: and(eq(dayPatterns.id, patternId), eq(dayPatterns.tripDayId, dayId)),
    with: { spots: true },
  });
  if (!source) {
    return c.json({ error: ERROR_MSG.PATTERN_NOT_FOUND }, 404);
  }

  const maxOrderResult = await db
    .select({ max: sql<number>`COALESCE(MAX(${dayPatterns.sortOrder}), -1)` })
    .from(dayPatterns)
    .where(eq(dayPatterns.tripDayId, dayId));

  const result = await db.transaction(async (tx) => {
    const [newPattern] = await tx
      .insert(dayPatterns)
      .values({
        tripDayId: dayId,
        label: `${source.label} (copy)`,
        isDefault: false,
        sortOrder: (maxOrderResult[0]?.max ?? -1) + 1,
      })
      .returning();

    if (source.spots.length > 0) {
      await tx.insert(spots).values(
        source.spots.map((spot) => ({
          tripId,
          dayPatternId: newPattern.id,
          name: spot.name,
          category: spot.category,
          address: spot.address,
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

  broadcastToTrip(tripId, user.id, {
    type: "pattern:duplicated",
    dayId,
    pattern: toPatternNotification(result),
  });
  return c.json(result, 201);
});

export { patternRoutes };
