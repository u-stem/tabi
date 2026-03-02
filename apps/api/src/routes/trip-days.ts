import { updateTripDaySchema } from "@sugara/shared";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/index";
import { tripDays } from "../db/schema";
import { logActivity } from "../lib/activity-logger";
import { ERROR_MSG } from "../lib/constants";
import { hasChanges } from "../lib/has-changes";
import { requireAuth } from "../middleware/auth";
import { requireTripAccess } from "../middleware/require-trip-access";
import type { AppEnv } from "../types";

const tripDayRoutes = new Hono<AppEnv>();
tripDayRoutes.use("*", requireAuth);

// Update trip day (memo / weather / temperature)
tripDayRoutes.patch("/:tripId/days/:dayId", requireTripAccess("editor"), async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("tripId");
  const dayId = c.req.param("dayId");

  const body = await c.req.json();
  const parsed = updateTripDaySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const existing = await db.query.tripDays.findFirst({
    where: and(eq(tripDays.id, dayId), eq(tripDays.tripId, tripId)),
  });
  if (!existing) {
    return c.json({ error: ERROR_MSG.DAY_NOT_FOUND }, 404);
  }

  if (!hasChanges(existing, parsed.data)) {
    return c.json(existing);
  }

  const [updated] = await db
    .update(tripDays)
    .set({
      memo: parsed.data.memo,
      ...(parsed.data.weatherType !== undefined && { weatherType: parsed.data.weatherType }),
      ...(parsed.data.weatherTypeSecondary !== undefined && {
        weatherTypeSecondary: parsed.data.weatherTypeSecondary,
      }),
      ...(parsed.data.tempHigh !== undefined && { tempHigh: parsed.data.tempHigh }),
      ...(parsed.data.tempLow !== undefined && { tempLow: parsed.data.tempLow }),
    })
    .where(eq(tripDays.id, dayId))
    .returning();

  const hasWeatherUpdate =
    parsed.data.weatherType !== undefined ||
    parsed.data.weatherTypeSecondary !== undefined ||
    parsed.data.tempHigh !== undefined ||
    parsed.data.tempLow !== undefined;

  logActivity({
    tripId,
    userId: user.id,
    action: "updated",
    entityType: hasWeatherUpdate ? "day_weather" : "day_memo",
    detail: `${existing.dayNumber}日目`,
  });

  return c.json(updated);
});

export { tripDayRoutes };
